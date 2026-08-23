"""Weekly report template helpers shared by routes and AI analysis."""

import re

from defaults import DEFAULT_SITE_CONFIG
from models import SiteConfig


DEFAULT_TEMPLATE = DEFAULT_SITE_CONFIG['weekly_report_template']
FIELD_KEY_RE = re.compile(r'^[A-Za-z][A-Za-z0-9_-]{0,49}$')


def get_weekly_report_template():
    """Return the normalized weekly report template from site configuration."""
    cfg = SiteConfig.query.filter_by(config_key='weekly_report_template').first()
    return normalize_weekly_report_template(cfg.config_value if cfg else None)


def normalize_weekly_report_template(value):
    """Normalize admin-provided template JSON into a stable public contract."""
    if not isinstance(value, dict):
        value = {}

    title = str(value.get('title') or DEFAULT_TEMPLATE['title']).strip() or DEFAULT_TEMPLATE['title']
    fields = []
    seen = set()
    source_fields = value.get('fields') if isinstance(value.get('fields'), list) else DEFAULT_TEMPLATE['fields']

    for raw in source_fields:
        if not isinstance(raw, dict):
            continue
        key = str(raw.get('key') or '').strip()
        if not FIELD_KEY_RE.match(key) or key in seen:
            continue
        seen.add(key)
        label = str(raw.get('label') or key).strip() or key
        placeholder = str(raw.get('placeholder') or '').strip()
        try:
            rows = int(raw.get('rows') or 2)
        except (TypeError, ValueError):
            rows = 2
        rows = min(6, max(1, rows))
        fields.append({
            'key': key,
            'label': label[:40],
            'required': bool(raw.get('required', False)),
            'placeholder': placeholder[:200],
            'rows': rows,
        })

    if not fields:
        fields = [dict(field) for field in DEFAULT_TEMPLATE['fields']]
    if not any(field['required'] for field in fields):
        fields[0]['required'] = True

    return {'title': title[:80], 'fields': fields[:12]}


def validate_weekly_report_content(content, template=None):
    """Return an error message when content does not satisfy the template."""
    if not isinstance(content, dict):
        return '周报内容不能为空'
    template = template or get_weekly_report_template()
    for field in template['fields']:
        value = str(content.get(field['key']) or '').strip()
        if field['required'] and not value:
            return f'{field["label"]}不能为空'
    if not any(str(value or '').strip() for value in content.values()):
        return '周报内容不能为空'
    return None


def format_weekly_report_content(content, template=None):
    """Format report content using template labels for AI prompts and display."""
    if not isinstance(content, dict):
        return ''
    template = template or get_weekly_report_template()
    lines = []
    known = set()
    for field in template['fields']:
        key = field['key']
        known.add(key)
        value = str(content.get(key) or '').strip()
        if value:
            lines.append(f'{field["label"]}：{value}')
    for key, value in content.items():
        if key in known:
            continue
        text = str(value or '').strip()
        if text:
            lines.append(f'{key}：{text}')
    return '\n'.join(lines) or '未填写周报内容。'
