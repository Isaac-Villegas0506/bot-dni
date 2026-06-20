from pathlib import Path
from telegram.bots.generador_reniec.base import _generate_c4

async def generate_c4_inscripcion(client, dni: str, static_base_dir: Path) -> dict:
    """Genera Ficha de Inscripción C4 usando el comando /c4i."""
    return await _generate_c4(client, dni, "/c4i", "C4_INSCRIPCION", static_base_dir, "C4 Inscripción")
