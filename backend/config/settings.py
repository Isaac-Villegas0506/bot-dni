"""
config/settings.py
──────────────────
Configuración centralizada del backend usando variables de entorno.

Centraliza TODOS los os.getenv() que estaban dispersos en main.py,
bot_client.py, database.py, auth.py, email_utils.py, etc.

COMPATIBILIDAD: Este módulo NO modifica ningún módulo existente.
Es un módulo nuevo puramente aditivo. Los módulos existentes
siguen leyendo sus propios os.getenv() sin cambios hasta que
sean migrados incrementalmente.

USO:
    from config.settings import settings

    api_id = settings.telegram_api_id
    db_url = settings.database_url
"""

import os
from pathlib import Path


class Settings:
    """
    Centraliza la configuración del sistema leída desde variables de entorno.
    No usa Pydantic BaseSettings para evitar dependencias adicionales y
    mantener compatibilidad con el entorno actual.
    """

    # ── Telegram ──────────────────────────────────────────────────────────
    @property
    def telegram_api_id(self) -> str | None:
        return os.getenv("TELEGRAM_API_ID")

    @property
    def telegram_api_hash(self) -> str | None:
        return os.getenv("TELEGRAM_API_HASH")

    @property
    def telegram_session_string(self) -> str | None:
        return os.getenv("TELEGRAM_SESSION_STRING")

    @property
    def telegram_session_string_2(self) -> str | None:
        return os.getenv("TELEGRAM_SESSION_STRING_2")

    @property
    def telegram_api_id_2(self) -> str | None:
        return os.getenv("TELEGRAM_API_ID_2")

    @property
    def telegram_api_hash_2(self) -> str | None:
        return os.getenv("TELEGRAM_API_HASH_2")

    @property
    def telegram_group_id(self) -> int:
        return int(os.getenv("TELEGRAM_GROUP_ID", "0"))

    @property
    def telegram_premium_bot_id(self) -> int:
        return int(os.getenv("TELEGRAM_PREMIUM_BOT_ID", "0"))

    @property
    def target_bot_username(self) -> str | None:
        return os.getenv("TARGET_BOT_USERNAME")

    # ── Base de Datos ─────────────────────────────────────────────────────
    @property
    def database_url(self) -> str | None:
        return os.getenv("DATABASE_URL")

    @property
    def mysql_host(self) -> str:
        return os.getenv("MYSQL_HOST", "localhost")

    @property
    def mysql_user(self) -> str:
        return os.getenv("MYSQL_USER", "postgres")

    @property
    def mysql_password(self) -> str:
        return os.getenv("MYSQL_PASSWORD", "")

    @property
    def mysql_db(self) -> str:
        return os.getenv("MYSQL_DB", "postgres")

    @property
    def mysql_port(self) -> str:
        return os.getenv("MYSQL_PORT", "5432")

    # ── Seguridad ─────────────────────────────────────────────────────────
    @property
    def jwt_secret_key(self) -> str:
        return os.getenv("JWT_SECRET_KEY", "CHANGE_ME_IN_PRODUCTION")

    @property
    def jwt_algorithm(self) -> str:
        return os.getenv("JWT_ALGORITHM", "HS256")

    @property
    def jwt_expiry_days(self) -> int:
        return int(os.getenv("JWT_EXPIRY_DAYS", "30"))

    # ── Entorno ───────────────────────────────────────────────────────────
    @property
    def environment(self) -> str:
        return os.getenv("ENVIRONMENT", "development").lower()

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def allow_dev_login(self) -> bool:
        return os.getenv("ALLOW_DEV_LOGIN", "false").lower() == "true"

    @property
    def allow_insecure_firebase_fallback(self) -> bool:
        return os.getenv("ALLOW_INSECURE_FIREBASE_FALLBACK", "false").lower() == "true"

    @property
    def enforce_turnstile(self) -> bool:
        default = "true" if self.is_production else "false"
        return os.getenv("ENFORCE_TURNSTILE", default).lower() == "true"

    @property
    def allowed_origins(self) -> list[str]:
        raw = os.getenv("ALLOWED_ORIGINS", "")
        origins = [o.strip() for o in raw.split(",") if o.strip()]
        if not origins and not self.is_production:
            origins = [
                "http://localhost:5173",
                "http://127.0.0.1:5173",
            ]
        return origins

    # ── CAPTCHA ───────────────────────────────────────────────────────────
    @property
    def turnstile_secret_key(self) -> str | None:
        return os.getenv("TURNSTILE_SECRET_KEY")

    # ── Email / SMTP ──────────────────────────────────────────────────────
    @property
    def smtp_host(self) -> str:
        return os.getenv("SMTP_HOST", "smtp.gmail.com")

    @property
    def smtp_port(self) -> int:
        return int(os.getenv("SMTP_PORT", "587"))

    @property
    def smtp_user(self) -> str | None:
        return os.getenv("SMTP_USER")

    @property
    def smtp_password(self) -> str | None:
        return os.getenv("SMTP_PASSWORD")

    # ── Firebase ──────────────────────────────────────────────────────────
    @property
    def firebase_credentials(self) -> str | None:
        return os.getenv("FIREBASE_CREDENTIALS")

    @property
    def firebase_web_api_key(self) -> str | None:
        return os.getenv("FIREBASE_WEB_API_KEY")

    # ── Rutas Estáticas ───────────────────────────────────────────────────
    @property
    def backend_dir(self) -> Path:
        """Directorio raíz del backend."""
        return Path(__file__).parent.parent

    @property
    def static_dir(self) -> Path:
        return self.backend_dir / "static"

    @property
    def static_images_dir(self) -> Path:
        return self.static_dir / "images"

    @property
    def static_files_dir(self) -> Path:
        return self.static_dir / "files"

    @property
    def static_docs_dir(self) -> Path:
        return self.static_dir / "docs"

    @property
    def static_receipts_dir(self) -> Path:
        return self.static_dir / "receipts"


# Instancia singleton — importar desde aquí en toda la aplicación
settings = Settings()
