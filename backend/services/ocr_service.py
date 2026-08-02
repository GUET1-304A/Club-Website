"""OpenAI-compatible vision OCR adapter.

The service only returns text supplied by the configured provider.  It never
generates placeholder OCR text when credentials or a valid provider response
are unavailable.
"""

import base64
import json
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from services.storage_service import StoredImage


class OcrNotConfigured(RuntimeError):
    """Raised when OCR is disabled or missing required provider settings."""


class OcrRequestFailed(RuntimeError):
    """Raised when a configured OCR provider cannot complete the request."""


class OcrService:
    def __init__(self, config, opener=urlopen):
        self.config = config
        self.opener = opener

    def extract_text(self, images):
        settings = self.validate_configuration()
        if not images:
            raise OcrRequestFailed('No certificate images are available for OCR')
        content = [{
            'type': 'text',
            'text': 'Transcribe all visible text in these certificate images exactly. '
                    'Return only the transcription and do not infer missing text.',
        }]
        content.extend(_image_content(image) for image in images)
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
            with self.opener(request, timeout=30) as response:
                result = json.loads(response.read().decode('utf-8'))
        except (HTTPError, URLError, TimeoutError, ValueError, OSError) as exc:
            raise OcrRequestFailed('The OCR provider request failed') from exc
        text = _response_text(result)
        if not text:
            raise OcrRequestFailed('The OCR provider returned no text')
        return text

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
