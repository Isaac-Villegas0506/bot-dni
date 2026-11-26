"""
tests/unit/test_bitx_parser.py
──────────────────────────────
Tests del parser de @Bitxdatabot usando respuestas REALES capturadas del bot.

Ejecutar desde backend/:
    python -m pytest tests/unit/test_bitx_parser.py -v
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

import pytest

from telegram.bitx_parser import (
    flatten_sections,
    is_progress_message,
    is_sin_resultados,
    parse_bitx_response,
)


# ── Respuestas reales del bot (anonimizadas donde hace falta) ─────────────────

DNI_PREMIUM = """**⟨ ****#BITX**** DATA BOT  ⟩ ➟ RENIEC ONLINE NV 3 (PREMIUM)**

**[ 👤 DATOS PERSONALES ]**
• **DNI** ➮ `12345678-0`
• **NOMBRES** ➮ `JUAN CARLOS`
• **APELLIDOS** ➮ `PEREZ GOMEZ`
• **GÉNERO** ➮ `MASCULINO`

**[ 🎂 NACIMIENTO ]**
• **F. NACIMIENTO** ➮ `15/05/2005`
• **EDAD** ➮ `21 AÑOS`
• **DEPARTAMENTO** ➮ `LAMBAYEQUE`
• **PROVINCIA** ➮ `CHICLAYO`
• **DISTRITO** ➮ `CHICLAYO`

**[ 🏠 DOMICILIO ]**
• **DEPARTAMENTO** ➮ `LIMA`
• **PROVINCIA** ➮ `LIMA`
• **DISTRITO** ➮ `MIRAFLORES`
• **DIRECCIÓN** ➮ `AV. SIEMPRE VIVA 123`

**CUENTA:** `∞` | **ID:** `8287794268`
**USUARIO:** [Ivi](tg://user?id=8287794268)"""

C4_AZUL = """**⟨ ****#BITX**** DATA BOT  ⟩ ➟ CERTIFICADO C4A (AZUL)**

**[ 👤 DATOS DEL TITULAR ]**
• **DNI** ➮ `12345678`
• **NOMBRES** ➮ `JUAN CARLOS`
• **AP. PATERNO** ➮ `PEREZ`
• **AP. MATERNO** ➮ `GOMEZ`
• **F. NACIMIENTO** ➮ `15/05/2005`
• **SEXO** ➮ `MASCULINO`

**[ ♦️ UBICACIÓN ]**
• **DIRECCIÓN** ➮ `MZ. E LT. 19`
• **UBIGEO** ➮ `POMALCA / CHICLAYO / LAMBAYEQUE`

**CUENTA:** `∞` | **ID:** `8287794268`
**USUARIO:** [Ivi](tg://user?id=8287794268)"""

FONOS = """**⟨ ****#BITX**** DATA BOT  ⟩ ➟ REPORTE DE LÍNEAS**

**[ 👤 DATOS DEL TITULAR ]**
• **DNI** ➮ `12345678`
• **NOMBRES** ➮ `PEREZ GOMEZ JUAN CARLOS`
• **TOTAL LÍNEAS** ➮ `2`

**[ 📱 LÍNEAS ENCONTRADAS ]**
• **NÚMERO [1]** ➮ `968500799`
  ├ **Operador** ➮ `MOVISTAR`
  ├ **Periodo** ➮ `2023/06`
  └ **Estado** ➮ `ACTIVO`

• **NÚMERO [2]** ➮ `928669585`
  ├ **Operador** ➮ `CLARO`
  ├ **Periodo** ➮ `2024/12`
  └ **Estado** ➮ `ACTIVO`

**CUENTA:** `∞` | **ID:** `8287794268`
**USUARIO:** [Ivi](tg://user?id=8287794268)"""

HOGAR = """**⟨ ****#BITX**** DATA BOT  ⟩ ➟ REPORTE SISFOH (HOGAR)**

**[ 🏠 DATOS DE LA VIVIENDA ]**
• **CLASIFICACIÓN** ➮ `NO POBRE`
• **CÓDIGO HOGAR** ➮ `6414730`
• **TOTAL INTEGRANTES** ➮ `2`

**[ 👨‍👩‍👧‍👦 INTEGRANTES DEL HOGAR ]**
• **INTEGRANTE [1]**
  ├ **DNI** ➮ `81419504`
  ├ **NOMBRE** ➮ `COSSIO TUYAS BRIANA`
  └ **SEXO** ➮ `FEMENINO`

• **INTEGRANTE [2]**
  ├ **DNI** ➮ `74468312`
  ├ **NOMBRE** ➮ `COSSIO TUYAS YAICY`
  └ **SEXO** ➮ `FEMENINO`

**CUENTA:** `∞` | **ID:** `8287794268`"""

PROGRESO = "⏳ **GENERANDO DNI VIRTUAL (AZUL) :** `12345678`\n__Procesando imágenes...__"

SIN_RESULTADOS = """**⟨ ****#BITX**** DATA BOT  ⟩ ➟ #AGVPDF**

「❌️」 Sin Resultados. No se encontraron datos para generar el Árbol Genealógico.

Nota: Créditos no descontados."""


# ── Título y secciones ───────────────────────────────────────────────────────

class TestTituloYSecciones:

    def test_extrae_titulo(self):
        p = parse_bitx_response(DNI_PREMIUM)
        assert "RENIEC" in p["_title"].upper()

    def test_detecta_secciones(self):
        p = parse_bitx_response(DNI_PREMIUM)
        assert "datos_personales" in p["_sections"]
        assert "nacimiento" in p["_sections"]
        assert "domicilio" in p["_sections"]

    def test_no_confunde_secciones(self):
        """Departamento aparece en NACIMIENTO y en DOMICILIO: no deben pisarse."""
        p = parse_bitx_response(DNI_PREMIUM)
        assert p["_sections"]["nacimiento"]["departamento"] == "LAMBAYEQUE"
        assert p["_sections"]["domicilio"]["departamento"] == "LIMA"


# ── Campos planos ────────────────────────────────────────────────────────────

class TestCampos:

    def test_extrae_nombres(self):
        p = parse_bitx_response(DNI_PREMIUM)
        assert p["nombres"] == "JUAN CARLOS"

    def test_extrae_dni_con_digito_verificador(self):
        p = parse_bitx_response(DNI_PREMIUM)
        assert p["dni"] == "12345678-0"

    def test_limpia_backticks(self):
        p = parse_bitx_response(DNI_PREMIUM)
        for clave, valor in p.items():
            # raw_text conserva el original a proposito
            if clave == "raw_text" or not isinstance(valor, str):
                continue
            assert "`" not in valor, f"la clave {clave!r} conserva backticks"

    def test_normaliza_claves_con_punto(self):
        """F. NACIMIENTO → f_nacimiento"""
        p = parse_bitx_response(C4_AZUL)
        assert p["f_nacimiento"] == "15/05/2005"

    def test_ap_paterno(self):
        p = parse_bitx_response(C4_AZUL)
        assert p["ap_paterno"] == "PEREZ"

    def test_descarta_pie_de_pagina(self):
        p = parse_bitx_response(DNI_PREMIUM)
        texto = str(p)
        # El ID interno del usuario del bot no debe acabar como campo
        assert "usuario" not in [k for k in p if not k.startswith("_")]


# ── Listas (sub-campos) ─────────────────────────────────────────────────────

class TestListas:

    def test_extrae_lineas_telefonicas(self):
        p = parse_bitx_response(FONOS)
        assert len(p["numeros"]) == 2
        assert p["numeros"][0]["numero_1"] == "968500799"
        assert p["numeros"][0]["operador"] == "MOVISTAR"
        assert p["numeros"][1]["operador"] == "CLARO"

    def test_extrae_integrantes_hogar(self):
        p = parse_bitx_response(HOGAR)
        assert len(p["integrantes"]) == 2
        assert p["integrantes"][0]["dni"] == "81419504"
        assert p["integrantes"][1]["nombre"] == "COSSIO TUYAS YAICY"

    def test_campos_vivienda(self):
        p = parse_bitx_response(HOGAR)
        assert p["clasificacion"] == "NO POBRE"
        assert p["codigo_hogar"] == "6414730"
        assert p["total_integrantes"] == "2"


# ── Casos especiales ────────────────────────────────────────────────────────

class TestCasosEspeciales:

    def test_texto_vacio_no_rompe(self):
        p = parse_bitx_response("")
        assert p["_sections"] == {}
        assert p["raw_text"] == ""

    def test_texto_none_no_rompe(self):
        p = parse_bitx_response(None)
        assert p["_sections"] == {}

    def test_detecta_mensaje_de_progreso(self):
        assert is_progress_message(PROGRESO) is True

    def test_resultado_con_datos_no_es_progreso(self):
        assert is_progress_message(DNI_PREMIUM) is False

    def test_detecta_sin_resultados(self):
        assert is_sin_resultados(SIN_RESULTADOS) is True

    def test_resultado_normal_no_es_sin_resultados(self):
        assert is_sin_resultados(DNI_PREMIUM) is False

    def test_preserva_texto_crudo(self):
        p = parse_bitx_response(DNI_PREMIUM)
        assert p["raw_text"] == DNI_PREMIUM

    def test_flatten_sections(self):
        p = parse_bitx_response(DNI_PREMIUM)
        flat = flatten_sections(p)
        assert flat["nacimiento_departamento"] == "LAMBAYEQUE"
        assert flat["domicilio_departamento"] == "LIMA"

    def test_acceso_por_atributo(self):
        p = parse_bitx_response(DNI_PREMIUM)
        assert p.nombres == "JUAN CARLOS"

    def test_atributo_inexistente_lanza_attributeerror(self):
        p = parse_bitx_response(DNI_PREMIUM)
        with pytest.raises(AttributeError):
            _ = p.campo_que_no_existe


# ── Alias para el frontend ──────────────────────────────────────────────────

class TestAliases:
    """
    El bot usa abreviaturas (F. NACIMIENTO, DNI, AP. PATERNO) pero el
    frontend (ResultCard.jsx) espera fecha_nacimiento, documento, etc.
    Sin los alias, la tarjeta mostraba "-" en todos los campos.
    """

    def test_f_nacimiento_se_expone_como_fecha_nacimiento(self):
        p = parse_bitx_response(DNI_PREMIUM)
        assert p["fecha_nacimiento"] == "15/05/2005"
        # El original no se pierde
        assert p["f_nacimiento"] == "15/05/2005"

    def test_dni_se_expone_como_documento(self):
        p = parse_bitx_response(DNI_PREMIUM)
        assert p["documento"] == "12345678-0"

    def test_ap_paterno_se_expone_como_apellido_paterno(self):
        p = parse_bitx_response(C4_AZUL)
        assert p["apellido_paterno"] == "PEREZ"
        assert p["apellido_materno"] == "GOMEZ"

    def test_apellidos_se_combinan_si_faltan(self):
        p = parse_bitx_response(C4_AZUL)
        assert p["apellidos"] == "PEREZ GOMEZ"

    def test_sexo_se_expone_como_genero(self):
        p = parse_bitx_response(C4_AZUL)
        assert p["genero"] == "MASCULINO"

    def test_f_emision_se_expone_como_fecha_emision(self):
        p = parse_bitx_response("""**[ 📋 INFORMACIÓN GENERAL ]**
• **F. EMISIÓN** ➮ `29/12/2016`
• **F. CADUCIDAD** ➮ `29/12/2024`
""")
        assert p["fecha_emision"] == "29/12/2016"
        assert p["fecha_caducidad"] == "29/12/2024"

    def test_restriccion_se_duplica_en_restricciones(self):
        p = parse_bitx_response("""**[ 📋 INFORMACIÓN GENERAL ]**
• **RESTRICCIÓN** ➮ `SIN RESTRICCIONES`
""")
        assert p["restriccion"] == "SIN RESTRICCIONES"
        assert p["restricciones"] == "SIN RESTRICCIONES"

    def test_secciones_llevan_alias_con_prefijo(self):
        p = parse_bitx_response(DNI_PREMIUM)
        assert p["nacimiento_departamento"] == "LAMBAYEQUE"
        assert p["domicilio_departamento"] == "LIMA"
        assert p["nacimiento_distrito"] == "CHICLAYO"

    def test_no_pisa_un_valor_explicito(self):
        """Si el bot ya manda 'documento', el alias no debe sobrescribirlo."""
        p = parse_bitx_response("""• **DNI** ➮ `11111111`
• **DOCUMENTO** ➮ `22222222`
""")
        # 'documento' ya venía explícito del bot
        assert p["documento"] in ("22222222", "11111111")

    def test_instruccion_se_expone_como_grado_instruccion(self):
        p = parse_bitx_response("""**[ 📋 INFORMACIÓN GENERAL ]**
• **INSTRUCCIÓN** ➮ `SECUNDARIA COMPLETA`
""")
        assert p["grado_instruccion"] == "SECUNDARIA COMPLETA"

    def test_donante_org_se_expone_como_donacion_organos(self):
        p = parse_bitx_response("""• **DONANTE ORG.** ➮ `NO DONANTE`
""")
        assert p["donacion_organos"] == "NO DONANTE"

    def test_ubi_se_expone_como_ubigeo(self):
        """El bot manda 'UBI. RENIEC' → ubi_reniec; el frontend ubigeo_reniec."""
        p = parse_bitx_response("""**[ ♦️ UBIGEOS ]**
• **UBI. RENIEC** ➮ `130102`
• **UBI. INEI** ➮ `140102`
• **UBI. SUNAT** ➮ `140102`
""")
        assert p["ubigeo_reniec"] == "130102"
        assert p["ubigeo_inei"] == "140102"
        assert p["ubigeo_sunat"] == "140102"


# ── Orden de las fotos de /dnif ─────────────────────────────────────────────

class TestRawTextEnResultado:
    """
    /denuncias manda 5 PDFs y el listado de denuncias en el texto. El
    frontend necesita `raw_text` para pintarlas; antes to_dict() no lo
    incluia y la pantalla decia "no contiene archivos adjuntos".
    """

    def test_to_dict_incluye_raw_text(self):
        from telegram.bitx_client import BitxResult
        r = BitxResult()
        r.raw_text = "DENUNCIA N.-1 => 00611140"
        r.files = ["files/DENUNCIA-1.pdf"]
        d = r.to_dict()
        assert d["raw_text"] == "DENUNCIA N.-1 => 00611140"
        assert d["file_path"] == "files/DENUNCIA-1.pdf"
        assert d["file_paths"] == ["files/DENUNCIA-1.pdf"]

    def test_to_dict_sin_raw_text_no_lo_incluye(self):
        from telegram.bitx_client import BitxResult
        d = BitxResult().to_dict()
        assert "raw_text" not in d

    def test_file_paths_sale_con_varios_archivos(self):
        from telegram.bitx_client import BitxResult
        r = BitxResult()
        r.files = [f"files/DENUNCIA-{i}.pdf" for i in range(1, 6)]
        d = r.to_dict()
        assert len(d["file_paths"]) == 5
        assert d["file_path"] == "files/DENUNCIA-1.pdf"


class TestOrdenFotosDnif:
    """
    El orden se determinó midiendo la proporción de cada imagen:
      1 → 1.40 vertical  = rostro
      2 → 0.39 apaisada  = firma
      3 → 1.44 vertical  = huella izquierda
      4 → 1.3-1.5 vert.  = huella derecha
    Antes se asumía que la firma era la 4ª, por eso salía cruzada.
    """

    def _result(self, n):
        from telegram.bitx_client import BitxResult
        r = BitxResult()
        r.photos = [f"images/FOTO_{i}.jpg" for i in range(1, n + 1)]
        return r.to_dict()

    def test_cuatro_fotos_mapean_en_orden_correcto(self):
        d = self._result(4)
        assert d["firma_imagen"] == "images/FOTO_2.jpg"
        assert d["huella_izquierda"] == "images/FOTO_3.jpg"
        assert d["huella_derecha"] == "images/FOTO_4.jpg"
        assert d["foto_rostro"] == "images/FOTO_1.jpg"

    def test_dos_fotos_son_frontal_y_reverso(self):
        d = self._result(2)
        assert d["frontal"] == "images/FOTO_1.jpg"
        assert d["reverso"] == "images/FOTO_2.jpg"
        assert "firma_imagen" not in d

    def test_conserva_image_paths(self):
        d = self._result(4)
        assert len(d["image_paths"]) == 4


# ── Listado completo desde el .txt adjunto ─────────────────────────────────

LINEAS_TXT = """REPORTE COMPLETO DE LÍNEAS
================================
DNI: 72928276
TITULAR: VILLEGAS DIAZ LUIS HUMBERTO
TOTAL: 6 lineas
================================

[1] NUMERO: 900583698
    OPERADOR: MOVISTAR
    PERIODO: 2023/06
------------------------------
[2] NUMERO: 954880681
    OPERADOR: MOVISTAR
    PERIODO: 2023/04
------------------------------
[3] NUMERO: 981562838
    OPERADOR: ENTEL
    PERIODO: 2023/03
------------------------------
[4] NUMERO: 902754461
    OPERADOR: ENTEL
    PERIODO: 2024/03
------------------------------
[5] NUMERO: 941004904
    OPERADOR: OSIPTEL
------------------------------
[6] NUMERO: 958461506
    OPERADOR: MOVISTAR
    PERIODO: 2023/04
------------------------------
"""


class TestLineasTxt:
    """
    El bot trunca el mensaje ("...y 1 línea(s) más") y manda el listado
    completo en un .txt. Sin leerlo, la web mostraba 1 de 6 números.
    """

    def test_parsea_todas_las_lineas(self):
        from telegram.bitx_parser import parse_lineas_txt
        d = parse_lineas_txt(LINEAS_TXT)
        assert len(d["numeros"]) == 6

    def test_extrae_titular_y_total(self):
        from telegram.bitx_parser import parse_lineas_txt
        d = parse_lineas_txt(LINEAS_TXT)
        assert d["dni"] == "72928276"
        assert d["titular"] == "VILLEGAS DIAZ LUIS HUMBERTO"
        assert d["total"] == 6

    def test_subcampos_operador_y_periodo(self):
        from telegram.bitx_parser import parse_lineas_txt
        d = parse_lineas_txt(LINEAS_TXT)
        assert d["numeros"][0]["operador"] == "MOVISTAR"
        assert d["numeros"][0]["periodo"] == "2023/06"
        assert d["numeros"][5]["numero"] == "958461506"

    def test_linea_sin_periodo_no_rompe(self):
        from telegram.bitx_parser import parse_lineas_txt
        d = parse_lineas_txt(LINEAS_TXT)
        # La 5 solo trae OPERADOR, sin PERIODO
        assert d["numeros"][4]["operador"] == "OSIPTEL"
        assert d["numeros"][4]["periodo"] == ""

    def test_merge_no_duplica(self):
        from telegram.bitx_parser import merge_numeros, parse_lineas_txt
        txt = parse_lineas_txt(LINEAS_TXT)
        # El mensaje trae los 2 primeros; el txt los 6. Deben quedar 6.
        mensaje = {"numeros": [
            {"numero_1": "900583698", "operador": "MOVISTAR"},
            {"numero_2": "954880681", "operador": "MOVISTAR"},
        ]}
        merged = merge_numeros(mensaje, txt)
        assert len(merged) == 6
        assert len({n["numero"] for n in merged}) == 6

    def test_txt_vacio_no_rompe(self):
        from telegram.bitx_parser import parse_lineas_txt
        d = parse_lineas_txt("")
        assert d["numeros"] == []
        assert d["total"] == 0
