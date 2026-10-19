"""一次性同步首页文案：仅替换仍是旧默认值的字段，保留后台已修改的内容。

用法（容器内）：
    python scripts/sync_site_copy.py
"""

import json

from app import create_app
from defaults import DEFAULT_SITE_CONFIG
from models import SiteConfig, db

# 旧默认值 -> 新默认值；只有当前值仍等于旧默认值时才替换
UPDATES = {
    'hero': {
        'title': ('用代码点亮创想，让热爱掷地有声。', DEFAULT_SITE_CONFIG['hero']['title']),
        'description': (
            '星雨作坊是一个由学生自主运营的开发社团。我们相信，每一行代码背后都藏着改变世界的力量。'
            '这里聚集了一群热爱技术的创造者——从前端到后端，从算法到产品，我们用项目说话。',
            DEFAULT_SITE_CONFIG['hero']['description'],
        ),
    },
    'about': {
        'title': ('一个由学生打造的创造者社群', DEFAULT_SITE_CONFIG['about']['title']),
    },
    'footer': {
        'slogan': ('星雨作坊 — 用代码编织创意，让热爱发光。', DEFAULT_SITE_CONFIG['footer']['slogan']),
    },
}


def main():
    app = create_app()
    changed = []
    with app.app_context():
        for key, fields in UPDATES.items():
            cfg = SiteConfig.query.filter_by(config_key=key).first()
            if not cfg or not isinstance(cfg.config_value, dict):
                continue
            value = dict(cfg.config_value)
            for field, (old, new) in fields.items():
                if value.get(field) == old:
                    value[field] = new
                    changed.append(f'{key}.{field}')
            cfg.config_value = value
        db.session.commit()
    print(json.dumps({'updated': changed}, ensure_ascii=False))


if __name__ == '__main__':
    main()
