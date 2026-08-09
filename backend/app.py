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

import os
from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
from flask_jwt_extended import JWTManager

from config import config
from models import db, AdminUser, SiteConfig, Page, Member, Project, Award, BlogPost
from defaults import DEFAULT_SITE_CONFIG, DEFAULT_PAGES


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
      4. 示例项目数据
      5. 示例获奖数据
      6. 示例博客文章
      7. 示例通知数据

    任何步骤失败都会回滚该批次操作，不影响应用启动。
    """
    try:
        # ── 默认管理员 ──
        if not AdminUser.query.first():
            admin = AdminUser(username='admin')
            admin.set_password('admin123')
            db.session.add(admin)

        # ── 默认站点配置 ──
        if not SiteConfig.query.first():
            for key, value in DEFAULT_SITE_CONFIG.items():
                db.session.add(SiteConfig(config_key=key, config_value=value))

        # ── 示例成员数据（仅当成员表为空时写入）──
        if not Member.query.first():
            _seed_members()

        # ── 示例项目数据（仅当项目表为空时写入）──
        if not Project.query.first():
            _seed_projects()

        # ── 示例获奖数据（仅当获奖表为空时写入）──
        if not Award.query.first():
            _seed_awards()

        # ── 示例博客文章（仅当博客表为空时写入）──
        if not BlogPost.query.first():
            _seed_blogs()

        # ── 示例通知（仅当通知表为空时写入）──
        from models import Notification
        if not Notification.query.first():
            _seed_notifications()

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
    """生成 8 名示例成员。

    包含产品、开发、设计、内容四个方向的成员，分布在 2022-2024 级。
    每名成员预设了技能标签、联系方式和个人简介。
    默认密码均为 'member123'。
    """
    members_data = [
        {'name': '陈星宇', 'role': '负责人 / 产品+开发', 'group': 'product',
         'skills': ['React', 'Vue', 'Node.js', 'Python'],
         'github': 'https://github.com', 'blog': 'https://blog.example.com',
         'email': 'xingyu@example.com', 'bio': '热爱前端与开源，相信技术的力量可以改变世界。',
         'grade': '2022级', 'is_alumni': False, 'student_id': '2022001',
         'avatar': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face'},
        {'name': '林雨晴', 'role': '副社长 / 后端开发', 'group': 'dev',
         'skills': ['Go', 'Python', 'Docker', 'K8s'],
         'github': 'https://github.com', 'email': 'yuqing@example.com',
         'bio': '专注于后端架构和分布式系统。', 'grade': '2022级', 'is_alumni': False, 'student_id': '2022002',
         'avatar': 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&crop=face'},
        {'name': '赵子涵', 'role': '前端组长', 'group': 'dev',
         'skills': ['TypeScript', 'React', 'Next.js', 'Tailwind'],
         'github': 'https://github.com', 'blog': 'https://blog.example.com',
         'bio': '追求极致的用户体验和界面设计。', 'grade': '2023级', 'is_alumni': False, 'student_id': '2023001',
         'avatar': 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop&crop=face'},
        {'name': '王思远', 'role': '算法组长', 'group': 'dev',
         'skills': ['Python', 'PyTorch', 'NLP', 'CV'],
         'github': 'https://github.com', 'bio': '研究方向为自然语言处理和计算机视觉。',
         'grade': '2023级', 'is_alumni': False, 'student_id': '2023002',
         'avatar': 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop&crop=face'},
        {'name': '张悦然', 'role': '设计组长', 'group': 'design',
         'skills': ['Figma', 'PS', 'AI', 'Blender'],
         'email': 'yueran@example.com', 'bio': '相信好的设计能让技术更有温度。',
         'grade': '2023级', 'is_alumni': False, 'student_id': '2023003',
         'avatar': 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop&crop=face'},
        {'name': '刘明哲', 'role': '产品组长', 'group': 'product',
         'skills': ['产品设计', '用户研究', '数据分析'],
         'github': 'https://github.com', 'bio': '专注产品思维与用户体验。',
         'grade': '2023级', 'is_alumni': False, 'student_id': '2023004',
         'avatar': 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200&h=200&fit=crop&crop=face'},
        {'name': '孙晓萌', 'role': '前端开发', 'group': 'dev',
         'skills': ['Vue', 'TypeScript', 'GSAP', 'Three.js'],
         'github': 'https://github.com', 'bio': '喜欢用动画和交互讲好每一个产品故事。',
         'grade': '2024级', 'is_alumni': False, 'student_id': '2024001',
         'avatar': 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop&crop=face'},
        {'name': '周逸飞', 'role': '后端开发', 'group': 'dev',
         'skills': ['Java', 'Spring', 'MySQL', 'Redis'],
         'github': 'https://github.com', 'bio': '对高并发和系统稳定性充满热情。',
         'grade': '2024级', 'is_alumni': False, 'student_id': '2024002',
         'avatar': 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&h=200&fit=crop&crop=face'},
    ]
    for i, m in enumerate(members_data):
        member = Member(sort_order=i, status='active', **m)
        member.set_password('member123')
        db.session.add(member)


def _seed_notifications():
    """生成 3 条示例通知（发送给成员 1）。

    包含欢迎通知、任务分配通知和状态变更通知，
    用于演示通知中心功能。
    """
    from models import Notification
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)

    notifs = [
        Notification(member_id=1, type='announcement',
                     title='欢迎加入星雨作坊！',
                     body='你已成功注册成员账号，可以开始使用成员门户的各项功能。',
                     link='/member/dashboard', is_read=False, created_at=now),
        Notification(member_id=1, type='task_assigned',
                     title='新任务分配：完成登录页面设计',
                     body='你被分配了任务「完成登录页面响应式适配」，项目：Campus Hub，截止日期：2026-07-15',
                     link='/member/tasks', is_read=False, created_at=now),
        Notification(member_id=1, type='status_change',
                     title='任务状态变更：修复导航栏 bug',
                     body='任务「修复导航栏 bug」已标记为完成 ✅',
                     link='/member/tasks', is_read=True, created_at=now),
    ]
    for n in notifs:
        db.session.add(n)


def _seed_projects():
    """生成 9 个示例项目。

    涵盖 Web 应用、AI、小程序、工具、游戏等多个分类，
    包含进行中、已完成、已归档三种状态。
    每个项目包含技术栈、团队信息、GitHub 数据等完整信息。
    """
    from datetime import datetime, timezone
    projects_data = [
        {'slug': 'campus-hub', 'name': 'Campus Hub',
         'category': 'web', 'tech_stack': ['React', 'TypeScript', 'Node.js', 'PostgreSQL'],
         'description': '校园综合服务平台，集成了课表管理、社团活动、二手交易等功能。',
         'content': '## Campus Hub\n\n校园综合服务平台...',
         'github_url': 'https://github.com/xingyu/campus-hub',
         'demo_url': 'https://campus-hub.example.com', 'stars': 128, 'forks': 36,
         'screenshots': [],
         'team': [{'name': '陈星宇', 'avatar': '', 'role': '全栈开发'},
                   {'name': '赵子涵', 'avatar': '', 'role': '前端开发'}],
         'start_date': datetime(2025, 9, 1, tzinfo=timezone.utc), 'status': 'active',
         'cover_image': 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=800&q=80'},
        {'slug': 'ai-writer', 'name': 'AI 智能写作助手',
         'category': 'ai', 'tech_stack': ['Python', 'FastAPI', 'React', 'LLM'],
         'description': '基于大语言模型的智能写作辅助工具，支持多种文体和风格。',
         'content': '## AI 智能写作助手\n\n基于 LLM 的写作工具...',
         'github_url': 'https://github.com/xingyu/ai-writer', 'stars': 256, 'forks': 52,
         'screenshots': [],
         'team': [{'name': '王思远', 'avatar': '', 'role': '算法'},
                   {'name': '林雨晴', 'avatar': '', 'role': '后端'}],
         'start_date': datetime(2025, 6, 1, tzinfo=timezone.utc), 'status': 'active',
         'cover_image': 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&q=80'},
        {'slug': 'miniapp-toolkit', 'name': '校园工具箱小程序',
         'category': 'miniapp', 'tech_stack': ['微信小程序', 'TypeScript', '云开发'],
         'description': '集成成绩查询、课表导入、校园地图等实用功能的微信小程序。',
         'content': '## 校园工具箱\n\n微信小程序...',
         'github_url': 'https://github.com/xingyu/miniapp-toolkit', 'stars': 89, 'forks': 21,
         'screenshots': [],
         'team': [{'name': '孙晓萌', 'avatar': '', 'role': '前端'},
                   {'name': '周逸飞', 'avatar': '', 'role': '后端'}],
         'start_date': datetime(2025, 3, 1, tzinfo=timezone.utc),
         'end_date': datetime(2025, 8, 1, tzinfo=timezone.utc), 'status': 'completed',
         'cover_image': 'https://images.unsplash.com/photo-1551650975-87deedd944c3?w=800&q=80'},
        {'slug': 'code-judge', 'name': 'Online Judge 平台',
         'category': 'web', 'tech_stack': ['React', 'Go', 'Docker', 'Redis'],
         'description': '在线编程评测系统，支持 C/C++/Java/Python 多语言判题。',
         'content': '## Online Judge\n\n在线评测平台...',
         'github_url': 'https://github.com/xingyu/code-judge', 'stars': 312, 'forks': 67,
         'screenshots': [],
         'team': [{'name': '林雨晴', 'avatar': '', 'role': '后端'},
                   {'name': '周逸飞', 'avatar': '', 'role': '后端'}],
         'start_date': datetime(2025, 1, 1, tzinfo=timezone.utc), 'status': 'active',
         'cover_image': 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800&q=80'},
        {'slug': 'design-collab', 'name': 'Design Collab',
         'category': 'web', 'tech_stack': ['Next.js', 'tRPC', 'Prisma', 'WebSocket'],
         'description': '实时协作设计工具，支持多人同时编辑和白板讨论。',
         'content': '## Design Collab\n\n实时协作工具...',
         'github_url': 'https://github.com/xingyu/design-collab', 'stars': 178, 'forks': 34,
         'screenshots': [],
         'team': [{'name': '赵子涵', 'avatar': '', 'role': '前端'},
                   {'name': '张悦然', 'avatar': '', 'role': '设计'}],
         'start_date': datetime(2024, 10, 1, tzinfo=timezone.utc), 'status': 'completed',
         'cover_image': 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800&q=80'},
        {'slug': 'stock-predictor', 'name': '智能选股助手',
         'category': 'ai', 'tech_stack': ['Python', 'PyTorch', 'FastAPI', 'React'],
         'description': '基于深度学习的股票趋势预测与智能选股推荐系统。',
         'content': '## 智能选股\n\nAI 选股系统...',
         'github_url': 'https://github.com/xingyu/stock-predictor', 'stars': 445, 'forks': 98,
         'screenshots': [],
         'team': [{'name': '王思远', 'avatar': '', 'role': '算法'},
                   {'name': '刘明哲', 'avatar': '', 'role': '产品'}],
         'start_date': datetime(2024, 6, 1, tzinfo=timezone.utc), 'status': 'active',
         'cover_image': 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&q=80'},
        {'slug': 'edu-game', 'name': '编程启蒙游戏',
         'category': 'game', 'tech_stack': ['Unity', 'C#', 'Node.js', 'MongoDB'],
         'description': '面向青少年的编程思维启蒙游戏，通过趣味关卡学习编程基础。',
         'content': '## 编程游戏\n\n教育游戏...',
         'github_url': 'https://github.com/xingyu/edu-game', 'stars': 203, 'forks': 55,
         'screenshots': [],
         'team': [{'name': '孙晓萌', 'avatar': '', 'role': '前端'},
                   {'name': '陈星宇', 'avatar': '', 'role': '全栈'}],
         'start_date': datetime(2024, 3, 1, tzinfo=timezone.utc),
         'end_date': datetime(2024, 12, 1, tzinfo=timezone.utc), 'status': 'completed',
         'cover_image': 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=800&q=80'},
        {'slug': 'club-dashboard', 'name': '社团数据看板',
         'category': 'tools', 'tech_stack': ['Vue', 'ECharts', 'Express', 'SQLite'],
         'description': '社团运营数据可视化看板，实时展示成员活跃度、项目进度等指标。',
         'content': '## 数据看板\n\n可视化工具...',
         'github_url': 'https://github.com/xingyu/club-dashboard', 'stars': 67, 'forks': 12,
         'screenshots': [],
         'team': [{'name': '赵子涵', 'avatar': '', 'role': '前端'},
                   {'name': '周逸飞', 'avatar': '', 'role': '后端'}],
         'start_date': datetime(2024, 1, 1, tzinfo=timezone.utc), 'status': 'archived',
         'cover_image': 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80'},
        {'slug': 'smart-schedule', 'name': '智能排课系统',
         'category': 'tools', 'tech_stack': ['React', 'Python', 'Flask', 'PostgreSQL'],
         'description': '基于约束满足算法的自动排课工具，支持教师、教室、时间多维度优化。',
         'content': '## 排课系统\n\n智能排课...',
         'github_url': 'https://github.com/xingyu/smart-schedule', 'stars': 156, 'forks': 28,
         'screenshots': [],
         'team': [{'name': '林雨晴', 'avatar': '', 'role': '后端'},
                   {'name': '刘明哲', 'avatar': '', 'role': '产品'}],
         'start_date': datetime(2023, 9, 1, tzinfo=timezone.utc),
         'end_date': datetime(2024, 2, 1, tzinfo=timezone.utc), 'status': 'completed',
         'cover_image': 'https://images.unsplash.com/photo-1506784983877-45594efa4cbe?w=800&q=80'},
    ]
    for p in projects_data:
        db.session.add(Project(**p))


def _seed_awards():
    """生成 10 条示例获奖记录。

    涵盖国家级、省级、校级三个等级，包含程序设计、Web 开发、
    AI、设计、数学建模、网络安全等多个类别。
    部分奖项关联了对应的项目 slug。
    """
    awards_data = [
        {'slug': 'icpc-2025', 'name': 'ICPC 国际大学生程序设计竞赛 亚洲区银奖',
         'level': 'national', 'category': '程序设计', 'winner': '陈星宇、王思远、周逸飞',
         'issuer': 'ACM', 'date': '2025-12',
         'description': '经过 5 小时激烈角逐，团队在 200+ 参赛队伍中脱颖而出。'},
        {'slug': 'web-contest-2025', 'name': '全国大学生 Web 应用开发大赛 一等奖',
         'level': 'national', 'category': 'Web 开发', 'winner': '星雨作坊前端组',
         'issuer': '中国计算机学会', 'date': '2025-10',
         'description': '凭借 Campus Hub 项目获得评委一致好评。', 'related_project': 'campus-hub'},
        {'slug': 'ai-challenge-2025', 'name': '省高校 AI 创新挑战赛 特等奖',
         'level': 'provincial', 'category': '人工智能', 'winner': '王思远、林雨晴',
         'issuer': '省教育厅', 'date': '2025-08', 'related_project': 'ai-writer'},
        {'slug': 'design-award-2024', 'name': '校园 UI 设计大赛 最佳视觉奖',
         'level': 'school', 'category': '设计', 'winner': '张悦然',
         'issuer': '校团委', 'date': '2024-12'},
        {'slug': 'math-model-2024', 'name': '全国大学生数学建模竞赛 省一等奖',
         'level': 'provincial', 'category': '数学建模',
         'winner': '陈星宇、林雨晴、刘明哲', 'issuer': '中国工业与应用数学学会', 'date': '2024-09'},
        {'slug': 'hackathon-2024', 'name': '校园黑客马拉松大赛 冠军',
         'level': 'school', 'category': '创新开发', 'winner': '星雨作坊团队',
         'issuer': '校创新创业中心', 'date': '2024-06'},
        {'slug': 'security-ctf-2024', 'name': '全国大学生信息安全竞赛 二等奖',
         'level': 'national', 'category': '网络安全', 'winner': '周逸飞、赵子涵',
         'issuer': '教育部', 'date': '2024-05'},
        {'slug': 'ui-design-2023', 'name': '中国大学生计算机设计大赛 省二等奖',
         'level': 'provincial', 'category': '设计', 'winner': '张悦然、孙晓萌',
         'issuer': '省教育厅', 'date': '2023-08'},
        {'slug': 'robot-2023', 'name': '省大学生机器人大赛 三等奖',
         'level': 'provincial', 'category': '机器人', 'winner': '王思远、陈星宇',
         'issuer': '省科技协会', 'date': '2023-05'},
        {'slug': 'startup-2022', 'name': '校园创新创业大赛 银奖',
         'level': 'school', 'category': '创新创业', 'winner': '星雨作坊创业组',
         'issuer': '校团委', 'date': '2022-11'},
    ]
    for i, a in enumerate(awards_data):
        db.session.add(Award(sort_order=i, **a))


def _seed_blogs():
    """生成 4 篇示例博客文章。

    包含技术文章（React 19、LLM 微调）、活动记录（ICPC 参赛）、
    公告（招新通知）四种分类。
    """
    blogs_data = [
        {'slug': 'react-19-new-features', 'title': 'React 19 新特性全解析：Server Components 与 Actions',
         'excerpt': 'React 19 带来了许多令人兴奋的新特性，本文将深入探讨 Server Components 和 Server Actions 的使用方法。',
         'content': '## React 19 新特性\n\n...',
         'category': 'tech', 'tags': ['React', '前端', 'JavaScript'],
         'author_name': '赵子涵', 'date': '2025-12-15',
         'cover_image': 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800&q=80'},
        {'slug': 'llm-practice', 'title': '从零开始微调大语言模型：社团 AI 项目的实战经验',
         'excerpt': '分享我们如何在有限的算力资源下完成 LLM 微调，以及在 AI 写作助手项目中的实践经验。',
         'content': '## LLM 微调实战\n\n...',
         'category': 'tech', 'tags': ['AI', 'LLM', 'Python'],
         'author_name': '王思远', 'date': '2025-11-20',
         'cover_image': 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&q=80'},
        {'slug': 'icpc-2025-review', 'title': 'ICPC 2025 参赛回顾：那些不眠的刷题之夜',
         'excerpt': '记录我们团队备战 ICPC 的半年历程，分享训练方法和比赛策略。',
         'content': '## ICPC 参赛回顾\n\n...',
         'category': 'event', 'tags': ['竞赛', 'ICPC', '算法'],
         'author_name': '陈星宇', 'date': '2025-12-20'},
        {'slug': 'new-semester-recruitment', 'title': '2026 春季招新公告：寻找下一个创造者',
         'excerpt': '星雨作坊 2026 年春季招新正式开始！欢迎所有热爱技术的同学加入我们。',
         'content': '## 招新公告\n\n...',
         'category': 'announcement', 'tags': ['招新', '公告'],
         'author_name': '陈星宇', 'date': '2026-02-01',
         'cover_image': 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&q=80'},
    ]
    for b in blogs_data:
        db.session.add(BlogPost(**b))
