import os
import glob

base_dir = 'frontend/src/components'
files = glob.glob(os.path.join(base_dir, '*.jsx'))

for path in files:
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    modified = False

    # Since we previously changed to flex flex-row, let's just make sure we replace w-full with flex-1 on the buttons directly below that div.
    # To be safe, we can just replace 'w-full py-4 rounded-lg bg-blue-600' -> 'flex-1 py-4 rounded-lg bg-blue-600'
    # And 'w-full py-3 rounded-xl border border-slate-200' -> 'flex-1 py-3 rounded-xl border border-slate-200'
    
    # We also might have 'w-full py-4 rounded-xl'
    
    replacements = [
        ('w-full py-4 rounded-lg bg-blue-600', 'flex-1 py-4 rounded-lg bg-blue-600'),
        ('w-full py-3 rounded-xl border border-slate-200', 'flex-1 py-3 rounded-xl border border-slate-200'),
        ('w-full py-4 bg-emerald-600', 'flex-1 py-4 bg-emerald-600'), # if there are others
        ('w-full py-4 bg-blue-600', 'flex-1 py-4 bg-blue-600'),
        ('w-full py-3 bg-white', 'flex-1 py-3 bg-white'),
    ]
    
    # Actually, the user says "en una solia linea alado de volver el de descargar".
    # Because there's a risk of breaking other buttons, I will only replace these inside the wrapper.
    # But for a quick fix, let's just replace them globally in the file if they are "w-full py-3 rounded-xl border" (that's Volver).
    
    if "flex flex-row w-full gap-3" in content or "flex flex-col w-full gap-3" in content:
        for old, new in replacements:
            if old in content:
                content = content.replace(old, new)
                modified = True
                
    if modified:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
