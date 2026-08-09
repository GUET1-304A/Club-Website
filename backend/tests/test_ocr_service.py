import json
from types import SimpleNamespace

import pytest

from services.ocr_service import OcrNotConfigured, OcrRequestFailed, OcrService
from services.storage_service import StoredImage


class FakeResponse:
    def __init__(self, payload):
        self.payload = payload

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def read(self):
        return json.dumps(self.payload).encode('utf-8')


class CapturingOpener:
    def __init__(self):
        self.requests = []

    def __call__(self, request, timeout):
        self.requests.append((request, timeout))
        return FakeResponse({'choices': [{'message': {'content': 'certificate text'}}]})


class StructuredCapturingOpener:
    def __init__(self, content):
        self.content = content
        self.requests = []

    def __call__(self, request, timeout):
        self.requests.append((request, timeout))
        return FakeResponse({'choices': [{'message': {'content': self.content}}]})


class ReadFailingResponse:
    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def read(self):
        raise OSError('response stream closed')


class ReadFailingOpener:
    def __call__(self, _request, timeout):
        return ReadFailingResponse()


def _configured_service(opener):
    return OcrService(
        {
            'OCR_ENABLED': True,
            'OCR_API_KEY': 'test-key',
            'OCR_ENDPOINT': 'https://ocr.example.test/v1',
            'OCR_MODEL': 'vision-test',
        },
        opener=opener,
    )


def test_extract_text_sends_managed_png_bytes_as_data_url():
    opener = CapturingOpener()

    text = _configured_service(opener).extract_text([StoredImage(b'png-bytes', 'image/png')])

    assert text == 'certificate text'
    assert len(opener.requests) == 1
    request, timeout = opener.requests[0]
    assert request.full_url == 'https://ocr.example.test/v1/chat/completions'
    assert timeout == 30
    payload = json.loads(request.data.decode('utf-8'))
    assert payload['messages'][0]['content'][1] == {
        'type': 'image_url',
        'image_url': {'url': 'data:image/png;base64,cG5nLWJ5dGVz'},
    }


def test_extract_text_maps_response_read_oserror_to_request_failed():
    with pytest.raises(OcrRequestFailed, match='The OCR provider request failed') as error:
        _configured_service(ReadFailingOpener()).extract_text([
            StoredImage(b'png-bytes', 'image/png'),
        ])

    assert isinstance(error.value.__cause__, OSError)


@pytest.mark.parametrize(
    'images',
    (
        ['https://example.test/certificate.png'],
        [StoredImage(b'', 'image/png')],
        [StoredImage(b'gif-bytes', 'image/gif')],
    ),
)
def test_extract_text_rejects_unmanaged_or_unavailable_images_before_request(images):
    opener = CapturingOpener()

    with pytest.raises(OcrRequestFailed, match='Certificate image is unavailable'):
        _configured_service(opener).extract_text(images)

    assert opener.requests == []


def test_extract_text_rejects_duck_typed_image_before_request():
    opener = CapturingOpener()
    image = SimpleNamespace(mime_type='image/png', content=b'image-bytes')

    with pytest.raises(OcrRequestFailed, match='Certificate image is unavailable'):
        _configured_service(opener).extract_text([image])

    assert opener.requests == []


def test_extract_text_rejects_runtime_malformed_stored_image_before_request():
    opener = CapturingOpener()
    image = StoredImage(content=b'image-bytes', mime_type=[])

    with pytest.raises(OcrRequestFailed, match='Certificate image is unavailable'):
        _configured_service(opener).extract_text([image])

    assert opener.requests == []


def test_extract_fields_parses_structured_json_and_normalizes_level():
    opener = StructuredCapturingOpener(json.dumps({
        'name': '全国大学生数学建模竞赛一等奖',
        'level': '国家级',
        'category': '学科竞赛',
        'winner': '张三',
        'issuer': '中国工业与应用数学学会',
        'date': '2025-09-15',
        'description': '全国一等奖',
        'raw_text': '荣誉证书\n张三 同学...',
    }))

    result = _configured_service(opener).extract_fields([StoredImage(b'png-bytes', 'image/png')])

    assert result == {
        'ocr_text': '荣誉证书\n张三 同学...',
        'fields': {
            'name': '全国大学生数学建模竞赛一等奖',
            'level': 'national',
            'category': '学科竞赛',
            'winner': '张三',
            'issuer': '中国工业与应用数学学会',
            'date': '2025-09-15',
            'description': '全国一等奖',
        },
    }
    request, timeout = opener.requests[0]
    assert timeout == 30
    payload = json.loads(request.data.decode('utf-8'))
    prompt = payload['messages'][0]['content'][0]['text']
    assert 'structured' in prompt.lower()
    assert 'raw_text' in prompt


def test_extract_fields_tolerates_markdown_fences():
    opener = StructuredCapturingOpener(
        '```json\n{"name": "蓝桥杯", "level": "provincial", '
        '"issuer": "工业和信息化部", "date": "2025-04", "raw_text": "证书"}'
        '\n```'
    )

    result = _configured_service(opener).extract_fields([StoredImage(b'png-bytes', 'image/png')])

    assert result['fields']['name'] == '蓝桥杯'
    assert result['fields']['level'] == 'provincial'
    assert result['ocr_text'] == '证书'


def test_extract_fields_returns_empty_fields_when_response_is_not_json():
    opener = StructuredCapturingOpener('荣誉证书全文，无结构化 JSON')

    result = _configured_service(opener).extract_fields([StoredImage(b'png-bytes', 'image/png')])

    assert result['ocr_text'] == '荣誉证书全文，无结构化 JSON'
    assert result['fields'] == {
        'name': '', 'level': '', 'category': '', 'winner': '',
        'issuer': '', 'date': '', 'description': '',
    }


def test_extract_fields_maps_read_oserror_to_request_failed():
    with pytest.raises(OcrRequestFailed, match='The OCR provider request failed'):
        _configured_service(ReadFailingOpener()).extract_fields([
            StoredImage(b'png-bytes', 'image/png'),
        ])


def test_validate_configuration_raises_without_sending_request():
    opener = CapturingOpener()

    with pytest.raises(OcrNotConfigured, match='OCR is disabled or its provider settings are incomplete'):
        OcrService({'OCR_ENABLED': True}, opener=opener).validate_configuration()

    assert opener.requests == []


def test_validate_configuration_returns_valid_settings_without_sending_request():
    opener = CapturingOpener()

    settings = _configured_service(opener).validate_configuration()

    assert settings == {
        'api_key': 'test-key',
        'endpoint': 'https://ocr.example.test/v1',
        'model': 'vision-test',
    }
    assert opener.requests == []
