import re

with open("backend/bot_client.py", "r", encoding="utf-8") as f:
    content = f.read()

new_method = """
    async def query_record(self, target: str) -> dict:
        \"\"\"Consulta record vehicular usando /record.\"\"\"
        await self._ensure_connection()

        target_group = self.premium_group_id if self.premium_group_id else -1003719053693
        target_bot_id = self.premium_bot_id if self.premium_bot_id else 8285118936

        print(f"🚗 Enviando /record {target} al grupo {target_group}...")
        sent_msg = await self.client.send_message(target_group, f'/record {target}')

        await asyncio.sleep(5)

        received_parts = {}
        seen_ids = set()
        total_parts = None

        for attempt in range(12):
            print(f"🔄 record intento {attempt + 1}/12 buscando respuesta...")

            async for message in self.client.iter_messages(target_group, limit=15, reply_to=sent_msg.id):
                if message.id in seen_ids:
                    continue
                if message.sender_id != target_bot_id:
                    continue

                text = message.text or ""
                if not text:
                    continue

                seen_ids.add(message.id)
                text_upper = text.upper()

                if "ANTI-SPAM" in text_upper or "espere" in text.lower():
                    wait_time = 15
                    try:
                        m = re.search(r'(\\d+(?:\\.\\d+)?)s', text)
                        if m: wait_time = float(m.group(1)) + 2
                    except: pass
                    print(f"⚠️ Anti-spam record: esperando {wait_time:.0f}s...")
                    await asyncio.sleep(wait_time)
                    sent_msg = await self.client.send_message(target_group, f'/record {target}')
                    await asyncio.sleep(5)
                    seen_ids.clear()
                    break

                if self._is_sin_resultados(text):
                    print(f"⛔ record: Sin Resultados para {target}")
                    raise SinResultadosError("「❌️」Sin Resultados. Verifique los datos e intente nuevamente.")

                wait_keywords = ["procesando", "buscando", "cargando", "analizando"]
                if any(k in text.lower() for k in wait_keywords):
                    continue

                is_valid = "RECORD" in text_upper or "INFRACCIONES" in text_upper or "SANCIONES" in text_upper
                if not is_valid:
                    raise Exception("UNKNOWN_RESPONSE: No se encontraron datos.")

                page_match = re.search(r'(\\d+)\\s*/\\s*(\\d+)', text)
                if page_match:
                    part_num    = int(page_match.group(1))
                    total_parts = int(page_match.group(2))
                else:
                    part_num    = 1
                    total_parts = 1

                received_parts[part_num] = text
                
                # Try to download PDF document if exists
                file_path_rel = None
                if message.media and hasattr(message.media, 'document'):
                    import os
                    docs_dir = os.path.join(os.path.dirname(__file__), 'static', 'files')
                    os.makedirs(docs_dir, exist_ok=True)
                    filename = f"RECORD_{target}.pdf"
                    abs_path = os.path.join(docs_dir, filename)
                    await message.download_media(file=abs_path)
                    file_path_rel = f"files/{filename}"
                elif message.media:
                    import os
                    docs_dir = os.path.join(os.path.dirname(__file__), 'static', 'files')
                    os.makedirs(docs_dir, exist_ok=True)
                    filename = f"RECORD_{target}.pdf"
                    abs_path = os.path.join(docs_dir, filename)
                    await message.download_media(file=abs_path)
                    file_path_rel = f"files/{filename}"

            if total_parts is not None and len(received_parts) >= total_parts:
                break

            await asyncio.sleep(3)

        if not received_parts:
            raise Exception("UNKNOWN_RESPONSE: No se encontraron datos.")

        combined = "\\n\\n".join(received_parts[k] for k in sorted(received_parts.keys()))
        return {"raw_text": combined, "file_path": file_path_rel if 'file_path_rel' in locals() else None}
"""

if "async def query_record" not in content:
    # Insert before search_with_sirius
    content = content.replace("async def search_with_sirius", new_method + "\\n    async def search_with_sirius")
    with open("backend/bot_client.py", "w", encoding="utf-8") as f:
        f.write(content)
    print("Added query_record")
else:
    print("query_record already exists")
