"""
bot_client.py — Thin wrapper de compatibilidad.
────────────────────────────────────────────────
Este archivo mantiene la API pública original de BotClient para que
main.py no requiera cambios.

DOS FAMILIAS DE BOTS
────────────────────
  PREMIUM  → @Bitxdatabot  (telegram/bitx_client.py + telegram/bitx_parser.py)
             Todas las consultas de pago: RENIEC full, C4, DNI virtuales,
             hogar/familiares, telefonía, denuncias, facial y Seeker.

  GRATIS   → pool de telegram/bots/  (@SeleneSearch_Bot, @DEALERDATABOT,
             @HexDataBOT, @ImperialData_bot...). DNI básico, nombre,
             operadora, récord vehicular, fiscalía.

La migración a BitxData se hizo el 2026-11-26 porque @Infordata1_bot
(que cubría casi todo lo premium) dejó de ser un bot de consultas.
"""

import os
from pathlib import Path
from telethon import TelegramClient
from telethon.sessions import StringSession

# ── Re-exportar SinResultadosError para compatibilidad con main.py ─────────
from telegram.exceptions import SinResultadosError   # noqa: F401 — usado por main.py

# ── Cliente PREMIUM (BitxData) ─────────────────────────────────────────────
from telegram.bitx_client import run_command as _bitx_run

# ── Módulos especializados del POOL GRATUITO ───────────────────────────────
# (todo lo premium vive ahora en telegram/bitx_client.py)
from telegram.bots.reniec.dni_gratis import query_dni_gratis
from telegram.bots.reniec.busqueda_por_nombre import busqueda_por_nombre
from telegram.bots.fiscalia.fiscalia import query_fiscalia
from telegram.bots.telefonia.operadora import query_operadora as _query_operadora
from telegram.bots.telefonia.telefono import query_telx as _query_telx
from telegram.bots.telefonia.telefono import query_cel as _query_cel
from telegram.bots.vehiculos.vehiculos import query_record as _query_record


def _static_dir() -> Path:
    """Retorna el directorio static/ del backend."""
    return Path(__file__).parent.absolute() / "static"


class BotClient:
    """
    Wrapper de compatibilidad. Mantiene la API original para que main.py
    no requiera modificaciones.

    Cada método delega a la función especializada del paquete telegram/bots/.
    """

    def __init__(self):
        self.api_id = os.getenv("TELEGRAM_API_ID")
        self.api_hash = os.getenv("TELEGRAM_API_HASH")

        session_string = os.getenv("TELEGRAM_SESSION_STRING")
        if session_string:
            print("[OK] Usando StringSession desde variable de entorno")
            self.client = TelegramClient(
                StringSession(session_string), self.api_id, self.api_hash
            )
        else:
            session_path = str(Path(__file__).parent / "anon")
            self.client = TelegramClient(session_path, self.api_id, self.api_hash)

        self.target_bot = os.getenv("TARGET_BOT_USERNAME")
        self.name_search_bot = "@SeleneSearch_Bot"
        self.bot_pool = None  # Set externally by main.py

        # Bot PREMIUM (BitxData). Configurable por entorno.
        self.premium_bot = os.getenv("BITX_BOT_USERNAME", "@Bitxdatabot")

        # Cliente secundario para balanceo de carga
        session_string2 = os.getenv("TELEGRAM_SESSION_STRING_2")
        self.client2 = None
        if session_string2:
            print("[OK] Usando StringSession 2 para balanceo de carga")
            api_id2  = int(os.getenv("TELEGRAM_API_ID_2", self.api_id))
            api_hash2 = os.getenv("TELEGRAM_API_HASH_2", self.api_hash)
            self.client2 = TelegramClient(
                StringSession(session_string2), api_id2, api_hash2
            )

        # Configuración premium
        self.premium_group_id = int(os.getenv("TELEGRAM_GROUP_ID", "0"))
        self.premium_bot_id   = int(os.getenv("TELEGRAM_PREMIUM_BOT_ID", "0"))

    async def start(self):
        print("[BOT] (Re)Iniciando cliente Telegram...")
        try:
            if not self.client.is_connected():
                await self.client.connect()
            if not await self.client.is_user_authorized():
                print("❌ ERROR CRÍTICO: Cliente 1 no autorizado o sesión inválida.")
            if self.client2:
                print("🤖 Iniciando cliente Telegram secundario...")
                if not self.client2.is_connected():
                    await self.client2.connect()
                if not await self.client2.is_user_authorized():
                    print("[ERROR] Cliente 2 no autorizado o sesión inválida.")
        except Exception as e:
            print(f"❌ Error conectando: {e}")
            if "AuthKeyDuplicatedError" in str(e):
                print("⚠️ ADVERTENCIA: Sesión duplicada. En Render usa --workers 1.")

    async def stop(self):
        await self.client.disconnect()
        if self.client2:
            await self.client2.disconnect()

    async def _ensure_connection(self):
        try:
            if not self.client.is_connected():
                await self.client.connect()
            if self.client2 and not self.client2.is_connected():
                await self.client2.connect()
        except Exception as e:
            print(f"🔄 Error en _ensure_connection: {e}. Reconectando...")
            try:
                await self.client.disconnect()
                await self.client.connect()
                if self.client2:
                    await self.client2.disconnect()
                    await self.client2.connect()
            except Exception:
                pass

    # ── Helpers de BitxData (PREMIUM) ────────────────────────────────────

    async def _bitx(self, command_key: str, argument: str = "", file_path: str | None = None) -> dict:
        """
        Ejecuta un comando en @Bitxdatabot y devuelve un dict plano.

        Normaliza la respuesta del bot (texto + archivos/fotos) al formato
        que consumen los endpoints de main.py.
        """
        await self._ensure_connection()
        result = await _bitx_run(
            self.client,
            command_key,
            argument,
            _static_dir(),
            bot_username=self.premium_bot,
            file_path=file_path,
        )
        return result.to_dict()

    # ── Métodos GRATIS (pool de bots) ────────────────────────────────────

    async def query_bot(self, dni):
        """Consulta DNI gratuita — pool de bots gratis."""
        await self._ensure_connection()
        return await query_dni_gratis(
            self.client, self.client2, self.bot_pool, str(dni), _static_dir()
        )

    async def search_with_sirius(self, nombres, paterno, materno):
        """Búsqueda por nombre — pool de bots gratis."""
        await self._ensure_connection()
        return await busqueda_por_nombre(
            self.client, self.client2, self.bot_pool,
            nombres, paterno, materno, _static_dir()
        )

    def parse_sirius_re(self, text):
        """Parser de resultados por nombre — reutilizado desde busqueda_por_nombre."""
        from telegram.bots.reniec.busqueda_por_nombre import _parse_sirius_re
        return _parse_sirius_re(text)

    async def query_fiscalia_bot(self, target: str, option_type: str) -> dict:
        """Consulta Fiscalía — pool de bots gratis."""
        await self._ensure_connection()
        return await query_fiscalia(self.client, target, option_type, _static_dir())

    async def query_operadora(self, phone: str) -> dict:
        """Consulta operadora — pool de bots gratis."""
        await self._ensure_connection()
        return await _query_operadora(self.client, self.client2, phone)

    async def query_telx(self, dni: str) -> dict:
        """Teléfonos por DNI — pool de bots gratis."""
        await self._ensure_connection()
        return await _query_telx(self.client, dni)

    async def query_cel(self, phone: str) -> dict:
        """Titular por número — pool de bots gratis."""
        await self._ensure_connection()
        return await _query_cel(self.client, phone)

    async def query_record(self, target: str) -> dict:
        """Récord vehicular — pool de bots gratis."""
        await self._ensure_connection()
        return await _query_record(self.client, target, _static_dir())

    # ── Métodos PREMIUM (BitxData) ───────────────────────────────────────

    async def search_premium_group(self, dni) -> dict:
        """DNI Premium / RENIEC Full Biometría — /dnif"""
        return await self._bitx("dni_premium", str(dni))

    async def query_dni_premium_online(self, dni) -> dict:
        """RENIEC Online NV3 — /dni"""
        return await self._bitx("dni", str(dni))

    async def query_metadata(self, dni: str) -> dict:
        """Info Global / Reporte Seeker PDF — /seekerpdf"""
        return await self._bitx("seekerpdf", str(dni))

    async def query_telp(self, phone: str) -> dict:
        """Telefonía completa (titular de línea) — /telp"""
        return await self._bitx("telp", str(phone))

    async def query_fonos(self, dni: str) -> dict:
        """Líneas asociadas a un DNI — /fonos"""
        return await self._bitx("fonos", str(dni))

    async def generate_c4_blue(self, dni) -> dict:
        """Ficha C4 Azul — /c4a"""
        return await self._bitx("c4_azul", str(dni))

    async def generate_c4_inscripcion(self, dni) -> dict:
        """Ficha C4 Inscripción — /c4i"""
        return await self._bitx("c4_inscripcion", str(dni))

    async def generate_dni_electronico(self, dni) -> dict:
        """DNI Electrónico — /dnivel (2 fotos + datos)"""
        return await self._bitx("dni_electronico", str(dni))

    async def generate_dni_azul(self, dni) -> dict:
        """DNI Virtual Azul — /dniv (2 fotos + datos)"""
        return await self._bitx("dni_azul", str(dni))

    async def generate_dni_amarillo(self, dni) -> dict:
        """DNI Amarillo — /dniva (2 fotos + datos)"""
        return await self._bitx("dni_amarillo", str(dni))

    async def generate_hogar(self, dni) -> dict:
        """Reporte SISFOH / Hogar — /hogar"""
        return await self._bitx("hogar", str(dni))

    async def generate_arbol_texto(self, dni) -> dict:
        """Árbol genealógico en texto — /ag"""
        return await self._bitx("arbol_texto", str(dni))

    async def generate_arbol_visual(self, dni) -> dict:
        """Árbol visual (imagen) — /agv"""
        return await self._bitx("arbol_visual", str(dni))

    async def query_arbol_visual_pdf(self, dni: str) -> dict:
        """Árbol visual completo en PDF — /agvpdf"""
        return await self._bitx("arbol_visual_pdf", str(dni))

    async def generate_facial(self, file_path: str) -> dict:
        """Búsqueda facial — /reco (envía la imagen)"""
        return await self._bitx("facial", file_path=file_path)

    async def query_denuncias(self, target: str) -> dict:
        """Denuncias por DNI — /denuncias"""
        return await self._bitx("denuncias", str(target))

    async def query_denuncias_placa(self, placa: str) -> dict:
        """Denuncias por placa — /pladenuncias"""
        return await self._bitx("denuncias_placa", str(placa))

    async def query_delitos(self, query_type: str, target: str) -> dict:
        """
        Denuncias/Delitos.

        ``query_type`` puede ser 'dni'/'antper' (denuncias por DNI) o
        'placa' (denuncias por placa). Antecedentes penales/judiciales/
        policiales NO tienen comando en BitxData: se mantienen desactivados.
        """
        if query_type in ("placa", "denuncias_placa"):
            return await self.query_denuncias_placa(target)
        return await self.query_denuncias(target)
