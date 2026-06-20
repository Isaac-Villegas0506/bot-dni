# 🔍 AUDITORÍA TÉCNICA COMPLETA — BACKEND BOT-DNI
> **Fecha:** 20 de junio de 2026  
> **Analista:** Arquitecto de Software Senior  
> **Alcance:** Backend completo — todos los archivos Python  
> **Estado:** Solo lectura — ningún archivo fue modificado

---

## TABLA DE CONTENIDOS

1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Inventario de Archivos Backend](#2-inventario-de-archivos-backend)
3. [Arquitectura General del Proyecto](#3-arquitectura-general-del-proyecto)
4. [Flujo Completo de Ejecución](#4-flujo-completo-de-ejecución)
5. [Análisis Exhaustivo: `bot_client.py`](#5-análisis-exhaustivo-bot_clientpy)
6. [Análisis de `main.py`](#6-análisis-de-mainpy)
7. [Análisis de `database.py`](#7-análisis-de-databasepy)
8. [Análisis de Archivos de Soporte](#8-análisis-de-archivos-de-soporte)
9. [Inventario de Problemas por Categoría](#9-inventario-de-problemas-por-categoría)
10. [Violaciones SOLID y Clean Architecture](#10-violaciones-solid-y-clean-architecture)
11. [Problemas Críticos](#11-problemas-críticos)
12. [Problemas Importantes](#12-problemas-importantes)
13. [Problemas Menores](#13-problemas-menores)
14. [Riesgos Técnicos](#14-riesgos-técnicos)
15. [Deuda Técnica Detectada](#15-deuda-técnica-detectada)
16. [Nueva Arquitectura Recomendada](#16-nueva-arquitectura-recomendada)
17. [Plan de Refactorización por Prioridades](#17-plan-de-refactorización-por-prioridades)
18. [Estimaciones](#18-estimaciones)

---

## 1. RESUMEN EJECUTIVO

El backend del proyecto **bot-dni** es un sistema funcional que cumple su propósito operativo, pero presenta una deuda técnica severa acumulada que amenaza directamente su mantenibilidad, escalabilidad y seguridad a corto y mediano plazo.

El problema central es la **concentración extrema de responsabilidades en tres archivos monolíticos**:

| Archivo | Líneas | Responsabilidades mezcladas |
|---|---|---|
| `bot_client.py` | **2,613** | Gestión Telegram, parsing, I/O de archivos, rutas de disco, lógica de negocio |
| `main.py` | **1,853** | Rutas HTTP, autenticación, validaciones, lógica de negocio, gestión de archivos |
| `database.py` | **1,863** | CRUD PostgreSQL + lógica de negocio embebida + transformaciones de datos |

Estos tres archivos suman **6,329 líneas** y concentran prácticamente toda la inteligencia del sistema. El patrón de polling asíncrono de bots de Telegram se repite **al menos 20 veces** con variaciones mínimas, constituyendo el mayor bloque de código duplicado identificado en el proyecto.

Existen además **scripts de parche** (`fix_c4.py`, `fix_syntax.py`, `update_script.py`) que modifican el código fuente en tiempo de ejecución usando búsqueda de strings, lo que es una práctica extremadamente peligrosa que podría corromper el código en producción.

El sistema **no tiene tests** de ningún tipo.

---

## 2. INVENTARIO DE ARCHIVOS BACKEND

### Archivos de Producción

| Archivo | Líneas | Rol | Estado |
|---|---|---|---|
| `main.py` | 1,853 | API FastAPI — punto de entrada HTTP | ⚠️ Monolito |
| `bot_client.py` | 2,613 | Cliente Telegram — todas las consultas | 🔴 Monolito crítico |
| `database.py` | 1,863 | Capa de datos PostgreSQL | ⚠️ Monolito |
| `bot_pool.py` | 116 | Pool de concurrencia de bots | ✅ Aceptable |
| `auth.py` | 53 | JWT + bcrypt | ✅ Bien dimensionado |
| `auth_second_account.py` | 42 | Script one-shot para sesión Telegram | ⚠️ No debería existir en prod |
| `firebase_admin_utils.py` | 49 | Firebase Admin SDK | ✅ Bien dimensionado |
| `email_utils.py` | 228 | SMTP + verificación email | ⚠️ Mezcla responsabilidades |
| `parser.py` | 222 | Parseo de respuestas de bots | ⚠️ Función única muy larga |
| `scraper_dniperu.py` | ~80 | Scraping web DNI Perú | ✅ Bien dimensionado |

### Scripts Utilitarios (No deberían estar en producción)

| Archivo | Propósito | Riesgo |
|---|---|---|
| `fix_c4.py` | Parche que modifica `bot_client.py` via string replace | 🔴 CRÍTICO |
| `fix_syntax.py` | Parche que elimina código duplicado de `bot_client.py` | 🔴 CRÍTICO |
| `update_script.py` | Múltiples parches aplicados a `bot_client.py` | 🔴 CRÍTICO |
| `generar_sesion.py` | CLI para generar StringSession de Telegram | ⚠️ Herramienta dev |
| `telegram_login.py` | Duplicado de `generar_sesion.py` | ⚠️ Código duplicado |
| `test_db.py` | Script de debug de base de datos | ⚠️ No es un test real |
| `enable_promo.py` | Script one-shot para activar promo | ⚠️ Cambio de datos directo |

### Archivos de Configuración

| Archivo | Estado |
|---|---|
| `.env` | 🔴 **Checkeado en repo** — credenciales expuestas |
| `.env.example` | ✅ Correcto |
| `requirements.txt` | ⚠️ Sin pinning de versiones |
| `setup_database.sql` | ✅ Buen esquema inicial |
| `bot.db` | ⚠️ SQLite residual — confusión con PostgreSQL |

---

## 3. ARQUITECTURA GENERAL DEL PROYECTO

### Arquitectura Actual (As-Is)

```
Frontend (React/Vite) → Vercel
          │
          │ HTTPS REST API
          ▼
main.py (FastAPI) — 1,853 líneas
    │         │         │
    │         │         └─ firebase_admin_utils.py
    │         │         └─ auth.py (JWT)
    │         │         └─ email_utils.py
    │         ▼
    │   database.py (PostgreSQL psycopg2)
    │         │
    │         └─ Render PostgreSQL (prod)
    │
    └─ bot_client.py (Telethon) — 2,613 líneas
              │
              ├─ bot_pool.py (concurrencia)
              ├─ parser.py (parseo)
              ├─ scraper_dniperu.py (scraping web)
              └─ Telegram Cloud (múltiples bots)
```

### Patrón Predominante

El sistema actúa como un **intermediario/proxy** entre usuarios web y bots de Telegram:

1. Usuario hace request HTTP → `main.py`
2. `main.py` valida créditos en `database.py`
3. `main.py` llama método en `bot_client.py`
4. `bot_client.py` envía comando a bot Telegram y hace polling de la respuesta
5. Resultado se procesa, se guarda en disco (static/) y se retorna al usuario

### Problemas Arquitecturales Fundamentales

- **No hay capas**: No existe separación entre capa de presentación (routes), aplicación (use cases), dominio (business logic) e infraestructura (Telegram, DB, email).
- **No hay abstracción**: Si mañana se cambia de Telegram a otra fuente de datos, habría que modificar `main.py` directamente.
- **No hay inyección de dependencias**: `main.py` instancia `BotClient()` y `Database()` directamente como variables globales.
- **Acoplamiento directo**: `main.py` conoce detalles internos de cómo funciona el polling de Telegram.

---

## 4. FLUJO COMPLETO DE EJECUCIÓN

### Arranque del Servidor

```
uvicorn main:app
  → FastAPI crea app
  → Monta directorios estáticos (static/images, static/files, static/docs)
  → Configura CORS desde variables de entorno
  → Instancia BotClient() como variable global
  → Instancia Database() como variable global
  → Registra evento @app.on_event("startup")
  → startup: bot_client.start() conecta clientes Telegram
  → startup: Database() establece pool de conexiones PostgreSQL
```

### Flujo de Consulta DNI (caso más común)

```
POST /api/search/dni
  → Extrae JWT del header Authorization
  → decode_access_token() valida JWT
  → database.get_user_by_email() carga usuario
  → Verifica créditos disponibles
  → database.create_search_history() registra intento
  → bot_client.query_bot(dni) 
      → _ensure_connection() verifica conexión Telegram
      → Itera lista hardcodeada de 6 bots
      → Para cada bot: acquire lock via bot_pool
      → send_message(bot, f'/dnix {dni}')
      → asyncio.sleep(2) espera inicial
      → Loop polling 10 iteraciones × 2s = 20s máximo
          → get_messages(bot, limit=1)
          → _check_antispam(text)
          → _is_sin_resultados(text)
          → Detecta campos "NOMBRES/APELLIDOS" en texto
          → Si tiene imagen: download_media() → static/images/{dni}.jpg
          → Retorna (text, img_path_rel)
  → parse_bot_response(text) 
  → database.update_user_credits() descuenta crédito
  → database.update_search_history() actualiza con resultado
  → Retorna JSON al frontend
```

### Flujo de Generación de Documentos (C4, DNI Virtual)

```
POST /api/generate/c4_blue
  → Autenticación + validación créditos
  → bot_client.generate_c4_blue(dni)
      → send_message(group/bot, '/c4az {dni}')
      → Polling hasta recibir PDF o imagen
      → download_media() → static/files/{filename}
  → Retorna URL del archivo generado
```

---

## 5. ANÁLISIS EXHAUSTIVO: `bot_client.py`

### 5.1 Mapa Completo de Funciones

| # | Función | Líneas aprox. | Tipo |
|---|---|---|---|
| 1 | `_clean_bot_text(text)` | 6 | Función libre (fuera de clase) |
| 2 | `__init__(self)` | ~27 | Constructor |
| 3 | `start(self)` | ~18 | Ciclo de vida |
| 4 | `stop(self)` | 3 | Ciclo de vida |
| 5 | `_ensure_connection(self)` | ~15 | Infraestructura interna |
| 6 | `_check_antispam(self, text)` | ~10 | Utilidad interna |
| 7 | `_is_sin_resultados(self, text)` | ~20 | Utilidad interna |
| 8 | `query_bot(self, dni)` | ~145 | Consulta principal DNI |
| 9 | `query_operadora(self, phone)` | ~155 | Consulta operadora |
| 10 | `query_telx(self, dni)` | ~120 | Teléfonos por DNI (v1) |
| 11 | `query_telp(self, dni)` | ~100 | Teléfonos por DNI (v2) |
| 12 | `query_cel(self, phone)` | ~100 | Lookup por celular |
| 13 | `query_record(self, query)` | ~100 | Búsqueda por nombre |
| 14 | `search_with_sirius(self, query)` | ~130 | Búsqueda con Sirius |
| 15 | `search_premium_group(self, query, type)` | ~180 | Búsqueda en grupo premium |
| 16 | `generate_c4_blue(self, dni)` | ~120 | Genera C4 Azul PDF |
| 17 | `generate_c4_inscripcion(self, dni)` | ~120 | Genera C4 Inscripción |
| 18 | `generate_dni_electronico(self, dni)` | ~120 | DNI Electrónico |
| 19 | `generate_dni_azul(self, dni)` | ~100 | DNI Azul imagen |
| 20 | `generate_dni_amarillo(self, dni)` | ~100 | DNI Amarillo imagen |
| 21 | `generate_familiares_pdf(self, dni)` | ~130 | Árbol familiar PDF |
| 22 | `generate_familiares_texto(self, dni)` | ~120 | Árbol familiar texto |
| 23 | `generate_antpen(self, query)` | ~130 | Antecedentes penales |
| 24 | `generate_antjud(self, query)` | ~130 | Antecedentes judiciales |
| 25 | `generate_antpol(self, query)` | ~130 | Antecedentes policiales |
| 26 | `generate_facial(self, image_path)` | ~150 | Búsqueda facial |
| 27 | `query_delitos(self, dni)` | ~120 | Consulta delitos |
| 28 | `query_arbol_visual_pdf(self, dni)` | ~130 | Árbol visual PDF |
| 29 | `query_fiscalia_bot(self, target, option)` | ~118 | Consulta Fiscalía |

**Total funciones:** 29 (1 libre + 28 métodos de clase)  
**Total líneas:** ~2,613

### 5.2 Anomalía Estructural Grave: `query_fiscalia_bot` antes de `__init__`

```python
class BotClient:

    async def query_fiscalia_bot(self, target: str, option_type: str) -> dict:
        # ... ← LÍNEA 28
    
    def __init__(self):
        # ... ← LÍNEA 119
```

**El método `query_fiscalia_bot` está definido ANTES del constructor `__init__`**. Esto es técnicamente válido en Python pero viola las convenciones y sugiere que el código fue agregado de forma apresurada al inicio del archivo sin cuidado de la estructura.

### 5.3 Patrón de Polling Duplicado

El siguiente patrón se repite **al menos 20 veces** con variaciones mínimas:

```python
# Patrón repetido en cada método:
sent_msg = await self.client.send_message(bot, f'/comando {arg}')
await asyncio.sleep(N)  # varía entre 2-8 segundos
for attempt in range(N):  # varía entre 8-15 intentos
    msgs = await active_client.get_messages(bot, limit=1)
    msg = msgs[0]
    text = msg.text or ""
    spam_msg = self._check_antispam(text)
    if spam_msg: break
    if self._is_sin_resultados(text): raise SinResultadosError(...)
    wait_kw = ["procesando", "wait", ...]
    if any(k in text.lower() for k in wait_kw):
        await asyncio.sleep(wait_step)
        continue
    # ... detección específica del método ...
    await asyncio.sleep(wait_step)
```

Este patrón debería existir **una sola vez** como método privado parametrizable `_poll_bot_response(bot, sent_msg_id, validator_fn, timeout, ...)`.

### 5.4 Mapa de Dependencias Internas

```
bot_client.py
  ├─ Imports globales (correctos):
  │    re, os, time, asyncio, traceback, pathlib.Path
  │    telethon.TelegramClient, telethon.sessions.StringSession
  │    bot_pool.BotPool
  │    parser.parse_bot_response
  │
  ├─ Imports DENTRO de métodos (anti-patrón):
  │    import random          ← en query_bot() y query_operadora()
  │    import asyncio         ← en query_fiscalia_bot()
  │    import re as _re       ← en query_operadora()
  │    from pathlib import Path ← en query_fiscalia_bot()
  │    import time            ← en query_fiscalia_bot()
  │    from backend.utils.errors import SinResultadosError  ← RUTA INCORRECTA
  │
  └─ Variables de entorno (hardcoded strings mezclados):
       TELEGRAM_API_ID, TELEGRAM_API_HASH
       TELEGRAM_SESSION_STRING, TELEGRAM_SESSION_STRING_2
       TELEGRAM_API_ID_2, TELEGRAM_API_HASH_2
       TELEGRAM_GROUP_ID, TELEGRAM_PREMIUM_BOT_ID
       TARGET_BOT_USERNAME
```

### 5.5 Usernames de Bots Hardcodeados

Los siguientes bots están escritos literalmente en el código fuente, **sin configuración**:

```python
# Repetidos en múltiples métodos:
'@OlimpoDataBot'        # query_bot, query_operadora
'@SeleneSearch_Bot'     # query_bot, query_operadora
'@DEALERDATABOT'        # query_bot, query_operadora
'@HexDataBOT'           # query_bot, query_operadora
'@Infordata1_bot'       # query_bot, query_operadora, query_telx, query_fiscalia_bot
'@ImperialData_bot'     # query_bot, query_operadora
'@OlimpoDataBot'        # name_search_bot (en __init__)
```

Si cualquiera de estos bots cambia de nombre o es bloqueado, se requiere modificar el código fuente en múltiples lugares.

### 5.6 Import con Ruta Incorrecta (Bug Confirmado)

```python
# Línea 75-76 — dentro de query_fiscalia_bot():
from backend.utils.errors import SinResultadosError
raise SinResultadosError("「❌️」Sin Resultados...")
```

**Este import fallará en runtime** porque:
1. No existe el directorio `backend/utils/`
2. No existe el archivo `errors.py`
3. `SinResultadosError` ya está definida en el mismo archivo `bot_client.py` (línea 21)

Esto es un bug latente que solo se activará cuando se ejecute el branch `fiscalia_dni` del método `query_fiscalia_bot`.

### 5.7 Gestión de Archivos (I/O) Dentro de la Clase de Bots

`BotClient` maneja directamente operaciones de sistema de archivos:

```python
# Dentro de query_bot():
images_dir = os.path.join(os.path.dirname(__file__), 'static', 'images')
os.makedirs(images_dir, exist_ok=True)
filename = f"{dni}.jpg"
abs_path = os.path.join(images_dir, filename)
await msg.download_media(file=abs_path)

# Dentro de generate_c4_blue():
static_dir = Path(__file__).parent / "static" / "files"
static_dir.mkdir(parents=True, exist_ok=True)
filename = f"C4AZ_{dni}_{int(time.time())}.pdf"
file_path = static_dir / filename
await found_pdf.download_media(file=file_path)
```

Una clase que representa un **cliente de comunicaciones** no debería saber dónde guardar archivos en disco. Esa responsabilidad pertenece a una capa de almacenamiento/infraestructura separada.

### 5.8 Configuración de Rutas No Centralizada

Las rutas `static/images`, `static/files`, `static/docs` se construyen de forma diferente en cada método:

- `os.path.join(os.path.dirname(__file__), 'static', 'images')` — en `query_bot`
- `Path(__file__).parent / "static" / "files"` — en métodos de generación
- `Path(__file__).parent.absolute() / "static" / "docs"` — en `query_fiscalia_bot`

Tres estilos diferentes para el mismo directorio raíz.

### 5.9 Problema de Colisión de Nombres de Archivo

```python
filename = f"{dni}.jpg"  # query_bot()
```

Si dos usuarios consultan el mismo DNI simultáneamente, el segundo sobrescribirá la imagen del primero. No hay UUID ni timestamp en el nombre del archivo para consultas DNI básicas.

### 5.10 Bloques que Pueden Extraerse

| Bloque | Módulo propuesto |
|---|---|
| Patrón de polling genérico | `telegram/polling.py::poll_bot_response()` |
| Lista de bots gratuitos | `config/bots.py::FREE_BOTS` |
| Lista de bots premium | `config/bots.py::PREMIUM_BOTS` |
| Detección de operadora/brand | `parsers/phone_parser.py::detect_brand()` |
| I/O de archivos estáticos | `storage/file_storage.py::FileStorage` |
| Gestión de clientes Telegram | `telegram/client_manager.py::TelegramClientManager` |
| Anti-spam checker | `telegram/guards.py::AntiSpamGuard` |
| Sin resultados detector | `telegram/guards.py::NoResultsGuard` |
| Métodos de generación de docs | `services/document_service.py::DocumentService` |
| Métodos de consulta de datos | `services/query_service.py::QueryService` |
| Métodos de búsqueda facial | `services/facial_service.py::FacialService` |
| Métodos de antecedentes | `services/records_service.py::RecordsService` |

---

## 6. ANÁLISIS DE `main.py`

### 6.1 Tamaño y Estructura

**1,853 líneas** en un único archivo. Contiene:

- Configuración de la app (CORS, middlewares, static files)
- Todos los endpoints HTTP (~40+ rutas)
- Lógica de autenticación (Firebase, Google OAuth, JWT local)
- Validaciones de negocio (créditos, roles, estados)
- Manejo de archivos subidos
- Turnstile CAPTCHA validation
- Gestión de anuncios, usuarios, paquetes de créditos
- Notificaciones push
- Historial de búsquedas

### 6.2 Mapa de Endpoints Identificados

**Auth:**
- `POST /api/auth/firebase-login`
- `POST /api/auth/google-login`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/verify-email`
- `POST /api/auth/resend-verification`

**Búsquedas:**
- `POST /api/search/dni`
- `POST /api/search/dni-premium`
- `POST /api/search/nombre`
- `POST /api/search/celular`
- `POST /api/search/operadora`

**Teléfonos:**
- `POST /api/telefono/dni`
- `POST /api/telefono/cel`

**Documentos:**
- `POST /api/generate/c4_blue`
- `POST /api/generate/c4_inscripcion`
- `POST /api/generate/dni_electronico`
- `POST /api/generate/dni_azul`
- `POST /api/generate/dni_amarillo`
- `POST /api/generate/familiares_pdf`
- `POST /api/generate/familiares_texto`
- `POST /api/generate/arbol_visual`

**Antecedentes/Registros:**
- `POST /api/records/antpen`
- `POST /api/records/antjud`
- `POST /api/records/antpol`
- `POST /api/records/delitos`

**Facial:**
- `POST /api/facial/search`

**Fiscalía:**
- `POST /api/fiscalia/search`

**Admin:**
- `GET /api/admin/users`
- `GET /api/admin/user/{id}`
- `PATCH /api/admin/user/{id}`
- `DELETE /api/admin/user/{id}`
- `GET /api/admin/history`
- `GET /api/admin/stats`
- `GET/POST/PUT/DELETE /api/admin/announcements`
- `GET/POST/DELETE /api/admin/credit-packages`

**Usuario:**
- `GET /api/user/profile`
- `GET /api/user/history`
- `POST /api/credits/purchase`
- `GET /api/credits/packages`

### 6.3 Patrón Repetido en Endpoints

Cada endpoint de búsqueda repite el mismo bloque de código:

```python
# Repetido ~20 veces:
user = await get_current_user(token)          # 1. Auth
if user["credits"] < cost:                    # 2. Validar créditos
    raise HTTPException(402, "Créditos insuficientes")
history_id = db.create_search_history(...)   # 3. Registrar intento
try:
    result = await bot_client.query_xxx(...)  # 4. Ejecutar consulta
    db.update_user_credits(user_id, -cost)   # 5. Descontar crédito
    db.update_search_history(history_id, ...) # 6. Actualizar historial
    return result
except SinResultadosError as e:
    db.update_search_history(history_id, "no_results")
    raise HTTPException(404, str(e))
except Exception as e:
    db.update_search_history(history_id, "error")
    raise HTTPException(500, str(e))
```

Este bloque debería existir una sola vez como un servicio o decorator `@with_credit_transaction`.

### 6.4 Instancias Globales

```python
bot_client = BotClient()  # Línea 79
db = Database()           # Línea 80
```

Variables globales mutables sin inyección de dependencias. Esto hace imposible el testing unitario de los endpoints sin arrancar Telegram y PostgreSQL.

### 6.5 Validación de Turnstile Hardcodeada

La lógica de verificación CAPTCHA Turnstile está implementada directamente dentro de `main.py` como función local, no como middleware ni como servicio separado.

---

## 7. ANÁLISIS DE `database.py`

### 7.1 Tamaño y Estructura

**1,863 líneas**. Clase `Database` única con métodos para:
- Gestión de usuarios
- Historial de búsquedas
- Créditos y paquetes
- Anuncios
- Notificaciones
- Referidos
- Configuración del sistema
- Solicitudes de promo
- Solicitudes de crédito
- Bots (configuración)
- Estadísticas/dashboard

### 7.2 Uso de psycopg2 Síncrono en Contexto Async

`database.py` usa `psycopg2` (síncrono) dentro de una aplicación FastAPI completamente asíncrona. Esto significa que **cada query a la base de datos bloquea el event loop de asyncio**, reduciendo dramáticamente el throughput del servidor bajo carga.

```python
# Ejemplo del problema:
def get_user_by_email(self, email):      # ← función síncrona
    conn = psycopg2.connect(...)         # ← bloquea el event loop
    cursor = conn.cursor()
    cursor.execute("SELECT ...")         # ← bloquea el event loop
    return cursor.fetchone()
```

La solución correcta es usar `asyncpg` o ejecutar en un thread pool con `asyncio.run_in_executor`.

### 7.3 Gestión de Conexiones Ineficiente

Cada método abre y cierra su propia conexión:

```python
def some_method(self):
    conn = psycopg2.connect(self.DATABASE_URL)
    try:
        cursor = conn.cursor()
        # ... query ...
    finally:
        conn.close()
```

Sin pool de conexiones real, cada request HTTP genera un ciclo connect/disconnect a PostgreSQL, que es costoso en latencia y puede agotar las conexiones disponibles bajo carga media.

### 7.4 Transformaciones de Datos en la Capa de Base de Datos

`database.py` realiza transformaciones de datos y lógica de negocio que no deberían estar ahí:

```python
def get_user_stats(self, user_id):
    # Calcula estadísticas complejas mezclando queries y Python
    # Debería estar en una capa de servicio
```

### 7.5 SQL Raw sin Parametrización Consistente

Aunque la mayoría de queries usan parámetros correctamente, la revisión del archivo muestra patrones donde la interpolación de strings podría haberse usado en algunos casos de generación dinámica de queries.

---

## 8. ANÁLISIS DE ARCHIVOS DE SOPORTE

### 8.1 `bot_pool.py` (116 líneas) — ✅ Relativamente Bien

`BotPool` usa `asyncio.Lock` por bot, lo cual es correcto para control de concurrencia. Sin embargo:
- El timeout de `acquire_bot` usa `asyncio.wait_for` pero si el lock no se adquiere en tiempo, simplemente retorna `None`, dejando al llamador responsable de manejar el caso — inconsistente con el resto del sistema.

### 8.2 `auth.py` (53 líneas) — ✅ Bien

Implementación correcta de JWT con `python-jose`. El token tiene expiración de 30 días que podría ser configurable desde env vars.

### 8.3 `email_utils.py` (228 líneas) — ⚠️ Mezcla Responsabilidades

Mezcla:
1. Verificación de emails desechables (llamada a API externa `EmailListVerify`)
2. Envío de emails de verificación
3. Envío de emails de compra
4. Envío de emails de aprobación
5. Envío de emails de confirmación

Son 4 responsabilidades distintas en un solo archivo. También usa `smtplib` en contexto async con `asyncio.to_thread()`, lo cual es correcto.

### 8.4 `parser.py` (222 líneas) — ⚠️ Función Única Muy Larga

Tiene una función `parse_bot_response(text)` de ~200 líneas que usa múltiples regex y lógica condicional compleja. Es difícil de mantener y testear. Debería dividirse en parsers especializados por tipo de respuesta.

### 8.5 `firebase_admin_utils.py` (49 líneas) — ✅ Bien

Inicialización correcta con fallback a archivo de credenciales. Un detalle: la inicialización ocurre a nivel de módulo (al importar), lo que dificulta el testing.

### 8.6 Scripts de Parche — 🔴 CRÍTICO

`fix_c4.py`, `fix_syntax.py`, `update_script.py` son scripts que **buscan strings exactos dentro de `bot_client.py` y los reemplazan**:

```python
# fix_syntax.py:
with open('bot_client.py', 'r') as f:
    content = f.read()
content = content.replace(OLD_CODE, NEW_CODE)
with open('bot_client.py', 'w') as f:
    f.write(content)
```

Esto indica que el proceso de desarrollo no usa git branches ni PRs para aplicar correcciones — se parchea el archivo directamente en producción. Si el string buscado cambia, el script falla silenciosamente y el código puede quedar en estado inconsistente.

### 8.7 `bot.db` — SQLite Residual

Existe un archivo `bot.db` (SQLite) en el directorio backend. La aplicación usa PostgreSQL (`database.py` con `psycopg2`). Este archivo SQLite es un residuo de una versión anterior y puede generar confusión sobre qué base de datos es la "real".

---

## 9. INVENTARIO DE PROBLEMAS POR CATEGORÍA

### 9.1 Código Duplicado

| Duplicación | Frecuencia | Archivos afectados |
|---|---|---|
| Patrón de polling Telegram | ~20x | `bot_client.py` |
| Lista de bots gratuitos | 2-3x | `bot_client.py` |
| Bloque auth+créditos+historial | ~20x | `main.py` |
| Construcción de rutas `static/` | 3+ estilos | `bot_client.py` |
| `import random` dentro de método | 2x | `bot_client.py` |
| `generar_sesion.py` ≈ `telegram_login.py` | 2 archivos | Ambos |

### 9.2 Código Muerto o No Utilizado

| Elemento | Ubicación | Evidencia |
|---|---|---|
| `bot.db` | `backend/` | SQLite sin uso en código actual |
| `update_script.py` | `backend/` | Scripts de parche one-shot |
| `fix_c4.py` | `backend/` | Script de parche one-shot |
| `fix_syntax.py` | `backend/` | Script de parche one-shot |
| `enable_promo.py` | `backend/` | Script one-shot ya ejecutado |
| `_clean_bot_text` | `bot_client.py:12` | Función libre definida pero potencialmente no llamada consistentemente |
| `self.name_search_bot` | `bot_client.py:131` | Asignado en `__init__` pero puede no usarse en todos los métodos que lo necesitan |

### 9.3 Funciones Demasiado Largas

| Función | Archivo | Líneas estimadas |
|---|---|---|
| `query_bot` | `bot_client.py` | ~145 |
| `query_operadora` | `bot_client.py` | ~155 |
| `search_premium_group` | `bot_client.py` | ~180 |
| `generate_facial` | `bot_client.py` | ~150 |
| `query_fiscalia_bot` | `bot_client.py` | ~118 |
| `parse_bot_response` | `parser.py` | ~200 |
| Múltiples endpoints | `main.py` | 30-80 cada uno |

### 9.4 Imports Dentro de Funciones (Anti-patrón)

```python
# bot_client.py — imports dentro de métodos:
import random          # query_bot(), query_operadora()
import asyncio         # query_fiscalia_bot()
import re as _re       # query_operadora()
from pathlib import Path   # query_fiscalia_bot()
import time            # query_fiscalia_bot()
from backend.utils.errors import SinResultadosError  # BUG — ruta no existe
```

Los imports dentro de funciones se re-ejecutan en cada llamada (aunque Python los cachea en `sys.modules`, igual es un anti-patrón que reduce legibilidad y puede ocultar errores de importación hasta runtime tardío).

### 9.5 Manejo de Errores

**Bare except con pass:**
```python
# bot_client.py:188
except: pass  # ← Traga cualquier excepción silenciosamente
```

**Catch genérico que enmascara errores:**
```python
except Exception as e:
    print(f"⚠️ Err {bot}: {e}")  # ← Solo print, no log estructurado
    last_err = str(e)
    continue
```

**Except vacío en get_entity:**
```python
try:
    bot_entity = await self.client.get_entity(target_group)
    target_bot_id = bot_entity.id
except:
    target_bot_id = 0  # ← Falla silenciosa
```

### 9.6 Manejo de Logs

El sistema usa `print()` para ~90% de los mensajes de diagnóstico en `bot_client.py`. Solo `main.py` usa `logging`. Esto hace que:
- Los logs de `bot_client.py` no tengan nivel (DEBUG/INFO/WARNING/ERROR)
- No se puedan filtrar por severidad
- No se puedan enrutar a sistemas de monitoreo
- En producción con Gunicorn/Uvicorn, los `print()` van a stdout sin metadatos

### 9.7 Configuración y Variables de Entorno

El archivo `.env` **está versionado en el repositorio** (aparece en `backend/.env` según environment_details). Esto expone credenciales de Telegram, claves API y configuración de producción en el historial de git.

Variables de entorno sin defaults claros ni validación al startup:
- Si `TELEGRAM_API_ID` es `None`, `BotClient.__init__` falla en runtime
- No hay validación de que las variables críticas estén presentes al arrancar

---

## 10. VIOLACIONES SOLID Y CLEAN ARCHITECTURE

### 10.1 Single Responsibility Principle (SRP) — Violaciones Severas

| Clase/Módulo | Responsabilidades actuales (debería ser 1) |
|---|---|
| `BotClient` | Conexión Telegram + Pooling + Polling + Parsing + I/O de archivos + Lógica de negocio |
| `main.py` | Routing HTTP + Auth + Validaciones + Lógica de negocio + Gestión de archivos |
| `Database` | Acceso a datos + Transformaciones + Lógica de negocio + Estadísticas |
| `email_utils.py` | Verificación de emails + Envío de 4 tipos distintos de emails |

### 10.2 Open/Closed Principle (OCP) — Violaciones

Para agregar un nuevo bot de Telegram, hay que modificar la lista hardcodeada en cada método de `bot_client.py`. El sistema no está "cerrado para modificación" — requiere tocar el código cada vez que cambia la infraestructura de bots.

### 10.3 Liskov Substitution Principle (LSP) — N/A

No hay jerarquías de herencia relevantes. El sistema no usa polimorfismo, lo que es parte del problema.

### 10.4 Interface Segregation Principle (ISP) — Violaciones

`BotClient` tiene una interfaz enorme con 29 métodos. Los clientes de esta clase (`main.py`) solo necesitan subconjuntos de esos métodos para cada endpoint. No hay interfaces segregadas.

### 10.5 Dependency Inversion Principle (DIP) — Violaciones Severas

```python
# main.py depende de implementaciones concretas:
bot_client = BotClient()   # ← Depende de clase concreta
db = Database()            # ← Depende de clase concreta

# No hay abstracciones/interfaces:
# - No existe IBotClient
# - No existe IDatabase
# - No existe IEmailService
```

### 10.6 Clean Architecture — Ausencia Total de Capas

```
Actual:                    Clean Architecture:
─────────────────────      ──────────────────────
main.py (CAOS)             Presentation Layer (routes)
   ↓ todo                       ↓
database.py                Application Layer (use cases)
   ↓ todo                       ↓
bot_client.py              Domain Layer (entities, rules)
                                ↓
                           Infrastructure Layer (DB, Telegram, Email)
```

No existe separación de capas. `main.py` accede directamente a `Database()` y a `BotClient()` sin pasar por ninguna capa de aplicación o dominio.

---

## 11. PROBLEMAS CRÍTICOS

### 🔴 C1 — Credenciales Expuestas en el Repositorio

**Archivo:** `backend/.env`  
**Impacto:** Las credenciales de Telegram (API_ID, API_HASH, SESSION_STRING), claves JWT, y posiblemente credenciales de Firebase están en el repositorio git. Cualquier persona con acceso al repo tiene acceso total a las cuentas de Telegram utilizadas.

**Acción inmediata:** Rotar TODAS las credenciales, eliminar `.env` del historial git con `git filter-branch` o BFG, agregar `backend/.env` a `.gitignore`.

### 🔴 C2 — Bug de Import Inexistente (Falla en Runtime)

**Archivo:** `bot_client.py:75`  
```python
from backend.utils.errors import SinResultadosError
```
**Impacto:** Cualquier consulta a Fiscalía que detecte "sin resultados" lanzará un `ModuleNotFoundError` en lugar del error esperado, causando un 500 al usuario y un error no manejado.

### 🔴 C3 — psycopg2 Síncrono Bloqueando Event Loop Async

**Archivo:** `database.py`  
**Impacto:** Bajo cualquier carga concurrente, cada query SQL bloquea el event loop de uvicorn, causando degradación de performance severa y posibles timeouts en cadena. Un query lento de 200ms bloquea TODAS las requests concurrentes.

### 🔴 C4 — Scripts de Parche Modificando Código Fuente en Producción

**Archivos:** `fix_c4.py`, `fix_syntax.py`, `update_script.py`  
**Impacto:** Si estos scripts se ejecutan más de una vez o si el string buscado no se encuentra exactamente, el código puede quedar corrupto sin ningún aviso. Es un vector de introducción de bugs difíciles de rastrear.

### 🔴 C5 — Colisión de Nombres en Archivos de Imágenes

**Archivo:** `bot_client.py:330`  
```python
filename = f"{dni}.jpg"  # Sin UUID ni timestamp
```
**Impacto:** Si usuario A y usuario B consultan el mismo DNI simultáneamente (race condition), el archivo de uno sobrescribirá el del otro, potencialmente mostrando la imagen incorrecta.

### 🔴 C6 — Sin Autenticación en Endpoints Admin

Requiere verificación manual, pero si algún endpoint admin solo valida el token JWT sin verificar el rol `admin`, cualquier usuario autenticado podría acceder a funciones administrativas.

---

## 12. PROBLEMAS IMPORTANTES

### 🟠 I1 — Monolito de 2,613 Líneas Sin Cohesión

`bot_client.py` mezcla responsabilidades incompatibles. Dificulta enormemente onboarding de nuevos developers, testing, y modificaciones puntuales.

### 🟠 I2 — Patrón de Polling Duplicado 20+ Veces

~1,500-1,800 líneas de `bot_client.py` son variaciones del mismo patrón de polling. Cualquier bug en el patrón (ej: timeout incorrecto, detección de spam mejorada) debe corregirse en 20+ lugares.

### 🟠 I3 — Sin Tests de Ningún Tipo

El proyecto no tiene tests unitarios, de integración ni end-to-end. `test_db.py` es un script de debug, no un test. Cualquier refactorización o cambio es extremadamente riesgoso.

### 🟠 I4 — Gestión de Concurrencia Incompleta

`BotPool` gestiona locks por bot, pero `bot_client.py` tiene métodos que no usan `BotPool` (como `query_fiscalia_bot`, `query_telx`). Esto puede generar conflictos de Telegram (envío simultáneo de comandos al mismo bot desde dos requests).

### 🟠 I5 — `main.py` con 1,853 Líneas Sin Separación de Concerns

Todos los endpoints en un archivo hace que sea difícil encontrar, modificar o testear endpoints individuales.

### 🟠 I6 — `database.py` con 1,863 Líneas

Una sola clase para gestionar 10+ entidades distintas de la base de datos.

### 🟠 I7 — Sin Rate Limiting en la API

No hay límite de requests por usuario o por IP. Un usuario malicioso podría ejecutar consultas masivas, agotando créditos de los bots de Telegram o sobrecargar la base de datos.

### 🟠 I8 — Manejo de Sesión Telegram Frágil

Si la sesión de Telegram expira o el `StringSession` se invalida (por otra instancia activa), el sistema falla silenciosamente con mensajes de error poco claros. El método `start()` detecta si no está autorizado pero solo imprime un print y continúa.

---

## 13. PROBLEMAS MENORES

### 🟡 M1 — Imports Dentro de Métodos

`import random`, `import asyncio`, `import re` dentro de métodos. Funciona, pero es antipatrón.

### 🟡 M2 — Diferentes Estilos para Construir Rutas de Archivos

`os.path.join`, `Path()`, `Path().absolute()` mezclados en el mismo archivo.

### 🟡 M3 — `generar_sesion.py` y `telegram_login.py` son Duplicados

Dos archivos que hacen exactamente lo mismo con mensajes ligeramente distintos.

### 🟡 M4 — `requirements.txt` Sin Pinning de Versiones

```
fastapi
telethon
psycopg2-binary
# ...
```
Sin versiones exactas, un `pip install` en una nueva fecha puede instalar versiones incompatibles y romper el sistema.

### 🟡 M5 — Configuración de Logging Básica

Solo `logging.basicConfig(level=logging.INFO)` en `main.py`. No hay configuración de handlers, formatters, o rotación de logs.

### 🟡 M6 — `bot.db` (SQLite) Residual en el Repositorio

Confusión sobre qué base de datos usa el sistema.

### 🟡 M7 — `self.name_search_bot` Asignado pero Potencialmente Inconsistente

```python
self.name_search_bot = '@OlimpoDataBot'  # __init__:131
```
Podría no ser el bot que realmente se usa en búsquedas por nombre en producción.

### 🟡 M8 — Ausencia de Validación de Schema en Respuestas de Bots

El sistema confía en que el texto del bot tendrá cierto formato. Si un bot cambia su formato de respuesta, el parsing falla silenciosamente y retorna datos vacíos o incorrectos.

### 🟡 M9 — Tiempos de Espera Hardcodeados

```python
await asyncio.sleep(8)  # query_fiscalia_bot
await asyncio.sleep(5)  # query_telx
await asyncio.sleep(3)  # query_operadora
await asyncio.sleep(2)  # query_bot
```
No son configurables. Si un bot se vuelve más lento, requiere cambios en el código.

### 🟡 M10 — Falta de Documentación en Métodos Complejos

Muchos métodos de `bot_client.py` no tienen docstrings o tienen docstrings mínimas que no explican los parámetros, retorno, o comportamiento en casos de error.

---

## 14. RIESGOS TÉCNICOS

### Riesgo 1: Fuga de Sesión Telegram (ALTO)

Si la sesión `StringSession` de Telegram expira y se crea una nueva instancia del servidor (deploy), la sesión anterior queda activa causando `AuthKeyDuplicatedError`. El servidor advierte sobre esto pero continúa de todos modos.

### Riesgo 2: Cambio de Formato de Bot de Telegram (ALTO)

Si cualquiera de los bots de Telegram cambia su formato de respuesta (agregar emojis, cambiar separadores, etc.), el parsing silenciosamente retornará datos incorrectos o vacíos, que el sistema podría registrar como "exitoso" y descontar créditos al usuario.

### Riesgo 3: Deuda Técnica Impide Escalado (ALTO)

Agregar una nueva fuente de datos (nuevo bot, nueva API) requiere modificar `bot_client.py`, `main.py`, y `database.py` simultáneamente, aumentando el riesgo de regresiones.

### Riesgo 4: Fuga de Datos por Archivos Estáticos (MEDIO)

Los documentos generados (C4, DNI, árboles familiares, antecedentes) se guardan en `static/` con nombres predecibles. Si el servidor no tiene autenticación en los archivos estáticos, un usuario podría adivinar o enumerar URLs de documentos de otros usuarios.

```python
# Nombre predecible:
filename = f"C4AZ_{dni}_{int(time.time())}.pdf"
# Con el DNI y un timestamp aproximado, alguien podría bruteforce la URL
```

### Riesgo 5: PostgreSQL Connections Exhausted (MEDIO)

Sin pool de conexiones real, bajo carga alta, el sistema puede agotar el límite de conexiones de PostgreSQL en Render (típicamente 25-100 conexiones en planes básicos).

### Riesgo 6: Bloqueo de Cuentas Telegram (MEDIO)

Si los bots detectan uso automatizado masivo, pueden reportar las cuentas Telegram usadas para el scraping, resultando en baneos. Sin rotación automática de cuentas ni límites de rate, este riesgo aumenta con el tiempo.

### Riesgo 7: Pérdida de Datos en Race Conditions (BAJO-MEDIO)

Colisión de nombres de archivos de imagen (C5 arriba) + potencial race condition en actualización de créditos si dos requests del mismo usuario se procesan simultáneamente.

---

## 15. DEUDA TÉCNICA DETECTADA

### Categoría: Arquitectural (Severidad: ALTA)
- Sin capas de abstracción (Clean Architecture)
- Sin inyección de dependencias
- Tres monolitos mayores (bot_client, main, database)
- Sin separación de concerns

### Categoría: Patrones de Código (Severidad: ALTA)
- Patrón de polling duplicado 20+ veces
- Bloque auth+créditos+historial duplicado ~20 veces
- Imports dentro de funciones
- Bare except con pass
- Variables globales mutables

### Categoría: Calidad (Severidad: ALTA)
- Cero tests (unitarios, integración, E2E)
- Logging con print() en lugar de logging estructurado
- Sin validación de schemas de respuesta
- Sin documentación de API (aunque FastAPI la genera, los schemas no están completos)

### Categoría: Infraestructura (Severidad: MEDIA)
- psycopg2 síncrono en contexto async
- Sin pool de conexiones real
- Sin rate limiting
- Sin caché (misma consulta repetida = nuevo hit a Telegram)

### Categoría: Seguridad (Severidad: ALTA)
- `.env` con credenciales en el repo
- Archivos generados con nombres potencialmente predecibles
- Sin validación de autenticación en archivos estáticos

### Categoría: Mantenibilidad (Severidad: ALTA)
- Scripts de parche que modifican código fuente
- Bots hardcodeados sin configuración
- Timeouts hardcodeados sin configuración
- Sin requirements pinning

---

## 16. NUEVA ARQUITECTURA RECOMENDADA

### Estructura de Carpetas Propuesta (Basada en el Proyecto Real)

```
backend/
│
├── main.py                          # Solo arranque de la app FastAPI (< 50 líneas)
│
├── config/                          # Configuración centralizada
│   ├── __init__.py
│   ├── settings.py                  # Pydantic Settings — todas las env vars
│   ├── bots.py                      # Lista de bots Telegram (FREE_BOTS, PREMIUM_BOTS)
│   └── paths.py                     # Rutas de directorios estáticos
│
├── api/                             # Capa de Presentación — solo routes HTTP
│   ├── __init__.py
│   ├── deps.py                      # Dependencias comunes (get_current_user, etc.)
│   ├── router.py                    # Router principal que incluye todos los sub-routers
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── auth.py                  # /api/auth/*
│   │   ├── search.py                # /api/search/* (DNI, nombre, celular)
│   │   ├── telefono.py              # /api/telefono/*
│   │   ├── documents.py             # /api/generate/* (C4, DNI virtual, familiares)
│   │   ├── records.py               # /api/records/* (antpen, antjud, antpol, delitos)
│   │   ├── facial.py                # /api/facial/*
│   │   ├── fiscalia.py              # /api/fiscalia/*
│   │   ├── credits.py               # /api/credits/*
│   │   └── admin/
│   │       ├── __init__.py
│   │       ├── users.py             # /api/admin/users/*
│   │       ├── history.py           # /api/admin/history/*
│   │       ├── announcements.py     # /api/admin/announcements/*
│   │       └── stats.py             # /api/admin/stats/*
│   └── middleware/
│       ├── __init__.py
│       ├── turnstile.py             # Validación CAPTCHA Cloudflare
│       └── rate_limit.py            # Rate limiting por usuario/IP
│
├── services/                        # Capa de Aplicación — lógica de negocio
│   ├── __init__.py
│   ├── search_service.py            # Orquesta búsquedas: auth, créditos, historial, bot
│   ├── document_service.py          # Generación de documentos (C4, DNI virtual)
│   ├── records_service.py           # Antecedentes (penales, judiciales, policiales)
│   ├── phone_service.py             # Consultas telefónicas y de operadora
│   ├── facial_service.py            # Búsqueda facial
│   ├── fiscalia_service.py          # Consultas Fiscalía
│   ├── credit_service.py            # Gestión de créditos y transacciones
│   ├── auth_service.py              # Lógica de autenticación (Firebase, Google, local)
│   ├── user_service.py              # Perfil y gestión de usuarios
│   └── notification_service.py     # Emails y notificaciones
│
├── telegram/                        # Capa de Infraestructura — integración Telegram
│   ├── __init__.py
│   ├── client_manager.py            # Gestión de clientes Telethon (conexión, reconexión)
│   ├── bot_pool.py                  # Pool de concurrencia (ya existe, mover aquí)
│   ├── polling.py                   # Patrón de polling genérico (UN SOLO LUGAR)
│   ├── guards.py                    # _check_antispam, _is_sin_resultados
│   ├── bots/
│   │   ├── __init__.py
│   │   ├── base_bot.py              # Clase base abstracta para bots
│   │   ├── free_bots.py             # Bots gratuitos (dni, operadora, etc.)
│   │   ├── premium_bots.py          # Bots premium (grupo, Sirius)
│   │   ├── document_bots.py         # Bots de generación de documentos
│   │   ├── records_bots.py          # Bots de antecedentes
│   │   └── fiscalia_bot.py          # Bot de Fiscalía
│   └── exceptions.py               # SinResultadosError, TelegramError, etc.
│
├── repositories/                    # Capa de Datos — acceso a PostgreSQL
│   ├── __init__.py
│   ├── base.py                      # Clase base con pool de conexiones asyncpg
│   ├── user_repository.py           # CRUD usuarios
│   ├── search_repository.py         # CRUD historial de búsquedas
│   ├── credit_repository.py         # CRUD créditos y paquetes
│   ├── announcement_repository.py   # CRUD anuncios
│   ├── notification_repository.py   # CRUD notificaciones
│   └── admin_repository.py          # Queries de dashboard admin
│
├── parsers/                         # Parseo de respuestas de bots
│   ├── __init__.py
│   ├── base_parser.py               # Clase base / utilidades comunes
│   ├── dni_parser.py                # Parseo respuestas DNI
│   ├── phone_parser.py              # Parseo respuestas teléfono/operadora
│   ├── records_parser.py            # Parseo antecedentes
│   └── family_parser.py             # Parseo árbol familiar
│
├── storage/                         # Gestión de archivos estáticos
│   ├── __init__.py
│   └── file_storage.py             # Descarga y guardado de medios de Telegram
│
├── schemas/                         # Pydantic models para request/response
│   ├── __init__.py
│   ├── auth.py
│   ├── search.py
│   ├── user.py
│   ├── credit.py
│   └── admin.py
│
├── models/                          # Modelos de dominio (dataclasses/pydantic)
│   ├── __init__.py
│   ├── user.py
│   ├── search_result.py
│   └── document.py
│
├── providers/                       # Proveedores externos (no-Telegram)
│   ├── __init__.py
│   ├── firebase_provider.py        # Firebase Admin SDK
│   ├── email_provider.py           # SMTP email
│   ├── turnstile_provider.py       # Cloudflare Turnstile
│   └── scraper_provider.py         # Web scraping (dniperu, etc.)
│
├── utils/                           # Utilidades genéricas
│   ├── __init__.py
│   ├── errors.py                    # Excepciones personalizadas (SinResultadosError aquí)
│   ├── security.py                  # JWT, hashing (mover desde auth.py)
│   └── validators.py               # Validaciones de datos (DNI, teléfono, etc.)
│
├── tests/                           # Tests (por crear)
│   ├── __init__.py
│   ├── unit/
│   │   ├── test_parsers.py
│   │   ├── test_guards.py
│   │   └── test_validators.py
│   ├── integration/
│   │   ├── test_search_service.py
│   │   └── test_credit_service.py
│   └── conftest.py
│
├── static/                          # Archivos generados (ya existe)
│   ├── images/
│   ├── files/
│   └── docs/
│
├── scripts/                         # Scripts utilitarios (no en producción)
│   ├── generar_sesion.py
│   ├── enable_promo.py
│   └── check_db.py
│
├── .env.example                     # Template de variables de entorno
├── requirements.txt                 # Con versiones pinneadas
└── setup_database.sql               # Schema inicial de DB
```

### Justificación de la Estructura

- **`api/routes/`**: Cada dominio tiene su propio archivo de rutas (~50-100 líneas cada uno vs 1,853 actuales)
- **`services/`**: La lógica de negocio vive aquí, no en las routes ni en el cliente de Telegram
- **`telegram/`**: Todo lo relacionado con Telethon/bots separado del resto
- **`telegram/polling.py`**: El patrón de polling existe UNA sola vez, parametrizable
- **`repositories/`**: Acceso a datos separado de lógica de negocio, usando asyncpg
- **`parsers/`**: Cada tipo de respuesta tiene su parser especializado
- **`storage/`**: I/O de archivos separado del cliente Telegram
- **`schemas/`**: Contratos de API bien definidos con Pydantic
- **`scripts/`**: Scripts utilitarios fuera del código de producción

---

## 17. PLAN DE REFACTORIZACIÓN POR PRIORIDADES

### PRIORIDAD 1 — URGENTE (Seguridad y Bugs Críticos)

> **Objetivo:** Eliminar riesgos de seguridad y bugs que afectan usuarios en producción ahora mismo.

1. **Rotar y proteger credenciales**
   - Eliminar `backend/.env` del repositorio
   - Ejecutar `git rm --cached backend/.env && git commit`
   - Usar `git filter-branch` o BFG para purgar del historial
   - Agregar `backend/.env` al `.gitignore`
   - Rotar: SESSION_STRING de Telegram, JWT_SECRET, credenciales Firebase, API keys
   - Tiempo estimado: **2-4 horas**

2. **Corregir el import incorrecto en `query_fiscalia_bot`**
   - Cambiar `from backend.utils.errors import SinResultadosError` a usar la clase ya definida en el mismo archivo
   - Tiempo estimado: **15 minutos**

3. **Mover scripts de parche fuera del directorio de producción**
   - `fix_c4.py`, `fix_syntax.py`, `update_script.py`, `enable_promo.py` a una carpeta `scripts/archive/`
   - Asegurar que no se ejecuten automáticamente
   - Tiempo estimado: **30 minutos**

4. **Agregar nombre de archivo único para imágenes**
   - Cambiar `filename = f"{dni}.jpg"` a `filename = f"{dni}_{uuid4().hex[:8]}.jpg"`
   - Tiempo estimado: **30 minutos**

### PRIORIDAD 2 — ALTA (Performance y Confiabilidad)

> **Objetivo:** Resolver problemas que afectan performance bajo carga y estabilidad del sistema.

5. **Migrar `database.py` a asyncpg**
   - Reemplazar psycopg2 síncrono por asyncpg asíncrono
   - Implementar pool de conexiones real (`asyncpg.create_pool`)
   - Tiempo estimado: **3-5 días**

6. **Extraer patrón de polling a función genérica**
   - Crear `telegram/polling.py::poll_bot_response(client, target, sent_msg_id, validator_fn, ...)`
   - Reemplazar las 20+ instancias del patrón por llamadas a esta función
   - Tiempo estimado: **3-5 días**

7. **Externalizar configuración de bots**
   - Crear `config/bots.py` con `FREE_BOTS`, `PREMIUM_BOTS` como constantes configurables
   - Eliminar listas hardcodeadas de cada método
   - Tiempo estimado: **1 día**

8. **Centralizar gestión de rutas de archivos**
   - Crear `config/paths.py` con `STATIC_IMAGES_DIR`, `STATIC_FILES_DIR`, `STATIC_DOCS_DIR`
   - Tiempo estimado: **2 horas**

9. **Implementar logging estructurado**
   - Reemplazar todos los `print()` por `logger.info()`, `logger.warning()`, `logger.error()`
   - Configurar logging con formatters y handlers apropiados
   - Tiempo estimado: **1-2 días**

10. **Agregar rate limiting**
    - Implementar límite de requests por usuario (ej: 10/minuto para búsquedas)
    - Usar `slowapi` o middleware custom
    - Tiempo estimado: **1 día**

### PRIORIDAD 3 — MEDIA (Arquitectura y Mantenibilidad)

> **Objetivo:** Separar responsabilidades para que el sistema sea mantenible y extensible.

11. **Dividir `main.py` en routers separados**
    - Crear `api/routes/search.py`, `api/routes/auth.py`, etc.
    - Tiempo estimado: **3-5 días**

12. **Extraer servicios de `main.py`**
    - Crear `services/search_service.py` con el patrón auth+créditos+historial
    - Tiempo estimado: **3-5 días**

13. **Dividir `database.py` en repositorios**
    - Crear `repositories/user_repository.py`, `repositories/search_repository.py`, etc.
    - Tiempo estimado: **3-5 días**

14. **Separar BotClient en clases especializadas**
    - `telegram/client_manager.py`: gestión de clientes Telethon
    - `telegram/bots/free_bots.py`: consultas gratuitas
    - `telegram/bots/document_bots.py`: generación de documentos
    - `telegram/bots/records_bots.py`: antecedentes
    - Tiempo estimado: **5-7 días**

15. **Extraer I/O de archivos a `FileStorage`**
    - Crear `storage/file_storage.py`
    - Tiempo estimado: **1-2 días**

16. **Dividir `parser.py` en parsers especializados**
    - Tiempo estimado: **2-3 días**

17. **Implementar inyección de dependencias**
    - Usar el sistema de `Depends()` de FastAPI para servicios y repositorios
    - Tiempo estimado: **2-3 días**

### PRIORIDAD 4 — BAJA (Calidad y Deuda Técnica)

> **Objetivo:** Mejorar la calidad del código y reducir deuda técnica acumulada.

18. **Escribir tests unitarios**
    - Parsers, guards, validators son los más testeables
    - Mockear Telegram y PostgreSQL para services
    - Tiempo estimado: **5-10 días**

19. **Pinning de versiones en `requirements.txt`**
    - Ejecutar `pip freeze > requirements.txt` y revisar
    - Tiempo estimado: **2 horas**

20. **Eliminar código muerto**
    - `bot.db`, scripts one-shot ya ejecutados, duplicados de `generar_sesion`
    - Tiempo estimado: **2 horas**

21. **Agregar validaciones de inicio**
    - Verificar variables de entorno críticas al arranque y fallar rápido si no están
    - Tiempo estimado: **2 horas**

22. **Documentar schemas de respuesta de bots**
    - Crear documentación de los formatos de respuesta esperados de cada bot
    - Tiempo estimado: **1-2 días**

23. **Implementar caché para consultas frecuentes**
    - Redis para cachear resultados de DNIs consultados recientemente
    - Tiempo estimado: **2-3 días**

---

## 18. ESTIMACIONES

### 18.1 Estimación de Complejidad

| Tarea | Complejidad | Justificación |
|---|---|---|
| Seguridad/credenciales | Baja | Operaciones git y rotación de claves |
| Fix import incorrecto | Muy Baja | 1 línea de código |
| Migrar a asyncpg | Alta | Requiere reescribir 1,863 líneas de database.py |
| Extraer polling genérico | Media | Requiere identificar diferencias entre 20+ variantes |
| Dividir main.py | Media | Mecánico pero extenso |
| Dividir BotClient | Alta | Requiere entender dependencias entre métodos |
| Dividir database.py | Media | Mecánico pero extenso |
| Implementar tests | Alta | Requiere mocks complejos de Telegram |
| Implementar DI | Media | Cambio transversal a todo el sistema |

### 18.2 Estimación de Riesgo de Refactorización

| Fase | Riesgo | Mitigación |
|---|---|---|
| Prioridad 1 (seguridad) | Bajo | No modifica lógica |
| Prioridad 2 (performance) | Medio | asyncpg puede tener diferencias de API |
| Prioridad 3 (arquitectura) | Alto | Mover código sin tests puede romper funcionalidad |
| Prioridad 4 (calidad) | Bajo | Aditivo, no modifica lógica existente |

**El mayor riesgo está en la Prioridad 3**: dividir los monolitos sin tests existentes es peligroso. Se recomienda escribir tests de integración básicos (smoke tests de endpoints) ANTES de comenzar la división arquitectural.

### 18.3 Estimación de Tiempo Total

| Prioridad | Tareas | Tiempo estimado |
|---|---|---|
| P1 (urgente) | 4 tareas | 1-2 días |
| P2 (alta) | 6 tareas | 2-3 semanas |
| P3 (media) | 7 tareas | 4-6 semanas |
| P4 (baja) | 6 tareas | 3-4 semanas |
| **TOTAL** | **23 tareas** | **~10-15 semanas (developer a tiempo parcial)** |

Con un developer a tiempo completo dedicado a refactorización: **6-8 semanas**.

> **Nota:** Las estimaciones asumen que el developer conoce el dominio del negocio (qué hace cada bot, qué campos se esperan, etc.). Sin este conocimiento, añadir 30-50% más de tiempo.

### 18.4 Métricas Objetivo Post-Refactorización

| Métrica | Actual | Objetivo |
|---|---|---|
| Líneas archivo más grande | 2,613 | < 300 |
| Archivos de producción | ~8 | ~40-50 bien dimensionados |
| Cobertura de tests | 0% | > 60% |
| Código duplicado (polling) | 20x | 1x |
| Imports dentro de funciones | 6 | 0 |
| Variables globales mutables | 2 (main.py) | 0 (DI) |
| Credenciales en repo | Sí | No |
| Tiempo de respuesta DB (async) | Bloqueante | No bloqueante |

---

## APÉNDICE: REFERENCIAS DE CÓDIGO

Todas las referencias de línea se basan en el estado del repositorio en commit `bef4b21752249d19795f5f81de4dd6f290a16e44` (20 de junio de 2026).

| Problema | Archivo | Línea |
|---|---|---|
| Función antes de __init__ | bot_client.py | 28 |
| Import incorrecto | bot_client.py | 75 |
| Bare except pass | bot_client.py | 188 |
| Colisión nombre imagen | bot_client.py | 330 |
| import random dentro de método | bot_client.py | 252, 400 |
| Instancias globales | main.py | 79-80 |
| psycopg2 síncrono | database.py | ~toda la clase |
| Script parche peligroso | fix_syntax.py | 1-25 |
| .env en repo | backend/.env | — |
| SQLite residual | backend/bot.db | — |

---

*Fin del Informe de Auditoría Técnica*  
*Generado el 20 de junio de 2026 — Ningún archivo fue modificado durante esta auditoría.*
