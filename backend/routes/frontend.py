"""Public HTML metadata and status codes; React still renders the page body.

The trusted build manifest contains the frontend template and route catalogue.
Only public content is queried here; no authentication or member data is used.
"""

import html
import json
import re
from pathlib import Path
from urllib.parse import quote, urljoin, urlsplit
from xml.etree.ElementTree import Element, SubElement, tostring

from flask import Blueprint, Response, abort, current_app, redirect, request

from models import Award, BlogPost, Project, SiteConfig


frontend_bp = Blueprint('frontend', __name__)
_RESERVED = {'api', 'uploads', 'assets', 'health', 'static'}
_DETAILS = {'project': (Project, '项目未找到'), 'award': (Award, '奖项未找到'),
            'blog': (BlogPost, '文章未找到')}


def _plain(value, limit=160):
    text = re.sub(r'<[^>]*>', ' ', str(value or ''))
    text = re.sub(r'!?\[([^\]]*)\]\([^)]*\)', r'\1', text)
    text = re.sub(r'\*\*([^*]+)\*\*', r'\1', text)
    text = re.sub(r'^\s*#{1,6}\s+', '', text.replace('`', ''), flags=re.M)
    text = re.sub(r'\s+', ' ', text).strip()
    return text[:limit - 1] + '…' if len(text) > limit else text


def _origin(value, fallback):
    try:
        url = urlsplit(value or fallback)
        # Force validation of malformed port values as well.
        url.port
        if url.scheme in ('http', 'https') and url.hostname and not url.username and not url.password:
            return f'{url.scheme}://{url.netloc}'
    except ValueError:
        pass
    return fallback


def _bundle():
    filename = current_app.config.get('FRONTEND_METADATA_FILE')
    if not filename:
        abort(404)
    try:
        bundle = json.loads(Path(filename).read_text(encoding='utf-8'))
        if bundle['version'] != 1 or not bundle['routes']['/'] or '<head' not in bundle['template']:
            raise ValueError('Invalid frontend metadata manifest')
        return bundle
    except (OSError, ValueError, KeyError, TypeError):
        # An unavailable bundle is temporary, never a successful soft-404.
        abort(503)


def _site_config(bundle):
    values = {row.config_key: row.config_value for row in
              SiteConfig.query.filter(SiteConfig.config_key.in_(['footer', 'hero'])).all()}
    footer = values.get('footer') if isinstance(values.get('footer'), dict) else {}
    hero = values.get('hero') if isinstance(values.get('hero'), dict) else {}
    return (_plain(footer.get('brand') or bundle['defaults']['siteName'], 60),
            _plain(hero.get('description') or bundle['defaults']['siteDescription']))


def _image(value, origin):
    try:
        url = urlsplit(urljoin(origin + '/', value or '/hero-poster.webp'))
        url.port
        if url.scheme in ('http', 'https') and url.hostname and not url.username and not url.password:
            return url.geturl()
    except ValueError:
        pass
    return origin + '/hero-poster.webp'


def _render(template, data):
    escape = lambda value: html.escape(str(value), quote=True)
    tags = [f'<title>{escape(data["title"])}</title>',
            f'<link rel="canonical" href="{escape(data["canonical"])}">']
    names = {'description': data['description'], 'robots': data['robots'],
             'twitter:card': 'summary_large_image', 'twitter:title': data['title'],
             'twitter:description': data['description'], 'twitter:image': data['image']}
    properties = {'title': data['title'], 'description': data['description'],
                  'url': data['canonical'], 'image': data['image'], 'type': data['type'],
                  'site_name': data['siteName'], 'image:alt': data['title']}
    tags.extend(f'<meta name="{name}" content="{escape(value)}">' for name, value in names.items())
    tags.extend(f'<meta property="og:{name}" content="{escape(value)}">' for name, value in properties.items())
    template = re.sub(r'<title\b[^>]*>.*?</title>', '', template, flags=re.I | re.S)
    template = re.sub(r'<meta\b[^>]*>', lambda match: '' if re.search(
        r'''(?:name|property)\s*=\s*["'](?:description|robots|og:[^"']+|twitter:[^"']+)["']''',
        match[0], flags=re.I) else match[0], template, flags=re.I)
    template = re.sub(r'<link\b[^>]*>', lambda match: '' if re.search(
        r'''rel\s*=\s*["']canonical["']''', match[0], flags=re.I) else match[0], template, flags=re.I)
    return re.sub(r'<head\b[^>]*>', lambda match: match[0] + '\n' + '\n'.join(tags),
                  template, count=1, flags=re.I)


def _response(body, status=200, mimetype='text/html'):
    response = Response(body, status=status, mimetype=mimetype)
    # Content can be edited/unpublished at any time. Do not cache draft status,
    # errors or HTML that refers to a previous bundle across deployments.
    response.headers['Cache-Control'] = 'no-store'
    if status != 200:
        response.headers['X-Robots-Tag'] = 'noindex, follow'
    return response


@frontend_bp.errorhandler(503)
def bundle_unavailable(_error):
    response = _response('<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">'
                         '<meta name="robots" content="noindex, follow"><title>暂时无法加载</title>'
                         '</head><body>暂时无法加载页面，请稍后重试。</body></html>', 503)
    response.headers['Retry-After'] = '30'
    return response


@frontend_bp.route('/sitemap.xml')
def sitemap():
    bundle = _bundle()
    origin = _origin(current_app.config.get('PUBLIC_BASE_URL'), bundle['origin'])
    paths = list(bundle['publicPaths'])
    for prefix, model in [('project', Project), ('award', Award), ('blog', BlogPost)]:
        query = model.query.with_entities(model.slug)
        if model is BlogPost:
            query = query.filter(BlogPost.is_published.is_(True))
        paths.extend(f'/{prefix}/{row.slug}' for row in query.order_by(model.slug).all()
                     if row.slug and '/' not in row.slug)
    root = Element('urlset', xmlns='http://www.sitemaps.org/schemas/sitemap/0.9')
    for path in dict.fromkeys(paths):
        SubElement(SubElement(root, 'url'), 'loc').text = origin + quote(path, safe='/')
    return _response(tostring(root, encoding='utf-8', xml_declaration=True), mimetype='application/xml')


@frontend_bp.route('/robots.txt')
def robots():
    bundle = _bundle()
    origin = _origin(current_app.config.get('PUBLIC_BASE_URL'), bundle['origin'])
    return _response('User-agent: *\nDisallow: /admin\nDisallow: /member/\n'
                     'Disallow: /login\nDisallow: /api/\n\nSitemap: ' + origin + '/sitemap.xml\n',
                     mimetype='text/plain')


@frontend_bp.route('/', defaults={'path': ''})
@frontend_bp.route('/<path:path>')
def frontend(path):
    if path.split('/')[0] in _RESERVED or path == 'metadata.json':
        abort(404)
    bundle = _bundle()
    if path == 'index.html':
        return redirect('/', code=308)
    pathname = '/' + path.rstrip('/')
    origin = _origin(current_app.config.get('PUBLIC_BASE_URL'), bundle['origin'])
    site_name, description = _site_config(bundle)
    private = re.match(r'^/(admin|member)(/|$)', pathname) or pathname == '/login'
    base_path = '/' + path.split('/')[0] if private else pathname
    data = dict(bundle['routes'].get(base_path, bundle['notFound']))
    data.update(canonical=origin + quote(pathname, safe='/'), siteName=site_name,
                image=origin + '/hero-poster.webp')
    status = 200 if base_path in bundle['routes'] else 404
    label = data['title'].removesuffix(' · ' + bundle['defaults']['siteName'])
    detail = re.fullmatch(r'/(project|award|blog)/([^/]+)', pathname)
    if detail:
        kind, slug = detail.groups()
        model, missing_label = _DETAILS[kind]
        query = model.query.filter_by(slug=slug)
        if model is BlogPost:
            query = query.filter_by(is_published=True)
        item = query.first()
        status = 200 if item else 404
        label = (item.title if kind == 'blog' else item.name) if item else missing_label
        detail_description, image = '', None
        if item:
            detail_description = (item.excerpt or item.content) if kind == 'blog' else item.description
            image = (item.certificate_images or [None])[0] if kind == 'award' else item.cover_image
        data.update(description=_plain(detail_description) or description,
                    image=_image(image, origin), type='article' if kind == 'blog' else 'website')
    elif pathname == '/':
        data['description'] = description
    data['title'] = f'{site_name} — Xingyu Studio' if pathname == '/' else f'{_plain(label, 100)} · {site_name}'
    data['robots'] = 'noindex, nofollow' if private else 'noindex, follow' if status == 404 else 'index, follow'
    return _response(_render(bundle['template'], data), status)
