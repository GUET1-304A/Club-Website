import sys
from pathlib import Path

import pytest


BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from app import create_app


# 测试专用的演示成员账号。
# 产品种子（app._seed_members）现在是社团真实成员名录 —— 他们没有学号与密码，
# 而测试需要能登录、能按姓名解析指派的成员，所以在测试库里单独铺这一套。
TEST_MEMBER_ACCOUNTS = [
    ('2022001', '陈星宇', '负责人 / 产品+开发', 'product',
     ['React', 'Vue', 'Node.js', 'Python'], '热爱前端与开源，相信技术的力量可以改变世界。', 'xingyu@example.com'),
    ('2022002', '林雨晴', '副社长 / 后端开发', 'dev',
     ['Go', 'Python', 'Docker', 'K8s'], '专注于后端架构和分布式系统。', 'yuqing@example.com'),
    ('2023001', '赵子涵', '前端组长', 'dev',
     ['TypeScript', 'React', 'Next.js', 'Tailwind'], '追求极致的用户体验和界面设计。', None),
    ('2023002', '王思远', '算法组长', 'dev',
     ['Python', 'PyTorch', 'NLP', 'CV'], '研究方向为自然语言处理和计算机视觉。', None),
    ('2023003', '张悦然', '设计组长', 'design',
     ['Figma', 'PS', 'AI', 'Blender'], '相信好的设计能让技术更有温度。', 'yueran@example.com'),
    ('2023004', '刘明哲', '产品组长', 'product',
     ['产品设计', '用户研究', '数据分析'], '专注产品思维与用户体验。', None),
    ('2024001', '孙晓萌', '前端开发', 'dev',
     ['Vue', 'TypeScript', 'GSAP', 'Three.js'], '喜欢用动画和交互讲好每一个产品故事。', None),
    ('2024002', '周逸飞', '后端开发', 'dev',
     ['Java', 'Spring', 'MySQL', 'Redis'], '对高并发和系统稳定性充满热情。', None),
]


@pytest.fixture(scope="module", autouse=True)
def demo_member_accounts(app):
    """把测试库里的成员换成固定的演示账号（统一密码 member123）。"""
    from models import db, Member

    with app.app_context():
        Member.query.delete()
        db.session.commit()
        for index, (student_id, name, role, group, skills, bio, email) in enumerate(TEST_MEMBER_ACCOUNTS):
            member = Member(
                student_id=student_id,
                name=name,
                role=role,
                group=group,
                skills=skills,
                bio=bio,
                email=email,
                sort_order=index,
                status='active',
                is_alumni=False,
            )
            member.set_password('member123')
            db.session.add(member)
        db.session.commit()
    yield


@pytest.fixture(scope="module")
def app(tmp_path_factory):
    db_path = tmp_path_factory.mktemp("runtime-smoke") / "test.db"

    with pytest.MonkeyPatch.context() as monkeypatch:
        monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_path}")
        monkeypatch.setenv("FLASK_ENV", "testing")
        monkeypatch.setenv("APP_DEBUG", "false")
        yield create_app("testing")


@pytest.fixture
def client(app):
    return app.test_client()
