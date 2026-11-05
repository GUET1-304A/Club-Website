import pytest


@pytest.mark.parametrize('demo', ['investment', 'airi'])
def test_demo_launch_is_fixed_and_not_cached(client, demo):
    response = client.get(f'/api/demos/{demo}/launch?next=https://example.com')
    assert response.status_code == 302
    assert response.headers['Location'] == f'/projects/{demo}/'
    assert response.headers['Cache-Control'] == 'no-store'
    assert response.headers['X-Robots-Tag'] == 'noindex, nofollow'


def test_unknown_demo_has_no_redirect(client):
    response = client.get('/api/demos/unknown/launch')
    assert response.status_code == 404
    assert 'Location' not in response.headers


@pytest.mark.parametrize('demo', ['investment', 'airi'])
def test_demo_directory_uses_fixed_https_origin(client, demo):
    for path in [f'/projects/{demo}', f'/projects/{demo}/']:
        response = client.get(path + '?url=https://example.com')
        assert response.status_code == 302
        assert response.headers['Location'] == f'https://{demo}.304aistudio.cn/'
        assert response.headers['Cache-Control'] == 'no-store'
