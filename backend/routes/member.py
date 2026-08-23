"""星雨作坊 CMS — 成员门户 API 路由

本模块包含所有需要成员 JWT 认证的成员门户端点，全部挂载在 /api/member/* 下。

认证机制:
  - 所有端点（除 login）均需在 Authorization 头携带 Bearer token
  - Token 通过 POST /api/auth/login（统一登录）或 POST /api/member/login 获取
  - 成员 JWT identity 格式: "member:<id>"（与管理员 token 的纯数字 identity 互斥）
  - _member_or_403() 辅助函数统一校验成员身份

端点分类:
  - 认证          POST   /api/member/login                 — 成员登录
  - 个人中心      GET    /api/member/me                    — 获取当前成员信息
                  PUT    /api/member/me                    — 更新个人信息
                  PUT    /api/member/me/password           — 修改密码
  - 成员目录      GET    /api/member/directory             — 内部成员目录（含隐私信息）
  - 仪表盘        GET    /api/member/dashboard/stats       — 仪表盘统计数据
  - 项目管理      GET    /api/member/projects              — 项目列表
                  GET    /api/member/projects/<id>         — 项目详情（含看板数据）
                  POST   /api/member/projects/<id>/tasks   — 创建任务
  - 任务管理      GET    /api/member/tasks                 — 个人任务列表
                  PUT    /api/member/tasks/<id>            — 更新任务
                  PUT    /api/member/tasks/<id>/status     — 快速状态变更（看板拖拽）
  - 资源中心      GET    /api/member/resources/folders     — 文件夹列表
                  POST   /api/member/resources/folders     — 创建文件夹
                  GET    /api/member/resources/files       — 文件列表
                  POST   /api/member/resources/upload      — 上传文件
                  PUT    /api/member/resources/<id>        — 重命名/移动文件
                  DELETE /api/member/resources/<id>        — 软删除文件
  - 证书管理      GET    /api/member/certificates          — 证书列表
                  POST   /api/member/certificates          — 提交证书
                  PUT    /api/member/certificates/<id>     — 更新证书
                  DELETE /api/member/certificates/<id>     — 删除证书
                  POST   /api/member/certificates/upload   — 上传证书图片
                  POST   /api/member/certificates/ocr      — 对图片执行 AI 识别并返回结构化字段
                  POST   /api/member/certificates/<id>/ocr — 对已保存证书重新识别并持久化结果
  - 通知中心      GET    /api/member/notifications         — 通知列表
                  GET    /api/member/notifications/unread-count — 未读数
                  PUT    /api/member/notifications/<id>/read   — 标记已读
                  PUT    /api/member/notifications/read-all    — 全部已读
"""

import uuid
from datetime import datetime, timezone
from flask import Blueprint, jsonify, request, abort, current_app
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity

from models import (
    db,
    Member,
    Project,
    Milestone,
    Task,
    ResourceFolder,
    ResourceFile,
    Certificate,
    Notification,
    BlogPost,
    BlogRead,
    WeeklyReport,
    Reminder,
)
from services.ocr_service import OcrNotConfigured, OcrRequestFailed, OcrService
from services.ai_service import AiNotConfigured, AiRequestFailed
from services.assistant_tools import _analyze_report_with_ai
from services.reminder_service import send_reminder_notification
from services.notification_service import notify_all_admins
from services.weekly_report_template import validate_weekly_report_content
from services.storage_service import (
    StorageImageInvalid,
    StorageNotConfigured,
    StorageReadFailed,
    StorageWriteFailed,
    StorageService,
)
from services.security_service import (
    UploadContentInvalid,
    is_rate_limited,
    record_rate_limit_failure,
    validate_upload_content,
)

member_bp = Blueprint('member', __name__)

# ═══════════════════════════════════════════════════════════════
# 认证辅助函数
# ═══════════════════════════════════════════════════════════════

# 成员 JWT identity 前缀，用于区分成员 token 和管理员 token
MEMBER_ID_PREFIX = 'member:'


def _member_identity(member_id: int) -> str:
    """将成员 ID 编码为 JWT identity 字符串。

    格式: "member:<id>"
    此格式确保成员 token 不会被误认为管理员 token（后者为纯数字字符串）。

    Args:
        member_id: 成员数据库 ID

    Returns:
        str: JWT identity 字符串（如 "member:1"）
    """
    return f'{MEMBER_ID_PREFIX}{member_id}'


def _parse_member_id(identity: str):
    """从 JWT identity 字符串中提取成员 ID。

    仅处理以 "member:" 开头的 identity，其他格式返回 None。

    Args:
        identity: JWT token 的 identity 字符串

    Returns:
        int | None: 成员 ID，格式不匹配或解析失败返回 None
    """
    if not identity or not identity.startswith(MEMBER_ID_PREFIX):
        return None
    try:
        return int(identity[len(MEMBER_ID_PREFIX):])
    except (ValueError, TypeError):
        return None


def _member_required():
    """从 JWT token 中解析成员身份。

    先提取 identity，解析成员 ID，再查询数据库验证成员存在。

    Returns:
        Member | None: 认证成功返回成员对象，失败返回 None
    """
    identity = get_jwt_identity()
    member_id = _parse_member_id(identity)
    if not member_id:
        return None
    return Member.query.get(member_id)


def _member_or_403():
    """强制要求成员身份，否则返回 403。

    这是所有成员端点的权限守卫函数。
    必须在 @jwt_required() 装饰器之后调用。

    Returns:
        Member: 已认证的成员对象

    Raises:
        403: 当前用户不是有效成员
    """
    member = _member_required()
    if not member:
        abort(403)
    return member


# ═══════════════════════════════════════════════════════════════
# 认证端点
# ═══════════════════════════════════════════════════════════════

@member_bp.route('/member/login', methods=['POST'])
def member_login():
    """成员专用登录接口（与 /api/auth/login 统一登录功能相同）。

    支持通过学号或邮箱 + 密码登录。
    登录成功后更新 last_login_at 时间戳。

    注意：此端点与 /api/auth/login 中的成员登录逻辑重复，
    保留以支持仅需要成员登录的场景。推荐前端使用 /api/auth/login 统一登录。

    Request Body:
        {"account": "2022001 或 email@example.com", "password": "..."}

    Returns:
        200: {"success": true, "token": "...", "member": {...}}
        400: 缺少账号或密码
        401: 账号或密码错误
        403: 账号被停用
    """
    data = request.get_json()
    if not data or not data.get('account') or not data.get('password'):
        return jsonify({
            'error': 'bad_request',
            'message': '请输入学号/邮箱和密码',
        }), 400

    account = data['account'].strip()
    password = data['password']
    rate_key = f"{request.remote_addr or 'unknown'}:{account}"
    limit = current_app.config.get('LOGIN_RATE_LIMIT_PER_MINUTE', 10)
    if is_rate_limited('member-login', rate_key, limit):
        return jsonify({
            'error': 'rate_limited',
            'message': '登录失败次数过多，请稍后再试',
        }), 429

    # 按学号或邮箱查找成员
    member = Member.query.filter(
        db.or_(Member.student_id == account, Member.email == account)
    ).first()

    # 用户不存在或未设置密码
    if not member or not member.password_hash:
        record_rate_limit_failure('member-login', rate_key)
        return jsonify({
            'error': 'auth_failed',
            'message': '账号或密码错误',
        }), 401

    # 验证密码
    if not member.check_password(password):
        record_rate_limit_failure('member-login', rate_key)
        return jsonify({
            'error': 'auth_failed',
            'message': '账号或密码错误',
        }), 401

    # 检查账号状态
    if member.status != 'active':
        return jsonify({
            'error': 'account_disabled',
            'message': '账号已被停用，请联系管理员',
        }), 403

    # 更新最后登录时间
    member.last_login_at = datetime.now(timezone.utc)
    db.session.commit()

    # 生成成员 JWT token
    token = create_access_token(identity=_member_identity(member.id))

    return jsonify({
        'success': True,
        'token': token,
        'member': member.to_member_dict(),
    })


# ═══════════════════════════════════════════════════════════════
# 个人中心
# ═══════════════════════════════════════════════════════════════

@member_bp.route('/member/me', methods=['GET'])
@jwt_required()
def member_me():
    """获取当前登录成员的个人信息。

    用于前端初始化时验证 token 有效性和获取成员资料。

    Returns:
        JSON: 成员个人信息（to_member_dict 格式，含隐私字段，不含管理字段）
        403: token 无效或非成员身份
    """
    member = _member_or_403()
    return jsonify(member.to_member_dict())


@member_bp.route('/member/me', methods=['PUT'])
@jwt_required()
def member_update_me():
    """更新当前成员的个人信息。

    仅允许更新安全字段，不可修改 status、sort_order 等管理字段。
    这些管理字段只能由管理员通过 /api/admin/members/<id> 修改。

    可更新字段:
      - name, avatar, phone, bio, github, blog, grade
      - skills (JSON 数组)
      - notificationPrefs (JSON 对象)

    Returns:
        JSON: {"success": true, "member": {...}}
        400: 请求体为空
    """
    member = _member_or_403()
    data = request.get_json()
    if not data:
        return jsonify({'error': 'bad_request', 'message': '请求体为空'}), 400

    # 成员允许自行更新的字段（白名单）
    updatable = ['name', 'avatar', 'phone', 'bio', 'github', 'blog', 'grade']
    for field in updatable:
        if field in data:
            setattr(member, field, data[field])

    # JSON 类型字段
    if 'skills' in data:
        member.skills = data['skills']
    if 'notificationPrefs' in data:
        member.notification_prefs = data['notificationPrefs']

    db.session.commit()

    return jsonify({
        'success': True,
        'member': member.to_member_dict(),
    })


@member_bp.route('/member/me/password', methods=['PUT'])
@jwt_required()
def member_change_password():
    """修改当前成员的登录密码。

    需要提供当前密码（用于身份验证）和新密码。
    新密码最少 6 个字符。

    Request Body:
        {"currentPassword": "oldpass", "newPassword": "newpass"}

    Returns:
        JSON: {"success": true, "message": "密码已更新"}
        400: 缺少参数或新密码不足 6 个字符
        401: 当前密码错误
    """
    member = _member_or_403()
    data = request.get_json()

    if not data or not data.get('currentPassword') or not data.get('newPassword'):
        return jsonify({
            'error': 'bad_request',
            'message': '请输入当前密码和新密码',
        }), 400

    # 验证当前密码
    if not member.check_password(data['currentPassword']):
        return jsonify({
            'error': 'auth_failed',
            'message': '当前密码错误',
        }), 401

    # 新密码长度校验
    if len(data['newPassword']) < 6:
        return jsonify({
            'error': 'validation_error',
            'message': '新密码至少需要6个字符',
        }), 400

    member.set_password(data['newPassword'])
    db.session.commit()

    return jsonify({'success': True, 'message': '密码已更新'})


# ═══════════════════════════════════════════════════════════════
# 成员目录（内部 — 比公开 /api/members 信息更丰富）
# ═══════════════════════════════════════════════════════════════

@member_bp.route('/member/directory', methods=['GET'])
@jwt_required()
def member_directory():
    """获取活跃成员完整内部目录。

    与公开接口 /api/members 的区别：
      - 返回完整成员信息（含邮箱、手机号等隐私字段）
      - 仅限已登录成员查看
      - 用于团队内部协作和联系

    可选筛选:
        group:  按分组筛选
        search: 按姓名、角色、简介、技能搜索

    Returns:
        JSON: 成员完整信息列表
    """
    _member_or_403()

    group = request.args.get('group')
    search = request.args.get('search')

    query = Member.query.filter_by(status='active')

    if group:
        query = query.filter_by(group=group)
    if search:
        query = query.filter(
            db.or_(
                Member.name.contains(search),
                Member.role.contains(search),
                Member.bio.contains(search),
                Member.skills.contains(search),  # JSON 数组字段的简单文本匹配
            )
        )

    members = query.order_by(Member.sort_order, Member.id).all()
    return jsonify([m.to_dict() for m in members])


# ═══════════════════════════════════════════════════════════════
# 仪表盘统计
# ═══════════════════════════════════════════════════════════════

@member_bp.route('/member/dashboard/stats', methods=['GET'])
@jwt_required()
def member_dashboard_stats():
    """获取成员门户仪表盘的聚合统计数据。

    返回:
      - totalMembers:  活跃成员总数
      - totalProjects: 所有项目总数
      - activeProjects: 进行中项目数
      - totalTasks:    所有任务总数
      - doneTasks:     已完成任务数

    Returns:
        JSON: 统计数据对象
    """
    _member_or_403()

    total_members = Member.query.filter_by(status='active').count()
    total_projects = Project.query.count()
    active_projects = Project.query.filter_by(status='active').count()
    total_tasks = Task.query.count()
    done_tasks = Task.query.filter_by(status='done').count()

    return jsonify({
        'totalMembers': total_members,
        'totalProjects': total_projects,
        'activeProjects': active_projects,
        'totalTasks': total_tasks,
        'doneTasks': done_tasks,
    })


# ═══════════════════════════════════════════════════════════════
# 项目管理（成员视角）
# ═══════════════════════════════════════════════════════════════

@member_bp.route('/member/projects', methods=['GET'])
@jwt_required()
def member_list_projects():
    """获取所有项目列表（成员视角，含内部管理字段）。

    可选筛选: category, status, search
    默认按开始日期降序排列。

    Returns:
        JSON: 项目完整信息列表
    """
    _member_or_403()

    category = request.args.get('category')
    status = request.args.get('status')
    search = request.args.get('search')

    query = Project.query
    if category:
        query = query.filter_by(category=category)
    if status:
        query = query.filter_by(status=status)
    if search:
        query = query.filter(
            db.or_(
                Project.name.contains(search),
                Project.description.contains(search),
            )
        )

    projects = query.order_by(Project.start_date.desc(), Project.id).all()
    return jsonify([p.to_dict() for p in projects])


@member_bp.route('/member/projects/<int:project_id>', methods=['GET'])
@jwt_required()
def member_get_project(project_id):
    """获取单个项目完整详情（含看板数据）。

    返回项目基本信息 + 所有里程碑 + 所有任务，
    前端可用此数据渲染完整的项目看板页面。

    Args:
        project_id: 项目 ID

    Returns:
        JSON: {"project": {...}, "milestones": [...], "tasks": [...]}
              或 404: 项目不存在
    """
    _member_or_403()

    project = Project.query.get(project_id)
    if not project:
        return jsonify({'error': 'not_found', 'message': '项目不存在'}), 404

    # 一并加载里程碑和任务，减少前端请求次数
    milestones = Milestone.query.filter_by(project_id=project_id)\
        .order_by(Milestone.sort_order, Milestone.id).all()
    tasks = Task.query.filter_by(project_id=project_id)\
        .order_by(Task.sort_order, Task.id).all()

    return jsonify({
        'project': project.to_dict(),
        'milestones': [m.to_dict() for m in milestones],
        'tasks': [t.to_dict() for t in tasks],
    })


# ═══════════════════════════════════════════════════════════════
# 任务管理（成员视角）
# ═══════════════════════════════════════════════════════════════

@member_bp.route('/member/tasks', methods=['GET'])
@jwt_required()
def member_list_tasks():
    """获取当前成员在所有项目中被分配的任务。

    可选筛选:
        status:    按状态筛选
        projectId: 按项目筛选

    默认排序: 优先级降序 → 截止日期升序 → ID 升序
    （高优先级和临近截止日期的任务排在最前）

    Returns:
        JSON: 任务列表
    """
    member = _member_or_403()

    status = request.args.get('status')
    project_id = request.args.get('projectId')
    query = Task.query.filter_by(assignee_id=member.id)  # 仅查询分配给当前成员的任务

    if status:
        query = query.filter_by(status=status)
    if project_id:
        query = query.filter_by(project_id=int(project_id))

    # 优先级降序 → 截止日期升序：紧急且重要的任务排前面
    tasks = query.order_by(Task.priority.desc(), Task.due_date.asc(), Task.id).all()
    return jsonify([t.to_dict() for t in tasks])


@member_bp.route('/member/projects/<int:project_id>/tasks', methods=['POST'])
@jwt_required()
def member_create_task(project_id):
    """在指定项目中创建新任务。

    成员可直接在项目看板中创建任务，无需管理员权限。

    Returns:
        201: {"success": true, "task": {...}}
        400: 任务标题不能为空
        404: 项目不存在
    """
    _member_or_403()

    project = Project.query.get(project_id)
    if not project:
        return jsonify({'error': 'not_found', 'message': '项目不存在'}), 404

    data = request.get_json()
    if not data or not data.get('title'):
        return jsonify({'error': 'bad_request', 'message': '任务标题不能为空'}), 400

    task = Task(
        project_id=project_id,
        milestone_id=data.get('milestoneId'),
        assignee_id=data.get('assigneeId'),
        title=data['title'],
        description=data.get('description'),
        status=data.get('status', 'todo'),
        priority=data.get('priority', 'medium'),
        due_date=_parse_date(data.get('dueDate')),
        sort_order=data.get('sortOrder', 0),
    )
    db.session.add(task)
    db.session.commit()

    return jsonify({'success': True, 'task': task.to_dict()}), 201


@member_bp.route('/member/tasks/<int:task_id>', methods=['PUT'])
@jwt_required()
def member_update_task(task_id):
    """更新任务信息。

    允许更新标题、描述、状态、优先级、负责人、里程碑、截止日期等字段。
    所有成员都可以编辑任何任务的任何字段（不做权限限制，
    团队协作场景下成员间相互信任）。

    Returns:
        JSON: {"success": true, "task": {...}}
        404: 任务不存在
    """
    _member_or_403()

    task = Task.query.get(task_id)
    if not task:
        return jsonify({'error': 'not_found', 'message': '任务不存在'}), 404

    data = request.get_json()
    # 可直接映射的字段
    updatable = ['title', 'description', 'status', 'priority', 'sort_order']
    for field in updatable:
        if field in data:
            if field == 'sort_order':
                setattr(task, 'sort_order', data[field])
            else:
                setattr(task, field, data[field])

    # 需要特殊处理的字段
    if 'assigneeId' in data:
        task.assignee_id = data['assigneeId']
    if 'milestoneId' in data:
        task.milestone_id = data['milestoneId']
    if 'dueDate' in data:
        task.due_date = _parse_date(data['dueDate'])
    if 'sortOrder' in data:
        task.sort_order = data['sortOrder']

    db.session.commit()
    return jsonify({'success': True, 'task': task.to_dict()})


@member_bp.route('/member/tasks/<int:task_id>/status', methods=['PUT'])
@jwt_required()
def member_update_task_status(task_id):
    """快速变更任务状态（用于看板拖拽）。

    这是一个轻量级端点，专门用于看板拖拽操作。
    仅接受 status 和可选的 sortOrder 字段。

    有效状态: todo, in_progress, review, done, blocked

    Request Body:
        {"status": "in_progress", "sortOrder": 3}

    Returns:
        JSON: {"success": true, "task": {...}}
        400: status 为空或无效
        404: 任务不存在
    """
    _member_or_403()

    task = Task.query.get(task_id)
    if not task:
        return jsonify({'error': 'not_found', 'message': '任务不存在'}), 404

    data = request.get_json()
    if not data or not data.get('status'):
        return jsonify({'error': 'bad_request', 'message': 'status 不能为空'}), 400

    # 校验状态值的合法性
    valid_statuses = ('todo', 'in_progress', 'review', 'done', 'blocked')
    if data['status'] not in valid_statuses:
        return jsonify({'error': 'validation_error', 'message': f'无效状态: {data["status"]}'}), 400

    task.status = data['status']
    if 'sortOrder' in data:
        task.sort_order = data['sortOrder']

    db.session.commit()
    return jsonify({'success': True, 'task': task.to_dict()})


# ═══════════════════════════════════════════════════════════════
# 资源中心（知识库）
# ═══════════════════════════════════════════════════════════════

# 允许上传的文件扩展名集合（成员端比管理端更宽松，增加了代码/文本文件类型）
ALLOWED_EXTENSIONS = {
    # 图片
    'png', 'jpg', 'jpeg', 'gif', 'webp',
    # 文档和压缩包
    'pdf', 'mp4', 'webm', 'zip', 'rar',
    'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
    # 文本和数据文件
    'txt', 'md', 'json', 'xml', 'csv',
    # 代码文件
    'py', 'ts', 'css', 'java', 'go', 'rs',
}


def _allowed_file(filename):
    """检查上传文件的扩展名是否在成员端允许列表中。

    成员端允许的类型比管理端更多（增加了代码和文本文件类型），
    因为资源中心本质是团队知识库，需要支持多种文件格式。

    Returns:
        bool: 文件扩展名是否被允许
    """
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@member_bp.route('/member/resources/folders', methods=['GET'])
@jwt_required()
def member_list_folders():
    """获取资源中心文件夹列表。

    支持按父文件夹查询（parentId 参数），实现树形目录结构的逐级加载。
    不传 parentId 时返回根目录下的文件夹列表。

    Query Params:
        parentId: 父文件夹 ID（可选，为 None 时返回根目录）

    Returns:
        JSON: 文件夹列表（每个文件夹包含文件数量统计）
    """
    _member_or_403()
    parent_id = request.args.get('parentId', type=int)
    query = ResourceFolder.query.filter_by(parent_id=parent_id)
    folders = query.order_by(ResourceFolder.name).all()
    return jsonify([f.to_dict() for f in folders])


@member_bp.route('/member/resources/folders', methods=['POST'])
@jwt_required()
def member_create_folder():
    """创建新文件夹。

    自动记录创建者 ID。支持嵌套在任意父文件夹下。

    Request Body:
        {"name": "学习资料", "parentId": 1}   // parentId 可选

    Returns:
        201: {"success": true, "folder": {...}}
        400: 文件夹名不能为空
    """
    member = _member_or_403()
    data = request.get_json()
    if not data or not data.get('name'):
        return jsonify({'error': 'bad_request', 'message': '文件夹名不能为空'}), 400

    folder = ResourceFolder(
        name=data['name'].strip(),
        parent_id=data.get('parentId'),
        created_by=member.id,
    )
    db.session.add(folder)
    db.session.commit()
    return jsonify({'success': True, 'folder': folder.to_dict()}), 201


@member_bp.route('/member/resources/files', methods=['GET'])
@jwt_required()
def member_list_files():
    """获取资源中心文件列表。

    支持按文件夹筛选和文件名搜索。
    自动过滤已软删除的文件（is_deleted=False）。

    Query Params:
        folderId: 文件夹 ID（可选，不传则返回根目录文件）
        search:   按文件名搜索（可选）

    Returns:
        JSON: 文件列表
    """
    _member_or_403()
    folder_id = request.args.get('folderId', type=int)
    search = request.args.get('search')

    query = ResourceFile.query.filter_by(is_deleted=False)
    if folder_id:
        query = query.filter_by(folder_id=folder_id)
    else:
        query = query.filter_by(folder_id=None)

    if search:
        query = query.filter(ResourceFile.name.contains(search))

    files = query.order_by(ResourceFile.name).all()
    return jsonify([f.to_dict() for f in files])


@member_bp.route('/member/resources/upload', methods=['POST'])
@jwt_required()
def member_upload_resource():
    """上传文件到资源中心。

    文件处理流程:
      1. 校验文件存在且非空
      2. 校验文件类型
      3. 生成 UUID 唯一文件名
      4. 保存到 uploads/ 目录
      5. 创建 ResourceFile 数据库记录（含文件名、路径、大小、上传者）

    请求格式: multipart/form-data
      - file:     文件数据
      - folderId: 目标文件夹 ID（可选，表单字段）

    Returns:
        201: {"success": true, "file": {...}}
        400: 没有文件、文件名为空或类型不支持
    """
    member = _member_or_403()

    if 'file' not in request.files:
        return jsonify({'error': 'bad_request', 'message': '没有上传文件'}), 400

    file = request.files['file']
    if not file.filename:
        return jsonify({'error': 'bad_request', 'message': '文件名为空'}), 400

    if not _allowed_file(file.filename):
        return jsonify({'error': 'bad_request', 'message': '不支持的文件类型'}), 400
    try:
        validate_upload_content(file, file.filename)
    except UploadContentInvalid:
        return jsonify({
            'error': 'invalid_file_content',
            'message': '文件内容与扩展名不匹配或存在安全风险',
        }), 400

    # 目标文件夹（可选）
    folder_id = request.form.get('folderId', type=int)

    # 生成唯一文件名并保存
    ext = file.filename.rsplit('.', 1)[1].lower()
    unique_name = f"{uuid.uuid4().hex}.{ext}"
    try:
        stored = StorageService(current_app.config).save(file, unique_name)
    except StorageWriteFailed:
        return jsonify({
            'error': 'storage_failed',
            'message': 'File could not be stored. Please try again later.',
        }), 502
    except StorageNotConfigured:
        return jsonify({'error': 'not_configured'}), 503

    # 创建数据库记录
    resource = ResourceFile(
        folder_id=folder_id,
        name=file.filename,                         # 保留原始文件名用于显示
        file_path=stored.url,                         # 存储路径（相对于服务器）
        file_type=ext,                               # 扩展名
        file_size=stored.size,                        # 文件大小（字节）
        uploaded_by=member.id,
    )
    db.session.add(resource)
    db.session.commit()

    return jsonify({'success': True, 'file': resource.to_dict()}), 201


@member_bp.route('/member/resources/<int:file_id>', methods=['PUT'])
@jwt_required()
def member_update_resource(file_id):
    """重命名或移动资源文件。

    支持单独重命名、单独移动文件夹，或同时进行。

    Request Body:
        {"name": "新文件名.pdf"}              // 重命名
        {"folderId": 2}                       // 移动到文件夹 2
        {"name": "新名.pdf", "folderId": 2}   // 同时操作

    Returns:
        JSON: {"success": true, "file": {...}}
        404: 文件不存在或已删除
    """
    _member_or_403()
    f = ResourceFile.query.get(file_id)
    if not f or f.is_deleted:
        return jsonify({'error': 'not_found', 'message': '文件不存在'}), 404

    data = request.get_json()
    if 'name' in data:
        f.name = data['name']
    if 'folderId' in data:
        f.folder_id = data['folderId']

    db.session.commit()
    return jsonify({'success': True, 'file': f.to_dict()})


@member_bp.route('/member/resources/<int:file_id>', methods=['DELETE'])
@jwt_required()
def member_delete_resource(file_id):
    """软删除资源文件（移入回收站）。

    文件不会被物理删除，仅标记 is_deleted=True。
    管理员可在后台查看已删除文件并恢复。

    Returns:
        JSON: {"success": true, "message": "文件已移到回收站"}
        404: 文件不存在
    """
    _member_or_403()
    f = ResourceFile.query.get(file_id)
    if not f:
        return jsonify({'error': 'not_found', 'message': '文件不存在'}), 404

    f.is_deleted = True
    db.session.commit()
    return jsonify({'success': True, 'message': '文件已移到回收站'})


# ═══════════════════════════════════════════════════════════════
# 证书管理
# ═══════════════════════════════════════════════════════════════

@member_bp.route('/member/certificates', methods=['GET'])
@jwt_required()
def member_list_certificates():
    """获取当前成员提交的所有证书。

    默认按日期降序、ID 降序排列（最新的证书在前）。

    Returns:
        JSON: 证书列表
    """
    member = _member_or_403()
    certs = Certificate.query.filter_by(member_id=member.id)\
        .order_by(Certificate.date.desc(), Certificate.id.desc()).all()
    return jsonify([c.to_dict() for c in certs])


@member_bp.route('/member/certificates', methods=['POST'])
@jwt_required()
def member_create_certificate():
    """提交新证书记录。

    新建证书默认状态为 'pending'（待审核），需管理员审核后变为 'verified'。

    winner 字段默认为当前成员姓名（可通过请求覆盖）。

    Returns:
        201: {"success": true, "certificate": {...}}
        400: 证书名称不能为空
    """
    member = _member_or_403()
    data = request.get_json()
    if not data or not data.get('name'):
        return jsonify({'error': 'bad_request', 'message': '证书名称不能为空'}), 400

    cert = Certificate(
        member_id=member.id,
        name=data['name'],
        level=data.get('level', 'other'),
        category=data.get('category'),
        winner=data.get('winner', member.name),  # 默认获奖者为当前成员
        issuer=data.get('issuer'),
        advisor=data.get('advisor'),
        date=data.get('date'),
        description=data.get('description'),
        images=data.get('images', []),
        related_project=data.get('relatedProject'),
        status='pending',  # 新证书记录默认待审核
    )
    db.session.add(cert)
    db.session.commit()
    return jsonify({'success': True, 'certificate': cert.to_dict()}), 201


@member_bp.route('/member/certificates/<int:cert_id>', methods=['PUT'])
@jwt_required()
def member_update_certificate(cert_id):
    """更新证书记录。

    仅允许更新自己提交的证书（通过 member_id 校验所有权）。
    被驳回（rejected）的证书在成员修正内容后自动重新进入待审核（pending）。

    Returns:
        JSON: {"success": true, "certificate": {...}}
        404: 证书不存在或不属于当前成员
    """
    member = _member_or_403()
    cert = Certificate.query.get(cert_id)
    # 所有权校验：只能编辑自己的证书
    if not cert or cert.member_id != member.id:
        return jsonify({'error': 'not_found', 'message': '证书不存在'}), 404

    data = request.get_json()
    updatable = ['name', 'level', 'category', 'winner', 'issuer', 'advisor',
                 'date', 'description', 'related_project']
    for field in updatable:
        if field in data:
            if field == 'related_project':
                setattr(cert, 'related_project', data[field])
            else:
                setattr(cert, field, data[field])
    if 'images' in data:
        cert.images = data['images']
    if 'relatedProject' in data:
        cert.related_project = data['relatedProject']

    # 修正被驳回的证书后重新送审
    if cert.status == 'rejected':
        cert.status = 'pending'

    db.session.commit()
    return jsonify({'success': True, 'certificate': cert.to_dict()})


@member_bp.route('/member/certificates/<int:cert_id>', methods=['DELETE'])
@jwt_required()
def member_delete_certificate(cert_id):
    """删除证书记录。

    仅允许删除自己提交的证书。

    Returns:
        JSON: {"success": true, "message": "证书已删除"}
        404: 证书不存在或不属于当前成员
    """
    member = _member_or_403()
    cert = Certificate.query.get(cert_id)
    if not cert or cert.member_id != member.id:
        return jsonify({'error': 'not_found', 'message': '证书不存在'}), 404

    db.session.delete(cert)
    db.session.commit()
    return jsonify({'success': True, 'message': '证书已删除'})


@member_bp.route('/member/certificates/upload', methods=['POST'])
@jwt_required()
def member_upload_certificate_image():
    """上传证书图片。

    返回的 URL 可在创建/更新证书时传入 images 数组。
    仅允许上传图片格式（PNG/JPG/WebP）。

    请求格式: multipart/form-data
      - file: 图片文件

    Returns:
        201: {"success": true, "url": "/uploads/cert_abc123.png"}
        400: 没有文件、文件名为空或非图片格式
    """
    _member_or_403()

    if 'file' not in request.files:
        return jsonify({'error': 'bad_request', 'message': '没有上传文件'}), 400

    file = request.files['file']
    if not file.filename:
        return jsonify({'error': 'bad_request', 'message': '文件名为空'}), 400

    # 证书图片仅允许图片格式
    ext = file.filename.rsplit('.', 1)[1].lower()
    if ext not in {'png', 'jpg', 'jpeg', 'webp'}:
        return jsonify({'error': 'bad_request', 'message': '请上传图片文件 (PNG/JPG/WebP)'}), 400
    try:
        validate_upload_content(file, file.filename)
    except UploadContentInvalid:
        return jsonify({
            'error': 'invalid_file_content',
            'message': '文件内容与扩展名不匹配或存在安全风险',
        }), 400

    # 证书图片使用 cert_ 前缀便于识别
    unique_name = f"cert_{uuid.uuid4().hex}.{ext}"
    try:
        stored = StorageService(current_app.config).save(file, unique_name)
    except StorageWriteFailed:
        return jsonify({
            'error': 'storage_failed',
            'message': 'File could not be stored. Please try again later.',
        }), 502
    except StorageNotConfigured:
        return jsonify({'error': 'not_configured'}), 503

    return jsonify({'success': True, 'url': stored.url}), 201


@member_bp.route('/member/certificates/<int:cert_id>/ocr', methods=['POST'])
@jwt_required()
def member_ocr_certificate(cert_id):
    """对当前成员已保存的证书执行 AI 识别并持久化识别结果。"""
    member = _member_or_403()
    cert = Certificate.query.get(cert_id)
    if not cert or cert.member_id != member.id:
        return jsonify({'error': 'not_found', 'message': '证书不存在'}), 404

    ocr_service = OcrService(current_app.config)
    try:
        ocr_service.validate_configuration()
        images = _read_managed_certificate_images(cert.images)
        result = ocr_service.extract_fields(images)
        if isinstance(result, str):
            result = {'ocr_text': result, 'fields': {}}
    except _InvalidCertificateImages as exc:
        return jsonify(exc.body), exc.status
    except StorageImageInvalid:
        return jsonify({
            'error': 'invalid_certificate_images',
            'message': 'Certificate images must be managed image uploads.',
        }), 422
    except StorageNotConfigured:
        return jsonify({
            'error': 'not_configured',
            'message': 'Object storage is not configured.',
        }), 503
    except StorageReadFailed:
        return jsonify({
            'error': 'ocr_failed',
            'message': 'Certificate image could not be read. Please try again later.',
        }), 502
    except OcrNotConfigured:
        return jsonify({
            'error': 'not_configured',
            'message': 'OCR is not configured. Ask an administrator to configure the OCR provider.',
        }), 503
    except OcrRequestFailed:
        return jsonify({
            'error': 'ocr_failed',
            'message': 'Certificate recognition is temporarily unavailable. Please try again later.',
        }), 502

    cert.ocr_text = result['ocr_text']
    cert.ocr_fields = result['fields']
    db.session.commit()
    return jsonify({
        'success': True,
        'ocrText': result['ocr_text'],
        'ocrFields': result['fields'],
        'certificate': cert.to_dict(),
    })


@member_bp.route('/member/certificates/ocr', methods=['POST'])
@jwt_required()
def member_ocr_images():
    """对尚未保存为证书记录的图片执行 AI 识别，返回结构化字段供表单回填。

    Request Body:
        {"images": ["/uploads/cert_xxx.png", ...]}

    Returns:
        JSON: {"success": true, "ocrText": "...", "ocrFields": {...}}
    """
    _member_or_403()
    data = request.get_json() or {}
    image_references = data.get('images')
    if not isinstance(image_references, list) or not image_references:
        return jsonify({
            'error': 'invalid_certificate_images',
            'message': 'Certificate images must be managed image uploads.',
        }), 422

    ocr_service = OcrService(current_app.config)
    try:
        ocr_service.validate_configuration()
        images = _read_managed_certificate_images(image_references)
        result = ocr_service.extract_fields(images)
        if isinstance(result, str):
            result = {'ocr_text': result, 'fields': {}}
    except _InvalidCertificateImages as exc:
        return jsonify(exc.body), exc.status
    except StorageImageInvalid:
        return jsonify({
            'error': 'invalid_certificate_images',
            'message': 'Certificate images must be managed image uploads.',
        }), 422
    except StorageNotConfigured:
        return jsonify({
            'error': 'not_configured',
            'message': 'Object storage is not configured.',
        }), 503
    except StorageReadFailed:
        return jsonify({
            'error': 'ocr_failed',
            'message': 'Certificate image could not be read. Please try again later.',
        }), 502
    except OcrNotConfigured:
        return jsonify({
            'error': 'not_configured',
            'message': 'OCR is not configured. Ask an administrator to configure the OCR provider.',
        }), 503
    except OcrRequestFailed:
        return jsonify({
            'error': 'ocr_failed',
            'message': 'Certificate recognition is temporarily unavailable. Please try again later.',
        }), 502

    return jsonify({
        'success': True,
        'ocrText': result['ocr_text'],
        'ocrFields': result['fields'],
    })


class _InvalidCertificateImages(Exception):
    """证书图片校验失败，携带可直接返回的 HTTP 状态与响应体。"""

    def __init__(self, status, body):
        super().__init__(body['message'])
        self.status = status
        self.body = body


def _read_managed_certificate_images(image_references):
    """读取受管证书图片，校验数量、格式与总大小。

    Args:
        image_references: 图片 URL 列表（来自受管上传）。

    Returns:
        list[StoredImage]: 可用于 OCR 的图片对象。

    Raises:
        _InvalidCertificateImages: 图片引用非法、数量超限或总大小超限。
        StorageImageInvalid / StorageNotConfigured / StorageReadFailed:
            存储层校验或读取失败。
    """
    if not isinstance(image_references, list) or not image_references:
        raise _InvalidCertificateImages(422, {
            'error': 'invalid_certificate_images',
            'message': 'Certificate images must be managed image uploads.',
        })
    if len(image_references) > 5:
        raise _InvalidCertificateImages(422, {
            'error': 'invalid_certificate_images',
            'message': 'Certificate OCR accepts at most 5 images.',
        })

    storage_service = StorageService(current_app.config)
    max_total_bytes = current_app.config['MAX_CONTENT_LENGTH']
    total_bytes = 0
    images = []
    for ref in image_references:
        image = storage_service.read_certificate_image(ref)
        total_bytes += len(image.content)
        if total_bytes > max_total_bytes:
            raise _InvalidCertificateImages(413, {
                'error': 'certificate_images_too_large',
                'message': 'Certificate images exceed the total size limit.',
            })
        images.append(image)
    return images


# ═══════════════════════════════════════════════════════════════
# 通知中心
# ═══════════════════════════════════════════════════════════════

@member_bp.route('/member/notifications', methods=['GET'])
@jwt_required()
def member_list_notifications():
    """获取当前成员的通知列表。

    可选筛选: unread=true 仅返回未读通知
    最多返回最近 50 条通知（防止数据量过大）。

    Returns:
        JSON: 通知列表（按创建时间降序）
    """
    member = _member_or_403()
    unread_only = request.args.get('unread', type=bool, default=False)

    query = Notification.query.filter_by(member_id=member.id)
    if unread_only:
        query = query.filter_by(is_read=False)

    notifs = query.order_by(Notification.created_at.desc()).limit(50).all()
    return jsonify([n.to_dict() for n in notifs])


@member_bp.route('/member/notifications/unread-count', methods=['GET'])
@jwt_required()
def member_unread_count():
    """获取未读通知数量。

    用于在导航栏/菜单中显示红色角标。
    前端可定时轮询此接口（如每 30 秒一次）。

    Returns:
        JSON: {"count": 3}
    """
    member = _member_or_403()
    count = Notification.query.filter_by(member_id=member.id, is_read=False).count()
    return jsonify({'count': count})


@member_bp.route('/member/notifications/<int:notif_id>/read', methods=['PUT'])
@jwt_required()
def member_mark_read(notif_id):
    """标记单条通知为已读。

    仅允许标记自己的通知（通过 member_id 校验所有权）。

    Returns:
        JSON: {"success": true}
        404: 通知不存在或不属于当前成员
    """
    member = _member_or_403()
    notif = Notification.query.get(notif_id)
    if not notif or notif.member_id != member.id:
        return jsonify({'error': 'not_found', 'message': '通知不存在'}), 404
    notif.is_read = True
    db.session.commit()
    return jsonify({'success': True})


@member_bp.route('/member/notifications/read-all', methods=['PUT'])
@jwt_required()
def member_mark_all_read():
    """将所有未读通知标记为已读。

    批量操作，一次性处理当前成员的所有未读通知。

    Returns:
        JSON: {"success": true}
    """
    member = _member_or_403()
    Notification.query.filter_by(member_id=member.id, is_read=False)\
        .update({'is_read': True})
    db.session.commit()
    return jsonify({'success': True})


# ═══════════════════════════════════════════════════════════════
# 博客已读追踪（公告已读状态）
# ═══════════════════════════════════════════════════════════════

@member_bp.route('/member/blogs/<int:blog_id>/read', methods=['POST'])
@jwt_required()
def member_mark_blog_read(blog_id):
    """标记文章/公告为已读（幂等，重复阅读仅更新时间）。"""
    member = _member_or_403()
    post = BlogPost.query.get(blog_id)
    if not post:
        return jsonify({'error': 'not_found', 'message': '文章不存在'}), 404

    record = BlogRead.query.filter_by(
        member_id=member.id, blog_id=post.id
    ).first()
    if record:
        record.read_at = datetime.now(timezone.utc)
    else:
        db.session.add(BlogRead(member_id=member.id, blog_id=post.id))
    db.session.commit()
    return jsonify({'success': True})


@member_bp.route('/member/blogs/read-ids', methods=['GET'])
@jwt_required()
def member_blog_read_ids():
    """返回当前成员已读的文章 ID 列表（用于前端展示已读状态）。"""
    member = _member_or_403()
    records = BlogRead.query.filter_by(member_id=member.id).all()
    return jsonify({'readIds': [r.blog_id for r in records]})


# ═══════════════════════════════════════════════════════════════
# 周报系统（智能项目管理智能体）
# ═══════════════════════════════════════════════════════════════

@member_bp.route('/member/weekly-reports', methods=['GET'])
@jwt_required()
def member_list_weekly_reports():
    """获取当前成员的周报列表。

    可选筛选: status（draft/submitted/reviewed）、projectId

    Returns:
        JSON: 周报列表（按周开始日期降序）
    """
    member = _member_or_403()
    status = request.args.get('status')
    project_id = request.args.get('projectId', type=int)

    query = WeeklyReport.query.filter_by(member_id=member.id)
    if status:
        query = query.filter_by(status=status)
    if project_id:
        query = query.filter_by(project_id=project_id)

    reports = query.order_by(WeeklyReport.week_start.desc(), WeeklyReport.id.desc()).all()
    return jsonify([r.to_dict() for r in reports])


@member_bp.route('/member/weekly-reports', methods=['POST'])
@jwt_required()
def member_create_weekly_report():
    """创建周报草稿。

    Request Body:
        {"weekStart": "2026-08-03", "weekEnd": "2026-08-09",
         "content": {"done": "...", "plan": "...", "issues": "...", "summary": "..."},
         "projectId": 1}

    也兼容扁平字段: done / plan / issues / summary（自动组装 content）。

    Returns:
        201: {"success": true, "report": {...}}
        400: 周报内容不能为空
    """
    member = _member_or_403()
    data = request.get_json()
    if not data:
        return jsonify({'error': 'bad_request', 'message': '请求体为空'}), 400

    content = data.get('content')
    if not isinstance(content, dict):
        content = {
            'done': data.get('done', ''),
            'plan': data.get('plan', ''),
            'issues': data.get('issues', ''),
            'summary': data.get('summary', ''),
        }
    validation_error = validate_weekly_report_content(content)
    if validation_error:
        return jsonify({'error': 'bad_request', 'message': validation_error}), 400

    report = WeeklyReport(
        member_id=member.id,
        project_id=data.get('projectId'),
        week_start=_parse_date(data.get('weekStart'), date_only=True),
        week_end=_parse_date(data.get('weekEnd'), date_only=True),
        content=content,
        status='draft',
    )
    db.session.add(report)
    db.session.commit()
    return jsonify({'success': True, 'report': report.to_dict()}), 201


@member_bp.route('/member/weekly-reports/<int:report_id>', methods=['GET'])
@jwt_required()
def member_get_weekly_report(report_id):
    """获取当前成员的单份周报详情（仅限自己的）。"""
    member = _member_or_403()
    report = WeeklyReport.query.get(report_id)
    if not report or report.member_id != member.id:
        return jsonify({'error': 'not_found', 'message': '周报不存在'}), 404
    return jsonify(report.to_dict())


@member_bp.route('/member/weekly-reports/<int:report_id>', methods=['PUT'])
@jwt_required()
def member_update_weekly_report(report_id):
    """更新周报内容（仅限自己的草稿，已提交/已审阅不可改）。"""
    member = _member_or_403()
    report = WeeklyReport.query.get(report_id)
    if not report or report.member_id != member.id:
        return jsonify({'error': 'not_found', 'message': '周报不存在'}), 404
    if report.status != 'draft':
        return jsonify({'error': 'validation_error', 'message': '已提交的周报不可修改'}), 400

    data = request.get_json() or {}
    if 'weekStart' in data:
        report.week_start = _parse_date(data['weekStart'], date_only=True)
    if 'weekEnd' in data:
        report.week_end = _parse_date(data['weekEnd'], date_only=True)
    if 'projectId' in data:
        report.project_id = data['projectId']
    if 'content' in data and isinstance(data['content'], dict):
        validation_error = validate_weekly_report_content(data['content'])
        if validation_error:
            return jsonify({'error': 'bad_request', 'message': validation_error}), 400
        report.content = data['content']
    db.session.commit()
    return jsonify({'success': True, 'report': report.to_dict()})


@member_bp.route('/member/weekly-reports/<int:report_id>/submit', methods=['POST'])
@jwt_required()
def member_submit_weekly_report(report_id):
    """提交周报（draft → submitted），进入教师审阅流程。"""
    member = _member_or_403()
    report = WeeklyReport.query.get(report_id)
    if not report or report.member_id != member.id:
        return jsonify({'error': 'not_found', 'message': '周报不存在'}), 404
    if report.status == 'reviewed':
        return jsonify({'error': 'validation_error', 'message': '周报已审阅，不能重复提交'}), 400
    report.status = 'submitted'
    report.submitted_at = datetime.now(timezone.utc)
    notify_all_admins(
        title=f'新周报待审阅：{member.name}',
        body=f'成员 {member.name} 提交了第 {report.week_start or "?"} 周周报，请及时审阅。',
        link='/admin/weekly-reports',
        notification_type='weekly_report_submitted',
    )
    db.session.commit()
    return jsonify({'success': True, 'report': report.to_dict()})


@member_bp.route('/member/weekly-reports/<int:report_id>', methods=['DELETE'])
@jwt_required()
def member_delete_weekly_report(report_id):
    """删除当前成员自己的周报（已审阅的不可删除）。"""
    member = _member_or_403()
    report = WeeklyReport.query.get(report_id)
    if not report or report.member_id != member.id:
        return jsonify({'error': 'not_found', 'message': '周报不存在'}), 404
    if report.status == 'reviewed':
        return jsonify({'error': 'validation_error', 'message': '已审阅的周报不可删除'}), 400
    db.session.delete(report)
    db.session.commit()
    return jsonify({'success': True, 'message': '周报已删除'})


@member_bp.route('/member/weekly-reports/<int:report_id>/analyze', methods=['POST'])
@jwt_required()
def member_analyze_weekly_report(report_id):
    """对当前成员自己的周报执行 AI 分析。

    分析结果写入 ai_analysis 与 completion_rate。
    需要配置 AI_ENABLED / AI_API_KEY / AI_BASE_URL / AI_MODEL。
    """
    member = _member_or_403()
    report = WeeklyReport.query.get(report_id)
    if not report or report.member_id != member.id:
        return jsonify({'error': 'not_found', 'message': '周报不存在'}), 404

    try:
        analysis = _analyze_report_with_ai(report)
    except AiNotConfigured:
        return jsonify({
            'error': 'not_configured',
            'message': 'AI 服务未配置，请联系管理员配置 AI 服务',
        }), 503
    except AiRequestFailed:
        return jsonify({
            'error': 'ai_failed',
            'message': 'AI 分析暂时不可用，请稍后重试',
        }), 502

    report.ai_analysis = analysis
    report.completion_rate = analysis.get('score')
    notify_all_admins(
        title=f'周报 AI 分析完成：{member.name}',
        body=f'你的周报 #{report.id} 已生成审核报告，完成度 {analysis.get("score", "-")}。',
        link='/admin/weekly-reports',
        notification_type='weekly_report_analyzed',
    )
    db.session.commit()
    return jsonify({'success': True, 'report': report.to_dict()})


# ═══════════════════════════════════════════════════════════════
# 提醒系统
# ═══════════════════════════════════════════════════════════════

@member_bp.route('/member/reminders', methods=['GET'])
@jwt_required()
def member_list_reminders():
    """获取当前成员的提醒列表。

    可选筛选: status（pending/sent/done/cancelled）、type
    """
    member = _member_or_403()
    status = request.args.get('status')
    reminder_type = request.args.get('type')

    query = Reminder.query.filter_by(member_id=member.id)
    if status:
        query = query.filter_by(status=status)
    if reminder_type:
        query = query.filter_by(type=reminder_type)
    reminders = query.order_by(Reminder.scheduled_at.asc(), Reminder.id.desc()).all()
    return jsonify([r.to_dict() for r in reminders])


@member_bp.route('/member/reminders', methods=['POST'])
@jwt_required()
def member_create_reminder():
    """为当前成员创建自定义提醒。

    Request Body:
        {"title": "周五交周报", "message": "...", "scheduledAt": "2026-08-07T18:00:00+08:00",
         "projectId": 1}
    scheduledAt 不传表示立即提醒。
    """
    member = _member_or_403()
    data = request.get_json()
    if not data or not str(data.get('title') or '').strip():
        return jsonify({'error': 'bad_request', 'message': '提醒标题不能为空'}), 400

    reminder = Reminder(
        member_id=member.id,
        project_id=data.get('projectId'),
        type=data.get('type', 'custom'),
        title=data['title'].strip(),
        message=data.get('message'),
        link=data.get('link'),
        scheduled_at=_parse_date(data.get('scheduledAt')),
        status='pending',
        created_by=member.id,
    )
    db.session.add(reminder)
    # 创建时已到触发时间（scheduledAt 为空或过去）：立即转为站内通知，无需等定时扫描
    due_now = (
        reminder.scheduled_at is None
        or reminder.scheduled_at <= datetime.now(timezone.utc)
    )
    sent_immediately = False
    if due_now:
        sent_immediately = send_reminder_notification(reminder)
    db.session.commit()
    return jsonify({
        'success': True,
        'reminder': reminder.to_dict(),
        'sentImmediately': sent_immediately,
    }), 201


@member_bp.route('/member/reminders/<int:reminder_id>', methods=['DELETE'])
@jwt_required()
def member_delete_reminder(reminder_id):
    """删除当前成员自己的提醒。"""
    member = _member_or_403()
    reminder = Reminder.query.get(reminder_id)
    if not reminder or reminder.member_id != member.id:
        return jsonify({'error': 'not_found', 'message': '提醒不存在'}), 404
    db.session.delete(reminder)
    db.session.commit()
    return jsonify({'success': True, 'message': '提醒已删除'})


@member_bp.route('/member/reminders/<int:reminder_id>', methods=['PUT'])
@jwt_required()
def member_update_reminder(reminder_id):
    """更新当前成员的提醒（仅限未触发的提醒）。"""
    member = _member_or_403()
    reminder = Reminder.query.get(reminder_id)
    if not reminder or reminder.member_id != member.id:
        return jsonify({'error': 'not_found', 'message': '提醒不存在'}), 404
    if reminder.status != 'pending':
        return jsonify({'error': 'validation_error', 'message': '已触发的提醒不可修改'}), 400

    data = request.get_json() or {}
    for field in ('title', 'message', 'link', 'type'):
        if field in data:
            setattr(reminder, field, data[field])
    if 'scheduledAt' in data:
        reminder.scheduled_at = _parse_date(data['scheduledAt'])
    if 'projectId' in data:
        reminder.project_id = data['projectId']
    db.session.commit()
    return jsonify({'success': True, 'reminder': reminder.to_dict()})


@member_bp.route('/member/reminders/<int:reminder_id>/complete', methods=['POST'])
@jwt_required()
def member_complete_reminder(reminder_id):
    """将当前成员的一条提醒标记为已完成。"""
    member = _member_or_403()
    reminder = Reminder.query.get(reminder_id)
    if not reminder or reminder.member_id != member.id:
        return jsonify({'error': 'not_found', 'message': '提醒不存在'}), 404
    reminder.status = 'done'
    db.session.commit()
    return jsonify({'success': True, 'reminder': reminder.to_dict()})


# ── 通用辅助函数 ──

def _parse_date(value, date_only=False):
    """将 ISO 8601 日期字符串解析为 datetime 对象。

    支持带时区偏移的格式（如 '2026-01-01T00:00:00Z' 或 '2026-01-01T00:00:00+08:00'）。

    Args:
        value: ISO 8601 格式的日期字符串
        date_only: True 时返回 date 对象（用于周起始/结束日期）

    Returns:
        datetime | date | None: 解析成功返回对应对象，失败或输入为空返回 None
    """
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
        return parsed.date() if date_only else parsed
    except (ValueError, TypeError):
        return None
