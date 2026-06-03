import os
import asyncio
from telethon import TelegramClient
from telethon.sessions import StringSession
from dotenv import load_dotenv

# Cargar variables de entorno desde .env si existe
load_dotenv()

async def main():
    api_id = os.getenv("TELEGRAM_API_ID")
    api_hash = os.getenv("TELEGRAM_API_HASH")

    if not api_id or not api_hash:
        print("❌ Error: No se encontraron TELEGRAM_API_ID o TELEGRAM_API_HASH en el entorno ni en un archivo .env")
        return

    print("🔑 Iniciando proceso de Login en Telegram...")
    print("Se te pedirá tu número de teléfono y luego el código enviado por Telegram.")
    
    # Usar StringSession vacío para generar uno nuevo que podamos exportar
    client = TelegramClient(StringSession(), int(api_id), api_hash)
    
    await client.start()
    
    session_str = client.session.save()
    print("\n✅ ¡Login completado con éxito!")
    print("\n" + "="*50)
    print("TU STRING SESSION (Copia esto para Vercel/Render):")
    print("="*50)
    print(session_str)
    print("="*50)
    print("\nGuarda este código en la variable de entorno: TELEGRAM_SESSION_STRING")
    
    await client.disconnect()

if __name__ == "__main__":
    asyncio.run(main())
