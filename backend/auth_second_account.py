"""
auth_second_account.py
──────────────────────
Genera un StringSession para la CUENTA SECUNDARIA de Telegram y lo imprime
para pegarlo en TELEGRAM_SESSION_STRING_2 del archivo .env.

IMPORTANTE: este script NO contiene credenciales. Las lee del .env
(TELEGRAM_API_ID_2 / TELEGRAM_API_HASH_2, con fallback a TELEGRAM_API_ID /
TELEGRAM_API_HASH). Antes estaban hardcodeadas aquí, en un repo público.

USO:
    cd backend
    python auth_second_account.py
"""

import asyncio
import os
import sys

from dotenv import load_dotenv
from telethon import TelegramClient
from telethon.sessions import StringSession


def _load_credentials() -> tuple[int, str] | None:
    """Lee las credenciales de la segunda cuenta desde el entorno."""
    api_id_2 = os.getenv("TELEGRAM_API_ID_2") or os.getenv("TELEGRAM_API_ID")
    api_hash_2 = os.getenv("TELEGRAM_API_HASH_2") or os.getenv("TELEGRAM_API_HASH")

    if not api_id_2 or not api_hash_2:
        print(
            "❌ ERROR: faltan TELEGRAM_API_ID_2 / TELEGRAM_API_HASH_2 en el .env\n"
            "   (se acepta TELEGRAM_API_ID / TELEGRAM_API_HASH como fallback)."
        )
        return None

    try:
        return int(api_id_2), api_hash_2
    except ValueError:
        print(f"❌ ERROR: TELEGRAM_API_ID_2 no es numérico: {api_id_2!r}")
        return None


async def main() -> None:
    load_dotenv()

    credentials = _load_credentials()
    if not credentials:
        return
    api_id, api_hash = credentials

    print("=" * 50)
    print("🔐 INICIANDO AUTENTICACIÓN PARA LA CUENTA SECUNDARIA")
    print("=" * 50)
    print(f"Usando API_ID: {api_id}")
    print("\nInstrucciones:")
    print("1. Introduce tu número de teléfono (ej: +51987654321)")
    print("2. Introduce el código que recibirás en tu Telegram")
    print("-" * 50)

    client = TelegramClient(StringSession(), api_id, api_hash)
    try:
        await client.start()
        session_str = client.session.save()

        print("\n" + "✅" * 20)
        print("¡AUTENTICACIÓN EXITOSA!")
        print("✅" * 20)
        print("\nTu STRING_SESSION_2 es:\n")
        print(session_str)
        print("\n" + "=" * 50)
        print("PASOS A SEGUIR:")
        print("1. Copia TODO el código de arriba.")
        print("2. Abre tu archivo '.env' en la carpeta backend.")
        print("3. Reemplaza el valor de:")
        print("   TELEGRAM_SESSION_STRING_2=pega_aqui_el_codigo")
        print("4. Guarda el archivo y reinicia el servidor (uvicorn).")
        print("=" * 50)
    except Exception as e:
        print(f"\n❌ Error durante la autenticación: {e}")
        sys.exit(1)
    finally:
        if client.is_connected():
            await client.disconnect()


if __name__ == "__main__":
    asyncio.run(main())
