"""批量导入 / 更新成员账号（用于上线铺成员名单）。

用法（在 backend 容器里执行）:

    # 先干跑一遍，只看会改什么，不写库
    docker exec -i xingyu-backend python import_members.py members.json --dry-run

    # 确认无误后正式导入
    docker exec -i xingyu-backend python import_members.py members.json

输入文件是 JSON 数组，每项支持的字段（除 name 外都可省略）:

    [
      {"name": "穆天宇", "student_id": "2400310419", "role": "技术负责人",
       "group": "逐云组", "skills": ["Vue", "Python"], "bio": "……",
       "avatar": "https://…", "github": "https://github.com/…"}
    ]

行为约定:
  - 按 学号 匹配已有成员；没有学号时按 姓名 匹配。
  - 匹配到就更新字段（只更新文件里出现的字段），匹配不到就新建。
  - 新建且有学号的成员会写入统一初始密码（默认取 defaults.INITIAL_MEMBER_PASSWORD，
    可用 --password 覆盖；加 --no-password 则不设密码，成员需自行注册激活）。
  - 已存在的成员不会被重置密码。
  - group 既支持 product/design/dev/content，也支持中文组名（流光组/星绘组/逐云组/拾焰组/回声组）。
"""

import argparse
import json
import sys

from app import create_app
from defaults import INITIAL_MEMBER_PASSWORD
from models import db, Member

# 中文组名 → 数据库分组键
GROUP_ALIASES = {
    '流光组': 'product',
    '星绘组': 'design',
    '逐云组': 'dev',
    '拾焰组': 'content',
    '回声组': 'content',
    'product': 'product',
    'design': 'design',
    'dev': 'dev',
    'content': 'content',
}

# 允许从 JSON 直接映射到模型的标量字段
SCALAR_FIELDS = ('name', 'role', 'bio', 'avatar', 'github', 'blog', 'email', 'grade', 'student_id')
VALID_GROUPS = {'product', 'design', 'dev', 'content'}


def parse_args(argv):
    parser = argparse.ArgumentParser(description='批量导入成员账号')
    parser.add_argument('source', help='成员 JSON 文件路径（数组）')
    parser.add_argument('--password', default=INITIAL_MEMBER_PASSWORD,
                        help='新建成员的初始密码（默认取 defaults.INITIAL_MEMBER_PASSWORD）')
    parser.add_argument('--no-password', action='store_true',
                        help='不设置初始密码（成员需自行注册激活）')
    parser.add_argument('--dry-run', action='store_true', help='只预览，不写数据库')
    return parser.parse_args(argv)


def normalize_group(raw):
    if raw is None:
        return None
    key = GROUP_ALIASES.get(str(raw).strip())
    return key if key in VALID_GROUPS else None


def load_records(path):
    with open(path, encoding='utf-8') as handle:
        data = json.load(handle)
    if not isinstance(data, list):
        raise ValueError('输入 JSON 必须是数组')
    records = []
    for index, item in enumerate(data, start=1):
        if not isinstance(item, dict):
            raise ValueError(f'第 {index} 项不是对象')
        name = str(item.get('name') or '').strip()
        if not name:
            raise ValueError(f'第 {index} 项缺少 name')
        records.append(item)
    return records


def apply_record(member, item, warnings, index):
    """把 JSON 里出现的字段写进成员对象（新建与更新都走这里）。"""
    for field in SCALAR_FIELDS:
        if field in item:
            value = item[field]
            if isinstance(value, str):
                value = value.strip() or None
            setattr(member, field, value)

    if 'skills' in item:
        skills = item['skills'] or []
        if not isinstance(skills, list):
            warnings.append(f'第 {index} 项 skills 不是数组，已忽略')
        else:
            member.skills = [str(s).strip() for s in skills if str(s).strip()]

    if 'group' in item:
        group = normalize_group(item['group'])
        if group:
            member.group = group
        else:
            warnings.append(f'第 {index} 项（{member.name}）分组 {item["group"]!r} 无法识别，已忽略')

    # 兼容旧备份字段名：description → bio，links.github → github，links.portfolio → blog
    if item.get('description') and not item.get('bio'):
        member.bio = str(item['description']).strip() or None
    links = item.get('links')
    if isinstance(links, dict):
        if links.get('github') and not item.get('github'):
            member.github = str(links['github']).strip() or None
        if links.get('portfolio') and not item.get('blog'):
            member.blog = str(links['portfolio']).strip() or None


def main(argv=None):
    args = parse_args(argv if argv is not None else sys.argv[1:])

    try:
        records = load_records(args.source)
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(f'读取失败: {exc}')
        return 1

    app = create_app()
    warnings = []
    created = updated = 0

    with app.app_context():
        for index, item in enumerate(records, start=1):
            student_id = (str(item.get('student_id') or '').strip()) or None
            name = str(item['name']).strip()

            member = None
            if student_id:
                member = Member.query.filter_by(student_id=student_id).first()
            if member is None:
                member = Member.query.filter_by(name=name).first()

            if member is None:
                member = Member(status='active', is_alumni=False)
                apply_record(member, item, warnings, index)
                member.name = name
                if member.student_id and not args.no_password:
                    member.set_password(args.password)
                if not args.dry_run:
                    db.session.add(member)
                created += 1
                action = '新建'
            else:
                apply_record(member, item, warnings, index)
                updated += 1
                action = '更新'

            print(f'  [{action}] {member.name:<6} 学号={member.student_id or "-":<12} '
                  f'分组={member.group or "-":<8} 角色={member.role or "-"}')

        if not args.dry_run:
            db.session.commit()

    print()
    for warning in warnings:
        print(f'⚠️  {warning}')
    mode = '（dry-run，未写库）' if args.dry_run else ''
    print(f'完成：新建 {created} 人，更新 {updated} 人 {mode}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
