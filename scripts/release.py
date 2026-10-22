"""Release gates and read-only production HTTP smoke checks (standard library)."""
import argparse
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import subprocess
import time
from html.parser import HTMLParser
from urllib.error import HTTPError
from urllib.parse import quote, urlsplit
from urllib.request import Request, urlopen
from xml.etree import ElementTree


ROOT = Path(__file__).resolve().parents[1]


def run(args, cwd=None, capture=False):
    return subprocess.run(args, cwd=cwd, check=True, text=True, encoding='utf-8',
                          capture_output=capture).stdout


def origin(value):
    parsed = urlsplit(value)
    if (parsed.scheme not in ('https', 'http') or not parsed.hostname or parsed.username
            or parsed.password or parsed.path not in ('', '/') or parsed.query or parsed.fragment):
        raise ValueError('Expected an HTTP(S) origin without credentials, query or path')
    parsed.port
    return value.rstrip('/')


def validate_repository(repo):
    repo = Path(repo).resolve()
    top = run(['git', 'rev-parse', '--show-toplevel'], repo, True).strip()
    if Path(top).resolve() != repo:
        raise ValueError('Run preflight at the repository root')
    if run(['git', 'status', '--porcelain', '--untracked-files=all'], repo, True).strip():
        raise ValueError('Commit or deliberately exclude all tracked and untracked changes before release')
    if run(['git', 'branch', '--show-current'], repo, True).strip() != 'main':
        raise ValueError('This deployment publishes main only')
    revision = run(['git', 'rev-parse', 'HEAD'], repo, True).strip()
    required = ['scripts/release.py', 'scripts/recovery.py', 'scripts/deploy-remote.sh',
                'backend/maintenance.py', 'backend/services/readiness.py',
                'frontendnew/scripts/build-metadata.mjs', 'deploy/frontend/20-publish-bundle.sh',
                'deploy/nginx/frontend-proxy.inc', 'docker-compose.prod.yml', 'docker-compose.prod.tls.yml']
    tracked = set(run(['git', 'ls-tree', '-r', '--name-only', 'HEAD'], repo, True).splitlines())
    if not set(required) <= tracked:
        raise ValueError('The committed release does not include all required delivery files')
    return revision


def preflight(repo):
    revision = validate_repository(repo)
    npm = shutil.which('npm.cmd' if os.name == 'nt' else 'npm')
    if not npm:
        raise ValueError('npm is required')
    major = int(run(['node', '-p', 'process.versions.node.split(".")[0]'], capture=True).strip())
    if major < 24:
        raise ValueError('Node.js 24 or later is required for the build scripts')
    for args in [['ci'], ['run', 'check'], ['test'], ['audit', '--audit-level=high'], ['run', 'build']]:
        run([npm] + args, Path(repo) / 'frontendnew')
    import sys
    run([sys.executable, '-m', 'pytest', 'backend/tests', '-q'], repo)
    if validate_repository(repo) != revision:
        raise ValueError('The checkout changed during preflight')
    return {'status': 'ok', 'revision': revision, 'checks': 'frontend/backend/audit/build'}


class Head(HTMLParser):
    def __init__(self, body):
        super().__init__()
        self.meta = {}
        self.canonical = None
        self.assets = []
        self.title_count = 0
        self.feed(body)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'title':
            self.title_count += 1
        if tag == 'meta':
            self.meta[attrs.get('name') or attrs.get('property')] = attrs.get('content')
        if tag == 'link' and attrs.get('rel') == 'canonical':
            self.canonical = attrs.get('href')
        value = attrs.get('src') if tag == 'script' else attrs.get('href') if tag == 'link' else None
        if value and value.startswith('/assets/'):
            self.assets.append(value)


def fetch(base, path, method='GET'):
    try:
        response = urlopen(Request(base + path, method=method, headers={'User-Agent': 'Xingyu-Release-Check/1'}), timeout=10)
    except HTTPError as error:
        response = error
    with response:
        if origin(response.url.split('/')[0] + '//' + urlsplit(response.url).netloc) != base:
            raise ValueError('Unexpected cross-origin redirect during smoke test')
        return response.status, response.headers, response.read(8 * 1024 * 1024)


def expect(condition, message):
    if not condition:
        raise ValueError(message)


def smoke(base, revision):
    base = origin(base)
    status, _, body = fetch(base, '/health/ready')
    ready = json.loads(body)
    expect(status == 200 and ready.get('revision') == revision and
           ready.get('checks') == {'database': 'ok', 'frontend': 'ok'}, 'Release readiness/version mismatch')
    checked, assets = [], set()

    def page(path, status=200, title=None, private=False):
        code, headers, body = fetch(base, path)
        expect(code == status, f'Unexpected HTTP status at {path}')
        head = Head(body.decode('utf-8'))
        expect(head.canonical == base + path and head.title_count == 1, f'Invalid head/canonical at {path}')
        expect(head.meta.get('og:title') and head.meta.get('og:image'), f'Missing share metadata at {path}')
        robots = 'noindex, nofollow' if private else 'noindex, follow' if status == 404 else 'index, follow'
        expect(head.meta.get('robots') == robots, f'Invalid indexing at {path}')
        if title:
            expect(head.meta['og:title'].startswith(title + ' · '), f'Detail title mismatch at {path}')
        expect(headers.get('X-Content-Type-Options') == 'nosniff', 'Missing security headers')
        assets.update(head.assets)
        checked.append(path)

    for path in ['/', '/about', '/members', '/projects', '/awards', '/blog', '/research',
                 '/cooperation', '/contact', '/open-source', '/join', '/recruitment',
                 '/timeline', '/onboarding', '/yuji']:
        page(path)
    page('/admin', private=True)
    page('/member', private=True)
    page('/login', private=True)
    missing = '/__release_missing_' + revision[:12]
    page(missing, 404)
    for prefix in ['project', 'award', 'blog']:
        page('/' + prefix + '/' + missing[1:], 404)
    for path in ['/assets/__release_missing.js', '/metadata.json', '/api/__release_missing']:
        code, _, body = fetch(base, path)
        expect(code == 404 and b'id="root"' not in body, 'Missing assets/API must not return the SPA')
    status, _, body = fetch(base, '/api/config')
    expect(status == 200 and isinstance(json.loads(body), dict), 'Config API failed')
    details = []
    for endpoint, prefix, title_key in [('projects', 'project', 'name'), ('awards', 'award', 'name'), ('blogs', 'blog', 'title')]:
        code, _, body = fetch(base, '/api/' + endpoint)
        items = json.loads(body)
        expect(code == 200 and isinstance(items, list), 'Public collection API failed')
        if items:
            item = items[0]
            path = '/' + prefix + '/' + quote(item['slug'], safe='')
            page(path, title=item[title_key])
            details.append(base + path)
    expect(bool(assets), 'No compiled assets in HTML')
    for asset in sorted(assets):
        code, _, _ = fetch(base, asset, 'HEAD')
        expect(code == 200, 'A referenced compiled asset is unavailable')
    status, _, body = fetch(base, '/sitemap.xml')
    expect(status == 200, 'Sitemap failed')
    urls = [node.text for node in ElementTree.fromstring(body).iter('{http://www.sitemaps.org/schemas/sitemap/0.9}loc')]
    expect(all(url in urls for url in details), 'Public details missing from sitemap')
    status, _, body = fetch(base, '/robots.txt')
    expect(status == 200 and base + '/sitemap.xml' in body.decode(), 'Robots sitemap origin mismatch')
    return {'status': 'ok', 'revision': revision, 'pages': len(checked), 'assets': len(assets),
            'detailsChecked': len(details), 'emptyCollectionsSkipped': 3 - len(details)}


def validate_existing_storage(data, info):
    """An upgrade must keep the exact existing data paths and backing stores."""
    entry = data['services']['backend']
    old_env = dict(value.split('=', 1) for value in info['Config']['Env'] if '=' in value)
    new_env = entry['environment']
    for key, default in [('DATABASE_URL', ''), ('UPLOAD_FOLDER', '/app/uploads')]:
        expect(old_env.get(key, default) == new_env.get(key, default),
               f'{key} changed; a separate, verified storage migration is required')
    expect(str(old_env.get('OSS_ENABLED', 'false')).lower() not in ('true', '1', 'yes', 'on')
           and str(new_env.get('OSS_ENABLED', 'false')).lower() not in ('true', '1', 'yes', 'on'),
           'OSS storage requires a separate provider-native backup workflow')
    paths = [new_env['DATABASE_URL'][len('sqlite:///'):], new_env.get('UPLOAD_FOLDER', '/app/uploads')]
    for path in paths:
        expect(PurePosixPath(path).is_absolute() and '..' not in PurePosixPath(path).parts,
               'Business storage must use normalized absolute paths')
        old = [mount for mount in info['Mounts']
               if PurePosixPath(path).is_relative_to(mount['Destination'])]
        new = [mount for mount in entry.get('volumes', [])
               if PurePosixPath(path).is_relative_to(mount['target'])]
        expect(bool(old) and bool(new), 'Business storage must remain persistently mounted')
        old_mount = max(old, key=lambda mount: len(PurePosixPath(mount['Destination']).parts))
        new_mount = max(new, key=lambda mount: len(PurePosixPath(mount['target']).parts))
        kind = new_mount['type']
        source = (data['volumes'][new_mount['source']]['name'] if kind == 'volume' else new_mount['source'])
        expect(old_mount['Type'] == kind and old_mount['Destination'] == new_mount['target']
               and (old_mount.get('Name') if kind == 'volume' else old_mount['Source']) == source,
               'Business storage mount changed; refusing to switch to different or empty data')


def prepare_compose(base, source, project, revision, domain):
    """Resolve runtime paths against the existing installation, build new source."""
    expect(re.fullmatch(r'[0-9a-f]{40}', revision), 'Expected a full committed revision')
    expect(re.fullmatch(r'[a-z0-9][a-z0-9_-]*', project), 'Invalid Compose project name')
    base, source = Path(base).resolve(), Path(source).resolve()
    command = ['docker', 'compose', '-p', project, '--project-directory', str(base),
               '--env-file', str(base / '.env'), '-f', str(source / 'docker-compose.prod.yml'),
               '-f', str(source / 'docker-compose.prod.tls.yml'), 'config', '--format', 'json']
    data = json.loads(run(command, capture=True))
    backend = data['services']['backend']
    expect(not backend.get('ports'), 'Production backend must remain private')
    expect(backend['environment'].get('FLASK_ENV') == 'production', 'Production mode required')
    expect(backend['environment'].get('APP_DEBUG') in ('false', False), 'Production debug must be disabled')
    expect(str(backend['environment'].get('DATABASE_URL', '')).startswith('sqlite:////'), 'This release backup workflow requires absolute SQLite storage')
    expect(origin(backend['environment'].get('PUBLIC_BASE_URL', '')) == origin(domain), 'PUBLIC_BASE_URL must match deployment origin')
    expect(origin(domain) in backend['environment'].get('CORS_ORIGINS', '').split(','), 'CORS must include the public origin')
    for service in ['backend', 'frontend']:
        entry = data['services'][service]
        entry['build']['context'] = str(source)
        entry['build'].setdefault('args', {})['RELEASE_REVISION'] = revision
        entry['image'] = project + '-' + service + ':' + revision
    for mount in data['services']['frontend'].get('volumes', []):
        if mount.get('target') == '/etc/nginx/conf.d/default.conf':
            mount['source'] = str(source / 'deploy/nginx/tls.conf')
    for secret in data.get('secrets', {}).values():
        expect(Path(secret['file']).is_file(), 'A configured secret file is unavailable')
    identifiers = run(['docker', 'ps', '-a', '--filter', 'label=com.docker.compose.project=' + project,
                       '--filter', 'label=com.docker.compose.service=backend',
                       '--filter', 'label=com.docker.compose.oneoff=False', '--format', '{{.ID}}'], capture=True).split()
    expect(len(identifiers) <= 1, 'This release workflow requires a single backend writer')
    if identifiers:
        info = json.loads(run(['docker', 'inspect', identifiers[0]], capture=True))[0]
        validate_existing_storage(data, info)
    output = source / 'compose.release.json'
    with output.open('x', encoding='utf-8') as stream:
        os.chmod(output, 0o600)
        json.dump(data, stream, indent=2)
    return {'status': 'ok', 'revision': revision, 'compose': str(output)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    check = commands.add_parser('preflight')
    check.add_argument('--repo', default=str(ROOT))
    check.add_argument('--report', required=True)
    probe = commands.add_parser('smoke')
    probe.add_argument('--base-url', required=True)
    probe.add_argument('--revision', required=True)
    probe.add_argument('--attempts', type=int, default=1)
    prepare = commands.add_parser('prepare-compose')
    for name in ['base', 'source', 'project', 'revision', 'domain']:
        prepare.add_argument('--' + name, required=True)
    args = parser.parse_args()
    if args.command == 'preflight':
        result = preflight(args.repo)
        with open(args.report, 'x', encoding='utf-8') as stream:
            json.dump(result, stream)
    elif args.command == 'prepare-compose':
        result = prepare_compose(args.base, args.source, args.project, args.revision, args.domain)
    else:
        expect(1 <= args.attempts <= 12, 'Attempts must be between 1 and 12')
        for attempt in range(args.attempts):
            try:
                result = smoke(args.base_url, args.revision)
                break
            except Exception:
                if attempt == args.attempts - 1:
                    raise
                time.sleep(5)
    print(json.dumps(result))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        raise SystemExit('Release check failed: ' + str(error)) from None
