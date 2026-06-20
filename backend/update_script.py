import re
import os

file_path = 'backend/bot_client.py'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add _clean_bot_text
if 'def _clean_bot_text' not in content:
    replacement = """from parser import parse_bot_response

def _clean_bot_text(text):
    if not text: return ""
    import re
    text = re.sub(r'(?im)^usuario\\s*:.*$', '', text)
    text = re.sub(r'(?im)^cr[eé]ditos\\s*:.*$', '', text)
    return text.strip()
"""
    content = content.replace('from parser import parse_bot_response', replacement)

# 2. Premium /dni
content = content.replace("f'/dnig {dni}'", "f'/dni {dni}'")

# 3. Clean text in premium
if 'text = _clean_bot_text(text)' not in content:
    content = content.replace('text = "\\n\\n".join(text_parts) if text_parts else (found_msgs[0].text or "")',
                              'text = "\\n\\n".join(text_parts) if text_parts else (found_msgs[0].text or "")\n                text = _clean_bot_text(text)')

# 4. generate_c4_blue
content = content.replace("f'/c4a {dni}'", "f'/c4 {dni}'")
if '"raw_text": _clean_bot_text(found_msg.text)' not in content:
    content = content.replace('"raw_text": found_msg.text,', '"raw_text": _clean_bot_text(found_msg.text),')

# 5. generate_dni_electronico
content = content.replace("f'/dnie {dni}'", "f'/dnive {dni}'")
if 'm.text and "ANVERSO"' not in content:
    old_frontal = 'frontal_msg = next((m for m in found_images if m.file and m.file.name and "FRONT" in m.file.name.upper()), found_images[0])'
    new_frontal = 'frontal_msg = next((m for m in found_images if (m.file and m.file.name and "FRONT" in m.file.name.upper()) or (m.text and "ANVERSO" in m.text.upper())), found_images[0])'
    content = content.replace(old_frontal, new_frontal)
    
    old_reverso = 'reverso_msg = next((m for m in found_images if m.file and m.file.name and "BACK" in m.file.name.upper()), found_images[1] if len(found_images) > 1 else found_images[0])'
    new_reverso = 'reverso_msg = next((m for m in found_images if (m.file and m.file.name and "BACK" in m.file.name.upper()) or (m.text and "REVERSO" in m.text.upper())), found_images[1] if len(found_images) > 1 else found_images[0])'
    content = content.replace(old_reverso, new_reverso)

if 'raw_text = _clean_bot_text(raw_text)' not in content:
    content = content.replace('parsed_data = parse_bot_response(raw_text)',
                              'raw_text = _clean_bot_text(raw_text)\n            parsed_data = parse_bot_response(raw_text)')

# 6. generate_facial
if '"raw_text": _clean_bot_text(found_msg.message or found_msg.text or "")' not in content:
    content = content.replace('"raw_text": found_msg.message or found_msg.text or "",',
                              '"raw_text": _clean_bot_text(found_msg.message or found_msg.text or ""),')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Reemplazos aplicados correctamente.')
