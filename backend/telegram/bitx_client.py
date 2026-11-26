"""
telegram/bitx_client.py
───────────────────────
Cliente para @Bitxdatabot — el bot PREMIUM del sistema.

DIFERENCIAS CLAVE CON EL RESTO DE BOTS
──────────────────────────────────────
1. **Mensajes múltiples**: un comando puede devolver N mensajes.
   Ej. ``/dnif`` → 1 texto + 4 fotos. ``/dnivel`` → 2 fotos + texto.
   ``/denuncias`` → 1 PDF + 1 texto (o varios si hay muchas denuncias).
2. **Mensaje de progreso**: el bot responde ``⏳ GENERANDO ...`` y el
   resultado real llega 20-60 s después. Ese primer mensaje NO es el resultado.
3. **Anti-spam** por cuenta (3 s). Dos comandos seguidos pueden cruzarse.
4. **Coste**: cada comando descuenta créditos de la cuenta de Telegram del
   sistema (no del usuario web). El precio está en ``BOT_COMMANDS``.

Este módulo se comunica con el bot y delega el parseo en ``bitx_parser``.
"""

from __future__ import annotations

import asyncio
import re
import uuid
from dataclasses import dataclass, field
from pathlib import Path

from telegram.bitx_parser import (
    is_progress_message,
    is_sin_resultados,
    mensaje_legible,
    parse_bitx_response,
)
from telegram.exceptions import SinResultadosError

# ── Configuración de comandos ────────────────────────────────────────────────
# (comando, espera_inicial_segundos, max_reintentos_polling, etiqueta)
# Los tiempos salen de medir el bot real: /dniv y /seekerpdf tardan 30-55 s.
BOT_COMMANDS: dict[str, dict] = {
    # RENIEC
    "dni":              {"cmd": "/dni",   "wait": 12, "tries": 12, "label": "RENIEC ONLINE"},
    "dni_premium":      {"cmd": "/dnif",  "wait": 15, "tries": 14, "label": "RENIEC FULL BIOMETRIA"},
    "dni_azul":         {"cmd": "/dniv",  "wait": 25, "tries": 20, "label": "DNI VIRTUAL (AZUL)"},
    "dni_electronico":  {"cmd": "/dnivel","wait": 25, "tries": 20, "label": "DNI ELECTRONICO"},
    "dni_amarillo":     {"cmd": "/dniva", "wait": 20, "tries": 16, "label": "DNI AMARILLO"},
    # C4
    "c4_azul":          {"cmd": "/c4a",   "wait": 15, "tries": 14, "label": "C4A AZUL"},
    "c4_inscripcion":   {"cmd": "/c4i",   "wait": 15, "tries": 14, "label": "C4A INSCRIPCION"},
    # Familiares / hogar
    "hogar":            {"cmd": "/hogar", "wait": 15, "tries": 14, "label": "SISFOH HOGAR"},
    "arbol_texto":      {"cmd": "/ag",    "wait": 15, "tries": 14, "label": "ARBOL GENEALOGICO"},
    "arbol_visual":     {"cmd": "/agv",   "wait": 18, "tries": 16, "label": "ARBOL VISUAL"},
    "arbol_visual_pdf": {"cmd": "/agvpdf","wait": 20, "tries": 18, "label": "ARBOL VISUAL PDF"},
    # Telefonía
    "fonos":            {"cmd": "/fonos", "wait": 12, "tries": 12, "label": "LINEAS POR DNI"},
    "telp":             {"cmd": "/telp",  "wait": 12, "tries": 12, "label": "TITULAR DE LINEA"},
    # Seeker / metadata
    "seekerpdf":        {"cmd": "/seekerpdf", "wait": 30, "tries": 24, "label": "SEEKER PDF"},
    "seeker_texto":     {"cmd": "/seeker",    "wait": 25, "tries": 20, "label": "SEEKER TEXTO"},
    # Denuncias
    "denuncias":        {"cmd": "/denuncias",    "wait": 15, "tries": 14, "label": "DENUNCIAS DNI"},
    "denuncias_placa":  {"cmd": "/pladenuncias", "wait": 15, "tries": 14, "label": "DENUNCIAS PLACA"},
    # Facial (envía foto, no texto)
    "facial":           {"cmd": "/reco",  "wait": 20, "tries": 18, "label": "REPORTE FACIAL"},
}

# Prefijos de archivo que devuelve el bot → carpeta destino y extensión
_FILE_KINDS = {
    "C4A_Azul":            ("files", "pdf"),
    "C4A_Inscripcion":     ("files", "pdf"),
    "Consolidado_Seeker":  ("files", "pdf"),
    "DENUNCIA-":           ("files", "pdf"),
    "PLA-DENUNCIA-":       ("files", "pdf"),
    "REPORTE_FACIAL":      ("files", "pdf"),
    "DNI_Elect_Frontal":   ("images", "png"),
    "DNI_Elect_Reverso":   ("images", "png"),
    "DNI_Virtual_Frontal": ("images", "png"),
    "DNI_Virtual_Reverso": ("images", "png"),
    "DNI_Amarillo_Frontal":("images", "png"),
    "DNI_Amarillo_Reverso":("images", "png"),
}


@dataclass
class BitxResult:
    """
    Resultado normalizado de un comando de BitxData.

    Atributos:
        data:   Campos parseados del texto (dict).
        files:  Rutas relativas de los archivos descargados.
        photos: Rutas relativas de las fotos del mensaje (no documentos).
    """

    data: dict = field(default_factory=dict)
    files: list[str] = field(default_factory=list)
    photos: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        out = dict(self.data)
        if self.files:
            out["file_path"] = self.files[0]
            out["file_paths"] = self.files
        if self.photos:
            out["image_paths"] = self.photos
            if len(self.photos) >= 1:
                out["frontal"] = self.photos[0]
            if len(self.photos) >= 2:
                out["reverso"] = self.photos[1]

            # ── Orden real de las fotos de /dnif (verificado por proporción) ──
            # 1 → retrato vertical 1.40  = rostro
            # 2 → apaisada 0.39          = firma
            # 3 → retrato vertical 1.44  = huella izquierda
            # 4 → retrato vertical 1.3-1.5 = huella derecha
            # Antes se asumía [cara, huella, huella, firma], por eso la firma
            # aparecía en el hueco de la huella izquierda.
            if len(self.photos) >= 4:
                out["foto_rostro"]       = self.photos[0]
                out["firma_imagen"]      = self.photos[1]
                out["huella_izquierda"]  = self.photos[2]
                out["huella_derecha"]    = self.photos[3]
        return out


# ── Serialización de comandos ────────────────────────────────────────────────
# PROBLEMA: BitxData responde de forma asíncrona y sus mensajes se intercalan.
# Si dos usuarios consultan a la vez, el polling de uno puede leer la respuesta
# del otro (se comprobó: /dniv devolvía el título de un /dnif ajeno).
#
# SOLUCIÓN: un lock global. Solo hay una conversación con el bot a la vez, igual
# que hace el BotPool con los bots gratuitos. Con anti-spam de 3 s del bot,
# tampoco se pueden paralelizar más de 1-2 comandos sin que falle.
_BITX_LOCK = asyncio.Lock()


def _target_dir(kind: str, static_base_dir: Path) -> Path:
    d = static_base_dir / kind
    d.mkdir(parents=True, exist_ok=True)
    return d


def _safe_ext(msg) -> str:
    """Extensión real del archivo del mensaje."""
    if msg.document and getattr(msg.document, "mime_type", ""):
        mime = msg.document.mime_type
        if "pdf" in mime:
            return "pdf"
        if "png" in mime:
            return "png"
        if "jpeg" in mime or "jpg" in mime:
            return "jpg"
    if msg.photo:
        return "jpg"
    if msg.file and getattr(msg.file, "ext", None):
        return msg.file.ext.lstrip(".").lower()
    return "bin"


def _classify(name: str | None, msg) -> tuple[str, str]:
    """Devuelve (carpeta, extensión) según el nombre del archivo del bot."""
    if name:
        for prefix, (folder, ext) in _FILE_KINDS.items():
            if name.startswith(prefix):
                return folder, ext
    ext = _safe_ext(msg)
    folder = "images" if ext in ("png", "jpg", "jpeg") else "files"
    return folder, ext


async def _download(
    msg,
    name_hint: str | None,
    static_base_dir: Path,
    fallback_prefix: str = "FILE",
) -> str | None:
    """
    Descarga el media del mensaje con nombre NO adivinable (uuid).

    Args:
        name_hint:       Nombre real del archivo si el bot lo envía como documento.
        fallback_prefix: Prefijo a usar cuando es una foto sin nombre
                         (p. ej. "DNIF_FOTO_1" para las biometrías).

    Devuelve la ruta relativa ("images/xxx.png") o None si no hay media.
    """
    if not msg.media:
        return None
    folder, ext = _classify(name_hint, msg)
    base = (name_hint or fallback_prefix).rsplit(".", 1)[0]
    prefix = re.sub(r"[^A-Za-z0-9_-]+", "_", base)[:40]
    filename = f"{prefix}_{uuid.uuid4().hex}.{ext}"
    dest = _target_dir(folder, static_base_dir) / filename
    await msg.download_media(file=dest)
    return f"{folder}/{filename}"


async def run_command(
    client,
    command_key: str,
    argument: str,
    static_base_dir: Path,
    *,
    bot_username: str,
    file_path: str | None = None,
) -> BitxResult:
    """
    Ejecuta un comando de BitxData y devuelve el resultado normalizado.

    Args:
        client:          TelegramClient conectado con la cuenta premium.
        command_key:     Clave de ``BOT_COMMANDS``.
        argument:        DNI, placa o teléfono que se envía tras el comando.
        static_base_dir: Directorio backend/static/.
        bot_username:    Username del bot (@Bitxdatabot).
        file_path:       Solo para /reco: ruta de la imagen a enviar.

    Returns:
        BitxResult con data + archivos descargados.

    Raises:
        SinResultadosError: si el bot no encuentra datos o rechaza el formato.
        Exception:          si expira el tiempo de espera.
    """
    cfg = BOT_COMMANDS.get(command_key)
    if not cfg:
        raise ValueError(f"Comando de BitxData desconocido: {command_key}")

    comando = cfg["cmd"]
    espera = cfg["wait"]
    intentos = cfg["tries"]
    etiqueta = cfg["label"]

    # Serializamos TODA la conversación con el bot: los mensajes de comandos
    # concurrentes se cruzan y el resultado acabaría siendo de otra consulta.
    async with _BITX_LOCK:
        print(f"💎 [BITX] {etiqueta}: {comando} {argument}")

        # ── Enviar comando ───────────────────────────────────────────────────
        if file_path:
            sent = await client.send_file(bot_username, file_path, caption=comando)
        else:
            texto = f"{comando} {argument}".strip() if argument else comando
            sent = await client.send_message(bot_username, texto)

        await asyncio.sleep(espera)

        # ── Polling de la respuesta ──────────────────────────────────────────
        result = BitxResult()
        visto: set[int] = set()
        texto_final = ""
        progreso_visto = False

        for intento in range(intentos):
            print(f"🔄 [BITX] {etiqueta} intento {intento + 1}/{intentos}...")

            async for msg in client.iter_messages(
                bot_username, limit=20, min_id=sent.id, reverse=True
            ):
                if msg.id in visto:
                    continue
                visto.add(msg.id)
                texto = msg.text or ""

                # 1. Mensaje de "generando..." → seguir esperando
                if is_progress_message(texto):
                    progreso_visto = True
                    continue

                # 2. Sin resultados → cortar con mensaje limpio para el usuario
                if is_sin_resultados(texto):
                    raise SinResultadosError(mensaje_legible(texto))

                # 3. Media sin texto → puede ser una de las fotos del resultado
                if msg.media:
                    nombre = msg.file.name if msg.file else None
                    # El nombre que envía el bot incluye el DNI: si no coincide
                    # con el que pedimos, es de otra consulta y se descarta.
                    # (En /reco el PDF no lleva DNI, así que solo filtramos si
                    #  el nombre contiene dígitos de 8 cifras.)
                    if nombre and argument and re.search(r"\d{8}", nombre) \
                            and str(argument) not in nombre:
                        print(f"   ⏭️  descartado {nombre} (no es de {argument})")
                        continue
                    fallback = f"{comando.strip('/').upper()}_FOTO_{len(result.photos) + 1}"
                    ruta = await _download(msg, nombre, static_base_dir, fallback)
                    if ruta:
                        if ruta.startswith("images/"):
                            result.photos.append(ruta)
                        else:
                            result.files.append(ruta)

                # 4. Texto con datos → parsear y acumular
                #    (el facial no trae campos ➮, solo una frase + PDF)
                if texto and ("➮" in texto or (msg.media and texto.strip())):
                    # Mismo filtro por DNI para el texto
                    if argument and re.search(r"\d{8}", texto) \
                            and str(argument) not in texto:
                        print(f"   ⏭️  texto descartado (no menciona {argument})")
                        continue
                    parsed = parse_bitx_response(texto)
                    if parsed.get("_title") or len(parsed) > 4:
                        if not texto_final:
                            texto_final = texto
                            result.data = dict(parsed)

            # Criterio de fin: tenemos texto parseado o al menos un archivo
            if texto_final or result.files or result.photos:
                if progreso_visto or (result.files or len(result.photos) >= 2):
                    break

            await asyncio.sleep(3)

        if not texto_final and not result.files and not result.photos:
            raise Exception(
                f"El bot no respondió a tiempo ({etiqueta}). Inténtalo nuevamente."
            )

        return result
