"""Provider-neutral AI configuration status helpers.

This module intentionally exposes no public AI route.  It only lets features
such as OCR consume a consistent, non-secret configuration shape.
"""


class AIService:
    def __init__(self, config):
        self.config = config

    def status(self):
        enabled = bool(self.config.get('AI_ENABLED', False))
        configured = enabled and all(
            self.config.get(key) for key in ('AI_API_KEY', 'AI_BASE_URL', 'AI_MODEL')
        )
        return {
            'enabled': enabled,
            'configured': configured,
            'provider': self.config.get('AI_PROVIDER') or None,
        }
