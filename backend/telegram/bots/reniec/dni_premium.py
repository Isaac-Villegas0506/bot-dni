from __future__ import annotations
import asyncio
import re
from pathlib import Path
from parser import parse_bot_response
from telegram.exceptions import SinResultadosError
from telegram.guards import is_sin_resultados

def _clean_bot_text(text: str) -> str:
    if not text:
        return ""
    text = re.sub(r"(?im)^usuario\s*:.*$", "", text)
    text = re.sub(r"(?im)^cr[eé]ditos\s*:.*$", "", text)
    return text.strip()

async def query_dni_premium(
    client,
    bot_pool,
    dni: str,
    static_base_dir: Path,
    target_group: str = "@Infordata1_bot",
    target_bot_id: int = 0,
) -> dict:
    """
    Consulta DNI premium en grupo @Infordata1_bot.

    Returns:
        dict con raw_text, nombres, apellidos, nombre_completo, documento,
        fecha_nacimiento, edad, genero, imagen_url, foto_rostro, firma_imagen,
        huella_izquierda, huella_derecha, is_premium=True
    Raises:
        SinResultadosError, Exception
    """
    max_global_retries = 3

    for global_attempt in range(max_global_retries):
        try:
            # Resolver el ID del bot dinámicamente si no se proporcionó
            resolved_bot_id = target_bot_id
            if resolved_bot_id == 0:
                try:
                    target_entity = await client.get_entity(target_group)
                    resolved_bot_id = target_entity.id
                except Exception as e:
                    print(f"⚠️ No se pudo obtener la entidad {target_group}: {e}")
            
            print(f"💎 Enviando DNI {dni} al grupo {target_group} (intento {global_attempt + 1}/3)...")
            sent_msg = await client.send_message(target_group, f"/dni {dni}")
            await asyncio.sleep(5)

            found_msgs = []

            for attempt in range(8):
                print(f"🔄 Intento {attempt+1}/8 buscando respuesta premium...")
                collected = []
                async for message in client.iter_messages(target_group, limit=25):
                    if message.sender_id == resolved_bot_id and message.id > sent_msg.id:
                        text_content = (message.text or "").upper()
                        if "EXTRAYENDO DATA" in text_content or "PROTOCOL" in text_content:
                            continue
                        is_ours = (dni in text_content) or (message.reply_to_msg_id == sent_msg.id)
                        if is_ours or (message.grouped_id and any(m.grouped_id == message.grouped_id for m in collected)):
                            collected.append(message)
                        if "ANTI-SPAM" in text_content or "ESPERE" in text_content:
                            collected.append(message)

                if collected:
                    is_final = any((dni in (m.text or "")) or (m.reply_to_msg_id == sent_msg.id) for m in collected)
                    has_media = any(m.media for m in collected)
                    has_text_data = any((m.text and len(m.text) > 20) for m in collected)
                    
                    if is_final and ((has_media and has_text_data) or attempt > 5):
                        found_msgs = collected
                        break
                if collected and any("ANTI-SPAM" in (m.text or "") for m in collected):
                    found_msgs = collected
                    break
                await asyncio.sleep(2)

            if not found_msgs:
                if global_attempt < max_global_retries - 1:
                    continue
                raise Exception("Timeout esperando respuesta del bot premium")

            found_msgs.sort(key=lambda x: x.id)
            text_parts = [m.text for m in found_msgs if m.text and len(m.text) > 10 and "EXTRAYENDO DATA" not in m.text]
            text = "\n\n".join(text_parts) if text_parts else (found_msgs[0].text or "")
            text = _clean_bot_text(text)

            if is_sin_resultados(text):
                raise SinResultadosError("No se encontraron resultados para los datos ingresados.")

            if "ANTI-SPAM" in text or "Espere" in text:
                wait_time = 15
                try:
                    m = re.search(r"(\d+(?:\.\d+)?)s", text)
                    if m:
                        wait_time = float(m.group(1)) + 2
                except Exception:
                    pass
                print(f"⚠️ Anti-Spam detectado. Esperando {wait_time:.1f}s...")
                await asyncio.sleep(wait_time)
                continue

            if "no encontrado" in text.lower():
                raise SinResultadosError("No se encontraron resultados.")

            data = parse_bot_response(text)
            media_msgs = [m for m in found_msgs if m.media]
            img_paths = {}
            keys = ["foto_rostro", "huella_derecha", "huella_izquierda", "firma_imagen"]

            images_dir = static_base_dir / "images"
            images_dir.mkdir(parents=True, exist_ok=True)

            if len(media_msgs) > 4:
                media_msgs = media_msgs[-4:]

            for i, msg in enumerate(media_msgs):
                if i < len(keys):
                    safe_name = f"premium_{dni}_{keys[i]}.jpg"
                    path = images_dir / safe_name
                    await msg.download_media(file=path)
                    img_paths[keys[i]] = f"images/{safe_name}"

            return {
                "raw_text": text,
                **data,
                "nombres": data.get("nombres", ""),
                "apellidos": data.get("apellidos", ""),
                "nombre_completo": f"{data.get('nombres', '')} {data.get('apellidos', '')}".strip(),
                "documento": data.get("documento", dni),
                "fecha_nacimiento": data.get("fecha_nacimiento", ""),
                "edad": data.get("edad", ""),
                "genero": data.get("genero", ""),
                "imagen_url": img_paths.get("foto_rostro"),
                **img_paths,
                "is_premium": True,
            }

        except SinResultadosError:
            raise
        except Exception as e:
            print(f"❌ Error premium (intento {global_attempt+1}): {e}")
            if global_attempt == max_global_retries - 1:
                raise
            await asyncio.sleep(2)
