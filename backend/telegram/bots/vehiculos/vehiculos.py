"""
telegram/bots/vehiculos_bot.py
───────────────────────────────
Consulta de récord vehicular — extraído de BotClient.query_record()
"""
from __future__ import annotations
import asyncio
import re
from pathlib import Path
from telegram.exceptions import SinResultadosError
from telegram.guards import is_sin_resultados

TARGET_BOT = "@Infordata1_bot"


async def query_record(client, target: str, static_base_dir: Path) -> dict:
    """
    Consulta récord vehicular usando /record en @Infordata1_bot.

    Args:
        client:          TelegramClient conectado.
        target:          DNI o placa.
        static_base_dir: Directorio backend/static/.

    Returns:
        {"raw_text": str, "file_path": str|None}
    Raises:
        SinResultadosError, Exception
    """
    try:
        bot_entity = await client.get_entity(TARGET_BOT)
        target_bot_id = bot_entity.id
    except Exception:
        target_bot_id = 0

    print(f"🚗 Enviando /record {target} al bot {TARGET_BOT}...")
    sent_msg = await client.send_message(TARGET_BOT, f"/record {target}")
    await asyncio.sleep(2)

    received_parts: dict[int, str] = {}
    seen_ids: set[int] = set()
    total_parts = None
    file_path_rel = None

    for attempt in range(12):
        print(f"🔄 record intento {attempt+1}/12...")
        async for message in client.iter_messages(TARGET_BOT, limit=100, min_id=sent_msg.id, reverse=True):
            if message.id in seen_ids:
                continue
            if target_bot_id and message.sender_id != target_bot_id:
                continue
            text = message.text or ""
            if not text:
                continue
            seen_ids.add(message.id)
            text_upper = text.upper()

            # Anti-spam
            if "ANTI-SPAM" in text_upper or "debes esperar" in text.lower():
                wait_time = 15
                try:
                    m = re.search(r"(\d+(?:\.\d+)?)s", text)
                    if m:
                        wait_time = float(m.group(1)) + 2
                except Exception:
                    pass
                print(f"⚠️ Anti-spam record: esperando {wait_time:.0f}s...")
                await asyncio.sleep(wait_time)
                sent_msg = await client.send_message(TARGET_BOT, f"/record {target}")
                await asyncio.sleep(5)
                seen_ids.clear()
                break

            if is_sin_resultados(text):
                raise SinResultadosError(text)

            if any(k in text.lower() for k in ["procesando", "buscando", "cargando", "analizando", "espere", "moment"]):
                continue

            is_valid = "RECORD" in text_upper or "INFRACCIONES" in text_upper or "SANCIONES" in text_upper
            if not is_valid:
                raise Exception("UNKNOWN_RESPONSE: No se encontraron datos.")

            pm = re.search(r"(\d+)\s*/\s*(\d+)", text)
            if pm:
                part_num    = int(pm.group(1))
                total_parts = int(pm.group(2))
            else:
                part_num    = 1
                total_parts = 1
            received_parts[part_num] = text

            # Descargar PDF si existe
            if message.media:
                files_dir = static_base_dir / "files"
                files_dir.mkdir(parents=True, exist_ok=True)
                filename = f"RECORD_{target}.pdf"
                abs_path = files_dir / filename
                await message.download_media(file=abs_path)
                file_path_rel = f"files/{filename}"

        if total_parts is not None and len(received_parts) >= total_parts:
            break
        await asyncio.sleep(1.5)

    if not received_parts:
        raise Exception("UNKNOWN_RESPONSE: No se encontraron datos.")

    combined = "\n\n".join(received_parts[k] for k in sorted(received_parts))
    return {"raw_text": combined, "file_path": file_path_rel}
