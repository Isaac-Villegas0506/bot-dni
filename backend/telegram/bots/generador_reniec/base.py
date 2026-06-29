from __future__ import annotations
import asyncio
import re
from pathlib import Path
from parser import parse_bot_response
from telegram.exceptions import SinResultadosError
from telegram.guards import is_sin_resultados

TARGET_BOT = "@Infordata1_bot"

def _clean_bot_text(text: str) -> str:
    if not text:
        return ""
    text = re.sub(r"(?im)^usuario\s*:.*$", "", text)
    text = re.sub(r"(?im)^cr[eé]ditos\s*:.*$", "", text)
    return text.strip()

async def _generate_c4(
    client,
    dni: str,
    command: str,
    file_prefix: str,
    static_base_dir: Path,
    label: str,
) -> dict:
    """Lógica compartida para generar fichas C4."""
    try:
        bot_entity = await client.get_entity(TARGET_BOT)
        target_bot_id = bot_entity.id
    except Exception:
        target_bot_id = 0

    print(f"💎 Generating {label} for {dni}...")

    try:
        sent_msg = await client.send_message(TARGET_BOT, f"{command} {dni}")
        await asyncio.sleep(15)

        found_msg = None
        found_image = None

        for attempt in range(12):
            print(f"🔄 Polling {label} intento {attempt+1}/12...")
            async for message in client.iter_messages(TARGET_BOT, limit=100, min_id=sent_msg.id, reverse=True):
                if target_bot_id and message.sender_id != target_bot_id:
                    continue
                if message.photo or message.document:
                    found_image = message
                text = message.text or ""
                if "procesando" in text.lower() or "espere" in text.lower():
                    continue
                if is_sin_resultados(text) and str(dni) in text:
                    raise SinResultadosError(text)
                if ("C4" in text.upper() or "ᴄ𝟺" in text) and str(dni) in text:
                    found_msg = message
                    break
                if "error" in text.lower() or "no encontrado" in text.lower():
                    raise Exception(f"Hubo un error en la generación del documento ({label}). Inténtalo nuevamente.")
            if found_msg:
                break
            await asyncio.sleep(2)

        if not found_msg:
            raise Exception(f"Hubo un error en la generación del documento ({label}). Inténtalo nuevamente.")

        file_path = None
        media_msg = found_msg if getattr(found_msg, "media", None) else found_image
        if media_msg and getattr(media_msg, "media", None):
            files_dir = static_base_dir / "files"
            files_dir.mkdir(parents=True, exist_ok=True)
            ext = "jpg" if getattr(media_msg, "photo", None) else "pdf"
            filename = f"{file_prefix}_{dni}.{ext}"
            path = files_dir / filename
            await media_msg.download_media(file=path)
            file_path = f"files/{filename}"

        parsed = parse_bot_response(found_msg.text or "")
        result = {
            "raw_text": _clean_bot_text(found_msg.text or ""),
            **parsed,
        }
        if file_path:
            result["file_path"] = file_path
        return result

    except SinResultadosError:
        raise
    except Exception as e:
        if isinstance(e, SinResultadosError):
            raise
        print(f"❌ Error {label}: {e}")
        raise Exception(f"Hubo un error en la generación del documento ({label}). Inténtalo nuevamente.")
