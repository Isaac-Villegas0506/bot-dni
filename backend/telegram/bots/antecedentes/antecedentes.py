"""
telegram/bots/antecedentes_bot.py
──────────────────────────────────
Certificados de antecedentes — extraído de:
  BotClient.generate_antpen()  → Antecedentes Penales
  BotClient.generate_antjud()  → Antecedentes Judiciales
  BotClient.generate_antpol()  → Antecedentes Policiales
"""
from __future__ import annotations
import asyncio
from pathlib import Path
from telegram.exceptions import SinResultadosError
from telegram.guards import is_sin_resultados

TARGET_BOT = "@Infordata1_bot"

_CONFIG = {
    "penales":    ("/antpen", "antecedentes_penales_",  "antecedentes_penales_{}.pdf",  "ANTECEDENTES PENALES",   "PENALES"),
    "judiciales": ("/antjud", "antecedentes_judiciales_", "antecedentes_judiciales_{}.pdf", "ANTECEDENTES JUDICIALES", "JUDICIALES"),
    "policiales": ("/antpol", "antpoliciales_",          "AntPoliciales_{}.pdf",          "ANTECEDENTES POLICIALES", "POLICIALES"),
}


async def generate_antecedentes(
    client,
    dni: str,
    tipo: str,
    static_base_dir: Path,
) -> dict:
    """
    Genera certificado de antecedentes.

    Args:
        client:          TelegramClient conectado.
        dni:             Número de DNI.
        tipo:            "penales", "judiciales" o "policiales".
        static_base_dir: Path al directorio backend/static/.

    Returns:
        {"file_path": "files/<filename>", "raw_text": str}
    Raises:
        SinResultadosError, Exception
    """
    if tipo not in _CONFIG:
        raise ValueError(f"Tipo de antecedentes no válido: {tipo}. Use: {list(_CONFIG)}")

    cmd_prefix, file_prefix, filename_tpl, text_kw, text_kw2 = _CONFIG[tipo]

    try:
        bot_entity = await client.get_entity(TARGET_BOT)
        target_bot_id = bot_entity.id
    except Exception:
        target_bot_id = 0

    icon = "⚖️" if tipo in ("penales", "judiciales") else "👮"
    print(f"{icon} Generating Antecedentes {tipo.capitalize()} for {dni}...")

    try:
        sent_msg = await client.send_message(TARGET_BOT, f"{cmd_prefix} {dni}")
        await asyncio.sleep(8)

        found_msg = None
        for attempt in range(15):
            print(f"🔄 Polling antecedentes {tipo} intento {attempt+1}/15...")
            async for message in client.iter_messages(TARGET_BOT, limit=100, min_id=sent_msg.id, reverse=True):
                if target_bot_id and message.sender_id != target_bot_id:
                    continue
                text = message.text or ""
                if any(k in text.lower() for k in ["procesando", "espere", "buscando"]):
                    continue
                if is_sin_resultados(text):
                    raise SinResultadosError("No se encontraron resultados para los datos ingresados.")
                is_valid_pdf = False
                if message.document:
                    fname = message.file.name if message.file and message.file.name else ""
                    if fname.lower().startswith(file_prefix) and fname.lower().endswith(".pdf"):
                        is_valid_pdf = True
                if is_valid_pdf or text_kw in text.upper() or text_kw2 in text.upper():
                    if dni in text or (message.file and message.file.name and dni in message.file.name):
                        found_msg = message
                        break
                if "error" in text.lower() or "no encontrado" in text.lower():
                    raise Exception("⚠️ No se encontraron resultados para el DNI ingresado.")
            if found_msg:
                break
            await asyncio.sleep(2)

        if not found_msg:
            raise Exception("⚠️ No se encontraron resultados para el DNI ingresado.")

        print(f"✅ Antecedentes {tipo} encontrado. Descargando...")
        files_dir = static_base_dir / "files"
        files_dir.mkdir(parents=True, exist_ok=True)
        filename = filename_tpl.format(dni)
        path = files_dir / filename
        await found_msg.download_media(file=path)

        return {
            "file_path": f"files/{filename}",
            "raw_text": (found_msg.text or "").strip(),
        }

    except SinResultadosError:
        raise
    except Exception as e:
        if isinstance(e, SinResultadosError):
            raise
        print(f"❌ Error antecedentes {tipo}: {e}")
        raise Exception("Ocurrió un error al generar el certificado.")
