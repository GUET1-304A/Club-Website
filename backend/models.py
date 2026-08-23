"""星雨作坊 CMS — 数据库模型定义

本模块定义了整个 CMS 系统的所有 SQLAlchemy 数据模型，包括：

数据实体:
  - SiteConfig      — 站点配置键值存储（JSON 值）
  - Page            — CMS 可编辑页面
  - AdminUser       — 管理员账号
  - Member          — 成员档案（兼成员登录身份）
  - Project         — 项目作品（公开展示 + 内部管理）
  - Milestone       — 项目里程碑/阶段
  - Task            — 项目任务
  - Award           — 获奖荣誉记录
  - BlogPost        — 博客/新闻文章
  - Application     — 招新申请表
  - ContactMessage  — 联系我们留言
  - ResourceFolder  — 资源中心文件夹
  - ResourceFile    — 资源中心文件
  - Certificate     — 成员提交的证书记录
  - Notification    — 成员通知
  - WeeklyReport    — 成员周报（智能项目管理智能体的数据基础）
  - Reminder        — 提醒记录（任务截止 / 周报提交 / 自定义提醒）
  - AgentConversation — 智能体对话会话（成员隔离，含标题与消息）
  - AgentMessage    — 智能体对话消息（角色/内容/工具调用记录）

所有 DateTime 字段使用 UTC 时区。
所有模型均提供 to_dict() 方法用于 JSON 序列化。
"""

from datetime import datetime, timezone
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash

# SQLAlchemy 实例（由 app.py 中的 create_app() 执行 db.init_app(app) 完成初始化）
db = SQLAlchemy()


# ═══════════════════════════════════════════════════════════════
# 站点配置 & 页面
# ═══════════════════════════════════════════════════════════════

class SiteConfig(db.Model):
    """站点配置键值存储模型。

    所有配置值以 JSON 格式存储，支持任意嵌套结构。
    前端通过 /api/config 接口获取配置，管理员通过 /api/admin/config 修改。
    系统内部使用的配置以 'system' 为 key 存储，不会暴露给公开 API。
    """
    __tablename__ = 'site_config'

    id = db.Column(db.Integer, primary_key=True)
    config_key = db.Column(db.String(50), unique=True, nullable=False)   # 配置键名（如 'hero', 'footer', 'sections'）
    config_value = db.Column(db.JSON, nullable=False)                    # 配置值（JSON 格式，支持对象/数组/字符串等）
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),      # 创建时自动设置
        onupdate=lambda: datetime.now(timezone.utc),     # 更新时自动刷新
    )

    def to_dict(self):
        """序列化为前端使用的字典格式。

        Returns:
            dict: 包含 id, key, value, updated_at 的字典
        """
        return {
            'id': self.id,
            'key': self.config_key,
            'value': self.config_value,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class Page(db.Model):
    """CMS 可编辑页面模型。

    每页通过 slug 唯一标识（如 'about', 'recruitment'）。
    content 字段为 JSON 格式，前端根据约定的结构渲染页面内容。
    支持通过管理后台的富文本编辑器在线编辑。
    """
    __tablename__ = 'pages'

    id = db.Column(db.Integer, primary_key=True)
    slug = db.Column(db.String(50), unique=True, nullable=False)         # URL 友好的页面标识符
    title = db.Column(db.String(200), nullable=False)                    # 页面标题
    content = db.Column(db.JSON, nullable=False)                         # 页面内容（JSON 结构，前端依此渲染）
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    def to_dict(self):
        """序列化页面数据。

        Returns:
            dict: 包含 id, slug, title, content, updated_at 的字典
        """
        return {
            'id': self.id,
            'slug': self.slug,
            'title': self.title,
            'content': self.content,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


# ═══════════════════════════════════════════════════════════════
# 认证
# ═══════════════════════════════════════════════════════════════

class AdminUser(db.Model):
    """管理员账户模型。

    用于 CMS 后台管理系统的登录认证。
    密码通过 werkzeug.security 进行哈希存储，从不以明文形式保存。
    JWT token 的 identity 使用 admin 用户的 id（字符串形式）。

    角色 (role) 取值:
      - 'admin'   — 管理员：拥有全部后台权限
      - 'teacher' — 教师：可审阅周报、审核证书、查看成员/项目、管理提醒
    """
    __tablename__ = 'admin_users'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)     # 管理员用户名（唯一）
    password_hash = db.Column(db.String(255), nullable=False)            # bcrypt 哈希后的密码
    role = db.Column(db.String(20), nullable=False, default='admin')      # admin / teacher
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def set_password(self, password):
        """设置密码（自动进行 bcrypt 哈希）。

        Args:
            password: 明文密码字符串
        """
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        """验证密码是否匹配。

        Args:
            password: 待验证的明文密码

        Returns:
            bool: 密码正确返回 True，否则返回 False
        """
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        """序列化管理員信息（不包含密码哈希）。

        Returns:
            dict: 包含 id, username, created_at 的字典
        """
        must_change_password = (
            self.username == 'admin'
            and self.check_password('admin123')
        )
        return {
            'id': self.id,
            'username': self.username,
            'role': self.role,
            'mustChangePassword': must_change_password,
            'securityWarnings': (
                ['默认管理员密码仍在使用，请立即在权限管理中修改。']
                if must_change_password else []
            ),
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


# ═══════════════════════════════════════════════════════════════
# 成员（公开展示 + 登录认证）
# ═══════════════════════════════════════════════════════════════

class Member(db.Model):
    """成员档案与认证模型。

    该模型同时承担两个职责：
    1. 公开展示：在前端展示成员信息（姓名、头像、技能等）
    2. 成员登录：成员可通过学号或邮箱登录成员门户

    分组 (group) 取值对应前端类别:
      - 'product'  — 产品组（流光组）
      - 'design'   — 设计组（星绘组）
      - 'dev'      — 开发组（逐云组）
      - 'content'  — 内容组（拾焰组）

    状态 (status) 取值:
      - 'active'   — 活跃成员（公开展示，可登录）
      - 'inactive' — 非活跃成员（不公开展示，不可登录）
    """
    __tablename__ = 'members'

    # ── 基本档案字段 ──
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)                     # 成员姓名
    avatar = db.Column(db.String(500), nullable=True)                    # 头像 URL
    role = db.Column(db.String(100), nullable=True)                      # 角色/职位（如 "前端组长"）
    group = db.Column(db.String(20), nullable=True)                      # 所属分组: product/design/dev/content
    skills = db.Column(db.JSON, nullable=True)                           # 技能列表（JSON 数组，如 ["React", "Python"]）
    github = db.Column(db.String(255), nullable=True)                    # GitHub 主页链接
    blog = db.Column(db.String(255), nullable=True)                      # 个人博客链接
    email = db.Column(db.String(120), nullable=True)                     # 邮箱地址（可用于登录）
    bio = db.Column(db.Text, nullable=True)                              # 个人简介（支持长文本）
    grade = db.Column(db.String(20), nullable=True)                      # 年级（如 "2022级"）
    is_alumni = db.Column(db.Boolean, default=False)                     # 是否为校友（已毕业成员）
    status = db.Column(db.String(20), nullable=False, default='active')  # 成员状态: active（活跃）/ inactive（停用）
    sort_order = db.Column(db.Integer, default=0)                        # 排序序号（数字越小越靠前）

    # ── 登录认证字段 ──
    password_hash = db.Column(db.String(255), nullable=True)             # bcrypt 密码哈希（未注册时为 None）
    phone = db.Column(db.String(30), nullable=True)                      # 手机号
    student_id = db.Column(db.String(50), nullable=True)                 # 学号（唯一标识，可用于登录）
    notification_prefs = db.Column(db.JSON, nullable=True)               # 通知偏好设置（如 {"task_assigned": true}）
    last_login_at = db.Column(db.DateTime, nullable=True)                # 最后登录时间

    # ── 时间戳 ──
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # ── 密码辅助方法 ──

    def set_password(self, password):
        """设置成员登录密码（自动 bcrypt 哈希）。

        成员首次注册时调用此方法激活账号。
        """
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        """验证登录密码。

        Returns:
            bool: 密码匹配返回 True
        """
        return check_password_hash(self.password_hash, password)

    # ── 序列化方法（按权限分级）──

    def to_dict(self):
        """完整序列化（管理员视角）。

        包含所有字段，包括邮箱、手机号、学号等隐私信息。
        仅在管理后台使用。

        Returns:
            dict: 成员完整信息字典（camelCase 键名）
        """
        return {
            'id': self.id,
            'name': self.name,
            'avatar': self.avatar,
            'role': self.role,
            'group': self.group,
            'skills': self.skills or [],
            'github': self.github,
            'blog': self.blog,
            'email': self.email,
            'phone': self.phone,
            'studentId': self.student_id,
            'bio': self.bio,
            'grade': self.grade,
            'isAlumni': self.is_alumni,
            'status': self.status,
            'sortOrder': self.sort_order,
            'notificationPrefs': self.notification_prefs or {},
            'lastLoginAt': self.last_login_at.isoformat() if self.last_login_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }

    def to_public_dict(self):
        """公开序列化（访客视角）。

        隐藏邮箱、手机号、学号等隐私字段。
        用于网站首页的成员展示和公开 API。

        Returns:
            dict: 仅包含公开信息的字典
        """
        return {
            'id': self.id,
            'name': self.name,
            'avatar': self.avatar,
            'role': self.role,
            'group': self.group,
            'skills': self.skills or [],
            'github': self.github,
            'blog': self.blog,
            'bio': self.bio,
            'grade': self.grade,
            'isAlumni': self.is_alumni,
        }

    def to_member_dict(self):
        """成员自身视角的序列化。

        包含个人隐私信息，但排除管理字段（sortOrder, status）。
        用于成员门户中查看和编辑自己的资料。

        Returns:
            dict: 成员自身可见的完整信息字典
        """
        d = self.to_dict()
        d.pop('sortOrder', None)   # 排序序号仅管理员可见
        d.pop('status', None)      # 账号状态仅管理员可见
        return d


# ═══════════════════════════════════════════════════════════════
# 项目（公开展示 + 内部管理）
# ═══════════════════════════════════════════════════════════════

class Project(db.Model):
    """项目作品模型。

    同时服务于：
    1. 公开展示：在官网项目页展示作品集（名称、截图、技术栈、GitHub Star 等）
    2. 内部管理：项目管理看板（里程碑、任务分配、进度追踪）

    分类 (category) 取值:
      - 'web'      — Web 应用
      - 'miniapp'  — 微信小程序
      - 'ai'       — AI/算法项目
      - 'tools'    — 工具类
      - 'game'     — 游戏

    状态 (status) 取值:
      - 'active'    — 进行中
      - 'completed' — 已完成
      - 'archived'  — 已归档
    """
    __tablename__ = 'projects'

    # ── 身份标识 ──
    id = db.Column(db.Integer, primary_key=True)
    slug = db.Column(db.String(100), unique=True, nullable=False)       # URL 友好的唯一标识符
    name = db.Column(db.String(200), nullable=False)                    # 项目名称

    # ── 展示字段 ──
    cover_image = db.Column(db.String(500), nullable=True)              # 封面图片 URL
    category = db.Column(db.String(20), nullable=True)                  # 项目分类: web/miniapp/ai/tools/game
    tech_stack = db.Column(db.JSON, nullable=True)                      # 技术栈列表（JSON 数组）
    description = db.Column(db.Text, nullable=True)                     # 项目简介（纯文本）
    content = db.Column(db.Text, nullable=True)                         # 项目详情（Markdown 格式）
    github_url = db.Column(db.String(255), nullable=True)               # GitHub 仓库链接
    demo_url = db.Column(db.String(255), nullable=True)                 # 在线演示链接
    stars = db.Column(db.Integer, default=0)                            # GitHub Stars 数量（手动同步或填入）
    forks = db.Column(db.Integer, default=0)                            # GitHub Forks 数量
    screenshots = db.Column(db.JSON, nullable=True)                     # 项目截图 URL 列表（JSON 数组）
    team = db.Column(db.JSON, nullable=True)                            # 团队成员列表（JSON 数组，每项含 name/avatar/role）

    # ── 管理字段 ──
    status = db.Column(db.String(20), nullable=False, default='active') # 项目状态: active/completed/archived
    start_date = db.Column(db.DateTime, nullable=True)                  # 项目开始日期
    end_date = db.Column(db.DateTime, nullable=True)                    # 项目结束日期
    owner_id = db.Column(db.Integer, db.ForeignKey('members.id'), nullable=True)  # 项目负责人 ID
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # ── 关联关系 ──
    owner = db.relationship('Member', backref='owned_projects', foreign_keys=[owner_id])

    def to_dict(self):
        """完整序列化（管理员/成员视角）。

        包含管理字段（里程碑数、任务数、完成数）。

        Returns:
            dict: 项目完整信息字典
        """
        return {
            'id': self.id,
            'slug': self.slug,
            'name': self.name,
            'coverImage': self.cover_image,
            'category': self.category,
            'techStack': self.tech_stack or [],
            'description': self.description,
            'content': self.content,
            'githubUrl': self.github_url,
            'demoUrl': self.demo_url,
            'stars': self.stars,
            'forks': self.forks,
            'screenshots': self.screenshots or [],
            'team': self.team or [],
            'status': self.status,
            'startDate': self.start_date.isoformat() if self.start_date else None,
            'endDate': self.end_date.isoformat() if self.end_date else None,
            'ownerId': self.owner_id,
            'ownerName': self.owner.name if self.owner else None,
            'milestoneCount': Milestone.query.filter_by(project_id=self.id).count(),
            'taskCount': Task.query.filter_by(project_id=self.id).count(),
            'taskDoneCount': Task.query.filter_by(project_id=self.id, status='done').count(),
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }

    def to_public_dict(self):
        """公开序列化（访客视角）。

        隐藏内部管理字段（里程碑数、任务数等），仅保留公开展示所需信息。

        Returns:
            dict: 项目公开信息字典
        """
        return {
            'id': self.id,
            'slug': self.slug,
            'name': self.name,
            'coverImage': self.cover_image,
            'category': self.category,
            'techStack': self.tech_stack or [],
            'description': self.description,
            'content': self.content,
            'githubUrl': self.github_url,
            'demoUrl': self.demo_url,
            'stars': self.stars,
            'forks': self.forks,
            'screenshots': self.screenshots or [],
            'team': self.team or [],
            'status': self.status,
            'startDate': self.start_date.isoformat() if self.start_date else None,
            'endDate': self.end_date.isoformat() if self.end_date else None,
            'ownerName': self.owner.name if self.owner else None,
        }


# ═══════════════════════════════════════════════════════════════
# 里程碑 & 任务（项目管理）
# ═══════════════════════════════════════════════════════════════

class Milestone(db.Model):
    """项目里程碑/阶段模型。

    每个项目可包含多个里程碑，每个里程碑下可包含多个任务。
    里程碑用于划分项目的不同开发阶段（如 MVP、Beta 版、正式版等）。

    状态取值: pending（未开始）/ in_progress（进行中）/ completed（已完成）
    """
    __tablename__ = 'milestones'

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=False)  # 所属项目 ID
    name = db.Column(db.String(200), nullable=False)                                   # 里程碑名称
    description = db.Column(db.Text, nullable=True)                                    # 里程碑描述
    due_date = db.Column(db.DateTime, nullable=True)                                   # 截止日期
    status = db.Column(db.String(20), nullable=False, default='pending')               # 状态: pending/in_progress/completed
    sort_order = db.Column(db.Integer, default=0)                                      # 排序序号
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    # ── 关联关系 ──
    project = db.relationship('Project', backref='milestones')

    def to_dict(self):
        """序列化里程碑数据（含任务统计）。

        Returns:
            dict: 包含任务总数和已完成数的里程碑信息字典
        """
        return {
            'id': self.id,
            'project_id': self.project_id,
            'name': self.name,
            'description': self.description,
            'dueDate': self.due_date.isoformat() if self.due_date else None,
            'status': self.status,
            'sortOrder': self.sort_order,
            'taskCount': Task.query.filter_by(milestone_id=self.id).count(),
            'taskDoneCount': Task.query.filter_by(milestone_id=self.id, status='done').count(),
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class Task(db.Model):
    """项目任务模型。

    任务属于某个项目和可选的某个里程碑，可分配给某个成员。
    支持看板拖拽排序（通过 sort_order 字段）。

    状态 (status) 取值对应看板列:
      - 'todo'        — 待办
      - 'in_progress' — 进行中
      - 'review'      — 待审核
      - 'done'        — 已完成
      - 'blocked'     — 已阻塞

    优先级 (priority) 取值:
      - 'low'    — 低
      - 'medium' — 中
      - 'high'   — 高
      - 'urgent' — 紧急
    """
    __tablename__ = 'tasks'

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=False)    # 所属项目 ID
    milestone_id = db.Column(db.Integer, db.ForeignKey('milestones.id'), nullable=True) # 所属里程碑 ID（可选）
    assignee_id = db.Column(db.Integer, db.ForeignKey('members.id'), nullable=True)     # 负责人 ID（可选）
    title = db.Column(db.String(200), nullable=False)                                    # 任务标题
    description = db.Column(db.Text, nullable=True)                                      # 任务描述
    status = db.Column(db.String(20), nullable=False, default='todo')                    # 任务状态
    priority = db.Column(db.String(20), nullable=False, default='medium')                # 优先级
    due_date = db.Column(db.DateTime, nullable=True)                                     # 截止日期
    sort_order = db.Column(db.Integer, default=0)                                        # 排序序号（看板拖拽排序）
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # ── 关联关系 ──
    project = db.relationship('Project', backref='tasks')
    milestone = db.relationship('Milestone', backref='tasks')
    assignee = db.relationship('Member', backref='assigned_tasks', foreign_keys=[assignee_id])

    def to_dict(self):
        """序列化任务数据。

        通过关联关系自动填充项目名称、里程碑名称和负责人姓名，
        减少前端额外查询。

        Returns:
            dict: 任务完整信息字典
        """
        return {
            'id': self.id,
            'project_id': self.project_id,
            'projectName': self.project.name if self.project else None,
            'milestone_id': self.milestone_id,
            'milestoneName': self.milestone.name if self.milestone else None,
            'assignee_id': self.assignee_id,
            'assigneeName': self.assignee.name if self.assignee else None,
            'title': self.title,
            'description': self.description,
            'status': self.status,
            'priority': self.priority,
            'dueDate': self.due_date.isoformat() if self.due_date else None,
            'sortOrder': self.sort_order,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


# ═══════════════════════════════════════════════════════════════
# 获奖荣誉
# ═══════════════════════════════════════════════════════════════

class Award(db.Model):
    """获奖荣誉记录模型。

    用于公开展示社团获得的各类竞赛和评选奖项。

    等级 (level) 取值:
      - 'national'   — 国家级
      - 'provincial' — 省级
      - 'school'     — 校级
      - 'other'      — 其他
    """
    __tablename__ = 'awards'

    id = db.Column(db.Integer, primary_key=True)
    slug = db.Column(db.String(100), unique=True, nullable=False)       # URL 友好的唯一标识符
    name = db.Column(db.String(300), nullable=False)                    # 奖项全称
    level = db.Column(db.String(20), nullable=False)                    # 获奖等级: national/provincial/school/other
    category = db.Column(db.String(50), nullable=True)                  # 奖项类别（如 "程序设计", "Web 开发"）
    winner = db.Column(db.String(200), nullable=False)                  # 获奖者（如 "陈星宇、王思远"）
    issuer = db.Column(db.String(200), nullable=True)                   # 颁发机构
    advisor = db.Column(db.String(200), nullable=True)                  # 指导教师（证书归档时保留）
    date = db.Column(db.String(20), nullable=True)                      # 获奖日期（如 "2025-12"，字符串格式便于灵活展示）
    description = db.Column(db.Text, nullable=True)                     # 获奖描述/参赛过程
    certificate_images = db.Column(db.JSON, nullable=True)              # 证书图片 URL 列表（JSON 数组）
    related_project = db.Column(db.String(100), nullable=True)          # 关联项目 slug（可链接到对应项目详情页）
    certificate_id = db.Column(db.Integer, nullable=True)               # 来源证书 ID（审核通过后自动归档生成）
    sort_order = db.Column(db.Integer, default=0)                       # 排序序号
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    def to_dict(self):
        """序列化获奖记录。

        Returns:
            dict: 获奖信息字典
        """
        return {
            'id': self.id,
            'slug': self.slug,
            'name': self.name,
            'level': self.level,
            'category': self.category,
              'winner': self.winner,
              'issuer': self.issuer,
              'advisor': self.advisor,
              'date': self.date,
            'description': self.description,
              'certificateImages': self.certificate_images or [],
              'relatedProject': self.related_project,
              'certificateId': self.certificate_id,
              'sortOrder': self.sort_order,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


# ═══════════════════════════════════════════════════════════════
# 博客/新闻
# ═══════════════════════════════════════════════════════════════

class BlogPost(db.Model):
    """博客/新闻文章模型。

    支持 Markdown 格式正文，JSON 标签数组。
    可关联到成员作者，也支持独立作者名（非成员作者）。

    分类 (category) 取值:
      - 'tech'         — 技术文章
      - 'event'        — 活动记录
      - 'summary'      — 总结报告
      - 'announcement' — 公告通知
    """
    __tablename__ = 'blog_posts'

    id = db.Column(db.Integer, primary_key=True)
    slug = db.Column(db.String(100), unique=True, nullable=False)       # URL 友好的唯一标识符
    title = db.Column(db.String(300), nullable=False)                   # 文章标题
    excerpt = db.Column(db.String(500), nullable=True)                  # 文章摘要（用于列表页展示）
    content = db.Column(db.Text, nullable=True)                         # 正文内容（Markdown 格式）
    category = db.Column(db.String(20), nullable=False, default='tech') # 分类: tech/event/summary/announcement
    tags = db.Column(db.JSON, nullable=True)                            # 标签列表（JSON 数组，如 ["React", "前端"]）
    author_name = db.Column(db.String(100), nullable=True)              # 作者显示名
    author_avatar = db.Column(db.String(500), nullable=True)            # 作者头像 URL
    author_id = db.Column(db.Integer, db.ForeignKey('members.id'), nullable=True)  # 作者关联的成员 ID（可选）
    date = db.Column(db.String(20), nullable=True)                      # 展示日期（如 "2025-12-15"）
    cover_image = db.Column(db.String(500), nullable=True)              # 封面图片 URL
    is_published = db.Column(db.Boolean, default=True)                  # 是否已发布（false 时为草稿）
    pinned = db.Column(db.Boolean, default=False)                       # 是否置顶（置顶文章优先展示）
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # ── 关联关系 ──
    author = db.relationship('Member', backref='blog_posts', foreign_keys=[author_id])

    def to_dict(self):
        """序列化博客文章。

        Returns:
            dict: 文章信息字典（含嵌套的作者信息）
        """
        return {
            'id': self.id,
            'slug': self.slug,
            'title': self.title,
            'excerpt': self.excerpt,
            'content': self.content,
            'category': self.category,
            'tags': self.tags or [],
            'author': {
                'name': self.author_name,
                'avatar': self.author_avatar,
            } if self.author_name else None,
            'authorId': self.author_id,
            'date': self.date,
            'coverImage': self.cover_image,
            'isPublished': self.is_published,
            'pinned': self.pinned,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class BlogRead(db.Model):
    """成员博客已读记录（用于公告已读状态追踪）。

    每名成员对每篇文章最多一条记录，重复阅读幂等更新 read_at。
    """
    __tablename__ = 'blog_reads'
    __table_args__ = (
        db.UniqueConstraint('member_id', 'blog_id', name='uq_member_blog_read'),
    )

    id = db.Column(db.Integer, primary_key=True)
    member_id = db.Column(db.Integer, db.ForeignKey('members.id'), nullable=False)  # 阅读者
    blog_id = db.Column(db.Integer, db.ForeignKey('blog_posts.id'), nullable=False)  # 文章
    read_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    member = db.relationship('Member', backref='blog_reads', foreign_keys=[member_id])
    blog = db.relationship('BlogPost', backref='reads', foreign_keys=[blog_id])

    def to_dict(self):
        return {
            'id': self.id,
            'memberId': self.member_id,
            'blogId': self.blog_id,
            'readAt': self.read_at.isoformat() if self.read_at else None,
        }


# ═══════════════════════════════════════════════════════════════
# 招新申请
# ═══════════════════════════════════════════════════════════════

class Application(db.Model):
    """成员招新申请表模型。

    访客通过官网的加入我们表单提交申请。
    包含基本的个人信息、意向分组、个人经历和申请动机。
    管理员可在后台审核并标记状态。

    状态 (status) 取值:
      - 'pending'  — 待审核
      - 'approved' — 已通过
      - 'rejected' — 已拒绝
    """
    __tablename__ = 'applications'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)                    # 申请人姓名
    student_id = db.Column(db.String(50), nullable=False)               # 学号
    grade_major = db.Column(db.String(120), nullable=False)             # 年级+专业
    phone = db.Column(db.String(30), nullable=False)                    # 手机号
    email = db.Column(db.String(120), nullable=False)                   # 邮箱
    group_id = db.Column(db.String(50), nullable=False)                 # 申请的分组 ID（如 'dev', 'design'）
    group_name = db.Column(db.String(100), nullable=False)              # 申请的分组名称（如 '逐云组'）
    github_url = db.Column(db.String(255), nullable=True)               # GitHub 主页（可选）
    portfolio_url = db.Column(db.String(255), nullable=True)            # 作品集链接（可选）
    experience = db.Column(db.Text, nullable=True)                      # 技术/项目经历
    motivation = db.Column(db.Text, nullable=False)                     # 申请动机（必填，至少 10 个字）
    session = db.Column(db.String(50), nullable=True)                   # 招新批次（如 "2026-spring"）
    ip_address = db.Column(db.String(64), nullable=True)                # 提交时 IP 地址（用于频率限制和防刷）
    status = db.Column(db.String(20), nullable=False, default='pending') # 审核状态: pending/approved/rejected
    admin_note = db.Column(db.Text, nullable=True)                      # 管理员备注
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))   # 提交时间
    processed_at = db.Column(db.DateTime, nullable=True)                # 审核处理时间

    def to_dict(self):
        """序列化申请记录。

        Returns:
            dict: 申请信息字典
        """
        return {
            'id': self.id,
            'name': self.name,
            'student_id': self.student_id,
            'grade_major': self.grade_major,
            'phone': self.phone,
            'email': self.email,
            'group_id': self.group_id,
            'group_name': self.group_name,
            'github_url': self.github_url,
            'portfolio_url': self.portfolio_url,
            'experience': self.experience,
            'motivation': self.motivation,
            'session': self.session,
            'ip_address': self.ip_address,
            'status': self.status,
            'admin_note': self.admin_note,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'processed_at': self.processed_at.isoformat() if self.processed_at else None,
        }


# ═══════════════════════════════════════════════════════════════
# 联系我们留言
# ═══════════════════════════════════════════════════════════════

class ContactMessage(db.Model):
    """联系我们留言模型。

    支持实名留言和匿名留言两种模式。
    管理员可回复留言，系统自动记录回复时间。

    状态 (status) 取值:
      - 'unread'   — 未读
      - 'read'     — 已读
      - 'replied'  — 已回复
    """
    __tablename__ = 'contact_messages'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, default='匿名用户')  # 留言者姓名（匿名时为 "匿名用户"）
    email = db.Column(db.String(120), nullable=False, default='')          # 留言者邮箱
    phone = db.Column(db.String(30), nullable=True)                        # 留言者电话（可选）
    subject = db.Column(db.String(200), nullable=False)                    # 留言主题
    message = db.Column(db.Text, nullable=False)                           # 留言内容（至少 5 个字）
    ip_address = db.Column(db.String(64), nullable=True)                   # 提交时 IP 地址（用于频率限制）
    is_anonymous = db.Column(db.Boolean, default=False)                    # 是否匿名
    status = db.Column(db.String(20), nullable=False, default='unread')    # 处理状态: unread/read/replied
    admin_note = db.Column(db.Text, nullable=True)                         # 管理员内部备注
    reply = db.Column(db.Text, nullable=True)                              # 管理员回复内容
    replied_at = db.Column(db.DateTime, nullable=True)                     # 回复时间
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))  # 留言提交时间
    read_at = db.Column(db.DateTime, nullable=True)                        # 首次阅读时间

    def to_dict(self):
        """序列化留言记录。

        Returns:
            dict: 留言信息字典
        """
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'phone': self.phone,
            'subject': self.subject,
            'message': self.message,
            'ip_address': self.ip_address,
            'is_anonymous': self.is_anonymous,
            'status': self.status,
            'admin_note': self.admin_note,
            'reply': self.reply,
            'replied_at': self.replied_at.isoformat() if self.replied_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'read_at': self.read_at.isoformat() if self.read_at else None,
        }


# ═══════════════════════════════════════════════════════════════
# 资源中心（知识库）
# ═══════════════════════════════════════════════════════════════

class ResourceFolder(db.Model):
    """资源中心文件夹模型。

    支持树形层级结构（通过 parent_id 自引用）。
    成员可在此创建文件夹并上传文件，形成团队知识库。
    """
    __tablename__ = 'resource_folders'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)                     # 文件夹名称
    parent_id = db.Column(db.Integer, db.ForeignKey('resource_folders.id'), nullable=True)  # 父文件夹 ID（自引用，支持嵌套）
    created_by = db.Column(db.Integer, db.ForeignKey('members.id'), nullable=True)          # 创建者 ID
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # ── 关联关系 ──
    parent = db.relationship('ResourceFolder', remote_side=[id], backref='children')  # 自引用：父文件夹
    creator = db.relationship('Member', backref='created_folders', foreign_keys=[created_by])

    def to_dict(self):
        """序列化文件夹信息（含文件数量统计）。

        Returns:
            dict: 文件夹信息字典
        """
        return {
            'id': self.id,
            'name': self.name,
            'parentId': self.parent_id,
            'createdBy': self.created_by,
            'fileCount': ResourceFile.query.filter_by(folder_id=self.id, is_deleted=False).count(),
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class ResourceFile(db.Model):
    """资源中心文件模型。

    文件存储在 uploads/ 目录下，数据库记录元信息。
    删除采用软删除（标记 is_deleted=True），文件可恢复。
    """
    __tablename__ = 'resource_files'

    id = db.Column(db.Integer, primary_key=True)
    folder_id = db.Column(db.Integer, db.ForeignKey('resource_folders.id'), nullable=True)  # 所属文件夹 ID
    name = db.Column(db.String(300), nullable=False)                  # 显示文件名
    file_path = db.Column(db.String(500), nullable=False)             # 文件存储路径（如 /uploads/abc123.pdf）
    file_type = db.Column(db.String(50), nullable=True)               # 文件扩展名（如 'pdf', 'zip'）
    file_size = db.Column(db.Integer, default=0)                      # 文件大小（字节）
    uploaded_by = db.Column(db.Integer, db.ForeignKey('members.id'), nullable=True)  # 上传者 ID
    is_deleted = db.Column(db.Boolean, default=False)                 # 软删除标记（true 表示在回收站中）
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # ── 关联关系 ──
    folder = db.relationship('ResourceFolder', backref='files')
    uploader = db.relationship('Member', backref='uploaded_files', foreign_keys=[uploaded_by])

    def to_dict(self):
        """序列化文件信息。

        Returns:
            dict: 文件信息字典
        """
        return {
            'id': self.id,
            'folderId': self.folder_id,
            'name': self.name,
            'filePath': self.file_path,
            'fileType': self.file_type,
            'fileSize': self.file_size,
            'uploadedBy': self.uploaded_by,
            'uploaderName': self.uploader.name if self.uploader else None,
            'isDeleted': self.is_deleted,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


# ═══════════════════════════════════════════════════════════════
# 证书管理
# ═══════════════════════════════════════════════════════════════

class Certificate(db.Model):
    """成员证书记录模型。

    成员可在门户中上传自己的获奖证书/荣誉证明。
    支持证书图片上传、OCR 文字识别与结构化字段提取结果存储。
    提交后需管理员审核（pending → verified / rejected）。
    审核通过后自动归档为 Award（实验室总成果库）并通知成员。

    状态 (status) 取值:
      - 'pending'  — 待审核
      - 'verified' — 已认证
      - 'rejected' — 已拒绝
    """
    __tablename__ = 'certificates'

    id = db.Column(db.Integer, primary_key=True)
    member_id = db.Column(db.Integer, db.ForeignKey('members.id'), nullable=False)      # 提交者 ID
    name = db.Column(db.String(300), nullable=False)                                     # 证书/奖项名称
    level = db.Column(db.String(20), nullable=True)                                      # 获奖等级: national/provincial/school/other
    category = db.Column(db.String(50), nullable=True)                                   # 证书类别
    winner = db.Column(db.String(200), nullable=True)                                    # 获奖者
    issuer = db.Column(db.String(200), nullable=True)                                    # 颁发机构
    advisor = db.Column(db.String(200), nullable=True)                                   # 指导教师
    date = db.Column(db.String(20), nullable=True)                                       # 获奖日期
    description = db.Column(db.Text, nullable=True)                                      # 补充描述
    images = db.Column(db.JSON, nullable=True)                                           # 证书图片 URL 列表（JSON 数组）
    ocr_text = db.Column(db.Text, nullable=True)                                         # OCR 识别文字结果
    ocr_fields = db.Column(db.JSON, nullable=True)                                       # OCR 结构化字段（JSON）
    related_project = db.Column(db.String(100), nullable=True)                           # 关联项目 slug
    status = db.Column(db.String(20), nullable=False, default='pending')                 # 审核状态
    review_note = db.Column(db.Text, nullable=True)                                      # 审核批注（通过说明/驳回原因）
    reviewed_by = db.Column(db.Integer, nullable=True)                                   # 审核管理员 ID
    reviewed_at = db.Column(db.DateTime, nullable=True)                                  # 审核时间
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # ── 关联关系 ──
    member = db.relationship('Member', backref='certificates', foreign_keys=[member_id])

    def to_dict(self):
        """序列化证书数据。

        Returns:
            dict: 证书信息字典
        """
        return {
            'id': self.id,
            'memberId': self.member_id,
            'memberName': self.member.name if self.member else None,
            'name': self.name,
            'level': self.level,
            'category': self.category,
            'winner': self.winner,
            'issuer': self.issuer,
            'advisor': self.advisor,
            'date': self.date,
            'description': self.description,
            'images': self.images or [],
            'ocrText': self.ocr_text,
            'ocrFields': self.ocr_fields or {},
            'relatedProject': self.related_project,
            'status': self.status,
            'reviewNote': self.review_note,
            'reviewedBy': self.reviewed_by,
            'reviewedAt': self.reviewed_at.isoformat() if self.reviewed_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


# ═══════════════════════════════════════════════════════════════
# 通知
# ═══════════════════════════════════════════════════════════════

class Notification(db.Model):
    """成员通知模型。

    系统在任务分配、状态变更、里程碑完成等事件发生时自动创建通知。
    也支持管理员发送公告类通知。

    类型 (type) 取值:
      - 'task_assigned' — 任务分配
      - 'status_change' — 状态变更
      - 'milestone'     — 里程碑事件
      - 'announcement'  — 系统公告
    """
    __tablename__ = 'notifications'

    id = db.Column(db.Integer, primary_key=True)
    member_id = db.Column(db.Integer, db.ForeignKey('members.id'), nullable=False)  # 接收通知的成员 ID
    type = db.Column(db.String(50), nullable=False)           # 通知类型
    title = db.Column(db.String(200), nullable=False)         # 通知标题
    body = db.Column(db.Text, nullable=True)                  # 通知正文
    link = db.Column(db.String(500), nullable=True)           # 跳转链接（如 /member/projects/1）
    is_read = db.Column(db.Boolean, default=False)            # 是否已读
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))  # 通知创建时间

    # ── 关联关系 ──
    member = db.relationship('Member', backref='notifications', foreign_keys=[member_id])

    def to_dict(self):
        """序列化通知数据。

        Returns:
            dict: 通知信息字典
        """
        return {
            'id': self.id,
            'memberId': self.member_id,
            'type': self.type,
            'title': self.title,
            'body': self.body,
            'link': self.link,
            'isRead': self.is_read,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class AdminNotification(db.Model):
    """管理员/教师通知模型。

    用于教师侧闭环：新周报提交、AI 审核报告生成等事件发生时，
    向全部管理员账号推送站内通知，避免教师只能被动打开后台查看。

    类型 (type) 取值:
      - 'weekly_report_submitted' — 新周报待审阅
      - 'weekly_report_analyzed'  — 周报 AI 分析完成
      - 'certificate_review'      — 证书待审核（预留）
    """
    __tablename__ = 'admin_notifications'

    id = db.Column(db.Integer, primary_key=True)
    admin_id = db.Column(db.Integer, db.ForeignKey('admin_users.id'), nullable=False)  # 接收通知的管理员 ID
    type = db.Column(db.String(50), nullable=False)             # 通知类型
    title = db.Column(db.String(200), nullable=False)           # 通知标题
    body = db.Column(db.Text, nullable=True)                    # 通知正文
    link = db.Column(db.String(500), nullable=True)             # 跳转链接
    is_read = db.Column(db.Boolean, default=False)              # 是否已读
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    admin = db.relationship('AdminUser', backref='notifications', foreign_keys=[admin_id])

    def to_dict(self):
        """序列化管理员通知数据。"""
        return {
            'id': self.id,
            'adminId': self.admin_id,
            'type': self.type,
            'title': self.title,
            'body': self.body,
            'link': self.link,
            'isRead': self.is_read,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


# ═══════════════════════════════════════════════════════════════
# 周报 & 提醒（智能项目管理智能体）
# ═══════════════════════════════════════════════════════════════

class WeeklyReport(db.Model):
    """成员周报模型。

    学生按周提交工作汇报，智能体可对周报进行 AI 分析：
    比对任务要求，判定完成度与进度，生成审核报告供教师审阅。

    状态 (status) 取值:
      - 'draft'     — 草稿（可编辑）
      - 'submitted' — 已提交（待审阅）
      - 'reviewed'  — 已审阅

    content 为 JSON 结构，约定字段:
      {
        "done":   "本周完成的工作",
        "plan":   "下周计划",
        "issues": "遇到的问题/风险",
        "summary": "本周总结（可选）"
      }

    ai_analysis 为 JSON 结构，由 AI 分析生成:
      {
        "score": 0-100,
        "completion": "完成度评估",
        "risks": ["风险1", ...],
        "suggestions": ["建议1", ...],
        "report": "给教师的简短审核报告"
      }
    """
    __tablename__ = 'weekly_reports'

    id = db.Column(db.Integer, primary_key=True)
    member_id = db.Column(db.Integer, db.ForeignKey('members.id'), nullable=False)    # 周报提交者
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=True)   # 关联项目（可选）
    week_start = db.Column(db.Date, nullable=True)                                    # 周起始日期
    week_end = db.Column(db.Date, nullable=True)                                      # 周结束日期
    content = db.Column(db.JSON, nullable=False)                                      # 周报内容（JSON）
    completion_rate = db.Column(db.Float, nullable=True)                              # AI 判定的完成度（0-100）
    ai_analysis = db.Column(db.JSON, nullable=True)                                   # AI 分析结果（JSON）
    status = db.Column(db.String(20), nullable=False, default='draft')                # draft/submitted/reviewed
    review_note = db.Column(db.Text, nullable=True)                                   # 教师/管理员审阅批注
    reviewed_by = db.Column(db.Integer, nullable=True)                                # 审阅人（管理员 ID）
    submitted_at = db.Column(db.DateTime, nullable=True)                              # 提交时间
    reviewed_at = db.Column(db.DateTime, nullable=True)                               # 审阅时间
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # ── 关联关系 ──
    member = db.relationship('Member', backref='weekly_reports', foreign_keys=[member_id])
    project = db.relationship('Project', backref='weekly_reports', foreign_keys=[project_id])

    def to_dict(self):
        """序列化周报数据（含成员名、项目名）。"""
        return {
            'id': self.id,
            'memberId': self.member_id,
            'memberName': self.member.name if self.member else None,
            'projectId': self.project_id,
            'projectName': self.project.name if self.project else None,
            'weekStart': self.week_start.isoformat() if self.week_start else None,
            'weekEnd': self.week_end.isoformat() if self.week_end else None,
            'content': self.content or {},
            'completionRate': self.completion_rate,
            'aiAnalysis': self.ai_analysis,
            'status': self.status,
            'reviewNote': self.review_note,
            'reviewedBy': self.reviewed_by,
            'submittedAt': self.submitted_at.isoformat() if self.submitted_at else None,
            'reviewedAt': self.reviewed_at.isoformat() if self.reviewed_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class Reminder(db.Model):
    """提醒记录模型。

    支持两类来源：
      1. 用户/管理员主动创建（type='custom'，如"每周五提醒我交周报"）
      2. 系统定时扫描自动生成（type='task_due'/'report_submit'/'review'）

    类型 (type) 取值:
      - 'task_due'     — 任务截止提醒
      - 'report_submit'— 周报提交提醒
      - 'review'       — 周报审阅提醒
      - 'custom'       — 自定义提醒

    状态 (status) 取值:
      - 'pending'  — 待触发
      - 'sent'     — 已发送（已生成站内通知）
      - 'done'     — 已完成（用户手动标记）
      - 'cancelled'— 已取消
    """
    __tablename__ = 'reminders'

    id = db.Column(db.Integer, primary_key=True)
    member_id = db.Column(db.Integer, db.ForeignKey('members.id'), nullable=False)    # 提醒接收者
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=True)   # 关联项目（可选）
    type = db.Column(db.String(20), nullable=False, default='custom')                 # 提醒类型
    title = db.Column(db.String(200), nullable=False)                                 # 提醒标题
    message = db.Column(db.Text, nullable=True)                                       # 提醒正文
    link = db.Column(db.String(500), nullable=True)                                   # 跳转链接
    scheduled_at = db.Column(db.DateTime, nullable=True)                              # 计划触发时间（None 表示立即）
    sent_at = db.Column(db.DateTime, nullable=True)                                   # 实际发送时间
    status = db.Column(db.String(20), nullable=False, default='pending')              # pending/sent/done/cancelled
    created_by = db.Column(db.Integer, nullable=True)                                 # 创建者（成员 ID 或 None 表示系统）
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    # ── 关联关系 ──
    member = db.relationship('Member', backref='reminders', foreign_keys=[member_id])
    project = db.relationship('Project', backref='reminders', foreign_keys=[project_id])

    def to_dict(self):
        """序列化提醒数据。"""
        return {
            'id': self.id,
            'memberId': self.member_id,
            'memberName': self.member.name if self.member else None,
            'projectId': self.project_id,
            'projectName': self.project.name if self.project else None,
            'type': self.type,
            'title': self.title,
            'message': self.message,
            'link': self.link,
            'scheduledAt': self.scheduled_at.isoformat() if self.scheduled_at else None,
            'sentAt': self.sent_at.isoformat() if self.sent_at else None,
            'status': self.status,
            'createdBy': self.created_by,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


# ═══════════════════════════════════════════════════════════════
# 智能体对话（会话隔离 + 历史持久化）
# ═══════════════════════════════════════════════════════════════

class AgentConversation(db.Model):
    """智能体对话会话模型。

    每个会话属于且仅属于一个成员（member_id 隔离），成员只能查看/操作
    自己的会话。会话保存标题、消息列表，用于切换对话时恢复上下文。
    """
    __tablename__ = 'agent_conversations'

    id = db.Column(db.Integer, primary_key=True)
    member_id = db.Column(db.Integer, db.ForeignKey('members.id'), nullable=False)  # 所属成员
    title = db.Column(db.String(200), nullable=False, default='新对话')             # 会话标题
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # ── 关联关系 ──
    member = db.relationship('Member', backref='agent_conversations', foreign_keys=[member_id])
    messages = db.relationship(
        'AgentMessage',
        backref='conversation',
        cascade='all, delete-orphan',
        order_by='AgentMessage.id',
    )

    def to_dict(self):
        """序列化会话（含最近一条消息摘要）。"""
        last_message = self.messages[-1] if self.messages else None
        return {
            'id': self.id,
            'memberId': self.member_id,
            'title': self.title,
            'messageCount': len(self.messages),
            'lastMessage': last_message.content if last_message else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class AgentMessage(db.Model):
    """智能体对话消息模型。

    记录每一轮用户消息与助手回复，助手消息同时保存工具调用记录
    （tool_calls JSON），前端据此还原工具执行过程。
    """
    __tablename__ = 'agent_messages'

    id = db.Column(db.Integer, primary_key=True)
    conversation_id = db.Column(
        db.Integer,
        db.ForeignKey('agent_conversations.id'),
        nullable=False,
    )                                                                   # 所属会话
    role = db.Column(db.String(20), nullable=False)                     # user / assistant
    content = db.Column(db.Text, nullable=False)                        # 消息内容
    tool_calls = db.Column(db.JSON, nullable=True)                      # 工具调用记录（JSON 数组）
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        """序列化消息。"""
        return {
            'id': self.id,
            'conversationId': self.conversation_id,
            'role': self.role,
            'content': self.content,
            'toolCalls': self.tool_calls,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
