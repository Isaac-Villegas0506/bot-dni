"""
telegram/bots/familiares_bot.py
────────────────────────────────
Consultas de árbol familiar — extraído de:
  BotClient.generate_familiares_pdf()    → Árbol Visual PDF (/agv)
  BotClient.generate_familiares_texto()  → Árbol Genealógico texto (/ag)
  BotClient.query_arbol_visual_pdf()     → Árbol Visual v2 PDF (/agvp)
"""
from __future__ import annotations
import asyncio
import uuid
from pathlib import Path
from telegram.exceptions import SinResultadosError
from telegram.guards import is_sin_resultados

TARGET_BOT = "@Infordata1_bot"


def _clean_text(text: str) -> str:
    """Elimina líneas de CUENTA/USUARIO del texto del bot."""
    lines = (text or "").split("\n")
    cleaned = [l for l in lines if not l.startswith("CUENTA:") and not l.startswith("USUARIO:")]
    return "\n".join(cleaned).strip()


async def generate_familiares_pdf(client, dni: str, static_base_dir: Path) -> dict:
    """
    Genera Árbol Visual PDF usando /agv.

    Returns:
        {"file_path": "files/<filename>", "raw_text": str}
    """
    try:
        bot_entity = await client.get_entity(TARGET_BOT)
        target_bot_id = bot_entity.id
    except Exception:
        target_bot_id = 0

    print(f"👨‍👩‍👧 Generating Familiares PDF for {dni}...")

    try:
        sent_msg = await client.send_message(TARGET_BOT, f"/agv {dni}")
        await asyncio.sleep(10)

        found_msg = None
        for attempt in range(60):
            print(f"🔄 Polling Familiares PDF intento {attempt+1}/60...")
            async for message in client.iter_messages(TARGET_BOT, limit=100, min_id=sent_msg.id, reverse=True):
                if target_bot_id and message.sender_id != target_bot_id:
                    continue
                text = message.text or ""
                if any(k in text.lower() for k in ["procesando", "espere", "buscando", "generando"]):
                    continue
                if message.document and message.document.mime_type == "application/pdf":
                    upper = text.upper()
                    if "ARBOL" in upper or "ÁRBOL" in upper or "GENEALÓGICO" in upper or "FAMILIAR" in upper:
                        if dni in text or (message.file and message.file.name and dni in message.file.name):
                            found_msg = message
                            break
                if not found_msg and message.document and message.document.mime_type == "application/pdf":
                    if message.file and message.file.name and (dni in message.file.name or "Arbol" in message.file.name):
                        found_msg = message
                        break
                if dni in text:
                    if is_sin_resultados(text):
                        raise SinResultadosError("No se encontraron resultados para los datos ingresados.")
                    if "error" in text.lower() or "no encontrado" in text.lower():
                        raise Exception("Ocurrió un error al generar el árbol familiar.")
            if found_msg:
                break
            await asyncio.sleep(2)

        if not found_msg:
            raise Exception("El bot no respondió a tiempo. El proceso puede tardar más de lo habitual.")

        files_dir = static_base_dir / "files"
        files_dir.mkdir(parents=True, exist_ok=True)
        filename = f"ARBOL_VISUAL_{dni}.pdf"
        path = files_dir / filename
        await found_msg.download_media(file=path)

        return {
            "file_path": f"files/{filename}",
            "raw_text": _clean_text(found_msg.message or found_msg.text or ""),
        }

    except SinResultadosError:
        raise
    except Exception as e:
        if isinstance(e, SinResultadosError):
            raise
        print(f"❌ Error Familiares PDF: {e}")
        raise Exception(str(e))


async def generate_familiares_texto(client, dni: str, static_base_dir: Path) -> dict:
    """
    Genera Árbol Genealógico en texto usando /ag.

    Returns:
        {"raw_text": str, "block_count": int, "file_path": str|None}
    """
    try:
        bot_entity = await client.get_entity(TARGET_BOT)
        target_bot_id = bot_entity.id
    except Exception:
        target_bot_id = 0

    MAX_WAIT = 60
    if not hasattr(generate_familiares_texto, "_lock"):
        generate_familiares_texto._lock = asyncio.Lock()

    print(f"👨‍👩‍👧 Generating Familiares Texto for {dni} (waiting for lock)...")
    async with generate_familiares_texto._lock:
        print(f"👨‍👩‍👧 Lock acquired for {dni}...")

        try:
            sent_msg = await client.send_message(TARGET_BOT, f"/ag {dni}")
            await asyncio.sleep(8)

            messages_collected = []
            collected_ids: set[int] = set()
            txt_file_path = None
            found_final = False

            loop = asyncio.get_event_loop()
            total_start = loop.time()

            while True:
                if loop.time() - total_start > MAX_WAIT:
                    break
                async for message in client.iter_messages(TARGET_BOT, limit=100, min_id=sent_msg.id, reverse=True):
                    if target_bot_id and message.sender_id != target_bot_id:
                        continue
                    if message.id in collected_ids:
                        continue
                    text = message.text or ""
                    if any(k in text.lower() for k in ["procesando", "espera", "buscando"]):
                        continue
                    if is_sin_resultados(text):
                        raise SinResultadosError("No se encontraron familiares para los datos ingresados.")
                    is_part = (
                        dni in text or
                        ("[ " in text and " ]" in text and "Nombre ➟" in text) or
                        "SITEX DATA" in text.upper() or
                        "ÁRBOL GENEALÓGICO" in text.upper() or
                        (message.document and message.file and message.file.name and
                         (dni in message.file.name or "Arbol" in message.file.name))
                    )
                    if not is_part:
                        continue
                    collected_ids.add(message.id)
                    messages_collected.append(message)
                    text_lower = text.lower()
                    if "hallado" in text_lower and "registros" in text_lower:
                        found_final = True
                    elif "total de familiares" in text_lower or "árbol genealógico" in text_lower:
                        found_final = True
                    if (message.document and message.file and
                            message.file.name and message.file.name.endswith(".txt")):
                        files_dir = static_base_dir / "files"
                        files_dir.mkdir(parents=True, exist_ok=True)
                        filename = f"FAMILIARES_REPORT_{dni}.txt"
                        path = files_dir / filename
                        await message.download_media(file=path)
                        txt_file_path = f"files/{filename}"

                if found_final:
                    break
                await asyncio.sleep(3)

            if not messages_collected:
                raise Exception("No se recibió respuesta del bot. Intenta nuevamente.")

            messages_collected.sort(key=lambda m: m.id)
            full_text = "\n\n".join(m.text for m in messages_collected if m.text).strip()

            return {
                "raw_text": full_text,
                "block_count": len(messages_collected),
                "file_path": txt_file_path,
            }

        except SinResultadosError:
            raise
        except Exception as e:
            if isinstance(e, SinResultadosError):
                raise
            print(f"❌ Error Familiares Texto: {e}")
            raise Exception(f"Ocurrió un error al obtener el árbol familiar: {e}")


async def query_arbol_visual_pdf(client, bot_pool, dni: str, static_base_dir: Path) -> dict:
    """
    Árbol Visual v2 PDF usando /agvp.

    Returns:
        {"raw_text": str, "file_path": str|None}
    """
    command = f"/agv {dni}"

    acquired_bot = None
    if bot_pool:
        acquired_bot = await bot_pool.acquire_bot([TARGET_BOT], timeout=10)
        if not acquired_bot:
            raise Exception("El sistema está ocupado actualmente. Intenta en unos segundos.")

    try:
        bot_entity = await client.get_entity(TARGET_BOT)
        target_bot_id = bot_entity.id
    except Exception:
        target_bot_id = 0

    try:
        print(f"🌳 Enviando {command} a {TARGET_BOT}...")
        sent_msg = await client.send_message(TARGET_BOT, command)
        await asyncio.sleep(4)

        file_url = None
        raw_text = None
        found_spam = None
        seen_ids: set[int] = set()

        for attempt in range(12):
            print(f"🔄 Polling Árbol Visual intento {attempt+1}/12...")
            async for message in client.iter_messages(TARGET_BOT, limit=50, min_id=sent_msg.id, reverse=True):
                if message.id in seen_ids:
                    continue
                if target_bot_id and message.sender_id != target_bot_id:
                    continue
                text = message.text or ""
                if any(k in text.lower() for k in ["procesando", "espere", "buscando"]):
                    continue
                if is_sin_resultados(text) or "sin resultados" in text.lower():
                    raise SinResultadosError("No se encontraron familiares para este DNI en el sistema.")
                seen_ids.add(message.id)
                if "INFOR DATA" in text.upper() or "ÁRBOL VISUAL" in text.upper():
                    raw_text = _clean_text(text)
                if message.document and message.document.mime_type == "application/pdf":
                    files_dir = static_base_dir / "files"
                    files_dir.mkdir(parents=True, exist_ok=True)
                    clean_name = f"FAMILIAR_{uuid.uuid4().hex}.pdf"
                    abs_path = files_dir / clean_name
                    await message.download_media(file=abs_path)
                    file_url = f"files/{clean_name}"

            if file_url and raw_text:
                break
            await asyncio.sleep(2)

        if file_url or raw_text:
            return {
                "raw_text": raw_text or "Árbol visual encontrado exitosamente.",
                "file_path": file_url,
            }
        raise Exception("Tiempo de espera agotado o el servidor no respondió.")

    finally:
        if bot_pool and acquired_bot:
            await bot_pool.release_bot(TARGET_BOT)
