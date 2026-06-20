"""
telegram/ — Infraestructura de integración con Telegram (Telethon).

Módulos disponibles:
  exceptions      → SinResultadosError (excepción de dominio)
  guards          → check_antispam, is_sin_resultados, is_waiting_message
  polling         → poll_for_response, PollConfig, PollResult, validators
  client_manager  → TelegramClientManager (ciclo de vida de clientes Telethon)
"""

from telegram.exceptions import SinResultadosError
from telegram.guards import (
    check_antispam,
    is_sin_resultados,
    is_waiting_message,
)
from telegram.polling import (
    PollConfig,
    PollResult,
    poll_for_response,
    validator_any,
    validator_contains_keywords,
    validator_has_image,
    validator_has_pdf,
)
# TelegramClientManager requiere telethon — importar solo si está disponible
try:
    from telegram.client_manager import TelegramClientManager
    _has_client_manager = True
except ImportError:
    _has_client_manager = False

__all__ = [
    # Excepciones
    "SinResultadosError",
    # Guards
    "check_antispam",
    "is_sin_resultados",
    "is_waiting_message",
    # Polling
    "PollConfig",
    "PollResult",
    "poll_for_response",
    "validator_any",
    "validator_contains_keywords",
    "validator_has_image",
    "validator_has_pdf",
]

if _has_client_manager:
    __all__.append("TelegramClientManager")
