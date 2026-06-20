"""
config/bots.py
──────────────
Lista centralizada de bots de Telegram utilizados por el sistema.

ANTES (disperso en bot_client.py):
    bots = ['@OlimpoDataBot', '@SeleneSearch_Bot', ...]  # repetido 20+ veces

DESPUÉS (un solo lugar):
    from config.bots import FREE_BOTS, PREMIUM_BOTS

COMPATIBILIDAD: bot_client.py sigue funcionando sin cambios.
Este módulo es puramente aditivo. La migración se hace de forma
incremental cuando se refactorizan los métodos individuales.
"""

# ── Bots gratuitos ────────────────────────────────────────────────────────────
# Usados en: query_bot, query_operadora, query_telx, query_telp, query_cel,
#            query_record, search_with_sirius
FREE_BOTS: list[str] = [
    "@OlimpoDataBot",
    "@SeleneSearch_Bot",
    "@DEALERDATABOT",
    "@HexDataBOT",
    "@Infordata1_bot",
    "@ImperialData_bot",
]

# ── Bot de búsqueda por nombre ────────────────────────────────────────────────
# Usado como fallback principal para búsquedas por nombre (Sirius)
NAME_SEARCH_BOT: str = "@OlimpoDataBot"

# ── Bot de Fiscalía ───────────────────────────────────────────────────────────
# Usado en: query_fiscalia_bot
FISCALIA_BOT: str = "@Infordata1_bot"

# ── Comandos por tipo de consulta ─────────────────────────────────────────────
# Mapeo de tipo de consulta → comando que se envía al bot
BOT_COMMANDS: dict[str, str] = {
    "dni":                "/dnix",
    "operadora":          "/op",
    "telx":               "/telp",    # teléfonos por DNI (v1)
    "cel":                "/cel",     # titular por celular
    "record":             "/record",  # récord vehicular
    "c4_azul":            "/c4az",
    "c4_inscripcion":     "/c4in",
    "dni_electronico":    "/dnie",
    "dni_azul":           "/dniaz",
    "dni_amarillo":       "/dniam",
    "familiares_pdf":     "/fampdf",
    "familiares_texto":   "/famtxt",
    "antpen":             "/antpen",
    "antjud":             "/antjud",
    "antpol":             "/antpol",
    "arbol_visual":       "/arbol",
}

# ── Tiempos de espera por tipo de consulta (segundos) ─────────────────────────
# Espera inicial antes de comenzar el polling
INITIAL_WAIT: dict[str, int] = {
    "default":          2,
    "fiscalia":         8,
    "telx":             5,
    "operadora":        3,
    "familiares_pdf":   5,
    "facial":           5,
}

# Espera entre cada intento de polling
POLL_INTERVAL: int = 2  # segundos

# Número máximo de intentos de polling antes de asumir timeout
MAX_POLL_ATTEMPTS: dict[str, int] = {
    "default":    10,
    "fiscalia":   12,
    "telx":       12,
    "record":     10,
}
