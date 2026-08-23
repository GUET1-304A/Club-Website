"""定时提醒扫描服务。

使用轻量级后台线程周期扫描（不引入 Celery/Redis 依赖，适合单机部署）：
  1. 到期提醒（Reminder）：pending → sent，并生成站内通知
  2. 任务截止提醒：24 小时内到期的任务自动提醒负责人（每日至多一条，防刷屏）

生产环境可通过 REMINDER_SCHEDULER_BACKEND=apscheduler 切换到 APScheduler。
多实例部署时仅让一个实例设置 REMINDER_SCHEDULER_LEADER=true，避免重复扫描。
"""

import threading
import time
from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.background import BackgroundScheduler
from flask import current_app

from models import Member, Notification, Project, Reminder, Task, WeeklyReport, db
from services.notification_channels import NotificationPayload, send_external_notification


def run_reminder_scan(app):
    """执行一次提醒扫描（需在应用上下文中安全执行，内部自建上下文）。"""
    with app.app_context():
        now = datetime.now(timezone.utc)
        sent_count = 0

        # 1) 到期提醒：scheduled_at 为空（立即）或已到触发时间
        due_reminders = Reminder.query.filter(
            Reminder.status == 'pending',
            db.or_(Reminder.scheduled_at.is_(None), Reminder.scheduled_at <= now),
        ).all()
        for reminder in due_reminders:
            if send_reminder_notification(reminder):
                sent_count += 1

        # 2) 任务截止提醒：24 小时内到期、未完成、有负责人的任务
        horizon = now + timedelta(hours=24)
        due_tasks = Task.query.filter(
            Task.status.in_(('todo', 'in_progress', 'review')),
            Task.due_date.isnot(None),
            Task.due_date <= horizon,
            Task.assignee_id.isnot(None),
        ).all()
        for task in due_tasks:
            if _already_reminded_recently(task):
                continue
            db.session.add(Notification(
                member_id=task.assignee_id,
                type='task_due',
                title=f'任务即将到期：{task.title}',
                body=(
                    f'项目「{task.project.name if task.project else "未知"}」的任务'
                    f'「{task.title}」将在 {task.due_date.strftime("%Y-%m-%d")} 前到期，'
                    '请及时完成或更新状态。'
                ),
                link=f'/member/projects/{task.project_id}',
                is_read=False,
            ))
            sent_count += 1

        # 3) 周报提交提醒：有未完成任务、本周尚未提交周报的成员（每 7 天至多提醒一次）
        monday = _current_week_monday(now)
        active_member_ids = set()
        for project in Project.query.filter_by(status='active').all():
            assigned = Task.query.filter(
                Task.project_id == project.id,
                Task.status.in_(('todo', 'in_progress', 'review')),
                Task.assignee_id.isnot(None),
            ).all()
            active_member_ids.update(task.assignee_id for task in assigned)

        for member_id in active_member_ids:
            submitted = WeeklyReport.query.filter(
                WeeklyReport.member_id == member_id,
                WeeklyReport.week_start == monday,
                WeeklyReport.status.in_(('submitted', 'reviewed')),
            ).first()
            if submitted or _already_reminded_weekly(member_id):
                continue
            db.session.add(Notification(
                member_id=member_id,
                type='report_submit',
                title='本周周报待提交',
                body=(
                    f'本周（{monday.isoformat()} 起）还没有提交周报，'
                    '记得在 AI 助手的「我的周报」中提交。'
                ),
                link='/member/assistant',
                is_read=False,
            ))
            sent_count += 1

        db.session.commit()
        return sent_count


def send_reminder_notification(reminder):
    """将一条 pending 提醒立即转为站内通知（幂等：非 pending 不重复发送）。

    供定时扫描与"创建提醒时已到期"两条路径共用。
    """
    if reminder.status != 'pending':
        return False
    now = datetime.now(timezone.utc)
    notification_type = reminder.type if reminder.type in (
        'task_due', 'report_submit', 'review'
    ) else 'announcement'
    db.session.add(Notification(
        member_id=reminder.member_id,
        type=notification_type,
        title=reminder.title,
        body=reminder.message or '',
        link=reminder.link or '/member/notifications',
        is_read=False,
    ))
    recipient = reminder.member or db.session.get(Member, reminder.member_id)
    recipient_email = recipient.email if recipient else None
    dispatch_external_notification(
        NotificationPayload(
            title=reminder.title,
            body=reminder.message or '',
            link=reminder.link or '/member/notifications',
            notification_type=notification_type,
        ),
        recipients=[recipient_email] if recipient_email else [],
    )
    reminder.status = 'sent'
    reminder.sent_at = now
    return True


def dispatch_external_notification(payload, recipients=None):
    """Best-effort external delivery for configured member reminder channels."""
    try:
        return send_external_notification(
            current_app.config,
            payload,
            recipients=recipients,
        )
    except Exception:
        current_app.logger.exception('External reminder notification delivery failed')
        return []


def _already_reminded_recently(task, window_hours=24):
    """判断该任务最近是否已生成过截止提醒（避免重复轰炸）。"""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=window_hours)
    existing = Notification.query.filter(
        Notification.member_id == task.assignee_id,
        Notification.type == 'task_due',
        Notification.title.contains(task.title[:20]),
        Notification.created_at >= cutoff,
    ).first()
    return existing is not None


def _current_week_monday(now):
    """返回当前周（周一）的日期。"""
    day = now.date()
    return day - timedelta(days=day.weekday())


def _already_reminded_weekly(member_id, window_days=7):
    """判断该成员最近一周是否已收到过周报提交提醒（避免每周重复轰炸）。"""
    cutoff = datetime.now(timezone.utc) - timedelta(days=window_days)
    return Notification.query.filter(
        Notification.member_id == member_id,
        Notification.type == 'report_submit',
        Notification.created_at >= cutoff,
    ).first() is not None


def start_reminder_scanner(app, interval=None):
    """启动配置指定的提醒扫描器。"""
    if app.config.get('TESTING'):
        return None
    if not app.config.get('REMINDER_SCAN_ENABLED', True):
        return None
    if not app.config.get('REMINDER_SCHEDULER_LEADER', True):
        app.logger.info('Reminder scanner skipped on non-leader instance')
        return None

    backend = (app.config.get('REMINDER_SCHEDULER_BACKEND') or 'thread').lower()
    if backend == 'disabled':
        return None
    if backend == 'apscheduler':
        return _start_apscheduler(app, interval)
    if backend != 'thread':
        app.logger.warning(
            'Unknown REMINDER_SCHEDULER_BACKEND=%s; falling back to thread',
            backend,
        )
    return _start_thread_scanner(app, interval)


def _start_thread_scanner(app, interval=None):
    """启动后台提醒扫描线程（守护线程，随进程退出）。"""
    interval = interval or app.config.get('REMINDER_SCAN_INTERVAL', 3600)

    def _loop():
        while True:
            try:
                run_reminder_scan(app)
            except Exception:
                app.logger.exception('Reminder scan failed')
            time.sleep(interval)

    thread = threading.Thread(
        target=_loop,
        name='reminder-scanner',
        daemon=True,
    )
    thread.start()
    return thread


def _start_apscheduler(app, interval=None):
    """Use APScheduler to run the reminder scan at a fixed interval."""
    interval = interval or app.config.get('REMINDER_SCAN_INTERVAL', 3600)
    timezone_name = app.config.get('REMINDER_SCHEDULER_TIMEZONE', 'UTC')
    scheduler = BackgroundScheduler(timezone=timezone_name)
    scheduler.add_job(
        lambda: _run_scan_with_logging(app),
        'interval',
        seconds=interval,
        id='reminder-scan',
        max_instances=1,
        coalesce=True,
        replace_existing=True,
    )
    scheduler.start()
    app.logger.info(
        'Reminder scanner started with APScheduler every %s seconds',
        interval,
    )
    return scheduler


def _run_scan_with_logging(app):
    try:
        return run_reminder_scan(app)
    except Exception:
        app.logger.exception('Reminder scan failed')
        return 0
