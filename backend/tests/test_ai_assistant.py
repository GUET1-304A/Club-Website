"""智能项目管理智能体 — 测试。

覆盖：
  - 周报生命周期（创建草稿/提交/管理端审阅/权限隔离）
  - AI 周报分析（mock 大模型）
  - 智能体对话工具循环（Function Calling）
  - 需求解析与方案落地（parse-requirement → apply-plan）
  - 提醒（成员创建/管理端创建/定时扫描生成通知）
"""

import json
import uuid
from datetime import datetime, timedelta, timezone

import pytest

from models import (
    AdminNotification,
    Milestone,
    Notification,
    Project,
    Reminder,
    SiteConfig,
    Task,
    WeeklyReport,
    db,
)
from services.ai_service import AiNotConfigured, AiRequestFailed
from services.reminder_service import run_reminder_scan


AI_RESPONSE = {
    'choices': [{
        'message': {
            'role': 'assistant',
            'content': '{"score": 85, "completion": "完成度良好", '
                       '"risks": ["联调时间偏紧"], '
                       '"suggestions": ["提前一周开始联调"], '
                       '"report": "本周进度符合预期，建议关注联调风险。"}',
        },
    }],
}


class FakeAI:
    """可编程的假 AI 客户端，按顺序返回预设响应。"""

    def __init__(self, config):
        self.config = config

    def __call__(self):
        return self

    def validate_configuration(self):
        if not self.config.get('AI_ENABLED', False):
            raise AiNotConfigured('AI is disabled or its provider settings are incomplete')
        return self.config

    def status(self):
        return {
            'enabled': True,
            'configured': True,
            'provider': 'test',
        }

    def chat_completion(self, messages, tools=None, temperature=0.3, max_tokens=None):
        if not FakeAI.responses:
            raise AssertionError('No fake AI response left')
        return FakeAI.responses.pop(0)

    def chat_completion_stream(self, messages, tools=None, temperature=0.3, max_tokens=None):
        if not FakeAI.stream_responses:
            raise AssertionError('No fake AI stream response left')
        return iter(FakeAI.stream_responses.pop(0))

    stream_responses = []


class CapturingAI(FakeAI):
    captured_messages = []

    def chat_completion(self, messages, tools=None, temperature=0.3, max_tokens=None):
        CapturingAI.captured_messages.append(messages)
        return super().chat_completion(messages, tools, temperature, max_tokens)


def _member_headers(client, account='2023001'):
    login = client.post(
        '/api/member/login',
        json={'account': account, 'password': 'member123'},
    )
    assert login.status_code == 200
    return {'Authorization': f"Bearer {login.get_json()['token']}"}


def _admin_headers(client):
    login = client.post(
        '/api/admin/login',
        json={'username': 'admin', 'password': 'admin123'},
    )
    assert login.status_code == 200
    return {'Authorization': f"Bearer {login.get_json()['token']}"}


def _enable_ai(client):
    client.application.config.update({
        'AI_ENABLED': True,
        'AI_API_KEY': 'test-key',
        'AI_BASE_URL': 'https://ai.example.test/v1',
        'AI_MODEL': 'test-model',
    })


# ═══════════════════════════════════════════════════════════════
# 周报生命周期
# ═══════════════════════════════════════════════════════════════

def test_weekly_report_lifecycle(client):
    headers = _member_headers(client)
    report_id = None

    try:
        created = client.post(
            '/api/member/weekly-reports',
            headers=headers,
            json={
                'weekStart': '2026-08-03',
                'weekEnd': '2026-08-09',
                'done': '完成登录页适配',
                'plan': '实现看板拖拽',
                'issues': '拖拽性能待优化',
            },
        )
        assert created.status_code == 201
        report = created.get_json()['report']
        report_id = report['id']
        assert report['status'] == 'draft'
        assert report['content']['done'] == '完成登录页适配'
        assert report['weekStart'] == '2026-08-03'

        listed = client.get('/api/member/weekly-reports', headers=headers)
        assert listed.status_code == 200
        assert any(r['id'] == report_id for r in listed.get_json())

        updated = client.put(
            f'/api/member/weekly-reports/{report_id}',
            headers=headers,
            json={'content': {'done': '完成登录页适配', 'plan': '实现看板拖拽', 'issues': '', 'summary': '顺利'}},
        )
        assert updated.status_code == 200

        submitted = client.post(
            f'/api/member/weekly-reports/{report_id}/submit',
            headers=headers,
        )
        assert submitted.status_code == 200
        assert submitted.get_json()['report']['status'] == 'submitted'
        assert submitted.get_json()['report']['submittedAt'] is not None

        # 已提交不可再编辑
        edit_after_submit = client.put(
            f'/api/member/weekly-reports/{report_id}',
            headers=headers,
            json={'weekStart': '2026-08-04'},
        )
        assert edit_after_submit.status_code == 400

        # 管理端可查看并审阅
        admin_headers = _admin_headers(client)
        all_reports = client.get('/api/admin/weekly-reports?status=submitted', headers=admin_headers)
        assert all_reports.status_code == 200
        assert any(r['id'] == report_id for r in all_reports.get_json())

        reviewed = client.post(
            f'/api/admin/weekly-reports/{report_id}/review',
            headers=admin_headers,
            json={'reviewNote': '进度符合预期', 'completionRate': 90},
        )
        assert reviewed.status_code == 200
        reviewed_data = reviewed.get_json()['report']
        assert reviewed_data['status'] == 'reviewed'
        assert reviewed_data['reviewNote'] == '进度符合预期'
        assert reviewed_data['completionRate'] == 90

        # 审阅后给提交者生成站内通知
        notifications = client.get('/api/member/notifications', headers=headers).get_json()
        assert any(n['type'] == 'announcement' and '周报已审阅' in n['title'] for n in notifications)
    finally:
        if report_id is not None:
            with client.application.app_context():
                report = db.session.get(WeeklyReport, report_id)
                if report is not None:
                    db.session.delete(report)
                    db.session.commit()


def test_weekly_report_submit_notifies_admins(client):
    headers = _member_headers(client)
    admin_headers = _admin_headers(client)
    report_id = None

    try:
        created = client.post(
            '/api/member/weekly-reports',
            headers=headers,
            json={'done': '完成教师闭环', 'plan': '推送审核报告', 'issues': ''},
        )
        assert created.status_code == 201
        report_id = created.get_json()['report']['id']

        submitted = client.post(
            f'/api/member/weekly-reports/{report_id}/submit',
            headers=headers,
        )
        assert submitted.status_code == 200

        notifications = client.get('/api/admin/notifications', headers=admin_headers)
        assert notifications.status_code == 200
        items = notifications.get_json()
        assert any(
            n['type'] == 'weekly_report_submitted'
            and '新周报待审阅' in n['title']
            for n in items
        )
        assert any(
            n.get('link') == f'/admin/weekly-reports?report={report_id}'
            for n in items
        )

        unread = client.get('/api/admin/notifications/unread-count', headers=admin_headers)
        assert unread.status_code == 200
        assert unread.get_json()['count'] >= 1

        target = next(n for n in items if n['type'] == 'weekly_report_submitted')
        marked = client.put(
            f"/api/admin/notifications/{target['id']}/read",
            headers=admin_headers,
        )
        assert marked.status_code == 200
        assert marked.get_json()['notification']['isRead'] is True
    finally:
        if report_id is not None:
            with client.application.app_context():
                report = db.session.get(WeeklyReport, report_id)
                if report is not None:
                    db.session.delete(report)
                    AdminNotification.query.filter(AdminNotification.link.like('/admin/weekly-reports%')).delete(synchronize_session=False)
                    db.session.commit()


def test_weekly_report_submit_dispatches_external_admin_notification(client, monkeypatch):
    headers = _member_headers(client)
    report_id = None
    dispatched = []

    def fake_dispatch(payload, recipients=None):
        dispatched.append((payload, recipients))
        return [{'channel': 'email', 'success': True, 'recipients': len(recipients or [])}]

    monkeypatch.setattr('services.notification_service.dispatch_external_notification', fake_dispatch)

    with client.application.app_context():
        from models import AdminUser

        admin = AdminUser.query.filter_by(username='admin').first()
        admin.email = 'teacher@example.com'
        db.session.commit()

    try:
        created = client.post(
            '/api/member/weekly-reports',
            headers=headers,
            json={'done': '完成外部通知', 'plan': '接入飞书邮件', 'issues': ''},
        )
        assert created.status_code == 201
        report_id = created.get_json()['report']['id']

        submitted = client.post(
            f'/api/member/weekly-reports/{report_id}/submit',
            headers=headers,
        )
        assert submitted.status_code == 200

        assert len(dispatched) == 1
        payload, recipients = dispatched[0]
        assert payload.title.startswith('新周报待审阅')
        assert payload.link == f'/admin/weekly-reports?report={report_id}'
        assert payload.notification_type == 'weekly_report_submitted'
        assert recipients == ['teacher@example.com']
    finally:
        if report_id is not None:
            with client.application.app_context():
                report = db.session.get(WeeklyReport, report_id)
                if report is not None:
                    db.session.delete(report)
                    AdminNotification.query.filter(AdminNotification.link.like('/admin/weekly-reports%')).delete(synchronize_session=False)
                    db.session.commit()


def test_weekly_report_permission_isolation(client):
    headers_a = _member_headers(client, '2023001')
    headers_b = _member_headers(client, '2023002')
    report_id = None

    try:
        created = client.post(
            '/api/member/weekly-reports',
            headers=headers_a,
            json={'done': 'A 的周报', 'plan': '计划', 'issues': ''},
        )
        report_id = created.get_json()['report']['id']

        forbidden = client.get(f'/api/member/weekly-reports/{report_id}', headers=headers_b)
        assert forbidden.status_code == 404
        forbidden_submit = client.post(
            f'/api/member/weekly-reports/{report_id}/submit',
            headers=headers_b,
        )
        assert forbidden_submit.status_code == 404
    finally:
        if report_id is not None:
            with client.application.app_context():
                report = db.session.get(WeeklyReport, report_id)
                if report is not None:
                    db.session.delete(report)
                    db.session.commit()


def test_weekly_report_delete_rules(client):
    headers = _member_headers(client)
    admin_headers = _admin_headers(client)
    draft_id = None
    reviewed_id = None

    try:
        # 草稿可删除
        created = client.post(
            '/api/member/weekly-reports',
            headers=headers,
            json={'done': '可删除的草稿', 'plan': '', 'issues': ''},
        )
        draft_id = created.get_json()['report']['id']
        deleted = client.delete(f'/api/member/weekly-reports/{draft_id}', headers=headers)
        assert deleted.status_code == 200
        draft_id = None

        # 已审阅的不可删除
        created = client.post(
            '/api/member/weekly-reports',
            headers=headers,
            json={'done': '已审阅的记录', 'plan': '', 'issues': ''},
        )
        reviewed_id = created.get_json()['report']['id']
        client.post(f'/api/member/weekly-reports/{reviewed_id}/submit', headers=headers)
        client.post(
            f'/api/admin/weekly-reports/{reviewed_id}/review',
            headers=admin_headers,
            json={'reviewNote': '已审阅'},
        )
        forbidden = client.delete(f'/api/member/weekly-reports/{reviewed_id}', headers=headers)
        assert forbidden.status_code == 400
    finally:
        with client.application.app_context():
            for report_id in (draft_id, reviewed_id):
                if report_id is None:
                    continue
                report = db.session.get(WeeklyReport, report_id)
                if report is not None:
                    db.session.delete(report)
            db.session.commit()


def test_weekly_report_ai_analysis(client, monkeypatch):
    _enable_ai(client)
    headers = _member_headers(client)
    report_id = None

    try:
        created = client.post(
            '/api/member/weekly-reports',
            headers=headers,
            json={'done': '完成接口开发', 'plan': '前端联调', 'issues': '无'},
        )
        report_id = created.get_json()['report']['id']

        FakeAI.responses = [AI_RESPONSE]
        monkeypatch.setattr('services.assistant_tools.AIService', FakeAI)

        analyzed = client.post(
            f'/api/member/weekly-reports/{report_id}/analyze',
            headers=headers,
        )
        assert analyzed.status_code == 200
        analysis = analyzed.get_json()['report']
        assert analysis['aiAnalysis']['score'] == 85
        assert analysis['aiAnalysis']['report'].startswith('本周进度')
        assert analysis['completionRate'] == 85

        admin_headers = _admin_headers(client)
        notifications = client.get('/api/admin/notifications', headers=admin_headers).get_json()
        assert any(
            n['type'] == 'weekly_report_analyzed'
            and 'AI 分析完成' in n['title']
            for n in notifications
        )
    finally:
        if report_id is not None:
            with client.application.app_context():
                report = db.session.get(WeeklyReport, report_id)
                if report is not None:
                    db.session.delete(report)
                    db.session.commit()


def test_weekly_report_template_is_exposed_in_public_config(client):
    response = client.get('/api/config')

    assert response.status_code == 200
    template = response.get_json()['weekly_report_template']
    assert template['title'] == '周报模板'
    assert [field['key'] for field in template['fields']] == [
        'done',
        'plan',
        'issues',
        'summary',
    ]
    assert template['fields'][0]['required'] is True


def test_weekly_report_template_required_fields_drive_create_validation(client):
    headers = _member_headers(client)
    report_id = None

    with client.application.app_context():
        cfg = SiteConfig.query.filter_by(config_key='weekly_report_template').first()
        cfg.config_value = {
            'title': '研发周报',
            'fields': [
                {
                    'key': 'progress',
                    'label': '进展说明',
                    'required': True,
                    'placeholder': '本周推进了什么',
                    'rows': 3,
                },
                {
                    'key': 'risks',
                    'label': '风险阻塞',
                    'required': False,
                    'placeholder': '风险或需要协助',
                    'rows': 2,
                },
            ],
        }
        db.session.commit()

    try:
        rejected = client.post(
            '/api/member/weekly-reports',
            headers=headers,
            json={'content': {'risks': '接口依赖未确定'}},
        )
        assert rejected.status_code == 400
        assert '进展说明' in rejected.get_json()['message']

        created = client.post(
            '/api/member/weekly-reports',
            headers=headers,
            json={'content': {'progress': '完成模板配置', 'risks': '暂无'}},
        )
        assert created.status_code == 201
        report = created.get_json()['report']
        report_id = report['id']
        assert report['content']['progress'] == '完成模板配置'
    finally:
        with client.application.app_context():
            if report_id is not None:
                report = db.session.get(WeeklyReport, report_id)
                if report is not None:
                    db.session.delete(report)
            cfg = SiteConfig.query.filter_by(config_key='weekly_report_template').first()
            if cfg is not None:
                cfg.config_value = {
                    'title': '周报模板',
                    'fields': [
                        {'key': 'done', 'label': '本周完成', 'required': True, 'placeholder': '本周完成了哪些工作？', 'rows': 3},
                        {'key': 'plan', 'label': '下周计划', 'required': False, 'placeholder': '下周计划做什么？', 'rows': 2},
                        {'key': 'issues', 'label': '遇到的问题', 'required': False, 'placeholder': '遇到的问题、风险或需要帮助的地方（可选）', 'rows': 2},
                        {'key': 'summary', 'label': '一句话总结', 'required': False, 'placeholder': '本周整体进展的一句话总结', 'rows': 2},
                    ],
                }
            db.session.commit()


def test_weekly_report_ai_analysis_uses_template_field_labels(client, monkeypatch):
    _enable_ai(client)
    headers = _member_headers(client)
    report_id = None
    CapturingAI.captured_messages = []

    with client.application.app_context():
        cfg = SiteConfig.query.filter_by(config_key='weekly_report_template').first()
        cfg.config_value = {
            'title': '研发周报',
            'fields': [
                {'key': 'progress', 'label': '进展说明', 'required': True, 'placeholder': '', 'rows': 3},
                {'key': 'support', 'label': '需要支持', 'required': False, 'placeholder': '', 'rows': 2},
            ],
        }
        db.session.commit()

    try:
        created = client.post(
            '/api/member/weekly-reports',
            headers=headers,
            json={'content': {'progress': '完成模板字段接入', 'support': '需要老师确认排期'}},
        )
        assert created.status_code == 201
        report_id = created.get_json()['report']['id']

        FakeAI.responses = [AI_RESPONSE]
        monkeypatch.setattr('services.assistant_tools.AIService', CapturingAI)

        analyzed = client.post(
            f'/api/member/weekly-reports/{report_id}/analyze',
            headers=headers,
        )
        assert analyzed.status_code == 200

        prompt = CapturingAI.captured_messages[0][1]['content']
        assert '进展说明：完成模板字段接入' in prompt
        assert '需要支持：需要老师确认排期' in prompt
    finally:
        with client.application.app_context():
            if report_id is not None:
                report = db.session.get(WeeklyReport, report_id)
                if report is not None:
                    db.session.delete(report)
            cfg = SiteConfig.query.filter_by(config_key='weekly_report_template').first()
            if cfg is not None:
                cfg.config_value = {
                    'title': '周报模板',
                    'fields': [
                        {'key': 'done', 'label': '本周完成', 'required': True, 'placeholder': '本周完成了哪些工作？', 'rows': 3},
                        {'key': 'plan', 'label': '下周计划', 'required': False, 'placeholder': '下周计划做什么？', 'rows': 2},
                        {'key': 'issues', 'label': '遇到的问题', 'required': False, 'placeholder': '遇到的问题、风险或需要帮助的地方（可选）', 'rows': 2},
                        {'key': 'summary', 'label': '一句话总结', 'required': False, 'placeholder': '本周整体进展的一句话总结', 'rows': 2},
                    ],
                }
            db.session.commit()


def test_weekly_report_analyze_requires_configuration(client):
    client.application.config.update({'AI_ENABLED': False})
    headers = _member_headers(client)
    report_id = None
    try:
        created = client.post(
            '/api/member/weekly-reports',
            headers=headers,
            json={'done': '未配置 AI 时的测试', 'plan': '', 'issues': ''},
        )
        report_id = created.get_json()['report']['id']
        response = client.post(
            f'/api/member/weekly-reports/{report_id}/analyze',
            headers=headers,
        )
        assert response.status_code == 503
        assert response.get_json()['error'] == 'not_configured'
    finally:
        if report_id is not None:
            with client.application.app_context():
                report = db.session.get(WeeklyReport, report_id)
                if report is not None:
                    db.session.delete(report)
                    db.session.commit()


# ═══════════════════════════════════════════════════════════════
# 智能体对话（Function Calling 工具循环）
# ═══════════════════════════════════════════════════════════════

def test_assistant_chat_runs_tool_loop(client, monkeypatch):
    _enable_ai(client)
    headers = _member_headers(client)

    tool_response = {
        'choices': [{
            'message': {
                'role': 'assistant',
                'content': '',
                'tool_calls': [{
                    'id': 'call-1',
                    'type': 'function',
                    'function': {
                        'name': 'list_my_tasks',
                        'arguments': '{"status": ""}',
                    },
                }],
            },
        }],
    }
    final_response = {
        'choices': [{
            'message': {
                'role': 'assistant',
                'content': '你当前没有分配给我的任务。',
            },
        }],
    }

    FakeAI.responses = [tool_response, final_response]
    monkeypatch.setattr('routes.assistant.AIService', FakeAI)
    monkeypatch.setattr('services.assistant_tools.AIService', FakeAI)

    response = client.post(
        '/api/assistant/chat',
        headers=headers,
        json={'message': '查看我的任务'},
    )
    assert response.status_code == 200
    data = response.get_json()
    assert data['success'] is True
    assert '没有' in data['reply']
    assert data['toolCalls'][0]['name'] == 'list_my_tasks'
    assert data['toolCalls'][0]['ok'] is True


def test_assistant_chat_returns_503_when_not_configured(client):
    client.application.config.update({'AI_ENABLED': False})
    headers = _member_headers(client)
    response = client.post(
        '/api/assistant/chat',
        headers=headers,
        json={'message': '你好'},
    )
    assert response.status_code == 503
    assert response.get_json()['error'] == 'not_configured'


def test_assistant_chat_stream_emits_delta_and_tool_events(client, monkeypatch):
    _enable_ai(client)
    headers = _member_headers(client)

    tool_chunks = [
        {'choices': [{'delta': {
            'role': 'assistant',
            'tool_calls': [{
                'index': 0,
                'id': 'call-s1',
                'function': {'name': 'list_my_tasks', 'arguments': ''},
            }],
        }}]},
        {'choices': [{'delta': {
            'tool_calls': [{'index': 0, 'function': {'arguments': '{"status": ""}'}}],
        }}]},
    ]
    final_chunks = [
        {'choices': [{'delta': {'content': '你的任务'}}]},
        {'choices': [{'delta': {'content': '一切正常。'}}]},
    ]
    FakeAI.stream_responses = [tool_chunks, final_chunks]
    FakeAI.responses = []
    monkeypatch.setattr('routes.assistant.AIService', FakeAI)
    monkeypatch.setattr('services.assistant_tools.AIService', FakeAI)

    response = client.post(
        '/api/assistant/chat/stream',
        headers=headers,
        json={'message': '查看我的任务'},
    )
    assert response.status_code == 200
    assert response.mimetype == 'text/event-stream'
    body = response.get_data(as_text=True)

    assert 'event: tool_start' in body
    assert 'list_my_tasks' in body
    assert 'event: tool_done' in body
    assert 'event: delta' in body
    assert '你的任务一切正常。' in body
    assert 'event: done' in body


def test_stream_tool_execution_creates_reminder(client, monkeypatch):
    _enable_ai(client)
    headers = _member_headers(client)
    reminder_ids = []
    conversation_id = None

    try:
        tool_chunks = [
            {'choices': [{'delta': {'role': 'assistant', 'tool_calls': [
                {'index': 0, 'id': 'call-r1',
                 'function': {'name': 'create_reminder', 'arguments': ''}},
            ]}}]},
            {'choices': [{'delta': {'tool_calls': [
                {'index': 0, 'function': {'arguments': (
                    '{"title": "提交周报", "message": "流式测试", '
                    '"scheduled_at": "2026-08-02T20:28:00+08:00"}'
                )}},
            ]}}]},
        ]
        final_chunks = [
            {'choices': [{'delta': {'content': '提醒已创建。'}}]},
        ]
        FakeAI.stream_responses = [tool_chunks, final_chunks]
        FakeAI.responses = []
        monkeypatch.setattr('routes.assistant.AIService', FakeAI)
        monkeypatch.setattr('services.assistant_tools.AIService', FakeAI)

        response = client.post(
            '/api/assistant/chat/stream',
            headers=headers,
            json={'message': '帮我创建提交周报的提醒'},
        )
        body = response.get_data(as_text=True)
        assert response.status_code == 200
        assert 'event: tool_done' in body
        assert '"ok": true' in body
        assert 'event: done' in body
        assert 'event: error' not in body

        import re
        match = re.search(r'event: conversation\ndata: (\{.*?\})\n\n', body, re.DOTALL)
        if match:
            conversation_id = json.loads(match.group(1))['id']

        reminders = client.get('/api/member/reminders', headers=headers).get_json()
        reminder_ids = [
            r['id'] for r in reminders
            if r['title'] == '提交周报' and r['message'] == '流式测试'
        ]
        assert reminder_ids
    finally:
        with client.application.app_context():
            for reminder_id in reminder_ids:
                reminder = db.session.get(Reminder, reminder_id)
                if reminder is not None:
                    db.session.delete(reminder)
            db.session.commit()
        if conversation_id is not None:
            client.delete(
                f'/api/assistant/conversations/{conversation_id}', headers=headers
            )


def test_assistant_chat_stream_requires_configuration(client, monkeypatch):
    client.application.config.update({'AI_ENABLED': False})
    headers = _member_headers(client)
    monkeypatch.setattr('routes.assistant.AIService', FakeAI)

    response = client.post(
        '/api/assistant/chat/stream',
        headers=headers,
        json={'message': '你好'},
    )
    assert response.status_code == 503
    assert response.get_json()['error'] == 'not_configured'


def test_assistant_chat_requires_auth(client):
    assert client.post('/api/assistant/chat', json={'message': 'hi'}).status_code == 401
    assert client.post('/api/assistant/chat/stream', json={'message': 'hi'}).status_code == 401
    assert client.get('/api/assistant/status').status_code == 401
    assert client.get('/api/assistant/conversations').status_code == 401


def test_assistant_message_too_long(client):
    client.application.config.update({'ASSISTANT_MAX_MESSAGE_LENGTH': 100})
    headers = _member_headers(client)
    try:
        response = client.post(
            '/api/assistant/chat',
            headers=headers,
            json={'message': '长' * 200},
        )
        assert response.status_code == 400
        assert response.get_json()['error'] == 'validation_error'
    finally:
        client.application.config.update({'ASSISTANT_MAX_MESSAGE_LENGTH': 4000})


def test_assistant_rate_limit(client):
    client.application.config.update({
        'AI_ENABLED': False,
        'ASSISTANT_RATE_LIMIT_PER_MINUTE': 2,
    })
    import routes.assistant as assistant_module
    assistant_module._rate_limit_buckets.clear()
    headers = _member_headers(client)
    try:
        for _ in range(2):
            response = client.post(
                '/api/assistant/chat', headers=headers, json={'message': 'hi'}
            )
            assert response.status_code == 503  # 未配置 AI，但说明限流未触发
        limited = client.post(
            '/api/assistant/chat', headers=headers, json={'message': 'hi'}
        )
        assert limited.status_code == 429
        assert limited.get_json()['error'] == 'rate_limited'
    finally:
        client.application.config.update({'ASSISTANT_RATE_LIMIT_PER_MINUTE': 1000})
        assistant_module._rate_limit_buckets.clear()


def test_assistant_status_reports_configuration(client, monkeypatch):
    _enable_ai(client)
    monkeypatch.setattr('routes.assistant.AIService', FakeAI)
    headers = _member_headers(client)
    response = client.get('/api/assistant/status', headers=headers)
    assert response.status_code == 200
    assert response.get_json()['configured'] is True


def test_conversation_crud_and_member_isolation(client):
    headers_a = _member_headers(client, '2023001')
    headers_b = _member_headers(client, '2023002')
    conversation_id = None
    login_a = client.post(
        '/api/member/login',
        json={'account': '2023001', 'password': 'member123'},
    )
    member_a_id = login_a.get_json()['member']['id']

    try:
        created = client.post(
            '/api/assistant/conversations',
            headers=headers_a,
            json={'title': '隔离测试对话'},
        )
        assert created.status_code == 201
        conversation_id = created.get_json()['conversation']['id']

        listed = client.get('/api/assistant/conversations', headers=headers_a)
        assert any(c['id'] == conversation_id for c in listed.get_json())
        assert all(c['memberId'] == member_a_id for c in listed.get_json())

        renamed = client.put(
            f'/api/assistant/conversations/{conversation_id}',
            headers=headers_a,
            json={'title': '重命名后的标题'},
        )
        assert renamed.status_code == 200
        assert renamed.get_json()['conversation']['title'] == '重命名后的标题'

        # 成员隔离：B 无法读取/修改/删除 A 的对话
        assert client.get(
            f'/api/assistant/conversations/{conversation_id}', headers=headers_b
        ).status_code == 404
        assert client.put(
            f'/api/assistant/conversations/{conversation_id}',
            headers=headers_b,
            json={'title': 'x'},
        ).status_code == 404
        assert client.delete(
            f'/api/assistant/conversations/{conversation_id}', headers=headers_b
        ).status_code == 404
    finally:
        if conversation_id is not None:
            client.delete(
                f'/api/assistant/conversations/{conversation_id}', headers=headers_a
            )


def test_chat_persists_messages_and_reuses_conversation(client, monkeypatch):
    _enable_ai(client)
    headers_a = _member_headers(client, '2023001')
    headers_b = _member_headers(client, '2023002')
    conversation_id = None

    try:
        FakeAI.responses = [{
            'choices': [{'message': {'role': 'assistant', 'content': '好的，已记录。'}}],
        }]
        monkeypatch.setattr('routes.assistant.AIService', FakeAI)
        monkeypatch.setattr('services.assistant_tools.AIService', FakeAI)

        first = client.post(
            '/api/assistant/chat',
            headers=headers_a,
            json={'message': '帮我记住这句话'},
        )
        assert first.status_code == 200
        conversation_id = first.get_json()['conversation']['id']
        assert conversation_id is not None

        detail = client.get(
            f'/api/assistant/conversations/{conversation_id}', headers=headers_a
        )
        assert detail.status_code == 200
        messages = detail.get_json()['messages']
        assert [m['role'] for m in messages] == ['user', 'assistant']
        assert messages[0]['content'] == '帮我记住这句话'
        assert '已记录' in messages[1]['content']

        # 第二次对话复用同一会话，历史从数据库加载
        FakeAI.responses = [{
            'choices': [{'message': {'role': 'assistant', 'content': '记住了！'}}],
        }]
        second = client.post(
            '/api/assistant/chat',
            headers=headers_a,
            json={'message': '还记得吗', 'conversationId': conversation_id},
        )
        assert second.status_code == 200
        assert second.get_json()['conversation']['id'] == conversation_id

        detail_again = client.get(
            f'/api/assistant/conversations/{conversation_id}', headers=headers_a
        )
        assert len(detail_again.get_json()['messages']) == 4
    finally:
        if conversation_id is not None:
            client.delete(
                f'/api/assistant/conversations/{conversation_id}', headers=headers_a
            )


def test_stream_emits_conversation_event_and_persists_messages(client, monkeypatch):
    _enable_ai(client)
    headers = _member_headers(client)
    conversation_id = None

    try:
        FakeAI.stream_responses = [[
            {'choices': [{'delta': {'content': '流式持久化'}}]},
            {'choices': [{'delta': {'content': '验证通过'}}]},
        ]]
        FakeAI.responses = []
        monkeypatch.setattr('routes.assistant.AIService', FakeAI)
        monkeypatch.setattr('services.assistant_tools.AIService', FakeAI)

        response = client.post(
            '/api/assistant/chat/stream',
            headers=headers,
            json={'message': '测试流式保存'},
        )
        body = response.get_data(as_text=True)
        assert response.status_code == 200
        assert 'event: conversation' in body
        assert 'event: delta' in body
        assert 'event: done' in body

        listed = client.get('/api/assistant/conversations', headers=headers)
        matches = [c for c in listed.get_json() if c['title'].startswith('测试流式保存')]
        assert matches
        conversation_id = matches[0]['id']

        detail = client.get(
            f'/api/assistant/conversations/{conversation_id}', headers=headers
        )
        messages = detail.get_json()['messages']
        assert [m['role'] for m in messages] == ['user', 'assistant']
        assert '流式持久化验证通过' in messages[1]['content']
    finally:
        if conversation_id is not None:
            client.delete(f'/api/assistant/conversations/{conversation_id}', headers=headers)


def test_get_project_health_tool(client):
    with client.application.app_context():
        from models import Member, Project
        from services.assistant_tools import execute_tool

        member = Member.query.filter_by(student_id='2023001').first()
        project = Project.query.first()
        if project is None:
            # 项目已不再有默认种子数据，这里自建一个用于工具调用
            project = Project(
                slug='assistant-health-fixture',
                name='智能体健康度测试项目',
                category='ai',
                status='active',
            )
            db.session.add(project)
            db.session.commit()
        assert member is not None and project is not None

        ok, data = execute_tool(
            'get_project_health', {'project_id': project.id}, member
        )
        assert ok is True
        assert 'completionRate' in data
        assert 'byStatus' in data
        assert 'overdueTaskCount' in data
        assert 'memberWorkload' in data

        ok_missing, error = execute_tool(
            'get_project_health', {'project_id': 999999}, member
        )
        assert ok_missing is False
        assert '项目不存在' in error


def test_suggest_weekly_report_draft_tool(client, monkeypatch):
    _enable_ai(client)
    project_id = None
    task_id = None
    try:
        with client.application.app_context():
            from models import Member
            from services.assistant_tools import execute_tool

            member = Member.query.filter_by(student_id='2023001').first()
            project = Project(
                slug=f'draft-test-{uuid.uuid4().hex[:8]}',
                name='草稿测试项目',
                status='active',
            )
            db.session.add(project)
            db.session.commit()
            project_id = project.id
            task = Task(
                project_id=project.id,
                title='完成首页开发',
                status='in_progress',
                assignee_id=member.id,
            )
            db.session.add(task)
            db.session.commit()
            task_id = task.id

            FakeAI.responses = [{
                'choices': [{'message': {'role': 'assistant', 'content': (
                    '{"done": "完成首页开发", "plan": "做接口联调", '
                    '"issues": "暂无", "summary": "进展顺利"}'
                )}}],
            }]
            monkeypatch.setattr('services.assistant_tools.AIService', FakeAI)

            ok, data = execute_tool('suggest_weekly_report_draft', {}, member)
            assert ok is True
            assert data['done'] == '完成首页开发'
            assert data['plan'] == '做接口联调'
            assert data['issues'] == '暂无'
    finally:
        with client.application.app_context():
            if task_id is not None:
                task = db.session.get(Task, task_id)
                if task is not None:
                    db.session.delete(task)
            if project_id is not None:
                project = db.session.get(Project, project_id)
                if project is not None:
                    db.session.delete(project)
            db.session.commit()


def test_weekly_report_submit_reminder_scan(client):
    project_id = None
    task_id = None
    try:
        with client.application.app_context():
            # 清掉历史周报提醒，保证断言确定
            Notification.query.filter_by(member_id=1, type='report_submit').delete()
            project = Project(
                slug=f'weekly-remind-{uuid.uuid4().hex[:8]}',
                name='周报催收项目',
                status='active',
            )
            db.session.add(project)
            db.session.commit()
            project_id = project.id
            task = Task(
                project_id=project.id,
                title='待完成任务',
                status='in_progress',
                assignee_id=1,
            )
            db.session.add(task)
            db.session.commit()
            task_id = task.id

        sent = run_reminder_scan(client.application)
        assert sent >= 1

        with client.application.app_context():
            reminder_notification = Notification.query.filter_by(
                member_id=1, type='report_submit'
            ).first()
            assert reminder_notification is not None
            assert '周报' in reminder_notification.title
            count_before = Notification.query.filter_by(
                member_id=1, type='report_submit'
            ).count()

        # 再次扫描不应重复提醒（7 天节流）
        run_reminder_scan(client.application)
        with client.application.app_context():
            count_after = Notification.query.filter_by(
                member_id=1, type='report_submit'
            ).count()
            assert count_after == count_before
    finally:
        with client.application.app_context():
            if task_id is not None:
                task = db.session.get(Task, task_id)
                if task is not None:
                    db.session.delete(task)
            if project_id is not None:
                project = db.session.get(Project, project_id)
                if project is not None:
                    db.session.delete(project)
            db.session.commit()


# ═══════════════════════════════════════════════════════════════
# 需求解析 → 方案确认 → 落地
# ═══════════════════════════════════════════════════════════════

PLAN_RESPONSE = {
    'choices': [{
        'message': {
            'role': 'assistant',
            'content': (
                '{"project": {"name": "AI 学习助手", "description": "智能答疑与学习路径规划", '
                '"category": "ai", "startDate": "2026-08-10", "endDate": "2026-10-01"}, '
                '"milestones": [{"name": "MVP", "description": "核心问答", "dueDate": "2026-09-01"}, '
                '{"name": "正式版", "description": "学习路径", "dueDate": "2026-10-01"}], '
                '"tasks": [{"milestoneIndex": 0, "title": "搭建后端框架", "priority": "high", '
                '"dueDate": "2026-08-15", "assigneeName": "王思远"}, '
                '{"milestoneIndex": 0, "title": "接入大模型 API", "priority": "high", '
                '"dueDate": "2026-08-20", "assigneeName": "林雨晴"}]}'
            ),
        },
    }],
}


def test_parse_requirement_and_apply_plan(client, monkeypatch):
    _enable_ai(client)
    headers = _member_headers(client)
    project_id = None
    milestone_ids = []
    task_ids = []

    try:
        FakeAI.responses = [PLAN_RESPONSE]
        monkeypatch.setattr('routes.assistant.AIService', FakeAI)
        monkeypatch.setattr('services.assistant_tools.AIService', FakeAI)

        parsed = client.post(
            '/api/assistant/parse-requirement',
            headers=headers,
            json={'message': '做一个 AI 学习助手，能答疑和规划学习路径，10 月前上线'},
        )
        assert parsed.status_code == 200
        plan = parsed.get_json()['plan']
        assert plan['project']['name'] == 'AI 学习助手'
        assert len(plan['milestones']) == 2
        assert len(plan['tasks']) == 2
        assert plan['tasks'][0]['assigneeName'] == '王思远'

        applied = client.post(
            '/api/assistant/apply-plan',
            headers=headers,
            json={'plan': plan},
        )
        assert applied.status_code == 201
        summary = applied.get_json()['summary']
        project_id = summary['project']['id']
        assert summary['project']['name'] == 'AI 学习助手'
        assert summary['milestoneCount'] == 2
        assert summary['taskCount'] == 2

        with client.application.app_context():
            project = db.session.get(Project, project_id)
            assert project is not None
            milestone_ids = [m.id for m in project.milestones]
            task_ids = [t.id for t in project.tasks]
            assert len(task_ids) == 2
            # 分配到成员王思远（学号 2023002）的任务应生成站内通知
            assigned = [t for t in project.tasks if t.assignee_id]
            assert assigned
            assert any(
                n.type == 'task_assigned' and 'AI 学习助手' in n.body
                for n in assigned[0].assignee.notifications
            )
    finally:
        with client.application.app_context():
            for task_id in task_ids:
                task = db.session.get(Task, task_id)
                if task is not None:
                    db.session.delete(task)
            for milestone_id in milestone_ids:
                milestone = db.session.get(Milestone, milestone_id)
                if milestone is not None:
                    db.session.delete(milestone)
            if project_id is not None:
                project = db.session.get(Project, project_id)
                if project is not None:
                    db.session.delete(project)
            db.session.commit()


def test_parse_requirement_stream_emits_delta_and_plan(client, monkeypatch):
    _enable_ai(client)
    headers = _member_headers(client)

    plan_chunks = [
        {'choices': [{'delta': {'content': '{"project": {"name": "流式项目", "description": "测试", "category": "web"}, '}}]},
        {'choices': [{'delta': {'content': '"milestones": [{"name": "MVP", "dueDate": "2026-09-01"}], "tasks": []}'}}]},
    ]
    FakeAI.stream_responses = [plan_chunks]
    FakeAI.responses = []
    monkeypatch.setattr('routes.assistant.AIService', FakeAI)
    monkeypatch.setattr('services.assistant_tools.AIService', FakeAI)

    response = client.post(
        '/api/assistant/parse-requirement/stream',
        headers=headers,
        json={'message': '做一个流式测试项目'},
    )
    assert response.status_code == 200
    assert response.mimetype == 'text/event-stream'
    body = response.get_data(as_text=True)
    assert 'event: ready' in body
    assert 'event: delta' in body
    assert '流式项目' in body
    assert 'event: plan' in body
    assert 'MVP' in body
    assert 'event: error' not in body


def test_parse_requirement_stream_reports_parse_error(client, monkeypatch):
    _enable_ai(client)
    headers = _member_headers(client)

    FakeAI.stream_responses = [[
        {'choices': [{'delta': {'content': '这段内容不是有效的 JSON'}}]},
    ]]
    FakeAI.responses = []
    monkeypatch.setattr('routes.assistant.AIService', FakeAI)
    monkeypatch.setattr('services.assistant_tools.AIService', FakeAI)

    response = client.post(
        '/api/assistant/parse-requirement/stream',
        headers=headers,
        json={'message': '测试解析失败'},
    )
    body = response.get_data(as_text=True)
    assert 'event: error' in body
    assert '无法解析' in body
    assert 'event: plan' not in body


def test_apply_plan_validates_project_name(client):
    headers = _member_headers(client)
    response = client.post(
        '/api/assistant/apply-plan',
        headers=headers,
        json={'plan': {'project': {'name': ''}, 'milestones': [], 'tasks': []}},
    )
    assert response.status_code == 400


# ═══════════════════════════════════════════════════════════════
# 提醒
# ═══════════════════════════════════════════════════════════════

def test_member_reminder_crud(client):
    headers = _member_headers(client)
    reminder_id = None
    try:
        created = client.post(
            '/api/member/reminders',
            headers=headers,
            json={
                'title': '周五提交周报',
                'message': '记得完成本周周报',
                'scheduledAt': '2099-01-01T09:00:00+08:00',
            },
        )
        assert created.status_code == 201
        reminder = created.get_json()['reminder']
        reminder_id = reminder['id']
        assert reminder['status'] == 'pending'
        assert reminder['scheduledAt'] is not None

        listed = client.get('/api/member/reminders', headers=headers)
        assert any(r['id'] == reminder_id for r in listed.get_json())

        completed = client.post(
            f'/api/member/reminders/{reminder_id}/complete',
            headers=headers,
        )
        assert completed.status_code == 200
        assert completed.get_json()['reminder']['status'] == 'done'
    finally:
        if reminder_id is not None:
            with client.application.app_context():
                reminder = db.session.get(Reminder, reminder_id)
                if reminder is not None:
                    db.session.delete(reminder)
                    db.session.commit()


def test_admin_can_create_reminder_for_member(client):
    headers = _admin_headers(client)
    reminder_id = None
    try:
        created = client.post(
            '/api/admin/reminders',
            headers=headers,
            json={
                'memberId': 2,
                'title': '请尽快提交周报',
                'type': 'report_submit',
            },
        )
        assert created.status_code == 201
        reminder = created.get_json()['reminder']
        reminder_id = reminder['id']
        assert reminder['memberId'] == 2
        assert reminder['type'] == 'report_submit'
    finally:
        if reminder_id is not None:
            with client.application.app_context():
                reminder = db.session.get(Reminder, reminder_id)
                if reminder is not None:
                    db.session.delete(reminder)
                    db.session.commit()


def test_due_reminder_dispatches_external_member_notification(client, monkeypatch):
    headers = _member_headers(client, '2022001')
    reminder_id = None
    dispatched = []

    def fake_dispatch(payload, recipients=None):
        dispatched.append((payload, recipients))
        return [{'channel': 'email', 'success': True, 'recipients': len(recipients or [])}]

    monkeypatch.setattr('services.reminder_service.dispatch_external_notification', fake_dispatch)

    try:
        created = client.post(
            '/api/member/reminders',
            headers=headers,
            json={
                'title': '立即提醒测试',
                'message': '需要同步外部通道',
            },
        )
        assert created.status_code == 201
        reminder = created.get_json()['reminder']
        reminder_id = reminder['id']
        assert reminder['status'] == 'sent'
        assert created.get_json()['sentImmediately'] is True

        assert len(dispatched) == 1
        payload, recipients = dispatched[0]
        assert payload.title == '立即提醒测试'
        assert payload.body == '需要同步外部通道'
        assert payload.link == '/member/notifications'
        assert payload.notification_type == 'announcement'
        assert recipients == ['xingyu@example.com']
    finally:
        if reminder_id is not None:
            with client.application.app_context():
                reminder = db.session.get(Reminder, reminder_id)
                if reminder is not None:
                    db.session.delete(reminder)
                Notification.query.filter_by(title='立即提醒测试').delete()
                db.session.commit()


def test_reminder_scan_sends_notification(client):
    reminder_id = None
    task_id = None
    project_id = None

    try:
        with client.application.app_context():
            now = datetime.now(timezone.utc)
            reminder = Reminder(
                member_id=1,
                type='custom',
                title='立即提醒测试',
                message='扫描应将其转为通知',
                scheduled_at=now - timedelta(minutes=1),
                status='pending',
            )
            db.session.add(reminder)
            db.session.commit()
            reminder_id = reminder.id

            project = Project(
                slug=f'scan-project-{uuid.uuid4().hex[:8]}',
                name='扫描测试项目',
                status='active',
            )
            db.session.add(project)
            db.session.commit()
            project_id = project.id

            task = Task(
                project_id=project.id,
                title='即将到期的任务',
                status='in_progress',
                due_date=now + timedelta(hours=6),
                assignee_id=1,
            )
            db.session.add(task)
            db.session.commit()
            task_id = task.id

        sent_count = run_reminder_scan(client.application)
        assert sent_count >= 2

        with client.application.app_context():
            reminder = db.session.get(Reminder, reminder_id)
            assert reminder.status == 'sent'
            assert reminder.sent_at is not None

            notifications = Notification.query.filter_by(member_id=1).all()
            assert any(n.title == '立即提醒测试' for n in notifications)
            assert any('即将到期' in n.title for n in notifications)
    finally:
        with client.application.app_context():
            if reminder_id is not None:
                reminder = db.session.get(Reminder, reminder_id)
                if reminder is not None:
                    db.session.delete(reminder)
            if task_id is not None:
                task = db.session.get(Task, task_id)
                if task is not None:
                    db.session.delete(task)
            if project_id is not None:
                project = db.session.get(Project, project_id)
                if project is not None:
                    db.session.delete(project)
            db.session.commit()
