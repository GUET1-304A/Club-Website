"""管理员/教师通知服务。

教师侧闭环：周报提交、AI 审核报告生成等关键事件发生时，
向全部管理员账号写入站内通知，管理员在后台通知中心统一查看。
飞书/邮件等外部通道作为旁路推送，失败不影响站内通知写入。
"""

from flask import current_app

from models import AdminNotification, AdminUser, db
from services.notification_channels import NotificationPayload, send_external_notification


def notify_all_admins(title, body=None, link=None, notification_type='weekly_report'):
    """向所有管理员账号发送一条站内通知。

    Args:
        title: 通知标题。
        body: 通知正文，可选。
        link: 跳转链接，可选。
        notification_type: 通知类型，默认 weekly_report。

    Returns:
        int: 创建的通知条数。
    """
    admins = AdminUser.query.all()
    if not admins:
        return 0

    for admin in admins:
        db.session.add(AdminNotification(
            admin_id=admin.id,
            type=notification_type,
            title=title,
            body=body,
            link=link,
            is_read=False,
        ))

    dispatch_external_notification(
        NotificationPayload(
            title=title,
            body=body,
            link=link,
            notification_type=notification_type,
        ),
        recipients=[admin.email for admin in admins if admin.email],
    )
    return len(admins)


def dispatch_external_notification(payload, recipients=None):
    """Best-effort external delivery for configured notification channels."""
    try:
        return send_external_notification(
            current_app.config,
            payload,
            recipients=recipients,
        )
    except Exception:
        current_app.logger.exception('External notification delivery failed')
        return []
