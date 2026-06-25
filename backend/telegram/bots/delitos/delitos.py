"""
telegram/bots/delitos_bot.py
─────────────────────────────
Consulta de denuncias/delitos — extraído de BotClient.query_delitos()
"""
from __future__ import annotations
import time
import asyncio
import re
import uuid
from pathlib import Path
from telegram.exceptions import SinResultadosError
from telegram.guards import is_sin_resultados, check_antispam

TARGET_BOT = "@Infordata1_bot"


async def query_delitos(
    client,
    bot_pool,
    query_type: str,
    target: str,
    static_base_dir: Path,
) -> dict:
    """
    Consulta denuncias/delitos por DNI, placa o antecedentes personales.

    Args:
        client:          TelegramClient conectado.
        bot_pool:        BotPool para control de concurrencia.
        query_type:      "dni", "placa", o "antper".
        target:          DNI, placa o identificador.
        static_base_dir: Directorio backend/static/.

    Returns:
        {"raw_text": str, "archivos": ["files/<uuid>.pdf", ...]}
    Raises:
        SinResultadosError, Exception
    """
    _COMMANDS = {
        "dni":    f"/sidpolpdf {target}",
        "placa":  f"/sidpla {target}",
        "antper": f"/anteper {target}",
    }
    command = _COMMANDS.get(query_type, f"/sidpolpdf {target}")

    acquired_bot = None
    if bot_pool:
        acquired_bot = await bot_pool.acquire_bot([TARGET_BOT], timeout=10)
        if not acquired_bot:
            raise Exception("El sistema de denuncias está ocupado actualmente. Intenta en unos segundos.")

    try:
        bot_entity = await client.get_entity(TARGET_BOT)
        target_bot_id = bot_entity.id
    except Exception:
        target_bot_id = 0

    try:
        print(f"🚓 Enviando {command} a {TARGET_BOT}...")
        sent_msg = await client.send_message(TARGET_BOT, command)
        await asyncio.sleep(4)

        archivos_descargados: list[str] = []
        raw_text = None
        found_spam = None
        seen_ids: set[int] = set()
        last_message_time = None

        for attempt in range(15):
            print(f"🔄 Polling Delitos intento {attempt+1}/15...")
            async for message in client.iter_messages(TARGET_BOT, limit=50, min_id=sent_msg.id, reverse=True):
                if message.id in seen_ids:
                    continue
                if target_bot_id and message.sender_id != target_bot_id:
                    continue
                
                # New message from target bot received
                last_message_time = time.time()
                
                text = message.text or ""
                if any(k in text.lower() for k in ["procesando", "espere", "buscando"]):
                    continue

                spam = check_antispam(text)
                if spam:
                    found_spam = spam
                    continue

                no_results = (
                    is_sin_resultados(text) or
                    "no se encontró" in text.lower() or
                    "ningun registro" in text.lower() or
                    "ningún registro" in text.lower() or
                    "no existe" in text.lower() or
                    "sin denuncias" in text.lower()
                )
                if no_results:
                    raise SinResultadosError("No se encontraron denuncias para esta búsqueda en el sistema.")

                seen_ids.add(message.id)

                if message.document and message.document.mime_type == "application/pdf":
                    files_dir = static_base_dir / "files"
                    files_dir.mkdir(parents=True, exist_ok=True)
                    clean_name = f"DELITO_{uuid.uuid4().hex}.pdf"
                    abs_path = files_dir / clean_name
                    await message.download_media(file=abs_path)
                    archivos_descargados.append(f"files/{clean_name}")
                    print(f"✅ PDF de denuncia descargado: {clean_name}")

                if "DENUNCIA POLICIAL" in text.upper() or "DENUNCIA" in text.upper() or "INFOR DATA" in text.upper():
                    raw_text = (raw_text + "\n\n" + text) if raw_text else text

            # Timeout after 3.5s of receiving the LAST message (PDF or text)
            if last_message_time and (time.time() - last_message_time) > 3.5:
                if archivos_descargados or raw_text:
                    break

            if (archivos_descargados or raw_text) and attempt > 7:
                break
            await asyncio.sleep(2)

        if found_spam and not archivos_descargados and not raw_text:
            raise Exception(found_spam)

        if archivos_descargados or raw_text:
            return {
                "raw_text": raw_text or "Denuncias encontradas exitosamente en formato PDF.",
                "archivos": archivos_descargados,
            }

        raise Exception("Tiempo de espera agotado o el servidor de denuncias no respondió.")

    finally:
        if bot_pool and acquired_bot:
            await bot_pool.release_bot(TARGET_BOT)
