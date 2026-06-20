import re
import emoji

def parse_bot_response(text):
    """
    Parses the text response from the Telegram bot.
    Expected format: CAMPO ➾ VALOR or **CAMPO** ➾ VALOR
    Removes emojis, decorators, and extracts key fields.
    """
    data = {}
    
    # Frases a ignorar (publicidad, títulos, etc.)
    ignore_phrases = [
        "bot",
        "canal",
        "únete",
        "suscribete",
        "premium",
        "comprar",
        "consulta",
        "búsqueda",
        "resultado",
        "información",
        "datos",
        "---",
        "===",
        "***",
        "powered by",
        "desarrollado",
        "by @",
        "telegram",
        "disponible",
        "versión",
        "@",
        "necesitas más",
        "utiliza el comando",
        "estado de cuenta",
        "creditos",
        "usuario",
        "reniec base",
        "gratis",
        "#secta",
        "#olimpo",
        "#sirius",
        "#sitex",
        "balance",
        "ficha c4",
        "c4azul",
        "descargar",
        "volver",
        "generada con",
        "#c4",
        "#sitexdata",
    ]
    
    # Limpiar el texto primero
    # Eliminar emojis
    text_clean = emoji.replace_emoji(text, replace='')
    
    # Eliminar solo corchetes decorativos cortos (como emojis [🎂])
    text_clean = re.sub(r'\[.{1,3}\]', '', text_clean)
    
    # Eliminar asteriscos de markdown **TEXTO**
    text_clean = re.sub(r'\*\*', '', text_clean)
    
    # Eliminar backticks de markdown `TEXTO` — convertimos a espacios para no unir palabras
    text_clean = re.sub(r'`', '', text_clean)
    
    # Eliminar guiones bajos __TEXTO__
    text_clean = re.sub(r'__', '', text_clean)

    # Eliminar ornamentos (NO ➜ — lo mantenemos como separador)
    text_clean = text_clean.replace('❰', '').replace('❱', '').replace('➟', '').replace('•', '')
    
    # Soporta: ➾, ➜, >, :, -, →, ➺, ❯, ➟, ➣
    pattern = r"([a-záéíóúñA-ZÁÉÍÓÚÑ\s]+)\s*[➾➜>:\-→➺❯➟➣]+\s*(.+)"
    
    current_section = None
    lines = text_clean.split('\n')
    for line in lines:
        line = line.strip()
        
        # Ignorar líneas vacías
        if not line:
            continue
        
        # Detectar si es una línea de datos (coincide con el patrón de llave: valor)
        match = re.search(pattern, line)
        is_data_line = bool(match)
        
        line_upper = line.upper()
        if not is_data_line:
            if "NACIMIENTO" in line_upper:
                current_section = "nacimiento"
                continue
            if "DOMICILIO" in line_upper or "DIRECCIONES" in line_upper or "DIRECCION" in line_upper:
                current_section = "domicilio"
                continue
            if "PADRES" in line_upper or "FILIACION" in line_upper:
                current_section = "padres"
                continue
            if "UBIGEO" in line_upper:
                current_section = "ubigeo"
                continue
            if "DATA" in line_upper or "INFORMACION" in line_upper or "INFO PERSONAL" in line_upper:
                current_section = "data"
                continue

        # Ignorar líneas con frases de publicidad/decoración
        if any(phrase in line.lower() for phrase in ignore_phrases):
            continue
            
        # Ignorar líneas muy cortas (probablemente decorativas)
        if len(line) < 4:
            continue
            
        if match:
            key = match.group(1).strip().lower()
            value = match.group(2).strip()
            
            # Limpiar caracteres especiales del valor
            value = value.replace('|', '').replace('*', '').replace('`', '').strip()
            
            # Ignorar si el valor está vacío después de limpiar
            if not value or value == '-' or value == 'N/A' or value == '0':
                continue
            
            # Ignorar valores que son solo em-dash
            if value.strip() in ('—', '\u2014', '\u2013'):
                continue
            
            # Limpiar valores que sean solo números después del DNI (como "72928277 - 0" → "72928277")
            if ' - ' in value:
                value = value.split(' - ')[0].strip()
            
            # Normalizar el key (remover tildes, espacios -> _, remover puntos)
            key = key.replace(" ", "_").replace(".", "")
            key = re.sub(r'[áàâã]', 'a', key)
            key = re.sub(r'[éèê]', 'e', key)
            key = re.sub(r'[íìî]', 'i', key)
            key = re.sub(r'[óòôõ]', 'o', key)
            key = re.sub(r'[úùû]', 'u', key)
            
            # Map known keys to standardized keys
            key_map = {
                "documento": "documento",
                "dni": "documento",
                "nro_documento": "documento",
                "titular": "nombres",
                "nombres": "nombres",
                "nombre": "nombres",
                "apellidos": "apellidos",
                "apellido_paterno": "apellido_paterno",
                "ap_paterno": "apellido_paterno",
                "apellido_materno": "apellido_materno",
                "ap_materno": "apellido_materno",
                "fecha_de_nacimiento": "fecha_nacimiento",
                "fecha_nacimiento": "fecha_nacimiento",
                "fec_nacimiento": "fecha_nacimiento",
                "f_nacimiento": "fecha_nacimiento",
                "edad": "edad",
                "sexo": "genero",
                "genero": "genero",
                "departamento": "departamento",
                "provincia": "provincia",
                "distrito": "distrito",
                "direccion": "direccion",
                "ubicacion": "direccion",
                "estado_civil": "estado_civil",
                "dni_padre": "dni_padre",
                "padre": "padre",
                "dni_madre": "dni_madre",
                "madre": "madre",
                "fecha_de_emision": "fecha_emision",
                "fecha_emision": "fecha_emision",
                "fecha_de_caducidad": "fecha_caducidad",
                "fecha_caducidad": "fecha_caducidad",
                "fecha_de_inscripcion": "fecha_inscripcion",
                "fecha_inscripcion": "fecha_inscripcion",
                "restriccion": "restricciones",
                "multas": "multas_electorales",
                "reniec": "ubigeo_reniec",
                "inei": "ubigeo_inei",
                "sunat": "ubigeo_sunat",
                "codigo_postal": "codigo_postal",
                "caducidad": "fecha_caducidad",
                "emision": "fecha_emision",
                "inscripcion": "fecha_inscripcion",
                "fecha_fallecimiento": "fecha_fallecimiento",
                "fecha": "fecha_nacimiento",
                "estatura": "estatura",
                "grado_inst": "grado_instruccion",
                "instruccion": "grado_instruccion",
                "organos": "donacion_organos",
                "org": "donacion_organos"
            }
            
            # Clean key to match map
            clean_key = None
            sorted_keys = sorted(key_map.keys(), key=len, reverse=True)
            for k in sorted_keys:
                if k in key:
                    clean_key = key_map[k]
                    break
            
            if clean_key:
                # Distinguir NACIMIENTO vs DOMICILIO
                if current_section == "nacimiento":
                    if clean_key == "departamento": clean_key = "nacimiento_departamento"
                    elif clean_key == "provincia": clean_key = "nacimiento_provincia"
                    elif clean_key == "distrito": clean_key = "nacimiento_distrito"
                
                # Solo agregar si no existe o si es una sección específica (priorizar la primera aparición)
                if clean_key not in data:
                    data[clean_key] = value

    # Combine apellidos if separated, or just keep as is
    if "apellidos" not in data and "apellido_paterno" in data and "apellido_materno" in data:
        data["apellidos"] = f"{data['apellido_paterno']} {data['apellido_materno']}"
    
    # Limpiar "AÑOS" de la edad si existe
    if "edad" in data:
        data["edad"] = data["edad"].replace("AÑOS", "").replace("años", "").strip()

    data["raw_text"] = text
    return data
