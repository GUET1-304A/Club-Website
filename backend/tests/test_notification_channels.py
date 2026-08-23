import json

from services.notification_channels import NotificationPayload, send_external_notification


def test_feishu_channel_posts_text_payload_with_public_link():
    sent = []

    def fake_http_post(url, body, headers, timeout):
        sent.append({
            'url': url,
            'body': body,
            'headers': headers,
            'timeout': timeout,
        })
        return {'ok': True}

    results = send_external_notification(
        {
            'PUBLIC_BASE_URL': 'https://xingyu.example',
            'NOTIFICATION_FEISHU_ENABLED': True,
            'FEISHU_WEBHOOK_URL': 'https://open.feishu.cn/webhook/test',
        },
        NotificationPayload(
            title='新周报待审阅',
            body='成员提交了周报',
            link='/admin/weekly-reports',
            notification_type='weekly_report_submitted',
        ),
        http_post=fake_http_post,
    )

    assert results == [{'channel': 'feishu', 'success': True}]
    assert sent[0]['url'] == 'https://open.feishu.cn/webhook/test'
    assert sent[0]['headers']['Content-Type'] == 'application/json'
    assert sent[0]['timeout'] == 10
    payload = json.loads(sent[0]['body'].decode('utf-8'))
    assert payload['msg_type'] == 'text'
    text = payload['content']['text']
    assert '新周报待审阅' in text
    assert '成员提交了周报' in text
    assert 'https://xingyu.example/admin/weekly-reports' in text


def test_email_channel_sends_to_recipients_with_starttls_and_login():
    smtp_events = []

    class FakeSMTP:
        def __init__(self, host, port, timeout):
            smtp_events.append(('connect', host, port, timeout))

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            smtp_events.append(('close',))

        def starttls(self):
            smtp_events.append(('starttls',))

        def login(self, username, password):
            smtp_events.append(('login', username, password))

        def send_message(self, message):
            smtp_events.append((
                'send',
                message['From'],
                message['To'],
                message['Subject'],
                message.get_content(),
            ))

    results = send_external_notification(
        {
            'PUBLIC_BASE_URL': 'https://xingyu.example',
            'NOTIFICATION_EMAIL_ENABLED': True,
            'SMTP_HOST': 'smtp.example.test',
            'SMTP_PORT': 2525,
            'SMTP_FROM': 'noreply@xingyu.example',
            'SMTP_USERNAME': 'smtp-user',
            'SMTP_PASSWORD': 'smtp-password',
            'SMTP_USE_TLS': True,
        },
        NotificationPayload(
            title='周报 AI 分析完成',
            body='完成度 85，请及时查看。',
            link='/admin/weekly-reports',
            notification_type='weekly_report_analyzed',
        ),
        recipients=['teacher@example.com'],
        smtp_factory=FakeSMTP,
    )

    assert results == [{'channel': 'email', 'success': True, 'recipients': 1}]
    assert ('connect', 'smtp.example.test', 2525, 10) in smtp_events
    assert ('starttls',) in smtp_events
    assert ('login', 'smtp-user', 'smtp-password') in smtp_events
    send_event = next(event for event in smtp_events if event[0] == 'send')
    assert send_event[1] == 'noreply@xingyu.example'
    assert send_event[2] == 'teacher@example.com'
    assert send_event[3] == '[星雨作坊] 周报 AI 分析完成'
    assert 'https://xingyu.example/admin/weekly-reports' in send_event[4]
