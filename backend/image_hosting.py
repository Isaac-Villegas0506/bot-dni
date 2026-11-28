"""
Almacenamiento permanente de imágenes de consulta.

Problema que resuelve
---------------------
Render no tiene disco persistente: `static/images/` se vacía en cada deploy o
reinicio. Como la caché de `personas` guardaba `/api/static/images/...`, al
repetir la consulta el usuario recibía la ficha SIN foto (el archivo ya no
existía).

Solución
--------
Subir la foto a ImgBB (ya se usa para los comprobantes de compra) y guardar esa
URL absoluta en la caché. ImgBB devuelve una URL permanente, así que la foto
sobrevive a reinicios, deploys y a la propia caché.

Si ImgBB no está configurado o falla, se devuelve None y el llamador sigue con
la ruta local (comportamiento anterior).
"""
from __future__ import annotations

import base64
import logging
import os
from pathlib import Path

import httpx

logger = logging.getLogger(__name__)

IMGBB_UPLOAD = "https://api.imgbb.com/1/upload"
# 32 MB es el máximo de la API; las fotos de DNI rondan 50-200 KB.
_MAX_BYTES = 5 * 1024 * 1024


def imgbb_configurado() -> bool:
    return bool(os.getenv("IMGBB_API_KEY"))


async def subir_imagen(ruta: Path, nombre: str | None = None) -> str | None:
    """
    Sube una imagen local a ImgBB y devuelve su URL pública.

    Args:
        ruta:   Archivo de imagen en disco.
        nombre: Nombre a mostrar en ImgBB (por defecto, el del archivo).

    Returns:
        URL https de ImgBB, o None si no se pudo subir.
    """
    key = os.getenv("IMGBB_API_KEY")
    if not key:
        return None

    try:
        if not ruta.exists():
            logger.warning(f"[IMG] No existe {ruta}")
            return None
        contenido = ruta.read_bytes()
        if len(contenido) > _MAX_BYTES:
            logger.warning(f"[IMG] {ruta.name} supera el límite de ImgBB")
            return None

        async with httpx.AsyncClient(timeout=30) as client:
            res = await client.post(
                IMGBB_UPLOAD,
                data={
                    "key": key,
                    "image": base64.b64encode(contenido).decode("utf-8"),
                    "name": nombre or ruta.stem,
                },
            )
            datos = res.json()
            if res.status_code == 200 and datos.get("success"):
                url = datos["data"]["url"]
                logger.info(f"[IMG] Subida a ImgBB: {ruta.name}")
                return url
            logger.error(f"[IMG] ImgBB rechazó {ruta.name}: {datos}")
    except Exception as e:
        logger.error(f"[IMG] Error subiendo {ruta.name}: {e}")
    return None


async def url_permanente(ruta_relativa: str, static_base: Path) -> str | None:
    """
    Devuelve una URL permanente para una imagen de `static/`.

    Sube el archivo a ImgBB y devuelve su URL. Si ya es una URL absoluta
    (p. ej. porque la caché la guardó así), la devuelve sin tocar.
    """
    if not ruta_relativa:
        return None
    if ruta_relativa.startswith("http"):
        return ruta_relativa
    ruta = static_base / ruta_relativa.lstrip("/")
    return await subir_imagen(ruta)
