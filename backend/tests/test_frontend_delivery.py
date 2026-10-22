"""HTTP-level coverage for public metadata, publication and SPA status codes."""

import json
from html.parser import HTMLParser
from xml.etree import ElementTree

import pytest

from models import Award, BlogPost, Project, SiteConfig, db


class Head(HTMLParser):
    def __init__(self, response):
        super().__init__()
        self.meta = {}
        self.canonical = None
        self.feed(response.get_data(as_text=True))

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        if tag == 'meta':
            self.meta[attrs.get('name') or attrs.get('property')] = attrs.get('content')
        if tag == 'link' and attrs.get('rel') == 'canonical':
            self.canonical = attrs['href']


@pytest.fixture(scope='module')
def public_content(app):
    with app.app_context():
        db.session.add_all([
            Project(slug='share-project', name='AI & C# "项目"', description='**一起** 学习 C#',
                    cover_image='/uploads/project.webp'),
            Award(slug='share-award', name='测试奖项', winner='团队', level='school',
                  certificate_images=['https://cdn.example/award.webp']),
            BlogPost(slug='share-blog', title='公开文章', excerpt='阅读 [文档](https://example.org)',
                     cover_image='/uploads/blog.webp', is_published=True),
            BlogPost(slug='share-draft', title='绝不能泄漏的草稿标题', content='隐藏正文', is_published=False),
        ])
        footer = SiteConfig.query.filter_by(config_key='footer').first()
        footer.config_value = {**footer.config_value, 'brand': '测试站点'}
        db.session.commit()


@pytest.fixture(autouse=True)
def delivery(app, tmp_path, monkeypatch, public_content):
    base = dict(title='页面未找到 · 默认站点', description='默认简介', image='https://build.example/hero-poster.webp',
                canonical='https://build.example/404', type='website', robots='noindex, follow', siteName='默认站点')
    labels = {'/': '默认站点 — Xingyu Studio', '/projects': '作品画廊 · 默认站点',
              '/admin': '管理后台 · 默认站点', '/member': '成员门户 · 默认站点', '/login': '登录 · 默认站点'}
    manifest = dict(version=1, origin='https://build.example',
                    template='<html><head><title>OLD</title><meta name="description" content="old">'
                    '<link rel="canonical" href="old"><meta property="og:title" content="old">'
                    '<meta name="viewport" content="width=device-width"><script>themeBootstrap()</script>'
                    '<script type="module" src="/assets/current.js"></script></head><body><div id="root"></div></body></html>',
                    defaults=dict(siteName='默认站点', siteDescription='默认简介'),
                    routes={path: {**base, 'title': title} for path, title in labels.items()},
                    publicPaths=['/', '/projects'], notFound=base)
    filename = tmp_path / 'metadata.json'
    filename.write_text(json.dumps(manifest, ensure_ascii=False), encoding='utf-8')
    monkeypatch.setitem(app.config, 'FRONTEND_METADATA_FILE', str(filename))
    monkeypatch.setitem(app.config, 'PUBLIC_BASE_URL', 'https://public.example/subpath')
    return filename


@pytest.mark.parametrize(('path', 'title', 'image', 'kind'), [
    ('/project/share-project', 'AI & C# "项目"', 'https://public.example/uploads/project.webp', 'website'),
    ('/award/share-award', '测试奖项', 'https://cdn.example/award.webp', 'website'),
    ('/blog/share-blog', '公开文章', 'https://public.example/uploads/blog.webp', 'article'),
])
def test_public_detail_has_metadata_without_javascript(client, path, title, image, kind):
    response = client.get(path + '?token=not-in-canonical', headers={'Host': 'attacker.example'})
    head = Head(response)
    assert response.status_code == 200
    assert head.meta['og:title'] == title + ' · 测试站点'
    assert head.meta['og:image'] == image
    assert head.meta['og:type'] == kind
    assert head.meta['robots'] == 'index, follow'
    assert head.canonical == 'https://public.example' + path
    assert response.headers['Cache-Control'] == 'no-store'
    body = response.get_data(as_text=True)
    assert body.count('<title>') == body.count('name="description"') == 1
    assert 'themeBootstrap()' in body and '/assets/current.js' in body
    assert '<div id="root"></div>' in body


@pytest.mark.parametrize('path', ['/blog/share-draft', '/blog/missing', '/project/missing', '/award/missing',
                                  '/projects/extra', '/not-a-page', '/blog/share-blog/extra', '/administrator'])
def test_missing_pages_and_drafts_are_real_404_without_private_content(client, path):
    response = client.get(path)
    assert response.status_code == 404
    assert response.mimetype == 'text/html'
    assert Head(response).meta['robots'] == 'noindex, follow'
    assert response.headers['X-Robots-Tag'] == 'noindex, follow'
    assert '绝不能泄漏' not in response.get_data(as_text=True)
    assert '隐藏正文' not in response.get_data(as_text=True)


@pytest.mark.parametrize('path', ['/admin', '/admin/projects/1', '/member/profile', '/login'])
def test_private_spa_entry_is_usable_but_not_indexed(client, path):
    response = client.get(path)
    assert response.status_code == 200
    assert Head(response).meta['robots'] == 'noindex, nofollow'


@pytest.mark.parametrize('path', ['/api/does-not-exist', '/uploads/does-not-exist.webp', '/assets/missing.js',
                                  '/metadata.json', '/static/missing.js'])
def test_api_and_asset_routes_never_receive_html_shell(client, path):
    response = client.get(path)
    assert response.status_code == 404
    assert response.is_json
    assert 'themeBootstrap' not in response.get_data(as_text=True)


def test_sitemap_lists_public_details_but_never_drafts_or_private_routes(client):
    response = client.get('/sitemap.xml')
    assert response.status_code == 200
    root = ElementTree.fromstring(response.data)
    urls = [node.text for node in root.iter('{http://www.sitemaps.org/schemas/sitemap/0.9}loc')]
    assert 'https://public.example/project/share-project' in urls
    assert 'https://public.example/award/share-award' in urls
    assert 'https://public.example/blog/share-blog' in urls
    assert not any('share-draft' in url or '/admin' in url or '/member' in url for url in urls)
    assert len(urls) == len(set(urls))
    assert 'Sitemap: https://public.example/sitemap.xml' in client.get('/robots.txt').text


def test_canonical_and_sitemap_encode_literal_percent_slugs(app, client):
    with app.app_context():
        db.session.add(Project(slug='中文%20', name='编码测试'))
        db.session.commit()
    path = '/project/%E4%B8%AD%E6%96%87%2520'
    response = client.get(path)
    assert response.status_code == 200
    assert Head(response).canonical == 'https://public.example' + path
    assert 'https://public.example' + path in client.get('/sitemap.xml').text


def test_unpublishing_takes_effect_on_the_very_next_request(app, client):
    assert client.get('/blog/share-blog').status_code == 200
    with app.app_context():
        post = BlogPost.query.filter_by(slug='share-blog').first()
        post.is_published = False
        db.session.commit()
    try:
        assert client.get('/blog/share-blog').status_code == 404
        assert '/blog/share-blog' not in client.get('/sitemap.xml').text
    finally:
        with app.app_context():
            post = BlogPost.query.filter_by(slug='share-blog').first()
            post.is_published = True
            db.session.commit()


def test_metadata_escapes_attributes_and_rejects_image_credentials(app, client):
    with app.app_context():
        item = Project(slug='unsafe-meta', name='A " & </title><script>alert(1)</script>',
                       description='" onload="bad() & description', cover_image='https://user:secret@cdn.example/image')
        db.session.add(item)
        db.session.commit()
    response = client.get('/project/unsafe-meta')
    assert '&quot;' in response.text and '&amp;' in response.text
    assert '<script>alert(1)</script>' not in response.text
    assert 'onload="bad()' not in response.text
    assert Head(response).meta['og:image'] == 'https://public.example/hero-poster.webp'


def test_invalid_origin_falls_back_to_build_origin_not_host_header(app, client, monkeypatch):
    monkeypatch.setitem(app.config, 'PUBLIC_BASE_URL', 'javascript:alert(1)')
    assert Head(client.get('/projects', headers={'Host': 'attacker.example'})).canonical == 'https://build.example/projects'


def test_bundle_is_read_fresh_and_head_requests_have_no_body(client, delivery):
    manifest = json.loads(delivery.read_text(encoding='utf-8'))
    manifest['template'] = manifest['template'].replace('/assets/current.js', '/assets/next.js')
    delivery.write_text(json.dumps(manifest), encoding='utf-8')
    assert '/assets/next.js' in client.get('/projects').text
    response = client.head('/project/share-project')
    assert response.status_code == 200 and response.data == b''
    assert client.head('/project/missing').status_code == 404


def test_unavailable_bundle_returns_retryable_503_while_api_stays_healthy(client, delivery):
    delivery.write_text('{incomplete', encoding='utf-8')
    response = client.get('/project/share-project')
    assert response.status_code == 503
    assert response.headers['Retry-After'] == '30'
    assert 'noindex' in Head(response).meta['robots']
    assert client.get('/health').status_code == 200


def test_api_only_development_is_unchanged(app, client, monkeypatch):
    monkeypatch.setitem(app.config, 'FRONTEND_METADATA_FILE', '')
    assert client.get('/projects').status_code == 404
    assert client.get('/projects').is_json
    assert client.get('/api/projects').status_code == 200
