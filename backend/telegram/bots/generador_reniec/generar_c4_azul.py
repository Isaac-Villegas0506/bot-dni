from pathlib import Path
from telegram.bots.generador_reniec.base import _generate_c4

async def generate_c4_azul(client, dni: str, static_base_dir: Path) -> dict:
    """Genera Ficha C4 Azul usando el comando /c4."""
    return await _generate_c4(client, dni, "/c4", "C4_AZUL", static_base_dir, "C4 Azul")
