"""
telegram/polling.py
───────────────────
Patrón genérico de polling de mensajes de Telegram.

MOTIVACIÓN: El 90% de los métodos de BotClient repiten el mismo
esqueleto de polling:
  1. Enviar un comando
  2. Esperar N segundos
  3. Iterar mensajes hasta encontrar la respuesta o agotar intentos
  4. Manejar anti-spam y sin-resultados

Este módulo extrae ese patrón en una función reutilizable y tipos
de datos bien definidos.

COMPATIBILIDAD: BotClient NO se modifica. Este módulo es puramente
aditivo. Se puede adoptar método por método en una refactorización
futura.

USO BÁSICO:
    from telegram.polling import poll_for_response, PollConfig

    config = PollConfig(
        bot="@Infordata1_bot",
        command=f"/antpen {dni}",
        initial_wait=8,
        max_attempts=15,
        poll_interval=2,
    )

    async def is_valid(msg) -> bool:
        text = msg.text or ""
        return "ANTECEDENTES PENALES" in text.upper() and dni in text

    result = await poll_for_response(client, config, is_valid)
    if result.found:
        print(result.message.text)
"""

from __future__ import annotations

import asyncio
import logging
import re
from dataclasses import dataclass, field
from typing import Awaitable, Callable

from telegram.guards import check_antispam, is_sin_resultados, is_waiting_message
from telegram.exceptions import SinResultadosError

logger = logging.getLogger(__name__)


# ── Configuración de polling ──────────────────────────────────────────────────


@dataclass
class PollConfig:
    """
    Parámetros de una sesión de polling de mensajes.

    Atributos:
        bot:                Username o ID del bot / grupo a consultar.
        command:            Comando a enviar (p.ej. "/dnix 12345678").
        initial_wait:       Segundos a esperar tras enviar el comando.
        max_attempts:       Número máximo de ciclos de polling.
        poll_interval:      Segundos entre cada ciclo de polling.
        target_bot_id:      ID numérico del bot para filtrar mensajes.
                            Si es 0, no se filtra por sender.
        limit_per_iter:     Mensajes a leer por iteración.
        stop_on_sin_result: Si True, lanza SinResultadosError al detectarlo.
        stop_on_antispam:   Si True, lanza Exception con el mensaje de espera.
        label:              Etiqueta para logs (p.ej. "DNI electrónico").
    """

    bot: str | int
    command: str
    initial_wait: int = 3
    max_attempts: int = 10
    poll_interval: int = 2
    target_bot_id: int = 0
    limit_per_iter: int = 50
    stop_on_sin_result: bool = True
    stop_on_antispam: bool = False
    label: str = "consulta"


# ── Resultado de polling ──────────────────────────────────────────────────────


@dataclass
class PollResult:
    """
    Resultado de una sesión de polling.

    Atributos:
        found:      True si se encontró un mensaje que satisface is_valid.
        message:    El mensaje encontrado (None si found=False).
        all_messages: Todos los mensajes capturados (útil para respuestas paginadas).
        timed_out:  True si se agotaron los intentos sin encontrar respuesta.
        antispam_msg: Mensaje de anti-spam si se detectó (None si no hubo).
    """

    found: bool = False
    message: object = None          # telethon.tl.types.Message
    all_messages: list = field(default_factory=list)
    timed_out: bool = False
    antispam_msg: str | None = None


# ── Función principal de polling ──────────────────────────────────────────────


async def poll_for_response(
    client,
    config: PollConfig,
    is_valid: Callable[[object], bool | Awaitable[bool]],
    *,
    baseline_id: int = 0,
) -> PollResult:
    """
    Envía un comando al bot y hace polling hasta obtener una respuesta válida.

    Args:
        client:     Instancia de TelegramClient (Telethon).
        config:     Configuración de polling (PollConfig).
        is_valid:   Función sincrónica o asincrónica que recibe un mensaje
                    y devuelve True si es la respuesta esperada.
        baseline_id: ID de mensaje antes del envío. Si >0, solo considera
                    mensajes con ID mayor (evita capturar respuestas anteriores).

    Returns:
        PollResult con el resultado del polling.

    Raises:
        SinResultadosError: Si el bot reporta sin resultados y
                            config.stop_on_sin_result es True.
        Exception:          Si se detecta anti-spam y config.stop_on_antispam
                            es True.
    """
    result = PollResult()
    seen_ids: set[int] = set()

    # 1. Enviar el comando
    logger.info("[%s] Enviando: %s", config.label, config.command)
    sent_msg = await client.send_message(config.bot, config.command)

    # 2. Espera inicial
    logger.info("[%s] Esperando %ds iniciales...", config.label, config.initial_wait)
    await asyncio.sleep(config.initial_wait)

    # 3. Loop de polling
    for attempt in range(config.max_attempts):
        logger.debug("[%s] Polling intento %d/%d", config.label, attempt + 1, config.max_attempts)

        async for msg in client.iter_messages(
            config.bot,
            limit=config.limit_per_iter,
            min_id=sent_msg.id,
            reverse=True,
        ):
            if msg.id in seen_ids:
                continue

            # Filtrar por bot sender si se configuró
            if config.target_bot_id and msg.sender_id != config.target_bot_id:
                continue

            # Solo mensajes nuevos (posteriores a la línea de base)
            if baseline_id > 0 and msg.id <= baseline_id:
                continue

            text = msg.text or ""

            # ── Anti-spam ──────────────────────────────────────────────────
            spam_msg = check_antispam(text)
            if spam_msg:
                logger.warning("[%s] Anti-spam detectado: %s", config.label, spam_msg[:60])
                result.antispam_msg = spam_msg
                if config.stop_on_antispam:
                    raise Exception(spam_msg)
                # Si no detenemos, romper el inner loop y continuar con el outer
                break

            # ── Sin Resultados ─────────────────────────────────────────────
            if config.stop_on_sin_result and is_sin_resultados(text):
                logger.info("[%s] Sin resultados detectado.", config.label)
                raise SinResultadosError(
                    "「❌️」Sin Resultados. Verifique los datos e intente nuevamente."
                )

            # ── Mensajes de espera intermedios ─────────────────────────────
            if is_waiting_message(text):
                logger.debug("[%s] Mensaje de espera intermedio, ignorando.", config.label)
                continue

            # ── Validación de respuesta ────────────────────────────────────
            seen_ids.add(msg.id)
            valid = await _call_validator(is_valid, msg)
            if valid:
                logger.info("[%s] ✅ Respuesta válida encontrada (msg id=%d).", config.label, msg.id)
                result.found = True
                result.message = msg
                result.all_messages.append(msg)
                return result

            # Guardamos mensajes no-válidos por si el caller necesita el historial
            result.all_messages.append(msg)

        # Si ya encontramos (se debería haber retornado), salir
        if result.found:
            break

        await asyncio.sleep(config.poll_interval)

    # 4. Fin del loop sin resultado
    if not result.found:
        result.timed_out = True
        logger.warning(
            "[%s] Timeout tras %d intentos.", config.label, config.max_attempts
        )

    return result


# ── Helpers internos ──────────────────────────────────────────────────────────


async def _call_validator(
    fn: Callable[[object], bool | Awaitable[bool]],
    msg: object,
) -> bool:
    """Llama a la función is_valid sea sincrónica o asincrónica."""
    result = fn(msg)
    if asyncio.iscoroutine(result):
        return await result
    return bool(result)


# ── Helpers de alto nivel para patrones frecuentes ────────────────────────────


def validator_contains_keywords(*keywords: str, case_sensitive: bool = False):
    """
    Crea un validador que comprueba si el texto del mensaje contiene
    TODOS los keywords indicados.

    Args:
        keywords:        Palabras clave a buscar en el texto.
        case_sensitive:  Si False (por defecto), la búsqueda ignora mayúsculas.

    Returns:
        Función validadora compatible con poll_for_response.

    Ejemplo:
        is_valid = validator_contains_keywords("ANTECEDENTES", "12345678")
    """
    def _validator(msg) -> bool:
        text = msg.text or ""
        if not case_sensitive:
            text = text.upper()
            return all(kw.upper() in text for kw in keywords)
        return all(kw in text for kw in keywords)
    return _validator


def validator_has_pdf():
    """
    Crea un validador que devuelve True si el mensaje tiene un documento PDF.

    Returns:
        Función validadora compatible con poll_for_response.
    """
    def _validator(msg) -> bool:
        return bool(
            msg.document and
            getattr(msg.document, "mime_type", "") == "application/pdf"
        )
    return _validator


def validator_has_image():
    """
    Crea un validador que devuelve True si el mensaje tiene una imagen.

    Returns:
        Función validadora compatible con poll_for_response.
    """
    def _validator(msg) -> bool:
        if msg.photo:
            return True
        if msg.document and "image" in getattr(msg.document, "mime_type", ""):
            return True
        return False
    return _validator


def validator_any(*validators):
    """
    Combina varios validadores con OR lógico.

    Args:
        validators: Funciones validadoras.

    Returns:
        Función validadora que devuelve True si ALGUNO de los
        validadores devuelve True.
    """
    def _validator(msg) -> bool:
        return any(v(msg) for v in validators)
    return _validator
