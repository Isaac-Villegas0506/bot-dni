"""
telegram/bots/fiscalia_bot.py
─────────────────────────────
Consultas de Fiscalía — extraído de BotClient.query_fiscalia_bot()

Tipos soportados: fiscalia_dni, fiscalia_ruc, fiscalia_nombre, caso_fiscal
"""
from __future__ import annotations
import asyncio
import time
from pathlib import Path
from telegram.exceptions import SinResultadosError
from telegram.guards import is_sin_resultados


TARGET_BOT = "@Infordata1_bot"

_OPTION_MAP = {
    "fiscalia_dni":    ("/fiscaliapdf", "FISCALIAPDF"),
    "fiscalia_ruc":    ("/fisruc",   "FISRUC"),
    "fiscalia_nombre": ("/fisnmpdf", "FISNMPDF"),
    "caso_fiscal":     ("/fisca",    "FISCA"),
}


async def query_fiscalia(
    client,
    target: str,
    option_type: str,
    static_base_dir: Path,
) -> dict:
    """
    Consulta datos de Fiscalía via @Infordata1_bot.

    Args:
        client:          Instancia conectada de TelegramClient.
        target:          DNI / RUC / nombre / caso.
        option_type:     Uno de: fiscalia_dni, fiscalia_ruc, fiscalia_nombre, caso_fiscal.
        static_base_dir: Directorio backend/static/ para guardar el PDF.

    Returns:
        {"archivo": "docs/<filename>", "raw_text": "<text>"}

    Raises:
        SinResultadosError: cuando el bot indica que no hay datos.
        ValueError:         cuando option_type es desconocido.
        Exception:          cuando el bot no responde.
    """
    if option_type not in _OPTION_MAP:
        raise ValueError(f"Opción de fiscalía no válida: {option_type}")

    cmd_prefix, pdf_prefix = _OPTION_MAP[option_type]
    cmd = f"{cmd_prefix} {target}"

    # Obtener ID del bot para filtrar mensajes
    try:
        bot_entity = await client.get_entity(TARGET_BOT)
        target_bot_id = bot_entity.id
    except Exception:
        target_bot_id = 0

    # Detectores de texto para cada tipo (fallback cuando reply_to_msg_id no funciona)
    _TEXT_MARKERS = {
        "fiscalia_dni":    "FISCALÍA PDF DNI",
        "fiscalia_ruc":    "FISCALÍA RUC",
        "fiscalia_nombre": "FISCALÍA POR NOMBRES",
        "caso_fiscal":     "FISCALÍA CASO",
    }

    print(f"⚖️ Enviando {cmd} al bot...")
    sent_msg = await client.send_message(TARGET_BOT, cmd)
    await asyncio.sleep(3)

    found_pdf = None
    found_text = None

    for attempt in range(15):
        print(f"🔄 Polling Fiscalía intento {attempt + 1}/15...")
        async for message in client.iter_messages(
            TARGET_BOT, limit=100, min_id=sent_msg.id, reverse=True
        ):
            if target_bot_id and message.sender_id != target_bot_id:
                continue

            text = message.text or ""
            if "procesando" in text.lower() or "espera" in text.lower():
                continue

            if is_sin_resultados(text):
                raise SinResultadosError(
                    "「❌️」Sin Resultados. Verifique los datos e intente nuevamente."
                )

            is_our = message.reply_to_msg_id == sent_msg.id
            if not is_our:
                marker = _TEXT_MARKERS.get(option_type, "")
                if marker and marker in text:
                    is_our = True

            if is_our:
                if text and not found_text:
                    found_text = text
                if (
                    message.file
                    and message.file.name
                    and (message.file.name.endswith(".pdf") or message.file.name.endswith(".txt"))
                    and (pdf_prefix in message.file.name.upper() or is_our)
                ):
                    found_pdf = message

        if found_pdf and found_text:
            break
        await asyncio.sleep(3)

    if not found_pdf or not found_text:
        raise Exception("No se obtuvo respuesta completa del bot de Fiscalía.")

    # Guardar PDF
    docs_dir = static_base_dir / "docs"
    docs_dir.mkdir(parents=True, exist_ok=True)
    safe_target = target.replace("|", "_").replace(" ", "_").replace("/", "_")
    
    ext = ".pdf"
    if found_pdf.file.name and found_pdf.file.name.endswith(".txt"):
        ext = ".txt"
        
    filename = f"{pdf_prefix}_{safe_target}_{int(time.time())}{ext}"
    file_path = docs_dir / filename
    await found_pdf.download_media(file=file_path)

    return {
        "archivo": f"docs/{filename}",
        "raw_text": found_text,
    }
