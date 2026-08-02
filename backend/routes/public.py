"""星雨作坊 CMS — 公开 API 路由

本模块包含所有无需认证即可访问的公开 API 端点，全部挂载在 /api/* 下。

端点分类:
  - 站点配置    GET  /api/config              — 获取站点配置
  - CMS 页面    GET  /api/pages               — 获取页面列表
                GET  /api/pages/<slug>        — 获取单页内容
  - 招新申请    POST /api/applications         — 提交招新申请（含频率限制）
  - 联系我们    POST /api/contact              — 提交留言（含频率限制）
  - 成员展示    GET  /api/members              — 获取活跃成员列表
                GET  /api/members/<id>         — 获取成员详情
  - 项目展示    GET  /api/projects             — 获取项目列表
                GET  /api/projects/<slug>      — 获取项目详情
                GET  /api/projects/<id>/milestones — 获取项目里程碑
  - 获奖荣誉    GET  /api/awards               — 获取获奖列表
                GET  /api/awards/<slug>        — 获取获奖详情
  - 博客文章    GET  /api/blogs                — 获取已发布文章列表
                GET  /api/blogs/<slug>         — 获取文章详情
  - 认证        POST /api/auth/login           — 统一登录（管理员 + 成员）
                POST /api/auth/register        — 成员注册
"""

from datetime import datetime, timezone, timedelta
from flask import Blueprint, jsonify, request, current_app
from flask_jwt_extended import create_access_token
from models import (
    db, SiteConfig, Page, Application, ContactMessage,
    Member, Project, Milestone, Award, BlogPost, AdminUser,
)

public_bp = Blueprint('public', __name__)


# ═══════════════════════════════════════════════════════════════
# 站点配置
# ═══════════════════════════════════════════════════════════════

@public_bp.route('/config', methods=['GET'])
def get_config():
    """获取所有公开站点配置。

    将 site_config 表中所有配置项以键值对形式返回。
    自动过滤掉 key 为 'system' 的内部配置（不暴露给前端）。

    Returns:
        JSON: {"hero": {...}, "about": {...}, "footer": {...}, ...}
              或 404: {"error": "not_found", "message": "站点配置不存在"}
    """
    configs = SiteConfig.query.all()
    if not configs:
        return jsonify({'error': 'not_found', 'message': '站点配置不存在'}), 404
    result = {c.config_key: c.config_value for c in configs}
    result.pop('system', None)  # 移除系统内部配置
    return jsonify(result)


# ═══════════════════════════════════════════════════════════════
# CMS 页面
# ═══════════════════════════════════════════════════════════════

@public_bp.route('/pages', methods=['GET'])
def get_pages():
    """获取所有 CMS 页面列表（仅含 slug 和 title 供导航使用）。

    Returns:
        JSON: [{"slug": "about", "title": "关于我们", "updated_at": "..."}, ...]
    """
    pages = Page.query.all()
    return jsonify([
        {
            'slug': p.slug,
            'title': p.title,
            'updated_at': p.updated_at.isoformat() if p.updated_at else None,
        }
        for p in pages
    ])


@public_bp.route('/pages/<slug>', methods=['GET'])
def get_page(slug):
    """根据 slug 获取单个 CMS 页面的完整内容。

    Args:
        slug: 页面标识符（如 'about', 'recruitment', 'onboarding'）

    Returns:
        JSON: 完整页面数据（含 id, slug, title, content, updated_at）
              或 404: 页面不存在
    """
    page = Page.query.filter_by(slug=slug).first()
    if not page:
        return jsonify({'error': 'not_found', 'message': f'页面 {slug} 不存在'}), 404
    return jsonify(page.to_dict())


# ═══════════════════════════════════════════════════════════════
# 招新申请
# ═══════════════════════════════════════════════════════════════

@public_bp.route('/applications', methods=['POST'])
def submit_application():
    """提交招新申请表。

    包含以下校验和安全措施：
      1. 必填字段验证（姓名、学号、年级专业、手机、邮箱、意向组、动机）
      2. 申请动机最少 10 个字
      3. 频率限制：同一 IP/邮箱/手机号在 N 分钟内仅可提交一次（默认 10 分钟）

    Request Body:
        {
            "name": "张三",
            "student_id": "2025001",
            "grade_major": "2025级 计算机科学",
            "phone": "13800000000",
            "email": "zhangsan@example.com",
            "group_id": "dev",
            "group_name": "逐云组",
            "motivation": "我热爱编程...",
            "github_url": "https://github.com/...",     // 可选
            "portfolio_url": "https://...",             // 可选
            "experience": "...",                         // 可选
            "session": "2026-spring"                     // 可选：招新批次
        }

    Returns:
        201: {"success": true, "message": "申请已提交", "id": 1}
        400: 缺少必填字段或申请动机不足
        429: 频率限制触发
    """
    data = request.get_json()
    if not data:
        return jsonify({'error': 'bad_request', 'message': '请求体为空'}), 400

    # ── 必填字段验证 ──
    required = ['name', 'student_id', 'grade_major', 'phone', 'email',
                'group_id', 'group_name', 'motivation']
    missing = [f for f in required if not data.get(f)]
    if missing:
        return jsonify({
            'error': 'validation_error',
            'message': f'缺少必填字段: {", ".join(missing)}',
        }), 400

    # ── 动机字数验证 ──
    if len(data.get('motivation', '')) < 10:
        return jsonify({
            'error': 'validation_error',
            'message': '申请动机至少 10 个字',
        }), 400

    # ── 频率限制：同一 IP/邮箱/手机号在 N 分钟内只能提交一次 ──
    limit_minutes = current_app.config.get('APPLICATION_RATE_LIMIT_MINUTES', 10)
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=limit_minutes)
    ip = request.remote_addr

    dup = Application.query.filter(
        db.or_(
            Application.ip_address == ip,
            Application.email == data.get('email'),
            Application.phone == data.get('phone'),
        ),
        Application.created_at >= cutoff,
    ).first()
    if dup:
        return jsonify({
            'error': 'rate_limit',
            'message': f'请勿重复提交，请 {limit_minutes} 分钟后再试',
        }), 429

    # ── 创建申请记录 ──
    app_record = Application(
        name=data['name'],
        student_id=data['student_id'],
        grade_major=data['grade_major'],
        phone=data['phone'],
        email=data['email'],
        group_id=data['group_id'],
        group_name=data['group_name'],
        github_url=data.get('github_url'),
        portfolio_url=data.get('portfolio_url'),
        experience=data.get('experience'),
        motivation=data['motivation'],
        session=data.get('session'),
        ip_address=ip,
    )
    db.session.add(app_record)
    db.session.commit()

    return jsonify({
        'success': True,
        'message': '申请已提交',
        'id': app_record.id,
    }), 201


# ═══════════════════════════════════════════════════════════════
# 联系我们
# ═══════════════════════════════════════════════════════════════

@public_bp.route('/contact', methods=['POST'])
def submit_contact():
    """提交联系我们留言。

    支持实名和匿名两种模式：
      - 实名模式：需提供姓名、邮箱、主题、留言内容
      - 匿名模式：仅需主题和留言内容

    安全措施：
      - 留言内容至少 5 个字
      - IP 频率限制：同一 IP 在 5 分钟内仅可提交一次

    Request Body:
        {
            "name": "张三",                // 匿名时可选
            "email": "zhangsan@example.com", // 匿名时可选
            "phone": "13800000000",          // 可选
            "subject": "关于招新咨询",
            "message": "我想了解一下...",
            "is_anonymous": false
        }

    Returns:
        201: {"success": true, "message": "留言已提交，我们会尽快回复"}
        400: 缺少必填字段或留言内容不足
        429: IP 频率限制触发
    """
    data = request.get_json()
    if not data:
        return jsonify({'error': 'bad_request', 'message': '请求体为空'}), 400

    is_anonymous = data.get('is_anonymous', False)

    # ── 根据是否匿名进行不同的字段校验 ──
    if not is_anonymous:
        required = ['name', 'email', 'subject', 'message']
        missing = [f for f in required if not data.get(f)]
        if missing:
            return jsonify({
                'error': 'validation_error',
                'message': f'缺少必填字段: {", ".join(missing)}',
            }), 400
    else:
        if not data.get('subject') or not data.get('message'):
            return jsonify({
                'error': 'validation_error',
                'message': '请填写主题和留言内容',
            }), 400

    # ── 留言字数验证 ──
    if len(data.get('message', '')) < 5:
        return jsonify({
            'error': 'validation_error',
            'message': '留言内容至少 5 个字',
        }), 400

    # ── IP 频率限制（5 分钟）──
    limit_minutes = 5
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=limit_minutes)
    ip = request.remote_addr

    dup = ContactMessage.query.filter(
        ContactMessage.ip_address == ip,
        ContactMessage.created_at >= cutoff,
    ).first()
    if dup:
        return jsonify({
            'error': 'rate_limit',
            'message': f'请勿重复提交，请 {limit_minutes} 分钟后再试',
        }), 429

    # ── 创建留言记录 ──
    msg = ContactMessage(
        name=data.get('name', '匿名用户') if not is_anonymous else '匿名用户',
        email=data.get('email', '') if not is_anonymous else '',
        phone=data.get('phone'),
        subject=data['subject'],
        message=data['message'],
        ip_address=ip,
        is_anonymous=is_anonymous,
    )
    db.session.add(msg)
    db.session.commit()

    return jsonify({'success': True, 'message': '留言已提交，我们会尽快回复'}), 201


# ═══════════════════════════════════════════════════════════════
# 成员展示（公开）
# ═══════════════════════════════════════════════════════════════

@public_bp.route('/members', methods=['GET'])
def get_members():
    """获取活跃成员列表（公开，仅含公开信息）。

    可选筛选参数:
        group:  按分组筛选（product/design/dev/content）
        search: 按姓名、简介、角色搜索

    Returns:
        JSON: 成员公开信息列表（不含邮箱、手机号、学号等隐私字段）
    """
    group = request.args.get('group')
    search = request.args.get('search')

    query = Member.query.filter_by(status='active')  # 仅返回活跃成员

    if group:
        query = query.filter_by(group=group)
    if search:
        query = query.filter(
            db.or_(
                Member.name.contains(search),
                Member.bio.contains(search),
                Member.role.contains(search),
            )
        )

    members = query.order_by(Member.sort_order, Member.id).all()
    return jsonify([m.to_public_dict() for m in members])


@public_bp.route('/members/<int:member_id>', methods=['GET'])
def get_member(member_id):
    """获取单个成员详情（公开，仅含公开信息）。

    Args:
        member_id: 成员 ID

    Returns:
        JSON: 成员公开信息
              或 404: 成员不存在或非活跃状态
    """
    member = Member.query.get(member_id)
    if not member or member.status != 'active':
        return jsonify({'error': 'not_found', 'message': '成员不存在'}), 404
    return jsonify(member.to_public_dict())


# ═══════════════════════════════════════════════════════════════
# 项目展示（公开）
# ═══════════════════════════════════════════════════════════════

@public_bp.route('/projects', methods=['GET'])
def get_projects():
    """获取项目列表（公开，不含内部管理字段）。

    可选筛选参数:
        category: 按分类筛选（web/miniapp/ai/tools/game）
        status:   按状态筛选（active/completed/archived）
        search:   按名称和描述搜索

    默认按开始日期降序排列。

    Returns:
        JSON: 项目公开信息列表
    """
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
    return jsonify([p.to_public_dict() for p in projects])


@public_bp.route('/projects/<slug>', methods=['GET'])
def get_project(slug):
    """根据 slug 获取单个项目详情（公开）。

    Args:
        slug: 项目标识符（如 'campus-hub', 'ai-writer'）

    Returns:
        JSON: 项目公开信息
              或 404: 项目不存在
    """
    project = Project.query.filter_by(slug=slug).first()
    if not project:
        return jsonify({'error': 'not_found', 'message': '项目不存在'}), 404
    return jsonify(project.to_public_dict())


@public_bp.route('/projects/<int:project_id>/milestones', methods=['GET'])
def get_project_milestones(project_id):
    """获取指定项目的所有里程碑（按排序序号排列）。

    Args:
        project_id: 项目 ID

    Returns:
        JSON: 里程碑列表
              或 404: 项目不存在
    """
    project = Project.query.get(project_id)
    if not project:
        return jsonify({'error': 'not_found', 'message': '项目不存在'}), 404

    milestones = Milestone.query.filter_by(project_id=project_id)\
        .order_by(Milestone.sort_order, Milestone.id).all()
    return jsonify([m.to_dict() for m in milestones])


# ═══════════════════════════════════════════════════════════════
# 获奖荣誉（公开）
# ═══════════════════════════════════════════════════════════════

@public_bp.route('/awards', methods=['GET'])
def get_awards():
    """获取获奖荣誉列表。

    可选筛选参数:
        level:    按等级筛选（national/provincial/school/other）
        year:     按年份筛选（如 '2025'，匹配 date 字段前缀）
        category: 按类别筛选

    默认按获奖日期降序排列。

    Returns:
        JSON: 获奖记录列表
    """
    level = request.args.get('level')
    year = request.args.get('year')
    category = request.args.get('category')

    query = Award.query

    if level:
        query = query.filter_by(level=level)
    if category:
        query = query.filter_by(category=category)
    if year:
        # date 字段格式为 "YYYY-MM"，使用 LIKE 前缀匹配年份
        query = query.filter(Award.date.like(f'{year}%'))

    awards = query.order_by(Award.date.desc(), Award.sort_order, Award.id).all()
    return jsonify([a.to_dict() for a in awards])


@public_bp.route('/awards/<slug>', methods=['GET'])
def get_award(slug):
    """根据 slug 获取单个获奖详情。

    Args:
        slug: 获奖标识符（如 'icpc-2025', 'web-contest-2025'）

    Returns:
        JSON: 获奖详细信息
              或 404: 获奖记录不存在
    """
    award = Award.query.filter_by(slug=slug).first()
    if not award:
        return jsonify({'error': 'not_found', 'message': '奖项不存在'}), 404
    return jsonify(award.to_dict())


# ═══════════════════════════════════════════════════════════════
# 博客文章（公开）
# ═══════════════════════════════════════════════════════════════

@public_bp.route('/blogs', methods=['GET'])
def get_blogs():
    """获取已发布的博客文章列表。

    仅返回 is_published=True 的文章（草稿不公开）。

    可选筛选参数:
        category: 按分类筛选（tech/event/summary/announcement）
        tag:      按标签筛选（由于 tags 是 JSON 数组，此筛选在 Python 层执行）
        search:   按标题和摘要搜索

    默认按发布日期降序排列。

    Returns:
        JSON: 博客文章列表
    """
    category = request.args.get('category')
    tag = request.args.get('tag')
    search = request.args.get('search')

    query = BlogPost.query.filter_by(is_published=True)  # 仅返回已发布文章

    if category:
        query = query.filter_by(category=category)
    if search:
        query = query.filter(
            db.or_(
                BlogPost.title.contains(search),
                BlogPost.excerpt.contains(search),
            )
        )

    posts = query.order_by(BlogPost.date.desc(), BlogPost.id.desc()).all()

    # 标签筛选在 Python 层执行（因为 tags 是 JSON 数组，SQLite 不支持 JSON 查询）
    if tag:
        posts = [p for p in posts if p.tags and tag in p.tags]

    return jsonify([p.to_dict() for p in posts])


@public_bp.route('/blogs/<slug>', methods=['GET'])
def get_blog(slug):
    """根据 slug 获取单篇已发布博客文章。

    Args:
        slug: 文章标识符（如 'react-19-new-features'）

    Returns:
        JSON: 文章完整信息
              或 404: 文章不存在或未发布
    """
    post = BlogPost.query.filter_by(slug=slug, is_published=True).first()
    if not post:
        return jsonify({'error': 'not_found', 'message': '文章不存在'}), 404
    return jsonify(post.to_dict())


# ═══════════════════════════════════════════════════════════════
# 统一登录（管理员 + 成员）
# ═══════════════════════════════════════════════════════════════

@public_bp.route('/auth/login', methods=['POST'])
def unified_login():
    """统一登录接口 — 先尝试管理员登录，再尝试成员登录。

    登录策略:
      1. 首先查询 admin_users 表，如果用户名匹配且密码正确 → 返回 admin 角色
      2. 再查询 members 表（按学号或邮箱），如果匹配且密码正确 → 返回 member 角色
      3. 都不匹配 → 返回认证失败

    成员登录时会自动更新 last_login_at 时间戳。

    Request Body:
        {
            "account": "admin 或 2022001 或 email@example.com",
            "password": "password123"
        }

    Returns:
        200: {"success": true, "token": "...", "role": "admin"|"member", "user": {...}}
        400: 缺少账号或密码
        401: 账号或密码错误
        403: 成员账号被停用
    """
    data = request.get_json()
    if not data or not data.get('account') or not data.get('password'):
        return jsonify({
            'error': 'bad_request',
            'message': '请输入账号和密码',
        }), 400

    account = data['account'].strip()
    password = data['password']

    # ── 第一步：尝试管理员登录 ──
    admin = AdminUser.query.filter_by(username=account).first()
    if admin and admin.check_password(password):
        token = create_access_token(identity=str(admin.id))
        return jsonify({
            'success': True,
            'token': token,
            'role': 'admin',
            'user': admin.to_dict(),
        })

    # ── 第二步：尝试成员登录（按学号或邮箱查找）──
    member = Member.query.filter(
        db.or_(Member.student_id == account, Member.email == account)
    ).first()

    if member and member.password_hash and member.check_password(password):
        # 检查账号是否被停用
        if member.status != 'active':
            return jsonify({
                'error': 'account_disabled',
                'message': '账号已被停用，请联系管理员',
            }), 403

        # 更新最后登录时间
        member.last_login_at = datetime.now(timezone.utc)
        db.session.commit()

        # 成员 JWT identity 格式: "member:<id>"
        identity = f'member:{member.id}'
        token = create_access_token(identity=identity)

        return jsonify({
            'success': True,
            'token': token,
            'role': 'member',
            'user': member.to_member_dict(),
        })

    # ── 第三步：都不匹配 ──
    return jsonify({
        'error': 'auth_failed',
        'message': '账号或密码错误',
    }), 401


# ═══════════════════════════════════════════════════════════════
# 成员注册
# ═══════════════════════════════════════════════════════════════

@public_bp.route('/auth/register', methods=['POST'])
def member_register():
    """成员自主注册接口。

    注册流程:
      1. 用户输入学号/邮箱 + 姓名 + 密码
      2. 系统在 members 表中查找匹配的记录（由管理员预先添加）
      3. 验证姓名是否匹配（大小写不敏感）
      4. 检查是否已注册（password_hash 是否已存在）
      5. 设置密码 → 激活账号 → 自动登录

    安全性:
      - 只有管理员预先添加到 members 表的成员才能注册
      - 姓名二次验证防止他人冒用学号/邮箱注册
      - 密码最少 6 个字符

    Request Body:
        {
            "account": "2022001 或 email@example.com",
            "name": "陈星宇",
            "password": "mypassword"
        }

    Returns:
        201: {"success": true, "message": "注册成功！", "token": "...", "role": "member", "user": {...}}
        400: 参数验证失败或姓名不匹配
        403: 账号被停用
        404: 未找到匹配的成员信息
        409: 该账号已注册
    """
    data = request.get_json()
    if not data:
        return jsonify({'error': 'bad_request', 'message': '请求体为空'}), 400

    account = (data.get('account') or '').strip()
    name = (data.get('name') or '').strip()
    password = data.get('password') or ''

    # ── 参数校验 ──
    if not account:
        return jsonify({'error': 'validation_error', 'message': '请输入学号或邮箱'}), 400
    if not name:
        return jsonify({'error': 'validation_error', 'message': '请输入姓名'}), 400
    if len(password) < 6:
        return jsonify({'error': 'validation_error', 'message': '密码至少需要6个字符'}), 400

    # ── 查找成员记录（按学号或邮箱）──
    member = Member.query.filter(
        db.or_(Member.student_id == account, Member.email == account)
    ).first()

    if not member:
        return jsonify({
            'error': 'not_found',
            'message': '未找到匹配的成员信息。请确认学号/邮箱无误，或联系管理员将你添加到成员列表。',
        }), 404

    # ── 姓名二次验证（大小写不敏感，去除首尾空格）──
    if member.name.strip().lower() != name.lower():
        return jsonify({
            'error': 'validation_error',
            'message': f'姓名不匹配。数据库中该账号对应的姓名为「{member.name}」，请核对后重试。',
        }), 400

    # ── 检查是否已注册 ──
    if member.password_hash:
        return jsonify({
            'error': 'already_registered',
            'message': '该账号已注册，请直接登录。',
        }), 409

    # ── 检查账号状态 ──
    if member.status != 'active':
        return jsonify({
            'error': 'account_disabled',
            'message': '该账号已被停用，请联系管理员。',
        }), 403

    # ── 激活账号：设置密码 ──
    member.set_password(password)
    member.last_login_at = datetime.now(timezone.utc)
    db.session.commit()

    # ── 注册后自动登录 ──
    identity = f'member:{member.id}'
    token = create_access_token(identity=identity)

    return jsonify({
        'success': True,
        'message': '注册成功！',
        'token': token,
        'role': 'member',
        'user': member.to_member_dict(),
    }), 201
