"""
telegram/bots/operadora_bot.py
──────────────────────────────
Consulta de operadora telefónica — extraído de BotClient.query_operadora()
"""
from __future__ import annotations
import asyncio
import re
import random
from telegram.exceptions import SinResultadosError
from telegram.guards import is_sin_resultados, check_antispam

FREE_BOTS = [
    "@OlimpoDataBot", "@SeleneSearch_Bot", "@DEALERDATABOT",
    "@HexDataBOT", "@Infordata1_bot", "@ImperialData_bot",
]
_WAIT_KWS = ["procesando", "wait", "buscando", "cargando", "espere", "moment"]
_BRAND_MAP = {
    "ENTEL":    ["ENTEL"],
    "CLARO":    ["CLARO", "AMERICA MOVIL", "AMERICATEL"],
    "MOVISTAR": ["MOVISTAR", "TELEFONICA", "TELEFÓNICA"],
    "BITEL":    ["BITEL", "VIETTEL"],
}


def _detect_brand(s: str) -> str | None:
    u = (s or "").upper()
    for brand, kws in _BRAND_MAP.items():
        if any(kw in u for kw in kws):
            return brand
    return None


async def query_operadora(client, client2, phone: str) -> dict:
    """
    Verifica la operadora de un número usando /op en bots gratuitos.

    Returns:
        {"telefono", "operador", "empresa", "ruc", "fecha", "raw_text"}
    Raises:
        SinResultadosError, Exception
    """
    bots = list(dict.fromkeys([b for b in FREE_BOTS if b]))
    last_err = None

    for bot in bots:
        try:
            active_client = random.choice([client, client2]) if client2 else client
            try:
                prior = await active_client.get_messages(bot, limit=1)
                baseline_id = prior[0].id if prior else 0
            except Exception:
                baseline_id = 0

            print(f"📡 Enviando /op {phone} a {bot}...")
            await active_client.send_message(bot, f"/op {phone}")
            await asyncio.sleep(3)

            for i in range(8):
                msgs = await active_client.get_messages(bot, limit=1)
                if not msgs:
                    await asyncio.sleep(2)
                    continue

                msg = msgs[0]
                text = msg.text or ""
                is_new = msg.id > baseline_id

                spam = check_antispam(text)
                if spam:
                    last_err = spam
                    break

                if is_sin_resultados(text):
                    raise SinResultadosError(
                        "No se encontró información para este número. Verifique el número e intente nuevamente."
                    )

                if any(k in text.lower() for k in _WAIT_KWS):
                    await asyncio.sleep(2)
                    continue

                text_upper = text.upper()
                is_op = (
                    ("OPERADOR" in text_upper or "OPERADORA" in text_upper) and
                    ("TELEFON" in text_upper or "NÚMERO" in text_upper or "NUMERO" in text_upper)
                )
                if is_op and is_new:
                    clean = re.sub(r"[\*_`~]+", "", text)

                    def rx_field(label_pattern, txt):
                        pat = rf"(?im)^[ \t]*(?:{label_pattern})[ \t]*[^a-zA-Z0-9\n\r]{{1,10}}[ \t]*(.+?)[ \t]*$"
                        m = re.search(pat, txt)
                        if m:
                            val = re.sub(r"[\*_`~]+", "", m.group(1).strip()).strip()
                            return val if val and val not in ("—", "-") else ""
                        return ""

                    raw_tel  = rx_field(r"TELEFONO|N[ÚU]MERO", clean)
                    raw_op   = rx_field(r"OPERADOR(?!A)", clean)
                    raw_emp  = rx_field(r"EMPRESA", clean)
                    raw_ruc  = rx_field(r"RUC", clean)
                    raw_fec  = rx_field(r"FECHA", clean)
                    brand = _detect_brand(raw_op) or _detect_brand(raw_emp) or raw_op

                    return {
                        "telefono": raw_tel or phone,
                        "operador": brand,
                        "empresa":  raw_emp,
                        "ruc":      raw_ruc,
                        "fecha":    raw_fec,
                        "raw_text": text,
                    }

                if is_new:
                    print(f"⏳ {bot} ({i+1}/8): respuesta intermedia...")
                await asyncio.sleep(2)

        except SinResultadosError:
            raise
        except Exception as e:
            print(f"⚠️ Error {bot}: {e}")
            last_err = str(e)
            continue

    if last_err and "POR FAVOR ESPERA" in str(last_err):
        raise Exception(last_err)
    raise SinResultadosError(
        "No se encontró información para este número. Verifique el número e intente nuevamente."
    )
