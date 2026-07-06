from __future__ import annotations
import asyncio
import re
import random
from pathlib import Path
from telegram.guards import check_antispam

FREE_BOTS = [
    "@OlimpoDataBot",
    "@SeleneSearch_Bot",
    "@DEALERDATABOT",
    "@HexDataBOT",
    "@Infordata1_bot",
    "@ImperialData_bot",
]

_WAIT_KWS = ["procesando", "wait", "recopilando", "buscando", "cargando", "analizando", "espere", "moment"]

def _parse_sirius_re(text: str) -> list[dict]:
    """Parser de resultados de búsqueda por nombre."""
    results = []
    text = text.replace("➾", ":").replace("=>", ":").replace("*", "")
    parts = re.split(r"(?:DNI|DOC)[\s\W]*[:\-\s]+", text, flags=re.IGNORECASE)
    for part in parts[1:]:
        part = part.strip().replace("`", "").strip()
        if not part:
            continue
        m_dni = re.match(r"^(\d{8})", part)
        if not m_dni:
            continue
        dni = m_dni.group(1)
        nombres = apellidos = edad = ""
        mn = re.search(r"NOMBRES[\s\W]*[:\-\s]+([^\n]+)", part, re.IGNORECASE)
        if mn:
            nombres = mn.group(1).strip()
        ma = re.search(r"APELLIDOS[\s\W]*[:\-\s]+([^\n]+)", part, re.IGNORECASE)
        if ma:
            apellidos = ma.group(1).strip()
        me = re.search(r"EDAD[\s\W]*[:\-\s]+(\d+)", part, re.IGNORECASE)
        if me:
            edad = me.group(1).strip()
        full = f"{nombres} {apellidos}".strip() or nombres
        results.append({
            "documento": dni,
            "nombres": nombres,
            "apellidos": apellidos,
            "nombre_completo": full,
            "edad": edad,
        })
    return results

async def busqueda_por_nombre(
    client,
    client2,
    bot_pool,
    nombres: str,
    paterno: str,
    materno: str,
    static_base_dir: Path,
) -> dict:
    """
    Búsqueda por nombre usando /nmdb en bots gratuitos.

    Returns:
        {"resultados": [...], "archivo_url": str|None, "total_count": int}
    """
    n = nombres.strip().replace(" ", ",")
    p = paterno.strip().replace(" ", "+")
    m = materno.strip().replace(" ", "+")
    query = f"/nmdb {n}|{p}|{m}"

    last_error = None

    for bot in FREE_BOTS:
        acquired_bot = None
        if bot_pool:
            try:
                acquired_bot = await bot_pool.acquire_bot([bot], timeout=5)
                if not acquired_bot:
                    continue
            except Exception as e:
                print(f"⚠️ Error adquiriendo {bot}: {e}")
                continue

        try:
            active_client = random.choice([client, client2]) if client2 else client
            print(f"🚀 Enviando {query} a {bot}...")
            await active_client.send_message(bot, query)
            await asyncio.sleep(2)

            found_result = False
            found_spam = None
            file_path_rel = None
            all_results = []
            total_count = 0

            for i in range(10):
                msgs = await active_client.get_messages(bot, limit=1)
                if not msgs:
                    await asyncio.sleep(2)
                    continue

                msg = msgs[0]
                text = msg.text or ""

                spam = check_antispam(text)
                if spam:
                    found_spam = spam
                    break

                if any(k in text.lower() for k in _WAIT_KWS):
                    await asyncio.sleep(2)
                    continue

                text_lower = text.lower()
                if "formato inválido" in text_lower or "formato incorrecto" in text_lower or "ejemplo correcto" in text_lower:
                    raise Exception("INVALID_FORMAT: El formato del nombre es incorrecto.")
                if "no se encontró" in text_lower or "no se encontro" in text_lower or "sin resultados" in text_lower:
                    raise Exception("NO_FOUND_404: No se encontraron resultados para ese nombre.")

                is_success = msg.document or "resultados" in text_lower or "coincidencias" in text_lower or "dni" in text_lower
                if is_success:
                    found_result = True
                    if msg.document:
                        files_dir = static_base_dir / "files"
                        files_dir.mkdir(parents=True, exist_ok=True)
                        clean_name = f"NM-{n}-{p}.txt".replace("+", "_")
                        abs_path = files_dir / clean_name
                        await msg.download_media(file=abs_path)
                        file_path_rel = f"files/{clean_name}"

                    if text:
                        mc = re.search(r"RESULTADOS[^\d]+(\d+)", text, re.IGNORECASE)
                        if mc:
                            total_count = int(mc.group(1))
                        results = _parse_sirius_re(text)
                        if results:
                            all_results.extend(results)
                    break

                if any(phrase in text_lower for phrase in ["no se encontraron", "sin resultados", "no results"]):
                    return {"resultados": [], "archivo_url": None, "total_count": 0}

                await asyncio.sleep(2)

            if found_spam:
                last_error = found_spam
                continue
            if not found_result:
                last_error = f"{bot} timeout"
                continue

            final_total = total_count if total_count else len(all_results)
            return {
                "resultados": all_results,
                "archivo_url": file_path_rel,
                "total_count": final_total,
            }

        except Exception as e:
            err_str = str(e)
            last_error = err_str
            if "NO_FOUND_404" in err_str or "INVALID_FORMAT" in err_str:
                raise
            continue
        finally:
            if bot_pool and acquired_bot:
                await bot_pool.release_bot(acquired_bot)

    raise Exception(str(last_error) if last_error else "Todos los bots fallaron")
