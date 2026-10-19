"""星雨作坊 CMS — Flask 应用工厂

本模块是后端服务的入口，使用 Flask 应用工厂模式创建和配置应用实例。
主要职责包括：
  1. 创建 Flask 应用实例并加载配置
  2. 初始化扩展（数据库、CORS、JWT）
  3. 注册 API 路由蓝图
  4. 执行自动数据库迁移（添加缺失的列）
  5. 在首次启动时写入默认种子数据
  6. 提供健康检查、静态文件服务和全局错误处理

启动方式:
    python app.py
    或通过 Flask CLI: FLASK_APP=app:create_app flask run
"""

import copy
import os
from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
from flask_jwt_extended import JWTManager

from config import config
from models import db, AdminUser, SiteConfig, Page, Member
from defaults import DEFAULT_SITE_CONFIG, DEFAULT_PAGES, INITIAL_MEMBER_PASSWORD


def create_app(config_name=None):
    """Flask 应用工厂函数。

    根据配置名称创建并配置 Flask 应用实例。在应用上下文中自动执行
    数据库建表、列迁移和默认数据填充。

    Args:
        config_name: 配置名称（'development' | 'production'）。
                     为 None 时从 FLASK_ENV 环境变量读取，默认 'development'。

    Returns:
        Flask: 配置完成的 Flask 应用实例，所有路由已注册到 /api 前缀下。
    """
    if config_name is None:
        config_name = os.environ.get('FLASK_ENV', 'development')

    # ── 1. 创建 Flask 实例并加载配置 ──
    app = Flask(__name__)
    app.config.from_object(config[config_name])
    app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get(
        'DATABASE_URL', app.config['SQLALCHEMY_DATABASE_URI']
    )

    # ── 2. 确保上传目录存在 ──
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

    # ── 3. 初始化 Flask 扩展 ──
    db.init_app(app)                                                      # SQLAlchemy 数据库
    CORS(app, origins=app.config['CORS_ORIGINS'], supports_credentials=True)  # 跨域请求支持
    JWTManager(app)                                                       # JWT 认证管理

    # ── 4. 注册所有 API 路由蓝图（统一前缀 /api）──
    from routes import all_blueprints
    for bp in all_blueprints:
        app.register_blueprint(bp, url_prefix='/api')

    # ── 5. 应用上下文中的初始化操作 ──
    # 这些操作需要在数据库连接可用的上下文中执行
    with app.app_context():
        db.create_all()           # 创建所有不存在的表（等同于自动 migrate）
        _migrate_columns(app)     # 向已存在的表添加新列（SQLite 不支持 ALTER TABLE ADD COLUMN IF NOT EXISTS）
        if app.config['SEED_DEMO_DATA']:
            _seed_defaults()
        else:
            _seed_production_defaults(
                app.config['BOOTSTRAP_ADMIN_USERNAME'],
                app.config['BOOTSTRAP_ADMIN_PASSWORD'],
            )
        _ensure_site_config_defaults()
        _ensure_pages()           # 确保所有默认 CMS 页面存在

    # ── 5.1 启动智能体定时提醒扫描（后台守护线程，须在数据库建表之后）──
    from services.reminder_service import start_reminder_scanner
    start_reminder_scanner(app)

    # ── 6. 基础路由 ──

    @app.route('/health')
    def health():
        """健康检查端点。

        用于部署环境的存活探测和负载均衡健康检查。
        返回 200 表示服务正常运行。

        Returns:
            JSON: {"status": "ok", "message": "Xingyu CMS API is running"}
        """
        return jsonify({'status': 'ok', 'message': 'Xingyu CMS API is running'})

    @app.route('/uploads/<path:filename>')
    def serve_upload(filename):
        """静态文件服务端点。

        安全地提供 uploads/ 目录下的文件访问。
        使用 send_from_directory 防止路径遍历攻击。

        Args:
            filename: 上传文件的文件名（支持子路径）

        Returns:
            文件响应或 404
        """
        return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

    # ── 7. 全局错误处理 ──

    @app.errorhandler(404)
    def not_found(e):
        """404 错误处理 — 统一返回 JSON 格式。

        当前端请求不存在的路由时触发。
        """
        return jsonify({'error': 'not_found', 'message': '资源不存在'}), 404

    @app.errorhandler(500)
    def server_error(e):
        """500 错误处理 — 统一返回 JSON 格式。

        当服务端发生未捕获异常时触发。
        """
        return jsonify({'error': 'server_error', 'message': '服务器内部错误'}), 500

    return app


# ═══════════════════════════════════════════════════════════════
# 内部初始化辅助函数
# ═══════════════════════════════════════════════════════════════

def _seed_defaults():
    """首次启动时写入默认数据。

    仅在对应表为空时才插入数据（幂等操作，多次启动不会重复写入）：
      1. 默认管理员账号（admin / admin123）
      2. 默认站点配置（从 defaults.py 的 DEFAULT_SITE_CONFIG）
      3. 示例成员数据

    注意：**不写入任何默认项目、奖项、博客与通知**——这些内容都由管理员在后台自行创建或导入。

    任何步骤失败都会回滚该批次操作，不影响应用启动。
    """
    try:
        # ── 默认管理员 ──
        if not AdminUser.query.first():
            admin = AdminUser(username='admin')
            admin.set_password('admin123')
            db.session.add(admin)
        if not AdminUser.query.filter_by(username='teacher').first():
            teacher = AdminUser(username='teacher', role='teacher')
            teacher.set_password('teacher123')
            db.session.add(teacher)

        # ── 默认站点配置 ──
        if not SiteConfig.query.first():
            for key, value in DEFAULT_SITE_CONFIG.items():
                db.session.add(SiteConfig(config_key=key, config_value=value))

        # ── 示例成员数据（仅当成员表为空时写入）──
        if not Member.query.first():
            _seed_members()

        db.session.commit()
    except Exception:
        db.session.rollback()


def _seed_production_defaults(username, password):
    """Initialize only required CMS records and one explicit first admin."""
    if not username or not password:
        raise RuntimeError(
            'Production requires BOOTSTRAP_ADMIN_USERNAME and '
            'BOOTSTRAP_ADMIN_PASSWORD or BOOTSTRAP_ADMIN_PASSWORD_FILE.'
        )

    try:
        if not SiteConfig.query.first():
            for key, value in DEFAULT_SITE_CONFIG.items():
                db.session.add(SiteConfig(config_key=key, config_value=value))

        if not AdminUser.query.first():
            admin = AdminUser(username=username)
            admin.set_password(password)
            db.session.add(admin)

        db.session.commit()
    except Exception:
        db.session.rollback()
        raise


def _ensure_pages():
    """确保默认 CMS 页面存在。

    遍历 DEFAULT_PAGES 中的页面定义：
      - 如果 slug 不存在，则创建新页面
      - 如果 slug 已存在，跳过（保留已有内容不覆盖）

    同时检查 sections 配置中是否有新增的开关项，
    自动补充到已有配置中（不影响已有配置的其他部分）。
    """
    try:
        # ── 写入缺失的默认页面 ──
        existing = {p.slug for p in Page.query.all()}
        for slug, data in DEFAULT_PAGES.items():
            if slug not in existing:
                db.session.add(Page(slug=slug, title=data['title'], content=data['content']))
        db.session.commit()
    except Exception:
        db.session.rollback()

    # ── 补充 sections 配置中缺失的键 ──
    # 例如，当 defaults.py 新增了某个模块的开关但数据库中还没有时，自动补充
    try:
        sections_cfg = SiteConfig.query.filter_by(config_key='sections').first()
        if sections_cfg and isinstance(sections_cfg.config_value, dict):
            default_sections = DEFAULT_SITE_CONFIG.get('sections', {})
            updated = False
            for key, val in default_sections.items():
                if key not in sections_cfg.config_value:
                    sections_cfg.config_value[key] = val
                    updated = True
            if updated:
                db.session.commit()
    except Exception:
        db.session.rollback()


def _ensure_site_config_defaults():
    """Add newly introduced default site configuration keys to existing DBs.

    只补充缺失的键，绝不覆盖管理员已在后台修改过的值；嵌套字典（如
    hero / members / footer）会逐层补齐，方便新版本给老库加字段。
    """
    try:
        existing = {cfg.config_key: cfg for cfg in SiteConfig.query.all()}
        for key, value in DEFAULT_SITE_CONFIG.items():
            cfg = existing.get(key)
            if cfg is None:
                db.session.add(SiteConfig(config_key=key, config_value=value))
            elif isinstance(cfg.config_value, dict) and isinstance(value, dict):
                merged = copy.deepcopy(cfg.config_value)
                if _merge_missing_keys(merged, value):
                    cfg.config_value = merged
        db.session.commit()
    except Exception:
        db.session.rollback()


def _merge_missing_keys(target, defaults):
    """递归补齐 target 中缺失、但 defaults 中存在的键；返回是否有改动。"""
    if not isinstance(target, dict) or not isinstance(defaults, dict):
        return False
    changed = False
    for key, value in defaults.items():
        if key not in target:
            target[key] = copy.deepcopy(value)
            changed = True
        elif isinstance(target[key], dict) and isinstance(value, dict):
            if _merge_missing_keys(target[key], value):
                changed = True
    return changed


def _migrate_columns(app):
    """向已存在的表添加新列（SQLite 兼容的增量迁移）。

    由于 SQLite 不支持 ALTER TABLE ... ADD COLUMN IF NOT EXISTS，
    因此采用 try-except 逐个尝试添加列。如果列已存在则静默跳过。

    迁移策略：
      - 仅添加列（不修改或删除已有列）
      - 新增的模型字段需要在此处注册迁移
      - 如果数据库文件较旧，此函数确保新列被添加

    迁移记录格式: (表名, 列名, SQL 列类型)

    Args:
        app: Flask 应用实例（用于获取数据库连接）
    """
    migrations = [
        # ── 管理员角色 ──
        ('admin_users', 'role', 'VARCHAR(20) DEFAULT "admin"'),
        ('admin_users', 'email', 'VARCHAR(120)'),

        # ── Member 展示字段 ──
        ('members', 'role', 'VARCHAR(100)'),
        ('members', 'skills', 'JSON'),
        ('members', 'github', 'VARCHAR(255)'),
        ('members', 'blog', 'VARCHAR(255)'),
        ('members', 'grade', 'VARCHAR(20)'),
        ('members', 'is_alumni', 'BOOLEAN DEFAULT 0'),
        ('members', 'sort_order', 'INTEGER DEFAULT 0'),
        ('members', 'updated_at', 'DATETIME'),

        # ── Member 认证字段 ──
        ('members', 'password_hash', 'VARCHAR(255)'),
        ('members', 'phone', 'VARCHAR(30)'),
        ('members', 'student_id', 'VARCHAR(50)'),
        ('members', 'notification_prefs', 'JSON'),
        ('members', 'last_login_at', 'DATETIME'),

        # ── 资源中心 ──
        ('resource_folders', 'parent_id', 'INTEGER'),
        ('resource_folders', 'created_by', 'INTEGER'),
        ('resource_folders', 'updated_at', 'DATETIME'),
        ('resource_files', 'folder_id', 'INTEGER'),
        ('resource_files', 'file_path', 'VARCHAR(500)'),
        ('resource_files', 'file_type', 'VARCHAR(50)'),
        ('resource_files', 'file_size', 'INTEGER DEFAULT 0'),
        ('resource_files', 'uploaded_by', 'INTEGER'),
        ('resource_files', 'is_deleted', 'BOOLEAN DEFAULT 0'),
        ('resource_files', 'updated_at', 'DATETIME'),

        # ── 证书 ──
        ('certificates', 'member_id', 'INTEGER'),
        ('certificates', 'name', 'VARCHAR(300)'),
        ('certificates', 'level', 'VARCHAR(20)'),
        ('certificates', 'category', 'VARCHAR(50)'),
        ('certificates', 'winner', 'VARCHAR(200)'),
        ('certificates', 'issuer', 'VARCHAR(200)'),
        ('certificates', 'advisor', 'VARCHAR(200)'),
        ('certificates', 'date', 'VARCHAR(20)'),
        ('certificates', 'description', 'TEXT'),
        ('certificates', 'images', 'JSON'),
        ('certificates', 'ocr_text', 'TEXT'),
        ('certificates', 'ocr_fields', 'JSON'),
        ('certificates', 'review_note', 'TEXT'),
        ('certificates', 'reviewed_by', 'INTEGER'),
        ('certificates', 'reviewed_at', 'DATETIME'),
        ('certificates', 'related_project', 'VARCHAR(100)'),
        ('certificates', 'status', 'VARCHAR(20) DEFAULT "pending"'),
        ('certificates', 'updated_at', 'DATETIME'),

        # ── 奖项来源证书 ──
        ('awards', 'certificate_id', 'INTEGER'),
        ('awards', 'advisor', 'VARCHAR(200)'),

        # ── 通知 ──
        ('notifications', 'member_id', 'INTEGER'),
        ('notifications', 'type', 'VARCHAR(50)'),
        ('notifications', 'title', 'VARCHAR(200)'),
        ('notifications', 'body', 'TEXT'),
        ('notifications', 'link', 'VARCHAR(500)'),
        ('notifications', 'is_read', 'BOOLEAN DEFAULT 0'),

        # ── 项目展示字段 ──
        ('projects', 'slug', 'VARCHAR(100)'),
        ('projects', 'cover_image', 'VARCHAR(500)'),
        ('projects', 'category', 'VARCHAR(20)'),
        ('projects', 'tech_stack', 'JSON'),
        ('projects', 'content', 'TEXT'),
        ('projects', 'github_url', 'VARCHAR(255)'),
        ('projects', 'demo_url', 'VARCHAR(255)'),
        ('projects', 'stars', 'INTEGER DEFAULT 0'),
        ('projects', 'forks', 'INTEGER DEFAULT 0'),
        ('projects', 'screenshots', 'JSON'),
        ('projects', 'team', 'JSON'),
        ('projects', 'updated_at', 'DATETIME'),

        # ── 博客 ──
        ('blog_posts', 'is_published', 'BOOLEAN DEFAULT 1'),
        ('blog_posts', 'pinned', 'BOOLEAN DEFAULT 0'),
        ('blog_posts', 'updated_at', 'DATETIME'),
        ('blog_posts', 'author_id', 'INTEGER'),
    ]

    with app.app_context():
        try:
            with db.engine.connect() as conn:
                for table, col, col_type in migrations:
                    try:
                        # 尝试添加列，如果列已存在则 SQLite 会抛出异常，静默跳过
                        conn.execute(db.text(
                            f'ALTER TABLE {table} ADD COLUMN {col} {col_type}'
                        ))
                        conn.commit()
                    except Exception:
                        pass  # 列已存在，跳过
        except Exception:
            pass  # 数据库连接失败等极端情况，不影响应用启动


# ═══════════════════════════════════════════════════════════════
# 示例种子数据生成函数
# ═══════════════════════════════════════════════════════════════
# 以下函数仅在数据库为空时执行一次，用于生成演示数据。

def _seed_members():
    """写入 12 名初始成员（来源：2026-09-23 的站点备份成员名录）。

    分组对应关系：流光组→product、星绘组→design、逐云组→dev。
    有学号的成员使用统一初始密码（defaults.INITIAL_MEMBER_PASSWORD）即可登录成员门户，
    登录后可在个人中心自行改密；陶星宇（指导老师）与莫玉妃暂无学号，因此还不能登录。
    头像使用社团 OSS 上的地址。
    """
    members_data = [
        {'name': '陶星宇', 'role': '指导老师', 'group': 'product',
         'skills': ['产品设计', '用户研究', '项目管理'],
         'github': 'https://github.com/GUET1-304A',
         'bio': '专注于产品战略与用户体验设计，擅长将复杂需求转化为清晰的产品方案',
         'avatar': 'https://shetuanweb.oss-cn-wulanchabu.aliyuncs.com/images/b1ea77c6543a47769ee76f228a1f52a4.jpg'},
        {'name': '穆天宇', 'role': '技术负责人', 'group': 'dev', 'student_id': '2400310419',
         'skills': ['Vue', 'Python', 'Rust', 'DevOps'],
         'github': 'https://github.com/GUET1-304A',
         'bio': '全栈工程师，热衷于开源项目，主导多个核心系统的架构设计',
         'avatar': 'https://shetuanweb.oss-cn-wulanchabu.aliyuncs.com/images/37f42d36f6c342dc8cee28929fcf69e4.jpg'},
        {'name': '梁天音', 'role': '设计负责人', 'group': 'design', 'student_id': '2400320104',
         'skills': ['UI设计', '品牌设计', '动效设计'],
         'github': 'https://github.com/GUET1-304A',
         'bio': 'UI/UX 设计师，追求像素完美，负责社团整体视觉语言',
         'avatar': 'https://shetuanweb.oss-cn-wulanchabu.aliyuncs.com/images/15769f6271cf40bc99fe0ed8d241cde2.jpg'},
        {'name': '曾麒兆', 'role': '技术人员', 'group': 'dev', 'student_id': '2400310331',
         'skills': ['Vue', 'Python', 'Java'],
         'github': 'https://github.com/zqzlq',
         'bio': '全栈工程师，热衷于开源项目，主导多个核心系统的架构设计',
         'avatar': 'https://shetuanweb.oss-cn-wulanchabu.aliyuncs.com/images/d8bdadf92b734d408f263d28e2ec1e71.jpg'},
        {'name': '兀泉晶', 'role': '技术人员', 'group': 'dev', 'student_id': '2300920214',
         'skills': [],
         'bio': 'UI/UX 设计师，追求像素完美，负责社团整体视觉语言',
         'avatar': 'https://shetuanweb.oss-cn-wulanchabu.aliyuncs.com/images/6fcbad9787534795a51b77b9b9d41652.jpg'},
        {'name': '温慧珍', 'role': '技术人员', 'group': 'dev', 'student_id': '2400310107',
         'skills': ['Vue'],
         'bio': '擅长前端开发',
         'avatar': 'https://shetuanweb.oss-cn-wulanchabu.aliyuncs.com/images/03b91cdef85047e4899889d2e8b5933d.jpg'},
        {'name': '丁林云', 'role': '技术人员', 'group': 'dev', 'student_id': '2400310501',
         'skills': [],
         'bio': '喜欢安卓开发',
         'avatar': 'https://shetuanweb.oss-cn-wulanchabu.aliyuncs.com/images/19dab2798001478b9c22271bc9239d6d.jpg'},
        {'name': '张自强', 'role': '技术人员', 'group': 'design', 'student_id': '2400360333',
         'skills': ['Java', 'Go'],
         'bio': '热衷于后端开发',
         'avatar': 'https://shetuanweb.oss-cn-wulanchabu.aliyuncs.com/images/5e715eb2010746f7bdfed6c575a5ebc5.jpg'},
        {'name': '郑承睿', 'role': '技术人员', 'group': 'design', 'student_id': '2400360132',
         'skills': [],
         'bio': '擅长安卓开发',
         'avatar': 'https://shetuanweb.oss-cn-wulanchabu.aliyuncs.com/images/eecfbdf0f2a848c78805f1470ce7fc80.jpg'},
        {'name': '莫玉妃', 'role': '技术人员', 'group': 'design',
         'skills': [],
         'avatar': 'https://shetuanweb.oss-cn-wulanchabu.aliyuncs.com/images/b14bd369469b4cd5a86547702ee82415.jpg'},
        {'name': '赵欣苗', 'role': '技术人员', 'group': 'design', 'student_id': '2400310108',
         'skills': [],
         'avatar': 'https://shetuanweb.oss-cn-wulanchabu.aliyuncs.com/images/26d6c11cd5ee4579b1a71b0e7d25f1d1.jpg'},
        {'name': '江昊宸', 'role': '技术人员', 'group': 'design', 'student_id': '2400350120',
         'skills': [],
         'avatar': 'https://shetuanweb.oss-cn-wulanchabu.aliyuncs.com/images/50771bec14b04ac38bf00405b63c426c.jpg'},
    ]
    for i, m in enumerate(members_data):
        member = Member(sort_order=i, status='active', is_alumni=False, **m)
        if member.student_id:
            member.set_password(INITIAL_MEMBER_PASSWORD)
        db.session.add(member)


