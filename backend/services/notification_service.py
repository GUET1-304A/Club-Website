"""管理员/教师站内通知服务。

教师侧闭环：周报提交、AI 审核报告生成等关键事件发生时，
向全部管理员账号写入站内通知，管理员在后台通知中心统一查看。
"""

from models import AdminNotification, AdminUser, db


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
    admin_ids = [admin.id for admin in AdminUser.query.all()]
    if not admin_ids:
        return 0

    for admin_id in admin_ids:
        db.session.add(AdminNotification(
            admin_id=admin_id,
            type=notification_type,
            title=title,
            body=body,
            link=link,
            is_read=False,
        ))
    return len(admin_ids)
