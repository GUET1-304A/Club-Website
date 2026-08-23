"""External notification channels for Feishu webhooks and SMTP email."""

import json
import smtplib
import urllib.request
from dataclasses import dataclass
from email.message import EmailMessage
from urllib.parse import urljoin


@dataclass(frozen=True)
class NotificationPayload:
    """Portable notification payload shared by internal and external channels."""

    title: str
    body: str | None = None
    link: str | None = None
    notification_type: str = 'announcement'


def send_external_notification(
    config,
    payload,
    recipients=None,
    http_post=None,
    smtp_factory=None,
):
    """Send a notification through every enabled external channel.

    Returns a compact result list for observability and tests. Exceptions from
    individual channels are allowed to bubble so callers can decide whether
    external delivery should affect the business transaction.
    """
    results = []
    timeout = int(config.get('NOTIFICATION_EXTERNAL_TIMEOUT', 10))

    if config.get('NOTIFICATION_FEISHU_ENABLED', False):
        webhook_url = (config.get('FEISHU_WEBHOOK_URL') or '').strip()
        if webhook_url:
            _send_feishu(webhook_url, payload, config, http_post, timeout)
            results.append({'channel': 'feishu', 'success': True})

    if config.get('NOTIFICATION_EMAIL_ENABLED', False):
        clean_recipients = _clean_recipients(recipients or [])
        if clean_recipients and (config.get('SMTP_HOST') or '').strip() and (config.get('SMTP_FROM') or '').strip():
            _send_email(clean_recipients, payload, config, smtp_factory, timeout)
            results.append({
                'channel': 'email',
                'success': True,
                'recipients': len(clean_recipients),
            })

    return results


def _send_feishu(webhook_url, payload, config, http_post, timeout):
    body = json.dumps({
        'msg_type': 'text',
        'content': {'text': _format_text(payload, config)},
    }, ensure_ascii=False).encode('utf-8')
    headers = {'Content-Type': 'application/json'}
    if http_post is not None:
        http_post(webhook_url, body, headers, timeout)
        return

    request = urllib.request.Request(
        webhook_url,
        data=body,
        headers=headers,
        method='POST',
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        response.read()


def _send_email(recipients, payload, config, smtp_factory, timeout):
    message = EmailMessage()
    message['From'] = config['SMTP_FROM']
    message['To'] = ', '.join(recipients)
    message['Subject'] = f"[星雨作坊] {payload.title}"
    message.set_content(_format_text(payload, config))

    host = config['SMTP_HOST']
    port = int(config.get('SMTP_PORT', 587))
    factory = smtp_factory or (
        smtplib.SMTP_SSL if config.get('SMTP_USE_SSL', False) else smtplib.SMTP
    )
    with factory(host, port, timeout=timeout) as smtp:
        if config.get('SMTP_USE_TLS', True) and not config.get('SMTP_USE_SSL', False):
            smtp.starttls()
        username = (config.get('SMTP_USERNAME') or '').strip()
        password = config.get('SMTP_PASSWORD') or ''
        if username and password:
            smtp.login(username, password)
        smtp.send_message(message)


def _format_text(payload, config):
    lines = [payload.title]
    if payload.body:
        lines.append(str(payload.body))
    link = _absolute_link(config, payload.link)
    if link:
        lines.append(f'查看详情：{link}')
    return '\n'.join(lines)


def _absolute_link(config, link):
    if not link:
        return ''
    if link.startswith(('http://', 'https://')):
        return link
    public_base = (config.get('PUBLIC_BASE_URL') or '').strip()
    if not public_base:
        return link
    return urljoin(public_base.rstrip('/') + '/', link.lstrip('/'))


def _clean_recipients(recipients):
    seen = set()
    clean = []
    for recipient in recipients:
        email = str(recipient or '').strip()
        if not email or '@' not in email or email in seen:
            continue
        seen.add(email)
        clean.append(email)
    return clean
