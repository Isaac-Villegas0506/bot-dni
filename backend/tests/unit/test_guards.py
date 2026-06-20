"""
tests/unit/test_guards.py
─────────────────────────
Tests unitarios para telegram/guards.py

Ejecutar desde backend/:
    python -m pytest tests/unit/test_guards.py -v

No requiere Telegram, red, ni base de datos.
"""

import sys
import os

# Asegurar que backend/ esté en sys.path al correr con pytest desde cualquier CWD
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

import pytest
from telegram.guards import check_antispam, is_sin_resultados, is_waiting_message


# ── check_antispam ─────────────────────────────────────────────────────────────

class TestCheckAntispam:
    """Tests para check_antispam()."""

    def test_retorna_none_para_texto_normal(self):
        assert check_antispam("NOMBRES: JUAN PEREZ") is None

    def test_retorna_none_para_texto_vacio(self):
        assert check_antispam("") is None

    def test_detecta_antispam_con_segundos(self):
        texto = "Anti-spam activado. Debes esperar 15.5s para continuar."
        resultado = check_antispam(texto)
        assert resultado is not None
        assert "15.5" in resultado
        assert "ESPERA" in resultado

    def test_detecta_antispam_sin_segundos(self):
        texto = "Anti-spam activado. Por favor espera."
        resultado = check_antispam(texto)
        assert resultado is not None
        assert "ESPERA" in resultado

    def test_detecta_debes_esperar(self):
        texto = "Debes esperar 30s antes de continuar."
        resultado = check_antispam(texto)
        assert resultado is not None
        assert "30" in resultado

    def test_case_insensitive(self):
        texto = "ANTI-SPAM ACTIVADO. DEBES ESPERAR 10s"
        resultado = check_antispam(texto)
        assert resultado is not None

    def test_segundos_enteros(self):
        texto = "anti-spam: debes esperar 5s"
        resultado = check_antispam(texto)
        assert resultado is not None
        assert "5" in resultado

    def test_no_detecta_texto_sin_antispam_ni_espera(self):
        textos_normales = [
            "NOMBRES: MARIA GARCIA",
            "DOCUMENTO: 12345678",
            "FECHA NACIMIENTO: 01/01/1990",
            "Sin resultados para tu consulta.",
        ]
        for texto in textos_normales:
            assert check_antispam(texto) is None, f"Falso positivo para: {texto!r}"


# ── is_sin_resultados ──────────────────────────────────────────────────────────

class TestIsSinResultados:
    """Tests para is_sin_resultados()."""

    def test_retorna_false_para_texto_vacio(self):
        assert is_sin_resultados("") is False

    def test_retorna_false_para_texto_normal(self):
        assert is_sin_resultados("NOMBRES: CARLOS LOPEZ") is False

    def test_detecta_sin_resultados_exacto(self):
        assert is_sin_resultados("「❌️」SIN RESULTADOS. Verifique sus datos.") is True

    def test_detecta_sin_resultados_minusculas(self):
        assert is_sin_resultados("sin resultados para este dni") is True

    def test_detecta_registro_vacio(self):
        assert is_sin_resultados("REGISTRO VACÍO") is True

    def test_detecta_no_se_encontro_informacion(self):
        assert is_sin_resultados("NO SE ENCONTRÓ INFORMACIÓN") is True

    def test_detecta_dni_no_encontrado(self):
        assert is_sin_resultados("DNI NO ENCONTRADO") is True

    def test_detecta_no_existe_en_base_de_datos(self):
        assert is_sin_resultados("NO EXISTE EN LA BASE DE DATOS") is True

    def test_detecta_creditos_no_descontados(self):
        assert is_sin_resultados("CRÉDITOS NO DESCONTADOS") is True

    def test_detecta_verifique_los_datos(self):
        assert is_sin_resultados("VERIFIQUE LOS DATOS E INTENTE NUEVAMENTE") is True

    def test_no_detecta_texto_con_datos_reales(self):
        textos_con_datos = [
            "NOMBRES: ANA MARTINEZ\nAPELLIDOS: GOMEZ TORRES",
            "DOCUMENTO: 45678901\nFECHA: 15/03/1985",
            "TELEFONOS PREMIUM\nLINEA 1: 987654321",
        ]
        for texto in textos_con_datos:
            assert not is_sin_resultados(texto), f"Falso positivo para: {texto!r}"

    def test_detecta_registro_vacio_unicode(self):
        # Versión con caracteres unicode tipo bot
        assert is_sin_resultados("ʀᴇɢɪsᴛʀᴏ ᴠᴀᴄɪᴏ") is True


# ── is_waiting_message ─────────────────────────────────────────────────────────

class TestIsWaitingMessage:
    """Tests para is_waiting_message()."""

    def test_retorna_false_para_texto_vacio(self):
        assert is_waiting_message("") is False

    def test_retorna_false_para_texto_normal(self):
        assert is_waiting_message("NOMBRES: PEDRO RAMIREZ") is False

    def test_detecta_procesando(self):
        assert is_waiting_message("⏳ Procesando tu consulta...") is True

    def test_detecta_buscando(self):
        assert is_waiting_message("Buscando información en la base de datos...") is True

    def test_detecta_cargando(self):
        assert is_waiting_message("Cargando datos...") is True

    def test_detecta_espere(self):
        assert is_waiting_message("Por favor espere un momento") is True

    def test_detecta_analizando(self):
        assert is_waiting_message("Analizando la imagen...") is True

    def test_detecta_wait(self):
        assert is_waiting_message("Please wait...") is True

    def test_detecta_moment(self):
        assert is_waiting_message("Just a moment please") is True

    def test_detecta_recopilando(self):
        assert is_waiting_message("Recopilando información...") is True

    def test_case_insensitive(self):
        assert is_waiting_message("PROCESANDO TU CONSULTA") is True
        assert is_waiting_message("BUSCANDO DATOS") is True


# ── Integración mínima ─────────────────────────────────────────────────────────

class TestGuardsIntegration:
    """Verifica que las funciones no colisionan entre sí."""

    def test_antispam_no_es_sin_resultados(self):
        texto_antispam = "Anti-spam activado. Debes esperar 15.5s"
        assert check_antispam(texto_antispam) is not None
        # El mensaje de anti-spam no debe disparar is_sin_resultados
        assert not is_sin_resultados(texto_antispam)

    def test_sin_resultados_no_es_waiting(self):
        texto_sin_res = "SIN RESULTADOS. Verifique los datos."
        assert is_sin_resultados(texto_sin_res) is True
        assert not is_waiting_message(texto_sin_res)

    def test_texto_real_datos_pasa_todos_los_guards(self):
        texto_datos = (
            "✅ CONSULTA DNI\n"
            "NOMBRES: JUAN CARLOS\n"
            "APELLIDOS: PEREZ GOMEZ\n"
            "DOCUMENTO: 12345678\n"
            "FECHA NACIMIENTO: 01/01/1990\n"
        )
        assert check_antispam(texto_datos) is None
        assert not is_sin_resultados(texto_datos)
        assert not is_waiting_message(texto_datos)
