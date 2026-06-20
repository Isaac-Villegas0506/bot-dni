"""
telegram/bots/telefono_bot.py
─────────────────────────────
Consultas de teléfonos — extraído de:
  BotClient.query_telx()  → teléfonos por DNI (gratis, @Infordata1_bot)
  BotClient.query_telp()  → línea por número (premium, grupo)
  BotClient.query_cel()   → titular por número (gratis, @Infordata1_bot)
"""
from __future__ import annotations
import asyncio
import re
from telegram.exceptions import SinResultadosError
from telegram.guards import is_sin_resultados

TARGET_BOT = "@Infordata1_bot"


async def query_telx(client, dni: str) -> dict:
    """
    Consulta números de celular vinculados a un DNI usando /telp en @Infordata1_bot.

    Returns:
        {"raw_text": str, "parts": int}
    """
    try:
        bot_entity = await client.get_entity(TARGET_BOT)
        target_bot_id = bot_entity.id
    except Exception:
        target_bot_id = 0

    for global_attempt in range(2):
        try:
            print(f"📱 Enviando /tel {dni} a {TARGET_BOT} (intento {global_attempt + 1})...")
            sent_msg = await client.send_message(TARGET_BOT, f"/tel {dni}")
            await asyncio.sleep(5)

            total_parts = None
            received_parts = {}
            seen_ids: set[int] = set()

            for attempt in range(12):
                print(f"🔄 tel intento {attempt + 1}/12...")
                async for message in client.iter_messages(TARGET_BOT, limit=100, min_id=sent_msg.id, reverse=True):
                    if message.id in seen_ids:
                        continue
                    if target_bot_id and message.sender_id != target_bot_id:
                        continue
                    text = message.text or ""
                    if not text:
                        continue
                    if any(k in text.lower() for k in ["procesando", "espere", "buscando"]):
                        continue
                    if is_sin_resultados(text):
                        seen_ids.add(message.id)
                        raise SinResultadosError("「❌️」Sin Resultados. Verifique los datos e intente nuevamente.")
                    if dni in text and ("error" in text.lower() or "no encontrado" in text.lower()):
                        seen_ids.add(message.id)
                        raise Exception("Ocurrió un error al procesar la consulta.")
                    text_upper = text.upper()
                    is_result = (
                        "TELEFONOS PREMIUM" in text_upper or "OSIPTEL" in text_upper or
                        "DETALLE DE LINEAS" in text_upper or "TELEFONÍA" in text_upper
                    )
                    if not is_result:
                        continue
                    seen_ids.add(message.id)
                    pm = re.search(r"P[aá]gina\s+(\d+)\s+de\s+(\d+)", text, re.IGNORECASE)
                    if pm:
                        part_num    = int(pm.group(1))
                        total_parts = int(pm.group(2))
                    else:
                        part_num    = 1
                        total_parts = 1
                    received_parts[part_num] = text
                    print(f"✅ telx: parte {part_num}/{total_parts}")

                if total_parts is not None and len(received_parts) >= total_parts:
                    break
                await asyncio.sleep(3)

            if not received_parts:
                if global_attempt < 1:
                    print("⚠️ telx: timeout, reintentando...")
                    continue
                raise Exception("Timeout esperando respuesta del bot.")

            combined = "\n\n".join(received_parts[k] for k in sorted(received_parts))
            return {"raw_text": combined, "parts": total_parts or 1}

        except SinResultadosError:
            raise
        except Exception as e:
            if global_attempt < 1:
                print(f"⚠️ telx error (intento {global_attempt + 1}): {e}")
                continue
            raise

    raise Exception("No se pudo completar la consulta de teléfonos. Intente nuevamente.")


async def query_telp(client, phone: str, target_group: int, target_bot_id: int) -> dict:
    """
    Consulta línea por número en grupo premium.

    Returns:
        {"raw_text": str}
    """
    print(f"📱 Enviando /telp {phone} al grupo premium...")
    sent_msg = await client.send_message(target_group, f"/telp {phone}")
    await asyncio.sleep(5)

    received_parts: dict[int, str] = {}
    seen_ids: set[int] = set()
    total_parts = None

    for attempt in range(12):
        print(f"🔄 telp premium intento {attempt + 1}/12...")
        async for message in client.iter_messages(target_group, limit=15, reply_to=sent_msg.id):
            if message.id in seen_ids:
                continue
            if target_bot_id and message.sender_id != target_bot_id:
                continue
            text = message.text or ""
            if not text:
                continue
            seen_ids.add(message.id)
            text_upper = text.upper()

            if "ANTI-SPAM" in text_upper or "espere" in text.lower():
                wait_time = 15
                try:
                    m = re.search(r"(\d+(?:\.\d+)?)s", text)
                    if m:
                        wait_time = float(m.group(1)) + 2
                except Exception:
                    pass
                print(f"⚠️ Anti-spam telp: esperando {wait_time:.0f}s...")
                await asyncio.sleep(wait_time)
                sent_msg = await client.send_message(target_group, f"/telp {phone}")
                await asyncio.sleep(5)
                seen_ids.clear()
                break

            if is_sin_resultados(text):
                raise SinResultadosError("「❌️」Sin Resultados. Verifique los datos e intente nuevamente.")

            if any(k in text.lower() for k in ["procesando", "buscando", "cargando", "analizando"]):
                continue

            is_valid = ("NÚMERO" in text_upper or "NUMERO" in text_upper or "CONSULTA:" in text_upper or "TITULAR" in text_upper)
            if not is_valid:
                raise Exception("UNKNOWN_RESPONSE: No se encontraron datos. Intente nuevamente en 10 segundos.")

            pm = re.search(r"(\d+)\s*/\s*(\d+)", text)
            if pm:
                part_num    = int(pm.group(1))
                total_parts = int(pm.group(2))
            else:
                part_num    = 1
                total_parts = 1
            received_parts[part_num] = text
            print(f"✅ telp: parte {part_num}/{total_parts}")

        if total_parts is not None and len(received_parts) >= total_parts:
            break
        await asyncio.sleep(3)

    if not received_parts:
        raise Exception("UNKNOWN_RESPONSE: No se encontraron datos. Intente nuevamente en 10 segundos.")

    combined = "\n\n".join(received_parts[k] for k in sorted(received_parts))
    return {"raw_text": combined}


async def query_cel(client, phone: str) -> dict:
    """
    Consulta titular de un número usando /telp en @Infordata1_bot (versión gratis).

    Returns:
        {"raw_text": str}
    """
    try:
        bot_entity = await client.get_entity(TARGET_BOT)
        target_bot_id = bot_entity.id
    except Exception:
        target_bot_id = 0

    print(f"📡 Enviando /cel {phone} a {TARGET_BOT}...")
    sent_msg = await client.send_message(TARGET_BOT, f"/cel {phone}")
    await asyncio.sleep(5)

    received_parts: dict[int, str] = {}
    seen_ids: set[int] = set()
    total_parts = None

    for attempt in range(12):
        print(f"🔄 cel intento {attempt + 1}/12...")
        async for message in client.iter_messages(TARGET_BOT, limit=100, min_id=sent_msg.id, reverse=True):
            if message.id in seen_ids:
                continue
            if target_bot_id and message.sender_id != target_bot_id:
                continue
            text = message.text or ""
            if not text:
                continue
            if any(k in text.lower() for k in ["procesando", "espere", "buscando"]):
                continue
            if is_sin_resultados(text):
                seen_ids.add(message.id)
                raise SinResultadosError("「❌️」Sin Resultados. Verifique los datos e intente nuevamente.")
            text_upper = text.upper()
            is_valid = (
                "KING DATA" in text_upper or "SHIELDGRAM DB" in text_upper or
                "DETALLE DE LINEAS" in text_upper or "TITULAR" in text_upper or
                "TELEFONÍA" in text_upper or "OSIPTEL" in text_upper
            )
            if not is_valid:
                continue
            seen_ids.add(message.id)
            pm = re.search(r"P[aá]gina\s+(\d+)\s+de\s+(\d+)", text, re.IGNORECASE)
            if pm:
                part_num    = int(pm.group(1))
                total_parts = int(pm.group(2))
            else:
                part_num    = 1
                total_parts = 1
            received_parts[part_num] = text
            print(f"✅ cel: parte {part_num}/{total_parts}")

        if total_parts is not None and len(received_parts) >= total_parts:
            break
        await asyncio.sleep(3)

    if not received_parts:
        raise Exception("UNKNOWN_RESPONSE: No se encontraron datos. Verifique el número e intente nuevamente en 10 o 15 segundos.")

    combined = "\n\n".join(received_parts[k] for k in sorted(received_parts))
    return {"raw_text": combined}
