"""
telegram/bots/facial_bot.py
────────────────────────────
Búsqueda facial — extraído de BotClient.generate_facial()
"""
from __future__ import annotations
import asyncio
import uuid
import re
from pathlib import Path
from telegram.exceptions import SinResultadosError
from telegram.guards import is_sin_resultados

TARGET_BOT = "@Infordata1_bot"


def _clean_bot_text(text: str) -> str:
    if not text:
        return ""
    text = re.sub(r"(?im)^usuario\s*:.*$", "", text)
    text = re.sub(r"(?im)^cr[eé]ditos\s*:.*$", "", text)
    return text.strip()


async def generate_facial(client, file_path: str, static_base_dir: Path) -> dict:
    """
    Envía una imagen al bot y obtiene los resultados de búsqueda facial.

    Args:
        client:          TelegramClient conectado.
        file_path:       Ruta local de la imagen a enviar.
        static_base_dir: Directorio backend/static/.

    Returns:
        {"file_path": "files/<filename>" | None, "raw_text": str}
    Raises:
        SinResultadosError, Exception
    """
    try:
        bot_entity = await client.get_entity(TARGET_BOT)
        target_bot_id = bot_entity.id
    except Exception:
        target_bot_id = 0

    print("📸 Generating Búsqueda Facial...")

    try:
        sent_msg = await client.send_file(TARGET_BOT, file=file_path, caption="/facial")
        await asyncio.sleep(10)

        found_msg = None
        for attempt in range(40):
            print(f"🔄 Polling Facial intento {attempt+1}/40...")
            async for message in client.iter_messages(TARGET_BOT, limit=50, min_id=sent_msg.id, reverse=True):
                if target_bot_id and message.sender_id != target_bot_id:
                    continue
                text = message.text or ""

                # Ignorar mensajes de reenvío entre bots
                if "/facial" in text.lower() and "@" in text:
                    print("⏩ Facial: Bot reenviando a otro bot, esperando resultado real...")
                    continue

                if any(k in text.lower() for k in ["procesando", "espere", "buscando", "generando", "facial_procesando"]):
                    continue

                # Verificar que la respuesta es para nuestra imagen
                if message.reply_to and message.reply_to.reply_to_msg_id != sent_msg.id:
                    continue

                if "FACIAL" in text.upper() or "BÚSQUEDA FACIAL" in text.upper():
                    found_msg = message
                    break

                if is_sin_resultados(text):
                    raise SinResultadosError("No se encontraron coincidencias faciales en la base de datos.")

                if "no se recibió el reporte pdf" in text.lower() or "no se recibio el reporte pdf" in text.lower():
                    raise SinResultadosError(
                        "❰⚠️❱ No se recibió el reporte PDF. Verifique la imagen y busque otra mejor donde se pueda reconocer claramente a la persona."
                    )

                if "error" in text.lower() or "no encontrado" in text.lower():
                    raise Exception("Ocurrió un error al procesar la imagen facial. Intenta nuevamente.")

            if found_msg:
                break
            await asyncio.sleep(2)

        if not found_msg:
            raise Exception("El bot no respondió a tiempo. Asegúrate de enviar una imagen clara del rostro.")

        file_url = None
        if found_msg.document and found_msg.document.mime_type == "application/pdf":
            print("✅ PDF Facial encontrado. Descargando...")
            files_dir = static_base_dir / "files"
            files_dir.mkdir(parents=True, exist_ok=True)
            filename = f"FACIAL_{uuid.uuid4().hex}.pdf"
            path = files_dir / filename
            await found_msg.download_media(file=path)
            file_url = f"files/{filename}"

        return {
            "file_path": file_url,
            "raw_text": _clean_bot_text(found_msg.message or found_msg.text or ""),
        }

    except SinResultadosError:
        raise
    except Exception as e:
        if isinstance(e, SinResultadosError):
            raise
        print(f"❌ Error Búsqueda Facial: {e}")
        raise Exception(f"Ocurrió un error en la búsqueda facial: {e}")
