"""
bot_client.py — Thin wrapper de compatibilidad.
────────────────────────────────────────────────
Este archivo mantiene la API pública original de BotClient para que
main.py no requiera cambios.

Cada método delega a su módulo especializado en telegram/bots/.

NUEVA ARQUITECTURA:
  telegram/bots/dni_bot.py          → query_bot / search_premium_group / search_with_sirius
  telegram/bots/fiscalia_bot.py     → query_fiscalia_bot
  telegram/bots/operadora_bot.py    → query_operadora
  telegram/bots/telefono_bot.py     → query_telx / query_telp / query_cel
  telegram/bots/vehiculos_bot.py    → query_record
  telegram/bots/antecedentes_bot.py → generate_antpen / antjud / antpol
  telegram/bots/c4_bot.py           → generate_c4_blue / generate_c4_inscripcion
  telegram/bots/dni_virtual_bot.py  → generate_dni_electronico / azul / amarillo
  telegram/bots/familiares_bot.py   → generate_familiares_pdf / texto / arbol_visual_pdf
  telegram/bots/facial_bot.py       → generate_facial
  telegram/bots/delitos_bot.py      → query_delitos
"""

import os
from pathlib import Path
from telethon import TelegramClient
from telethon.sessions import StringSession

# ── Re-exportar SinResultadosError para compatibilidad con main.py ─────────
from telegram.exceptions import SinResultadosError   # noqa: F401 — usado por main.py

# ── Módulos especializados ─────────────────────────────────────────────────
from telegram.bots.reniec.dni_gratis import query_dni_gratis
from telegram.bots.reniec.dni_premium import query_dni_premium
from telegram.bots.reniec.busqueda_por_nombre import busqueda_por_nombre
from telegram.bots.fiscalia.fiscalia import query_fiscalia
from telegram.bots.telefonia.operadora import query_operadora as _query_operadora
from telegram.bots.telefonia.telefono import query_telx as _query_telx
from telegram.bots.telefonia.telefono import query_telp as _query_telp
from telegram.bots.telefonia.telefono import query_cel as _query_cel
from telegram.bots.vehiculos.vehiculos import query_record as _query_record
from telegram.bots.antecedentes.antecedentes import generate_antecedentes
from telegram.bots.generador_reniec.generar_c4_azul import generate_c4_azul
from telegram.bots.generador_reniec.generar_ficha_inscripcion import generate_c4_inscripcion
from telegram.bots.generador_reniec.dni_virtual import (
    generate_dni_electronico as _gen_dni_electronico,
    generate_dni_azul as _gen_dni_azul,
    generate_dni_amarillo as _gen_dni_amarillo,
)
from telegram.bots.reniec.familiares import (
    generate_familiares_pdf as _gen_fam_pdf,
    generate_familiares_texto as _gen_fam_texto,
    query_arbol_visual_pdf as _query_arbol,
)
from telegram.bots.facial.facial import generate_facial as _gen_facial
from telegram.bots.delitos.delitos import query_delitos as _query_delitos


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
        self.name_search_bot = "@OlimpoDataBot"
        self.bot_pool = None  # Set externally by main.py

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

    # ── Métodos de compatibilidad (delegan a módulos especializados) ──────

    async def query_bot(self, dni):
        """Consulta DNI gratuita — delega a telegram/bots/dni_bot.py"""
        await self._ensure_connection()
        return await query_dni_gratis(
            self.client, self.client2, self.bot_pool, str(dni), _static_dir()
        )

    async def search_premium_group(self, dni):
        """Consulta DNI premium — delega a telegram/bots/dni_bot.py"""
        await self._ensure_connection()
        return await query_dni_premium(
            self.client, self.bot_pool, str(dni), _static_dir(),
            target_group=f"@Infordata1_bot",
            target_bot_id=self.premium_bot_id,
        )

    async def search_with_sirius(self, nombres, paterno, materno):
        """Búsqueda por nombre — delega a telegram/bots/dni_bot.py"""
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
        """Consulta Fiscalía — delega a telegram/bots/fiscalia_bot.py"""
        await self._ensure_connection()
        return await query_fiscalia(self.client, target, option_type, _static_dir())

    async def query_operadora(self, phone: str) -> dict:
        """Consulta operadora — delega a telegram/bots/operadora_bot.py"""
        await self._ensure_connection()
        return await _query_operadora(self.client, self.client2, phone)

    async def query_telx(self, dni: str) -> dict:
        """Teléfonos por DNI — delega a telegram/bots/telefono_bot.py"""
        await self._ensure_connection()
        return await _query_telx(self.client, dni)

    async def query_telp(self, phone: str) -> dict:
        """Línea por número (premium) — delega a telegram/bots/telefono_bot.py"""
        await self._ensure_connection()
        return await _query_telp(
            self.client, phone,
            target_group=self.premium_group_id,
            target_bot_id=self.premium_bot_id,
        )

    async def query_cel(self, phone: str) -> dict:
        """Titular por número — delega a telegram/bots/telefono_bot.py"""
        await self._ensure_connection()
        return await _query_cel(self.client, phone)

    async def query_record(self, target: str) -> dict:
        """Récord vehicular — delega a telegram/bots/vehiculos_bot.py"""
        await self._ensure_connection()
        return await _query_record(self.client, target, _static_dir())

    async def generate_antpen(self, dni) -> dict:
        """Antecedentes Penales — delega a telegram/bots/antecedentes_bot.py"""
        await self._ensure_connection()
        return await generate_antecedentes(self.client, str(dni), "penales", _static_dir())

    async def generate_antjud(self, dni) -> dict:
        """Antecedentes Judiciales — delega a telegram/bots/antecedentes_bot.py"""
        await self._ensure_connection()
        return await generate_antecedentes(self.client, str(dni), "judiciales", _static_dir())

    async def generate_antpol(self, dni) -> dict:
        """Antecedentes Policiales — delega a telegram/bots/antecedentes_bot.py"""
        await self._ensure_connection()
        return await generate_antecedentes(self.client, str(dni), "policiales", _static_dir())

    async def generate_c4_blue(self, dni) -> dict:
        """Ficha C4 Azul — delega a telegram/bots/c4_bot.py"""
        await self._ensure_connection()
        return await generate_c4_azul(self.client, str(dni), _static_dir())

    async def generate_c4_inscripcion(self, dni) -> dict:
        """Ficha C4 Inscripción — delega a telegram/bots/c4_bot.py"""
        await self._ensure_connection()
        return await generate_c4_inscripcion(self.client, str(dni), _static_dir())

    async def generate_dni_electronico(self, dni) -> dict:
        """DNI Electrónico — delega a telegram/bots/dni_virtual_bot.py"""
        await self._ensure_connection()
        return await _gen_dni_electronico(self.client, str(dni), _static_dir())

    async def generate_dni_azul(self, dni) -> dict:
        """DNI Azul — delega a telegram/bots/dni_virtual_bot.py"""
        await self._ensure_connection()
        return await _gen_dni_azul(self.client, str(dni), _static_dir())

    async def generate_dni_amarillo(self, dni) -> dict:
        """DNI Amarillo — delega a telegram/bots/dni_virtual_bot.py"""
        await self._ensure_connection()
        return await _gen_dni_amarillo(self.client, str(dni), _static_dir())

    async def generate_familiares_pdf(self, dni) -> dict:
        """Árbol Visual PDF — delega a telegram/bots/familiares_bot.py"""
        await self._ensure_connection()
        return await _gen_fam_pdf(self.client, str(dni), _static_dir())

    async def generate_familiares_texto(self, dni) -> dict:
        """Árbol Genealógico texto — delega a telegram/bots/familiares_bot.py"""
        await self._ensure_connection()
        return await _gen_fam_texto(self.client, str(dni), _static_dir())

    async def query_arbol_visual_pdf(self, dni: str) -> dict:
        """Árbol Visual v2 PDF — delega a telegram/bots/familiares_bot.py"""
        await self._ensure_connection()
        return await _query_arbol(self.client, self.bot_pool, dni, _static_dir())

    async def generate_facial(self, file_path: str) -> dict:
        """Búsqueda Facial — delega a telegram/bots/facial_bot.py"""
        await self._ensure_connection()
        return await _gen_facial(self.client, file_path, _static_dir())

    async def query_delitos(self, query_type: str, target: str) -> dict:
        """Denuncias/Delitos — delega a telegram/bots/delitos_bot.py"""
        await self._ensure_connection()
        return await _query_delitos(
            self.client, self.bot_pool, query_type, target, _static_dir()
        )
