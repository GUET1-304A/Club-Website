"""OpenAI-compatible chat completions client used by the project-management agent.

The service is provider-neutral: it only requires an OpenAI-chat-completions
compatible endpoint (DeepSeek, Qwen/DashScope, Zhipu GLM, Kimi, OpenAI, ...).
It supports tool calling (function calling) so the agent can execute real
operations against the platform's REST APIs.

The service intentionally keeps no credentials in code; everything comes from
the Flask configuration (AI_ENABLED / AI_BASE_URL / AI_API_KEY / AI_MODEL).
"""

import json
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


class AiNotConfigured(RuntimeError):
    """Raised when the AI provider is disabled or missing required settings."""


class AiRequestFailed(RuntimeError):
    """Raised when a configured AI provider cannot complete the request."""


class AIService:
    """Thin OpenAI-compatible chat completions client."""

    def __init__(self, config, opener=urlopen):
        self.config = config
        self.opener = opener

    def status(self):
        """Return provider status without making a request."""
        enabled = bool(self.config.get('AI_ENABLED', False))
        configured = enabled and all(
            self.config.get(key) for key in ('AI_API_KEY', 'AI_BASE_URL', 'AI_MODEL')
        )
        return {
            'enabled': enabled,
            'configured': configured,
            'provider': self.config.get('AI_PROVIDER') or None,
        }

    def chat_completion(self, messages, tools=None, temperature=0.3, max_tokens=None):
        """Call the configured chat completions endpoint.

        Args:
            messages: list of chat messages ({'role', 'content'}).
            tools: optional list of tool schemas for function calling.
            temperature: sampling temperature.
            max_tokens: optional output token cap.

        Returns:
            dict: parsed provider JSON response.

        Raises:
            AiNotConfigured: provider disabled or incomplete.
            AiRequestFailed: request/response failure.
        """
        settings = self._settings()
        payload = {
            'model': settings['model'],
            'messages': messages,
            'temperature': temperature,
        }
        if tools:
            payload['tools'] = tools
        if max_tokens:
            payload['max_tokens'] = max_tokens

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
            with self.opener(request, timeout=60) as response:
                result = json.loads(response.read().decode('utf-8'))
        except (HTTPError, URLError, TimeoutError, ValueError, OSError) as exc:
            raise AiRequestFailed('The AI provider request failed') from exc
        if 'choices' not in result or not result['choices']:
            raise AiRequestFailed('The AI provider returned no response')
        return result

    def chat_completion_stream(self, messages, tools=None, temperature=0.3, max_tokens=None):
        """Call the configured endpoint with stream=true and yield parsed chunks.

        Yields each parsed SSE chunk (dict) as it arrives. On transport or
        protocol failure raises AiRequestFailed; provider-level errors are
        reported as chunks with an 'error' field, mirroring OpenAI behaviour.
        """
        settings = self._settings()
        payload = {
            'model': settings['model'],
            'messages': messages,
            'temperature': temperature,
            'stream': True,
        }
        if tools:
            payload['tools'] = tools
        if max_tokens:
            payload['max_tokens'] = max_tokens

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
            response = self.opener(request, timeout=120)
        except (HTTPError, URLError, TimeoutError, OSError) as exc:
            raise AiRequestFailed('The AI provider request failed') from exc

        try:
            for raw_line in response:
                if not isinstance(raw_line, bytes):
                    raw_line = str(raw_line).encode('utf-8')
                line = raw_line.decode('utf-8', errors='replace').strip()
                if not line or not line.startswith('data:'):
                    continue
                data = line[len('data:'):].strip()
                if not data or data == '[DONE]':
                    break
                try:
                    chunk = json.loads(data)
                except ValueError:
                    continue
                if 'error' in chunk:
                    raise AiRequestFailed(
                        f"The AI provider reported an error: {chunk['error']}"
                    )
                yield chunk
        finally:
            try:
                response.close()
            except Exception:
                pass

    def validate_configuration(self):
        """Return validated provider settings without making a request."""
        return self._settings()

    def _settings(self):
        enabled = self.config.get('AI_ENABLED', False)
        settings = {
            'api_key': self.config.get('AI_API_KEY'),
            'endpoint': self.config.get('AI_BASE_URL'),
            'model': self.config.get('AI_MODEL'),
        }
        if not enabled or not all(settings.values()):
            raise AiNotConfigured('AI is disabled or its provider settings are incomplete')
        return settings


def response_text(result):
    """Extract the assistant message content from a chat completion response."""
    try:
        content = result['choices'][0]['message'].get('content')
    except (KeyError, IndexError, TypeError):
        return ''
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        return '\n'.join(
            part.get('text', '') for part in content if isinstance(part, dict)
        ).strip()
    return ''


def response_tool_calls(result):
    """Extract tool calls from a chat completion response.

    Returns:
        list of dicts: {'id', 'name', 'arguments'} where arguments is a parsed
        dict (empty dict when unparseable).
    """
    try:
        message = result['choices'][0]['message']
    except (KeyError, IndexError, TypeError):
        return []
    raw_calls = message.get('tool_calls') or []
    calls = []
    for call in raw_calls:
        if not isinstance(call, dict):
            continue
        function = call.get('function') or {}
        arguments = {}
        raw_arguments = function.get('arguments')
        if isinstance(raw_arguments, str):
            try:
                parsed = json.loads(raw_arguments)
                if isinstance(parsed, dict):
                    arguments = parsed
            except ValueError:
                arguments = {}
        elif isinstance(raw_arguments, dict):
            arguments = raw_arguments
        calls.append({
            'id': call.get('id') or '',
            'name': function.get('name') or '',
            'arguments': arguments,
        })
    return calls


def _chat_completions_url(endpoint):
    endpoint = endpoint.rstrip('/')
    return endpoint if endpoint.endswith('/chat/completions') else f'{endpoint}/chat/completions'
