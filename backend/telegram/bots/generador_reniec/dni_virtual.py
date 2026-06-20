"""
telegram/bots/dni_virtual_bot.py
─────────────────────────────────
Generadores de DNI Virtual — extraído de:
  BotClient.generate_dni_electronico() → DNI Electrónico (2 imágenes)
  BotClient.generate_dni_azul()        → DNI Azul (2 imágenes)
  BotClient.generate_dni_amarillo()    → DNI Amarillo (2 imágenes)
"""
from __future__ import annotations
import asyncio
import re
from pathlib import Path
from parser import parse_bot_response
from telegram.exceptions import SinResultadosError
from telegram.guards import is_sin_resultados


TARGET_BOT = "@Infordata1_bot"

_COMMANDS = {
    "electronico": "/dnive",
    "azul":        "/dniv",
    "amarillo":    "/dniv",
}

_FILE_PREFIX = {
    "electronico": "DNI_ELECTRONICO",
    "azul":        "DNI_AZUL",
    "amarillo":    "DNI_AMARILLO",
}


def _clean_bot_text(text: str) -> str:
    if not text:
        return ""
    text = re.sub(r"(?im)^usuario\s*:.*$", "", text)
    text = re.sub(r"(?im)^cr[eé]ditos\s*:.*$", "", text)
    return text.strip()


async def _generate_dni_virtual(
    client,
    dni: str,
    tipo: str,
    static_base_dir: Path,
) -> dict:
    """
    Lógica compartida para generar DNI virtual (electrónico, azul, amarillo).

    Returns:
        {"frontal": "images/...", "reverso": "images/...", "image_paths": [...], **parsed_data}
    """
    if tipo not in _COMMANDS:
        raise ValueError(f"Tipo de DNI virtual no válido: {tipo}. Use: {list(_COMMANDS)}")

    command = _COMMANDS[tipo]
    file_prefix = _FILE_PREFIX[tipo]

    try:
        bot_entity = await client.get_entity(TARGET_BOT)
        target_bot_id = bot_entity.id
    except Exception:
        target_bot_id = 0

    icons = {"electronico": "💳", "azul": "💎", "amarillo": "💛"}
    print(f"{icons[tipo]} Generating DNI {tipo.capitalize()} for {dni}...")

    try:
        sent_msg = await client.send_message(TARGET_BOT, f"{command} {dni}")
        await asyncio.sleep(15)

        found_images = []
        found_texts = []
        target_grouped_id = None

        for attempt in range(12):
            print(f"🔄 Polling DNI {tipo} intento {attempt+1}/12...")
            async for message in client.iter_messages(TARGET_BOT, limit=100, min_id=sent_msg.id, reverse=True):
                if target_bot_id and message.sender_id != target_bot_id:
                    continue
                text = message.text or ""
                if any(k in text.lower() for k in ["procesando", "espera", "buscando"]):
                    continue
                if is_sin_resultados(text) and (str(dni) in text or message.reply_to_msg_id == sent_msg.id):
                    raise SinResultadosError("No se encontraron resultados para los datos ingresados.")
                is_ours = (message.reply_to_msg_id == sent_msg.id) or (str(dni) in text)
                is_album = target_grouped_id and message.grouped_id == target_grouped_id
                if not is_ours and not is_album:
                    continue
                if is_ours and message.grouped_id:
                    target_grouped_id = message.grouped_id
                if text and not message.photo and not message.document:
                    if not found_texts or len(text) > len(found_texts[0].text or ""):
                        found_texts.insert(0, message)
                is_image = message.photo or (
                    message.document and message.document.mime_type and "image" in message.document.mime_type
                )
                if is_image and message.id not in [m.id for m in found_images]:
                    found_images.append(message)
            if len(found_images) >= 2:
                break
            await asyncio.sleep(2)

        if len(found_images) < 2:
            raise Exception(f"No se recibieron todas las imágenes del DNI {tipo}. Intenta nuevamente.")

        # Extraer texto y datos
        raw_text = ""
        if found_texts:
            raw_text = found_texts[0].text or ""
        else:
            for m in found_images:
                if m.text:
                    raw_text = m.text
                    break
        raw_text = _clean_bot_text(raw_text)
        parsed_data = parse_bot_response(raw_text)

        # Clasificar frontal y reverso
        found_images.sort(key=lambda m: m.id)
        frontal_msg = next(
            (m for m in found_images if
             (m.file and m.file.name and "FRONT" in m.file.name.upper()) or
             (m.text and "ANVERSO" in m.text.upper())),
            found_images[0],
        )
        reverso_msg = next(
            (m for m in found_images if
             (m.file and m.file.name and "BACK" in m.file.name.upper()) or
             (m.text and "REVERSO" in m.text.upper())),
            found_images[1] if len(found_images) > 1 else found_images[0],
        )
        if frontal_msg.id == reverso_msg.id and len(found_images) >= 2:
            reverso_msg = found_images[1]

        # Guardar imágenes
        images_dir = static_base_dir / "images"
        images_dir.mkdir(parents=True, exist_ok=True)
        image_paths = []
        for i, (msg, label) in enumerate([(frontal_msg, "frontal"), (reverso_msg, "reverso")]):
            filename = f"{file_prefix}_{label}_{dni}.png"
            path = images_dir / filename
            await msg.download_media(file=path)
            image_paths.append(f"images/{filename}")

        return {
            "frontal": image_paths[0],
            "reverso": image_paths[1],
            "image_paths": image_paths,
            **parsed_data,
        }

    except SinResultadosError:
        raise
    except Exception as e:
        if isinstance(e, SinResultadosError):
            raise
        print(f"❌ Error DNI {tipo}: {e}")
        raise Exception(f"Ocurrió un error al generar el DNI {tipo.capitalize()}. Intenta nuevamente en unos segundos.")


async def generate_dni_electronico(client, dni: str, static_base_dir: Path) -> dict:
    """Genera DNI Electrónico Virtual (frontal + reverso PNG)."""
    return await _generate_dni_virtual(client, dni, "electronico", static_base_dir)


async def generate_dni_azul(client, dni: str, static_base_dir: Path) -> dict:
    """Genera DNI Azul Virtual (frontal + reverso PNG)."""
    return await _generate_dni_virtual(client, dni, "azul", static_base_dir)


async def generate_dni_amarillo(client, dni: str, static_base_dir: Path) -> dict:
    """Genera DNI Amarillo Virtual (frontal + reverso PNG)."""
    return await _generate_dni_virtual(client, dni, "amarillo", static_base_dir)
