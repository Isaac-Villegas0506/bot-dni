from __future__ import annotations
import asyncio
import re
import os
import random
from pathlib import Path
from telegram.guards import check_antispam

_BOT = "@Infordata1_bot"
_WAIT_KWS = ["procesando", "wait", "recopilando", "buscando", "cargando", "analizando", "espere", "moment"]

def _parse_metadata_text(text: str) -> dict:
    data = {
        "nombre": "",
        "sexo": "",
        "nacimiento": "",
        "edad": "",
        "estado_civil": "",
        "direccion": "",
        "distrito": "",
        "provincia": "",
        "caducidad_dni": "",
        "telefonos": [],
        "denuncias": "0"
    }
    
    # Text extractors
    patterns = {
        "nombre": r"NOMBRE[^\w\n]*([^\n]+)",
        "sexo": r"SEXO[^\w\n]*([^\n]+)",
        "nacimiento": r"NACIMIENTO[^\w\n]*([^\n]+)",
        "edad": r"EDAD[^\w\n]*([^\n]+)",
        "estado_civil": r"ESTADO CIVIL[^\w\n]*([^\n]+)",
        "direccion": r"DIRECCI[OÓ]N[^\w\n]*([^\n]+)",
        "distrito": r"DISTRITO[^\w\n]*([^\n]+)",
        "provincia": r"PROVINCIA[^\w\n]*([^\n]+)",
        "caducidad_dni": r"CADUCIDAD DNI[^\w\n]*([^\n]+)",
        "denuncias": r"DENUNCIAS[^\w\n]*([^\n]+)"
    }
    
    for key, pattern in patterns.items():
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            data[key] = m.group(1).strip()
            
    # Extract phones
    # Example: • 968500799 — movistar (-)
    phone_matches = re.finditer(r"•\s*(\d+)\s*—\s*([^\n]+)", text)
    for m in phone_matches:
        data["telefonos"].append({
            "numero": m.group(1).strip(),
            "operadora": m.group(2).strip().replace("(-)", "").strip()
        })
        
    return data

async def query_metadata(
    client,
    bot_pool,
    dni: str,
    static_base_dir: Path
) -> dict:
    
    query = f"/metadata {dni}"
    active_client = client
    
    # Try to acquire the bot from the pool if we have one
    if bot_pool:
        try:
            acquired = await bot_pool.acquire_bot([_BOT], timeout=5)
            if not acquired:
                raise Exception(f"No se pudo adquirir el bot {_BOT}")
        except Exception as e:
            print(f"⚠️ Error adquiriendo {_BOT} para metadata: {e}")
            pass

    print(f"🚀 Enviando {query} a {_BOT}...")
    await active_client.send_message(_BOT, query)
    await asyncio.sleep(2)

    found_pdf = None
    pdf_rel_path = None
    text_result = ""

    for _ in range(12):
        msgs = await active_client.get_messages(_BOT, limit=2)
        if not msgs:
            await asyncio.sleep(2)
            continue
            
        for msg in msgs:
            text = getattr(msg, 'text', '') or getattr(msg, 'message', '') or ""
            
            with open("debug_metadata.txt", "a", encoding="utf-8") as f:
                f.write(f"RECEIVED TEXT: {repr(text)}\n")
            
            text_lower = text.lower()
            
            if getattr(msg, 'text', None) is None and getattr(msg, 'document', None) is None:
                continue
                
            # Skip antispam/wait messages
            if any(k in text_lower for k in _WAIT_KWS) or check_antispam(text_lower):
                continue
                
            if msg.document and msg.file.ext == ".pdf":
                found_pdf = msg
                if "METADATA" in text:
                    text_result = text
                
            if "METADATA" in text:
                text_result = text

        if found_pdf and text_result:
            break
            
        await asyncio.sleep(2)

    if not text_result:
        from telegram.exceptions import SinResultadosError
        raise SinResultadosError(f"No se encontró metadata para el DNI {dni}")

    parsed_data = _parse_metadata_text(text_result)

    if found_pdf:
        import uuid
        pdf_filename = f"metadata_{dni}_{uuid.uuid4().hex[:6]}.pdf"
        out_dir = static_base_dir / "files"
        out_dir.mkdir(parents=True, exist_ok=True)
        pdf_path = out_dir / pdf_filename
        
        print(f"📥 Descargando PDF de metadata en {pdf_path}")
        await active_client.download_media(found_pdf, file=str(pdf_path))
        pdf_rel_path = f"files/{pdf_filename}"
        
    return {
        "datos": parsed_data,
        "pdf_url": pdf_rel_path
    }
