"""CLI 命令行接口端到端测试。

真实启动 Flask 服务（随机端口），通过 click CliRunner 调用 cli 包命令，
验证 CLI 与 Web REST API 数据实时同步。
"""

import sys
import threading
from pathlib import Path

import pytest
from click.testing import CliRunner
from werkzeug.serving import make_server


REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from cli.client import ApiClient  # noqa: E402
from cli.xingyu import cli  # noqa: E402
from models import Award, Member, Milestone, Project, Task, WeeklyReport, db  # noqa: E402


@pytest.fixture(scope="module")
def live_server(app):
    """在随机端口启动 Flask 服务，返回 base_url。"""
    server = make_server("127.0.0.1", 0, app, threaded=True)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_port}"
    finally:
        server.shutdown()
        thread.join(timeout=5)


@pytest.fixture
def runner(tmp_path, monkeypatch):
    monkeypatch.setenv("XINGYU_CLI_HOME", str(tmp_path / "cli-home"))
    return CliRunner()


def run_cli(runner, base_url, *args):
    return runner.invoke(cli, ["--base-url", base_url, *args], catch_exceptions=False)


def admin_login_via_cli(runner, base_url):
    result = run_cli(
        runner, base_url, "auth", "login",
        "--account", "admin", "--password", "admin123",
    )
    assert result.exit_code == 0, result.output
    assert "管理员" in result.output


def member_login_via_cli(runner, base_url, account="2023001"):
    result = run_cli(
        runner, base_url, "auth", "login",
        "--account", account, "--password", "member123",
    )
    assert result.exit_code == 0, result.output
    assert "成员" in result.output


def test_cli_auth_login_status_logout(runner, live_server):
    admin_login_via_cli(runner, live_server)
    result = run_cli(runner, live_server, "auth", "status")
    assert result.exit_code == 0
    assert "管理员" in result.output
    assert "admin" in result.output

    result = run_cli(runner, live_server, "auth", "logout")
    assert result.exit_code == 0
    result = run_cli(runner, live_server, "auth", "status")
    assert "未登录" in result.output


def test_cli_project_create_list_and_sync(runner, live_server, app):
    admin_login_via_cli(runner, live_server)
    project_name = "CLI 端到端测试项目"
    created_ids = []
    try:
        result = run_cli(
            runner, live_server, "project", "create",
            "--name", project_name, "--category", "web",
            "--description", "由 CLI 创建",
        )
        assert result.exit_code == 0, result.output
        assert project_name in result.output

        # Web API 立即可见（数据同步）
        client = ApiClient(live_server)
        projects = client.get("/api/projects")
        created = [p for p in projects if p["name"] == project_name]
        assert created
        created_ids.append(created[0]["id"])

        result = run_cli(runner, live_server, "project", "list", "--status", "active")
        assert result.exit_code == 0
        assert project_name in result.output

        result = run_cli(runner, live_server, "project", "show", str(created_ids[0]))
        assert result.exit_code == 0
        assert "CLI 端到端测试项目" in result.output
    finally:
        with app.app_context():
            for project_id in created_ids:
                project = db.session.get(Project, project_id)
                if project is not None:
                    Task.query.filter_by(project_id=project.id).delete()
                    Milestone.query.filter_by(project_id=project.id).delete()
                    db.session.delete(project)
            db.session.commit()


def test_cli_task_lifecycle_via_admin(runner, live_server, app):
    admin_login_via_cli(runner, live_server)
    project_id = None
    task_id = None
    admin_client = None
    try:
        created = run_cli(
            runner, live_server, "project", "create",
            "--name", "CLI 任务测试项目",
        )
        assert created.exit_code == 0
        token = ApiClient(live_server).post("/api/auth/login", {
            "account": "admin", "password": "admin123",
        })["token"]
        admin_client = ApiClient(live_server, token=token)
        projects = admin_client.get("/api/projects")
        project_id = [p["id"] for p in projects if p["name"] == "CLI 任务测试项目"][0]

        result = run_cli(
            runner, live_server, "task", "create",
            "--project", str(project_id), "--title", "CLI 创建的任务",
            "--priority", "high", "--due-date", "2026-09-01",
        )
        assert result.exit_code == 0, result.output
        assert "CLI 创建的任务" in result.output

        result = run_cli(runner, live_server, "task", "list", "--project", str(project_id))
        assert result.exit_code == 0
        assert "CLI 创建的任务" in result.output

        tasks = admin_client.get(f"/api/admin/projects/{project_id}/tasks")
        task_id = tasks[0]["id"]
        result = run_cli(runner, live_server, "task", "status", str(task_id), "--status", "in_progress")
        assert result.exit_code == 0, result.output

        with app.app_context():
            task = db.session.get(Task, task_id)
            assert task.status == "in_progress"
    finally:
        with app.app_context():
            Task.query.filter_by(project_id=project_id).delete()
            Milestone.query.filter_by(project_id=project_id).delete()
            if task_id is not None:
                task = db.session.get(Task, task_id)
                if task is not None:
                    db.session.delete(task)
            if project_id is not None:
                project = db.session.get(Project, project_id)
                if project is not None:
                    db.session.delete(project)
            db.session.commit()


def test_cli_task_requires_login(runner, live_server):
    result = run_cli(runner, live_server, "task", "list", "--project", "1")
    assert result.exit_code == 1
    assert "尚未登录" in result.output


def test_cli_report_submit_and_sync(runner, live_server, app):
    member_login_via_cli(runner, live_server)
    marker = "CLI 周报端到端"
    report_id = None
    try:
        result = run_cli(
            runner, live_server, "report", "submit",
            "--done", marker, "--plan", "下周计划", "--issues", "无",
            "--week-start", "2026-08-03", "--week-end", "2026-08-09",
        )
        assert result.exit_code == 0, result.output
        assert "已提交" in result.output

        client = ApiClient(live_server)
        token = client.post("/api/member/login", {
            "account": "2023001", "password": "member123",
        })["token"]
        member_client = ApiClient(live_server, token=token)
        reports = member_client.get("/api/member/weekly-reports")
        report_id = [r["id"] for r in reports if r["content"].get("done") == marker][0]
        assert reports  # Web 端可见

        result = run_cli(runner, live_server, "report", "list", "--status", "submitted")
        assert result.exit_code == 0
        assert marker in result.output
    finally:
        with app.app_context():
            if report_id is not None:
                report = db.session.get(WeeklyReport, report_id)
                if report is not None:
                    db.session.delete(report)
            db.session.commit()


def test_cli_report_review_as_admin(runner, live_server, app):
    member_id = None
    report_id = None
    with app.app_context():
        member = Member.query.filter_by(student_id="2023001").first()
        member_id = member.id
        report = WeeklyReport(
            member_id=member.id,
            content={"done": "待审阅周报", "plan": "", "issues": ""},
            status="submitted",
        )
        db.session.add(report)
        db.session.commit()
        report_id = report.id

    admin_login_via_cli(runner, live_server)
    try:
        result = run_cli(
            runner, live_server, "report", "review", str(report_id),
            "--note", "符合预期", "--completion-rate", "88",
        )
        assert result.exit_code == 0, result.output
        assert "已审阅" in result.output

        with app.app_context():
            reviewed = db.session.get(WeeklyReport, report_id)
            assert reviewed.status == "reviewed"
            assert reviewed.review_note == "符合预期"
            assert reviewed.completion_rate == 88
    finally:
        with app.app_context():
            if report_id is not None:
                report = db.session.get(WeeklyReport, report_id)
                if report is not None:
                    db.session.delete(report)
            db.session.commit()


def test_cli_award_export_csv(runner, live_server, app):
    with app.app_context():
        # 奖项不再有默认种子数据，这里自建一条用于导出验证
        if not Award.query.first():
            db.session.add(Award(
                slug='cli-export-fixture',
                name='CLI 导出测试奖项',
                level='national',
                winner='测试成员',
                date='2025-01',
            ))
            db.session.commit()

    result = run_cli(runner, live_server, "award", "export", "--format", "csv")
    assert result.exit_code == 0, result.output
    assert "id,slug,name,level" in result.output
    assert "国家级" in result.output or "national" in result.output


def test_cli_member_list_after_login(runner, live_server):
    member_login_via_cli(runner, live_server)
    result = run_cli(runner, live_server, "member", "list", "--group", "dev")
    assert result.exit_code == 0
    assert "赵子涵" in result.output


def test_cli_config_get_set_as_admin(runner, live_server, app):
    admin_login_via_cli(runner, live_server)
    key = "cli_test_config"
    try:
        result = run_cli(
            runner, live_server, "config", "set", key,
            '{"enabled": true, "label": "CLI 配置测试"}',
        )
        assert result.exit_code == 0, result.output

        result = run_cli(runner, live_server, "config", "get", key)
        assert result.exit_code == 0
        assert "CLI 配置测试" in result.output

        client = ApiClient(live_server)
        token = client.post("/api/auth/login", {
            "account": "admin", "password": "admin123",
        })["token"]
        admin_client = ApiClient(live_server, token=token)
        config = admin_client.get("/api/admin/config")
        assert config[key]["enabled"] is True
    finally:
        with app.app_context():
            from models import SiteConfig
            entry = SiteConfig.query.filter_by(config_key=key).first()
            if entry is not None:
                db.session.delete(entry)
                db.session.commit()
