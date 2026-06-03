import os
import asyncio
from telethon import TelegramClient
from telethon.sessions import StringSession
from dotenv import load_dotenv

async def main():
    load_dotenv()

    api_id = os.getenv("TELEGRAM_API_ID")
    api_hash = os.getenv("TELEGRAM_API_HASH")

    if not api_id or not api_hash:
        print("❌ ERROR: No se encontraron TELEGRAM_API_ID o TELEGRAM_API_HASH en el archivo .env")
        return

    print("--- Generador de Sesión de Telegram ---")
    print(f"Usando API_ID: {api_id}")

    # Iniciamos el cliente de forma asíncrona
    client = TelegramClient(StringSession(), api_id, api_hash)
    
    await client.start()
    
    session_string = client.session.save()
    
    print("\n✅ ¡SESIÓN GENERADA CON ÉXITO!")
    print("-" * 50)
    print(session_string)
    print("-" * 50)
    print("\nCopia el código de arriba y pégalo en tu archivo .env en la variable:")
    print("TELEGRAM_SESSION_STRING=tu_nuevo_codigo_aqui")
    print("-" * 50)
    
    await client.disconnect()

if __name__ == "__main__":
    asyncio.run(main())
