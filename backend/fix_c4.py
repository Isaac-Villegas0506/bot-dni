import re

file_path = 'backend/bot_client.py'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace condition for C4 Blue
old_cond1 = '''                        # Si tiene documento PDF y texto contiene C4 o ᴄ𝟺 y nuestro DNI
                        has_c4_text = "C4" in text.upper() or "ᴄ𝟺" in text
                        if message.document and has_c4_text and str(dni) in text:
                            found_msg = message
                            break'''
new_cond1 = '''                        # Si el texto contiene C4 o ᴄ𝟺 y nuestro DNI
                        has_c4_text = "C4" in text.upper() or "ᴄ𝟺" in text
                        if has_c4_text and str(dni) in text:
                            found_msg = message
                            break'''
content = content.replace(old_cond1, new_cond1)

# Replace download logic for C4 Blue
old_dl1 = '''            # 4. Procesar Resultado Exitoso
            print("✅ C4 Azul encontrado. Descargando...")
            
            static_files_dir = Path(__file__).parent / "static" / "files"
            static_files_dir.mkdir(parents=True, exist_ok=True)
            
            filename = f"C4_AZUL_{dni}.pdf"
            path = static_files_dir / filename
            
            await found_msg.download_media(file=path)'''
new_dl1 = '''            # 4. Procesar Resultado Exitoso
            print("✅ C4 Azul encontrado.")
            
            file_path = None
            if getattr(found_msg, 'media', None):
                static_files_dir = Path(__file__).parent / "static" / "files"
                static_files_dir.mkdir(parents=True, exist_ok=True)
                ext = "jpg" if getattr(found_msg, 'photo', None) else "pdf"
                filename = f"C4_AZUL_{dni}.{ext}"
                path = static_files_dir / filename
                await found_msg.download_media(file=path)
                file_path = f"files/{filename}"'''
content = content.replace(old_dl1, new_dl1)

old_ret1 = '''            return {
                "file_path": f"files/{filename}",
                "raw_text": _clean_bot_text(found_msg.text),
                **parsed_data
            }'''
new_ret1 = '''            result = {
                "raw_text": _clean_bot_text(found_msg.text),
                **parsed_data
            }
            if file_path:
                result["file_path"] = file_path
            return result'''
content = content.replace(old_ret1, new_ret1)

# Replace condition for C4 Inscripcion
old_cond2 = '''                        # Si tiene documento PDF y texto contiene C4 o ᴄ𝟺 y nuestro DNI
                        has_c4_text = "C4" in text.upper() or "ᴄ𝟺" in text
                        if message.document and has_c4_text and str(dni) in text:
                            found_msg = message
                            break'''
new_cond2 = '''                        # Si el texto contiene C4 o ᴄ𝟺 y nuestro DNI
                        has_c4_text = "C4" in text.upper() or "ᴄ𝟺" in text
                        if has_c4_text and str(dni) in text:
                            found_msg = message
                            break'''
content = content.replace(old_cond2, new_cond2)

old_dl2 = '''            # 4. Procesar Resultado Exitoso
            print("✅ C4 Inscripción encontrado. Descargando...")
            
            static_files_dir = Path(__file__).parent / "static" / "files"
            static_files_dir.mkdir(parents=True, exist_ok=True)
            
            filename = f"C4_INSCRIPCION_{dni}.pdf"
            path = static_files_dir / filename
            
            await found_msg.download_media(file=path)'''
new_dl2 = '''            # 4. Procesar Resultado Exitoso
            print("✅ C4 Inscripción encontrado.")
            
            file_path = None
            if getattr(found_msg, 'media', None):
                static_files_dir = Path(__file__).parent / "static" / "files"
                static_files_dir.mkdir(parents=True, exist_ok=True)
                ext = "jpg" if getattr(found_msg, 'photo', None) else "pdf"
                filename = f"C4_INSCRIPCION_{dni}.{ext}"
                path = static_files_dir / filename
                await found_msg.download_media(file=path)
                file_path = f"files/{filename}"'''
content = content.replace(old_dl2, new_dl2)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Actualizado bot_client.py")
