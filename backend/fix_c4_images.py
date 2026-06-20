import re

file_path = 'backend/bot_client.py'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# For C4 Blue
old_c4 = '''            found_msg = None
            for attempt in range(12):
                print(f"🔄 Polling C4 intento {attempt+1}/12...")
                async for message in self.client.iter_messages(target_group, limit=10, min_id=sent_msg.id, reverse=True):'''
new_c4 = '''            found_msg = None
            found_image = None
            for attempt in range(12):
                print(f"🔄 Polling C4 intento {attempt+1}/12...")
                async for message in self.client.iter_messages(target_group, limit=20, min_id=sent_msg.id, reverse=True):
                    if message.photo or message.document:
                        found_image = message'''
if 'found_image = None' not in content:
    content = content.replace(old_c4, new_c4)

old_dl1 = '''            file_path = None
            if getattr(found_msg, 'media', None):
                static_files_dir = Path(__file__).parent / "static" / "files"
                static_files_dir.mkdir(parents=True, exist_ok=True)
                ext = "jpg" if getattr(found_msg, 'photo', None) else "pdf"
                filename = f"C4_AZUL_{dni}.{ext}"
                path = static_files_dir / filename
                await found_msg.download_media(file=path)
                file_path = f"files/{filename}"'''
new_dl1 = '''            file_path = None
            media_msg = found_msg if getattr(found_msg, 'media', None) else found_image
            if media_msg and getattr(media_msg, 'media', None):
                static_files_dir = Path(__file__).parent / "static" / "files"
                static_files_dir.mkdir(parents=True, exist_ok=True)
                ext = "jpg" if getattr(media_msg, 'photo', None) else "pdf"
                filename = f"C4_AZUL_{dni}.{ext}"
                path = static_files_dir / filename
                await media_msg.download_media(file=path)
                file_path = f"files/{filename}"'''
content = content.replace(old_dl1, new_dl1)


# For C4 Inscripción
old_c4i = '''            found_msg = None
            for attempt in range(8):
                print(f"🔄 Polling C4 Inscripción intento {attempt+1}/8...")
                async for message in self.client.iter_messages(target_group, limit=10, min_id=sent_msg.id, reverse=True):'''
new_c4i = '''            found_msg = None
            found_image = None
            for attempt in range(8):
                print(f"🔄 Polling C4 Inscripción intento {attempt+1}/8...")
                async for message in self.client.iter_messages(target_group, limit=20, min_id=sent_msg.id, reverse=True):
                    if message.photo or message.document:
                        found_image = message'''
if 'Polling C4 Inscripción intento' in content and 'found_image = None' not in content.split('Polling C4 Inscripción')[1]:
    content = content.replace(old_c4i, new_c4i)

old_dl2 = '''            file_path = None
            if getattr(found_msg, 'media', None):
                static_files_dir = Path(__file__).parent / "static" / "files"
                static_files_dir.mkdir(parents=True, exist_ok=True)
                ext = "jpg" if getattr(found_msg, 'photo', None) else "pdf"
                filename = f"C4_INSCRIPCION_{dni}.{ext}"
                path = static_files_dir / filename
                await found_msg.download_media(file=path)
                file_path = f"files/{filename}"'''
new_dl2 = '''            file_path = None
            media_msg = found_msg if getattr(found_msg, 'media', None) else found_image
            if media_msg and getattr(media_msg, 'media', None):
                static_files_dir = Path(__file__).parent / "static" / "files"
                static_files_dir.mkdir(parents=True, exist_ok=True)
                ext = "jpg" if getattr(media_msg, 'photo', None) else "pdf"
                filename = f"C4_INSCRIPCION_{dni}.{ext}"
                path = static_files_dir / filename
                await media_msg.download_media(file=path)
                file_path = f"files/{filename}"'''
content = content.replace(old_dl2, new_dl2)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Actualizado bot_client.py para imágenes separadas")
