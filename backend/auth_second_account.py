import asyncio
from telethon import TelegramClient
from telethon.sessions import StringSession
import os

# Credenciales de la segunda cuenta proporcionadas por el usuario
api_id = 30265691
api_hash = '774e51c563b87dceafc5b3ac18edc0f4'

async def main():
    print("="*50)
    print("🔐 INICIANDO AUTENTICACIÓN PARA LA CUENTA SECUNDARIA")
    print("="*50)
    print("\nInstrucciones:")
    print("1. Introduce tu número de teléfono (ej: +51987654321)")
    print("2. Introduce el código que recibirás en tu Telegram")
    print("-" * 50)

    try:
        client = TelegramClient(StringSession(), api_id, api_hash)
        await client.start()
        
        session_str = client.session.save()
        print("\n" + "✅" * 20)
        print("¡AUTENTICACIÓN EXITOSA!")
        print("✅" * 20)
        print("\nTu STRING_SESSION_2 es:\n")
        print(session_str)
        print("\n" + "="*50)
        print("PASOS A SEGUIR:")
        print("1. Copia TODO el código de arriba.")
        print("2. Abre tu archivo '.env' en la carpeta backend.")
        print("3. Busca o añade la línea:")
        print("   TELEGRAM_SESSION_STRING_2=pega_aqui_el_codigo")
        print("4. Guarda el archivo y reinicia el servidor (uvicorn).")
        print("="*50)
        await client.disconnect()
    except Exception as e:
        print(f"\n❌ Error durante la autenticación: {e}")

if __name__ == "__main__":
    asyncio.run(main())
