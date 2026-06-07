import re
import os
import time
from telethon import TelegramClient
from telethon.sessions import StringSession
import asyncio
import traceback
from bot_pool import BotPool
from pathlib import Path
from parser import parse_bot_response


class SinResultadosError(Exception):
    """Raised when the bot explicitly reports no results found."""
    pass


class BotClient:
    def __init__(self):
        self.api_id = os.getenv("TELEGRAM_API_ID")
        self.api_hash = os.getenv("TELEGRAM_API_HASH")
        # Soporte para Vercel/Render (StringSession)
        session_string = os.getenv("TELEGRAM_SESSION_STRING")
        if session_string:
            print("[OK] Usando StringSession desde variable de entorno")
            self.client = TelegramClient(StringSession(session_string), self.api_id, self.api_hash)
        else:
            self.session_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'anon')
            self.client = TelegramClient(self.session_path, self.api_id, self.api_hash)
        self.target_bot = os.getenv("TARGET_BOT_USERNAME") 
        self.name_search_bot = '@OlimpoDataBot'
        self.bot_pool = None  # Will be set externally
        
        # Cliente secundario para balanceo (consultas gratis)
        session_string2 = os.getenv("TELEGRAM_SESSION_STRING_2")
        self.client2 = None
        if session_string2:
            print("[OK] Usando StringSession 2 para balanceo de carga")
            api_id2 = int(os.getenv("TELEGRAM_API_ID_2", self.api_id))
            api_hash2 = os.getenv("TELEGRAM_API_HASH_2", self.api_hash)
            self.client2 = TelegramClient(StringSession(session_string2), api_id2, api_hash2)
        
        # Premium Config
        self.premium_group_id = int(os.getenv("TELEGRAM_GROUP_ID", "0"))
        self.premium_bot_id = int(os.getenv("TELEGRAM_PREMIUM_BOT_ID", "0"))

    async def start(self):
        print(f"[BOT] (Re)Iniciando cliente Telegram...")
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
                    print("[ERROR] Cliente 2 no autorizado o sesion invalida.")
        except Exception as e:
            print(f"❌ Error conectando: {e}")
            if "AuthKeyDuplicatedError" in str(e):
                print("⚠️ ADVERTENCIA: Se detectó una sesión duplicada. Si estás en Render, asegúrate de usar '--workers 1'.")

    async def stop(self):
        await self.client.disconnect()
        if self.client2:
            await self.client2.disconnect()

    async def _ensure_connection(self):
        """Asegura que los clientes estén conectados. Si no, intenta reconectar."""
        try:
            if not self.client.is_connected():
                await self.client.connect()
            
            if self.client2 and not self.client2.is_connected():
                await self.client2.connect()
        except Exception as e:
            print(f"🔄 Error en _ensure_connection: {e}. Intentando reconexión forzada...")
            try:
                await self.client.disconnect()
                await self.client.connect()
                if self.client2:
                    await self.client2.disconnect()
                    await self.client2.connect()
            except: pass

    def _check_antispam(self, text):
        """Verifica si el texto es un mensaje de enfriamiento y extrae segundos."""
        if "anti-spam" in text.lower() or "debes esperar" in text.lower():
            # Regex más flexible: busca 'esperar', algo de texto intermedio, y luego digitos.digitos + 's'
            m = re.search(r'(\d+(?:\.\d+)?)\s*s', text, re.IGNORECASE)
            if m:
                seconds = m.group(1)
                return f"POR FAVOR ESPERA {seconds} SEGUNDOS Y VUELVE A GENERAR TU CONSULTA"
            else:
                return "POR FAVOR ESPERA UN MOMENTO Y VUELVE A GENERAR TU CONSULTA"
        return None

    def _is_sin_resultados(self, text):
        """Detecta si el bot reportó que no hay información."""
        if not text: return False
        text_upper = text.upper()
        # Términos comunes de 'Sin Resultados' en los bots
        terminos = [
            "SIN RESULTADOS", 
            "NO SE ENCONTRÓ INFORMACIÓN", 
            "REGISTRO VACÍO",
            "ʀᴇɢɪsᴛʀᴏ ᴠᴀᴄɪᴏ",
            "NO SE ENCONTRARON DATOS EN LA BASE DE DATOS",
            "DNI NO ENCONTRADO",
            "NO SE HALLÓ INFORMACIÓN BIOMÉTRICA",
            "INFORMACIÓN BIOMÉTRICA",
            "NO EXISTE EN LA BASE DE DATOS",
            "CRÉDITOS NO DESCONTADOS",
            # Formato exacto del bot facial con emojis japoneses
            "SIN RESULTADOS. VERIFIQUE LOS DATOS",
            "VERIFIQUE LOS DATOS E INTENTE NUEVAMENTE",
        ]
        # También detectar el patrón con corchetes japoneses 「❌️」
        if "SIN RESULTADOS" in text_upper:
            return True
        return any(t in text_upper for t in terminos)

    async def query_bot(self, dni):
        """Consulta por DNI a varios bots con control de concurrencia."""
        await self._ensure_connection()
        bots = [
            '@OlimpoDataBot', 
            '@SeleneSearch_Bot', 
            '@DEALERDATABOT', 
            '@HexDataBOT', 
            '@Infordata1_bot', 
            '@ImperialData_bot'
        ]
        bots = list(dict.fromkeys([b for b in bots if b])) 
        
        last_err = None
        for bot in bots:
            # Acquire exclusive access to this bot
            acquired_bot = None
            if self.bot_pool:
                acquired_bot = await self.bot_pool.acquire_bot([bot], timeout=5)
                if not acquired_bot:
                    print(f"⏰ {bot} ocupado, intentando siguiente...")
                    continue
            
            try:
                # Seleccionar cliente al azar para distribuir la carga (solo bots gratis)
                import random
                active_client = random.choice([self.client, self.client2]) if self.client2 else self.client
                client_name = "Cliente 2" if active_client == self.client2 else "Cliente 1"

                print(f"🤖 Consultando DNI {dni} en {bot} usando {client_name}...")

                # ── Capturar el ID del último mensaje ANTES de enviar el comando ──
                # Así podemos detectar si el bot responde con un mensaje NUEVO.
                try:
                    prior = await active_client.get_messages(bot, limit=1)
                    baseline_id = prior[0].id if prior else 0
                except Exception:
                    baseline_id = 0

                await active_client.send_message(bot, f'/dnix {dni}')

                # Esperar inicial
                await asyncio.sleep(2)

                # Loop de polling
                max_waits = 10
                wait_step = 2

                final_text = ""
                found_result = False
                found_spam = None

                for i in range(max_waits):
                    # Obtener último mensaje del bot
                    msgs = await active_client.get_messages(bot, limit=1)
                    if not msgs:
                        await asyncio.sleep(wait_step)
                        continue

                    msg = msgs[0]
                    text = msg.text or ""
                    is_new_msg = msg.id > baseline_id  # ¿Es una respuesta a NUESTRO comando?

                    # 1. Chequeo Anti-Spam
                    spam_msg = self._check_antispam(text)
                    if spam_msg:
                        found_spam = spam_msg
                        break  # Ir al siguiente bot

                    # 2. Chequeo de espera (solo si es mensaje nuevo)
                    wait_keywords = ["procesando", "wait", "recopilando", "buscando", "cargando", "analizando", "espere", "moment"]
                    if any(k in text.lower() for k in wait_keywords):
                        print(f"⏳ {bot} ({i+1}/{max_waits}): {text[:30]}...")
                        await asyncio.sleep(wait_step)
                        continue

                    # 3. Sin Resultados explícito — detener cadena completa
                    if self._is_sin_resultados(text):
                        print(f"⛔ {bot} reportó Sin Resultados.")
                        raise SinResultadosError("No se encontraron resultados para los datos ingresados. Verifica la información e intenta nuevamente.")

                    # 4. Detectar si el mensaje contiene campos de datos reales
                    text_upper = text.upper()
                    has_data_fields = any(k in text_upper for k in [
                        "NOMBRES", "APELLIDOS", "DOCUMENTO", "FECHA", "DIRECCION", "DISTRITO"
                    ])

                    if has_data_fields and is_new_msg:
                        # Verificar si los datos son N/A / vacíos
                        is_na_response = (
                            ("NOMBRES" in text_upper and "N/A" in text_upper) or
                            ("NOMBRES" in text_upper and "NO ESPECIFICADO" in text_upper) or
                            ("DOCUMENTO" in text_upper and "NONE" in text_upper)
                        )
                        if is_na_response:
                            print(f"⛔ {bot} devolvió datos N/A para DNI {dni}.")
                            raise SinResultadosError(f"No se encontraron datos para el DNI {dni}. Verifica el número e intenta nuevamente.")

                        # Descargar imagen si hay
                        img_path_rel = None
                        if msg.media:
                            images_dir = os.path.join(os.path.dirname(__file__), 'static', 'images')
                            os.makedirs(images_dir, exist_ok=True)
                            filename = f"{dni}.jpg"
                            abs_path = os.path.join(images_dir, filename)
                            await msg.download_media(file=abs_path)
                            img_path_rel = f"images/{filename}"

                        print(f"✅ Éxito con {bot}")
                        return text, img_path_rel

                    # 5. Mensaje nuevo del bot sin campos de datos → puede ser confirmación
                    #    corta o mensaje de otro flujo. Seguir esperando.
                    if is_new_msg:
                        print(f"⏳ {bot} ({i+1}/{max_waits}): respuesta intermedia, esperando datos...")

                    await asyncio.sleep(wait_step)

                # Fin del loop de polling
                if found_spam:
                    print(f"⚠️ {bot} en enfriamiento: {found_spam}")
                    last_err = found_spam
                    continue
                    
                if not found_result:
                     print(f"⚠️ {bot} Timeout o respuesta desconocida. Texto último: {text[:50]}...")
                     if not last_err: last_err = f"{bot} sin respuesta válida"
                     
            except SinResultadosError:
                raise  # Detener toda la cadena — si no hay datos, no tiene sentido probar más bots
            except Exception as e:
                print(f"⚠️ Err {bot}: {e}")
                last_err = str(e)
                continue
            finally:
                # Always release the bot
                if self.bot_pool and acquired_bot:
                    await self.bot_pool.release_bot(acquired_bot)
        
        # Si fallaron todos y el último error fue de spam, lanzamos ese mensaje al usuario
        if last_err and "POR FAVOR ESPERA" in str(last_err):
            raise Exception(last_err)
            
        raise Exception(f"No results: {last_err}")

    async def query_operadora(self, phone: str) -> dict:
        """Verifica la operadora de un número telefónico usando /op en bots gratuitos.
        Respuesta esperada:
          TELEFONO ➾ 928669585
          OPERADOR ➾ CLARO
          EMPRESA  ➾ AMERICA MOVIL PERU S.A.C.
          RUC      ➾ 20467534026
          FECHA    ➾ 2020 - 2024
        Retorna dict con campos: telefono, operador, empresa, ruc, fecha
        """
        await self._ensure_connection()

        # Bots gratuitos que responden al comando /op
        free_bots = [
            '@OlimpoDataBot', 
            '@SeleneSearch_Bot', 
            '@DEALERDATABOT', 
            '@HexDataBOT', 
            '@Infordata1_bot', 
            '@ImperialData_bot'
        ]
        free_bots = list(dict.fromkeys([b for b in free_bots if b]))

        last_err = None

        for bot in free_bots:
            try:
                import random
                active_client = random.choice([self.client, self.client2]) if self.client2 else self.client
                client_name = "Cliente 2" if active_client == self.client2 else "Cliente 1"

                # Guardar baseline para detectar mensaje nuevo
                try:
                    prior = await active_client.get_messages(bot, limit=1)
                    baseline_id = prior[0].id if prior else 0
                except Exception:
                    baseline_id = 0

                print(f"📡 Enviando /op {phone} a {bot} usando {client_name}...")
                await active_client.send_message(bot, f'/op {phone}')

                await asyncio.sleep(3)

                max_waits = 8
                wait_step = 2

                for i in range(max_waits):
                    msgs = await active_client.get_messages(bot, limit=1)
                    if not msgs:
                        await asyncio.sleep(wait_step)
                        continue

                    msg = msgs[0]
                    text = msg.text or ""
                    is_new = msg.id > baseline_id

                    # Anti-spam
                    spam_msg = self._check_antispam(text)
                    if spam_msg:
                        print(f"⚠️ {bot} anti-spam, intentando siguiente...")
                        last_err = spam_msg
                        break

                    # Sin resultados
                    if self._is_sin_resultados(text):
                        raise SinResultadosError(
                            "No se encontró información para este número. Verifique el número e intente nuevamente."
                        )

                    # Espera
                    wait_kw = ["procesando", "wait", "buscando", "cargando", "espere", "moment"]
                    if any(k in text.lower() for k in wait_kw):
                        await asyncio.sleep(wait_step)
                        continue

                    # Detectar respuesta válida de operadora
                    text_upper = text.upper()
                    is_op_response = (
                        ("OPERADOR" in text_upper or "OPERADORA" in text_upper) and
                        ("TELEFON" in text_upper or "NÚMERO" in text_upper or "NUMERO" in text_upper)
                    )

                    if is_op_response and is_new:
                        import re as _re

                        # Strip Telegram markdown bold/italic/code from the WHOLE text first
                        # Bot sends: **TELEFONO** ➾ 928669585  → we need: TELEFONO ➾ 928669585
                        clean_text = _re.sub(r'[\*_`~]+', '', text)

                        # Separator-agnostic: match ANY non-letter/digit chars between label and value
                        def rx_field(label_pattern, text_content):
                            pattern = rf'(?im)^[ \t]*(?:{label_pattern})[ \t]*[^a-zA-Z0-9\n\r]{{1,10}}[ \t]*(.+?)[ \t]*$'
                            m = _re.search(pattern, text_content)
                            if m:
                                val = m.group(1).strip()
                                val = _re.sub(r'[\*_`~]+', '', val).strip()
                                return val if val and val not in ('—', '-') else ''
                            return ''

                        raw_telefono = rx_field(r'TELEFONO|N[ÚU]MERO', clean_text)
                        raw_operador = rx_field(r'OPERADOR(?!A)', clean_text)
                        raw_empresa  = rx_field(r'EMPRESA', clean_text)
                        raw_ruc      = rx_field(r'RUC', clean_text)
                        raw_fecha    = rx_field(r'FECHA', clean_text)

                        print(f"🔍 parsed: tel={raw_telefono!r} op={raw_operador!r} emp={raw_empresa!r}")

                        # Detect brand from OPERADOR field, fall back to EMPRESA
                        BRAND_MAP = {
                            "ENTEL":    ["ENTEL"],
                            "CLARO":    ["CLARO", "AMERICA MOVIL", "AMERICATEL"],
                            "MOVISTAR": ["MOVISTAR", "TELEFONICA", "TELEF\u00d3NICA"],
                            "BITEL":    ["BITEL", "VIETTEL"],
                        }
                        def detect_brand(s):
                            u = (s or '').upper()
                            for brand, kws in BRAND_MAP.items():
                                if any(kw in u for kw in kws):
                                    return brand
                            return None

                        brand = detect_brand(raw_operador) or detect_brand(raw_empresa) or raw_operador

                        result = {
                            "telefono": raw_telefono or phone,
                            "operador": brand,
                            "empresa":  raw_empresa,
                            "ruc":      raw_ruc,
                            "fecha":    raw_fecha,
                            "raw_text": text,
                        }
                        print(f"✅ Operadora {bot}: brand={brand!r} empresa={raw_empresa!r}")
                        return result




                    if is_new:
                        print(f"⏳ {bot} ({i+1}/{max_waits}): respuesta intermedia...")

                    await asyncio.sleep(wait_step)

            except SinResultadosError:
                raise
            except Exception as e:
                print(f"⚠️ Error {bot}: {e}")
                last_err = str(e)
                continue

        if last_err and "POR FAVOR ESPERA" in str(last_err):
            raise Exception(last_err)
        raise SinResultadosError(
            "No se encontró información para este número. Verifique el número e intente nuevamente."
        )

    async def query_telx(self, dni: str) -> dict:
        """Consulta números de celular de un DNI usando /telp en @Infordata1_bot."""
        await self._ensure_connection()

        target_group = '@Infordata1_bot'
        try:
            bot_entity = await self.client.get_entity(target_group)
            target_bot_id = bot_entity.id
        except:
            target_bot_id = 0 # Dynamic fetch preferred

        max_global_retries = 2

        for global_attempt in range(max_global_retries):
            try:
                print(f"📱 Enviando /telp {dni} al grupo {target_group} (intento {global_attempt + 1})...")
                sent_msg = await self.client.send_message(target_group, f'/telp {dni}')

                # Espera inicial
                await asyncio.sleep(5)

                total_parts   = None
                received_parts = {}
                seen_ids       = set()

                for attempt in range(12):
                    print(f"🔄 telp intento {attempt + 1}/12 buscando respuesta...")

                    async for message in self.client.iter_messages(target_group, limit=100, min_id=sent_msg.id, reverse=True):
                        if message.id in seen_ids:
                            continue
                        if message.sender_id != target_bot_id:
                            continue

                        text = message.text or ""
                        if not text:
                            continue

                        text_upper = text.upper()

                        if "procesando" in text.lower() or "espere" in text.lower() or "buscando" in text.lower():
                            continue

                        if self._is_sin_resultados(text):
                            seen_ids.add(message.id)
                            raise SinResultadosError("「❌️」Sin Resultados. Verifique los datos e intente nuevamente.")
                            
                        if dni in text:
                            if "error" in text.lower() or "no encontrado" in text.lower():
                                seen_ids.add(message.id)
                                raise Exception("Ocurrió un error al procesar la consulta.")

                        # Detectar resultado (TELEFONOS PREMIUM o OSIPTEL nuevo formato)
                        is_result = "TELEFONOS PREMIUM" in text_upper or "OSIPTEL" in text_upper or "DETALLE DE LINEAS" in text_upper or "TELEFONÍA" in text_upper
                        if not is_result:
                            continue

                        seen_ids.add(message.id)
                        
                        # Detectar paginación Página X de Y
                        page_match = re.search(r'P[aá]gina\s+(\d+)\s+de\s+(\d+)', text, re.IGNORECASE)
                        if page_match:
                            part_num    = int(page_match.group(1))
                            total_parts = int(page_match.group(2))
                        else:
                            part_num    = 1
                            total_parts = 1

                        received_parts[part_num] = text
                        print(f"✅ telx: parte {part_num}/{total_parts} recibida")

                    # ¿Tenemos todas las partes?
                    if total_parts is not None and len(received_parts) >= total_parts:
                        print(f"✅ telx: todas las partes ({total_parts}) recibidas")
                        break

                    await asyncio.sleep(3)

                # Tiempo agotado sin respuesta
                if not received_parts:
                    if global_attempt < max_global_retries - 1:
                        print("⚠️ telx: timeout, reintentando...")
                        continue
                    raise Exception("Timeout esperando respuesta del bot (no se detectó ningún mensaje válido).")

                combined = "\n\n".join(received_parts[k] for k in sorted(received_parts.keys()))
                return {
                    "raw_text": combined,
                    "parts": total_parts or 1,
                }

            except SinResultadosError:
                raise  # No reintentar
            except Exception as e:
                if global_attempt < max_global_retries - 1:
                    print(f"⚠️ telx error (intento {global_attempt + 1}): {e}")
                    continue
                raise

        raise Exception("No se pudo completar la consulta de teléfonos. Intente nuevamente.")

    async def query_telp(self, phone: str) -> dict:
        """Consulta información completa de una línea telefónica usando /telp en el GRUPO premium.
        Maneja los 3 casos de respuesta del bot:
          CASO 1: Sin Resultados → SinResultadosError (no retry)
          CASO 2/3: Respuesta válida (contiene NÚMERO ➣ o CONSULTA:) → devuelve raw_text
          OTRO: Respuesta inesperada → Exception con UNKNOWN_RESPONSE marker (no retry)
        """
        await self._ensure_connection()

        target_group  = -1003719053693
        target_bot_id = 8285118936

        print(f"📱 Enviando /telp {phone} al grupo {target_group}...")
        sent_msg = await self.client.send_message(target_group, f'/telp {phone}')

        # Espera inicial
        await asyncio.sleep(5)

        received_parts = {}
        seen_ids = set()
        total_parts = None

        # Hasta 12 intentos × 3 s = ~36 s de espera total
        for attempt in range(12):
            print(f"🔄 telp intento {attempt + 1}/12 buscando respuesta...")

            async for message in self.client.iter_messages(target_group, limit=15, reply_to=sent_msg.id):
                if message.id in seen_ids:
                    continue
                if message.sender_id != target_bot_id:
                    continue

                text = message.text or ""
                if not text:
                    continue

                seen_ids.add(message.id)
                text_upper = text.upper()

                # ── Anti-spam ─────────────────────────────────
                if "ANTI-SPAM" in text_upper or "espere" in text.lower():
                    wait_time = 15
                    try:
                        m = re.search(r'(\d+(?:\.\d+)?)s', text)
                        if m: wait_time = float(m.group(1)) + 2
                    except: pass
                    print(f"⚠️ Anti-spam telp: esperando {wait_time:.0f}s...")
                    await asyncio.sleep(wait_time)
                    # Reenviar el comando
                    sent_msg = await self.client.send_message(target_group, f'/telp {phone}')
                    await asyncio.sleep(5)
                    seen_ids.clear()
                    break

                # ── Sin Resultados → CASO 1 ────────────────────
                if self._is_sin_resultados(text):
                    print(f"⛔ telp: Sin Resultados para {phone}")
                    raise SinResultadosError(
                        "「❌️」Sin Resultados. Verifique los datos e intente nuevamente."
                    )

                # ── Mensajes de espera → ignorar ──────────────
                wait_keywords = ["procesando", "buscando", "cargando", "analizando"]
                if any(k in text.lower() for k in wait_keywords):
                    print(f"⏳ telp: procesando...")
                    continue

                # ── Detectar respuesta válida (CASO 2 / CASO 3) ──
                is_valid = (
                    "NÚMERO" in text_upper or
                    "NUMERO" in text_upper or
                    "CONSULTA:" in text_upper or
                    "TITULAR" in text_upper
                )
                if not is_valid:
                    # Respuesta inesperada del bot → no reintentar
                    print(f"⛔ telp: respuesta inesperada del bot: {text[:80]}")
                    raise Exception(
                        "UNKNOWN_RESPONSE: No se encontraron datos. Intente nuevamente en 10 segundos."
                    )

                # Detectar paginación X/N (por si el bot pagina)
                page_match = re.search(r'(\d+)\s*/\s*(\d+)', text)
                if page_match:
                    part_num    = int(page_match.group(1))
                    total_parts = int(page_match.group(2))
                else:
                    part_num    = 1
                    total_parts = 1

                received_parts[part_num] = text
                print(f"✅ telp: parte {part_num}/{total_parts} recibida")

            # ¿Tenemos todas las partes?
            if total_parts is not None and len(received_parts) >= total_parts:
                print(f"✅ telp: todas las partes ({total_parts}) recibidas")
                break

            await asyncio.sleep(3)

        if not received_parts:
            raise Exception(
                "UNKNOWN_RESPONSE: No se encontraron datos. Intente nuevamente en 10 segundos."
            )

        combined = "\n\n".join(received_parts[k] for k in sorted(received_parts.keys()))
        return {"raw_text": combined}

    async def query_cel(self, phone: str) -> dict:
        """Consulta titular de un número usando /telp en @Infordata1_bot."""
        await self._ensure_connection()

        target_group = '@Infordata1_bot'
        try:
            bot_entity = await self.client.get_entity(target_group)
            target_bot_id = bot_entity.id
        except:
            target_bot_id = 0 # Dynamic fetch preferred

        print(f"📱 Enviando /telp {phone} al grupo {target_group}...")
        sent_msg = await self.client.send_message(target_group, f'/telp {phone}')

        # Espera inicial
        await asyncio.sleep(5)

        received_parts = {}
        seen_ids = set()
        total_parts = None

        for attempt in range(12):
            print(f"🔄 cel intento {attempt + 1}/12 buscando respuesta...")

            async for message in self.client.iter_messages(target_group, limit=100, min_id=sent_msg.id, reverse=True):
                if message.id in seen_ids:
                    continue
                if message.sender_id != target_bot_id:
                    continue

                text = message.text or ""
                if not text:
                    continue

                text_upper = text.upper()

                if "procesando" in text.lower() or "espere" in text.lower() or "buscando" in text.lower():
                    continue

                if self._is_sin_resultados(text):
                    seen_ids.add(message.id)
                    raise SinResultadosError("「❌️」Sin Resultados. Verifique los datos e intente nuevamente.")
                    
                is_result = "KING DATA" in text_upper or "SHIELDGRAM DB" in text_upper or "DETALLE DE LINEAS" in text_upper or "TITULAR" in text_upper or "TELEFONÍA" in text_upper

                if phone in text and is_result:
                    if "error" in text.lower() or "no encontrado" in text.lower():
                        seen_ids.add(message.id)
                        raise Exception("Ocurrió un error al procesar la consulta.")

                # Detectar respuesta válida
                is_valid = "SHIELDGRAM DB" in text_upper or "RESULTADOS" in text_upper or "LÍNEAS ENCONTRADAS" in text_upper or "OSIPTEL" in text_upper or "TELEFONÍA" in text_upper or "TITULAR" in text_upper
                if not is_valid:
                    continue

                seen_ids.add(message.id)
                
                page_match = re.search(r'P[aá]gina\s+(\d+)\s+de\s+(\d+)', text, re.IGNORECASE)
                if page_match:
                    part_num    = int(page_match.group(1))
                    total_parts = int(page_match.group(2))
                else:
                    part_num    = 1
                    total_parts = 1

                received_parts[part_num] = text
                print(f"✅ cel: parte {part_num}/{total_parts} recibida")

            # ¿Tenemos todas las partes?
            if total_parts is not None and len(received_parts) >= total_parts:
                print(f"✅ cel: todas las partes ({total_parts}) recibidas")
                break

            await asyncio.sleep(3)

        if not received_parts:
            raise Exception(
                "UNKNOWN_RESPONSE: No se encontraron datos. Verifique el número e intente nuevamente en 10 o 15 segundos."
            )

        combined = "\n\n".join(received_parts[k] for k in sorted(received_parts.keys()))
        return {"raw_text": combined}

    async def search_with_sirius(self, nombres, paterno, materno):

        """Búsqueda por nombre usando bots que soporten el comando /nmdb con control de concurrencia"""
        await self._ensure_connection()
        # Formato exacto requerido por los bots (/nmdb NOMBRES|PATERNO|MATERNO)
        # - Coma (,) para separar nombres
        # - Pipes (|) para separar apellidos
        # - Plus (+) para espacios en apellidos
        n = nombres.strip().replace(' ', ',')
        p = paterno.strip().replace(' ', '+')
        m = materno.strip().replace(' ', '+')
        query = f"/nmdb {n}|{p}|{m}"
        
        # Bots que soportan búsqueda por nombre
        name_bots = [
            '@OlimpoDataBot', 
            '@SeleneSearch_Bot', 
            '@DEALERDATABOT', 
            '@HexDataBOT', 
            '@Infordata1_bot', 
            '@ImperialData_bot'
        ]
        
        last_error = None
        
        for bot in name_bots:
            # Acquire exclusive access to this bot
            acquired_bot = None
            if self.bot_pool:
                try:
                    acquired_bot = await self.bot_pool.acquire_bot([bot], timeout=5)
                    if not acquired_bot:
                        print(f"⏰ {bot} ocupado, intentando siguiente...")
                        continue
                except Exception as e:
                    print(f"⚠️ Error al adquirir {bot}: {e}")
                    continue
            
            try:
                import random
                active_client = random.choice([self.client, self.client2]) if self.client2 else self.client
                client_name = "Cliente 2" if active_client == self.client2 else "Cliente 1"

                print(f"🚀 Enviando búsqueda por nombre a {bot} usando {client_name}: {query}")
                
                 # Send command
                await active_client.send_message(bot, query)
                
                # Initial Wait
                print("⏳ Esperando 2 segundos iniciales...")
                await asyncio.sleep(2)
                
                # Polling parameters
                max_waits = 10 
                wait_step = 2
                
                found_result = False
                found_spam = None
                file_path_rel = None
                all_results = []
                total_count = 0
                
                for i in range(max_waits):
                     # Get last message
                    msgs = await active_client.get_messages(bot, limit=1)
                    if not msgs:
                        await asyncio.sleep(wait_step)
                        continue
                        
                    msg = msgs[0]
                    text = msg.text or ""
                    
                    # 1. Anti-Spam
                    spam_msg = self._check_antispam(text)
                    if spam_msg:
                        found_spam = spam_msg
                        break # Break polling, try next bot 
                    
                    # 2. Wait Check
                    wait_keywords = ["procesando", "wait", "recopilando", "buscando", "cargando", "analizando", "espere", "moment"]
                    if any(k in text.lower() for k in wait_keywords):
                        print(f"⏳ {bot} ({i+1}/{max_waits}): {text[:30]}...")
                        await asyncio.sleep(wait_step)
                        continue
                    
                    # 3. Check for specific FAILURE conditions (Stop immediately)
                    text_lower = text.lower()
                    
                    # A. Invalid Format
                    if "formato inválido" in text_lower or "formato incorrecto" in text_lower or "instrucciones de formato" in text_lower:
                        error_msg = "INVALID_FORMAT: El formato del nombre es incorrecto. Corrige el nombre o intenta nuevamente."
                        print(f"⛔ {bot}: {error_msg}")
                        raise Exception(error_msg)
                        
                    # B. No Results (Explicit)
                    if "no se encontró información" in text_lower or "sin resultados" in text_lower or "no se encontro informacion" in text_lower:
                        error_msg = "NO_FOUND_404: No se encontraron resultados para ese nombre."
                        print(f"ℹ️ {bot}: {error_msg}")
                        raise Exception(error_msg)
                    is_success_msg = msg.document or "resultados" in text.lower() or "coincidencias" in text.lower() or "dni" in text.lower()
                    
                    if is_success_msg:
                         found_result = True
                         
                         # Download File if any
                         if msg.document:
                            print(f"📂 Archivo detectado en {bot}, descargando...")
                            files_dir = Path(__file__).parent / "static" / "files"
                            files_dir.mkdir(parents=True, exist_ok=True)
                            
                            clean_name = f"NM-{n}-{p}.txt".replace("+", "_")
                            abs_file_path = files_dir / clean_name
                            
                            await msg.download_media(file=abs_file_path)
                            print(f"✅ Archivo descargado: {clean_name}")
                            file_path_rel = f"files/{clean_name}"

                         # Parse Text
                         if text:
                            # Try to parse Total Count
                            m_count = re.search(r'RESULTADOS[^\d]+(\d+)', text, re.IGNORECASE)
                            if m_count:
                                total_count = int(m_count.group(1))

                            results = self.parse_sirius_re(text)
                            if results:
                                all_results.extend(results)
                         
                         break # Success!
                    
                    # 4. Check No Results
                    if any(phrase in text.lower() for phrase in ['no se encontraron', 'no se encontró', 'sin resultados', 'no results']):
                         print(f"ℹ️ {bot} reportó sin coincidencias")
                         return {'resultados': [], 'archivo_url': None, 'total_count': 0}

                    # Unknown state, wait
                    await asyncio.sleep(wait_step)

                # End of Polling Loop
                
                if found_spam:
                    print(f"⚠️ {bot} anti-spam: {found_spam}")
                    last_error = found_spam
                    continue # Try next bot
                    
                if not found_result:
                    print(f"⚠️ {bot} timeout/sin respuesta válida.")
                    last_error = f"{bot} timeout"
                    continue # Try next bot

                # Success Response
                if all_results or file_path_rel:
                     print(f"✅ Encontrados {len(all_results)} resultados en {bot}")
                     final_total = total_count if total_count else len(all_results)
                     return {
                        'resultados': all_results,
                        'archivo_url': file_path_rel,
                        'total_count': final_total
                     }
                else: 
                     # Found 'success message' but no parsed results? Fallback empty
                     return {'resultados': [], 'archivo_url': file_path_rel, 'total_count': 0}

            except Exception as e:
                print(f"⚠️ Error con {bot}: {e}")
                err_str = str(e)
                last_error = err_str
                
                # CRITICAL FIX: Stop retry on specific errors
                if "NO_FOUND_404" in err_str or "INVALID_FORMAT" in err_str:
                    print(f"⛔ Error fatal en {bot}, deteniendo búsqueda: {err_str}")
                    raise e # Re-raise immediately to stop loop
                
                continue
            finally:
                if self.bot_pool and acquired_bot:
                    await self.bot_pool.release_bot(acquired_bot)
        
        # If loop finishes without returning
        error_msg = str(last_error) if last_error else "Todos los bots fallaron o están ocupados"
        print(f"❌ Error final búsqueda por nombre: {error_msg}")
        raise Exception(error_msg)


    def parse_sirius_re(self, text):
        results = []
        text = text.replace('➾', ':').replace('=>', ':').replace('*', '')
        parts = re.split(r'(?:DNI|DOC)[\s\W]*[:\-\s]+', text, flags=re.IGNORECASE)
        
        for part in parts[1:]:
            part = part.strip().replace('`', '').strip()
            if not part: continue
            
            m_dni = re.match(r'^(\d{8})', part)
            if not m_dni: continue
            dni = m_dni.group(1)
            
            nombres = ""
            apellidos = ""
            edad = ""

            m_nom = re.search(r'NOMBRES[\s\W]*[:\-\s]+([^\n]+)', part, re.IGNORECASE)
            if m_nom: nombres = m_nom.group(1).strip()
            
            m_ape = re.search(r'APELLIDOS[\s\W]*[:\-\s]+([^\n]+)', part, re.IGNORECASE)
            if m_ape: apellidos = m_ape.group(1).strip()
            
            # Regex mejorado para EDAD (soporta "EDAD : 25", "EDAD: 25 Años", etc)
            m_edad = re.search(r'EDAD[\s\W]*[:\-\s]+(\d+)', part, re.IGNORECASE)
            if m_edad: edad = m_edad.group(1).strip()
            
            if dni:
                full = f"{nombres} {apellidos}".strip() or nombres
                results.append({
                    'documento': dni, 
                    'nombres': nombres, 
                    'apellidos': apellidos, 
                    'nombre_completo': full,
                    'edad': edad
                })
        return results

    async def search_premium_group(self, dni):
        """Busca en el grupo premium con reintentos automáticos Anti-Spam."""
        await self._ensure_connection()
        
        target_group = '@Infordata1_bot' 
        try:
            bot_entity = await self.client.get_entity(target_group)
            target_bot_id = bot_entity.id
        except:
            target_bot_id = 0 # Fallback
            
        max_global_retries = 3

        for global_attempt in range(max_global_retries):
            try:
                print(f"💎 Enviando DNI {dni} al grupo {target_group} (Bot ID: {target_bot_id}) (Intento {global_attempt + 1}/{max_global_retries})...")
                sent_msg = await self.client.send_message(target_group, f'/dnig {dni}')
                
                # Esperar respuesta
                print("⏳ Esperando respuesta del bot premium (5s reales)...")
                await asyncio.sleep(5) 
                
                found_msgs = []
                
                # Iterar intentos para ENCONTRAR el mensaje (Total ~25s)
                # El usuario quiere delay real de 5s y luego validar. 
                # Ya esperamos 5s arriba. Ahora buscamos.
                
                for attempt in range(8):
                    # Buscar mensajes recientes del bot
                    print(f"🔄 Intento {attempt+1}/8 buscando respuesta...")
                    
                    collected = []
                    async for message in self.client.iter_messages(target_group, limit=25):
                        # Solo mensajes del bot posteriores a nuestra consulta
                        if message.sender_id == target_bot_id and message.id > sent_msg.id:
                            text_content = (message.text or "").upper()
                            
                            # Ignorar mensajes de carga
                            if "EXTRAYENDO DATA" in text_content or "PROTOCOL" in text_content:
                                continue
                                
                            # Identificar si es para nuestro DNI o una respuesta directa
                            is_our_response = (dni in text_content) or (message.reply_to_msg_id == sent_msg.id)
                            
                            # Si es para nosotros o es parte de un grupo de media que ya empezamos a recolectar
                            if is_our_response or (message.grouped_id and any(m.grouped_id == message.grouped_id for m in collected)):
                                collected.append(message)
                            
                            # Anti-Spam (esto es global, pero lo manejamos)
                            if "ANTI-SPAM" in text_content or "ESPERE" in text_content:
                                collected.append(message)
                    
                    if collected:
                        # Prioridad: Que contenga el DNI o sea reply directo
                        is_final = any((dni in (m.text or "")) or (m.reply_to_msg_id == sent_msg.id) for m in collected)
                        has_media = any(m.media for m in collected)
                        
                        if is_final and (has_media or attempt > 4):
                            print(f"🎯 Respuesta confirmada para DNI {dni} (Total: {len(collected)} msgs)")
                            found_msgs = collected
                            break
                    
                    if collected and any("ANTI-SPAM" in (m.text or "") for m in collected):
                        found_msgs = collected
                        break

                    await asyncio.sleep(2)
                
                if not found_msgs:
                    if global_attempt < max_global_retries - 1:
                        print("⚠️ Timeout esperando respuesta. Reintentando loop global...")
                        continue
                    raise Exception("Timeout esperando respuesta del bot premium (No se detectó mensaje válido)")

                # Sort by ID
                found_msgs.sort(key=lambda x: x.id)

                # Extract Text from all messages and combine
                text_parts = []
                for m in found_msgs:
                    if m.text and len(m.text) > 10 and "EXTRAYENDO DATA" not in m.text:
                        text_parts.append(m.text)
                
                text = "\n\n".join(text_parts) if text_parts else (found_msgs[0].text or "")
                
                print(f"📩 Texto capturado (combinado): {text[:50]}...")
                
                # --- SIN RESULTADOS CHECK (Exact match, no retry) ---
                if self._is_sin_resultados(text):
                    print("⛔ Bot reportó Sin Resultados. Deteniendo sin reintentos.")
                    raise SinResultadosError("No se encontraron resultados para los datos ingresados. Verifica la información e intenta nuevamente.")
                
                # --- ANTI-SPAM CHECK ---
                if "ANTI-SPAM" in text or "Espere" in text:
                    # Parse wait time if possible, otherwise 15s
                    wait_time = 15
                    try:
                        match = re.search(r"(\d+(\.\d+)?)s", text) 
                        if match:
                             wait_time = float(match.group(1)) + 2
                    except: pass
                    
                    print(f"⚠️ Anti-Spam detectado en intento {global_attempt + 1}. Esperando {wait_time:.1f}s...")
                    await asyncio.sleep(wait_time)
                    continue # RE-TRY GLOBAL LOOP
                # -----------------------

                # --- VALIDATION CHECK (legacy fallback) ---
                text_lower = text.lower()
                if "no encontrado" in text_lower:
                    raise SinResultadosError("No se encontraron resultados para los datos ingresados. Verifica la información e intenta nuevamente.")

                # Parse Text Fields using standardized parser
                data = parse_bot_response(text)
                
                print(f"✅ Datos Parsed Premium: {data}")

                # Map Images
                media_msgs = [m for m in found_msgs if m.media]
                img_paths = {}
                keys = ['foto_rostro', 'firma_imagen', 'huella_izquierda', 'huella_derecha']
                
                static_images_dir = Path(__file__).parent.absolute() / "static" / "images"
                static_images_dir.mkdir(parents=True, exist_ok=True)

                # Tomar los ÚLTIMOS 4 mensajes de media si hay más de 4 (para evitar el de carga si se coló)
                if len(media_msgs) > 4:
                    print(f"⚠️ Detectadas {len(media_msgs)} imágenes, tomando las últimas 4.")
                    media_msgs = media_msgs[-4:]

                for i, msg in enumerate(media_msgs):
                    if i < len(keys):
                        safe_name = f"premium_{dni}_{keys[i]}.jpg"
                        path = static_images_dir / safe_name
                        await msg.download_media(file=path)
                        img_paths[keys[i]] = f"images/{safe_name}"
                        print(f"📸 Saved image {i+1}/4: {path} -> images/{safe_name}")

                return {
                    "raw_text": text,
                    **data, 
                    "nombres": data.get('nombres', ''),
                    "apellidos": data.get('apellidos', ''),
                    "nombre_completo": f"{data.get('nombres', '')} {data.get('apellidos', '')}".strip(),
                    "documento": data.get('documento', dni),
                    "fecha_nacimiento": data.get('fecha_nacimiento', ''),
                    "edad": data.get('edad', ''),
                    "genero": data.get('genero', ''),
                    "imagen_url": img_paths.get('foto_rostro', None),
                    **img_paths,
                    "is_premium": True
                }

            except SinResultadosError:
                # Propagate immediately — no global retry
                raise
            except Exception as e:
                print(f"❌ Error premium (Intento {global_attempt+1}): {e}")
                if global_attempt == max_global_retries - 1:
                    raise e
                await asyncio.sleep(2)

    async def generate_c4_blue(self, dni):
        """Genera Ficha C4 Azul (Premium). SIN REINTENTOS. SOLO PDF VÁLIDO."""
        await self._ensure_connection()
        
        target_group = '@Infordata1_bot' 
        try:
            bot_entity = await self.client.get_entity(target_group)
            target_bot_id = bot_entity.id
        except:
            target_bot_id = 0 # Fallback
        print(f"💎 Generating C4 Blue for {dni}...")
        
        try:
            # 1. Enviar comando
            sent_msg = await self.client.send_message(target_group, f'/c4a {dni}')
            
            # 2. Esperar respuesta (7-15s aprox)
            print("⏳ Esperando respuesta C4 (8s iniciales)...")
            await asyncio.sleep(15)
            
            # 3. Buscar respuesta (Un solo intento de barrido, sin loops globales)
            found_msg = None
            
            for attempt in range(12): # ~24s max polling
                print(f"🔄 Polling C4 intento {attempt+1}/12...")
                async for message in self.client.iter_messages(target_group, limit=100, min_id=sent_msg.id, reverse=True):
                    if message.sender_id == target_bot_id:
                        text = message.text or ""
                        
                        # Ignorar mensaje de "Procesando"
                        if "procesando" in text.lower() or "espere" in text.lower():
                            continue
                            
                        # Sin Resultados check — stop immediately, no retry
                        if self._is_sin_resultados(text) and str(dni) in text:
                            print("⛔ C4 Blue: Bot reportó Sin Resultados.")
                            raise SinResultadosError("No se encontraron resultados para los datos ingresados. Verifica la información e intenta nuevamente.")

                        # Si tiene documento PDF y texto contiene C4 o ᴄ𝟺 y nuestro DNI
                        has_c4_text = "C4" in text.upper() or "ᴄ𝟺" in text
                        if message.document and has_c4_text and str(dni) in text:
                            found_msg = message
                            break
                        
                        # Si es mensaje de error genérico
                        if "error" in text.lower() or "no encontrado" in text.lower():
                             raise Exception("Hubo un error en la generación del documento. Inténtalo nuevamente en unos 10 segundos.")
                
                if found_msg: break
                await asyncio.sleep(2)
            
            if not found_msg:
                 raise Exception("Hubo un error en la generación del documento. Inténtalo nuevamente en unos 10 segundos.")
            
            # 4. Procesar Resultado Exitoso
            print("✅ C4 Azul encontrado. Descargando...")
            
            static_files_dir = Path(__file__).parent / "static" / "files"
            static_files_dir.mkdir(parents=True, exist_ok=True)
            
            filename = f"C4_AZUL_{dni}.pdf"
            path = static_files_dir / filename
            
            await found_msg.download_media(file=path)
            
            from parser import parse_bot_response
            parsed_data = parse_bot_response(found_msg.text)
            
            return {
                "file_path": f"files/{filename}",
                "raw_text": found_msg.text,
                **parsed_data
            }

        except SinResultadosError:
            raise  # Propagate immediately, don't swallow
        except Exception as e:
            if isinstance(e, SinResultadosError):
                raise  # Safety net: never swallow SinResultadosError
            print(f"❌ Error C4 Blue: {e}")
            # Mensaje estandarizado para el usuario
            raise Exception("Hubo un error en la generación del documento. Inténtalo nuevamente en unos 10 segundos.")

    async def generate_c4_inscripcion(self, dni):
        """Genera Ficha de Inscripción (Premium). SIN REINTENTOS. SOLO PDF VÁLIDO."""
        await self._ensure_connection()
        
        target_group = '@Infordata1_bot'
        # Obtener ID dinámicamente para evitar errores de hardcoding
        try:
            bot_entity = await self.client.get_entity(target_group)
            target_bot_id = bot_entity.id
        except:
            target_bot_id = 0 # Fallback
        
        print(f"💎 Generating C4 Inscripción for {dni}...")
        
        try:
            # 1. Enviar comando /c4i
            sent_msg = await self.client.send_message(target_group, f'/c4i {dni}')
            
            # 2. Esperar respuesta inicial
            print("⏳ Esperando respuesta C4 Inscripción (8s iniciales)...")
            await asyncio.sleep(15)
            
            # 3. Buscar respuesta (sin loops globales)
            found_msg = None
            
            for attempt in range(12):  # ~24s max polling
                print(f"🔄 Polling C4 Inscripción intento {attempt+1}/12...")
                async for message in self.client.iter_messages(target_group, limit=100, min_id=sent_msg.id, reverse=True):
                    if message.sender_id == target_bot_id:
                        text = message.text or ""
                        
                        # Ignorar mensaje de "Procesando"
                        if "procesando" in text.lower() or "espere" in text.lower():
                            continue
                        
                        # Sin Resultados check — stop immediately, no retry
                        if self._is_sin_resultados(text) and str(dni) in text:
                            print("⛔ C4 Inscripción: Bot reportó Sin Resultados.")
                            raise SinResultadosError("No se encontraron resultados para los datos ingresados. Verifica la información e intenta nuevamente.")

                        # Si tiene documento PDF y texto contiene C4 o ᴄ𝟺 y nuestro DNI
                        has_c4_text = "C4" in text.upper() or "ᴄ𝟺" in text
                        if message.document and has_c4_text and str(dni) in text:
                            found_msg = message
                            break
                        
                        # Si es mensaje de error genérico
                        if "error" in text.lower() or "no encontrado" in text.lower():
                            raise Exception("Ocurrió un error al generar la ficha. Intenta nuevamente en unos segundos.")
                
                if found_msg: break
                await asyncio.sleep(2)
            
            if not found_msg:
                raise Exception("Ocurrió un error al generar la ficha. Intenta nuevamente en unos segundos.")
            
            # 4. Procesar Resultado Exitoso
            print("✅ C4 Inscripción encontrado. Descargando...")
            
            static_files_dir = Path(__file__).parent / "static" / "files"
            static_files_dir.mkdir(parents=True, exist_ok=True)
            
            filename = f"C4_INSCRIPCION_{dni}.pdf"
            path = static_files_dir / filename
            
            await found_msg.download_media(file=path)
            
            from parser import parse_bot_response
            parsed_data = parse_bot_response(found_msg.text)
            
            return {
                "file_path": f"files/{filename}",
                "raw_text": found_msg.text,
                **parsed_data
            }

        except SinResultadosError:
            raise  # Propagate immediately, don't swallow
        except Exception as e:
            if isinstance(e, SinResultadosError):
                raise  # Safety net: never swallow SinResultadosError
            print(f"❌ Error C4 Inscripción: {e}")
            raise Exception("Ocurrió un error al generar la ficha. Intenta nuevamente en unos segundos.")

    async def generate_dni_azul(self, dni):
        """Genera DNI Azul Virtual (Premium). Devuelve 2 imágenes PNG: frontal y reverso."""
        await self._ensure_connection()

        target_group = '@Infordata1_bot'
        # Obtener ID dinámicamente para evitar errores de hardcoding
        try:
            bot_entity = await self.client.get_entity(target_group)
            target_bot_id = bot_entity.id
        except:
            target_bot_id = 0 # Fallback

        print(f"💎 Generating DNI Azul Virtual for {dni}...")

        try:
            # 1. Enviar comando /dniv
            sent_msg = await self.client.send_message(target_group, f'/dniv {dni}')

            # 2. Esperar respuesta inicial
            print("⏳ Esperando respuesta DNI Azul (8s iniciales)...")
            await asyncio.sleep(15)

            # 3. Buscar imágenes y texto en la respuesta
            found_images = []  # List of messages with images
            found_texts = []
            target_grouped_id = None
            for attempt in range(12):  # ~24s max polling
                print(f" Polling DNI Azul intento {attempt+1}/12...")
                async for message in self.client.iter_messages(target_group, limit=100, min_id=sent_msg.id, reverse=True):
                    if message.sender_id != target_bot_id:
                        continue

                    text = message.text or ""

                    # Ignorar mensajes de carga
                    if "procesando" in text.lower() or "espera" in text.lower() or "buscando" in text.lower():
                        continue

                    # Sin Resultados check
                    if self._is_sin_resultados(text) and (str(dni) in text or message.reply_to_msg_id == sent_msg.id):
                        print("⛔ DNI Azul: Bot reportó Sin Resultados.")
                        raise SinResultadosError("No se encontraron resultados para los datos ingresados. Verifica la información e intenta nuevamente.")

                    # Identificar por respuesta directa, por DNI o por Grouped ID coincidente
                    # Priorizamos reply_to_msg_id para evitar conflictos si buscan el mismo DNI a la vez
                    is_our_response = (message.reply_to_msg_id == sent_msg.id) or (str(dni) in text)
                    is_part_of_album = target_grouped_id and message.grouped_id == target_grouped_id
                    
                    if not is_our_response and not is_part_of_album:
                        continue
                    
                    # Si es nuestra respuesta y tiene álbum, guardamos el grouped_id
                    if is_our_response and message.grouped_id:
                        target_grouped_id = message.grouped_id

                    # Guardar mensaje de texto si es que hay (para extraer data)
                    if text and not message.photo and not message.document:
                        if not found_texts or len(text) > len(found_texts[0].text):
                            found_texts.insert(0, message)

                    # Recopilar mensajes con imagen
                    if message.photo or (message.document and message.document.mime_type and 'image' in message.document.mime_type):
                        if message.id not in [m.id for m in found_images]:
                            found_images.append(message)

                if len(found_images) >= 2:
                    break
                await asyncio.sleep(2)

            if len(found_images) < 2:
                raise Exception("No se recibieron todas las imágenes del DNI. Intenta nuevamente en unos segundos.")

            from parser import parse_bot_response
            print(f"✅ DNI Azul: Imágenes correctas encontradas. Descargando...")

            # Clasificar: Priorizar por nombre de archivo (FRONT/BACK) o caer en orden cronológico
            found_images.sort(key=lambda m: m.id)
            
            frontal_msg = next((m for m in found_images if m.file and m.file.name and "FRONT" in m.file.name.upper()), found_images[0])
            reverso_msg = next((m for m in found_images if m.file and m.file.name and "BACK" in m.file.name.upper()), found_images[1] if len(found_images) > 1 else found_images[0])
            
            # Si terminaron siendo el mismo (ej: no se encontró BACK por nombre y solo hay 2 imágenes), forzar el segundo
            if frontal_msg.id == reverso_msg.id and len(found_images) >= 2:
                reverso_msg = found_images[1]

            valid_images = [frontal_msg, reverso_msg]
            
            # Tomar el texto principal
            raw_text = ""
            if found_texts:
                raw_text = found_texts[0].text
            else:
                for m in valid_images:
                    if m.text:
                        raw_text = m.text
                        break
            
            parsed_data = parse_bot_response(raw_text)
            print(f"📝 Texto extraído: {raw_text[:50]}...")

            static_images_dir = Path(__file__).parent.absolute() / "static" / "images"
            static_images_dir.mkdir(parents=True, exist_ok=True)

            image_paths = []
            labels = ['frontal', 'reverso']
            for i, msg in enumerate(valid_images):
                label = labels[i]
                filename = f"DNI_AZUL_{label}_{dni}.png"
                path = static_images_dir / filename
                await msg.download_media(file=path)
                image_paths.append(f"images/{filename}")
                print(f"📸 Guardado: {filename}")

            return {
                "frontal": image_paths[0],
                "reverso": image_paths[1],
                "image_paths": image_paths,
                **parsed_data
            }

        except SinResultadosError:
            raise
        except Exception as e:
            if isinstance(e, SinResultadosError):
                raise
            print(f"❌ Error DNI Azul: {e}")
            raise Exception("Ocurrió un error al generar el DNI Azul. Intenta nuevamente en unos segundos.")

    async def generate_dni_amarillo(self, dni):
        """Genera DNI Amarillo Virtual (Premium). Devuelve 2 imágenes PNG: frontal y reverso."""
        await self._ensure_connection()

        target_group = '@Infordata1_bot'
        # Obtener ID dinámicamente para evitar errores de hardcoding
        try:
            bot_entity = await self.client.get_entity(target_group)
            target_bot_id = bot_entity.id
        except:
            target_bot_id = 0 # Fallback

        print(f"💛 Generating DNI Amarillo Virtual for {dni}...")

        try:
            # 1. Enviar comando /dnia
            sent_msg = await self.client.send_message(target_group, f'/dnia {dni}')

            # 2. Esperar respuesta inicial
            print("⏳ Esperando respuesta DNI Amarillo (8s iniciales)...")
            await asyncio.sleep(15)

            # 3. Buscar imágenes y texto en la respuesta
            found_images = []
            found_texts = []
            target_grouped_id = None
            for attempt in range(12):  # ~24s max polling
                print(f"🔄 Polling DNI Amarillo intento {attempt+1}/12...")
                async for message in self.client.iter_messages(target_group, limit=100, min_id=sent_msg.id, reverse=True):
                    if message.sender_id != target_bot_id:
                        continue

                    text = message.text or ""

                    # Ignorar mensajes de carga
                    if "procesando" in text.lower() or "espera" in text.lower() or "buscando" in text.lower():
                        continue

                    # Sin Resultados check
                    if self._is_sin_resultados(text) and (str(dni) in text or message.reply_to_msg_id == sent_msg.id):
                        print("⛔ DNI Amarillo: Bot reportó Sin Resultados.")
                        raise SinResultadosError("No se encontraron resultados para los datos ingresados. Verifica la información e intenta nuevamente.")


                    # Identificar por respuesta directa, por DNI o por Grouped ID coincidente
                    # Priorizamos reply_to_msg_id para evitar conflictos si buscan el mismo DNI a la vez
                    is_our_response = (message.reply_to_msg_id == sent_msg.id) or (str(dni) in text)
                    is_part_of_album = target_grouped_id and message.grouped_id == target_grouped_id
                    
                    if not is_our_response and not is_part_of_album:
                        continue
                    
                    # Si es nuestra respuesta y tiene álbum, guardamos el grouped_id
                    if is_our_response and message.grouped_id:
                        target_grouped_id = message.grouped_id

                    # Guardar mensaje de texto si es que hay (para extraer data)
                    if text and not message.photo and not message.document:
                        if not found_texts or len(text) > len(found_texts[0].text):
                            found_texts.insert(0, message)

                    # Recopilar mensajes con imagen
                    if message.photo or (message.document and message.document.mime_type and 'image' in message.document.mime_type):
                        if message.id not in [m.id for m in found_images]:
                            found_images.append(message)

                if len(found_images) >= 2:
                    break
                await asyncio.sleep(2)

            if len(found_images) < 2:
                raise Exception("No se recibieron todas las imágenes del DNI. Intenta nuevamente en unos segundos.")

            from parser import parse_bot_response
            print(f"✅ DNI Amarillo: Imágenes correctas encontradas. Descargando...")

            # Clasificar: Priorizar por nombre de archivo (FRONT/BACK) o caer en orden cronológico
            found_images.sort(key=lambda m: m.id)
            
            frontal_msg = next((m for m in found_images if m.file and m.file.name and "FRONT" in m.file.name.upper()), found_images[0])
            reverso_msg = next((m for m in found_images if m.file and m.file.name and "BACK" in m.file.name.upper()), found_images[1] if len(found_images) > 1 else found_images[0])
            
            # Si terminaron siendo el mismo, forzar el segundo
            if frontal_msg.id == reverso_msg.id and len(found_images) >= 2:
                reverso_msg = found_images[1]


            valid_images = [frontal_msg, reverso_msg]
            
            # Tomar el texto principal
            raw_text = ""
            if found_texts:
                raw_text = found_texts[0].text
            else:
                for m in valid_images:
                    if m.text:
                        raw_text = m.text
                        break
            
            parsed_data = parse_bot_response(raw_text)
            print(f"📝 Texto Amarillo extraído: {raw_text[:50]}...")

            static_images_dir = Path(__file__).parent.absolute() / "static" / "images"
            static_images_dir.mkdir(parents=True, exist_ok=True)

            image_paths = []
            labels = ['frontal', 'reverso']
            for i, msg in enumerate(valid_images):
                label = labels[i]
                filename = f"DNI_AMARILLO_{label}_{dni}.png"
                path = static_images_dir / filename
                await msg.download_media(file=path)
                image_paths.append(f"images/{filename}")
                print(f"📸 Guardado: {filename}")

            return {
                "frontal": image_paths[0],
                "reverso": image_paths[1],
                "image_paths": image_paths,
                **parsed_data
            }

        except SinResultadosError:
            raise
        except Exception as e:
            if isinstance(e, SinResultadosError):
                raise
            print(f"❌ Error DNI Amarillo: {e}")
            raise Exception("Ocurrió un error al generar el DNI Amarillo. Intenta nuevamente en unos segundos.")

    async def generate_familiares_pdf(self, dni):
        """Genera Árbol Visual v2 PDF con fotos (Premium). Devuelve PDF + datos del titular."""
        await self._ensure_connection()

        target_group = '@Infordata1_bot'
        # Obtener ID dinámicamente para evitar errores de hardcoding
        try:
            bot_entity = await self.client.get_entity(target_group)
            target_bot_id = bot_entity.id
        except:
            target_bot_id = 0 # Fallback

        print(f"👨‍👩‍👧 Generating Familiares PDF for {dni}...")

        try:
            # 1. Enviar comando /agv
            sent_msg = await self.client.send_message(target_group, f'/agv {dni}')

            # 2. Esperar respuesta inicial
            print("⏳ Esperando respuesta Familiares PDF (10s iniciales)...")
            await asyncio.sleep(10)

            # 3. Buscar respuesta
            found_msg = None

            for attempt in range(60):  # ~130s max polling (PDF tarda mucho)
                print(f"🔄 Polling Familiares PDF intento {attempt+1}/60...")
                async for message in self.client.iter_messages(target_group, limit=100, min_id=sent_msg.id, reverse=True):
                    if message.sender_id != target_bot_id:
                        continue

                    text = message.text or ""

                    # Ignorar mensajes de procesando
                    if "procesando" in text.lower() or "espere" in text.lower() or "buscando" in text.lower() or "generando" in text.lower():
                        continue

                    # Buscar mensaje con documento PDF y texto correcto
                    # Filtro flexible para capturar el PDF del árbol
                    if message.document and message.document.mime_type == "application/pdf":
                        upper_text = text.upper()
                        if "ARBOL" in upper_text or "ÁRBOL" in upper_text or "GENEALÓGICO" in upper_text or "FAMILIAR" in upper_text:
                            if dni in text or (message.file and message.file.name and dni in message.file.name):
                                found_msg = message
                                break
                    
                    # Fallback por si no tiene texto descriptivo pero es el PDF del bot al comando
                    if not found_msg and message.document and message.document.mime_type == "application/pdf":
                        if message.file and message.file.name and (dni in message.file.name or "Arbol" in message.file.name):
                            found_msg = message
                            break

                    # Evaluar errores solo si el DNI solicitado aparece explícitamente en el mensaje
                    if dni in text:
                        if self._is_sin_resultados(text):
                            print(f"⛔ Familiares PDF: Bot reportó Sin Resultados para DNI {dni}.")
                            raise SinResultadosError("No se encontraron resultados para los datos ingresados. Verifica la información e intenta nuevamente.")
                        
                        if "error" in text.lower() or "no encontrado" in text.lower():
                            raise Exception("Ocurrió un error al generar el árbol familiar. Intenta nuevamente en unos segundos.")

                if found_msg:
                    break
                await asyncio.sleep(2)

            if not found_msg:
                raise Exception("El bot no respondió a tiempo (tiempo de espera agotado). El proceso puede tardar más de lo habitual.")

            # 4. Descargar PDF
            print("✅ Familiares PDF encontrado. Descargando...")

            static_files_dir = Path(__file__).parent / "static" / "files"
            static_files_dir.mkdir(parents=True, exist_ok=True)

            filename = f"ARBOL_VISUAL_{dni}.pdf"
            path = static_files_dir / filename
            await found_msg.download_media(file=path)

            return {
                "file_path": f"files/{filename}",
                "raw_text": found_msg.message or found_msg.text or "",
            }

        except SinResultadosError:
            raise
        except Exception as e:
            if isinstance(e, SinResultadosError):
                raise
            print(f"❌ Error Familiares PDF: {e}")
            raise Exception(str(e))

    async def generate_antpen(self, dni):
        """Genera Certificado de Antecedentes Penales (Premium)."""
        await self._ensure_connection()
        
        target_group = '@Infordata1_bot'
        try:
            bot_entity = await self.client.get_entity(target_group)
            target_bot_id = bot_entity.id
        except:
            target_bot_id = 0
            
        print(f"⚖️ Generating Antecedentes Penales for {dni}...")
        
        try:
            sent_msg = await self.client.send_message(target_group, f'/antpen {dni}')
            print("⏳ Esperando respuesta Antecedentes Penales (8s iniciales)...")
            await asyncio.sleep(8)
            
            found_msg = None
            for attempt in range(15):
                print(f"🔄 Polling Antecedentes Penales intento {attempt+1}/15...")
                async for message in self.client.iter_messages(target_group, limit=100, min_id=sent_msg.id, reverse=True):
                    if message.sender_id != target_bot_id:
                        continue
                    
                    text = message.text or ""
                    
                    if "procesando" in text.lower() or "espere" in text.lower() or "buscando" in text.lower():
                        continue
                        
                    if self._is_sin_resultados(text):
                        raise SinResultadosError("No se encontraron resultados para los datos ingresados.")

                    is_valid_pdf = False
                    if message.document:
                        fname = message.file.name if message.file and message.file.name else ""
                        if fname.lower().startswith("antecedentes_penales_") and fname.lower().endswith(".pdf"):
                            is_valid_pdf = True
                    
                    if is_valid_pdf or "ANTECEDENTES PENALES" in text.upper() or "PENALES" in text.upper():
                        if dni in text or (message.file and message.file.name and dni in message.file.name):
                            found_msg = message
                            break
                        
                    if "error" in text.lower() or "no encontrado" in text.lower():
                        raise Exception("⚠️ No se encontraron resultados para el DNI ingresado.")
                
                if found_msg: break
                await asyncio.sleep(2)
            
            if not found_msg:
                 raise Exception("⚠️ No se encontraron resultados para el DNI ingresado.")
            
            print("✅ Antecedentes Penales encontrado. Descargando...")
            static_files_dir = Path(__file__).parent / "static" / "files"
            static_files_dir.mkdir(parents=True, exist_ok=True)
            
            filename = f"antecedentes_penales_{dni}.pdf"
            path = static_files_dir / filename
            await found_msg.download_media(file=path)
            
            return {
                "file_path": f"files/{filename}",
                "raw_text": found_msg.text,
            }
        except SinResultadosError:
            raise
        except Exception as e:
            if isinstance(e, SinResultadosError):
                raise
            print(f"❌ Error Antecedentes Penales: {e}")
            raise Exception("Ocurrió un error al generar el certificado.")

    async def generate_antjud(self, dni):
        """Genera Certificado de Antecedentes Judiciales (Premium)."""
        await self._ensure_connection()
        
        target_group = '@Infordata1_bot'
        try:
            bot_entity = await self.client.get_entity(target_group)
            target_bot_id = bot_entity.id
        except:
            target_bot_id = 0
            
        print(f"⚖️ Generating Antecedentes Judiciales for {dni}...")
        
        try:
            sent_msg = await self.client.send_message(target_group, f'/antjud {dni}')
            print("⏳ Esperando respuesta Antecedentes Judiciales (8s iniciales)...")
            await asyncio.sleep(8)
            
            found_msg = None
            for attempt in range(15):
                print(f"🔄 Polling Antecedentes Judiciales intento {attempt+1}/15...")
                async for message in self.client.iter_messages(target_group, limit=100, min_id=sent_msg.id, reverse=True):
                    if message.sender_id != target_bot_id:
                        continue
                    
                    text = message.text or ""
                    
                    if "procesando" in text.lower() or "espere" in text.lower() or "buscando" in text.lower():
                        continue
                        
                    if self._is_sin_resultados(text):
                        raise SinResultadosError("No se encontraron resultados para los datos ingresados.")

                    is_valid_pdf = False
                    if message.document:
                        fname = message.file.name if message.file and message.file.name else ""
                        if fname.lower().startswith("antecedentes_judiciales_") and fname.lower().endswith(".pdf"):
                            is_valid_pdf = True
                    
                    if is_valid_pdf or "ANTECEDENTES JUDICIALES" in text.upper() or "JUDICIALES" in text.upper():
                        if dni in text or (message.file and message.file.name and dni in message.file.name):
                            found_msg = message
                            break
                        
                    if "error" in text.lower() or "no encontrado" in text.lower():
                        raise Exception("⚠️ No se encontraron resultados para el DNI ingresado.")
                
                if found_msg: break
                await asyncio.sleep(2)
            
            if not found_msg:
                 raise Exception("⚠️ No se encontraron resultados para el DNI ingresado.")
            
            print("✅ Antecedentes Judiciales encontrado. Descargando...")
            static_files_dir = Path(__file__).parent / "static" / "files"
            static_files_dir.mkdir(parents=True, exist_ok=True)
            
            filename = f"antecedentes_judiciales_{dni}.pdf"
            path = static_files_dir / filename
            await found_msg.download_media(file=path)
            
            return {
                "file_path": f"files/{filename}",
                "raw_text": found_msg.text,
            }
        except SinResultadosError:
            raise
        except Exception as e:
            if isinstance(e, SinResultadosError):
                raise
            print(f"❌ Error Antecedentes Judiciales: {e}")
            raise Exception("Ocurrió un error al generar el certificado.")

    async def generate_antpol(self, dni):
        """Genera Certificado de Antecedentes Policiales (Premium)."""
        await self._ensure_connection()
        
        target_group = '@Infordata1_bot'
        try:
            bot_entity = await self.client.get_entity(target_group)
            target_bot_id = bot_entity.id
        except:
            target_bot_id = 0
            
        print(f"👮 Generating Antecedentes Policiales for {dni}...")
        
        try:
            sent_msg = await self.client.send_message(target_group, f'/antpol {dni}')
            print("⏳ Esperando respuesta Antecedentes Policiales (8s iniciales)...")
            await asyncio.sleep(8)
            
            found_msg = None
            for attempt in range(15):
                print(f"🔄 Polling Antecedentes Policiales intento {attempt+1}/15...")
                async for message in self.client.iter_messages(target_group, limit=100, min_id=sent_msg.id, reverse=True):
                    if message.sender_id != target_bot_id:
                        continue
                    
                    text = message.text or ""
                    
                    if "procesando" in text.lower() or "espere" in text.lower() or "buscando" in text.lower():
                        continue
                        
                    if self._is_sin_resultados(text):
                        raise SinResultadosError("No se encontraron resultados para los datos ingresados.")

                    is_valid_pdf = False
                    if message.document:
                        fname = message.file.name if message.file and message.file.name else ""
                        if fname.lower().startswith("antpoliciales_") and fname.lower().endswith(".pdf"):
                            is_valid_pdf = True
                    
                    if is_valid_pdf or "ANTECEDENTES POLICIALES" in text.upper() or "POLICIALES" in text.upper():
                        if dni in text or (message.file and message.file.name and dni in message.file.name):
                            found_msg = message
                            break
                        
                    if "error" in text.lower() or "no encontrado" in text.lower():
                        raise Exception("⚠️ No se encontraron resultados para el DNI ingresado.")
                
                if found_msg: break
                await asyncio.sleep(2)
            
            if not found_msg:
                 raise Exception("⚠️ No se encontraron resultados para el DNI ingresado.")
            
            print("✅ Antecedentes Policiales encontrado. Descargando...")
            static_files_dir = Path(__file__).parent / "static" / "files"
            static_files_dir.mkdir(parents=True, exist_ok=True)
            
            filename = f"AntPoliciales_{dni}.pdf"
            path = static_files_dir / filename
            await found_msg.download_media(file=path)
            
            return {
                "file_path": f"files/{filename}",
                "raw_text": found_msg.text,
            }
        except SinResultadosError:
            raise
        except Exception as e:
            if isinstance(e, SinResultadosError):
                raise
            print(f"❌ Error Antecedentes Policiales: {e}")
            raise Exception("Ocurrió un error al generar el certificado.")

    async def generate_familiares_texto(self, dni):
        """Genera Árbol Genealógico en texto usando /ag {dni}."""
        await self._ensure_connection()

        target_group = '@Infordata1_bot'
        try:
            bot_entity = await self.client.get_entity(target_group)
            target_bot_id = bot_entity.id
        except:
            target_bot_id = 0 # Fallback
            
        MARKER = "ÁRBOL GENEALÓGICO"
        MAX_WAIT = 60        # tiempo máximo total en segundos

        if not hasattr(self, 'ag_lock'):
            self.ag_lock = asyncio.Lock()

        print(f"👨‍👩‍👧 Generating Familiares Texto for {dni} (Waiting for Lock)...")
        
        # Aislar estrictamente la consulta de otras consultas en paralelo para evitar mezclar familiares de distintos DNIs
        async with self.ag_lock:
            print(f"👨‍👩‍👧 Lock acquired! Generating Familiares Texto for {dni}...")

            try:
                # 1. Enviar comando /ag
                sent_msg = await self.client.send_message(target_group, f'/ag {dni}')

                # 2. Esperar respuesta inicial
                print("⏳ Esperando respuesta Familiares Texto...")
                await asyncio.sleep(8)

                # 3. Recopilar todos los mensajes válidos
                messages_collected = []
                collected_ids = set()
                txt_file_path = None
                found_final = False
                
                loop = asyncio.get_event_loop()
                total_start = loop.time()

                while True:
                    now = loop.time()
                    if now - total_start > MAX_WAIT:
                        print(f"⏰ Timeout máximo alcanzado ({MAX_WAIT}s)")
                        break

                    # Iterar mensajes recientes posteriores a nuestro comando
                    async for message in self.client.iter_messages(target_group, limit=100, min_id=sent_msg.id, reverse=True):
                        if message.sender_id != target_bot_id:
                            continue
                        
                        if message.id in collected_ids:
                            continue

                        text = message.text or ""

                        # Ignorar mensajes de carga
                        if "procesando" in text.lower() or "espera" in text.lower() or "buscando" in text.lower():
                            continue

                        # Verificar Sin Resultados
                        if self._is_sin_resultados(text):
                            print("⛔ Familiares Texto: Bot reportó Sin Resultados.")
                            raise SinResultadosError("No se encontraron familiares para los datos ingresados.")

                        # Criterio de pertenencia: 
                        # 1. El texto contiene el DNI
                        # 2. El texto tiene el formato de fragmento [ PADRE ], [ MADRE ], etc.
                        # 3. Es un archivo TXT con el DNI en el nombre
                        is_part = False
                        if dni in text:
                            is_part = True
                        elif "[ " in text and " ]" in text and "Nombre ➟" in text:
                            is_part = True
                        elif "SITEX DATA" in text.upper():
                            is_part = True
                        elif "ÁRBOL GENEALÓGICO" in text.upper():
                            is_part = True
                        elif message.document and message.file and message.file.name and (dni in message.file.name or "Arbol" in message.file.name):
                            is_part = True

                        if is_part:
                            collected_ids.add(message.id)
                            messages_collected.append(message)
                            print(f"📨 Fragmento/Archivo capturado (id={message.id})")

                            # Detectar si es el mensaje final (contiene el conteo de registros)
                            if "hallado" in text.lower() and "registros" in text.lower():
                                found_final = True
                            elif "total de familiares" in text.lower() or "árbol genealógico" in text.lower():
                                found_final = True

                            # Si es el archivo TXT, descargarlo
                            if message.document and message.file and message.file.name and message.file.name.endswith(".txt"):
                                print(f"📂 Archivo TXT detectado: {message.file.name}. Descargando...")
                                static_files_dir = Path(__file__).parent / "static" / "files"
                                static_files_dir.mkdir(parents=True, exist_ok=True)
                                
                                filename = f"FAMILIARES_REPORT_{dni}.txt"
                                path = static_files_dir / filename
                                await message.download_media(file=path)
                                txt_file_path = f"files/{filename}"
                                print(f"✅ TXT guardado en: {txt_file_path}")

                    if found_final:
                        print("✅ Mensaje final detectado. Finalizando recopilación.")
                        break

                    await asyncio.sleep(3)

                if not messages_collected:
                    raise Exception("No se recibió respuesta del bot o la información se perdió. Intenta nuevamente.")

                # 4. Unir todos los textos en orden cronológico (por ID de mensaje)
                messages_collected.sort(key=lambda m: m.id)
                full_text = ""
                for m in messages_collected:
                    if m.text:
                        full_text += m.text + "\n\n"

                print(f"✅ Familiares Texto recopilado: {len(messages_collected)} mensajes.")

                return {
                    "raw_text": full_text.strip(),
                    "block_count": len(messages_collected),
                    "file_path": txt_file_path
                }

            except SinResultadosError:
                raise
            except Exception as e:
                if isinstance(e, SinResultadosError):
                    raise
                print(f"❌ Error Familiares Texto: {e}")
                raise Exception(f"Ocurrió un error al obtener el árbol familiar: {e}")

    async def generate_facial(self, file_path: str):
        """Envía una foto al bot de Telegram y obtiene los resultados faciales."""
        await self._ensure_connection()

        target_group = '@Infordata1_bot'
        try:
            bot_entity = await self.client.get_entity(target_group)
            target_bot_id = bot_entity.id
        except:
            target_bot_id = 0

        print(f"📸 Generating Búsqueda Facial...")

        try:
            sent_msg = await self.client.send_file(target_group, file=file_path, caption='/facial')

            print("⏳ Esperando respuesta Facial (10s iniciales)...")
            await asyncio.sleep(10)

            found_msg = None

            for attempt in range(40):
                print(f"🔄 Polling Facial intento {attempt+1}/40...")
                async for message in self.client.iter_messages(target_group, limit=50, min_id=sent_msg.id, reverse=True):
                    if message.sender_id != target_bot_id:
                        continue

                    text = message.text or ""

                    # Casuística: bot reenvía/encola con '/facial @bot' — ignorar y seguir esperando
                    if "/facial" in text.lower() and "@" in text:
                        print(f"⏩ Facial: Bot reenviando a otro bot, esperando resultado real...")
                        continue

                    if "procesando" in text.lower() or "espere" in text.lower() or "buscando" in text.lower() or "generando" in text.lower() or "facial_procesando" in text.lower():
                        continue

                    # Asegurarse de que el bot está respondiendo específicamente a nuestro mensaje de imagen
                    if message.reply_to and message.reply_to.reply_to_msg_id != sent_msg.id:
                        continue
                    
                    if "FACIAL" in text.upper() or "BÚSQUEDA FACIAL" in text.upper():
                        found_msg = message
                        break
                    
                    # Casuística: «「❌️」Sin Resultados. Verifique los datos e intente nuevamente...»
                    if self._is_sin_resultados(text):
                        print(f"⛔ Facial: Bot reportó Sin Resultados (texto: {text[:80]!r}).")
                        raise SinResultadosError("No se encontraron coincidencias faciales en la base de datos.")

                    if "error" in text.lower() or "no encontrado" in text.lower():
                        raise Exception("Ocurrió un error al procesar la imagen facial. Intenta nuevamente.")

                if found_msg:
                    break
                await asyncio.sleep(2)

            if not found_msg:
                raise Exception("El bot no respondió a tiempo. Asegúrate de enviar una imagen clara del rostro.")

            file_url = None
            if found_msg.document and found_msg.document.mime_type == "application/pdf":
                print("✅ PDF Facial encontrado. Descargando...")
                static_files_dir = Path(__file__).parent / "static" / "files"
                static_files_dir.mkdir(parents=True, exist_ok=True)

                import uuid
                filename = f"FACIAL_{uuid.uuid4().hex}.pdf"
                path = static_files_dir / filename
                await found_msg.download_media(file=path)
                file_url = f"files/{filename}"

            return {
                "file_path": file_url,
                "raw_text": found_msg.message or found_msg.text or "",
            }

        except SinResultadosError:
            raise
        except Exception as e:
            if isinstance(e, SinResultadosError):
                raise
            print(f"❌ Error Búsqueda Facial: {e}")
            raise Exception(f"Ocurrió un error en la búsqueda facial: {e}")

    async def query_delitos(self, query_type: str, target: str) -> dict:
        """
        Consulta delitos por DNI (/den) o Placa (/denp) a @Infordata1_bot.
        Retorna:
        {
            "raw_text": "...",
            "archivos": ["files/UUID1.pdf", "files/UUID2.pdf", ...]
        }
        """
        await self._ensure_connection()
        bot = '@Infordata1_bot'
        command = f"/den {target}" if query_type == "dni" else f"/denp {target}"
        
        acquired_bot = None
        if self.bot_pool:
            acquired_bot = await self.bot_pool.acquire_bot([bot], timeout=10)
            if not acquired_bot:
                raise Exception("El sistema de denuncias está ocupado actualmente. Intenta en unos segundos.")
                
        try:
            bot_entity = await self.client.get_entity(bot)
            target_bot_id = bot_entity.id
        except:
            target_bot_id = 0

        try:
            print(f"🚓 Enviando {command} a {bot}...")
            sent_msg = await self.client.send_message(bot, command)
            
            await asyncio.sleep(4)
            
            archivos_descargados = []
            raw_text = None
            found_spam = None
            seen_ids = set()
            
            # Polling loop (wait up to ~30 seconds)
            for attempt in range(15):
                print(f"🔄 Polling Delitos intento {attempt+1}/15...")
                
                async for message in self.client.iter_messages(bot, limit=50, min_id=sent_msg.id, reverse=True):
                    if message.id in seen_ids:
                        continue
                    if message.sender_id != target_bot_id:
                        continue
                        
                    text = message.text or ""
                    
                    if "procesando" in text.lower() or "espere" in text.lower() or "buscando" in text.lower():
                        continue
                        
                    spam_msg = self._check_antispam(text)
                    if spam_msg:
                        found_spam = spam_msg
                        continue
                    
                    if self._is_sin_resultados(text) or "no se encontró" in text.lower() or "sin resultados" in text.lower() or "ningun registro" in text.lower() or "ningún registro" in text.lower() or "no existe" in text.lower():
                        raise SinResultadosError("No se encontraron denuncias para esta búsqueda en el sistema.")
                    
                    seen_ids.add(message.id)
                    
                    # Check for files
                    if message.document and message.document.mime_type == 'application/pdf':
                        import uuid
                        files_dir = Path(__file__).parent / "static" / "files"
                        files_dir.mkdir(parents=True, exist_ok=True)
                        
                        clean_name = f"DELITO_{uuid.uuid4().hex}.pdf"
                        abs_file_path = files_dir / clean_name
                        await message.download_media(file=abs_file_path)
                        archivos_descargados.append(f"files/{clean_name}")
                        print(f"✅ Archivo de denuncia descargado: {clean_name}")
                    
                    # Extract Summary Text
                    if "DENUNCIA POLICIAL" in text.upper() or "DENUNCIA" in text.upper() or "INFOR DATA" in text.upper():
                        if raw_text:
                            raw_text += "\n\n" + text
                        else:
                            raw_text = text


                # Break early if we have all expected PDFs
                expected_files = 0
                if raw_text:
                    import re
                    expected_files = len(re.findall(r'\d+\.\s*\*?_?(TIPO|PLACA)', raw_text, re.IGNORECASE))
                
                if raw_text and expected_files > 0 and len(archivos_descargados) >= expected_files:
                    # Dar 1 iteración extra por si acaso
                    if attempt > 1:
                        break

                # Fallback de tiempo
                if (archivos_descargados or raw_text) and attempt > 7:
                    break
                    
                await asyncio.sleep(2)
                
            if found_spam and not archivos_descargados and not raw_text:
                raise Exception(found_spam)
                
            if archivos_descargados or raw_text:
                return {
                    "raw_text": raw_text or "Denuncias encontradas exitosamente en formato PDF.",
                    "archivos": archivos_descargados
                }
            else:
                raise Exception("Tiempo de espera agotado o el servidor de denuncias no respondió.")
                
        finally:
            if self.bot_pool and acquired_bot:
                await self.bot_pool.release_bot(bot)

    async def query_arbol_visual_pdf(self, dni: str) -> dict:
        """
        Consulta árbol visual PDF por DNI (/agvp) a @Infordata1_bot.
        Retorna:
        {
            "raw_text": "...",
            "file_path": "files/UUID.pdf"
        }
        """
        await self._ensure_connection()
        bot = '@Infordata1_bot'
        command = f"/agvp {dni}"
        
        acquired_bot = None
        if self.bot_pool:
            acquired_bot = await self.bot_pool.acquire_bot([bot], timeout=10)
            if not acquired_bot:
                raise Exception("El sistema está ocupado actualmente. Intenta en unos segundos.")
                
        try:
            bot_entity = await self.client.get_entity(bot)
            target_bot_id = bot_entity.id
        except:
            target_bot_id = 0

        try:
            print(f"🌳 Enviando {command} a {bot}...")
            sent_msg = await self.client.send_message(bot, command)
            
            await asyncio.sleep(4)
            
            file_url = None
            raw_text = None
            found_spam = None
            seen_ids = set()
            
            # Polling loop (wait up to ~15-20 seconds)
            for attempt in range(12):
                print(f"🔄 Polling Árbol Visual intento {attempt+1}/12...")
                
                async for message in self.client.iter_messages(bot, limit=50, min_id=sent_msg.id, reverse=True):
                    if message.id in seen_ids:
                        continue
                    if message.sender_id != target_bot_id:
                        continue
                        
                    text = message.text or ""
                    
                    if "procesando" in text.lower() or "espere" in text.lower() or "buscando" in text.lower():
                        continue
                        
                    spam_msg = self._check_antispam(text)
                    if spam_msg:
                        found_spam = spam_msg
                        continue
                    
                    if self._is_sin_resultados(text) or "no se encontró" in text.lower() or "sin resultados" in text.lower():
                        raise SinResultadosError("No se encontraron familiares para este DNI en el sistema.")
                    
                    seen_ids.add(message.id)
                    
                    # Extract Summary Text
                    if "INFOR DATA" in text.upper() or "ÁRBOL VISUAL" in text.upper():
                        # Clean text: remove CUENTA and USUARIO lines
                        lines = text.split('\n')
                        clean_lines = [line for line in lines if not line.startswith('CUENTA:') and not line.startswith('USUARIO:')]
                        raw_text = '\n'.join(clean_lines).strip()
                        
                    # Check for files
                    if message.document and message.document.mime_type == 'application/pdf':
                        import uuid
                        files_dir = Path(__file__).parent / "static" / "files"
                        files_dir.mkdir(parents=True, exist_ok=True)
                        
                        clean_name = f"FAMILIAR_{uuid.uuid4().hex}.pdf"
                        abs_file_path = files_dir / clean_name
                        await message.download_media(file=abs_file_path)
                        file_url = f"files/{clean_name}"
                        print(f"✅ PDF Árbol Visual descargado: {clean_name}")

                if file_url and raw_text:
                    break
                    
                await asyncio.sleep(2)
                
            if found_spam and not file_url and not raw_text:
                raise Exception(found_spam)
                
            if file_url or raw_text:
                return {
                    "raw_text": raw_text or "Árbol visual encontrado exitosamente.",
                    "file_path": file_url
                }
            else:
                raise Exception("Tiempo de espera agotado o el servidor no respondió.")
                
        finally:
            if self.bot_pool and acquired_bot:
                await self.bot_pool.release_bot(bot)



