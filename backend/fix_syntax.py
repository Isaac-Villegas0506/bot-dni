import re

file_path = 'backend/bot_client.py'
with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
skip_count = 0

for i, line in enumerate(lines):
    if skip_count > 0:
        skip_count -= 1
        continue
    
    # Keep the first one which is correctly placed at top level
    if i > 50 and line.startswith('def _clean_bot_text(text):'):
        # Skip this line and the next 6 lines of the function body
        skip_count = 6
        continue
    
    new_lines.append(line)

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)
print('Errores de sintaxis arreglados.')
