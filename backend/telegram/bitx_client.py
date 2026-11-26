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
import os
import re
import uuid
from dataclasses import dataclass, field
from pathlib import Path

from telegram.bitx_parser import (
    is_progress_message,
    is_sin_resultados,
    mensaje_legible,
    merge_numeros,
    parse_bitx_response,
    parse_lineas_txt,
)
from telegram.exceptions import SinResultadosError

# ── Configuración de comandos ────────────────────────────────────────────────
# (comando, tiempo_maximo_segundos, etiqueta)
# `timeout` es el techo de espera total, no una espera fija: el bucle sondea
# cada POLL_INTERVAL y corta en cuanto llega el resultado. Los valores salen de
# medir el bot real (los más lentos: /dniv ~106 s, /seekerpdf ~99 s).
BOT_COMMANDS: dict[str, dict] = {
    # RENIEC
    "dni":              {"cmd": "/dni",   "timeout": 60,  "label": "RENIEC ONLINE"},
    "dni_premium":      {"cmd": "/dnif",  "timeout": 120, "label": "RENIEC FULL BIOMETRIA"},
    "dni_azul":         {"cmd": "/dniv",  "timeout": 210, "label": "DNI VIRTUAL (AZUL)"},
    "dni_electronico":  {"cmd": "/dnivel","timeout": 210, "label": "DNI ELECTRONICO"},
    "dni_amarillo":     {"cmd": "/dniva", "timeout": 150, "label": "DNI AMARILLO"},
    # C4
    "c4_azul":          {"cmd": "/c4a",   "timeout": 120, "label": "C4A AZUL"},
    "c4_inscripcion":   {"cmd": "/c4i",   "timeout": 120, "label": "C4A INSCRIPCION"},
    # Familiares / hogar
    "hogar":            {"cmd": "/hogar", "timeout": 120, "label": "SISFOH HOGAR"},
    "arbol_texto":      {"cmd": "/ag",    "timeout": 120, "label": "ARBOL GENEALOGICO"},
    "arbol_visual":     {"cmd": "/agv",   "timeout": 150, "label": "ARBOL VISUAL"},
    "arbol_visual_pdf": {"cmd": "/agvpdf","timeout": 180, "label": "ARBOL VISUAL PDF"},
    # Telefonía
    "fonos":            {"cmd": "/fonos", "timeout": 60,  "label": "LINEAS POR DNI"},
    "telp":             {"cmd": "/telp",  "timeout": 60,  "label": "TITULAR DE LINEA"},
    # Seeker / metadata
    "seekerpdf":        {"cmd": "/seekerpdf", "timeout": 210, "label": "SEEKER PDF"},
    "seeker_texto":     {"cmd": "/seeker",    "timeout": 180, "label": "SEEKER TEXTO"},
    # Denuncias
    "denuncias":        {"cmd": "/denuncias",    "timeout": 120, "label": "DENUNCIAS DNI"},
    "denuncias_placa":  {"cmd": "/pladenuncias", "timeout": 120, "label": "DENUNCIAS PLACA"},
    # Facial (envía foto, no texto)
    "facial":           {"cmd": "/reco",  "timeout": 150, "label": "REPORTE FACIAL"},
}

# Sondeo de la respuesta. El bot suele contestar en 2-15 s; se consulta cada
# 1.5 s en vez de dormir el `wait` completo. STABLE_CYCLES = cuántos ciclos
# seguidos sin mensajes nuevos se toleran antes de dar la respuesta por cerrada
# (el bot a veces parte el resultado en varios mensajes).
POLL_INTERVAL = 1.5
STABLE_CYCLES = 2
# Si ya hay archivos pero aún no texto, se espera más: el bot manda los PDF
# primero y el listado (denuncias, líneas) unos segundos después.
STABLE_CYCLES_SIN_TEXTO = 6

# Prefijos de archivo que devuelve el bot → carpeta destino y extensión
_FILE_KINDS = {
    "C4A_Azul":            ("files", "pdf"),
    "C4A_Inscripcion":     ("files", "pdf"),
    "Consolidado_Seeker":  ("files", "pdf"),
    "Seeker_":             ("files", "txt"),
    "Lineas_":             ("files", "txt"),
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

# El bot trunca el texto ("...y 1 línea(s) más") y manda el listado completo
# en un .txt adjunto. Sin leerlo, /fonos devolvía 5 de 6 líneas.
_TXT_COMPANIONS = ("Lineas_", "Seeker_")


@dataclass
class BitxResult:
    """
    Resultado normalizado de un comando de BitxData.

    Atributos:
        data:     Campos parseados del texto (dict).
        files:    Rutas relativas de los archivos descargados.
        photos:   Rutas relativas de las fotos del mensaje (no documentos).
        raw_text: Texto crudo del bot. El frontend lo usa para listar las
                  denuncias (numero, condicion, fecha del hecho).
    """

    data: dict = field(default_factory=dict)
    files: list[str] = field(default_factory=list)
    photos: list[str] = field(default_factory=list)
    raw_text: str = ""

    def to_dict(self) -> dict:
        out = dict(self.data)
        if self.raw_text:
            out["raw_text"] = self.raw_text
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
    timeout = cfg["timeout"]
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

        # ── Polling de la respuesta ──────────────────────────────────────────
        # Antes había un sleep fijo de 12-30 s antes de mirar y luego sondeos
        # cada 3 s: aunque el bot respondiera en 3 s, /fonos tardaba >=45 s y
        # /dniv >=82 s. Ahora se consulta cada POLL_INTERVAL y se corta en
        # cuanto llega el resultado definitivo.
        result = BitxResult()
        visto: set[int] = set()
        texto_final = ""
        progreso_visto = False
        ultimo_msg_id = sent.id
        quietos = 0          # ciclos seguidos sin mensajes nuevos
        inicio = asyncio.get_event_loop().time()
        primer_msg_en = None   # para medir la latencia real del bot

        while asyncio.get_event_loop().time() - inicio < timeout:
            nuevos = 0

            async for msg in client.iter_messages(
                bot_username, limit=20, min_id=ultimo_msg_id, reverse=True
            ):
                if msg.id in visto:
                    continue
                visto.add(msg.id)
                ultimo_msg_id = max(ultimo_msg_id, msg.id)
                nuevos += 1
                texto = msg.text or ""
                if primer_msg_en is None:
                    primer_msg_en = asyncio.get_event_loop().time() - inicio
                    print(f"   ⏱️  primer mensaje del bot a los {primer_msg_en:.1f}s")

                # 1. Mensaje de "generando..." → seguir esperando
                if is_progress_message(texto):
                    progreso_visto = True
                    continue

                # 2. Sin resultados → cortar con mensaje limpio para el usuario
                if is_sin_resultados(texto):
                    raise SinResultadosError(mensaje_legible(texto))

                # 3. Texto con datos → parsear y acumular.
                #    Se procesa ANTES del media: el bot adjunta el título y el
                #    listado en el mismo mensaje que el último PDF
                #    ("DENUNCIA-...-3.pdf ⟨ #BITX ⟩ ➟ DENUNCIAS (1-3/5)").
                if texto and "➮" in texto:
                    parsed = parse_bitx_response(texto)
                    # El bot cierra con su propio encabezado. Solo se acepta
                    # si lo trae: un texto suelto sin cabecera pertenece a una
                    # respuesta anterior. No se filtra por DNI porque hay
                    # respuestas que no lo incluyen (/denuncias lista números
                    # de denuncia de 8 cifras y se confundirían con un DNI).
                    if "_title" in parsed:
                        if not texto_final:
                            texto_final = texto
                            result.raw_text = texto
                            result.data = dict(parsed)
                    elif len(parsed) > 4 and not texto_final:
                        texto_final = texto
                        result.raw_text = texto
                        result.data = dict(parsed)

                # 4. Media → puede ser una de las fotos o un PDF del resultado
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

            # ── Criterio de fin ──────────────────────────────────────────────
            # El bot manda el resultado en varios mensajes (texto + 1-2 fotos o
            # un PDF). Antes se esperaba a "progreso_visto o 2 archivos", lo que
            # forzaba sondeos de más. Ahora:
            #   - texto parseado + al menos un archivo -> listo
            #   - sin mensajes nuevos durante N ciclos -> terminado. N es mayor
            #     si aún no llegó el texto: en /denuncias el bot manda primero
            #     los PDF (DENUNCIA-*.pdf) y el listado de denuncias después.
            if texto_final and (result.files or result.photos):
                break
            if texto_final or result.files or result.photos:
                if nuevos == 0:
                    quietos += 1
                    limite = STABLE_CYCLES if texto_final else STABLE_CYCLES_SIN_TEXTO
                    if quietos >= limite:
                        break
                else:
                    quietos = 0

            await asyncio.sleep(POLL_INTERVAL)

        if not texto_final and not result.files and not result.photos:
            raise Exception(
                f"El bot no respondió a tiempo ({etiqueta}). Inténtalo nuevamente."
            )

        # ── Enriquecer con el .txt adjunto ───────────────────────────────
        # /fonos y /seeker truncan el mensaje ("...y N línea(s) más") y mandan
        # el listado completo en un .txt. Sin leerlo se perdían filas.
        for rel in result.files:
            nombre = os.path.basename(rel)
            if not any(nombre.startswith(p) for p in _TXT_COMPANIONS):
                continue
            try:
                ruta = static_base_dir / rel
                contenido = ruta.read_text(encoding="utf-8", errors="replace")
                txt_data = parse_lineas_txt(contenido)
                numeros = merge_numeros(result.data, txt_data)
                if numeros:
                    result.data["numeros"] = numeros
                    result.data["total_lineas"] = txt_data.get("total") or len(numeros)
                    if txt_data.get("titular"):
                        result.data.setdefault("nombres", txt_data["titular"])
                    print(f"   📄 {nombre}: {len(numeros)} líneas del txt")
            except Exception as e:
                print(f"   ⚠️  no se pudo leer {nombre}: {e}")

        return result
