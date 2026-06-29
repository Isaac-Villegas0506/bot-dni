from __future__ import annotations
import asyncio
import random
from pathlib import Path
from telegram.exceptions import SinResultadosError
from telegram.guards import is_sin_resultados, check_antispam

FREE_BOTS = [
    "@OlimpoDataBot",
    "@SeleneSearch_Bot",
    "@DEALERDATABOT",
    "@HexDataBOT",
    "@Infordata1_bot",
    "@ImperialData_bot",
]

_WAIT_KWS = ["procesando", "wait", "recopilando", "buscando", "cargando", "analizando", "espere", "moment"]

async def query_dni_gratis(
    client,
    client2,
    bot_pool,
    dni: str,
    static_base_dir: Path,
) -> tuple[str, str | None]:
    """
    Consulta DNI gratuita con fallback entre bots libres.

    Returns:
        (texto_respuesta, ruta_imagen_relativa_o_None)
    Raises:
        SinResultadosError
        Exception
    """
    bots = list(dict.fromkeys([b for b in FREE_BOTS if b]))
    last_err = None

    for bot in bots:
        acquired_bot = None
        if bot_pool:
            acquired_bot = await bot_pool.acquire_bot([bot], timeout=5)
            if not acquired_bot:
                print(f"⏰ {bot} ocupado, intentando siguiente...")
                continue

        try:
            active_client = random.choice([client, client2]) if client2 else client
            print(f"🤖 Consultando DNI {dni} en {bot}...")

            try:
                prior = await active_client.get_messages(bot, limit=1)
                baseline_id = prior[0].id if prior else 0
            except Exception:
                baseline_id = 0

            await active_client.send_message(bot, f"/dnix {dni}")
            await asyncio.sleep(2)

            found_spam = None
            text = ""

            for i in range(10):
                msgs = await active_client.get_messages(bot, limit=1)
                if not msgs:
                    await asyncio.sleep(2)
                    continue

                msg = msgs[0]
                text = msg.text or ""
                is_new = msg.id > baseline_id

                spam = check_antispam(text)
                if spam:
                    found_spam = spam
                    break

                if any(k in text.lower() for k in _WAIT_KWS):
                    await asyncio.sleep(2)
                    continue

                if is_sin_resultados(text):
                    raise SinResultadosError(text)

                text_upper = text.upper()
                has_data = any(k in text_upper for k in ["NOMBRES", "APELLIDOS", "DOCUMENTO", "FECHA", "DIRECCION", "DISTRITO"])

                if has_data and is_new:
                    is_na = (
                        ("NOMBRES" in text_upper and "N/A" in text_upper) or
                        ("NOMBRES" in text_upper and "NO ESPECIFICADO" in text_upper) or
                        ("DOCUMENTO" in text_upper and "NONE" in text_upper)
                    )
                    if is_na:
                        raise SinResultadosError(text)

                    img_path = None
                    if msg.media:
                        images_dir = static_base_dir / "images"
                        images_dir.mkdir(parents=True, exist_ok=True)
                        filename = f"{dni}.jpg"
                        abs_path = images_dir / filename
                        await msg.download_media(file=abs_path)
                        img_path = f"images/{filename}"

                    print(f"✅ Éxito con {bot}")
                    return text, img_path

                if is_new:
                    print(f"⏳ {bot} ({i+1}/10): respuesta intermedia...")
                await asyncio.sleep(2)

            if found_spam:
                last_err = found_spam
                continue

        except SinResultadosError:
            raise
        except Exception as e:
            print(f"⚠️ Err {bot}: {e}")
            last_err = str(e)
            continue
        finally:
            if bot_pool and acquired_bot:
                await bot_pool.release_bot(acquired_bot)

    if last_err and "POR FAVOR ESPERA" in str(last_err):
        raise Exception(last_err)
    raise Exception(f"No results: {last_err}")
