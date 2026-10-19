from datetime import timedelta
from urllib.parse import parse_qs, urlparse

from flask_jwt_extended import create_access_token


def _configure_qq(client_app, monkeypatch):
    monkeypatch.setitem(client_app.config, 'QQ_LOGIN_ENABLED', True)
    monkeypatch.setitem(client_app.config, 'QQ_APP_ID', 'test-app-id')
    monkeypatch.setitem(client_app.config, 'QQ_APP_KEY', 'test-app-key')
    monkeypatch.setitem(
        client_app.config,
        'QQ_REDIRECT_URI',
        'https://example.test/api/auth/qq/callback',
    )


def test_qq_status_reports_configuration(client, app, monkeypatch):
    response = client.get('/api/auth/qq/status')
    assert response.status_code == 200
    assert response.get_json()['enabled'] is False

    _configure_qq(app, monkeypatch)
    response = client.get('/api/auth/qq/status')
    assert response.status_code == 200
    assert response.get_json()['enabled'] is True


def test_qq_start_builds_authorization_redirect(client, app, monkeypatch):
    _configure_qq(app, monkeypatch)
    response = client.get('/api/auth/qq/start')

    assert response.status_code == 302
    location = response.headers['Location']
    assert location.startswith('https://graph.qq.com/oauth2.0/authorize?')

    query = parse_qs(urlparse(location).query)
    assert query['client_id'] == ['test-app-id']
    assert query['redirect_uri'] == ['https://example.test/api/auth/qq/callback']
    assert query['state'][0]


def test_qq_callback_rejects_invalid_state(client, app, monkeypatch):
    _configure_qq(app, monkeypatch)
    response = client.get('/api/auth/qq/callback?code=test-code&state=invalid')

    assert response.status_code == 302
    assert response.headers['Location'].startswith('/login#')
    assert 'qq_error=' in response.headers['Location']


def test_qq_bind_links_existing_member(client, app, monkeypatch):
    _configure_qq(app, monkeypatch)
    response = client.post('/api/auth/login', json={
        'account': '2022001',
        'password': 'member123',
    })
    assert response.status_code == 200

    with app.app_context():
        ticket = create_access_token(
            identity='qq-bind:test-openid',
            additional_claims={
                'kind': 'qq_bind',
                'nickname': '测试 QQ',
                'avatar': 'https://example.test/avatar.png',
            },
            expires_delta=timedelta(minutes=5),
        )

    response = client.post('/api/auth/qq/bind', json={
        'ticket': ticket,
        'account': '2022001',
        'name': '陈星宇',
        'password': 'member123',
    })

    assert response.status_code == 200
    payload = response.get_json()
    assert payload['success'] is True
    assert payload['user']['qqBound'] is True
    assert payload['user']['qqNickname'] == '测试 QQ'


def test_qq_callback_logs_in_bound_member(client, app, monkeypatch):
    _configure_qq(app, monkeypatch)

    from routes import public
    from models import db, Member

    with app.app_context():
        member = Member.query.filter_by(student_id='2022001').first()
        member.qq_openid = 'test-openid'
        member.qq_nickname = '测试 QQ'
        db.session.commit()

    monkeypatch.setattr(public, '_qq_exchange_access_token', lambda code: 'access-token')
    monkeypatch.setattr(public, '_qq_fetch_openid', lambda token: 'test-openid')
    monkeypatch.setattr(
        public,
        '_qq_fetch_user_info',
        lambda token, openid: {
            'nickname': '测试 QQ',
            'avatar': 'https://example.test/avatar.png',
        },
    )

    with app.app_context():
        state = public._qq_state_serializer().dumps({'nonce': 'test'})

    response = client.get(
        '/api/auth/qq/callback',
        query_string={'code': 'test-code', 'state': state},
    )

    assert response.status_code == 302
    location = response.headers['Location']
    assert location.startswith('/login#')
    fragment = parse_qs(urlparse(location).fragment)
    assert fragment['qq_token'][0]


def test_qq_callback_requests_binding_for_unbound_member(client, app, monkeypatch):
    _configure_qq(app, monkeypatch)

    from routes import public

    monkeypatch.setattr(public, '_qq_exchange_access_token', lambda code: 'access-token')
    monkeypatch.setattr(public, '_qq_fetch_openid', lambda token: 'unbound-openid')
    monkeypatch.setattr(
        public,
        '_qq_fetch_user_info',
        lambda token, openid: {
            'nickname': '新 QQ 用户',
            'avatar': 'https://example.test/avatar.png',
        },
    )

    with app.app_context():
        state = public._qq_state_serializer().dumps({'nonce': 'test'})

    response = client.get(
        '/api/auth/qq/callback',
        query_string={'code': 'test-code', 'state': state},
    )

    assert response.status_code == 302
    fragment = parse_qs(urlparse(response.headers['Location']).fragment)
    assert fragment['qq_bind'][0]
    assert fragment['qq_nickname'] == ['新 QQ 用户']
