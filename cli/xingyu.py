"""星雨作坊/实验室平台命令行客户端。

用法:
    python -m cli --help
    python -m cli auth login
    python -m cli project list --status active
    python -m cli award export --format csv --output awards.csv

所有命令均调用后端 REST API，与 Web 端共享同一数据库，
任何一端的数据变更都会立即在另一端可见。
"""

import csv
import functools
import io
import json
import sys

import click

from cli import __version__
from cli.client import ApiClient, CliError, CliHttpError
from cli.config import base_url as get_base_url
from cli.config import clear_session, load, save_session
from cli.format import render_table, to_json


if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')


PROJECT_STATUSES = ('planning', 'active', 'completed', 'archived')
TASK_STATUSES = ('todo', 'in_progress', 'review', 'done', 'blocked')
PRIORITIES = ('low', 'medium', 'high', 'urgent')
LEVELS = ('national', 'provincial', 'school', 'other')
GROUP_CHOICES = ('product', 'design', 'dev', 'content')


def catch_errors(func):
    """捕获 CLI/HTTP 错误，输出到 stderr 并以状态码 1 退出。"""
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except CliHttpError as exc:
            hint = '；请先运行 xingyu auth login' if exc.status in (401, 403) else ''
            click.echo(f'错误[{exc.status}]: {exc.message}{hint}', err=True)
            raise click.exceptions.Exit(1)
        except CliError as exc:
            click.echo(f'错误: {exc}', err=True)
            raise click.exceptions.Exit(1)
    return wrapper


@click.group()
@click.option('--base-url', envvar='XINGYU_BASE_URL', help='后端 API 地址（默认读取本地配置）')
@click.option('--json', 'as_json', is_flag=True, help='以 JSON 格式输出')
@click.version_option(version=__version__, prog_name='xingyu')
@click.pass_context
def cli(ctx, base_url, as_json):
    """实验室综合官网及智能项目管理平台 — 命令行接口。"""
    ctx.ensure_object(dict)
    config = load()
    ctx.obj['config'] = config
    ctx.obj['base_url'] = (base_url or get_base_url(config)).rstrip('/')
    ctx.obj['as_json'] = as_json
    ctx.obj['token'] = config.get('token')
    ctx.obj['role'] = config.get('role')
    ctx.obj['name'] = config.get('name')


def _client(ctx, required=True):
    token = ctx.obj.get('token')
    if required and not token:
        raise CliError('尚未登录，请先运行: xingyu auth login')
    return ApiClient(ctx.obj['base_url'], token=token)


def _role(ctx):
    return ctx.obj.get('role') or 'guest'


def _require_role(ctx, role, action):
    current = _role(ctx)
    if current != role:
        raise CliError(f'{action}需要 {role} 权限，当前为 {current} 账号')


def _emit(ctx, payload):
    """JSON 模式下输出原始数据；否则返回数据供表格渲染。"""
    if ctx.obj.get('as_json'):
        click.echo(to_json(payload))
        return None
    return payload


# ═══════════════════════════════════════════════════════════════
# 认证
# ═══════════════════════════════════════════════════════════════

@cli.group()
def auth():
    """登录认证与会话管理。"""


@auth.command('login')
@click.option('--account', prompt='账号（管理员用户名 / 学号 / 邮箱）')
@click.option('--password', prompt='密码', hide_input=True)
@click.pass_context
@catch_errors
def auth_login(ctx, account, password):
    """登录（统一认证，自动识别管理员/成员）。"""
    client = ApiClient(ctx.obj['base_url'])
    data = client.post('/api/auth/login', {
        'account': account,
        'password': password,
    })
    user = data.get('user') or {}
    save_session(ctx.obj['base_url'], data['token'], data['role'], user)
    role_label = '管理员' if data['role'] == 'admin' else '成员'
    name = user.get('name') or user.get('username') or account
    click.echo(f'登录成功：{role_label}「{name}」')
    if ctx.obj.get('as_json'):
        click.echo(to_json(data))


@auth.command('logout')
@catch_errors
def auth_logout():
    """清除本地登录凭证。"""
    clear_session()
    click.echo('已退出登录')


@auth.command('status')
@click.pass_context
def auth_status(ctx):
    """查看当前登录状态。"""
    role = _role(ctx)
    name = ctx.obj.get('name') or '-'
    token = ctx.obj.get('token')
    rows = [
        ['服务器', ctx.obj['base_url']],
        ['角色', {'admin': '管理员', 'member': '成员', 'guest': '未登录'}.get(role, role)],
        ['账号', name],
        ['凭证', '已保存' if token else '未登录'],
    ]
    click.echo(render_table(['项目', '值'], rows))


# ═══════════════════════════════════════════════════════════════
# 平台状态
# ═══════════════════════════════════════════════════════════════

@cli.command('status')
@click.pass_context
@catch_errors
def platform_status(ctx):
    """检查服务健康状态与当前会话。"""
    client = ApiClient(ctx.obj['base_url'])
    health = client.get('/health')
    role = _role(ctx)
    rows = [
        ['服务器', ctx.obj['base_url']],
        ['健康状态', health.get('status', 'unknown')],
        ['消息', health.get('message', '-')],
        ['登录角色', {'admin': '管理员', 'member': '成员', 'guest': '未登录'}.get(role, role)],
        ['登录账号', ctx.obj.get('name') or '-'],
    ]
    click.echo(render_table(['项目', '值'], rows))


# ═══════════════════════════════════════════════════════════════
# 项目管理
# ═══════════════════════════════════════════════════════════════

@cli.group()
def project():
    """项目查询与操作。"""


@project.command('list')
@click.option('--status', type=click.Choice(PROJECT_STATUSES), help='按状态筛选')
@click.pass_context
@catch_errors
def project_list(ctx, status):
    """列出项目（管理员/成员/公开三种视角）。"""
    client = _client(ctx)
    role = _role(ctx)
    params = f'?status={status}' if status else ''
    if role == 'admin':
        data = client.get(f'/api/admin/projects{params}')
    elif role == 'member':
        data = client.get(f'/api/member/projects{params}')
    else:
        data = client.get(f'/api/projects{params}')
    payload = _emit(ctx, data)
    if payload is None:
        return
    rows = [[
        p.get('id'),
        p.get('name'),
        p.get('status'),
        p.get('category'),
        p.get('startDate') or '-',
        p.get('endDate') or '-',
    ] for p in payload]
    click.echo(render_table(['ID', '名称', '状态', '分类', '开始', '结束'], rows))


@project.command('show')
@click.argument('project_ref')
@click.pass_context
@catch_errors
def project_show(ctx, project_ref):
    """查看项目详情（ID 或 slug）。"""
    client = _client(ctx)
    role = _role(ctx)
    if project_ref.isdigit():
        if role == 'admin':
            data = client.get(f'/api/admin/projects/{project_ref}')
        elif role == 'member':
            data = client.get(f'/api/member/projects/{project_ref}')
        else:
            raise CliError('未登录时请使用项目 slug 查询，例如: xingyu project show campus-hub')
    else:
        data = client.get(f'/api/projects/{project_ref}')

    payload = _emit(ctx, data)
    if payload is None:
        return
    p = payload.get('project', payload) if isinstance(payload, dict) else payload
    fields = [
        ['ID', p.get('id')],
        ['名称', p.get('name')],
        ['状态', p.get('status')],
        ['分类', p.get('category')],
        ['开始', p.get('startDate') or '-'],
        ['结束', p.get('endDate') or '-'],
        ['负责人', p.get('ownerName') or '-'],
        ['GitHub', p.get('githubUrl') or '-'],
        ['演示', p.get('demoUrl') or '-'],
        ['描述', p.get('description') or '-'],
    ]
    click.echo(render_table(['字段', '值'], fields))
    milestones = payload.get('milestones') if isinstance(payload, dict) else None
    tasks = payload.get('tasks') if isinstance(payload, dict) else None
    if milestones is not None:
        click.echo('')
        click.echo(render_table(
            ['里程碑 ID', '名称', '状态', '截止'],
            [[m.get('id'), m.get('name'), m.get('status'), m.get('dueDate') or '-'] for m in milestones],
        ))
    if tasks is not None:
        click.echo('')
        click.echo(render_table(
            ['任务 ID', '标题', '状态', '优先级', '负责人', '截止'],
            [[
                t.get('id'),
                t.get('title'),
                t.get('status'),
                t.get('priority'),
                t.get('assigneeName') or '-',
                t.get('dueDate') or '-',
            ] for t in tasks],
        ))


@project.command('create')
@click.option('--name', required=True, help='项目名称')
@click.option('--description', help='项目描述')
@click.option('--category', type=click.Choice(('web', 'miniapp', 'ai', 'tools', 'game')))
@click.option('--status', type=click.Choice(PROJECT_STATUSES), default='active')
@click.option('--start-date', help='开始日期 YYYY-MM-DD')
@click.option('--end-date', help='结束日期 YYYY-MM-DD')
@click.option('--owner-id', type=int, help='负责人成员 ID')
@click.pass_context
@catch_errors
def project_create(ctx, name, description, category, status, start_date, end_date, owner_id):
    """创建项目（管理员）。"""
    _require_role(ctx, 'admin', '创建项目')
    client = _client(ctx)
    payload = {
        'name': name,
        'description': description,
        'category': category,
        'status': status,
        'startDate': start_date,
        'endDate': end_date,
        'ownerId': owner_id,
    }
    data = client.post('/api/admin/projects', {k: v for k, v in payload.items() if v is not None})
    _emit(ctx, data)
    project_data = data['project']
    click.echo(f'已创建项目 #{project_data["id"]}「{project_data["name"]}」')


@project.command('update')
@click.argument('project_id', type=int)
@click.option('--name')
@click.option('--description')
@click.option('--category', type=click.Choice(('web', 'miniapp', 'ai', 'tools', 'game')))
@click.option('--status', type=click.Choice(PROJECT_STATUSES))
@click.option('--start-date')
@click.option('--end-date')
@click.pass_context
@catch_errors
def project_update(ctx, project_id, name, description, category, status, start_date, end_date):
    """更新项目信息（管理员，仅更新传入的字段）。"""
    _require_role(ctx, 'admin', '更新项目')
    client = _client(ctx)
    payload = {
        'name': name,
        'description': description,
        'category': category,
        'status': status,
        'startDate': start_date,
        'endDate': end_date,
    }
    data = client.put(
        f'/api/admin/projects/{project_id}',
        {k: v for k, v in payload.items() if v is not None},
    )
    _emit(ctx, data)
    project_data = data['project']
    click.echo(f'已更新项目 #{project_data["id"]}「{project_data["name"]}」')


# ═══════════════════════════════════════════════════════════════
# 任务管理
# ═══════════════════════════════════════════════════════════════

@cli.group()
def task():
    """任务查询与操作。"""


@task.command('list')
@click.option('--project', 'project_id', type=int, help='按项目筛选')
@click.option('--status', type=click.Choice(TASK_STATUSES), help='按状态筛选')
@click.option('--mine', is_flag=True, help='仅列出分配给自己的任务（成员）')
@click.pass_context
@catch_errors
def task_list(ctx, project_id, status, mine):
    """列出任务（成员查看自己的任务；管理员按项目查看）。"""
    client = _client(ctx)
    role = _role(ctx)
    params = []
    if status:
        params.append(f'status={status}')
    if project_id:
        params.append(f'projectId={project_id}')
    query = ('?' + '&'.join(params)) if params else ''
    if role == 'member' or mine:
        path = f'/api/member/tasks{query}'
    elif role == 'admin':
        if not project_id:
            raise CliError('管理员请使用 --project <ID> 指定项目')
        path = f'/api/admin/projects/{project_id}/tasks{query}'
    else:
        raise CliError('请先登录后再查询任务')
    data = client.get(path)
    payload = _emit(ctx, data)
    if payload is None:
        return
    rows = [[
        t.get('id'),
        t.get('projectName') or t.get('project_id'),
        t.get('title'),
        t.get('status'),
        t.get('priority'),
        t.get('assigneeName') or '-',
        t.get('dueDate') or '-',
    ] for t in payload]
    click.echo(render_table(['ID', '项目', '标题', '状态', '优先级', '负责人', '截止'], rows))


@task.command('create')
@click.option('--project', 'project_id', type=int, required=True, help='项目 ID')
@click.option('--title', required=True, help='任务标题')
@click.option('--description')
@click.option('--assignee-id', type=int, help='负责人成员 ID')
@click.option('--milestone-id', type=int, help='里程碑 ID')
@click.option('--priority', type=click.Choice(PRIORITIES), default='medium')
@click.option('--due-date', help='截止日期 YYYY-MM-DD')
@click.option('--status', type=click.Choice(TASK_STATUSES), default='todo')
@click.pass_context
@catch_errors
def task_create(ctx, project_id, title, description, assignee_id, milestone_id, priority, due_date, status):
    """创建任务（管理员或成员）。"""
    client = _client(ctx)
    role = _role(ctx)
    payload = {
        'title': title,
        'description': description,
        'assigneeId': assignee_id,
        'milestoneId': milestone_id,
        'priority': priority,
        'dueDate': due_date,
        'status': status,
    }
    if role == 'admin':
        path = f'/api/admin/projects/{project_id}/tasks'
    elif role == 'member':
        path = f'/api/member/projects/{project_id}/tasks'
    else:
        raise CliError('请先登录后再创建任务')
    data = client.post(path, {k: v for k, v in payload.items() if v is not None})
    _emit(ctx, data)
    task_data = data['task']
    click.echo(f'已创建任务 #{task_data["id"]}「{task_data["title"]}」')


@task.command('update')
@click.argument('task_id', type=int)
@click.option('--title')
@click.option('--description')
@click.option('--status', type=click.Choice(TASK_STATUSES))
@click.option('--priority', type=click.Choice(PRIORITIES))
@click.option('--assignee-id', type=int)
@click.option('--milestone-id', type=int)
@click.option('--due-date')
@click.option('--sort-order', type=int)
@click.pass_context
@catch_errors
def task_update(ctx, task_id, title, description, status, priority, assignee_id, milestone_id, due_date, sort_order):
    """更新任务（仅更新传入的字段）。"""
    client = _client(ctx)
    role = _role(ctx)
    payload = {
        'title': title,
        'description': description,
        'status': status,
        'priority': priority,
        'assigneeId': assignee_id,
        'milestoneId': milestone_id,
        'dueDate': due_date,
        'sortOrder': sort_order,
    }
    path = f'/api/admin/tasks/{task_id}' if role == 'admin' else f'/api/member/tasks/{task_id}'
    if role not in ('admin', 'member'):
        raise CliError('请先登录后再更新任务')
    data = client.put(path, {k: v for k, v in payload.items() if v is not None})
    _emit(ctx, data)
    task_data = data['task']
    click.echo(f'已更新任务 #{task_data["id"]}「{task_data["title"]}」')


@task.command('status')
@click.argument('task_id', type=int)
@click.option('--status', required=True, type=click.Choice(TASK_STATUSES), help='新状态')
@click.pass_context
@catch_errors
def task_status(ctx, task_id, status):
    """快速变更任务状态（看板流转）。"""
    client = _client(ctx)
    role = _role(ctx)
    if role == 'admin':
        path = f'/api/admin/tasks/{task_id}/status'
    elif role == 'member':
        path = f'/api/member/tasks/{task_id}/status'
    else:
        raise CliError('请先登录后再更新任务')
    data = client.put(path, {'status': status})
    _emit(ctx, data)
    task_data = data['task']
    click.echo(f'任务 #{task_data["id"]} 状态已更新为 {task_data["status"]}')


# ═══════════════════════════════════════════════════════════════
# 周报
# ═══════════════════════════════════════════════════════════════

@cli.group()
def report():
    """周报提交、分析、审阅。"""


@report.command('list')
@click.option('--status', type=click.Choice(('draft', 'submitted', 'reviewed')), help='按状态筛选')
@click.pass_context
@catch_errors
def report_list(ctx, status):
    """列出周报（成员看自己的，管理员看全部）。"""
    client = _client(ctx)
    role = _role(ctx)
    params = f'?status={status}' if status else ''
    if role == 'admin':
        data = client.get(f'/api/admin/weekly-reports{params}')
    elif role == 'member':
        data = client.get(f'/api/member/weekly-reports{params}')
    else:
        raise CliError('请先登录后再查看周报')
    payload = _emit(ctx, data)
    if payload is None:
        return
    rows = [[
        r.get('id'),
        r.get('memberName') or '-',
        r.get('projectName') or '-',
        r.get('weekStart') or '-',
        r.get('status'),
        r.get('completionRate'),
        (r.get('content') or {}).get('done') or '-',
    ] for r in payload]
    click.echo(render_table(['ID', '成员', '项目', '周开始', '状态', '完成度', '本周完成'], rows))


@report.command('show')
@click.argument('report_id', type=int)
@click.pass_context
@catch_errors
def report_show(ctx, report_id):
    """查看周报详情（含 AI 分析结果）。"""
    client = _client(ctx)
    role = _role(ctx)
    if role == 'admin':
        data = client.get(f'/api/admin/weekly-reports/{report_id}')
    elif role == 'member':
        data = client.get(f'/api/member/weekly-reports/{report_id}')
    else:
        raise CliError('请先登录后再查看周报')
    payload = _emit(ctx, data)
    if payload is None:
        return
    content = payload.get('content') or {}
    rows = [
        ['ID', payload.get('id')],
        ['成员', payload.get('memberName') or '-'],
        ['项目', payload.get('projectName') or '-'],
        ['周开始', payload.get('weekStart') or '-'],
        ['周结束', payload.get('weekEnd') or '-'],
        ['状态', payload.get('status')],
        ['完成度', payload.get('completionRate')],
        ['本周完成', content.get('done') or '-'],
        ['下周计划', content.get('plan') or '-'],
        ['问题风险', content.get('issues') or '-'],
        ['总结', content.get('summary') or '-'],
        ['审阅批注', payload.get('reviewNote') or '-'],
    ]
    click.echo(render_table(['字段', '值'], rows))
    analysis = payload.get('aiAnalysis')
    if analysis:
        click.echo('')
        click.echo('AI 分析：')
        click.echo(to_json(analysis))


@report.command('submit')
@click.option('--done', required=True, help='本周完成的工作')
@click.option('--plan', help='下周计划')
@click.option('--issues', help='遇到的问题/风险')
@click.option('--week-start', help='周开始日期 YYYY-MM-DD')
@click.option('--week-end', help='周结束日期 YYYY-MM-DD')
@click.option('--project-id', type=int, help='关联项目 ID')
@click.option('--summary', help='本周总结')
@click.option('--draft', is_flag=True, help='仅保存草稿，不提交')
@click.pass_context
@catch_errors
def report_submit(ctx, done, plan, issues, week_start, week_end, project_id, summary, draft):
    """创建并提交周报（成员）。"""
    _require_role(ctx, 'member', '提交周报')
    client = _client(ctx)
    data = client.post('/api/member/weekly-reports', {
        'done': done,
        'plan': plan or '',
        'issues': issues or '',
        'weekStart': week_start,
        'weekEnd': week_end,
        'projectId': project_id,
        'summary': summary,
    })
    report_id = data['report']['id']
    if not draft:
        data = client.post(f'/api/member/weekly-reports/{report_id}/submit')
    _emit(ctx, data)
    state = '草稿' if draft else '已提交'
    click.echo(f'周报 #{report_id} 已保存为{state}')


@report.command('analyze')
@click.argument('report_id', type=int)
@click.pass_context
@catch_errors
def report_analyze(ctx, report_id):
    """对周报执行 AI 分析（成员自己的或管理员任意周报）。"""
    client = _client(ctx)
    role = _role(ctx)
    if role == 'admin':
        data = client.post(f'/api/admin/weekly-reports/{report_id}/analyze')
    elif role == 'member':
        data = client.post(f'/api/member/weekly-reports/{report_id}/analyze')
    else:
        raise CliError('请先登录后再分析周报')
    _emit(ctx, data)
    report_data = data['report']
    click.echo(f'周报 #{report_id} 分析完成，完成度 {report_data.get("completionRate")}')
    if not ctx.obj.get('as_json') and report_data.get('aiAnalysis'):
        click.echo(to_json(report_data['aiAnalysis']))


@report.command('review')
@click.argument('report_id', type=int)
@click.option('--note', help='审阅批注')
@click.option('--completion-rate', type=float, help='人工完成度 0-100')
@click.pass_context
@catch_errors
def report_review(ctx, report_id, note, completion_rate):
    """审阅周报（管理员）。"""
    _require_role(ctx, 'admin', '审阅周报')
    client = _client(ctx)
    payload = {'reviewNote': note}
    if completion_rate is not None:
        payload['completionRate'] = completion_rate
    data = client.post(f'/api/admin/weekly-reports/{report_id}/review', payload)
    _emit(ctx, data)
    click.echo(f'周报 #{report_id} 已审阅')


# ═══════════════════════════════════════════════════════════════
# 成果/奖项
# ═══════════════════════════════════════════════════════════════

@cli.group()
def award():
    """成果/奖项查询与导出。"""


@award.command('list')
@click.option('--level', type=click.Choice(LEVELS), help='按等级筛选')
@click.pass_context
@catch_errors
def award_list(ctx, level):
    """列出成果奖项。"""
    client = _client(ctx, required=False)
    params = f'?level={level}' if level else ''
    data = client.get(f'/api/awards{params}')
    payload = _emit(ctx, data)
    if payload is None:
        return
    rows = [[
        a.get('id'),
        a.get('name'),
        a.get('level'),
        a.get('winner'),
        a.get('issuer') or '-',
        a.get('date') or '-',
    ] for a in payload]
    click.echo(render_table(['ID', '名称', '等级', '获奖人', '颁发机构', '时间'], rows))


@award.command('export')
@click.option('--format', 'fmt', type=click.Choice(('json', 'csv')), default='json', help='输出格式')
@click.option('--output', type=click.Path(dir_okay=False, writable=True), help='输出文件；缺省输出到 stdout')
@click.option('--level', type=click.Choice(LEVELS), help='按等级筛选')
@click.pass_context
@catch_errors
def award_export(ctx, fmt, output, level):
    """导出成果数据（JSON/CSV）。"""
    client = _client(ctx, required=False)
    params = f'?level={level}' if level else ''
    awards = client.get(f'/api/awards{params}')
    if ctx.obj.get('as_json') and fmt == 'json':
        click.echo(to_json(awards))
        return
    if fmt == 'json':
        text = to_json(awards)
        if output:
            _write_text(output, text)
            click.echo(f'已导出 {len(awards)} 条成果到 {output}')
        else:
            click.echo(text)
        return

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(['id', 'slug', 'name', 'level', 'category', 'winner', 'issuer', 'date', 'description', 'relatedProject', 'certificateImages'])
    for award in awards:
        writer.writerow([
            award.get('id'),
            award.get('slug'),
            award.get('name'),
            award.get('level'),
            award.get('category'),
            award.get('winner'),
            award.get('issuer'),
            award.get('date'),
            award.get('description'),
            award.get('relatedProject'),
            '|'.join(award.get('certificateImages') or []),
        ])
    if output:
        with open(output, 'w', newline='', encoding='utf-8-sig') as file:
            file.write(buffer.getvalue())
        click.echo(f'已导出 {len(awards)} 条成果到 {output}')
    else:
        click.echo(buffer.getvalue(), nl=False)


# ═══════════════════════════════════════════════════════════════
# 成员目录
# ═══════════════════════════════════════════════════════════════

@cli.group()
def member():
    """成员目录查询。"""


@member.command('list')
@click.option('--group', type=click.Choice(GROUP_CHOICES), help='按分组筛选')
@click.option('--search', help='按姓名/角色/技能搜索')
@click.pass_context
@catch_errors
def member_list(ctx, group, search):
    """列出成员（管理员含完整信息，成员含联系方式，公开为展示信息）。"""
    client = _client(ctx, required=False)
    role = _role(ctx)
    params = []
    if group:
        params.append(f'group={group}')
    if search:
        params.append(f'search={search}')
    query = ('?' + '&'.join(params)) if params else ''
    if role == 'admin':
        data = client.get(f'/api/admin/members{query}')
    elif role == 'member':
        data = client.get(f'/api/member/directory{query}')
    else:
        data = client.get(f'/api/members{query}')
    payload = _emit(ctx, data)
    if payload is None:
        return
    rows = [[
        m.get('id'),
        m.get('name'),
        m.get('role') or '-',
        m.get('group') or '-',
        m.get('grade') or '-',
        m.get('email') or '-',
        m.get('status') or '',
    ] for m in payload]
    headers = ['ID', '姓名', '角色', '分组', '年级', '邮箱', '状态']
    click.echo(render_table(headers, rows))


# ═══════════════════════════════════════════════════════════════
# 站点配置
# ═══════════════════════════════════════════════════════════════

@cli.group()
def config():
    """站点配置读写（管理员）。"""


@config.command('get')
@click.argument('key', required=False)
@click.pass_context
@catch_errors
def config_get(ctx, key):
    """查看站点配置；指定 key 时只查看该配置项。"""
    _require_role(ctx, 'admin', '读取站点配置')
    client = _client(ctx)
    data = client.get('/api/admin/config')
    if key:
        data = {key: data.get(key)}
    payload = _emit(ctx, data)
    if payload is None:
        return
    rows = [[k, v if isinstance(v, str) else to_json(v)] for k, v in payload.items()]
    click.echo(render_table(['配置项', '值'], rows))


@config.command('set')
@click.argument('key')
@click.argument('value')
@click.pass_context
@catch_errors
def config_set(ctx, key, value):
    """设置单个配置项；value 为合法 JSON 时按 JSON 解析，否则按字符串。"""
    _require_role(ctx, 'admin', '修改站点配置')
    client = _client(ctx)
    try:
        parsed = json.loads(value)
    except ValueError:
        parsed = value
    data = client.put(f'/api/admin/config/{key}', {'value': parsed})
    _emit(ctx, data)
    click.echo(f'已更新配置项 {key}')


# ═══════════════════════════════════════════════════════════════
# 提醒
# ═══════════════════════════════════════════════════════════════

@cli.group()
def reminder():
    """任务/周报/自定义提醒。"""


@reminder.command('list')
@click.option('--status', type=click.Choice(('pending', 'sent', 'done', 'cancelled')), help='按状态筛选')
@click.pass_context
@catch_errors
def reminder_list(ctx, status):
    """列出提醒（成员看自己的，管理员看全部）。"""
    client = _client(ctx)
    role = _role(ctx)
    params = f'?status={status}' if status else ''
    if role == 'admin':
        data = client.get(f'/api/admin/reminders{params}')
    elif role == 'member':
        data = client.get(f'/api/member/reminders{params}')
    else:
        raise CliError('请先登录后再查看提醒')
    payload = _emit(ctx, data)
    if payload is None:
        return
    rows = [[
        r.get('id'),
        r.get('memberName') or '-',
        r.get('type'),
        r.get('title'),
        r.get('scheduledAt') or '-',
        r.get('status'),
    ] for r in payload]
    click.echo(render_table(['ID', '成员', '类型', '标题', '计划时间', '状态'], rows))


@reminder.command('create')
@click.option('--title', required=True, help='提醒标题')
@click.option('--message', help='提醒内容')
@click.option('--scheduled-at', help='触发时间 ISO 格式，如 2026-08-10T09:00:00+08:00')
@click.option('--project-id', type=int, help='关联项目 ID')
@click.option('--member-id', type=int, help='提醒对象成员 ID（管理员可指定）')
@click.option('--type', 'reminder_type', type=click.Choice(('task_due', 'report_submit', 'review', 'custom')), default='custom')
@click.pass_context
@catch_errors
def reminder_create(ctx, title, message, scheduled_at, project_id, member_id, reminder_type):
    """创建提醒（成员为自己，管理员可为任意成员）。"""
    client = _client(ctx)
    role = _role(ctx)
    payload = {
        'title': title,
        'message': message,
        'scheduledAt': scheduled_at,
        'projectId': project_id,
        'type': reminder_type,
    }
    if role == 'admin':
        if member_id:
            payload['memberId'] = member_id
        data = client.post('/api/admin/reminders', {k: v for k, v in payload.items() if v is not None})
    elif role == 'member':
        data = client.post('/api/member/reminders', {k: v for k, v in payload.items() if v is not None})
    else:
        raise CliError('请先登录后再创建提醒')
    _emit(ctx, data)
    reminder_data = data.get('reminder', {})
    click.echo(f'已创建提醒 #{reminder_data.get("id")}「{reminder_data.get("title")}」')


@reminder.command('complete')
@click.argument('reminder_id', type=int)
@click.pass_context
@catch_errors
def reminder_complete(ctx, reminder_id):
    """把提醒标记为已完成（成员）。"""
    _require_role(ctx, 'member', '完成提醒')
    client = _client(ctx)
    data = client.post(f'/api/member/reminders/{reminder_id}/complete')
    _emit(ctx, data)
    click.echo(f'提醒 #{reminder_id} 已完成')


# ═══════════════════════════════════════════════════════════════
# 通知
# ═══════════════════════════════════════════════════════════════

@cli.group()
def notify():
    """站内通知查询（成员）。"""


@notify.command('list')
@click.option('--unread', is_flag=True, help='仅列出未读通知')
@click.pass_context
@catch_errors
def notify_list(ctx, unread):
    """列出当前成员的站内通知。"""
    _require_role(ctx, 'member', '查看通知')
    client = _client(ctx)
    data = client.get(f'/api/member/notifications?unread={"true" if unread else "false"}')
    payload = _emit(ctx, data)
    if payload is None:
        return
    rows = [[
        n.get('id'),
        n.get('type'),
        n.get('title'),
        n.get('body') or '-',
        '已读' if n.get('isRead') else '未读',
        n.get('created_at') or '-',
    ] for n in payload]
    click.echo(render_table(['ID', '类型', '标题', '内容', '状态', '时间'], rows))


def _write_text(path, text):
    with open(path, 'w', encoding='utf-8') as file:
        file.write(text)


if __name__ == '__main__':
    cli()
