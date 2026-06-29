"""
telegram/guards.py
──────────────────
Funciones de detección de respuestas especiales de bots de Telegram.

Estas funciones fueron extraídas de BotClient._check_antispam() y
BotClient._is_sin_resultados() para permitir su uso desde múltiples
módulos sin depender de la instancia de BotClient.

COMPATIBILIDAD: BotClient mantiene sus métodos privados como wrappers
que llaman a estas funciones. Nada en main.py ni database.py cambia.
"""

import re
import logging

logger = logging.getLogger(__name__)


def check_antispam(text: str) -> str | None:
    """
    Verifica si el texto es un mensaje de período de enfriamiento (anti-spam).

    Args:
        text: Texto de respuesta del bot.

    Returns:
        Mensaje de espera formateado para el usuario si se detecta anti-spam,
        o None si el texto es una respuesta normal.

    Ejemplos de texto de entrada:
        "Anti-spam activado. Debes esperar 15.5s"
        "Por favor espera para continuar"
    """
    if not text:
        return None

    text_lower = text.lower()
    if "anti-spam" not in text_lower and "debes esperar" not in text_lower:
        return None

    # Regex flexible: busca dígitos.dígitos + 's' (segundos)
    m = re.search(r'(\d+(?:\.\d+)?)\s*s', text, re.IGNORECASE)
    if m:
        seconds = m.group(1)
        return f"POR FAVOR ESPERA {seconds} SEGUNDOS Y VUELVE A GENERAR TU CONSULTA"
    return "POR FAVOR ESPERA UN MOMENTO Y VUELVE A GENERAR TU CONSULTA"


# Términos exactos que indican "sin resultados" en los bots
_SIN_RESULTADOS_TERMS = [
    "SIN RESULTADOS",
    "NO SE ENCONTRÓ INFORMACIÓN",
    "NO SE ENCONTRO INFORMACION",
    "REGISTRO VACÍO",
    "ʀᴇɢɪsᴛʀᴏ ᴠᴀᴄɪᴏ",
    "NO SE ENCONTRARON DATOS EN LA BASE DE DATOS",
    "DNI NO ENCONTRADO",
    "NO SE HALLÓ INFORMACIÓN BIOMÉTRICA",
    "INFORMACIÓN BIOMÉTRICA",
    "NO EXISTE EN LA BASE DE DATOS",
    "CRÉDITOS NO DESCONTADOS",
    "SIN RESULTADOS. VERIFIQUE LOS DATOS",
    "VERIFIQUE LOS DATOS E INTENTE NUEVAMENTE",
    "NO EXISTE O NO FUE ENCONTRADO",
    "NO HAY RESULTADOS",
    "NO SE ENCONTRARON DATOS",
    "NO SE ENCONTRÓ ÁRBOL",
    "NO SE ENCONTRO ARBOL",
    "ERROR EN EL RECONOCIMIENTO FACIAL",
]

# Palabras clave de espera/procesamiento (bot aún calculando)
WAIT_KEYWORDS = [
    "procesando", "wait", "recopilando", "buscando",
    "cargando", "analizando", "espere", "moment",
]


def is_sin_resultados(text: str) -> bool:
    """
    Detecta si el bot reportó que no hay información para la consulta.

    Args:
        text: Texto de respuesta del bot.

    Returns:
        True si el texto indica "sin resultados", False en caso contrario.
    """
    if not text:
        return False

    text_upper = text.upper()

    # Chequeo rápido del término más común
    if "SIN RESULTADOS" in text_upper:
        return True

    if "\u0280\u1d07\u0262\u026as\u1d1b\u0280\u1d0f \u1d20\u1d00\u1d04\u026a\u1d0f" in text:
        return True

    return any(term in text_upper for term in _SIN_RESULTADOS_TERMS)


def is_waiting_message(text: str) -> bool:
    """
    Detecta si el bot aún está procesando la consulta (mensaje intermedio).

    Args:
        text: Texto de respuesta del bot.

    Returns:
        True si el bot indica que sigue procesando.
    """
    if not text:
        return False
    text_lower = text.lower()
    return any(kw in text_lower for kw in WAIT_KEYWORDS)
