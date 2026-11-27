"""
Diagnóstico de bots de Telegram: prueba cada bot con la cuenta 1 y la cuenta 2.

Uso:
    python diagnosticar_bots.py              # prueba el set por defecto
    python diagnosticar_bots.py @Bot1 @Bot2  # prueba bots concretos

Para cada bot y cuenta envía /start (o un comando de prueba) y clasifica el
resultado en:
    OK        responde y parece un bot de consultas
    MUERTO    no existe / no responde / bloqueado
    MIGRADO   responde que se mudó, o redirige a otro bot
    TIENDA    responde con precios/ventas en lugar de consultas

No envía datos personales: solo comandos de prueba sin argumentos.
"""
from __future__ import annotations

import asyncio
import os
import sys
import re

from dotenv import load_dotenv

load_dotenv()
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from telethon import TelegramClient
from telethon.sessions import StringSession
from telethon.errors import (
    UsernameNotOccupiedError,
    UsernameInvalidError,
    FloodWaitError,
    ChannelPrivateError,
    UserIsBlockedError,
)

# Bots a revisar (se puede sobrescribir por argumentos)
BOTS_DEFECTO = [
    "@SeleneSearch_Bot",
    "@DEALERDATABOT",
    "@HexDataBOT",
    "@ImperialData_bot",
    "@olimpodataxbot",
    "@OlimpoDataBot",
    "@Infordata1_bot",
    "@Bitxdatabot",
]

# Señales de que el bot ya no hace consultas
SEÑALES_MIGRADO = ["nos hemos mudado", "migrado", "nuevo bot", "cambiamos de nombre",
                   "ahora somos", "dejado de prestar servicios", "ya no se encuentra en funcionamiento"]
# Tienda: vocabulario de e-commerce (no de consultas)
SEÑALES_TIENDA = ["tienda", "catalogo", "catálogo", "producto", "comprar", "precio",
                  "vestido", "ropa", "zapatilla", "envio", "envío", "stock",
                  "yape", "plin", "pedido", "oferta"]
# Consultas: vocabulario del servicio real
SEÑALES_CONSULTA = ["consulta", "reniec", "dni", "reporte", "dnix", "c4", "denuncia",
                    "telefono", "teléfono", "comando", "cmds", "linea", "línea"]


def clasificar(texto: str) -> tuple[str, str]:
    """Devuelve (estado, detalle) a partir de la respuesta del bot."""
    if not texto:
        return "MUERTO", "sin respuesta"

    t = texto.lower()
    if any(s in t for s in SEÑALES_MIGRADO):
        return "MIGRADO", texto[:120]

    hits_tienda = sum(1 for s in SEÑALES_TIENDA if s in t)
    hits_consulta = sum(1 for s in SEÑALES_CONSULTA if s in t)

    # Tienda: vocabulario comercial y ninguna señal de consulta
    if hits_tienda >= 2 and hits_consulta == 0:
        return "TIENDA", texto[:120]
    # Sin ninguna señal de consulta tampoco sirve para el pool
    if hits_consulta == 0:
        return "DUDOSO", texto[:120]
    return "OK", texto[:120]


async def probar_comando_real(client: TelegramClient, entidad, username: str) -> tuple[str, str]:
    """
    Prueba comandos de consulta reales en bots que no responden a /start.

    Se prueban en orden: /cmds (lista de comandos, presente en casi todos) y
    /dnix (formato del pool gratuito). NO se usa un DNI real: 12345678 es
    inválido a propósito, así que basta con que el bot conteste "sin
    resultados", "procesando" o un menú para saber que está vivo.
    """
    for cmd in ("/cmds", "/dnix 12345678"):
        try:
            sent = await client.send_message(entidad, cmd)
            await asyncio.sleep(15)
            msgs = await client.get_messages(entidad, limit=5, min_id=sent.id)
            for m in msgs:
                if m.media:
                    return "OK", f"responde a {cmd.split()[0]} (envía archivos)"
                if m.text:
                    t = m.text.lower()
                    if "➮" in m.text or "comando" in t or "command" in t \
                            or "sin resultado" in t or "no encontr" in t \
                            or "procesando" in t or "extrayendo" in t \
                            or "error" in t or "formato" in t:
                        return "OK", f"responde a {cmd.split()[0]}"
        except Exception:
            continue
    return "MUERTO", "no responde a comandos"


async def probar_bot(client: TelegramClient, username: str, etiqueta: str) -> dict:
    """Envía /start al bot y devuelve el diagnóstico."""
    resultado = {"bot": username, "cuenta": etiqueta, "estado": "?", "detalle": ""}
    try:
        entidad = await client.get_entity(username)
    except (UsernameNotOccupiedError, UsernameInvalidError, ValueError):
        resultado.update(estado="MUERTO", detalle="el usuario no existe")
        return resultado
    except FloodWaitError as e:
        resultado.update(estado="ERROR", detalle=f"FloodWait {e.seconds}s")
        return resultado
    except Exception as e:
        resultado.update(estado="ERROR", detalle=f"{type(e).__name__}: {str(e)[:80]}")
        return resultado

    # Nombre real del bot (para detectar renombrados)
    nombre = getattr(entidad, "username", username) or username
    titulo = getattr(entidad, "first_name", "") or ""
    resultado["titulo"] = titulo

    try:
        await client.send_message(entidad, "/start")
        await asyncio.sleep(6)
        mensajes = await client.get_messages(entidad, limit=3)

        # Tomar el último mensaje del bot con texto
        texto = ""
        for m in mensajes:
            if m.out is False and m.text:
                texto = m.text
                break
        if not texto:
            for m in mensajes:
                if m.text:
                    texto = m.text
                    break

        estado, detalle = clasificar(texto)

        # Si no parece bot de consultas, probar un comando real antes de
        # descartarlo: algunos (p. ej. @Bitxdatabot) no responden a /start
        # porque solo atienden comandos directos.
        if estado in ("DUDOSO", "MUERTO"):
            estado2, detalle2 = await probar_comando_real(client, entidad, username)
            if estado2 == "OK":
                resultado.update(estado="OK", detalle=detalle2)
                return resultado
            resultado.update(estado="MUERTO", detalle="no responde a /start ni a comandos")
            return resultado

        resultado.update(estado=estado, detalle=detalle)
    except UserIsBlockedError:
        resultado.update(estado="MUERTO", detalle="bloqueaste este bot")
    except FloodWaitError as e:
        resultado.update(estado="ERROR", detalle=f"FloodWait {e.seconds}s")
    except Exception as e:
        resultado.update(estado="ERROR", detalle=f"{type(e).__name__}: {str(e)[:80]}")

    return resultado


async def main() -> None:
    bots = sys.argv[1:] or BOTS_DEFECTO

    cuentas = [
        ("CUENTA 1", os.getenv("TELEGRAM_API_ID"), os.getenv("TELEGRAM_API_HASH"),
         os.getenv("TELEGRAM_SESSION_STRING")),
        ("CUENTA 2", os.getenv("TELEGRAM_API_ID_2"), os.getenv("TELEGRAM_API_HASH_2"),
         os.getenv("TELEGRAM_SESSION_STRING_2")),
    ]

    resultados = []
    for etiqueta, api_id, api_hash, session in cuentas:
        if not (api_id and api_hash and session):
            print(f"\n{etiqueta}: sin credenciales, se omite")
            continue
        print(f"\n{'='*60}\n{etiqueta}\n{'='*60}")
        client = TelegramClient(StringSession(session), int(api_id), api_hash)
        await client.connect()
        try:
            me = await client.get_me()
            print(f"  conectado como: {getattr(me, 'username', None) or getattr(me, 'first_name', '?')}")
        except Exception as e:
            print(f"  no se pudo conectar: {e}")
            await client.disconnect()
            continue

        for bot in bots:
            r = await probar_bot(client, bot, etiqueta)
            resultados.append(r)
            icono = {"OK": "✅", "MUERTO": "❌", "MIGRADO": "➡️", "TIENDA": "🛒", "ERROR": "⚠️"}.get(r["estado"], "?")
            titulo = r.get("titulo", "")
            print(f"  {icono} {bot:<22} {titulo[:22]:<22} -> {r['estado']:<8} {r['detalle'][:60]}")
            await asyncio.sleep(2)   # ritmo prudente entre bots

        await client.disconnect()

    # ── Resumen ─────────────────────────────────────────────────────────────
    print(f"\n{'='*60}\nRESUMEN\n{'='*60}")
    por_bot: dict[str, dict[str, str]] = {}
    for r in resultados:
        por_bot.setdefault(r["bot"], {})[r["cuenta"]] = r["estado"]

    for bot, estados in por_bot.items():
        e1 = estados.get("CUENTA 1", "—")
        e2 = estados.get("CUENTA 2", "—")
        ambos = "SI" if e1 == "OK" and e2 == "OK" else ("PARCIAL" if "OK" in (e1, e2) else "NO")
        print(f"  {bot:<22} C1={e1:<8} C2={e2:<8} util={ambos}")

    utiles = [b for b, e in por_bot.items() if "OK" in e.values()]
    print(f"\n  BOTS ÚTILES: {len(utiles)}")
    for b in utiles:
        print(f"    ✅ {b}")
    print(f"\n  BOTS A ELIMINAR: {len(por_bot) - len(utiles)}")
    for b, e in por_bot.items():
        if "OK" not in e.values():
            print(f"    ❌ {b}  ({', '.join(f'{k}={v}' for k, v in e.items())})")


if __name__ == "__main__":
    asyncio.run(main())
