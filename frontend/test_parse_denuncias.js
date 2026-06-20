const parseDenuncias = (rawText) => {
    if (!rawText) return [];
    
    const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
    const denuncias = [];
    let currentDenuncia = null;
    
    for (const line of lines) {
        const cleanLine = line.replace(/[*_`]/g, '').trim();
        
        if (cleanLine.includes('INFOR DATA') || cleanLine.includes('DENUNCIA POLICIAL')) continue;
        if (cleanLine.includes('CUENTA:') || cleanLine.includes('USUARIO:')) continue;
        if (cleanLine.includes('CRÉDITOS :') || cleanLine.includes('Usuario :') || cleanLine.includes('La consulta se hizo')) continue;
        if (cleanLine.startsWith('➤ #')) continue;
        
        if (/^\d+\.\s*(TIPO|PLACA)/.test(cleanLine) || cleanLine.match(/DENUNCIA #?\d+/) || cleanLine.includes('ANTECEDENTES PERSONALES -')) {
            if (currentDenuncia) denuncias.push(currentDenuncia);
            currentDenuncia = [];
            
            // Extract number if possible from the header itself
            if (cleanLine.match(/DENUNCIA #?\d+\s*[-—]\s*(.+)/)) {
                 const m = cleanLine.match(/DENUNCIA #?\d+\s*[-—]\s*(N°)?\s*(.+)/);
                 if (m && m[2]) {
                     let val = m[2].trim();
                     if (val.match(/^\d+$/)) { // If it's just numbers, it's probably the DNI/Placa/Denuncia No.
                         // Only push if it doesn't already exist and we're sure it's the number
                         // Let's just push it as "DNI / N°"
                         currentDenuncia.push({ label: 'REF', value: val, icon: 'tag' });
                     }
                 }
            }
        } else if (!currentDenuncia && cleanLine.includes('ANTECEDENTES - ONLINE')) {
            currentDenuncia = [];
        } else if (!currentDenuncia && (cleanLine.includes('➔') || cleanLine.includes(':'))) {
            currentDenuncia = [];
        }
        
        if (currentDenuncia) {
            let parts = cleanLine.split('➔');
            if (parts.length < 2) parts = cleanLine.split(':');
            
            if (parts.length >= 2) {
                let label = parts[0].replace(/^[➔▶\d.\s]+/, '').trim();
                let value = parts.slice(1).join('➔').trim();
                if (value.startsWith('—')) value = value.substring(1).trim();
                if (value.startsWith('-')) value = value.substring(1).trim();
                
                let icon = 'info';
                const labelUpper = label.toUpperCase();
                if (labelUpper.includes('TIPO')) icon = 'category';
                else if (labelUpper.includes('DNI') || labelUpper.includes('NOMBRE') || labelUpper.includes('PADRE') || labelUpper.includes('MADRE')) icon = 'badge';
                else if (labelUpper.includes('PLACA')) icon = 'directions_car';
                else if (labelUpper.includes('LUGAR')) icon = 'location_on';
                else if (labelUpper.includes('COMISARÍA') || labelUpper.includes('COMISARIA')) icon = 'local_police';
                else if (labelUpper.includes('HECHO') || labelUpper.includes('FECHA') || labelUpper.includes('NACIMIENTO')) icon = 'event';
                else if (labelUpper.includes('CLAVE')) icon = 'key';
                
                currentDenuncia.push({ label, value, icon });
            } else if (!cleanLine.match(/DENUNCIA #?\d+/) && cleanLine.length > 5) {
                 // Standalone value line like "INTERVENCION POLICIALES"
                 if (currentDenuncia.length > 0 && currentDenuncia[0].label === 'REF') {
                     // Probably the description
                     currentDenuncia.push({ label: 'TIPO', value: cleanLine, icon: 'category' });
                 }
            }
        }
    }
    if (currentDenuncia) denuncias.push(currentDenuncia);
    
    return denuncias;
};

console.log(parseDenuncias(`[ #INFOR DATA ☁️ ]

➤ #ANTEPER
ANTECEDENTES PERSONALES - 10001088 -

DNI : 10001088
NOMBRE : FUJIMORI HIGUCHI, KEIKO SOFIA
NACIMIENTO : 25-05-1975
LUGAR : LIMA
PADRE : ALBERTO
MADRE : SUSANA
TALLA : 162 cm
CONTEXTURA : GRUESA
TIPO DOC : DNI
REGISTRO : TARJETA

USUARIO : 8287794268
CRÉDITOS : ♾️
Usuario : Ivi`));

console.log(parseDenuncias(`[ #INFOR DATA ☁️ ]

➤ #SIDPOLPDF
DENUNCIA #1 - 10001088

N° DENUNCIA : 00611140
FECHA : 17/01/2011 17:20:24 Hrs.
TIPO : HECHOS DE INTERES POLICIAL/INTERVENCION POLICIALES/CONSTATACION POLICIAL EFECTUA

USUARIO : 8287794268
CRÉDITOS : ♾️`));

console.log(parseDenuncias(`[ #INFOR DATA ☁️ ]

➤ #SIDPLA SIDPOL VEHÍCULO PDF - AGV544

PLACA : AGV544
TOTAL DENUNCIAS : 2

➤ CONSULTADO POR:
Usuario : Ivi
CRÉDITOS : ♾️

DENUNCIA 2 — N° 19210382
INTERVENCION POLICIALES`));
