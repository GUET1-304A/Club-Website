"""Readiness includes DB, the shared build and its referenced local assets."""
import json
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote

from sqlalchemy import text
from models import db


class Assets(HTMLParser):
    def __init__(self, template):
        super().__init__()
        self.paths = []
        self.feed(template)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        value = attrs.get('src') if tag == 'script' else attrs.get('href') if tag == 'link' else None
        if value and value.startswith('/assets/'):
            self.paths.append(unquote(urlsplit(value).path).lstrip('/'))


def readiness_status(app):
    stamp = Path(app.root_path) / 'release_revision.txt'
    try:
        revision = stamp.read_text(encoding='utf-8').strip() if stamp.is_file() else 'development'
    except OSError:
        revision = 'unavailable'
    checks = {'database': 'error', 'frontend': 'disabled'}
    try:
        db.session.execute(text('SELECT 1'))
        checks['database'] = 'ok'
    except Exception:
        db.session.rollback()
    filename = app.config.get('FRONTEND_METADATA_FILE')
    if filename:
        checks['frontend'] = 'error'
        try:
            root = Path(filename).resolve().parent
            bundle = json.loads(Path(filename).read_text(encoding='utf-8'))
            assets = Assets(bundle['template']).paths
            if (bundle['version'] == 1 and bundle.get('revision') == revision
                    and bundle['routes'].get('/') and assets
                    and all((root / path).resolve().is_relative_to(root)
                            and (root / path).is_file() for path in assets)):
                checks['frontend'] = 'ok'
        except (OSError, ValueError, KeyError, TypeError):
            pass
    ready = revision != 'unavailable' and all(value in ('ok', 'disabled') for value in checks.values())
    return {'status': 'ok' if ready else 'unavailable', 'revision': revision, 'checks': checks}, 200 if ready else 503
