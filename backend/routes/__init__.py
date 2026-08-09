"""星雨作坊 CMS — 路由蓝图注册中心

将各功能模块的 Flask Blueprint 统一在此导入并汇总。
通过 app.py 中的 create_app() 自动注册所有蓝图到 /api 前缀下。
"""

from .public import public_bp      # 公开 API：站点配置、页面、成员展示、申请、留言、统一登录
from .admin import admin_bp        # 管理后台 API：CRUD 操作、文件上传、数据导入导出（需 JWT 鉴权）
from .member import member_bp      # 成员门户 API：个人中心、项目管理、资源中心、证书、通知（需 member JWT 鉴权）
from .assistant import assistant_bp  # 智能项目管理智能体 API：对话、需求解析、方案落地（需 member JWT 鉴权）

# 所有蓝图的统一列表，供 app.py 遍历注册
all_blueprints = [
    public_bp,
    admin_bp,
    member_bp,
    assistant_bp,
]
