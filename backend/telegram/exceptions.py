"""
telegram/exceptions.py
─────────────────────
Excepciones personalizadas del módulo de Telegram.

COMPATIBILIDAD: SinResultadosError se re-exporta desde aquí para que
cualquier módulo que ya la importaba desde bot_client siga funcionando
sin cambios. El alias en bot_client.py también permanece.
"""


class SinResultadosError(Exception):
    """
    Lanzada cuando un bot de Telegram reporta explícitamente que no
    encontró información para la consulta realizada.

    Ejemplo de uso:
        raise SinResultadosError("No se encontraron datos para el DNI 12345678.")
    """
    pass


class TelegramConnectionError(Exception):
    """
    Lanzada cuando no es posible establecer o mantener la conexión
    con la API de Telegram.
    """
    pass


class BotPoolExhaustedError(Exception):
    """
    Lanzada cuando todos los bots del pool están ocupados o en
    período de enfriamiento (anti-spam) y no se pudo obtener
    ningún resultado.
    """
    pass


class AntiSpamError(Exception):
    """
    Lanzada cuando un bot detecta uso excesivo y solicita esperar
    un período de tiempo antes de volver a consultar.

    Attributes:
        wait_message (str): Mensaje con el tiempo de espera sugerido.
    """
    def __init__(self, wait_message: str):
        self.wait_message = wait_message
        super().__init__(wait_message)
