"""智能项目管理智能体 — 工具注册表（Function Calling 的工具层）。

每个工具对应一个真实业务操作。LLM 只负责根据描述生成调用参数，
真正的执行与权限校验都在这里完成，确保智能体不会绕过系统权限。

权限规则:
  - 任何登录成员均可读：项目、任务、成员、资源、通知
  - 任务状态更新：仅限任务负责人或项目负责人
  - 周报：只能查看/提交/分析自己的周报
  - 提醒：只能管理自己的提醒
"""

import json
import re
import uuid
from datetime import datetime, timezone

from flask import current_app

from models import (
    Award,
    BlogPost,
    Certificate,
    db,
    Member,
    Milestone,
    Notification,
    Project,
    Reminder,
    ResourceFile,
    ResourceFolder,
    Task,
    WeeklyReport,
)
from services.ai_service import AIService, AiNotConfigured, AiRequestFailed, response_text


VALID_TASK_STATUSES = ('todo', 'in_progress', 'review', 'done', 'blocked')
VALID_TASK_PRIORITIES = ('low', 'medium', 'high', 'urgent')
VALID_REPORT_STATUSES = ('draft', 'submitted', 'reviewed')
VALID_REMINDER_STATUSES = ('pending', 'sent', 'done', 'cancelled')


# ═══════════════════════════════════════════════════════════════
# 工具 schema（暴露给大模型）
# ═══════════════════════════════════════════════════════════════

def _function_schema(name, description, properties, required=None):
    return {
        'type': 'function',
        'function': {
            'name': name,
            'description': description,
            'parameters': {
                'type': 'object',
                'properties': properties,
                'required': required or [],
            },
        },
    }


ASSISTANT_TOOLS = [
    _function_schema(
        'list_projects',
        '列出实验室的全部项目。可选的 status 为 active（进行中）/ completed（已完成）/ archived（已归档）。',
        {'status': {'type': 'string', 'description': '项目状态筛选，可选'}},
    ),
    _function_schema(
        'get_project',
        '获取单个项目详情，包括里程碑和任务列表。',
        {'project_id': {'type': 'integer', 'description': '项目 ID'}},
        required=['project_id'],
    ),
    _function_schema(
        'get_project_health',
        '获取项目健康度：任务完成率、里程碑进度、逾期任务、成员负载、最近截止时间。',
        {'project_id': {'type': 'integer', 'description': '项目 ID'}},
        required=['project_id'],
    ),
    _function_schema(
        'list_milestones',
        '列出指定项目的里程碑。',
        {'project_id': {'type': 'integer', 'description': '项目 ID'}},
        required=['project_id'],
    ),
    _function_schema(
        'list_project_tasks',
        '列出指定项目的全部任务（任何成员可查看项目内任务）。',
        {'project_id': {'type': 'integer', 'description': '项目 ID'}},
        required=['project_id'],
    ),
    _function_schema(
        'list_my_tasks',
        '列出分配给当前成员的任务。可选 status（todo/in_progress/review/done/blocked）筛选。',
        {'status': {'type': 'string', 'description': '任务状态筛选，可选'}},
    ),
    _function_schema(
        'create_task',
        '在指定项目中创建一个新任务。创建后会自动给负责人发送站内通知。',
        {
            'project_id': {'type': 'integer', 'description': '项目 ID'},
            'title': {'type': 'string', 'description': '任务标题'},
            'description': {'type': 'string', 'description': '任务描述，可选'},
            'assignee_id': {'type': 'integer', 'description': '负责人成员 ID，可选'},
            'milestone_id': {'type': 'integer', 'description': '所属里程碑 ID，可选'},
            'priority': {'type': 'string', 'description': '优先级 low/medium/high/urgent，默认 medium'},
            'due_date': {'type': 'string', 'description': '截止日期，ISO 格式如 2026-08-15，可选'},
        },
        required=['project_id', 'title'],
    ),
    _function_schema(
        'update_task_status',
        '更新任务状态（todo/in_progress/review/done/blocked）。仅任务负责人或项目负责人可操作。',
        {
            'task_id': {'type': 'integer', 'description': '任务 ID'},
            'status': {'type': 'string', 'description': '新状态：todo/in_progress/review/done/blocked'},
        },
        required=['task_id', 'status'],
    ),
    _function_schema(
        'update_task',
        '更新任务详情（标题/描述/优先级/截止日期/里程碑/负责人）。仅任务负责人或项目负责人可操作。',
        {
            'task_id': {'type': 'integer', 'description': '任务 ID'},
            'title': {'type': 'string', 'description': '新标题，可选'},
            'description': {'type': 'string', 'description': '新描述，可选'},
            'priority': {'type': 'string', 'description': '新优先级 low/medium/high/urgent，可选'},
            'due_date': {'type': 'string', 'description': '新截止日期，ISO 格式如 2026-08-15，可选'},
            'milestone_id': {'type': 'integer', 'description': '新所属里程碑 ID，可选'},
            'assignee_id': {'type': 'integer', 'description': '新负责人成员 ID，可选'},
        },
        required=['task_id'],
    ),
    _function_schema(
        'create_milestone',
        '为指定项目创建里程碑（阶段节点）。',
        {
            'project_id': {'type': 'integer', 'description': '项目 ID'},
            'name': {'type': 'string', 'description': '里程碑名称'},
            'description': {'type': 'string', 'description': '里程碑描述，可选'},
            'due_date': {'type': 'string', 'description': '截止日期，ISO 格式如 2026-08-15，可选'},
        },
        required=['project_id', 'name'],
    ),
    _function_schema(
        'list_members',
        '查询实验室成员目录（内部）。可按姓名/角色搜索或按分组筛选（product/design/dev/content）。',
        {
            'search': {'type': 'string', 'description': '按姓名/角色/技能搜索，可选'},
            'group': {'type': 'string', 'description': '分组筛选 product/design/dev/content，可选'},
        },
    ),
    _function_schema(
        'get_dashboard_stats',
        '获取平台统计数据：成员数、项目数、任务数、完成数。',
        {},
    ),
    _function_schema(
        'list_my_weekly_reports',
        '列出当前成员自己的周报。可选 status（draft/submitted/reviewed）筛选。',
        {'status': {'type': 'string', 'description': '周报状态筛选，可选'}},
    ),
    _function_schema(
        'get_weekly_report',
        '获取当前成员自己的单份周报详情（含 AI 分析结果）。',
        {'report_id': {'type': 'integer', 'description': '周报 ID'}},
        required=['report_id'],
    ),
    _function_schema(
        'create_weekly_report',
        '为当前成员创建一份周报草稿。done 为本周完成的工作，plan 为下周计划，issues 为遇到的问题。',
        {
            'week_start': {'type': 'string', 'description': '周开始日期，如 2026-08-03'},
            'week_end': {'type': 'string', 'description': '周结束日期，如 2026-08-09'},
            'done': {'type': 'string', 'description': '本周完成的工作'},
            'plan': {'type': 'string', 'description': '下周计划'},
            'issues': {'type': 'string', 'description': '遇到的问题或风险'},
            'project_id': {'type': 'integer', 'description': '关联项目 ID，可选'},
            'summary': {'type': 'string', 'description': '本周总结，可选'},
        },
        required=['week_start', 'week_end', 'done', 'plan', 'issues'],
    ),
    _function_schema(
        'submit_weekly_report',
        '提交当前成员的一份周报草稿（draft → submitted），提交后进入教师审阅流程。',
        {'report_id': {'type': 'integer', 'description': '周报 ID'}},
        required=['report_id'],
    ),
    _function_schema(
        'analyze_my_weekly_report',
        '对当前成员自己的周报执行 AI 分析：比对任务要求，给出完成度评分、风险和建议报告。',
        {'report_id': {'type': 'integer', 'description': '周报 ID'}},
        required=['report_id'],
    ),
    _function_schema(
        'suggest_weekly_report_draft',
        '根据当前成员的任务列表，用 AI 起草一份本周周报草稿（返回 done/plan/issues/summary）。',
        {},
    ),
    _function_schema(
        'list_my_reminders',
        '列出当前成员的提醒。可选 status（pending/sent/done/cancelled）筛选。',
        {'status': {'type': 'string', 'description': '提醒状态筛选，可选'}},
    ),
    _function_schema(
        'create_reminder',
        '为当前成员创建一条自定义提醒，到时间后会自动发送站内通知。',
        {
            'title': {'type': 'string', 'description': '提醒标题'},
            'message': {'type': 'string', 'description': '提醒内容，可选'},
            'scheduled_at': {'type': 'string', 'description': '触发时间，ISO 格式如 2026-08-05T18:00:00+08:00，可选（不填表示立即提醒）'},
            'project_id': {'type': 'integer', 'description': '关联项目 ID，可选'},
        },
        required=['title'],
    ),
    _function_schema(
        'complete_reminder',
        '将当前成员的一条提醒标记为已完成。',
        {'reminder_id': {'type': 'integer', 'description': '提醒 ID'}},
        required=['reminder_id'],
    ),
    _function_schema(
        'list_my_notifications',
        '列出当前成员的站内通知。',
        {'unread_only': {'type': 'boolean', 'description': '是否只列未读，可选'}},
    ),
    _function_schema(
        'list_my_certificates',
        '列出当前成员自己的证书（含 OCR 识别结果与审核状态）。',
        {},
    ),
    _function_schema(
        'search_resources',
        '在资源中心搜索文件或文件夹（团队知识库）。',
        {'query': {'type': 'string', 'description': '搜索关键词，可选（不填返回根目录）'}},
    ),
    _function_schema(
        'list_awards',
        '列出实验室的全部获奖荣誉记录（含等级、类别、获奖者）。',
        {},
    ),
    _function_schema(
        'list_blogs',
        '列出实验室已发布的博客/公告文章（标题、摘要、分类、日期）。',
        {},
    ),
]


# ═══════════════════════════════════════════════════════════════
# 工具执行
# ═══════════════════════════════════════════════════════════════

def execute_tool(name, arguments, member):
    """执行一个智能体工具，返回 (ok, data)。

    ok=False 时 data 为面向用户的错误信息。
    """
    handler = _TOOL_HANDLERS.get(name)
    if not handler:
        return False, f'未知工具: {name}'
    try:
        if not isinstance(arguments, dict):
            arguments = {}
        return handler(arguments, member)
    except Exception as exc:  # 工具内部错误不应中断整个对话
        current_app.logger.exception('Assistant tool %s failed', name)
        return False, f'工具 {name} 执行失败: {exc}'


_TOOL_HANDLERS = {}


def _tool(name):
    """装饰器：将处理函数注册到工具执行表。"""
    def decorator(handler):
        _TOOL_HANDLERS[name] = handler
        return handler
    return decorator


# ── 项目 / 里程碑 / 任务 ──

@_tool('list_projects')
def _list_projects(args, member):
    query = Project.query
    status = args.get('status')
    if status:
        query = query.filter_by(status=status)
    projects = query.order_by(Project.start_date.desc(), Project.id).all()
    return True, [p.to_dict() for p in projects]


@_tool('get_project')
def _get_project(args, member):
    project = Project.query.get(args.get('project_id'))
    if not project:
        return False, '项目不存在'
    milestones = Milestone.query.filter_by(project_id=project.id)\
        .order_by(Milestone.sort_order, Milestone.id).all()
    tasks = Task.query.filter_by(project_id=project.id)\
        .order_by(Task.sort_order, Task.id).all()
    return True, {
        'project': project.to_dict(),
        'milestones': [m.to_dict() for m in milestones],
        'tasks': [t.to_dict() for t in tasks],
    }


@_tool('get_project_health')
def _get_project_health(args, member):
    project = Project.query.get(args.get('project_id'))
    if not project:
        return False, '项目不存在'
    return True, compute_project_health(project)


def compute_project_health(project):
    """计算项目健康度统计（供智能体工具与管理端 API 复用）。"""
    now = datetime.now(timezone.utc)
    milestones = Milestone.query.filter_by(project_id=project.id)\
        .order_by(Milestone.sort_order, Milestone.id).all()
    tasks = Task.query.filter_by(project_id=project.id).all()
    total = len(tasks)
    done = sum(1 for t in tasks if t.status == 'done')
    by_status = {
        status: sum(1 for t in tasks if t.status == status)
        for status in VALID_TASK_STATUSES
    }
    pending = [t for t in tasks if t.status != 'done']
    overdue = [
        t for t in pending
        if t.due_date and t.due_date < now
    ]
    next_deadline = min(
        (t.due_date for t in pending if t.due_date),
        default=None,
    )
    workload = {}
    for t in pending:
        if t.assignee_id:
            workload[t.assignee_id] = workload.get(t.assignee_id, 0) + 1
    member_names = {}
    if workload:
        member_names = {
            m.id: m.name
            for m in Member.query.filter(Member.id.in_(workload.keys())).all()
        }

    return {
        'project': {
            'id': project.id,
            'name': project.name,
            'status': project.status,
        },
        'taskTotal': total,
        'taskDone': done,
        'completionRate': round(done / total * 100, 1) if total else 0,
        'byStatus': by_status,
        'milestoneCount': len(milestones),
        'milestonesDone': sum(1 for m in milestones if m.status == 'completed'),
        'overdueTaskCount': len(overdue),
        'overdueTasks': [
            {
                'id': t.id,
                'title': t.title,
                'dueDate': t.due_date.isoformat() if t.due_date else None,
                'assigneeName': t.assignee.name if t.assignee else None,
            }
            for t in overdue[:10]
        ],
        'nextDeadline': next_deadline.isoformat() if next_deadline else None,
        'memberWorkload': [
            {
                'memberId': member_id,
                'name': member_names.get(member_id),
                'pendingTasks': count,
            }
            for member_id, count in sorted(
                workload.items(), key=lambda item: -item[1]
            )
        ],
    }


@_tool('list_milestones')
def _list_milestones(args, member):
    project_id = args.get('project_id')
    project = Project.query.get(project_id)
    if not project:
        return False, '项目不存在'
    milestones = Milestone.query.filter_by(project_id=project_id)\
        .order_by(Milestone.sort_order, Milestone.id).all()
    return True, [m.to_dict() for m in milestones]


@_tool('list_project_tasks')
def _list_project_tasks(args, member):
    project = Project.query.get(args.get('project_id'))
    if not project:
        return False, '项目不存在'
    tasks = Task.query.filter_by(project_id=project.id)\
        .order_by(Task.sort_order, Task.id).all()
    return True, [t.to_dict() for t in tasks]


@_tool('list_my_tasks')
def _list_my_tasks(args, member):
    query = Task.query.filter_by(assignee_id=member.id)
    status = args.get('status')
    if status:
        query = query.filter_by(status=status)
    tasks = query.order_by(Task.priority.desc(), Task.due_date.asc(), Task.id).all()
    return True, [t.to_dict() for t in tasks]


@_tool('create_task')
def _create_task(args, member):
    project = Project.query.get(args.get('project_id'))
    if not project:
        return False, '项目不存在'
    title = str(args.get('title') or '').strip()
    if not title:
        return False, '任务标题不能为空'
    status = args.get('status') or 'todo'
    priority = args.get('priority') or 'medium'
    if status not in VALID_TASK_STATUSES:
        return False, f'无效状态: {status}'
    if priority not in VALID_TASK_PRIORITIES:
        return False, f'无效优先级: {priority}'

    task = Task(
        project_id=project.id,
        milestone_id=args.get('milestone_id'),
        assignee_id=args.get('assignee_id'),
        title=title,
        description=args.get('description'),
        status=status,
        priority=priority,
        due_date=_parse_date(args.get('due_date')),
    )
    db.session.add(task)
    db.session.flush()

    # 任务分配站内通知
    if task.assignee_id and task.assignee_id != member.id:
        assignee = Member.query.get(task.assignee_id)
        if assignee:
            db.session.add(Notification(
                member_id=assignee.id,
                type='task_assigned',
                title=f'新任务分配：{task.title}',
                body=f'项目：{project.name} · 截止：{task.due_date.date().isoformat() if task.due_date else "未设置"}',
                link=f'/member/projects/{project.id}',
                is_read=False,
            ))
    db.session.commit()
    return True, task.to_dict()


@_tool('update_task_status')
def _update_task_status(args, member):
    task = Task.query.get(args.get('task_id'))
    if not task:
        return False, '任务不存在'
    status = args.get('status')
    if status not in VALID_TASK_STATUSES:
        return False, f'无效状态: {status}'
    # 权限：任务负责人或项目负责人
    if task.assignee_id != member.id and task.project.owner_id != member.id:
        return False, '没有权限修改该任务的状态'
    task.status = status
    db.session.commit()
    return True, task.to_dict()


@_tool('update_task')
def _update_task(args, member):
    task = Task.query.get(args.get('task_id'))
    if not task:
        return False, '任务不存在'
    if task.assignee_id != member.id and task.project.owner_id != member.id:
        return False, '没有权限修改该任务'

    if 'title' in args:
        title = str(args.get('title') or '').strip()
        if not title:
            return False, '任务标题不能为空'
        task.title = title
    if 'description' in args:
        task.description = args.get('description')
    if 'priority' in args:
        priority = args.get('priority')
        if priority not in VALID_TASK_PRIORITIES:
            return False, f'无效优先级: {priority}'
        task.priority = priority
    if 'due_date' in args:
        task.due_date = _parse_date(args.get('due_date'))
    if 'milestone_id' in args:
        task.milestone_id = args.get('milestone_id')
    if 'assignee_id' in args:
        task.assignee_id = args.get('assignee_id')

    db.session.commit()
    return True, task.to_dict()


@_tool('create_milestone')
def _create_milestone(args, member):
    project = Project.query.get(args.get('project_id'))
    if not project:
        return False, '项目不存在'
    name = str(args.get('name') or '').strip()
    if not name:
        return False, '里程碑名称不能为空'
    sort_order = Milestone.query.filter_by(project_id=project.id).count()
    milestone = Milestone(
        project_id=project.id,
        name=name,
        description=args.get('description'),
        due_date=_parse_date(args.get('due_date')),
        status='pending',
        sort_order=sort_order,
    )
    db.session.add(milestone)
    db.session.commit()
    return True, milestone.to_dict()


# ── 成员 / 统计 / 资源 ──

@_tool('list_members')
def _list_members(args, member):
    query = Member.query.filter_by(status='active')
    group = args.get('group')
    search = args.get('search')
    if group:
        query = query.filter_by(group=group)
    if search:
        query = query.filter(
            db.or_(
                Member.name.contains(search),
                Member.role.contains(search),
                Member.skills.contains(search),
            )
        )
    members = query.order_by(Member.sort_order, Member.id).all()
    return True, [m.to_dict() for m in members]


@_tool('get_dashboard_stats')
def _get_dashboard_stats(args, member):
    return True, {
        'totalMembers': Member.query.filter_by(status='active').count(),
        'totalProjects': Project.query.count(),
        'activeProjects': Project.query.filter_by(status='active').count(),
        'totalTasks': Task.query.count(),
        'doneTasks': Task.query.filter_by(status='done').count(),
    }


@_tool('list_awards')
def _list_awards(args, member):
    awards = Award.query.order_by(Award.date.desc(), Award.id.desc()).limit(50).all()
    return True, [a.to_dict() for a in awards]


@_tool('list_blogs')
def _list_blogs(args, member):
    posts = BlogPost.query.filter_by(is_published=True)\
        .order_by(BlogPost.date.desc(), BlogPost.id.desc()).limit(50).all()
    return True, [p.to_dict() for p in posts]


@_tool('search_resources')
def _search_resources(args, member):
    query_text = (args.get('query') or '').strip()
    folders = ResourceFolder.query.order_by(ResourceFolder.name).all()
    files = ResourceFile.query.filter_by(is_deleted=False)\
        .order_by(ResourceFile.name).all()
    if query_text:
        folders = [f for f in folders if query_text.lower() in f.name.lower()]
        files = [f for f in files if query_text.lower() in f.name.lower()]
    return True, {
        'folders': [f.to_dict() for f in folders[:20]],
        'files': [f.to_dict() for f in files[:50]],
    }


# ── 周报 ──

@_tool('list_my_weekly_reports')
def _list_my_weekly_reports(args, member):
    query = WeeklyReport.query.filter_by(member_id=member.id)
    status = args.get('status')
    if status:
        query = query.filter_by(status=status)
    reports = query.order_by(WeeklyReport.week_start.desc(), WeeklyReport.id.desc()).all()
    return True, [r.to_dict() for r in reports]


@_tool('get_weekly_report')
def _get_weekly_report(args, member):
    report = WeeklyReport.query.get(args.get('report_id'))
    if not report or report.member_id != member.id:
        return False, '周报不存在'
    return True, report.to_dict()


@_tool('create_weekly_report')
def _create_weekly_report(args, member):
    content = {
        'done': str(args.get('done') or '').strip(),
        'plan': str(args.get('plan') or '').strip(),
        'issues': str(args.get('issues') or '').strip(),
        'summary': str(args.get('summary') or '').strip(),
    }
    if not content['done'] and not content['plan']:
        return False, '周报内容不能为空'
    report = WeeklyReport(
        member_id=member.id,
        project_id=args.get('project_id'),
        week_start=_parse_date(args.get('week_start'), date_only=True),
        week_end=_parse_date(args.get('week_end'), date_only=True),
        content=content,
        status='draft',
    )
    db.session.add(report)
    db.session.commit()
    return True, report.to_dict()


@_tool('submit_weekly_report')
def _submit_weekly_report(args, member):
    report = WeeklyReport.query.get(args.get('report_id'))
    if not report or report.member_id != member.id:
        return False, '周报不存在'
    if report.status == 'reviewed':
        return False, '周报已审阅，不能重复提交'
    report.status = 'submitted'
    report.submitted_at = datetime.now(timezone.utc)
    db.session.commit()
    return True, report.to_dict()


@_tool('analyze_my_weekly_report')
def _analyze_my_weekly_report(args, member):
    report = WeeklyReport.query.get(args.get('report_id'))
    if not report or report.member_id != member.id:
        return False, '周报不存在'
    try:
        analysis = _analyze_report_with_ai(report)
    except AiNotConfigured:
        return False, 'AI 服务未配置，请联系管理员配置 AI_API_KEY/AI_BASE_URL/AI_MODEL'
    except AiRequestFailed as exc:
        return False, f'AI 分析失败: {exc}'
    report.ai_analysis = analysis
    report.completion_rate = analysis.get('score')
    db.session.commit()
    return True, report.to_dict()


@_tool('suggest_weekly_report_draft')
def _suggest_weekly_report_draft(args, member):
    tasks = Task.query.filter_by(assignee_id=member.id)\
        .order_by(Task.due_date.asc(), Task.id).all()
    if not tasks:
        return False, '你当前没有被分配的任务，无需起草周报'

    task_lines = '\n'.join(
        f"- {t.title}（状态:{t.status}，截止:{t.due_date.date().isoformat() if t.due_date else '未设置'}）"
        for t in tasks[:20]
    )
    messages = [
        {
            'role': 'system',
            'content': (
                '你是周报起草助手。根据成员的任务列表，把本周周报写成可直接提交的草稿。'
                '只输出 JSON 对象，格式：'
                '{"done": "本周完成的工作", "plan": "下周计划", "issues": "遇到的问题（可写暂无）", "summary": "一句话总结"}'
            ),
        },
        {'role': 'user', 'content': f'我的任务：\n{task_lines}'},
    ]
    result = AIService(current_app.config).chat_completion(
        messages, temperature=0.4, max_tokens=800
    )
    parsed = _parse_json(response_text(result))
    if not isinstance(parsed, dict):
        raise AiRequestFailed('AI 返回了无法解析的周报草稿')
    return True, {
        'done': str(parsed.get('done') or ''),
        'plan': str(parsed.get('plan') or ''),
        'issues': str(parsed.get('issues') or ''),
        'summary': str(parsed.get('summary') or ''),
    }


def _analyze_report_with_ai(report):
    """调用大模型对周报进行结构化分析，返回分析字典。"""
    tasks = Task.query.filter_by(project_id=report.project_id).all() if report.project_id else []
    task_summary = '\n'.join(
        f"- {t.title}（状态:{t.status}，截止:{t.due_date.date().isoformat() if t.due_date else '未设置'}）"
        for t in tasks[:30]
    ) or '该周报未关联具体项目任务。'

    messages = [
        {
            'role': 'system',
            'content': (
                '你是星雨作坊实验室的智能项目管理助手，负责审阅学生周报。'
                '根据周报内容与任务要求，评估完成度并生成审核报告。'
                '只输出 JSON 对象，不要输出任何其他文字，格式如下：\n'
                '{"score": 0到100的整数, "completion": "完成度评估", '
                '"risks": ["风险1"], "suggestions": ["建议1"], '
                '"report": "给教师的简短审核报告"}'
            ),
        },
        {
            'role': 'user',
            'content': (
                f'周报提交者：{report.member.name if report.member else "未知"}（第 {report.week_start or "?"} 周）\n\n'
                f'本周完成：{report.content.get("done", "")}\n'
                f'下周计划：{report.content.get("plan", "")}\n'
                f'遇到的问题：{report.content.get("issues", "")}\n'
                f'总结：{report.content.get("summary", "")}\n\n'
                f'关联任务要求：\n{task_summary}'
            ),
        },
    ]
    result = AIService(current_app.config).chat_completion(
        messages, temperature=0.2, max_tokens=1200
    )
    raw = response_text(result)
    parsed = _parse_json(raw)
    if not isinstance(parsed, dict):
        raise AiRequestFailed('AI 返回了无法解析的分析结果')
    parsed.setdefault('score', 0)
    parsed.setdefault('completion', '')
    parsed.setdefault('risks', [])
    parsed.setdefault('suggestions', [])
    parsed.setdefault('report', '')
    return parsed


# ── 提醒 / 通知 ──

@_tool('list_my_reminders')
def _list_my_reminders(args, member):
    query = Reminder.query.filter_by(member_id=member.id)
    status = args.get('status')
    if status:
        query = query.filter_by(status=status)
    reminders = query.order_by(Reminder.scheduled_at.asc(), Reminder.id.desc()).all()
    return True, [r.to_dict() for r in reminders]


@_tool('create_reminder')
def _create_reminder(args, member):
    title = str(args.get('title') or '').strip()
    if not title:
        return False, '提醒标题不能为空'
    reminder = Reminder(
        member_id=member.id,
        project_id=args.get('project_id'),
        type='custom',
        title=title,
        message=args.get('message'),
        scheduled_at=_parse_date(args.get('scheduled_at')),
        status='pending',
        created_by=member.id,
    )
    db.session.add(reminder)
    db.session.commit()
    return True, reminder.to_dict()


@_tool('complete_reminder')
def _complete_reminder(args, member):
    reminder = Reminder.query.get(args.get('reminder_id'))
    if not reminder or reminder.member_id != member.id:
        return False, '提醒不存在'
    reminder.status = 'done'
    db.session.commit()
    return True, reminder.to_dict()


@_tool('list_my_notifications')
def _list_my_notifications(args, member):
    query = Notification.query.filter_by(member_id=member.id)
    if args.get('unread_only'):
        query = query.filter_by(is_read=False)
    notifications = query.order_by(Notification.created_at.desc()).limit(50).all()
    return True, [n.to_dict() for n in notifications]


@_tool('list_my_certificates')
def _list_my_certificates(args, member):
    certificates = Certificate.query.filter_by(member_id=member.id)\
        .order_by(Certificate.date.desc(), Certificate.id.desc()).all()
    return True, [c.to_dict() for c in certificates]


# ═══════════════════════════════════════════════════════════════
# 需求解析（独立于 chat 的旗舰能力）
# ═══════════════════════════════════════════════════════════════

REQUIREMENT_SYSTEM_PROMPT = (
    '你是星雨作坊实验室的智能项目管理秘书。用户会给你一段模糊的项目需求描述，'
    '你需要把它梳理成可执行的完整项目规划。'
    '只输出一个 JSON 对象，不要输出任何其他文字或 Markdown 代码块标记。\n'
    'JSON 格式如下：\n'
    '{\n'
    '  "project": {\n'
    '    "name": "项目名称",\n'
    '    "description": "项目简介（包含目标、核心功能、验收指标）",\n'
    '    "category": "web | miniapp | ai | tools | game 中的一种",\n'
    '    "startDate": "YYYY-MM-DD 或 null",\n'
    '    "endDate": "YYYY-MM-DD 或 null"\n'
    '  },\n'
    '  "milestones": [\n'
    '    {"name": "里程碑名称", "description": "说明", "dueDate": "YYYY-MM-DD 或 null"}\n'
    '  ],\n'
    '  "tasks": [\n'
    '    {"milestoneIndex": 从0开始的里程碑下标, "title": "任务标题", "description": "说明", '
    '"priority": "low|medium|high|urgent", "dueDate": "YYYY-MM-DD 或 null", "assigneeName": "成员姓名或 null"}\n'
    '  ]\n'
    '}\n'
    '要求：里程碑 2-5 个；每个里程碑下至少 2 个任务；任务总数不超过 20 个；'
    '尽量把模糊表述转化为明确的目标、可量化的指标和约束条件。'
)


def parse_requirement(message, member):
    """将自然语言需求解析为结构化项目规划 JSON。"""
    messages = build_requirement_messages(message, member)
    result = AIService(current_app.config).chat_completion(
        messages,
        temperature=0.3,
        max_tokens=current_app.config.get('ASSISTANT_PARSE_MAX_TOKENS', 4000),
    )
    return parse_requirement_from_text(response_text(result))


def build_requirement_messages(message, member):
    """构建需求解析的对话消息（供流式/非流式共用）。"""
    return [
        {'role': 'system', 'content': REQUIREMENT_SYSTEM_PROMPT},
        {
            'role': 'user',
            'content': f'当前成员：{member.name}。项目需求描述：\n{message}',
        },
    ]


def parse_requirement_from_text(raw_text):
    """将 AI 生成的原始文本解析并规范化为结构化项目规划。"""
    plan = _parse_json(raw_text)
    if not isinstance(plan, dict) or 'project' not in plan:
        raise AiRequestFailed('AI 返回了无法解析的项目规划')
    return _normalize_plan(plan)


def _normalize_plan(plan):
    """规范并校验解析出的项目规划结构。"""
    project = plan.get('project') or {}
    milestones = plan.get('milestones') or []
    tasks = plan.get('tasks') or []
    if not isinstance(milestones, list):
        milestones = []
    if not isinstance(tasks, list):
        tasks = []
    normalized_tasks = []
    for task in tasks:
        if not isinstance(task, dict):
            continue
        milestone_index = task.get('milestoneIndex')
        try:
            milestone_index = int(milestone_index) if milestone_index is not None else None
        except (TypeError, ValueError):
            milestone_index = None
        normalized_tasks.append({
            'milestoneIndex': milestone_index,
            'title': str(task.get('title') or '').strip(),
            'description': str(task.get('description') or '').strip(),
            'priority': task.get('priority') if task.get('priority') in VALID_TASK_PRIORITIES else 'medium',
            'dueDate': task.get('dueDate'),
            'assigneeName': str(task.get('assigneeName') or '').strip() or None,
        })
    normalized_tasks = [t for t in normalized_tasks if t['title']]
    return {
        'project': {
            'name': str(project.get('name') or '').strip(),
            'description': str(project.get('description') or '').strip(),
            'category': project.get('category') if project.get('category') in ('web', 'miniapp', 'ai', 'tools', 'game') else 'web',
            'startDate': project.get('startDate'),
            'endDate': project.get('endDate'),
        },
        'milestones': [
            {
                'name': str(m.get('name') or '').strip(),
                'description': str(m.get('description') or '').strip(),
                'dueDate': m.get('dueDate'),
            }
            for m in milestones if isinstance(m, dict) and str(m.get('name') or '').strip()
        ],
        'tasks': normalized_tasks,
    }


def apply_plan(plan, member):
    """将确认后的项目规划写入数据库，返回创建摘要。"""
    project_data = plan.get('project') or {}
    name = str(project_data.get('name') or '').strip()
    if not name:
        raise ValueError('项目名称不能为空')

    # 生成唯一 slug：优先用名称拼音安全形式，冲突时加短 ID
    slug = _slugify(name) or f'project-{uuid.uuid4().hex[:8]}'
    if Project.query.filter_by(slug=slug).first():
        slug = f'{slug}-{uuid.uuid4().hex[:6]}'

    project = Project(
        slug=slug,
        name=name,
        description=project_data.get('description') or '',
        category=project_data.get('category') or 'web',
        start_date=_parse_date(project_data.get('startDate')),
        end_date=_parse_date(project_data.get('endDate')),
        status='active',
        owner_id=member.id,
    )
    db.session.add(project)
    db.session.flush()

    members_by_name = {m.name: m for m in Member.query.filter_by(status='active').all()}
    milestones = []
    for m in plan.get('milestones') or []:
        milestone = Milestone(
            project_id=project.id,
            name=m['name'],
            description=m.get('description'),
            due_date=_parse_date(m.get('dueDate')),
            status='pending',
            sort_order=len(milestones),
        )
        db.session.add(milestone)
        milestones.append(milestone)
    db.session.flush()

    created_tasks = 0
    notifications = []
    for task in plan.get('tasks') or []:
        milestone_index = task.get('milestoneIndex')
        milestone = None
        if isinstance(milestone_index, int) and 0 <= milestone_index < len(milestones):
            milestone = milestones[milestone_index]
        assignee = None
        assignee_name = task.get('assigneeName')
        if assignee_name:
            assignee = members_by_name.get(assignee_name)
        new_task = Task(
            project_id=project.id,
            milestone_id=milestone.id if milestone else None,
            assignee_id=assignee.id if assignee else None,
            title=task['title'],
            description=task.get('description'),
            status='todo',
            priority=task.get('priority', 'medium'),
            due_date=_parse_date(task.get('dueDate')),
        )
        db.session.add(new_task)
        created_tasks += 1
        if assignee and assignee.id != member.id:
            notifications.append(Notification(
                member_id=assignee.id,
                type='task_assigned',
                title=f'新任务分配：{new_task.title}',
                body=f'项目「{project.name}」已由 AI 规划创建，请查看任务详情。',
                link=f'/member/projects/{project.id}',
                is_read=False,
            ))
    for notification in notifications:
        db.session.add(notification)
    db.session.commit()

    return {
        'project': project.to_dict(),
        'milestoneCount': len(milestones),
        'taskCount': created_tasks,
    }


# ═══════════════════════════════════════════════════════════════
# 辅助函数
# ═══════════════════════════════════════════════════════════════

def _parse_date(value, date_only=False):
    """将 ISO 日期字符串解析为 datetime（date_only 时返回 date）。"""
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace('Z', '+00:00'))
        if date_only:
            return parsed.date()
        return parsed
    except (ValueError, TypeError):
        return None


def _parse_json(text):
    """解析模型输出的 JSON，兼容被 Markdown 代码块包裹的情况。"""
    if not text:
        return None
    text = text.strip()
    # 去掉 ```json ... ``` 包裹
    fence = re.search(r'```(?:json)?\s*(.*?)```', text, re.DOTALL)
    if fence:
        text = fence.group(1).strip()
    try:
        return json.loads(text)
    except ValueError:
        # 兼容首个 { 到最后一个 } 之间是 JSON 的情况
        start = text.find('{')
        end = text.rfind('}')
        if start != -1 and end > start:
            try:
                return json.loads(text[start:end + 1])
            except ValueError:
                return None
        return None


def _slugify(name):
    """生成简单的 ASCII slug（中文名退化为空，由调用方补 UUID）。"""
    slug = re.sub(r'[^a-zA-Z0-9]+', '-', name).strip('-').lower()
    return slug[:60] if slug else ''
