const rawText = `[ #INFOR DATA ☁️ ]\n\n➤ #CEL\nTELEFONÍA POR NÚMERO - 928669585 -\n\nTELÉFONO : 928669585\nTOTAL ÚNICOS : 1\n\nDNI : 72928277\nNOMBRES : Yerfeson Isaac Villegas Diaz\nOPERADOR : MOVISTAR\nPLAN : PRODUCTO\nPERÍODO : -\nFUENTE : DB1\n\nUSUARIO : 8287794268\nCRÉDITOS : ♾️`;
function stripMd(text) { return text; }
function parseTelpUnified(rawText) {
    if (!rawText) return [];
    const entries = [];
    let current = null;
    let globalTitular = '';
    let globalDni = '';
    let globalOperador = '';
    const lines = rawText.split('\n').map(l => stripMd(l).trim()).filter(Boolean);
    const extract = (line, keyword = '') => {
        const m = line.match(/[➔▶➣➺]\s*(.+)$/);
        if (m) return m[1].trim();
        const m2 = line.match(/:\s*(.+)$/);
        if (m2) return m2[1].trim();
        if (keyword) {
            const regex = new RegExp('^' + keyword + '\\s+(.*)$', 'i');
            const m3 = line.match(regex);
            if (m3) return m3[1].trim();
        }
        return '';
    };
    const norm = (l) => l.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    const isEmpty = (v) => !v || v === '?' || v === '-' || v === '—';
    for (const line of lines) {
        const n = norm(line);
        if (n.includes('KING DATA') || n.includes('TELEFONIA') || n.includes('RESULTADOS')) continue;
        
        // OLD BUG: THIS TRIGGERED AND SKIPPED!
        if ((n.includes('ENTEL') || n.includes('MOVISTAR')) && !line.includes('|')) {
            globalOperador = line.replace(/[^a-zA-Z\s]/g, '').trim();
            // IS IT CONTINUING HERE INSTEAD OF FALLING THROUGH?!
            continue;
        }

        if (n.includes('TITULAR') || n.includes('NOMBRES')) {
            let v = extract(line, n.includes('TITULAR') ? 'TITULAR' : 'NOMBRES');
            if (!v && /^[A-ZÑ\s]+$/.test(n)) { v = line.trim(); }
            if (!isEmpty(v)) globalTitular = v;
            if (current) current.titular = isEmpty(v) ? '' : v;
            continue;
        } else if (n.includes('DNI') || n.includes('DOC')) {
            const v = extract(line, 'DNI');
            if (!isEmpty(v)) globalDni = v;
            if (current) current.dni = v;
            continue;
        }
        if ((n.includes('TELEFONO') || n.includes('NUMERO')) && n.includes(':')) {
            if (current) entries.push(current);
            const val = extract(line, 'TELEFONO');
            current = { numero: val, telefono: val, titular: globalTitular, dni: globalDni, operador: globalOperador };
            continue;
        }
        if (!current) continue;
        if (n.includes('OPERADOR') || n.includes('OPERADORA')) {
            current.operador = extract(line, 'OPERADOR');
        } else if (n.includes('PLAN')) {
            current.plan = extract(line, 'PLAN');
        } else if (n.includes('PERIODO')) {
            current.periodo = extract(line, 'PERIODO');
        }
    }
    if (current) entries.push(current);
    return entries;
}
console.log(parseTelpUnified(rawText));
