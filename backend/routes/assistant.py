"""星雨作坊 — 智能项目管理智能体 API 路由

全部挂载在 /api/assistant/* 下，需要成员 JWT 认证。

端点:
  - GET  /api/assistant/status           — AI 服务配置状态（前端展示用）
  - POST /api/assistant/chat             — 智能体对话（Function Calling 工具循环）
  - POST /api/assistant/parse-requirement— 自然语言需求 → 结构化项目规划
  - POST /api/assistant/apply-plan       — 用户确认后把规划写入数据库

设计原则:
  - LLM 只负责生成工具参数，执行权在 assistant_tools 中并带权限校验
  - 需求解析结果必须经过用户确认（apply-plan）才会落库
"""

import json
import threading
import time
from datetime import datetime, timezone

from flask import Blueprint, Response, abort, current_app, jsonify, request, stream_with_context
from flask_jwt_extended import jwt_required

from models import AgentConversation, AgentMessage, Member, db
from services.ai_service import (
    AIService,
    AiNotConfigured,
    AiRequestFailed,
    response_text,
    response_tool_calls,
)
from services.assistant_tools import (
    ASSISTANT_TOOLS,
    apply_plan,
    build_requirement_messages,
    execute_tool,
    parse_requirement,
    parse_requirement_from_text,
)
from .member import _member_or_403

assistant_bp = Blueprint('assistant', __name__)

MAX_AGENT_ITERATIONS = 5
MAX_HISTORY_TURNS = 8
MAX_MESSAGE_LENGTH = 4000
MAX_TOOL_RESULT_CHARS = 6000
MAX_CHAT_TOKENS = 2048


# ── 每成员滑动窗口限流（进程内，单机部署足够；多副本部署需换 Redis）──
_rate_limit_lock = threading.Lock()
_rate_limit_buckets = {}

def _system_prompt():
    """构建系统提示词（注入当前日期，帮助模型理解截止时间）。"""
    today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    return (
        f'你是"星雨作坊"实验室的智能项目管理秘书，服务于实验室的师生。今天是 {today}。'
        '你可以访问平台真实数据（项目、任务、里程碑、成员、资源、周报、提醒、通知、获奖、博客、证书）。'
        '工作守则：\n'
        '1. 始终使用中文回答，语言简洁、结构清晰，适当使用列表。\n'
        '2. 需要查询或操作数据时，必须调用对应工具获取真实结果，禁止编造数据。'
        '非必要不调用工具：能直接回答的简单问题不要调工具，禁止为了展示能力而调用工具。'
        '查询类工具（list_*/get_*/search_*）可直接调用；'
        '写操作工具（create_*/update_*/submit_*/complete_*）必须先向用户确认关键信息再执行。'
        '同一轮内能一次调用的工具就一次调完，不要分多轮。\n'
        '3. 任务状态更新有权限限制（只能操作自己负责或自己负责项目的任务）。\n'
        '4. 用户提出模糊的项目需求时，引导用户使用"需求拆解"功能生成完整项目规划。\n'
        '5. 涉及截止日期时，结合今天的日期判断是否临近或逾期。\n'
        '6. 回答完成后，如果刚刚执行了写操作，简要说明结果并给出后续建议。\n'
        '7. 回答控制在必要长度内，不要长篇大论。\n'
        '8. 回答中禁止使用任何 emoji 表情或图标符号（如 ✅、⚠️、📋、⏰、🚀、👤、😊 等），'
        '只使用文字、标点和列表符号（- 或数字序号）。'
    )


@assistant_bp.route('/assistant/status', methods=['GET'])
@jwt_required()
def assistant_status():
    """返回 AI 服务配置状态，前端据此决定是否提示未配置。"""
    _member_or_403()
    return jsonify(AIService(current_app.config).status())


@assistant_bp.route('/assistant/chat', methods=['POST'])
@jwt_required()
def assistant_chat():
    """智能体对话端点：执行 Function Calling 工具循环。"""
    member = _member_or_403()
    data = request.get_json()
    if not data or not str(data.get('message') or '').strip():
        return jsonify({'error': 'bad_request', 'message': '消息不能为空'}), 400

    message = data['message'].strip()

    if len(message) > current_app.config.get(
        'ASSISTANT_MAX_MESSAGE_LENGTH', MAX_MESSAGE_LENGTH
    ):
        return jsonify({
            'error': 'validation_error',
            'message': f'消息过长，最多 {MAX_MESSAGE_LENGTH} 字',
        }), 400
    if _rate_limited(member.id):
        return jsonify({
            'error': 'rate_limited',
            'message': '请求过于频繁，请稍后再试',
        }), 429

    ai = AIService(current_app.config)
    try:
        ai.validate_configuration()
    except AiNotConfigured:
        return jsonify({
            'error': 'not_configured',
            'message': 'AI 服务未配置，请联系管理员在环境变量中配置 AI_ENABLED/AI_API_KEY/AI_BASE_URL/AI_MODEL',
        }), 503

    conversation, _ = _resolve_conversation(data, member)
    history = _load_conversation_history(conversation)
    # 用户消息立即落库，即使后续 AI 失败也不丢失
    _save_turn(conversation, 'user', message)
    db.session.commit()

    try:
        messages = [{'role': 'system', 'content': _system_prompt()}]
        messages.extend(history)
        messages.append({'role': 'user', 'content': message})

        tool_calls_log = []
        final_reply = ''

        for _ in range(MAX_AGENT_ITERATIONS):
            result = ai.chat_completion(
                messages, tools=ASSISTANT_TOOLS, temperature=0.4,
                max_tokens=current_app.config.get(
                    'ASSISTANT_CHAT_MAX_TOKENS', MAX_CHAT_TOKENS
                ),
            )
            content = response_text(result)
            calls = response_tool_calls(result)

            if not calls:
                final_reply = content
                break

            messages.append({
                'role': 'assistant',
                'content': content,
                'tool_calls': [
                    {
                        'id': call['id'],
                        'type': 'function',
                        'function': {
                            'name': call['name'],
                            'arguments': json.dumps(call['arguments'], ensure_ascii=False),
                        },
                    }
                    for call in calls
                ],
            })

            for call in calls:
                ok, result_data = execute_tool(call['name'], call['arguments'], member)
                tool_calls_log.append({
                    'name': call['name'],
                    'arguments': call['arguments'],
                    'ok': ok,
                    'result': result_data if ok else {'error': result_data},
                })
                messages.append({
                    'role': 'tool',
                    'tool_call_id': call['id'],
                    'content': json.dumps(
                        {'ok': ok, 'data': _compact_result(result_data)},
                        ensure_ascii=False,
                        default=str,
                    ),
                })

        if not final_reply:
            final_result = ai.chat_completion(
                messages, tools=ASSISTANT_TOOLS, temperature=0.4,
                max_tokens=current_app.config.get(
                    'ASSISTANT_CHAT_MAX_TOKENS', MAX_CHAT_TOKENS
                ),
            )
            final_reply = response_text(final_result)

    except AiRequestFailed:
        return jsonify({
            'error': 'ai_failed',
            'message': 'AI 服务暂时不可用，请稍后重试',
        }), 502

    _save_turn(conversation, 'assistant', final_reply, tool_calls_log)
    conversation.updated_at = datetime.now(timezone.utc)
    db.session.commit()

    return jsonify({
        'success': True,
        'reply': final_reply,
        'toolCalls': tool_calls_log,
        'conversation': conversation.to_dict(),
    })


@assistant_bp.route('/assistant/chat/stream', methods=['POST'])
@jwt_required()
def assistant_chat_stream():
    """智能体流式对话端点（SSE）。

    事件类型:
      - delta:      {text}                     回答增量（打字机效果）
      - tool_start: {name, arguments}          开始执行工具
      - tool_done:  {name, ok}                 工具执行完成
      - done:       {reply, toolCalls}         全部完成
      - error:      {error, message}           出错（配置/网络/提供方）
    """
    member = _member_or_403()
    data = request.get_json()
    if not data or not str(data.get('message') or '').strip():
        return jsonify({'error': 'bad_request', 'message': '消息不能为空'}), 400

    message = data['message'].strip()

    if len(message) > current_app.config.get(
        'ASSISTANT_MAX_MESSAGE_LENGTH', MAX_MESSAGE_LENGTH
    ):
        return jsonify({
            'error': 'validation_error',
            'message': f'消息过长，最多 {MAX_MESSAGE_LENGTH} 字',
        }), 400
    if _rate_limited(member.id):
        return jsonify({
            'error': 'rate_limited',
            'message': '请求过于频繁，请稍后再试',
        }), 429

    ai = AIService(current_app.config)
    try:
        ai.validate_configuration()
    except AiNotConfigured:
        return jsonify({
            'error': 'not_configured',
            'message': 'AI 服务未配置，请联系管理员在环境变量中配置 AI_ENABLED/AI_API_KEY/AI_BASE_URL/AI_MODEL',
        }), 503

    conversation, _ = _resolve_conversation(data, member)
    history = _load_conversation_history(conversation)
    # 用户消息立即落库
    _save_turn(conversation, 'user', message)
    db.session.commit()
    # 提前取出会话 id/标题：流式生成器运行在复制后的应用上下文中，
    # 原会话对象可能已脱离当前 Session，访问属性会触发 detached 错误
    conversation_id = conversation.id
    conversation_title = conversation.title
    member_id = member.id

    def generate():
        try:
            # 生成器运行在复制后的应用上下文中，原请求上下文里的对象已脱离 Session；
            # 用当前会话重新查询成员，保证工具执行时的对象可用
            live_member = db.session.get(Member, member_id)
            if live_member is None:
                yield _sse('error', {
                    'error': 'auth_failed',
                    'message': '成员账号不存在，请重新登录',
                })
                return

            # 先告知前端会话信息（新建/复用），再发送 ready
            yield _sse('conversation', {
                'id': conversation_id,
                'title': conversation_title,
            })
            # 立即发送 ready，让前端第一时间感知连接已建立（提供方首字延迟可能较长）
            yield _sse('ready', {'message': '已连接，等待模型回复'})

            messages = [{'role': 'system', 'content': _system_prompt()}]
            messages.extend(history)
            messages.append({'role': 'user', 'content': message})

            tool_calls_log = []
            reply = ''

            for _ in range(MAX_AGENT_ITERATIONS):
                content_parts = []
                accumulated_tool_calls = {}

                for chunk in ai.chat_completion_stream(
                    messages, tools=ASSISTANT_TOOLS, temperature=0.4,
                    max_tokens=current_app.config.get(
                        'ASSISTANT_CHAT_MAX_TOKENS', MAX_CHAT_TOKENS
                    ),
                ):
                    text = _accumulate_delta(chunk, content_parts, accumulated_tool_calls)
                    if text:
                        yield _sse('delta', {'text': text})

                calls = _finalize_tool_calls(accumulated_tool_calls)
                if not calls:
                    reply = ''.join(content_parts)
                    break

                messages.append({
                    'role': 'assistant',
                    'content': ''.join(content_parts),
                    'tool_calls': [
                        {
                            'id': call['id'],
                            'type': 'function',
                            'function': {
                                'name': call['name'],
                                'arguments': json.dumps(call['arguments'], ensure_ascii=False),
                            },
                        }
                        for call in calls
                    ],
                })

                for call in calls:
                    yield _sse('tool_start', {
                        'name': call['name'],
                        'arguments': call['arguments'],
                    })
                    ok, result_data = execute_tool(
                        call['name'], call['arguments'], live_member
                    )
                    tool_calls_log.append({
                        'name': call['name'],
                        'arguments': call['arguments'],
                        'ok': ok,
                        'result': result_data if ok else {'error': result_data},
                    })
                    yield _sse('tool_done', {'name': call['name'], 'ok': ok})
                    messages.append({
                        'role': 'tool',
                        'tool_call_id': call['id'],
                        'content': json.dumps(
                            {'ok': ok, 'data': _compact_result(result_data)},
                            ensure_ascii=False,
                            default=str,
                        ),
                    })

            if not reply:
                final_result = ai.chat_completion(
                    messages, tools=ASSISTANT_TOOLS, temperature=0.4,
                    max_tokens=current_app.config.get(
                        'ASSISTANT_CHAT_MAX_TOKENS', MAX_CHAT_TOKENS
                    ),
                )
                reply = response_text(final_result)

            conv = db.session.get(AgentConversation, conversation_id)
            _save_turn(conv, 'assistant', reply, tool_calls_log)
            conv.updated_at = datetime.now(timezone.utc)
            db.session.commit()

            yield _sse('done', {'reply': reply, 'toolCalls': tool_calls_log})

        except AiNotConfigured as exc:
            db.session.rollback()
            yield _sse('error', {
                'error': 'not_configured',
                'message': f'AI 服务未配置：{exc}',
            })
        except AiRequestFailed as exc:
            db.session.rollback()
            yield _sse('error', {
                'error': 'ai_failed',
                'message': f'AI 服务暂时不可用：{exc}',
            })
        except Exception as exc:
            db.session.rollback()
            current_app.logger.exception('Assistant stream failed')
            yield _sse('error', {
                'error': 'server_error',
                'message': f'智能体执行出错：{exc}',
            })

    return Response(
        stream_with_context(generate()),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no',
        },
    )


@assistant_bp.route('/assistant/conversations', methods=['GET'])
@jwt_required()
def list_conversations():
    """获取当前成员的对话列表（按最近更新排序，成员隔离）。"""
    member = _member_or_403()
    conversations = AgentConversation.query\
        .filter_by(member_id=member.id)\
        .order_by(AgentConversation.updated_at.desc(), AgentConversation.id.desc())\
        .all()
    return jsonify([c.to_dict() for c in conversations])


@assistant_bp.route('/assistant/conversations', methods=['POST'])
@jwt_required()
def create_conversation():
    """创建新对话（可指定标题，默认为"新对话"）。"""
    member = _member_or_403()
    data = request.get_json() or {}
    title = str(data.get('title') or '').strip() or '新对话'
    conversation = AgentConversation(member_id=member.id, title=title[:200])
    db.session.add(conversation)
    db.session.commit()
    return jsonify({'success': True, 'conversation': conversation.to_dict()}), 201


@assistant_bp.route('/assistant/conversations/<int:conversation_id>', methods=['GET'])
@jwt_required()
def get_conversation(conversation_id):
    """获取对话详情 + 全部消息（仅限自己的对话）。"""
    member = _member_or_403()
    conversation = _own_conversation(conversation_id, member)
    messages = AgentMessage.query\
        .filter_by(conversation_id=conversation.id)\
        .order_by(AgentMessage.id.asc())\
        .all()
    return jsonify({
        'conversation': conversation.to_dict(),
        'messages': [m.to_dict() for m in messages],
    })


@assistant_bp.route('/assistant/conversations/<int:conversation_id>', methods=['PUT'])
@jwt_required()
def rename_conversation(conversation_id):
    """重命名对话（仅限自己的对话）。"""
    member = _member_or_403()
    conversation = _own_conversation(conversation_id, member)
    data = request.get_json() or {}
    title = str(data.get('title') or '').strip()
    if not title:
        return jsonify({'error': 'bad_request', 'message': '标题不能为空'}), 400
    conversation.title = title[:200]
    conversation.updated_at = datetime.now(timezone.utc)
    db.session.commit()
    return jsonify({'success': True, 'conversation': conversation.to_dict()})


@assistant_bp.route('/assistant/conversations/<int:conversation_id>', methods=['DELETE'])
@jwt_required()
def delete_conversation(conversation_id):
    """删除对话及其全部消息（仅限自己的对话）。"""
    member = _member_or_403()
    conversation = _own_conversation(conversation_id, member)
    db.session.delete(conversation)
    db.session.commit()
    return jsonify({'success': True, 'message': '对话已删除'})


@assistant_bp.route('/assistant/parse-requirement', methods=['POST'])
@jwt_required()
def assistant_parse_requirement():
    """将自然语言需求解析为结构化项目规划（不写库，需用户确认）。"""
    member = _member_or_403()
    data = request.get_json()
    if not data or not str(data.get('message') or '').strip():
        return jsonify({'error': 'bad_request', 'message': '需求描述不能为空'}), 400
    if len(data['message']) > current_app.config.get(
        'ASSISTANT_MAX_MESSAGE_LENGTH', MAX_MESSAGE_LENGTH
    ):
        return jsonify({
            'error': 'validation_error',
            'message': f'需求描述过长，最多 {MAX_MESSAGE_LENGTH} 字',
        }), 400
    if _rate_limited(member.id):
        return jsonify({
            'error': 'rate_limited',
            'message': '请求过于频繁，请稍后再试',
        }), 429

    try:
        plan = parse_requirement(data['message'], member)
    except AiNotConfigured:
        return jsonify({
            'error': 'not_configured',
            'message': 'AI 服务未配置，请联系管理员配置 AI 服务',
        }), 503
    except AiRequestFailed:
        return jsonify({
            'error': 'ai_failed',
            'message': 'AI 解析暂时不可用，请稍后重试',
        }), 502

    return jsonify({'success': True, 'plan': plan})


@assistant_bp.route('/assistant/parse-requirement/stream', methods=['POST'])
@jwt_required()
def assistant_parse_requirement_stream():
    """流式需求解析（SSE）：边生成边展示内容，生成完返回结构化方案。

    事件类型:
      - ready: {message}
      - delta: {text}            生成内容增量（实时预览）
      - plan:  {plan}            解析完成的结构化方案
      - error: {error, message}
    """
    member = _member_or_403()
    data = request.get_json()
    if not data or not str(data.get('message') or '').strip():
        return jsonify({'error': 'bad_request', 'message': '需求描述不能为空'}), 400
    if len(data['message']) > current_app.config.get(
        'ASSISTANT_MAX_MESSAGE_LENGTH', MAX_MESSAGE_LENGTH
    ):
        return jsonify({
            'error': 'validation_error',
            'message': f'需求描述过长，最多 {MAX_MESSAGE_LENGTH} 字',
        }), 400
    if _rate_limited(member.id):
        return jsonify({
            'error': 'rate_limited',
            'message': '请求过于频繁，请稍后再试',
        }), 429

    ai = AIService(current_app.config)
    try:
        ai.validate_configuration()
    except AiNotConfigured:
        return jsonify({
            'error': 'not_configured',
            'message': 'AI 服务未配置，请联系管理员配置 AI 服务',
        }), 503

    messages = build_requirement_messages(data['message'].strip(), member)

    def generate():
        content_parts = []
        try:
            yield _sse('ready', {'message': '正在生成项目方案…'})
            for chunk in ai.chat_completion_stream(
                messages, temperature=0.3,
                max_tokens=current_app.config.get(
                    'ASSISTANT_PARSE_MAX_TOKENS', 4000
                ),
            ):
                text = _accumulate_delta(chunk, content_parts, {})
                if text:
                    yield _sse('delta', {'text': text})

            try:
                plan = parse_requirement_from_text(''.join(content_parts))
            except AiRequestFailed as exc:
                yield _sse('error', {
                    'error': 'parse_failed',
                    'message': f'生成内容无法解析为项目方案：{exc}',
                })
                return
            yield _sse('plan', {'plan': plan})
        except AiNotConfigured as exc:
            yield _sse('error', {'error': 'not_configured', 'message': f'AI 服务未配置：{exc}'})
        except AiRequestFailed as exc:
            yield _sse('error', {'error': 'ai_failed', 'message': f'AI 服务暂时不可用：{exc}'})
        except Exception as exc:
            current_app.logger.exception('Requirement stream failed')
            yield _sse('error', {'error': 'server_error', 'message': f'生成出错：{exc}'})

    return Response(
        stream_with_context(generate()),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no',
        },
    )


@assistant_bp.route('/assistant/apply-plan', methods=['POST'])
@jwt_required()
def assistant_apply_plan():
    """将用户确认后的项目规划写入数据库（项目 + 里程碑 + 任务）。"""
    member = _member_or_403()
    data = request.get_json()
    plan = data.get('plan') if data else None
    if not isinstance(plan, dict):
        return jsonify({'error': 'bad_request', 'message': '缺少项目规划数据'}), 400
    if _rate_limited(member.id):
        return jsonify({
            'error': 'rate_limited',
            'message': '请求过于频繁，请稍后再试',
        }), 429

    try:
        summary = apply_plan(plan, member)
    except ValueError as exc:
        return jsonify({'error': 'validation_error', 'message': str(exc)}), 400
    except Exception:
        return jsonify({'error': 'server_error', 'message': '规划落地失败，请稍后重试'}), 500

    return jsonify({'success': True, 'summary': summary}), 201


# ═══════════════════════════════════════════════════════════════
# 辅助函数
# ═══════════════════════════════════════════════════════════════

def _sanitize_history(history):
    """清洗对话历史：只保留 user/assistant 文本消息，限制条数。"""
    if not isinstance(history, list):
        return []
    cleaned = []
    for turn in history[-MAX_HISTORY_TURNS:]:
        if not isinstance(turn, dict):
            continue
        role = turn.get('role')
        content = turn.get('content')
        if role not in ('user', 'assistant') or not isinstance(content, str):
            continue
        content = content.strip()
        if not content:
            continue
        cleaned.append({'role': role, 'content': content})
    return cleaned


def _sse(event, payload):
    """Format one Server-Sent Events frame."""
    return (
        f"event: {event}\n"
        f"data: {json.dumps(payload, ensure_ascii=False, default=str)}\n\n"
    )


def _own_conversation(conversation_id, member):
    """查询成员自己的对话，不存在或不属于该成员时返回 404。"""
    conversation = AgentConversation.query.get(conversation_id)
    if not conversation or conversation.member_id != member.id:
        abort(404)
    return conversation


def _resolve_conversation(data, member):
    """解析请求中的会话：有 conversationId 则复用，否则自动创建。"""
    conversation_id = data.get('conversationId')
    if conversation_id is not None:
        try:
            conversation_id = int(conversation_id)
        except (TypeError, ValueError):
            abort(404)
        return _own_conversation(conversation_id, member), False

    conversation = AgentConversation(
        member_id=member.id,
        title=_title_from_message(data.get('message')),
    )
    db.session.add(conversation)
    db.session.commit()
    return conversation, True


def _load_conversation_history(conversation, limit=MAX_HISTORY_TURNS):
    """从数据库加载会话历史（最近 N 条 user/assistant 消息）。"""
    rows = AgentMessage.query\
        .filter_by(conversation_id=conversation.id)\
        .order_by(AgentMessage.id.desc())\
        .limit(limit)\
        .all()
    rows.reverse()
    return [
        {'role': m.role, 'content': m.content[:2000]}
        for m in rows
        if m.role in ('user', 'assistant') and m.content
    ]


def _rate_limited(member_id):
    """滑动窗口限流：每个成员每分钟最多 N 次（返回 True 表示应拒绝）。"""
    now = time.time()
    window = 60.0
    limit = current_app.config.get('ASSISTANT_RATE_LIMIT_PER_MINUTE', 30)
    with _rate_limit_lock:
        bucket = [
            t for t in _rate_limit_buckets.get(member_id, [])
            if t > now - window
        ]
        if len(bucket) >= limit:
            _rate_limit_buckets[member_id] = bucket
            return True
        bucket.append(now)
        _rate_limit_buckets[member_id] = bucket
    return False


def _compact_result(data, max_chars=MAX_TOOL_RESULT_CHARS):
    """递归压缩工具结果：截断超长字符串、限制列表数量，防止上下文膨胀。"""
    if isinstance(data, str):
        return data if len(data) <= max_chars else data[:max_chars] + '…（已截断）'
    if isinstance(data, dict):
        return {key: _compact_result(value, max_chars) for key, value in data.items()}
    if isinstance(data, list):
        if len(data) > 40:
            return _compact_result(data[:40], max_chars) + [f'…（共 {len(data)} 项，已省略）']
        return [_compact_result(item, max_chars) for item in data]
    return data


def _save_turn(conversation, role, content, tool_calls=None):
    """保存一轮对话消息到数据库。"""
    if not content and role == 'assistant':
        content = '（无回复）'
    db.session.add(AgentMessage(
        conversation_id=conversation.id,
        role=role,
        content=content,
        tool_calls=tool_calls,
    ))


def _title_from_message(message):
    """从首条消息生成会话标题（最多 20 字）。"""
    text = (message or '').strip().replace('\n', ' ')
    text = text[:20] + ('…' if len(text) > 20 else '')
    return text or '新对话'


def _accumulate_delta(chunk, content_parts, tool_calls):
    """Extract a delta from a streamed chunk, accumulating content/tool_calls.

    Returns the text delta so the caller can emit it live.
    """
    try:
        delta = chunk['choices'][0].get('delta') or {}
    except (KeyError, IndexError, TypeError):
        return ''

    text = ''
    if delta.get('content'):
        text = delta['content']
        content_parts.append(text)

    for tc in delta.get('tool_calls') or []:
        if not isinstance(tc, dict):
            continue
        idx = tc.get('index', 0)
        entry = tool_calls.setdefault(idx, {'id': '', 'name': '', 'arguments': ''})
        if tc.get('id'):
            entry['id'] = tc['id']
        function = tc.get('function') or {}
        if function.get('name'):
            entry['name'] += function['name']
        if function.get('arguments'):
            entry['arguments'] += function['arguments']
    return text


def _finalize_tool_calls(accumulated):
    """Convert accumulated streamed tool-call deltas into callable tool calls."""
    calls = []
    for idx in sorted(accumulated):
        entry = accumulated[idx]
        if not entry['name']:
            continue
        try:
            arguments = json.loads(entry['arguments']) if entry['arguments'] else {}
        except ValueError:
            arguments = {}
        if not isinstance(arguments, dict):
            arguments = {}
        calls.append({
            'id': entry['id'] or f'call-{idx}',
            'name': entry['name'],
            'arguments': arguments,
        })
    return calls
