"""基于标准库的 JSON HTTP 客户端。"""

import json
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


class CliError(RuntimeError):
    """CLI 通用错误。"""


class CliHttpError(CliError):
    """服务端返回错误状态时抛出。"""

    def __init__(self, status, message):
        super().__init__(message)
        self.status = status
        self.message = message


class ApiClient:
    """轻量 JSON API 客户端，所有请求都走后端 REST 接口。"""

    def __init__(self, base_url, token=None, timeout=30):
        self.base_url = base_url.rstrip('/')
        self.token = token
        self.timeout = timeout

    def request(self, method, path, body=None):
        url = f'{self.base_url}{path}'
        data = None
        headers = {}
        if body is not None:
            data = json.dumps(body, ensure_ascii=False).encode('utf-8')
            headers['Content-Type'] = 'application/json'
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'
        request = Request(url, data=data, headers=headers, method=method.upper())
        try:
            with urlopen(request, timeout=self.timeout) as response:
                raw = response.read().decode('utf-8')
        except HTTPError as exc:
            raw = exc.read().decode('utf-8', errors='replace')
            message = _error_message(raw) or f'HTTP {exc.code}'
            raise CliHttpError(exc.code, message)
        except URLError as exc:
            reason = getattr(exc, 'reason', exc)
            raise CliError(f'无法连接服务器 {self.base_url}: {reason}') from exc
        except TimeoutError as exc:
            raise CliError('请求超时') from exc
        return _parse_json(raw, url)

    def get(self, path):
        return self.request('GET', path)

    def post(self, path, body=None):
        return self.request('POST', path, body)

    def put(self, path, body=None):
        return self.request('PUT', path, body)

    def patch(self, path, body=None):
        return self.request('PATCH', path, body)

    def delete(self, path):
        return self.request('DELETE', path)


def _error_message(raw):
    try:
        data = json.loads(raw)
    except (ValueError, TypeError):
        return None
    if isinstance(data, dict):
        return data.get('message') or data.get('error')
    return None


def _parse_json(raw, url):
    if not raw or not raw.strip():
        return None
    try:
        return json.loads(raw)
    except ValueError:
        raise CliError(f'服务器 {url} 返回了非 JSON 内容') from None
