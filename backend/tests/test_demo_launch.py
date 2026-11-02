def test_investment_launch_is_fixed_and_not_cached(client):
    response = client.get('/api/demos/investment/launch?next=https://example.com')
    assert response.status_code == 302
    assert response.headers['Location'] == '/projects/investment/'
    assert response.headers['Cache-Control'] == 'no-store'
    assert response.headers['X-Robots-Tag'] == 'noindex, nofollow'


def test_unknown_demo_has_no_redirect(client):
    response = client.get('/api/demos/unknown/launch')
    assert response.status_code == 404
    assert 'Location' not in response.headers


def test_investment_directory_uses_fixed_https_origin(client):
    for path in ['/projects/investment', '/projects/investment/']:
        response = client.get(path + '?url=https://example.com')
        assert response.status_code == 302
        assert response.headers['Location'] == 'https://investment.304aistudio.cn/'
        assert response.headers['Cache-Control'] == 'no-store'
