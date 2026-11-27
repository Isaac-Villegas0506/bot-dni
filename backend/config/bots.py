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
# Verificados el 2026-11-26 con AMBAS cuentas (ver diagnosticar_bots.py):
#
#   OK      @SeleneSearch_Bot   C1+C2   menú de consultas
#   OK      @DEALERDATABOT      C1+C2   menú de consultas
#   OK      @HexDataBOT         C1+C2   menú de consultas
#   OK      @ImperialData_bot   C1+C2   menú de consultas
#   OK      @olimpodataxbot     C1+C2   NUEVO: reemplazo de @OlimpoDataBot
#
#   MUERTO  @OlimpoDataBot      C1+C2   "ha dejado de prestar servicios",
#                                        migró a @olimpodataxbot
#   TIENDA  @Infordata1_bot     C1+C2   ahora es mitienda_luffyventas
#                                        (tienda de ropa, no hace consultas)
#
# Se conservan solo los verificados: los caídos gastaban un intento completo
# (hasta 45 s) en cada consulta antes de saltar al siguiente.
FREE_BOTS: list[str] = [
    "@SeleneSearch_Bot",
    "@DEALERDATABOT",
    "@HexDataBOT",
    "@ImperialData_bot",
    "@olimpodataxbot",
]

# ── Bot PREMIUM (todas las consultas de pago) ────────────────────────────────
# @Bitxdatabot sustituye a @Infordata1_bot para TODA la operación premium:
# RENIEC full, C4, DNI virtuales, familiares, telefonía, denuncias, facial
# y el reporte Seeker. La configuración de comandos está en
# telegram/bitx_client.py (BOT_COMMANDS_BITX).
PREMIUM_BOT: str = "@Bitxdatabot"

# ── Bot de búsqueda por nombre ────────────────────────────────────────────────
NAME_SEARCH_BOT: str = "@SeleneSearch_Bot"

# ── Bot de Fiscalía ───────────────────────────────────────────────────────────
# Fiscalía sigue usando el pool gratuito mientras no haya comando en BitxData.
FISCALIA_BOT: str = "@SeleneSearch_Bot"

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
