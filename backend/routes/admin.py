"""星雨作坊 CMS — 管理后台 API 路由

本模块包含所有需要管理员 JWT 认证的后台管理端点，全部挂载在 /api/admin/* 下。

认证机制:
  - 所有端点（除 login）均需在 Authorization 头携带 Bearer token
  - Token 通过 POST /api/admin/login 获取
  - JWT identity 为管理员用户 ID 的字符串形式
  - _admin_or_403() 辅助函数统一校验管理员身份

端点分类:
  - 认证        POST   /api/admin/login              — 管理员登录
                GET    /api/admin/me                 — 获取当前管理员信息
  - 文件上传    POST   /api/admin/upload             — 上传文件
  - 成员管理    GET    /api/admin/members            — 成员列表（含筛选）
                POST   /api/admin/members            — 创建成员
                GET    /api/admin/members/<id>       — 获取成员详情
                PUT    /api/admin/members/<id>       — 更新成员
                DELETE /api/admin/members/<id>       — 删除成员
  - 项目管理    GET    /api/admin/projects           — 项目列表
                POST   /api/admin/projects           — 创建项目
                GET    /api/admin/projects/<id>      — 获取项目详情
                PUT    /api/admin/projects/<id>      — 更新项目
                DELETE /api/admin/projects/<id>      — 删除项目（级联删除里程碑和任务）
                POST   /api/admin/projects/<id>/milestones — 创建里程碑
                POST   /api/admin/projects/<id>/tasks      — 创建任务
  - 获奖管理    GET    /api/admin/awards             — 获奖列表
                POST   /api/admin/awards             — 创建获奖
                GET    /api/admin/awards/<id>        — 获取获奖详情
                PUT    /api/admin/awards/<id>        — 更新获奖
                DELETE /api/admin/awards/<id>        — 删除获奖
  - 博客管理    GET    /api/admin/blogs              — 文章列表（含草稿）
                POST   /api/admin/blogs              — 创建文章
                GET    /api/admin/blogs/<id>         — 获取文章详情
                PUT    /api/admin/blogs/<id>         — 更新文章
                DELETE /api/admin/blogs/<id>         — 删除文章
  - 站点配置    GET    /api/admin/config             — 获取所有配置
                PUT    /api/admin/config             — 批量更新配置
                PUT    /api/admin/config/<key>       — 更新单个配置
  - 页面管理    GET    /api/admin/pages              — 页面列表
                POST   /api/admin/pages              — 创建页面
                GET    /api/admin/pages/<slug>       — 获取页面
                PUT    /api/admin/pages/<slug>       — 创建或更新页面
                DELETE /api/admin/pages/<slug>       — 删除页面
  - 申请管理    GET    /api/admin/applications       — 申请列表
                PATCH  /api/admin/applications/<id>  — 审核申请
  - 留言管理    GET    /api/admin/contact-messages   — 留言列表
                PATCH  /api/admin/contact-messages/<id> — 处理留言
  - 数据导入导出 GET  /api/admin/export             — 导出全站数据
                POST   /api/admin/import             — 导入数据（支持 replace/merge 模式）
"""

import uuid
from datetime import datetime, timezone
from flask import Blueprint, jsonify, request, current_app
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity

from models import (
    db, SiteConfig, Page, Application, ContactMessage,
    Member, Project, Milestone, Task, Award, BlogPost, AdminUser,
)
from services.storage_service import StorageNotConfigured, StorageService

admin_bp = Blueprint('admin', __name__)


# ═══════════════════════════════════════════════════════════════
# 认证辅助函数
# ═══════════════════════════════════════════════════════════════

def _admin_required():
    """从 JWT token 中解析管理员身份。

    从当前请求的 JWT identity 中提取管理员用户 ID，
    查询 AdminUser 表确认用户存在且有效。

    Returns:
        AdminUser | None: 认证成功返回管理员对象，失败返回 None
    """
    identity = get_jwt_identity()
    try:
        user_id = int(identity)
    except (ValueError, TypeError):
        return None
    return AdminUser.query.get(user_id)


def _admin_or_403():
    """强制要求管理员身份，否则返回 403。

    这是所有管理端点的权限守卫函数。
    必须在 @jwt_required() 装饰器之后调用。

    Returns:
        AdminUser: 已认证的管理员对象

    Raises:
        403: 当前用户不是管理员
    """
    admin = _admin_required()
    if not admin:
        from flask import abort
        abort(403)
    return admin


def _allowed_file(filename):
    """检查上传文件的扩展名是否在允许列表中。

    允许的文件类型包括:
      - 图片: png, jpg, jpeg, gif, webp, svg
      - 文档: pdf
      - 视频: mp4, webm
      - 压缩包: zip, rar
      - Office: doc, docx, xls, xlsx, ppt, pptx

    Args:
        filename: 原始文件名

    Returns:
        bool: 文件类型是否被允许
    """
    ALLOWED = {'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg',
               'pdf', 'mp4', 'webm', 'zip', 'rar',
               'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'}
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED


# ═══════════════════════════════════════════════════════════════
# 认证端点
# ═══════════════════════════════════════════════════════════════

@admin_bp.route('/admin/login', methods=['POST'])
def admin_login():
    """管理员登录 — 验证用户名密码，返回 JWT token。

    Request Body:
        {"username": "admin", "password": "admin123"}

    Returns:
        200: {"success": true, "token": "...", "user": {...}}
        400: 缺少用户名或密码
        401: 用户名或密码错误
    """
    data = request.get_json()
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({'error': 'bad_request', 'message': '请输入用户名和密码'}), 400

    user = AdminUser.query.filter_by(username=data['username']).first()
    if not user or not user.check_password(data['password']):
        return jsonify({'error': 'auth_failed', 'message': '用户名或密码错误'}), 401

    # 生成 JWT token，identity 为管理员 ID 的字符串
    token = create_access_token(identity=str(user.id))
    return jsonify({'success': True, 'token': token, 'user': user.to_dict()})


@admin_bp.route('/admin/me', methods=['GET'])
@jwt_required()
def admin_me():
    """获取当前登录管理员的信息。

    用于前端初始化时验证 token 有效性和获取管理员基本信息。

    Header:
        Authorization: Bearer <token>

    Returns:
        200: 管理员信息
        403: token 无效或非管理员
    """
    admin = _admin_or_403()
    return jsonify(admin.to_dict())


# ═══════════════════════════════════════════════════════════════
# 文件上传
# ═══════════════════════════════════════════════════════════════

@admin_bp.route('/admin/upload', methods=['POST'])
@jwt_required()
def upload_file():
    """上传文件到服务器。

    文件存储流程:
      1. 校验文件是否存在且非空
      2. 校验文件类型是否在允许列表中
      3. 生成 UUID 唯一文件名（防冲突）
      4. 保存到 uploads/ 目录
      5. 返回访问 URL

    返回的 URL 格式: /uploads/<uuid>.<ext>
    前端拼接 base URL 后即可访问。

    Returns:
        201: {"success": true, "url": "/uploads/abc123.png", "filename": "abc123.png"}
        400: 没有文件、文件名为空或文件类型不支持
        403: 非管理员
    """
    _admin_or_403()

    if 'file' not in request.files:
        return jsonify({'error': 'bad_request', 'message': '没有上传文件'}), 400

    file = request.files['file']
    if not file.filename:
        return jsonify({'error': 'bad_request', 'message': '文件名为空'}), 400

    if not _allowed_file(file.filename):
        return jsonify({'error': 'bad_request', 'message': '不支持的文件类型'}), 400

    # 生成唯一文件名（UUID + 原始扩展名）
    ext = file.filename.rsplit('.', 1)[1].lower()
    unique_name = f"{uuid.uuid4().hex}.{ext}"

    try:
        stored = StorageService(current_app.config).save(file, unique_name)
    except StorageNotConfigured:
        return jsonify({'error': 'not_configured'}), 503

    return jsonify({'success': True, 'url': stored.url, 'filename': stored.filename}), 201


# ═══════════════════════════════════════════════════════════════
# 管理员: 成员 CRUD
# ═══════════════════════════════════════════════════════════════

@admin_bp.route('/admin/members', methods=['GET'])
@jwt_required()
def admin_list_members():
    """获取所有成员列表（含非活跃成员）。

    支持筛选:
        search: 按姓名、邮箱、角色搜索
        group:  按分组过滤（product/design/dev/content）
        status: 按状态过滤（active/inactive）

    默认按 sort_order 升序、id 升序排列。

    Returns:
        JSON: 成员完整信息列表（含隐私字段）
    """
    _admin_or_403()

    search = request.args.get('search')
    group = request.args.get('group')
    status = request.args.get('status')

    query = Member.query

    if search:
        query = query.filter(
            db.or_(
                Member.name.contains(search),
                Member.email.contains(search),
                Member.role.contains(search),
            )
        )
    if group:
        query = query.filter_by(group=group)
    if status:
        query = query.filter_by(status=status)

    members = query.order_by(Member.sort_order, Member.id).all()
    return jsonify([m.to_dict() for m in members])


@admin_bp.route('/admin/members', methods=['POST'])
@jwt_required()
def admin_create_member():
    """创建新成员。

    管理员在后台添加成员记录后，成员可凭学号或邮箱进行自主注册。
    新创建的成员默认没有密码（password_hash 为空），需要成员自行注册激活。

    Request Body:
        {
            "name": "新成员",
            "avatar": "https://...",
            "role": "前端开发",
            "group": "dev",
            "skills": ["React", "Vue"],
            "email": "new@example.com",
            ...
        }

    Returns:
        201: {"success": true, "member": {...}}
        400: 成员姓名不能为空
    """
    _admin_or_403()
    data = request.get_json()
    if not data or not data.get('name'):
        return jsonify({'error': 'bad_request', 'message': '成员姓名不能为空'}), 400

    member = Member(
        name=data['name'],
        avatar=data.get('avatar'),
        role=data.get('role'),
        group=data.get('group'),
        skills=data.get('skills', []),
        github=data.get('github'),
        blog=data.get('blog'),
        email=data.get('email'),
        bio=data.get('bio'),
        grade=data.get('grade'),
        is_alumni=data.get('isAlumni', False),
        status=data.get('status', 'active'),
        sort_order=data.get('sortOrder', 0),
    )
    db.session.add(member)
    db.session.commit()

    return jsonify({'success': True, 'member': member.to_dict()}), 201


@admin_bp.route('/admin/members/<int:member_id>', methods=['GET'])
@jwt_required()
def admin_get_member(member_id):
    """获取单个成员完整详情。

    Args:
        member_id: 成员 ID

    Returns:
        JSON: 成员完整信息
              或 404: 成员不存在
    """
    _admin_or_403()
    member = Member.query.get(member_id)
    if not member:
        return jsonify({'error': 'not_found', 'message': '成员不存在'}), 404
    return jsonify(member.to_dict())


@admin_bp.route('/admin/members/<int:member_id>', methods=['PUT'])
@jwt_required()
def admin_update_member(member_id):
    """更新成员信息。

    支持部分更新（仅更新请求中包含的字段）。
    is_alumni 和 sort_order 字段因命名规范不同（camelCase -> snake_case），
    需特殊处理。

    Args:
        member_id: 成员 ID

    Returns:
        JSON: {"success": true, "member": {...}}
              或 404: 成员不存在
    """
    _admin_or_403()
    member = Member.query.get(member_id)
    if not member:
        return jsonify({'error': 'not_found', 'message': '成员不存在'}), 404

    data = request.get_json()
    # 可直接按字段名更新的属性列表（基础字段同名映射）
    updatable = [
        'name', 'avatar', 'role', 'group', 'skills', 'github', 'blog',
        'email', 'bio', 'grade', 'status',
    ]
    for field in updatable:
        if field in data:
            setattr(member, field, data[field])

    # camelCase -> snake_case 特殊字段（前端以 camelCase 发送，需兼容两种命名）
    if 'is_alumni' in data:
        member.is_alumni = data['is_alumni']
    if 'isAlumni' in data:
        member.is_alumni = data['isAlumni']
    if 'sort_order' in data:
        member.sort_order = data['sort_order']
    if 'sortOrder' in data:
        member.sort_order = data['sortOrder']

    db.session.commit()
    return jsonify({'success': True, 'member': member.to_dict()})


@admin_bp.route('/admin/members/<int:member_id>', methods=['DELETE'])
@jwt_required()
def admin_delete_member(member_id):
    """删除成员。

    注意：此操作不可逆，且可能影响关联数据（任务分配记录等）。

    Args:
        member_id: 成员 ID

    Returns:
        JSON: {"success": true, "message": "成员已删除"}
              或 404: 成员不存在
    """
    _admin_or_403()
    member = Member.query.get(member_id)
    if not member:
        return jsonify({'error': 'not_found', 'message': '成员不存在'}), 404

    db.session.delete(member)
    db.session.commit()
    return jsonify({'success': True, 'message': '成员已删除'})


# ═══════════════════════════════════════════════════════════════
# 管理员: 项目 CRUD
# ═══════════════════════════════════════════════════════════════

@admin_bp.route('/admin/projects', methods=['GET'])
@jwt_required()
def admin_list_projects():
    """获取所有项目列表。

    支持筛选:
        search:   按名称和描述搜索
        category: 按分类过滤
        status:   按状态过滤

    默认按开始日期降序排列。

    Returns:
        JSON: 项目完整信息列表（含内部管理字段）
    """
    _admin_or_403()

    search = request.args.get('search')
    category = request.args.get('category')
    status = request.args.get('status')

    query = Project.query

    if search:
        query = query.filter(
            db.or_(
                Project.name.contains(search),
                Project.description.contains(search),
            )
        )
    if category:
        query = query.filter_by(category=category)
    if status:
        query = query.filter_by(status=status)

    projects = query.order_by(Project.start_date.desc(), Project.id).all()
    return jsonify([p.to_dict() for p in projects])


@admin_bp.route('/admin/projects', methods=['POST'])
@jwt_required()
def admin_create_project():
    """创建新项目。

    如果未提供 slug，则从项目名称自动生成（中文转拼音简化处理，去除非字母数字字符）。
    日期字段支持 ISO 8601 格式，通过 _parse_date() 辅助函数解析。

    Request Body:
        {
            "name": "新项目",
            "slug": "new-project",          // 可选，自动生成
            "category": "web",
            "techStack": ["React", "Go"],
            "startDate": "2026-01-01T00:00:00Z",
            ...
        }

    Returns:
        201: {"success": true, "project": {...}}
        400: 项目名称不能为空
    """
    _admin_or_403()
    data = request.get_json()
    if not data or not data.get('name'):
        return jsonify({'error': 'bad_request', 'message': '项目名称不能为空'}), 400

    # 自动生成 slug（从项目名称转换为 URL 友好的标识符）
    slug = data.get('slug')
    if not slug:
        import re
        slug = re.sub(r'[^\w-]', '', data['name'].lower().replace(' ', '-'))
        if not slug:
            slug = f"project-{uuid.uuid4().hex[:8]}"  # 纯中文项目名的兜底方案

    project = Project(
        slug=slug,
        name=data['name'],
        cover_image=data.get('coverImage'),
        category=data.get('category'),
        tech_stack=data.get('techStack', []),
        description=data.get('description'),
        content=data.get('content'),
        github_url=data.get('githubUrl'),
        demo_url=data.get('demoUrl'),
        stars=data.get('stars', 0),
        forks=data.get('forks', 0),
        screenshots=data.get('screenshots', []),
        team=data.get('team', []),
        status=data.get('status', 'active'),
        start_date=_parse_date(data.get('startDate')),
        end_date=_parse_date(data.get('endDate')),
        owner_id=data.get('ownerId'),
    )
    db.session.add(project)
    db.session.commit()

    return jsonify({'success': True, 'project': project.to_dict()}), 201


@admin_bp.route('/admin/projects/<int:project_id>', methods=['GET'])
@jwt_required()
def admin_get_project(project_id):
    """获取单个项目完整详情。

    Returns:
        JSON: 项目完整信息
              或 404: 项目不存在
    """
    _admin_or_403()
    project = Project.query.get(project_id)
    if not project:
        return jsonify({'error': 'not_found', 'message': '项目不存在'}), 404
    return jsonify(project.to_dict())


@admin_bp.route('/admin/projects/<int:project_id>', methods=['PUT'])
@jwt_required()
def admin_update_project(project_id):
    """更新项目信息。

    支持部分更新。前端 camelCase 键名会自动映射到数据库 snake_case 列名。

    Returns:
        JSON: {"success": true, "project": {...}}
              或 404: 项目不存在
    """
    _admin_or_403()
    project = Project.query.get(project_id)
    if not project:
        return jsonify({'error': 'not_found', 'message': '项目不存在'}), 404

    data = request.get_json()
    # 字符串/简单字段的映射
    updatable = {
        'name': 'name',
        'slug': 'slug',
        'coverImage': 'cover_image',
        'category': 'category',
        'description': 'description',
        'content': 'content',
        'githubUrl': 'github_url',
        'demoUrl': 'demo_url',
        'status': 'status',
    }
    for json_key, col in updatable.items():
        if json_key in data:
            setattr(project, col, data[json_key])

    # JSON 数组字段
    for json_key in ['techStack', 'screenshots', 'team']:
        if json_key in data:
            setattr(project, json_key.lower(), data[json_key])

    # 整数和日期字段
    if 'stars' in data:
        project.stars = data['stars']
    if 'forks' in data:
        project.forks = data['forks']
    if 'startDate' in data:
        project.start_date = _parse_date(data['startDate'])
    if 'endDate' in data:
        project.end_date = _parse_date(data['endDate'])
    if 'ownerId' in data:
        project.owner_id = data['ownerId']

    db.session.commit()
    return jsonify({'success': True, 'project': project.to_dict()})


@admin_bp.route('/admin/projects/<int:project_id>', methods=['DELETE'])
@jwt_required()
def admin_delete_project(project_id):
    """删除项目及其关联的里程碑和任务。

    级联删除顺序:
      1. 删除项目下的所有任务
      2. 删除项目下的所有里程碑
      3. 删除项目本身

    注意：此操作不可逆！

    Returns:
        JSON: {"success": true, "message": "项目已删除"}
              或 404: 项目不存在
    """
    _admin_or_403()
    project = Project.query.get(project_id)
    if not project:
        return jsonify({'error': 'not_found', 'message': '项目不存在'}), 404

    # 级联删除：先删除子记录，再删除父记录
    Task.query.filter_by(project_id=project_id).delete()
    Milestone.query.filter_by(project_id=project_id).delete()
    db.session.delete(project)
    db.session.commit()
    return jsonify({'success': True, 'message': '项目已删除'})


# ═══════════════════════════════════════════════════════════════
# 管理员: 里程碑 & 任务
# ═══════════════════════════════════════════════════════════════

@admin_bp.route('/admin/projects/<int:project_id>/milestones', methods=['POST'])
@jwt_required()
def admin_create_milestone(project_id):
    """为指定项目创建里程碑。

    里程碑是任务的分组容器，用于划分项目的开发阶段。

    Request Body:
        {
            "name": "MVP 阶段",
            "description": "完成核心功能",
            "dueDate": "2026-07-31T00:00:00Z",
            "status": "pending",
            "sortOrder": 0
        }

    Returns:
        201: {"success": true, "milestone": {...}}
        400: 里程碑名称不能为空
        404: 项目不存在
    """
    _admin_or_403()
    project = Project.query.get(project_id)
    if not project:
        return jsonify({'error': 'not_found', 'message': '项目不存在'}), 404

    data = request.get_json()
    if not data or not data.get('name'):
        return jsonify({'error': 'bad_request', 'message': '里程碑名称不能为空'}), 400

    milestone = Milestone(
        project_id=project_id,
        name=data['name'],
        description=data.get('description'),
        due_date=_parse_date(data.get('dueDate')),
        status=data.get('status', 'pending'),
        sort_order=data.get('sortOrder', 0),
    )
    db.session.add(milestone)
    db.session.commit()

    return jsonify({'success': True, 'milestone': milestone.to_dict()}), 201


@admin_bp.route('/admin/projects/<int:project_id>/tasks', methods=['POST'])
@jwt_required()
def admin_create_task(project_id):
    """为指定项目创建任务。

    任务可关联到里程碑（可选）和负责人（可选）。

    Request Body:
        {
            "title": "实现用户登录",
            "description": "...",
            "milestoneId": 1,        // 可选
            "assigneeId": 1,         // 可选
            "status": "todo",
            "priority": "high",
            "dueDate": "2026-07-15T00:00:00Z",
            "sortOrder": 0
        }

    Returns:
        201: {"success": true, "task": {...}}
        400: 任务标题不能为空
        404: 项目不存在
    """
    _admin_or_403()
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


# ═══════════════════════════════════════════════════════════════
# 管理员: 获奖荣誉 CRUD
# ═══════════════════════════════════════════════════════════════

@admin_bp.route('/admin/awards', methods=['GET'])
@jwt_required()
def admin_list_awards():
    """获取所有获奖记录。

    可选筛选: level (national/provincial/school/other)
    默认按获奖日期降序、排序序号升序排列。

    Returns:
        JSON: 获奖记录列表
    """
    _admin_or_403()

    level = request.args.get('level')
    query = Award.query
    if level:
        query = query.filter_by(level=level)

    awards = query.order_by(Award.date.desc(), Award.sort_order, Award.id).all()
    return jsonify([a.to_dict() for a in awards])


@admin_bp.route('/admin/awards', methods=['POST'])
@jwt_required()
def admin_create_award():
    """创建新获奖记录。

    slug 自动从奖项名称生成（如果未提供）。
    支持关联项目 slug（related_project 字段）。

    Returns:
        201: {"success": true, "award": {...}}
        400: 奖项名称不能为空
    """
    _admin_or_403()
    data = request.get_json()
    if not data or not data.get('name'):
        return jsonify({'error': 'bad_request', 'message': '奖项名称不能为空'}), 400

    import re
    # 自动生成 slug
    slug = data.get('slug')
    if not slug:
        slug = re.sub(r'[^\w-]', '', data['name'].lower().replace(' ', '-'))[:80]
        if not slug:
            slug = f"award-{uuid.uuid4().hex[:8]}"

    award = Award(
        slug=slug,
        name=data['name'],
        level=data.get('level', 'other'),
        category=data.get('category'),
        winner=data.get('winner', ''),
        issuer=data.get('issuer'),
        date=data.get('date'),
        description=data.get('description'),
        certificate_images=data.get('certificateImages', []),
        related_project=data.get('relatedProject'),
        sort_order=data.get('sortOrder', 0),
    )
    db.session.add(award)
    db.session.commit()

    return jsonify({'success': True, 'award': award.to_dict()}), 201


@admin_bp.route('/admin/awards/<int:award_id>', methods=['GET'])
@jwt_required()
def admin_get_award(award_id):
    """获取单个获奖详情。

    Returns:
        JSON: 获奖完整信息
              或 404: 获奖记录不存在
    """
    _admin_or_403()
    award = Award.query.get(award_id)
    if not award:
        return jsonify({'error': 'not_found', 'message': '奖项不存在'}), 404
    return jsonify(award.to_dict())


@admin_bp.route('/admin/awards/<int:award_id>', methods=['PUT'])
@jwt_required()
def admin_update_award(award_id):
    """更新获奖信息。

    支持部分更新。certificateImages 和 relatedProject 两个字段
    因命名规范不同需特殊处理。

    Returns:
        JSON: {"success": true, "award": {...}}
              或 404: 获奖记录不存在
    """
    _admin_or_403()
    award = Award.query.get(award_id)
    if not award:
        return jsonify({'error': 'not_found', 'message': '奖项不存在'}), 404

    data = request.get_json()
    updatable = ['name', 'slug', 'level', 'category', 'winner', 'issuer',
                 'date', 'description', 'related_project', 'sort_order']
    for field in updatable:
        if field in data:
            setattr(award, field, data[field])

    # 处理 camelCase -> snake_case 的特殊字段
    if 'certificateImages' in data:
        award.certificate_images = data['certificateImages']
    if 'relatedProject' in data:
        award.related_project = data['relatedProject']
    if 'sortOrder' in data:
        award.sort_order = data['sortOrder']

    db.session.commit()
    return jsonify({'success': True, 'award': award.to_dict()})


@admin_bp.route('/admin/awards/<int:award_id>', methods=['DELETE'])
@jwt_required()
def admin_delete_award(award_id):
    """删除获奖记录。

    Returns:
        JSON: {"success": true, "message": "奖项已删除"}
              或 404: 获奖记录不存在
    """
    _admin_or_403()
    award = Award.query.get(award_id)
    if not award:
        return jsonify({'error': 'not_found', 'message': '奖项不存在'}), 404

    db.session.delete(award)
    db.session.commit()
    return jsonify({'success': True, 'message': '奖项已删除'})


# ═══════════════════════════════════════════════════════════════
# 管理员: 博客 CRUD
# ═══════════════════════════════════════════════════════════════

@admin_bp.route('/admin/blogs', methods=['GET'])
@jwt_required()
def admin_list_blogs():
    """获取所有博客文章（含草稿/未发布）。

    与公开 /api/blogs 的区别：返回所有文章（不限 is_published）。

    可选筛选: category
    默认按发布日期降序、ID 降序排列。

    Returns:
        JSON: 文章列表（含草稿）
    """
    _admin_or_403()

    category = request.args.get('category')
    query = BlogPost.query
    if category:
        query = query.filter_by(category=category)

    posts = query.order_by(BlogPost.date.desc(), BlogPost.id.desc()).all()
    return jsonify([p.to_dict() for p in posts])


@admin_bp.route('/admin/blogs', methods=['POST'])
@jwt_required()
def admin_create_blog():
    """创建新博客文章。

    作者信息支持两种方式:
      1. authorName/authorAvatar: 直接填写作者名和头像 URL
      2. author: {name, avatar}: 嵌套对象形式（兼容前端组件格式）

    slug 自动从标题生成。

    Returns:
        201: {"success": true, "blog": {...}}
        400: 标题不能为空
    """
    _admin_or_403()
    data = request.get_json()
    if not data or not data.get('title'):
        return jsonify({'error': 'bad_request', 'message': '标题不能为空'}), 400

    import re
    slug = data.get('slug')
    if not slug:
        slug = re.sub(r'[^\w-]', '', data['title'].lower().replace(' ', '-'))[:80]
        if not slug:
            slug = f"post-{uuid.uuid4().hex[:8]}"

    post = BlogPost(
        slug=slug,
        title=data['title'],
        excerpt=data.get('excerpt'),
        content=data.get('content'),
        category=data.get('category', 'tech'),
        tags=data.get('tags', []),
        # 作者信息支持两种格式：直接字段或嵌套对象
        author_name=data.get('authorName') or (data.get('author') or {}).get('name'),
        author_avatar=data.get('authorAvatar') or (data.get('author') or {}).get('avatar'),
        author_id=data.get('authorId'),
        date=data.get('date'),
        cover_image=data.get('coverImage'),
        is_published=data.get('isPublished', True),
    )
    db.session.add(post)
    db.session.commit()

    return jsonify({'success': True, 'blog': post.to_dict()}), 201


@admin_bp.route('/admin/blogs/<int:blog_id>', methods=['GET'])
@jwt_required()
def admin_get_blog(blog_id):
    """获取单篇文章详情。

    Returns:
        JSON: 文章完整信息
              或 404: 文章不存在
    """
    _admin_or_403()
    post = BlogPost.query.get(blog_id)
    if not post:
        return jsonify({'error': 'not_found', 'message': '文章不存在'}), 404
    return jsonify(post.to_dict())


@admin_bp.route('/admin/blogs/<int:blog_id>', methods=['PUT'])
@jwt_required()
def admin_update_blog(blog_id):
    """更新文章。

    支持部分更新和草稿/发布状态切换。

    Returns:
        JSON: {"success": true, "blog": {...}}
              或 404: 文章不存在
    """
    _admin_or_403()
    post = BlogPost.query.get(blog_id)
    if not post:
        return jsonify({'error': 'not_found', 'message': '文章不存在'}), 404

    data = request.get_json()
    # 可直接映射的字段
    updatable = ['title', 'slug', 'excerpt', 'content', 'category',
                 'date', 'cover_image', 'is_published']
    for field in updatable:
        if field in data:
            setattr(post, field, data[field])

    # 需要特殊处理的字段
    if 'tags' in data:
        post.tags = data['tags']
    if 'authorName' in data:
        post.author_name = data['authorName']
    if 'authorAvatar' in data:
        post.author_avatar = data['authorAvatar']
    if 'authorId' in data:
        post.author_id = data['authorId']
    if 'coverImage' in data:
        post.cover_image = data['coverImage']
    if 'isPublished' in data:
        post.is_published = data['isPublished']

    db.session.commit()
    return jsonify({'success': True, 'blog': post.to_dict()})


@admin_bp.route('/admin/blogs/<int:blog_id>', methods=['DELETE'])
@jwt_required()
def admin_delete_blog(blog_id):
    """删除文章。

    Returns:
        JSON: {"success": true, "message": "文章已删除"}
              或 404: 文章不存在
    """
    _admin_or_403()
    post = BlogPost.query.get(blog_id)
    if not post:
        return jsonify({'error': 'not_found', 'message': '文章不存在'}), 404

    db.session.delete(post)
    db.session.commit()
    return jsonify({'success': True, 'message': '文章已删除'})


# ═══════════════════════════════════════════════════════════════
# 管理员: 站点配置
# ═══════════════════════════════════════════════════════════════

@admin_bp.route('/admin/config', methods=['GET'])
@jwt_required()
def admin_get_config():
    """获取所有站点配置（含系统内部配置）。

    与公开 /api/config 的区别：返回所有配置（包括 'system' key）。

    Returns:
        JSON: {"hero": {...}, "about": {...}, "sections": {...}, "system": {...}, ...}
    """
    _admin_or_403()
    configs = SiteConfig.query.all()
    return jsonify({c.config_key: c.config_value for c in configs})


@admin_bp.route('/admin/config', methods=['PUT'])
@jwt_required()
def admin_update_config():
    """批量更新站点配置。

    请求体为键值对字典，存在则更新，不存在则创建。
    这是后台「站点设置」页面的核心接口。

    Request Body:
        {
            "hero": {...},
            "footer": {...},
            ...
        }

    Returns:
        JSON: {"success": true, "message": "配置已更新"}
        400: 请求体为空
    """
    _admin_or_403()
    data = request.get_json()
    if not data:
        return jsonify({'error': 'bad_request', 'message': '请求体为空'}), 400

    for key, value in data.items():
        cfg = SiteConfig.query.filter_by(config_key=key).first()
        if cfg:
            cfg.config_value = value    # 更新已有配置
        else:
            db.session.add(SiteConfig(config_key=key, config_value=value))  # 创建新配置

    db.session.commit()
    return jsonify({'success': True, 'message': '配置已更新'})


@admin_bp.route('/admin/config/<key>', methods=['PUT'])
@jwt_required()
def admin_update_config_key(key):
    """更新单个配置项。

    适用于只修改某一个配置的场景（如切换某个模块的显隐开关）。

    Request Body:
        {"value": <任意 JSON 值>}

    Args:
        key: 配置键名（如 'hero', 'sections', 'footer'）

    Returns:
        JSON: {"success": true, "config": {...}}
        400: 缺少 value 字段
    """
    _admin_or_403()
    data = request.get_json()
    if data is None or 'value' not in data:
        return jsonify({'error': 'bad_request', 'message': '缺少 value 字段'}), 400

    cfg = SiteConfig.query.filter_by(config_key=key).first()
    if cfg:
        cfg.config_value = data['value']
    else:
        cfg = SiteConfig(config_key=key, config_value=data['value'])
        db.session.add(cfg)

    db.session.commit()
    return jsonify({'success': True, 'config': cfg.to_dict()})


# ═══════════════════════════════════════════════════════════════
# 管理员: CMS 页面 CRUD
# ═══════════════════════════════════════════════════════════════

@admin_bp.route('/admin/pages', methods=['GET'])
@jwt_required()
def admin_list_pages():
    """获取所有 CMS 页面列表。

    Returns:
        JSON: 页面列表（含完整 content JSON）
    """
    _admin_or_403()
    pages = Page.query.all()
    return jsonify([p.to_dict() for p in pages])


@admin_bp.route('/admin/pages', methods=['POST'])
@jwt_required()
def admin_create_page():
    """创建新 CMS 页面。

    slug 和 title 为必填，content 默认为空对象。

    Returns:
        201: {"success": true, "page": {...}}
        400: slug/title 为空，或 slug 已存在
    """
    _admin_or_403()
    data = request.get_json()
    if not data or not data.get('slug') or not data.get('title'):
        return jsonify({'error': 'bad_request', 'message': 'slug 和 title 不能为空'}), 400

    # 防止重复 slug
    if Page.query.filter_by(slug=data['slug']).first():
        return jsonify({'error': 'conflict', 'message': f'页面 {data["slug"]} 已存在'}), 400

    page = Page(
        slug=data['slug'],
        title=data['title'],
        content=data.get('content', {}),
    )
    db.session.add(page)
    db.session.commit()

    return jsonify({'success': True, 'page': page.to_dict()}), 201


@admin_bp.route('/admin/pages/<slug>', methods=['GET'])
@jwt_required()
def admin_get_page(slug):
    """根据 slug 获取页面。

    Returns:
        JSON: 页面完整信息
              或 404: 页面不存在
    """
    _admin_or_403()
    page = Page.query.filter_by(slug=slug).first()
    if not page:
        return jsonify({'error': 'not_found', 'message': f'页面 {slug} 不存在'}), 404
    return jsonify(page.to_dict())


@admin_bp.route('/admin/pages/<slug>', methods=['PUT'])
@jwt_required()
def admin_update_page(slug):
    """创建或更新页面（Upsert 模式）。

    如果 slug 对应的页面存在，则更新 title 和 content；
    如果不存在，则创建新页面。

    Returns:
        JSON: {"success": true, "page": {...}}
        400: 新页面缺少 title
    """
    _admin_or_403()
    data = request.get_json()
    page = Page.query.filter_by(slug=slug).first()

    if page:
        # 更新已有页面（支持部分更新）
        if 'title' in data:
            page.title = data['title']
        if 'content' in data:
            page.content = data['content']
    else:
        # 创建新页面
        if not data.get('title'):
            return jsonify({'error': 'bad_request', 'message': 'title 不能为空'}), 400
        page = Page(
            slug=slug,
            title=data['title'],
            content=data.get('content', {}),
        )
        db.session.add(page)

    db.session.commit()
    return jsonify({'success': True, 'page': page.to_dict()})


@admin_bp.route('/admin/pages/<slug>', methods=['DELETE'])
@jwt_required()
def admin_delete_page(slug):
    """删除 CMS 页面。

    Returns:
        JSON: {"success": true, "message": "页面已删除"}
              或 404: 页面不存在
    """
    _admin_or_403()
    page = Page.query.filter_by(slug=slug).first()
    if not page:
        return jsonify({'error': 'not_found', 'message': f'页面 {slug} 不存在'}), 404

    db.session.delete(page)
    db.session.commit()
    return jsonify({'success': True, 'message': '页面已删除'})


# ═══════════════════════════════════════════════════════════════
# 管理员: 招新申请管理
# ═══════════════════════════════════════════════════════════════

@admin_bp.route('/admin/applications', methods=['GET'])
@jwt_required()
def admin_list_applications():
    """获取所有招新申请列表。

    可选筛选:
        status:  按审核状态筛选（pending/approved/rejected）
        session: 按招新批次筛选（如 "2026-spring"）

    默认按提交时间降序排列。

    Returns:
        JSON: 申请记录列表
    """
    _admin_or_403()

    status = request.args.get('status')
    session = request.args.get('session')

    query = Application.query

    if status:
        query = query.filter_by(status=status)
    if session:
        query = query.filter_by(session=session)

    apps = query.order_by(Application.created_at.desc()).all()
    return jsonify([a.to_dict() for a in apps])


@admin_bp.route('/admin/applications/<int:app_id>', methods=['PATCH'])
@jwt_required()
def admin_update_application(app_id):
    """审核招新申请。

    更新申请状态，当状态变为 approved（通过）或 rejected（拒绝）时，
    自动记录处理时间 processed_at。

    Request Body:
        {"status": "approved", "admin_note": "技术基础扎实，通过"}

    Returns:
        JSON: {"success": true, "application": {...}}
        404: 申请不存在
    """
    _admin_or_403()
    app = Application.query.get(app_id)
    if not app:
        return jsonify({'error': 'not_found', 'message': '申请不存在'}), 404

    data = request.get_json()
    if 'status' in data:
        app.status = data['status']
        # 审核通过或拒绝时记录处理时间
        if data['status'] in ('approved', 'rejected'):
            app.processed_at = datetime.now(timezone.utc)
    if 'admin_note' in data:
        app.admin_note = data['admin_note']

    db.session.commit()
    return jsonify({'success': True, 'application': app.to_dict()})


# ═══════════════════════════════════════════════════════════════
# 管理员: 联系我们留言管理
# ═══════════════════════════════════════════════════════════════

@admin_bp.route('/admin/contact-messages', methods=['GET'])
@jwt_required()
def admin_list_contacts():
    """获取所有联系我们留言列表。

    可选筛选: status (unread/read/replied)
    默认按提交时间降序排列。

    Returns:
        JSON: 留言列表
    """
    _admin_or_403()

    status = request.args.get('status')
    query = ContactMessage.query
    if status:
        query = query.filter_by(status=status)

    messages = query.order_by(ContactMessage.created_at.desc()).all()
    return jsonify([m.to_dict() for m in messages])


@admin_bp.route('/admin/contact-messages/<int:msg_id>', methods=['PATCH'])
@jwt_required()
def admin_update_contact(msg_id):
    """处理留言（标记已读、回复、添加备注）。

    业务逻辑:
      - 标记为 'read' 时自动记录首次阅读时间
      - 设置 reply 时自动将状态改为 'replied' 并记录回复时间
      - admin_note 用于内部备注（不对外展示）

    Request Body:
        {"status": "replied", "reply": "感谢你的留言...", "admin_note": "..."}

    Returns:
        JSON: {"success": true, "message": {...}}
        404: 留言不存在
    """
    _admin_or_403()
    msg = ContactMessage.query.get(msg_id)
    if not msg:
        return jsonify({'error': 'not_found', 'message': '留言不存在'}), 404

    data = request.get_json()
    if 'status' in data:
        msg.status = data['status']
        if data['status'] == 'read' and not msg.read_at:
            msg.read_at = datetime.now(timezone.utc)  # 首次阅读时间
    if 'reply' in data:
        msg.reply = data['reply']
        msg.status = 'replied'
        msg.replied_at = datetime.now(timezone.utc)   # 回复时间
    if 'admin_note' in data:
        msg.admin_note = data['admin_note']

    db.session.commit()
    return jsonify({'success': True, 'message': msg.to_dict()})


# ═══════════════════════════════════════════════════════════════
# 管理员: 数据导入 / 导出
# ═══════════════════════════════════════════════════════════════

@admin_bp.route('/admin/export', methods=['GET'])
@jwt_required()
def admin_export():
    """导出全站数据为 JSON 文件。

    导出内容包括:
      - config:  站点配置
      - pages:   CMS 页面
      - members: 成员列表
      - projects: 项目列表
      - awards:  获奖记录
      - blogs:   博客文章

    用途：数据备份、迁移、或环境间数据同步。

    Returns:
        JSON: 包含所有数据的完整导出对象
    """
    _admin_or_403()

    def serialize(obj):
        """序列化辅助：将 datetime 转为 ISO 格式字符串。"""
        if isinstance(obj, datetime):
            return obj.isoformat()
        return obj

    data = {
        'version': 2,  # 导出格式版本号（用于兼容性判断）
        'exported_at': datetime.now(timezone.utc).isoformat(),
        'config': {c.config_key: c.config_value for c in SiteConfig.query.all()},
        'pages': [{'slug': p.slug, 'title': p.title, 'content': p.content} for p in Page.query.all()],
        'members': [],
        'projects': [],
        'awards': [],
        'blogs': [],
    }

    # ── 导出成员 ──
    for m in Member.query.order_by(Member.sort_order, Member.id).all():
        data['members'].append({
            'name': m.name, 'avatar': m.avatar, 'role': m.role,
            'group': m.group, 'skills': m.skills, 'github': m.github,
            'blog': m.blog, 'email': m.email, 'bio': m.bio,
            'grade': m.grade, 'is_alumni': m.is_alumni,
            'status': m.status, 'sort_order': m.sort_order,
        })

    # ── 导出项目 ──
    for p in Project.query.order_by(Project.id).all():
        data['projects'].append({
            'slug': p.slug, 'name': p.name, 'cover_image': p.cover_image,
            'category': p.category, 'tech_stack': p.tech_stack,
            'description': p.description, 'content': p.content,
            'github_url': p.github_url, 'demo_url': p.demo_url,
            'stars': p.stars, 'forks': p.forks,
            'screenshots': p.screenshots, 'team': p.team,
            'status': p.status,
            'start_date': p.start_date.isoformat() if p.start_date else None,
            'end_date': p.end_date.isoformat() if p.end_date else None,
        })

    # ── 导出获奖 ──
    for a in Award.query.order_by(Award.sort_order, Award.id).all():
        data['awards'].append({
            'slug': a.slug, 'name': a.name, 'level': a.level,
            'category': a.category, 'winner': a.winner,
            'issuer': a.issuer, 'date': a.date,
            'description': a.description,
            'certificate_images': a.certificate_images,
            'related_project': a.related_project,
        })

    # ── 导出博客 ──
    for b in BlogPost.query.order_by(BlogPost.id).all():
        data['blogs'].append({
            'slug': b.slug, 'title': b.title, 'excerpt': b.excerpt,
            'content': b.content, 'category': b.category,
            'tags': b.tags, 'author_name': b.author_name,
            'author_avatar': b.author_avatar, 'date': b.date,
            'cover_image': b.cover_image,
            'is_published': b.is_published,
        })

    return jsonify(data)


@admin_bp.route('/admin/import', methods=['POST'])
@jwt_required()
def admin_import():
    """从 JSON 数据导入站点数据。

    支持两种导入模式（通过 ?mode= 查询参数指定）:
      - replace（默认）: 清空现有数据后导入 → 适合恢复备份
      - merge:           保留现有数据，跳过重复项 → 适合合并数据

    重复判断规则:
      - config:  按 config_key 判断
      - pages:   按 slug 判断
      - members: 按 name 判断
      - projects: 按 slug 判断
      - awards:  按 slug 判断
      - blogs:   按 slug 判断

    Request Body: 与 export 接口返回格式一致的 JSON 对象

    Returns:
        200: {"success": true, "message": "导入完成：共 N 条数据", "stats": {...}, "mode": "..."}
        400: 请求体为空
        500: 导入过程异常（如数据格式错误）
    """
    _admin_or_403()
    data = request.get_json()
    if not data:
        return jsonify({'error': 'bad_request', 'message': '请求体为空'}), 400

    mode = request.args.get('mode', 'replace')  # 导入模式
    stats = {'members': 0, 'projects': 0, 'awards': 0, 'blogs': 0, 'pages': 0, 'config': 0}

    try:
        # ── Replace 模式：清空现有数据 ──
        if mode == 'replace':
            # 删除顺序按依赖关系逆序（先删子表，再删父表）
            BlogPost.query.delete()
            Award.query.delete()
            Task.query.delete()
            Milestone.query.delete()
            Project.query.delete()
            Member.query.delete()
            Page.query.delete()
            # 保留 site_config 表中的系统配置
            SiteConfig.query.filter(
                ~SiteConfig.config_key.in_(['system'])
            ).delete(synchronize_session=False)

        # ── 导入配置 ──
        if data.get('config'):
            for key, value in data['config'].items():
                if mode == 'merge' and SiteConfig.query.filter_by(config_key=key).first():
                    continue  # Merge 模式下跳过已存在的配置
                existing = SiteConfig.query.filter_by(config_key=key).first()
                if existing:
                    existing.config_value = value
                else:
                    db.session.add(SiteConfig(config_key=key, config_value=value))
                stats['config'] += 1

        # ── 导入页面 ──
        if data.get('pages'):
            for p_data in data['pages']:
                if mode == 'merge' and Page.query.filter_by(slug=p_data['slug']).first():
                    continue
                existing = Page.query.filter_by(slug=p_data['slug']).first()
                if existing:
                    existing.title = p_data['title']
                    existing.content = p_data.get('content', {})
                else:
                    db.session.add(Page(
                        slug=p_data['slug'], title=p_data['title'],
                        content=p_data.get('content', {}),
                    ))
                stats['pages'] += 1

        # ── 导入成员 ──
        if data.get('members'):
            for m_data in data['members']:
                if mode == 'merge' and Member.query.filter_by(name=m_data['name']).first():
                    continue
                db.session.add(Member(
                    name=m_data['name'], avatar=m_data.get('avatar'),
                    role=m_data.get('role'), group=m_data.get('group'),
                    skills=m_data.get('skills', []), github=m_data.get('github'),
                    blog=m_data.get('blog'), email=m_data.get('email'),
                    bio=m_data.get('bio'), grade=m_data.get('grade'),
                    is_alumni=m_data.get('is_alumni', False),
                    status=m_data.get('status', 'active'),
                    sort_order=m_data.get('sort_order', 0),
                ))
                stats['members'] += 1

        # ── 导入项目 ──
        if data.get('projects'):
            for p_data in data['projects']:
                if mode == 'merge' and Project.query.filter_by(slug=p_data['slug']).first():
                    continue
                db.session.add(Project(
                    slug=p_data['slug'], name=p_data['name'],
                    cover_image=p_data.get('cover_image'),
                    category=p_data.get('category'),
                    tech_stack=p_data.get('tech_stack', []),
                    description=p_data.get('description'),
                    content=p_data.get('content'),
                    github_url=p_data.get('github_url'),
                    demo_url=p_data.get('demo_url'),
                    stars=p_data.get('stars', 0),
                    forks=p_data.get('forks', 0),
                    screenshots=p_data.get('screenshots', []),
                    team=p_data.get('team', []),
                    status=p_data.get('status', 'active'),
                    start_date=_parse_date(p_data.get('start_date')),
                    end_date=_parse_date(p_data.get('end_date')),
                ))
                stats['projects'] += 1

        # ── 导入获奖 ──
        if data.get('awards'):
            for a_data in data['awards']:
                if mode == 'merge' and Award.query.filter_by(slug=a_data['slug']).first():
                    continue
                db.session.add(Award(
                    slug=a_data['slug'], name=a_data['name'],
                    level=a_data.get('level', 'other'),
                    category=a_data.get('category'),
                    winner=a_data.get('winner', ''),
                    issuer=a_data.get('issuer'),
                    date=a_data.get('date'),
                    description=a_data.get('description'),
                    certificate_images=a_data.get('certificate_images', []),
                    related_project=a_data.get('related_project'),
                ))
                stats['awards'] += 1

        # ── 导入博客 ──
        if data.get('blogs'):
            for b_data in data['blogs']:
                if mode == 'merge' and BlogPost.query.filter_by(slug=b_data['slug']).first():
                    continue
                db.session.add(BlogPost(
                    slug=b_data['slug'], title=b_data['title'],
                    excerpt=b_data.get('excerpt'), content=b_data.get('content'),
                    category=b_data.get('category', 'tech'),
                    tags=b_data.get('tags', []),
                    author_name=b_data.get('author_name'),
                    author_avatar=b_data.get('author_avatar'),
                    date=b_data.get('date'),
                    cover_image=b_data.get('cover_image'),
                    is_published=b_data.get('is_published', True),
                ))
                stats['blogs'] += 1

        db.session.commit()

        total = sum(stats.values())
        return jsonify({
            'success': True,
            'message': f'导入完成：共 {total} 条数据',
            'stats': stats,
            'mode': mode,
        })

    except Exception as e:
        db.session.rollback()
        return jsonify({
            'error': 'import_failed',
            'message': f'导入失败: {str(e)}',
        }), 500


# ═══════════════════════════════════════════════════════════════
# 通用辅助函数
# ═══════════════════════════════════════════════════════════════

def _parse_date(value):
    """将 ISO 8601 日期字符串解析为 datetime 对象。

    支持带时区偏移的格式（如 '2026-01-01T00:00:00Z' 或 '2026-01-01T00:00:00+08:00'）。

    Args:
        value: ISO 8601 格式的日期字符串

    Returns:
        datetime | None: 解析成功返回 datetime 对象，失败或输入为空返回 None
    """
    if not value:
        return None
    try:
        # 将 'Z' 替换为 '+00:00' 以兼容 Python 的 fromisoformat
        return datetime.fromisoformat(value.replace('Z', '+00:00'))
    except (ValueError, TypeError):
        return None
