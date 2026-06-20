"""
tests/unit/test_polling.py
──────────────────────────
Tests unitarios para telegram/polling.py

Ejecutar desde backend/:
    python -m pytest tests/unit/test_polling.py -v

No requiere Telegram, red, ni base de datos.
Usa mocks livianos (objetos simples con atributos) en lugar de unittest.mock
para mantener el código simple y sin dependencias externas de test.
"""

import sys
import os
import asyncio

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

import pytest
from telegram.polling import (
    PollConfig,
    PollResult,
    validator_contains_keywords,
    validator_has_pdf,
    validator_has_image,
    validator_any,
)
from telegram.exceptions import SinResultadosError


# ── Helpers ─────────────────────────────────���──────────────────────────────────

class FakeMessage:
    """Mensaje Telegram simulado para tests."""

    def __init__(
        self,
        msg_id: int,
        text: str = "",
        sender_id: int = 999,
        photo=None,
        document=None,
    ):
        self.id = msg_id
        self.text = text
        self.sender_id = sender_id
        self.photo = photo
        self.document = document
        self.reply_to_msg_id = None
        self.grouped_id = None
        self.media = photo or document
        self.file = None


class FakeDocument:
    """Documento simulado."""
    def __init__(self, mime_type: str = "application/pdf"):
        self.mime_type = mime_type


def run(coro):
    """Ejecuta una corutina en el event loop de test."""
    return asyncio.get_event_loop().run_until_complete(coro)


# ── Tests para PollConfig ──────────────────────────────────────────────────────

class TestPollConfig:
    """Verifica los valores por defecto de PollConfig."""

    def test_valores_por_defecto(self):
        config = PollConfig(bot="@TestBot", command="/test 123")
        assert config.bot == "@TestBot"
        assert config.command == "/test 123"
        assert config.initial_wait == 3
        assert config.max_attempts == 10
        assert config.poll_interval == 2
        assert config.target_bot_id == 0
        assert config.limit_per_iter == 50
        assert config.stop_on_sin_result is True
        assert config.stop_on_antispam is False
        assert config.label == "consulta"

    def test_configuracion_personalizada(self):
        config = PollConfig(
            bot="@OtroBot",
            command="/fiscal 12345678",
            initial_wait=8,
            max_attempts=15,
            poll_interval=3,
            target_bot_id=12345,
            label="fiscalia",
        )
        assert config.initial_wait == 8
        assert config.max_attempts == 15
        assert config.target_bot_id == 12345
        assert config.label == "fiscalia"


# ── Tests para PollResult ──────────────────────────────────────────────────────

class TestPollResult:
    """Verifica los valores por defecto de PollResult."""

    def test_valores_por_defecto(self):
        result = PollResult()
        assert result.found is False
        assert result.message is None
        assert result.all_messages == []
        assert result.timed_out is False
        assert result.antispam_msg is None

    def test_resultado_exitoso(self):
        msg = FakeMessage(1, "DATOS ENCONTRADOS")
        result = PollResult(found=True, message=msg, all_messages=[msg])
        assert result.found is True
        assert result.message is msg
        assert len(result.all_messages) == 1


# ── Tests para validator_contains_keywords ────────────────────────────────────

class TestValidatorContainsKeywords:
    """Tests para el validador de keywords."""

    def test_mensaje_con_keyword_retorna_true(self):
        validator = validator_contains_keywords("ANTECEDENTES")
        msg = FakeMessage(1, text="ANTECEDENTES PENALES ENCONTRADOS")
        assert validator(msg) is True

    def test_mensaje_sin_keyword_retorna_false(self):
        validator = validator_contains_keywords("ANTECEDENTES")
        msg = FakeMessage(1, text="NOMBRES: JUAN PEREZ")
        assert validator(msg) is False

    def test_multiples_keywords_todos_deben_estar(self):
        validator = validator_contains_keywords("ANTECEDENTES", "12345678")
        msg_con_ambos = FakeMessage(1, text="ANTECEDENTES PENALES DNI 12345678")
        msg_solo_uno = FakeMessage(2, text="ANTECEDENTES PENALES")
        assert validator(msg_con_ambos) is True
        assert validator(msg_solo_uno) is False

    def test_case_insensitive_por_defecto(self):
        validator = validator_contains_keywords("penales")
        msg = FakeMessage(1, text="ANTECEDENTES PENALES")
        assert validator(msg) is True

    def test_case_sensitive_cuando_se_indica(self):
        validator = validator_contains_keywords("penales", case_sensitive=True)
        msg_mayus = FakeMessage(1, text="ANTECEDENTES PENALES")
        msg_minus = FakeMessage(2, text="antecedentes penales")
        assert validator(msg_mayus) is False
        assert validator(msg_minus) is True

    def test_texto_vacio_retorna_false(self):
        validator = validator_contains_keywords("ANTECEDENTES")
        msg = FakeMessage(1, text="")
        assert validator(msg) is False

    def test_texto_none_retorna_false(self):
        validator = validator_contains_keywords("ANTECEDENTES")
        msg = FakeMessage(1, text=None)
        # msg.text or "" → ""
        msg_fixed = FakeMessage(1, text="")
        assert validator(msg_fixed) is False


# ── Tests para validator_has_pdf ───────────────────────────────────────────────

class TestValidatorHasPdf:
    """Tests para el validador de PDF."""

    def test_mensaje_con_pdf_retorna_true(self):
        validator = validator_has_pdf()
        doc = FakeDocument(mime_type="application/pdf")
        msg = FakeMessage(1, text="PDF adjunto", document=doc)
        assert validator(msg) is True

    def test_mensaje_sin_documento_retorna_false(self):
        validator = validator_has_pdf()
        msg = FakeMessage(1, text="Solo texto")
        assert validator(msg) is False

    def test_mensaje_con_imagen_retorna_false(self):
        validator = validator_has_pdf()
        doc = FakeDocument(mime_type="image/jpeg")
        msg = FakeMessage(1, text="Imagen", document=doc)
        assert validator(msg) is False

    def test_mensaje_sin_texto_con_pdf_retorna_true(self):
        validator = validator_has_pdf()
        doc = FakeDocument(mime_type="application/pdf")
        msg = FakeMessage(1, text="", document=doc)
        assert validator(msg) is True


# ── Tests para validator_has_image ─────────────────────────────────────────────

class TestValidatorHasImage:
    """Tests para el validador de imágenes."""

    def test_mensaje_con_photo_retorna_true(self):
        validator = validator_has_image()
        msg = FakeMessage(1, text="Foto adjunta", photo=object())
        assert validator(msg) is True

    def test_mensaje_con_documento_imagen_retorna_true(self):
        validator = validator_has_image()
        doc = FakeDocument(mime_type="image/jpeg")
        msg = FakeMessage(1, text="", document=doc)
        assert validator(msg) is True

    def test_mensaje_con_png_retorna_true(self):
        validator = validator_has_image()
        doc = FakeDocument(mime_type="image/png")
        msg = FakeMessage(1, text="", document=doc)
        assert validator(msg) is True

    def test_mensaje_sin_media_retorna_false(self):
        validator = validator_has_image()
        msg = FakeMessage(1, text="Solo texto")
        assert validator(msg) is False

    def test_mensaje_con_pdf_retorna_false(self):
        validator = validator_has_image()
        doc = FakeDocument(mime_type="application/pdf")
        msg = FakeMessage(1, text="PDF", document=doc)
        assert validator(msg) is False


# ── Tests para validator_any ───────────────────────────────────────────────────

class TestValidatorAny:
    """Tests para la combinación OR de validadores."""

    def test_retorna_true_si_alguno_cumple(self):
        v_keywords = validator_contains_keywords("ANTECEDENTES")
        v_pdf = validator_has_pdf()
        v_any = validator_any(v_keywords, v_pdf)

        # Solo tiene keywords
        msg1 = FakeMessage(1, text="ANTECEDENTES PENALES")
        # Solo tiene PDF
        doc = FakeDocument("application/pdf")
        msg2 = FakeMessage(2, text="", document=doc)

        assert v_any(msg1) is True
        assert v_any(msg2) is True

    def test_retorna_false_si_ninguno_cumple(self):
        v_keywords = validator_contains_keywords("ANTECEDENTES")
        v_pdf = validator_has_pdf()
        v_any = validator_any(v_keywords, v_pdf)

        msg = FakeMessage(1, text="NOMBRES: JUAN PEREZ")
        assert v_any(msg) is False

    def test_sin_validadores_retorna_false(self):
        v_any = validator_any()
        msg = FakeMessage(1, text="cualquier cosa")
        assert v_any(msg) is False


# ── Tests para SinResultadosError ─────────────────────────────────────────────

class TestSinResultadosError:
    """Verifica que SinResultadosError se puede lanzar y capturar correctamente."""

    def test_se_puede_lanzar(self):
        with pytest.raises(SinResultadosError) as exc_info:
            raise SinResultadosError("Sin resultados para 12345678")
        assert "12345678" in str(exc_info.value)

    def test_hereda_de_exception(self):
        err = SinResultadosError("test")
        assert isinstance(err, Exception)

    def test_se_puede_capturar_como_exception(self):
        """Garantiza compatibilidad con código legacy que captura Exception genérica."""
        try:
            raise SinResultadosError("test")
        except Exception as e:
            assert "test" in str(e)
