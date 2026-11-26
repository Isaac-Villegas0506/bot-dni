"""
tests/unit/test_rate_limit.py
─────────────────────────────
Tests unitarios para middleware/rate_limit.py

No requieren red ni base de datos.

Ejecutar desde backend/:
    python -m pytest tests/unit/test_rate_limit.py -v
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

import pytest

from middleware.rate_limit import RateLimitMiddleware, _bucket_for


# ── Clasificación de buckets ──────────────────────────────────────────────────

class TestBucketFor:
    """Tests para _bucket_for(): asignación de rutas a buckets."""

    @pytest.mark.parametrize("path", [
        "/api/dni/12345678",
        "/api/search/name",
        "/api/fiscalia/search",
        "/api/delitos/search",
        "/api/facial/search",
        "/api/reniec/c4-blue",
        "/api/telefono/titular",
        "/api/vehiculos/record",
        "/api/metadata",
    ])
    def test_rutas_de_consulta_van_a_search(self, path):
        assert _bucket_for(path, "POST") == "search"
        assert _bucket_for(path, "GET") == "search"

    @pytest.mark.parametrize("path", [
        "/api/auth/firebase-login",
        "/api/auth/dev-login",
        "/api/auth/check-disposable",
    ])
    def test_rutas_de_login_van_a_login(self, path):
        assert _bucket_for(path, "POST") == "login"
        assert _bucket_for(path, "GET") == "login"

    @pytest.mark.parametrize("path", [
        "/api/purchases/",
        "/api/admin/banners",
    ])
    def test_rutas_de_upload_van_a_upload(self, path):
        assert _bucket_for(path, "POST") == "upload"

    def test_escrituras_genericas_van_a_write(self):
        assert _bucket_for("/api/admin/settings/foo", "PUT") == "write"
        assert _bucket_for("/api/user/notifications/1/read", "PUT") == "write"

    @pytest.mark.parametrize("path", [
        "/api/settings",
        "/api/banners",
        "/api/announcements/active",
        "/api/credit-packages",
        "/api/system/status",
        "/",
        "/api/static/images/x.jpg",
    ])
    def test_lecturas_de_catalogo_no_se_limitan(self, path):
        assert _bucket_for(path, "GET") is None

    def test_get_a_ruta_de_escritura_no_se_limita(self):
        # GET sobre /api/admin/... no es escritura y no entra en search
        assert _bucket_for("/api/admin/users", "GET") is None


# ── Contador de ventana fija ─────────────────────────────────────────────────

class TestHit:
    """Tests para RateLimitMiddleware._hit()."""

    def _mw(self, enabled=True):
        mw = RateLimitMiddleware(app=None)
        mw.enabled = enabled
        return mw

    def test_permite_hasta_el_limite(self):
        mw = self._mw()
        for i in range(5):
            allowed, _ = mw._hit("1.1.1.1", "search", 5)
            assert allowed, f"hit {i + 1} debería permitirse"

    def test_bloquea_al_superar_el_limite(self):
        mw = self._mw()
        for _ in range(5):
            mw._hit("1.1.1.1", "search", 5)
        allowed, retry_after = mw._hit("1.1.1.1", "search", 5)
        assert not allowed
        assert retry_after >= 1

    def test_ips_distintas_son_independientes(self):
        mw = self._mw()
        for _ in range(5):
            mw._hit("1.1.1.1", "search", 5)
        # Otra IP no debe estar afectada
        allowed, _ = mw._hit("2.2.2.2", "search", 5)
        assert allowed

    def test_buckets_distintos_son_independientes(self):
        mw = self._mw()
        for _ in range(5):
            mw._hit("1.1.1.1", "search", 5)
        # Misma IP, otro bucket: no debe estar afectada
        allowed, _ = mw._hit("1.1.1.1", "login", 5)
        assert allowed

    def test_ventana_se_reinicia(self):
        mw = self._mw()
        # Agotamos el límite
        for _ in range(3):
            mw._hit("1.1.1.1", "search", 3)
        allowed, _ = mw._hit("1.1.1.1", "search", 3)
        assert not allowed

        # Forzamos el reinicio moviendo la ventana al pasado
        count, reset = mw._counters[("1.1.1.1", "search")]
        mw._counters[("1.1.1.1", "search")] = (count, 0)

        allowed, _ = mw._hit("1.1.1.1", "search", 3)
        assert allowed, "tras expirar la ventana debe volver a permitir"


# ── Integración con la app FastAPI ───────────────────────────────────────────

class TestIntegracionApp:
    """Verifica que el middleware está montado en la app real."""

    def test_middleware_registrado_en_main(self):
        # Importamos main; puede fallar si faltan TELEGRAM_* o SECRET_KEY,
        # por eso el test se salta en ese caso en vez de fallar.
        try:
            import main  # noqa: F401
        except Exception as e:  # pragma: no cover
            pytest.skip(f"No se pudo importar main: {e}")

        stack = getattr(main.app, "user_middleware", [])
        names = [m.cls.__name__ for m in stack]
        assert "RateLimitMiddleware" in names, f"middlewares montados: {names}"
