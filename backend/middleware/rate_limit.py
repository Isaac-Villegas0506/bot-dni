"""
middleware/rate_limit.py
────────────────────────
Rate limiting en memoria por IP + ventana deslizante fija de 60 s.

MOTIVACIÓN
──────────
El backend no tenía ningún límite de peticiones: solo los créditos y Turnstile
(que está apagado en muchos entornos). Un atacante podía enumerar
/api/dni/{dni} en ráfaga, agotar el pool de bots de Telegram (6 locks) y
disparar el anti-spam de los bots externos.

ALCANCE
───────
Este middleware es deliberadamente simple y SIN dependencias externas:
- Ventana fija de 60 s por (IP, bucket).
- Buckets distintos por tipo de endpoint para no penalizar la navegación normal.
- Estado en memoria: válido para el despliegue actual con 1 worker
  (gunicorn -w 1 en Render). Si se escala a varios workers/instancias, hay que
  sustituir el store por Redis.

CONFIGURACIÓN (variables de entorno, opcionales)
─────────────────────────────────────────────────
RATE_LIMIT_ENABLED        "true"/"false"  (default: true)
RATE_LIMIT_SEARCH_MAX     peticiones/min para endpoints de consulta (default: 20)
RATE_LIMIT_LOGIN_MAX      peticiones/min para login (default: 10)
RATE_LIMIT_UPLOAD_MAX     peticiones/min para uploads (default: 10)
RATE_LIMIT_WRITE_MAX      peticiones/min para escrituras (default: 60)
"""

from __future__ import annotations

import os
import threading
import time
from collections import defaultdict

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse


# ── Clasificación de rutas en buckets ─────────────────────────────────────────
# Se evalúa en orden; la primera regla que coincide gana.

_SEARCH_PREFIXES = (
    "/api/dni/",
    "/api/search/",
    "/api/fiscalia/",
    "/api/delitos/",
    "/api/facial/",
    "/api/familiares/",
    "/api/reniec/",
    "/api/penales/",
    "/api/judiciales/",
    "/api/policiales/",
    "/api/telefono/",
    "/api/vehiculos/",
    "/api/metadata",
)

_LOGIN_PREFIXES = (
    "/api/auth/firebase-login",
    "/api/auth/dev-login",
    "/api/auth/check-disposable",
)

_UPLOAD_PREFIXES = (
    "/api/purchases/",
    "/api/admin/banners",
)

_WRITE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


def _bucket_for(path: str, method: str) -> str | None:
    """
    Devuelve el bucket de rate limit para una petición, o None si no se limita.

    Las lecturas de catálogo (settings, banners, anuncios, packages) NO se
    limitan para no romper la carga inicial de la SPA.
    """
    if path.startswith(_LOGIN_PREFIXES):
        return "login"
    if path.startswith(_UPLOAD_PREFIXES):
        return "upload"
    if path.startswith(_SEARCH_PREFIXES):
        return "search"
    if method in _WRITE_METHODS and path.startswith("/api/"):
        return "write"
    return None


def _limits() -> dict[str, int]:
    return {
        "search": int(os.getenv("RATE_LIMIT_SEARCH_MAX", "20")),
        "login": int(os.getenv("RATE_LIMIT_LOGIN_MAX", "10")),
        "upload": int(os.getenv("RATE_LIMIT_UPLOAD_MAX", "10")),
        "write": int(os.getenv("RATE_LIMIT_WRITE_MAX", "60")),
    }


def _client_ip(request) -> str:
    """IP real, respetando proxies (Render/Vercel delante)."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    return request.client.host if request.client else "unknown"


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Middleware ASGI de rate limiting por IP y bucket.

    Responde 429 con cabecera Retry-After cuando se excede el límite.
    """

    def __init__(self, app):
        super().__init__(app)
        self.enabled = os.getenv("RATE_LIMIT_ENABLED", "true").lower() == "true"
        self._counters: dict[tuple[str, str], tuple[int, float]] = {}
        self._lock = threading.Lock()
        self._last_cleanup = time.time()

    def _prune(self, now: float) -> None:
        """Elimina entradas de ventanas caducadas para acotar la memoria."""
        if now - self._last_cleanup < 300:
            return
        expired = [k for k, (_, reset) in self._counters.items() if reset <= now]
        for key in expired:
            self._counters.pop(key, None)
        self._last_cleanup = now

    def _hit(self, ip: str, bucket: str, limit: int) -> tuple[bool, int]:
        """
        Registra un hit y devuelve (permitido, segundos_para_reset).
        """
        now = time.time()
        with self._lock:
            self._prune(now)
            key = (ip, bucket)
            count, reset = self._counters.get(key, (0, now + 60))

            if now >= reset:
                count, reset = 0, now + 60

            count += 1
            self._counters[key] = (count, reset)

            if count > limit:
                return False, max(1, int(reset - now))
            return True, max(1, int(reset - now))

    async def dispatch(self, request, call_next):
        if not self.enabled:
            return await call_next(request)

        path = request.url.path
        bucket = _bucket_for(path, request.method)
        if bucket is None:
            return await call_next(request)

        limit = _limits().get(bucket, 60)
        ip = _client_ip(request)

        allowed, retry_after = self._hit(ip, bucket, limit)
        if not allowed:
            return JSONResponse(
                status_code=429,
                content={
                    "detail": "Demasiadas solicitudes. Espera un momento antes de volver a intentar.",
                    "retry_after": retry_after,
                },
                headers={"Retry-After": str(retry_after)},
            )

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(limit)
        response.headers["X-RateLimit-Remaining"] = str(
            max(0, limit - self._counters.get((ip, bucket), (0, 0))[0])
        )
        return response
