import os
import glob
import re

base_dir = 'frontend/src/components'
files = glob.glob(os.path.join(base_dir, '*.jsx'))

for path in files:
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    modified = False

    # Fix layout of buttons: flex flex-col w-full gap-3 -> flex flex-row w-full gap-3
    if 'className="flex flex-col w-full gap-3"' in content:
        content = content.replace('className="flex flex-col w-full gap-3"', 'className="flex flex-row w-full gap-3"')
        modified = True
    
    # Fix Fiscalia and Delitos specific bug where download is hardcoded to .pdf
    if 'Fiscalia.jsx' in path or 'Delitos.jsx' in path:
        # We need to replace a.download = `DENUNCIA_${index + 1}_${generatedData.queryTarget}.pdf`;
        # with dynamic extension.
        if "a.download = `DENUNCIA_" in content and ".pdf" in content:
            # simple string replacement if possible
            content = re.sub(
                r"a\.download = `DENUNCIA_\$\{index \+ 1\}_([^`]+)\.pdf`;",
                r"const ext = filePath.split('.').pop() || 'pdf';\n      a.download = `DOCUMENTO_${index + 1}.${ext}`;",
                content
            )
            modified = True

    if modified:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
