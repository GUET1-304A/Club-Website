"""CLI 本地配置：服务器地址与会话凭证存储。"""

import json
import os
from pathlib import Path


DEFAULT_BASE_URL = 'http://localhost:5000'


def config_dir():
    """返回 CLI 配置目录（可用 XINGYU_CLI_HOME 覆盖，默认 ~/.xingyu-cli）。"""
    override = os.environ.get('XINGYU_CLI_HOME')
    return Path(override) if override else Path.home() / '.xingyu-cli'


def config_path():
    return config_dir() / 'config.json'


def load():
    """读取配置字典；文件缺失或损坏时返回空字典。"""
    path = config_path()
    if path.exists():
        try:
            data = json.loads(path.read_text(encoding='utf-8'))
            if isinstance(data, dict):
                return data
        except (OSError, ValueError):
            pass
    return {}


def save(data):
    """原子写入配置字典。"""
    path = config_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix('.tmp')
    tmp.write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding='utf-8',
    )
    os.replace(tmp, path)


def base_url(data=None):
    data = data if data is not None else load()
    return (data.get('base_url') or DEFAULT_BASE_URL).rstrip('/')


def save_session(base_url_value, token, role, user):
    """保存登录会话（保留原有 base_url 之外的自定义字段）。"""
    data = load()
    data['base_url'] = base_url_value.rstrip('/')
    data['token'] = token
    data['role'] = role
    data['name'] = user.get('name') or user.get('username') or ''
    data['account'] = user.get('student_id') or user.get('email') or user.get('username') or ''
    save(data)


def clear_session():
    """清除登录凭证，保留服务器地址。"""
    data = load()
    data.pop('token', None)
    data.pop('role', None)
    data.pop('name', None)
    data.pop('account', None)
    save(data)
