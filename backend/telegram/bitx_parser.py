"""
telegram/bitx_parser.py
───────────────────────
Parser de las respuestas de @Bitxdatabot.

FORMATO REAL DEL BOT (verificado contra la API)
───────────────────────────────────────────────
Cabecera::

    **⟨ ****#BITX**** DATA BOT  ⟩ ➟ RENIEC ONLINE NV 3 (PREMIUM)**

Secciones entre corchetes con emoji::

    **[ 👤 DATOS PERSONALES ]**
    **[ 🎂 NACIMIENTO ]**
    **[ 📋 INFORMACIÓN GENERAL ]**
    **[ 🏠 DOMICILIO ]**
    **[ ♦️ UBIGEOS ]**

Campos: ``• **CLAVE** ➮ `valor``` (separador ➮ = U+27AE)

Sub-campos (listas, p. ej. líneas de teléfono o integrantes del hogar)::

    • **NÚMERO [1]** ➮ `968500799`
      ├ **Operador** ➮ `MOVISTAR`
      ├ **Periodo** ➮ `2023/06`
      └ **Estado** ➮ `ACTIVO`

Pie que hay que descartar::

    **CUENTA:** `∞` | **ID:** `8287794268`
    **USUARIO:** [Ivi](tg://user?id=8287794268)

DIFERENCIAS CON EL PARSER ANTIGUO
─────────────────────────────────
El parser anterior (``parser.py``) buscaba el separador ``➾`` y una lista de
palabras a ignorar. BitxData usa ``➮``, envuelve todo en ``**`` e intercala
secciones con emoji dentro de ``[ ]``. Por eso se escribe este parser aparte:
``parser.py`` se queda intacto para el pool de bots gratis.
"""

from __future__ import annotations

import re

# ── Separadores que usa el bot ────────────────────────────────────────────────
# ➮ (U+27AE) es el principal; se aceptan variantes por si el bot cambia.
_SEP = r"[➮➾➜➟➣❯⟹⟾→>]"

# Línea de campo:  • **CLAVE** ➮ `valor`   (el bullet y las comillas son opcionales)
_FIELD_RE = re.compile(
    r"^\s*[•·▪◦\-\u251c\u2514\u2502]*\s*"      # viñeta / ramas de árbol
    r"\*\*(?P<key>[^*]+?)\*\*"                  # **CLAVE**
    r"\s*" + _SEP + r"\s*"                      # ➮
    r"(?P<value>.+?)\s*$"
)

# Línea de campo sin negritas:  • DNI ➮ `12345678`
_FIELD_PLAIN_RE = re.compile(
    r"^\s*[•·▪◦\-\u251c\u2514\u2502]*\s*"
    r"(?P<key>[A-ZÁÉÍÓÚÑ0-9][^➮➾➜➟➣❯⟹⟾→]{1,40}?)"
    r"\s*" + _SEP + r"\s*"
    r"(?P<value>.+?)\s*$"
)

# Elemento de lista sin valor:  • **INTEGRANTE [1]**
_ITEM_ONLY_RE = re.compile(
    r"^\s*[•·▪◦\-\u251c\u2514\u2502]*\s*\*\*(?P<key>[^*]+?)\*\*\s*$"
)

# Encabezado de sección:  **[ 👤 DATOS PERSONALES ]**
_SECTION_RE = re.compile(r"^\s*\*\*\[\s*(?P<name>[^\]]+?)\s*\]\*\*\s*$")

# Título del reporte:  **⟨ ****#BITX**** DATA BOT ⟩ ➟ RENIEC FULL BIOMETRÍA**
# También:  🖼 ⟨ #BITX DATA BOT 🧬 ⟩ ➟ REPORTE FACIAL   (con icono y emoji previos)
_TITLE_RE = re.compile(
    r"#BITX\W*DATA\W*BOT[^\n➮➾➜➟➣❯⟹⟾→]{0,12}"
    + _SEP + r"\s*(?P<title>[^\n]+?)\s*$"
)

# Líneas de pie que no son datos
_FOOTER_RE = re.compile(
    r"^\s*\*\*(CUENTA|USUARIO|ID)\s*:?\*\*",
    re.IGNORECASE,
)

# Mensajes de progreso del bot (no son resultado)
_PROGRESS_RE = re.compile(
    r"(⏳|GENERANDO|Procesando|por favor espera|Compilando|Aprox)",
    re.IGNORECASE,
)


def _clean_value(value: str) -> str:
    """Quita backticks, negritas y espacios sobrantes de un valor."""
    value = value.strip()
    value = value.replace("`", "")
    value = value.replace("**", "")
    value = value.replace("__", "")
    return value.strip()


def _norm_key(key: str) -> str:
    """
    Normaliza la clave a minúsculas y con guiones bajos.

    ``F. NACIMIENTO`` → ``f_nacimiento``
    ``AP. PATERNO``   → ``ap_paterno``
    ``NÚMERO [1]``    → ``numero_1``
    """
    key = key.strip().lower()
    key = key.replace(".", "")
    key = re.sub(r"\[(\d+)\]", r"_\1", key)     # NÚMERO [1] → numero_1
    key = re.sub(r"[áàâã]", "a", key)
    key = re.sub(r"[éèê]", "e", key)
    key = re.sub(r"[íìî]", "i", key)
    key = re.sub(r"[óòôõ]", "o", key)
    key = re.sub(r"[úùû]", "u", key)
    key = re.sub(r"[^a-z0-9]+", "_", key)
    return key.strip("_")


def is_progress_message(text: str) -> bool:
    """
    True si el mensaje es un aviso de "generando/procesando" y no un resultado.

    El bot manda un mensaje ``⏳ GENERANDO DNI VIRTUAL (AZUL) :`` y el
    resultado real llega 20-50 s después. Hay que ignorar el primero.
    """
    if not text:
        return False
    # El mensaje de progreso es corto y no tiene campos ➮
    if "➮" in text:
        return False
    return bool(_PROGRESS_RE.search(text))


def is_sin_resultados(text: str) -> bool:
    """Detecta los mensajes de 'sin resultados' de BitxData."""
    if not text:
        return False
    up = text.upper()
    return any(t in up for t in (
        "SIN RESULTADOS",
        "NO SE ENCONTRARON DATOS",
        "NO SE ENCONTRO",
        "NO EXISTE",
        "CRÉDITOS NO DESCONTADOS",
        "FORMATO VALIDO",
        "FORMATO VÁLIDO",
        "ES INCORRECTO",
    ))


def mensaje_legible(text: str) -> str:
    """
    Convierte un mensaje crudo del bot en un texto limpio para el usuario final.

    El bot envuelve todo en ``**`` y mete su propio encabezado. Ejemplo de
    entrada::

        **『 ****#BITX**** DATA BOT 』 ➟ ****#DENUNCIAS**

        **「❌️」 Sin Resultados. No se encontraron datos disponibles para el DNI 12345678.**

    Salida::

        Sin Resultados. No se encontraron datos disponibles para el DNI 12345678.
    """
    if not text:
        return "No se encontraron resultados."

    limpio = text.replace("**", "").replace("__", "").replace("`", "")

    # Quitamos las líneas de cabecera y de cuenta del bot
    lineas = []
    for linea in limpio.split("\n"):
        l = linea.strip()
        if not l:
            continue
        up = l.upper()
        if "#BITX" in up:
            continue
        if up.startswith("CUENTA:") or up.startswith("USUARIO:"):
            continue
        # Quitamos el prefijo de icono tipo 「❌️」
        l = re.sub(r"^[「『\[\(]\s*[^\w\s]{1,3}\s*[」』\]\)]?\s*", "", l).strip()
        if l:
            lineas.append(l)

    resultado = " ".join(lineas).strip()
    return resultado or "No se encontraron resultados."


class BitxParsed(dict):
    """Resultado del parser: dict con acceso por atributo para comodidad."""

    def __getattr__(self, item):
        try:
            return self[item]
        except KeyError as exc:
            raise AttributeError(item) from exc


def parse_bitx_response(text: str) -> BitxParsed:
    """
    Convierte la respuesta de texto de BitxData en un dict normalizado.

    Estructura devuelta::

        {
          "_title": "RENIEC FULL BIOMETRÍA",
          "_sections": {"datos_personales": {...}, "nacimiento": {...}},
          "dni": "72928277-0",
          "nombres": "YERFESON ISAAC",
          "apellidos": "VILLEGAS DIAZ",
          "f_nacimiento": "15/05/2005",
          ...
          "lineas": [{"numero_1": "968500799", "operador": "MOVISTAR"}, ...],
          "raw_text": "<texto original>",
        }

    Los campos repetidos en varias secciones se guardan con prefijo de sección
    (``nacimiento_departamento``) para no pisarse con los de domicilio.
    """
    result = BitxParsed()
    result["_sections"] = {}
    result["raw_text"] = text or ""

    if not text:
        return result

    current_section: str | None = None
    # Sub-listas: clave del elemento raíz → dict en construcción
    current_item: dict | None = None
    current_item_key: str | None = None

    for raw_line in text.split("\n"):
        line = raw_line.rstrip()

        if not line.strip():
            continue

        # Pie de página
        if _FOOTER_RE.match(line):
            continue

        # Encabezado de sección
        sec = _SECTION_RE.match(line)
        if sec:
            current_section = _norm_key(sec.group("name"))
            # El nombre puede traer emoji; nos quedamos con las palabras
            current_section = re.sub(r"^[^a-z]+", "", current_section)
            result["_sections"].setdefault(current_section, {})
            current_item, current_item_key = None, None
            continue

        # Título
        if "#BITX" in line:
            title = _TITLE_RE.search(line)
            if title:
                result["_title"] = _clean_value(title.group("title"))
            continue

        # Campo (con o sin negritas)
        match = _FIELD_RE.match(line) or _FIELD_PLAIN_RE.match(line)

        # Elemento de lista sin valor:  • **INTEGRANTE [1]**
        if not match:
            only = _ITEM_ONLY_RE.match(line)
            if only:
                key = _norm_key(only.group("key"))
                item_match = re.match(r"^(numero|integrante|campo|registro)_(\d+)$", key)
                if item_match:
                    base = item_match.group(1)
                    current_item = {key: ""}
                    current_item_key = base + "s"
                    result.setdefault(current_item_key, []).append(current_item)
                    continue
            continue

        key = _norm_key(match.group("key"))
        value = _clean_value(match.group("value"))

        if not key or not value:
            continue

        # ── Detectar elemento de lista (NÚMERO [n], INTEGRANTE [n]) ──────────
        item_match = re.match(r"^(numero|integrante|campo|registro)_(\d+)$", key)
        if item_match:
            base = item_match.group(1)
            # Se guarda el valor tanto con su clave original (numero_1) como con
            # la clave corta (numero) para que el consumidor elija.
            current_item = {key: value, base: value}
            current_item_key = base + "s"          # numero → numeros
            result.setdefault(current_item_key, []).append(current_item)
            continue

        # ── Sub-campo de una lista (Operador, Periodo, Estado, NOMBRE...) ────
        if current_item is not None and current_section and _is_subfield(key):
            current_item[key] = value
            continue

        # ── Campo normal ─────────────────────────────────────────────────────
        store = result["_sections"].setdefault(current_section or "_root", {})
        store.setdefault(key, value)

        # En la raíz también, pero sin pisar entre secciones
        if key not in result:
            result[key] = value
        else:
            section_key = f"{current_section}_{key}" if current_section else key
            result.setdefault(section_key, value)

    # Alias finales que consume el frontend (fecha_nacimiento, documento, ...)
    _apply_aliases(result)

    return result


# Claves que, tras un elemento de lista, son sub-campos suyos y no campos raíz
_SUBFIELDS = {
    "operador", "periodo", "estado", "nombre", "nombres", "dni",
    "nacimiento", "sexo", "edad", "verificacion", "clasificacion",
}


def _is_subfield(key: str) -> bool:
    return key in _SUBFIELDS


# ── Alias: nombre del bot → nombre que espera el frontend ────────────────────
# BitxData usa abreviaturas (F. NACIMIENTO → f_nacimiento) mientras que el
# frontend (ResultCard.jsx) espera fecha_nacimiento, documento, etc.
# Sin este mapa, la tarjeta muestra "-" en todos los campos de fecha/DNI.
_FIELD_ALIASES: dict[str, str] = {
    "f_nacimiento":  "fecha_nacimiento",
    "f_emision":     "fecha_emision",
    "f_inscripcion": "fecha_inscripcion",
    "f_caducidad":   "fecha_caducidad",
    "dni":           "documento",
    "documento":     "documento",
    "ap_paterno":    "apellido_paterno",
    "ap_materno":    "apellido_materno",
    "genero":        "genero",
    "sexo":          "genero",
    "domicilio":     "direccion",
    # Información general
    "instruccion":     "grado_instruccion",
    "grado_inst":      "grado_instruccion",
    "donante_org":     "donacion_organos",
    "organos":         "donacion_organos",
    # Ubigeos: el bot usa "UBI. RENIEC" → ubi_reniec; el frontend ubigeo_reniec
    "ubi_reniec":    "ubigeo_reniec",
    "ubi_inei":      "ubigeo_inei",
    "ubi_sunat":     "ubigeo_sunat",
    "ubi_nac":       "ubigeo_nac",
}


def _apply_aliases(data: dict) -> None:
    """
    Añade a ``data`` los alias que espera el frontend, sin borrar los originales.

    Se ejecuta al final del parseo. Solo añade si el alias no existe ya, para
    no pisar un valor explícito del bot.
    """
    for origen, destino in _FIELD_ALIASES.items():
        if origen in data and destino not in data:
            data[destino] = data[origen]

    # "APELLIDOS" combinado → el frontend espera `apellidos`
    if "apellidos" not in data and "apellido_paterno" in data:
        paterno = data.get("apellido_paterno", "")
        materno = data.get("apellido_materno", "")
        combinado = f"{paterno} {materno}".strip()
        if combinado:
            data["apellidos"] = combinado

    # Restricciones: el frontend usa `restriccion` y `restricciones`
    if "restriccion" in data:
        data.setdefault("restricciones", data["restriccion"])

    # Las secciones también llevan alias (nacimiento_departamento, etc.)
    # El frontend busca "nacimiento_departamento"; el parser guarda la sección
    # como "nacimiento" y el campo suelto como "departamento".
    for seccion, campos in list(data.get("_sections", {}).items()):
        for clave, valor in list(campos.items()):
            alias = _FIELD_ALIASES.get(clave, clave)
            data.setdefault(f"{seccion}_{alias}", valor)


def flatten_sections(parsed: BitxParsed) -> BitxParsed:
    """
    Aplana los campos de todas las secciones al nivel raíz con prefijo.

    Útil para alimentar componentes del frontend que esperan un dict plano.
    """
    flat = BitxParsed(parsed)
    for section, fields in parsed.get("_sections", {}).items():
        for key, value in fields.items():
            flat.setdefault(f"{section}_{key}", value)
    return flat


# ── Listado completo desde el .txt adjunto ────────────────────────────────────
# El bot trunca el mensaje con "...y N línea(s) más" y manda el listado
# completo en un archivo de texto. Formato real:
#
#   REPORTE COMPLETO DE LÍNEAS
#   ================================
#   DNI: 72928276
#   TITULAR: VILLEGAS DIAZ LUIS HUMBERTO
#   TOTAL: 6 lineas
#   ================================
#
#   [1] NUMERO: 900583698
#       OPERADOR: MOVISTAR
#       PERIODO: 2023/06
#   ------------------------------
_ITEM_RE = re.compile(r"^\[(\d+)\]\s*NUMERO:\s*(\S+)", re.IGNORECASE)
_SUBFIELD_RE = re.compile(r"^\s+(OPERADOR|PERIODO|ESTADO|PLAN):\s*(.+?)\s*$", re.IGNORECASE)
_HEADER_RE = re.compile(r"^(DNI|TITULAR|TOTAL):\s*(.+?)\s*$", re.IGNORECASE)


def parse_lineas_txt(content: str) -> dict:
    """
    Parsea el .txt de líneas que adjunta @Bitxdatabot.

    Returns:
        {"dni": str, "titular": str, "total": int, "numeros": [dict, ...]}
    """
    out: dict = {"dni": "", "titular": "", "total": 0, "numeros": []}
    if not content:
        return out

    actual: dict | None = None
    for raw in content.split("\n"):
        line = raw.rstrip()

        h = _HEADER_RE.match(line.strip())
        if h:
            clave = h.group(1).lower()
            valor = h.group(2).strip()
            if clave == "total":
                try:
                    out["total"] = int(re.sub(r"\D", "", valor) or 0)
                except ValueError:
                    pass
            else:
                out[clave] = valor
            continue

        item = _ITEM_RE.match(line.strip())
        if item:
            if actual:
                out["numeros"].append(actual)
            actual = {
                "numero": item.group(2).strip(),
                "operador": "",
                "periodo": "",
                "estado": "",
            }
            continue

        if actual:
            sub = _SUBFIELD_RE.match(line)
            if sub:
                actual[sub.group(1).lower()] = sub.group(2).strip()

    if actual:
        out["numeros"].append(actual)

    if not out["total"]:
        out["total"] = len(out["numeros"])
    return out


def merge_numeros(parsed: dict, txt_data: dict) -> list[dict]:
    """
    Une los números del mensaje con los del .txt, sin duplicados.

    El .txt suele tener la lista completa; el mensaje puede venir truncado.
    Se conserva el orden del .txt y se rellenan huecos con los del mensaje.
    """
    vistos: set[str] = set()
    resultado: list[dict] = []

    for fuente in (txt_data.get("numeros", []), parsed.get("numeros", [])):
        for n in fuente:
            num = n.get("numero") or n.get("telefono") or ""
            # Los items del mensaje traen claves tipo numero_1
            if not num:
                for k, v in n.items():
                    if k.startswith("numero") and str(v).isdigit():
                        num = str(v)
                        break
            if not num or num in vistos:
                continue
            vistos.add(num)
            resultado.append({
                "numero": num,
                "operador": n.get("operador", ""),
                "periodo": n.get("periodo", ""),
                "estado": n.get("estado", ""),
            })

    return resultado
