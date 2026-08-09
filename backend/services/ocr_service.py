"""OpenAI-compatible vision OCR adapter.

The service only returns text supplied by the configured provider.  It never
generates placeholder OCR text when credentials or a valid provider response
are unavailable.

Two modes are available:
  - ``extract_text``: plain transcription of every visible character.
  - ``extract_fields``: structured extraction (award name, level, issuer,
    date, winner, ...) plus the full raw transcription.  Fields that cannot be
    read from the image are returned as empty strings; the caller decides how
    to surface them for manual correction.
"""

import base64
import json
import re
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from services.storage_service import StoredImage


class OcrNotConfigured(RuntimeError):
    """Raised when OCR is disabled or missing required provider settings."""


class OcrRequestFailed(RuntimeError):
    """Raised when a configured OCR provider cannot complete the request."""


_FIELD_NAMES = ('name', 'level', 'category', 'winner', 'issuer', 'date', 'description')

_FIELDS_PROMPT = (
    'You are a certificate recognition engine. Read the certificate image(s) '
    'and extract structured information. Return ONLY valid JSON without markdown '
    'fences in this exact shape: '
    '{"name": string, "level": "national"|"provincial"|"school"|"other", '
    '"category": string, "winner": string, "issuer": string, "date": string, '
    '"description": string, "raw_text": string}. '
    'Use an empty string when a field is not visible. date uses YYYY-MM-DD or '
    'YYYY-MM. Map level from the certificate: national for national-level awards, '
    'provincial for provincial-level awards, school for university/college-level '
    'awards, otherwise other. raw_text must be the full exact transcription of '
    'all visible text on the certificate.'
)


class OcrService:
    def __init__(self, config, opener=urlopen):
        self.config = config
        self.opener = opener

    def extract_text(self, images):
        """Transcribe all visible certificate text exactly."""
        settings = self.validate_configuration()
        if not images:
            raise OcrRequestFailed('No certificate images are available for OCR')
        content = [{
            'type': 'text',
            'text': 'Transcribe all visible text in these certificate images exactly. '
                    'Return only the transcription and do not infer missing text.',
        }]
        content.extend(_image_content(image) for image in images)
        result = _request(settings, content, self.opener)
        text = _response_text(result)
        if not text:
            raise OcrRequestFailed('The OCR provider returned no text')
        return text

    def extract_fields(self, images):
        """Extract structured certificate fields plus the raw transcription.

        Returns:
            dict: {"ocr_text": str, "fields": {"name", "level", "category",
                  "winner", "issuer", "date", "description"}}.  Fields the
                  provider cannot determine are empty strings.

        Raises:
            OcrNotConfigured: provider disabled or incomplete.
            OcrRequestFailed: request failed or returned no usable content.
        """
        settings = self.validate_configuration()
        if not images:
            raise OcrRequestFailed('No certificate images are available for OCR')
        content = [{'type': 'text', 'text': _FIELDS_PROMPT}]
        content.extend(_image_content(image) for image in images)
        result = _request(settings, content, self.opener)
        return _parse_fields_result(result)

    def validate_configuration(self):
        """Return validated provider settings without making an OCR request."""
        return self._settings()

    def _settings(self):
        enabled = self.config.get('OCR_ENABLED', False)
        settings = {
            'api_key': self.config.get('OCR_API_KEY') or self.config.get('AI_API_KEY'),
            'endpoint': self.config.get('OCR_ENDPOINT') or self.config.get('AI_BASE_URL'),
            'model': self.config.get('OCR_MODEL') or self.config.get('AI_MODEL'),
        }
        if not enabled or not all(settings.values()):
            raise OcrNotConfigured('OCR is disabled or its provider settings are incomplete')
        return settings


def _request(settings, content, opener, timeout=30):
    """POST an OpenAI-compatible vision payload and return the parsed response."""
    payload = {
        'model': settings['model'],
        'messages': [{'role': 'user', 'content': content}],
        'temperature': 0,
    }
    request = Request(
        _chat_completions_url(settings['endpoint']),
        data=json.dumps(payload).encode('utf-8'),
        headers={
            'Authorization': f"Bearer {settings['api_key']}",
            'Content-Type': 'application/json',
        },
        method='POST',
    )
    try:
        with opener(request, timeout=timeout) as response:
            result = json.loads(response.read().decode('utf-8'))
    except (HTTPError, URLError, TimeoutError, ValueError, OSError) as exc:
        raise OcrRequestFailed('The OCR provider request failed') from exc
    return result


def _parse_fields_result(result):
    """Normalize provider output into {"ocr_text", "fields"}."""
    raw = _response_text(result)
    fields = {}
    obj = _json_object(raw)
    if isinstance(obj, dict):
        for key in _FIELD_NAMES:
            value = obj.get(key)
            fields[key] = value if isinstance(value, str) else ''
        fields['level'] = _normalize_level(fields['level'])
        raw_text = obj.get('raw_text')
        ocr_text = raw_text if isinstance(raw_text, str) else raw
    else:
        fields = {key: '' for key in _FIELD_NAMES}
        ocr_text = raw
    return {
        'ocr_text': (ocr_text or '').strip(),
        'fields': fields,
    }


def _normalize_level(level):
    """Map a provider-supplied level label to the canonical enum value."""
    value = (level or '').strip().lower()
    aliases = {
        'national': 'national', '国家级': 'national', '国家': 'national',
        'provincial': 'provincial', '省级': 'provincial',
        'school': 'school', '校级': 'school', '院级': 'school',
        'other': 'other', '其他': 'other',
    }
    return aliases.get(value, value if value in ('national', 'provincial', 'school', 'other') else 'other')


def _json_object(text):
    """Parse JSON from a model response, tolerating markdown fences."""
    if not isinstance(text, str) or not text.strip():
        return None
    cleaned = re.sub(r'```(?:json)?\s*', '', text).strip()
    candidates = [cleaned]
    start = cleaned.find('{')
    end = cleaned.rfind('}')
    if start != -1 and end > start:
        candidates.append(cleaned[start:end + 1])
    for candidate in candidates:
        try:
            parsed = json.loads(candidate)
        except (ValueError, TypeError):
            continue
        if isinstance(parsed, dict):
            return parsed
    return None


def _image_content(image):
    if not isinstance(image, StoredImage):
        raise OcrRequestFailed('Certificate image is unavailable')

    mime_type = image.mime_type
    content = image.content
    if (
        not isinstance(mime_type, str)
        or mime_type not in {'image/jpeg', 'image/png', 'image/webp'}
        or not isinstance(content, bytes)
        or not content
    ):
        raise OcrRequestFailed('Certificate image is unavailable')

    encoded = base64.b64encode(content).decode('ascii')
    return {
        'type': 'image_url',
        'image_url': {'url': f'data:{mime_type};base64,{encoded}'},
    }


def _chat_completions_url(endpoint):
    endpoint = endpoint.rstrip('/')
    return endpoint if endpoint.endswith('/chat/completions') else f'{endpoint}/chat/completions'


def _response_text(result):
    try:
        content = result['choices'][0]['message']['content']
    except (KeyError, IndexError, TypeError):
        return ''
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        return '\n'.join(
            part.get('text', '') for part in content if isinstance(part, dict)
        ).strip()
    return ''
