"""星雨作坊 CMS — 应用配置

基于环境变量的应用配置模块，提供开发/生产两套配置。
所有敏感配置均通过环境变量注入，带有合理的默认值。
"""

import os
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv

# 加载 .env 文件中的环境变量
load_dotenv()

# 项目根目录（backend/ 目录）
BASE_DIR = os.path.abspath(os.path.dirname(__file__))


def _get_bool(name, default=False):
    """将环境变量字符串解析为布尔值。

    支持的 true 值: '1', 'true', 'yes', 'on'（不区分大小写）
    其他任何值（包括空字符串和未设置）均视为 False。

    Args:
        name: 环境变量名
        default: 变量未设置时的默认值

    Returns:
        bool: 解析后的布尔值
    """
    val = os.environ.get(name, '')
    if not val:
        return default
    return val.lower() in ('1', 'true', 'yes', 'on')


def _read_secret(name, default=''):
    """Read a secret from its direct environment variable or a Docker secret file."""
    direct_value = os.environ.get(name)
    if direct_value:
        return direct_value

    secret_file = os.environ.get(f'{name}_FILE')
    if secret_file is None:
        return default

    try:
        return Path(secret_file).read_text(encoding='utf-8').rstrip('\r\n')
    except (OSError, UnicodeError) as error:
        raise RuntimeError(f'Could not read secret file for {name}') from error


class Config:
    """Flask 应用基础配置类。

    包含数据库、JWT 认证、CORS 跨域、文件上传、频率限制等所有配置项。
    通过环境变量覆盖默认值，支持 12-Factor App 部署模式。
    """

    # ─── Flask 核心配置 ───
    # SECRET_KEY: Flask session 签名密钥，生产环境务必通过环境变量覆盖
    SECRET_KEY = _read_secret('SECRET_KEY', 'xingyu-studio-secret-2026')

    # ─── 数据库配置 ───
    # 默认使用 SQLite（文件存储在 backend/ 目录下）
    # 生产环境可通过 DATABASE_URL 环境变量切换到 PostgreSQL/MySQL
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        'DATABASE_URL',
        f'sqlite:///{os.path.join(BASE_DIR, "xingyu_cms.db")}',
    )
    # 关闭 Flask-SQLAlchemy 的修改追踪（节省内存）
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # ─── JWT 认证配置 ───
    # JWT_SECRET_KEY: 用于签发和验证 JWT token
    JWT_SECRET_KEY = _read_secret('JWT_SECRET_KEY', 'xingyu-jwt-secret-2026')
    # 访问令牌有效期：24 小时
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=24)

    # ─── CORS 跨域配置 ───
    # 允许的前端源地址列表（逗号分隔）
    # 开发环境下包含 Vite (5173) 和 Create React App (3000) 的默认端口
    CORS_ORIGINS = os.environ.get(
        'CORS_ORIGINS',
        'http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173',
    ).split(',')

    # ─── 文件上传配置 ───
    # UPLOAD_FOLDER: 上传文件存储目录
    UPLOAD_FOLDER = os.environ.get('UPLOAD_FOLDER', os.path.join(BASE_DIR, 'uploads'))
    # MAX_CONTENT_LENGTH: 单次上传文件大小上限（默认 10MB）
    MAX_CONTENT_LENGTH = int(os.environ.get('MAX_CONTENT_LENGTH', 10 * 1024 * 1024))
    # Optional object storage. Local disk remains the default until explicitly enabled.
    OSS_ENABLED = _get_bool('OSS_ENABLED', False)
    OSS_PROVIDER = os.environ.get('OSS_PROVIDER', 'aliyun')
    OSS_ACCESS_KEY_ID = _read_secret('OSS_ACCESS_KEY_ID')
    OSS_ACCESS_KEY_SECRET = _read_secret('OSS_ACCESS_KEY_SECRET')
    OSS_BUCKET = os.environ.get('OSS_BUCKET', '')
    OSS_ENDPOINT = os.environ.get('OSS_ENDPOINT', '')
    OSS_PREFIX = os.environ.get('OSS_PREFIX', '')
    OSS_PUBLIC_BASE_URL = os.environ.get('OSS_PUBLIC_BASE_URL', '')

    # OpenAI-compatible OCR uses its own settings and falls back to AI_* values.
    OCR_ENABLED = _get_bool('OCR_ENABLED', False)
    OCR_PROVIDER = os.environ.get('OCR_PROVIDER', '')
    OCR_API_KEY = _read_secret('OCR_API_KEY')
    OCR_ENDPOINT = os.environ.get('OCR_ENDPOINT', '')
    OCR_MODEL = os.environ.get('OCR_MODEL', '')

    # Generic AI configuration is intentionally status-only until a product feature uses it.
    AI_ENABLED = _get_bool('AI_ENABLED', False)
    AI_PROVIDER = os.environ.get('AI_PROVIDER', '')
    AI_API_KEY = _read_secret('AI_API_KEY')
    AI_BASE_URL = os.environ.get('AI_BASE_URL', '')
    AI_MODEL = os.environ.get('AI_MODEL', '')
    PUBLIC_BASE_URL = os.environ.get('PUBLIC_BASE_URL', '')

    # ─── QQ 互联登录 ───
    # QQ_APP_KEY 建议通过 *_FILE 注入；未配置时登录页会显示为不可用。
    QQ_LOGIN_ENABLED = _get_bool('QQ_LOGIN_ENABLED', False)
    QQ_APP_ID = os.environ.get('QQ_APP_ID', '').strip()
    QQ_APP_KEY = _read_secret('QQ_APP_KEY')
    QQ_REDIRECT_URI = os.environ.get('QQ_REDIRECT_URI', '').strip() or (
        f'{PUBLIC_BASE_URL.rstrip("/")}/api/auth/qq/callback' if PUBLIC_BASE_URL else ''
    )
    QQ_OAUTH_STATE_MAX_AGE = int(os.environ.get('QQ_OAUTH_STATE_MAX_AGE', 600))
    QQ_BIND_TOKEN_MINUTES = int(os.environ.get('QQ_BIND_TOKEN_MINUTES', 15))

    # ─── 外部通知通道 ───
    # 站内通知始终写入数据库；飞书/邮件仅在显式启用且配置完整时旁路发送。
    NOTIFICATION_EXTERNAL_TIMEOUT = int(os.environ.get('NOTIFICATION_EXTERNAL_TIMEOUT', 10))
    NOTIFICATION_FEISHU_ENABLED = _get_bool('NOTIFICATION_FEISHU_ENABLED', False)
    FEISHU_WEBHOOK_URL = _read_secret('FEISHU_WEBHOOK_URL')
    NOTIFICATION_EMAIL_ENABLED = _get_bool('NOTIFICATION_EMAIL_ENABLED', False)
    SMTP_HOST = os.environ.get('SMTP_HOST', '')
    SMTP_PORT = int(os.environ.get('SMTP_PORT', 587))
    SMTP_FROM = os.environ.get('SMTP_FROM', '')
    SMTP_USERNAME = _read_secret('SMTP_USERNAME')
    SMTP_PASSWORD = _read_secret('SMTP_PASSWORD')
    SMTP_USE_TLS = _get_bool('SMTP_USE_TLS', True)
    SMTP_USE_SSL = _get_bool('SMTP_USE_SSL', False)

    # ─── 智能体定时提醒扫描 ───
    # REMINDER_SCAN_ENABLED: 是否启动提醒扫描
    # REMINDER_SCHEDULER_BACKEND: thread / apscheduler / disabled
    # REMINDER_SCHEDULER_LEADER: 多实例部署时仅 leader 实例启动扫描
    # REMINDER_SCAN_INTERVAL: 扫描间隔（秒）
    REMINDER_SCAN_ENABLED = _get_bool('REMINDER_SCAN_ENABLED', True)
    REMINDER_SCHEDULER_BACKEND = os.environ.get(
        'REMINDER_SCHEDULER_BACKEND', 'thread'
    ).strip().lower()
    REMINDER_SCHEDULER_TIMEZONE = os.environ.get('REMINDER_SCHEDULER_TIMEZONE', 'UTC')
    REMINDER_SCHEDULER_LEADER = _get_bool('REMINDER_SCHEDULER_LEADER', True)
    REMINDER_SCAN_INTERVAL = int(os.environ.get('REMINDER_SCAN_INTERVAL', 300))

    # ─── 智能体调用防护 ───
    # ASSISTANT_RATE_LIMIT_PER_MINUTE: 每个成员每分钟最多调用智能体端点的次数
    # ASSISTANT_MAX_MESSAGE_LENGTH: 单条用户消息最大字符数
    ASSISTANT_RATE_LIMIT_PER_MINUTE = int(
        os.environ.get('ASSISTANT_RATE_LIMIT_PER_MINUTE', 30)
    )
    ASSISTANT_MAX_MESSAGE_LENGTH = int(
        os.environ.get('ASSISTANT_MAX_MESSAGE_LENGTH', 4000)
    )
    # 智能体单次回答的最大输出 token 数
    ASSISTANT_CHAT_MAX_TOKENS = int(
        os.environ.get('ASSISTANT_CHAT_MAX_TOKENS', 2048)
    )
    # 需求拆解单次生成的最大输出 token 数
    ASSISTANT_PARSE_MAX_TOKENS = int(
        os.environ.get('ASSISTANT_PARSE_MAX_TOKENS', 4000)
    )

    # Development and tests retain their demonstration data. Production must
    # explicitly bootstrap its first administrator and never use demo users.
    SEED_DEMO_DATA = True
    BOOTSTRAP_ADMIN_USERNAME = os.environ.get('BOOTSTRAP_ADMIN_USERNAME', '').strip()
    BOOTSTRAP_ADMIN_PASSWORD = _read_secret('BOOTSTRAP_ADMIN_PASSWORD')

    # ─── 频率限制配置 ───
    # 登录失败限流：同一 IP + 账号每分钟最多失败次数
    LOGIN_RATE_LIMIT_PER_MINUTE = int(os.environ.get('LOGIN_RATE_LIMIT_PER_MINUTE', 10))
    # 招新申请表单的同 IP/邮箱/手机号提交间隔（分钟）
    APPLICATION_RATE_LIMIT_MINUTES = int(os.environ.get('APPLICATION_RATE_LIMIT_MINUTES', 10))

    # ─── 服务器运行配置 ───
    # APP_HOST: 监听地址（0.0.0.0 表示接受所有网络接口）
    APP_HOST = os.environ.get('APP_HOST', '0.0.0.0')
    # APP_PORT: 监听端口
    APP_PORT = int(os.environ.get('APP_PORT', 5000))
    # APP_DEBUG: 调试模式开关（生产环境应设为 false）
    APP_DEBUG = _get_bool('APP_DEBUG', True)


class DevelopmentConfig(Config):
    """开发环境配置。

    继承基础配置，开启 Flask Debug 模式（热重载 + 详细错误页面）。
    """
    DEBUG = Config.APP_DEBUG


class ProductionConfig(Config):
    """生产环境配置。

    继承基础配置，强制关闭 Debug 模式以保证安全性。
    """
    DEBUG = False
    SEED_DEMO_DATA = False


class TestingConfig(Config):
    """Testing configuration with Flask's testing mode enabled."""
    TESTING = True
    DEBUG = False


# 配置注册表：根据 FLASK_ENV 环境变量选择对应配置类
# 使用方式: app.config.from_object(config['development'])
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig,  # 当 FLASK_ENV 未设置或无效时使用的默认配置
}
