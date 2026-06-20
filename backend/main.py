from fastapi import FastAPI, HTTPException, Depends, status, Form, Body, Query, Header, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel
from typing import Optional
import os
from dotenv import load_dotenv
from bot_client import BotClient, SinResultadosError
from bot_pool import BotPool
from database import Database
from parser import parse_bot_response
import asyncio
import shutil
import uuid
from pathlib import Path
import logging
from auth import verify_password, get_password_hash, create_access_token, decode_access_token
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
import httpx

# --- Setup Logging ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

ENVIRONMENT = os.getenv("ENVIRONMENT", "development").lower()
IS_PROD = ENVIRONMENT == "production"

def _parse_allowed_origins() -> list[str]:
    raw = os.getenv("ALLOWED_ORIGINS", "")
    origins = [o.strip() for o in raw.split(",") if o.strip()]
    if not origins and not IS_PROD:
        origins = [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ]
    return origins

ALLOWED_ORIGINS = _parse_allowed_origins()
ALLOW_DEV_LOGIN = os.getenv("ALLOW_DEV_LOGIN", "false").lower() == "true"
ALLOW_INSECURE_FIREBASE_FALLBACK = os.getenv("ALLOW_INSECURE_FIREBASE_FALLBACK", "false").lower() == "true"
ENFORCE_TURNSTILE = os.getenv("ENFORCE_TURNSTILE", "true" if IS_PROD else "false").lower() == "true"

app = FastAPI(title="Bot DNI API", version="1.0.0")

# --- Static Directories ---
images_dir = Path(__file__).parent / "static" / "images"
images_dir.mkdir(parents=True, exist_ok=True)
app.mount("/api/images", StaticFiles(directory=str(images_dir)), name="images")

files_dir = Path(__file__).parent / "static" / "files"
files_dir.mkdir(parents=True, exist_ok=True)
app.mount("/api/files", StaticFiles(directory=str(files_dir)), name="files_local")

# --- Mount parent static folder as /api/static ---
static_dir = Path(__file__).parent / "static"
app.mount("/api/static", StaticFiles(directory=str(static_dir)), name="static_root")

# --- CORS ---
if IS_PROD and not ALLOWED_ORIGINS:
    raise RuntimeError("En producción debes definir ALLOWED_ORIGINS con al menos un origen.")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Turnstile-Token"],
)

@app.api_route("/", methods=["GET", "HEAD"])
async def root():
    return {"status": "online", "message": "Bot DNI API is running"}

# --- Initialize Services ---
bot_client = BotClient()
db = Database()

def parse_user_agent(ua_string: str):
    if not ua_string: return {"device": "Desconocido", "browser": "Desconocido", "os": "Desconocido"}
    ua = ua_string.lower()
    if "mobile" in ua or "android" in ua or "iphone" in ua or "ipad" in ua: device = "Mobile"
    elif "tablet" in ua or "ipad" in ua: device = "Tablet"
    else: device = "Desktop"
    if "windows" in ua: os_name = "Windows"
    elif "mac os x" in ua or "macintosh" in ua: os_name = "macOS"
    elif "android" in ua: os_name = "Android"
    elif "iphone os" in ua or "ipad" in ua: os_name = "iOS"
    elif "linux" in ua: os_name = "Linux"
    else: os_name = "Otro"
    if "edg" in ua: browser = "Edge"
    elif "opr" in ua or "opera" in ua: browser = "Opera"
    elif "chrome" in ua and "safari" in ua: browser = "Chrome"
    elif "firefox" in ua: browser = "Firefox"
    elif "safari" in ua and "chrome" not in ua: browser = "Safari"
    else: browser = "Otro"
    return {"device": device, "browser": browser, "os": os_name}

async def api_log_search(request: Request, user_id, term, search_type):
    client_ip = request.headers.get('X-Forwarded-For', request.client.host if request.client else '').split(',')[0].strip()
    ua_str = request.headers.get("user-agent", "")
    ua_data = parse_user_agent(ua_str)
    try:
        await db.log_search(user_id, term, search_type, client_ip, ua_data["device"], ua_data["browser"], ua_data["os"], ua_str)
    except: pass

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/token", auto_error=False)

# --- Security: Blacklist ---
BANNED_DNIS = ["72928277"]

def check_banned_dni(dni: str):
    if dni in BANNED_DNIS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="ERROR."
        )

# --- Pydantic Models ---
class UserCreate(BaseModel):
    email: str
    password: str
    full_name: str

class UserLogin(BaseModel):
    email: str
    password: str

class GoogleLogin(BaseModel):
    id_token: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: dict

# --- Dependencies ---
async def get_current_user(token: str = Depends(oauth2_scheme)):
    if not token: return None
    
    payload = decode_access_token(token)
    if not payload:
        # Check if it's a "guest" or invalid token logic?
        # For protected routes, raise 401. 
        # But for search logging (optional user), we return None.
        return None
    user_email = payload.get("sub")
    if not user_email: return None
    
    # We could query DB, but for performance, trust token (as it's singed) or simple cache
    # To log search history, we need ID. So let's fetch minimal info if needed or embed ID in token.
    # We will fetch full user from DB to be safe
    return await db.get_user_by_email(user_email)

async def get_optional_user(token: str = Depends(oauth2_scheme)): 
    # This dependency doesn't raise 401, just returns user or None
    try:
        if not token: return None
        return await get_current_user(token)
    except: return None

async def verify_turnstile(token: Optional[str]):
    secret = os.getenv("TURNSTILE_SECRET_KEY")
    if ENFORCE_TURNSTILE and not secret:
        logger.error("TURNSTILE_SECRET_KEY no configurado con ENFORCE_TURNSTILE=true")
        raise HTTPException(status_code=500, detail="CAPTCHA no disponible por configuración del servidor.")
    if not secret:
        return # Permitir sólo cuando ENFORCE_TURNSTILE=false
    if not token:
        raise HTTPException(status_code=400, detail="Debes completar el CAPTCHA antes de continuar.")
    
    async with httpx.AsyncClient() as client:
        res = await client.post("https://challenges.cloudflare.com/turnstile/v0/siteverify", data={
            "secret": secret,
            "response": token
        })
        data = res.json()
        if not data.get("success"):
            raise HTTPException(status_code=400, detail="CAPTCHA inválido o expirado. Por favor, resuelve uno nuevo.")

    
# --- Cleanup Utility ---
async def clean_static_files():
    """Elimina todos los archivos en static/files/"""
    files_dir = Path(__file__).parent / "static" / "files"
    deleted_count = 0
    if files_dir.exists():
        for item in files_dir.iterdir():
            if item.is_file():
                try:
                    item.unlink()
                    deleted_count += 1
                except Exception as e:
                    logger.error(f"Error borrando archivo {item}: {e}")
    logger.info(f"🧹 Limpieza completada: {deleted_count} archivos eliminados.")
    return deleted_count

# --- Background Task ---
async def cleanup_loop():
    """Bucle infinito que se ejecuta cada minuto y limpia archivos a las 00:00 (hora local)."""
    import pytz
    from datetime import datetime
    
    # Define the timezone, e.g. America/Lima for Peru
    tz = pytz.timezone('America/Lima')
    
    while True:
        try:
            now = datetime.now(tz)
            if now.hour == 0 and now.minute == 0:
                logger.info("🕛 Medianoche detectada. Iniciando limpieza automática...")
                await clean_static_files()
                # Esperar 60 segundos para evitar que se ejecute más de una vez durante el mismo minuto
                await asyncio.sleep(60)
            else:
                # Revisar cada 30 segundos
                await asyncio.sleep(30)
        except Exception as e:
            logger.error(f"Error en loop de limpieza: {e}")
            await asyncio.sleep(60)

# --- Events ---
# --- Events ---
@app.on_event("startup")
async def startup_event():
    try:
        from firebase_admin_utils import init_firebase_admin
        init_firebase_admin()
        
        await bot_client.start()
        all_bots = [
            '@OlimpoDataBot', 
            '@SeleneSearch_Bot', 
            '@DEALERDATABOT', 
            '@HexDataBOT', 
            '@Infordata1_bot', 
            '@ImperialData_bot',
            '@Infordata1_bot'
        ]
        bot_client.bot_pool = BotPool(list(dict.fromkeys([b for b in all_bots if b])))
        logger.info("[OK] Bot pool initialized")
    except Exception as e: logger.error(f"❌ Error Bot/Firebase: {e}")
    
    try: 
        await db.connect()
        await db.ensure_default_costs()
    except Exception as e: logger.error(f"❌ Error DB: {e}")

    # Iniciar tarea de limpieza en background
    asyncio.create_task(cleanup_loop())

@app.on_event("shutdown")
async def shutdown_event():
    await bot_client.stop()
    await db.disconnect()

# --- Auth Routes ---

from email_utils import is_disposable_email, send_custom_verification_email, send_purchase_notification_email, send_purchase_approved_email, send_purchase_received_email
from firebase_admin_utils import generate_email_verification_link
import secrets
import string

# ... existing imports ...

@app.get("/api/auth/check-disposable")
async def check_disposable(email: str):
    is_disposable = await is_disposable_email(email)
    if is_disposable:
        raise HTTPException(status_code=400, detail="Dirección de correo no permitida (temporal).")
    return {"message": "Email permitido"}

class FirebaseLogin(BaseModel):
    id_token: str
    referral_code: Optional[str] = None

class PromoRequestCreate(BaseModel):
    tiktok_username: str
    video_url: str

class PromoStatusUpdate(BaseModel):
    status: str

@app.post("/api/auth/firebase-login", response_model=Token)
async def firebase_login(login_data: FirebaseLogin, request: Request):
    try:
        email = None
        decoded_token = None
        client_ip = request.headers.get('X-Forwarded-For', request.client.host if request.client else 'unknown').split(',')[0].strip()
        
        # 1. Try Secure Verification (Firebase Admin SDK)
        try:
             import firebase_admin
             from firebase_admin import auth
             if firebase_admin._apps:
                 decoded_token = auth.verify_id_token(login_data.id_token, clock_skew_seconds=60)
        except Exception as e:
             logger.warning(f"Firebase Admin verify failed (using fallback): {e}")

        # 2. Fallback inseguro sólo si está explícitamente habilitado
        if not decoded_token:
             if not ALLOW_INSECURE_FIREBASE_FALLBACK:
                 raise HTTPException(401, "No se pudo verificar el token Firebase de forma segura.")
             from jose import jwt as jose_jwt
             try:
                 logger.warning("ALLOW_INSECURE_FIREBASE_FALLBACK=true: usando verificación no segura (solo dev).")
                 decoded_token = jose_jwt.get_unverified_claims(login_data.id_token)
             except Exception as e:
                 logger.error(f"Error decoding token: {e}")
                 raise HTTPException(400, "Token inválido (formato incorrecto)")

        email = decoded_token.get('email')
        uid = decoded_token.get('user_id') or decoded_token.get('sub')
        name = decoded_token.get('name') or email.split('@')[0]
        picture = decoded_token.get('picture') or decoded_token.get('avatar_url')
        email_verified = decoded_token.get('email_verified', False)
        
        if not email:
            raise HTTPException(400, "Token sin email")

        # ENFORCE EMAIL VERIFICATION for Email/Password providers
        if not email_verified:
             raise HTTPException(403, "Debes verificar tu correo electrónico antes de ingresar. Revisa tu bandeja de entrada.")

        # Create/Update user in MySQL
        existing = await db.get_user_by_email(email)
        is_new_user = (existing is None)

        # IP checks only for NEW user registrations
        if is_new_user:
            if await db.is_ip_banned(client_ip):
                raise HTTPException(403, "Esta IP ha sido bloqueada. No puedes crear una cuenta desde esta dirección.")
            existing_from_ip = await db.get_user_by_ip(client_ip)
            if existing_from_ip:
                raise HTTPException(409, "Solo se permite una cuenta por IP. Ya existe una cuenta registrada desde tu red.")

        user = await db.create_firebase_user(email, uid, name, picture, ip_address=client_ip)
        if not user:
             raise HTTPException(500, "Error sincronizando usuario")
             
        # Generate referral code if missing
        await db.get_or_create_referral_code(user['id'])

        # Process referral for new users
        if is_new_user and login_data.referral_code:
            await db.process_referral(user['id'], login_data.referral_code)
             
        if user['status'] == 'banned':
             raise HTTPException(403, "Tu cuenta ha sido suspendida.")

        access_token = create_access_token(data={"sub": user['email']})
        user.pop('password_hash', None)
        return {"access_token": access_token, "token_type": "bearer", "user": user}

    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Firebase Login Error: {e}")
        raise HTTPException(401, f"Error de autenticación: {e}")

class DevLogin(BaseModel):
    email: str

@app.post("/api/auth/dev-login")
async def dev_login(login: DevLogin):
    if not ALLOW_DEV_LOGIN:
        raise HTTPException(404, "Not found")
    user = await db.get_user_by_email(login.email)
    if not user:
        # Create dummy admin if not exists?
        # For now assume user exists
        raise HTTPException(404, "User not found")
    
    access_token = create_access_token(data={"sub": user['email']})
    return {"access_token": access_token, "token_type": "bearer", "user": user}



@app.get("/api/auth/me", response_model=dict)
async def read_users_me(current_user: dict = Depends(get_current_user)):
    if not current_user: raise HTTPException(401, "No autenticado")
    
    try:
        if await db.try_give_daily_credit(current_user['id']):
            # Refetch to get updated credits
            updated = await db.get_user_by_id(current_user['id'])
            if updated: current_user = updated
    except Exception as e:
        logger.error(f"Error updating daily credits: {e}")

    current_user.pop('password_hash', None)
    return current_user

# --- Admin Dependencies ---
async def get_current_admin(current_user: dict = Depends(get_current_user)):
    if not current_user: raise HTTPException(401, "No autenticado")
    if current_user['role'] != 'admin':
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Se requieren privilegios de administrador")
    return current_user


class FiscaliaSearchRequest(BaseModel):
    type: str
    target: str

@app.post("/api/fiscalia/search")
async def search_fiscalia(req: FiscaliaSearchRequest, request: Request, user: dict = Depends(get_current_user)):
    user_id = user['id']
    target = req.target.strip().upper()
    option_type = req.type
    
    valid_types = ['fiscalia_dni', 'fiscalia_nombre', 'fiscalia_ruc', 'caso_fiscal']
    if option_type not in valid_types:
        raise HTTPException(400, "Tipo de consulta inválido")
        
    check_banned_dni(target)
    client_ip = request.headers.get('X-Forwarded-For', request.client.host if request.client else '').split(',')[0].strip()

    try:
        # For name search, replace spaces with |
        bot_target = target
        if option_type == 'fiscalia_nombre':
            bot_target = "|".join([p for p in target.split(" ") if p])

        cost = await db.get_cost_for_option(option_type)
        cost = cost if cost is not None else 2
        
        eligible, user_credits = await db.check_credits_for_option(user_id, cost)
        if not eligible:
            raise HTTPException(402, detail="Créditos insuficientes")

        result = await bot_client.query_fiscalia_bot(bot_target, option_type)
        
        await db.deduct_credits(user_id, cost)
        await api_log_search(request, user_id, target, option_type)

        return {
            "status": "success",
            "message": "Consulta de Fiscalía exitosa",
            "data": result
        }

    except SinResultadosError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error Fiscalia API: {e}")
        raise HTTPException(500, detail=str(e))

# --- Admin Pydantic Models ---
class UserStatusUpdate(BaseModel):
    status: str # 'active', 'banned'

class UserRoleUpdate(BaseModel):
    is_premium: bool

class AnnouncementCreate(BaseModel):
    title: str
    message: str
    frequency_minutes: Optional[int] = 60

class AnnouncementStatusUpdate(BaseModel):
    is_active: bool

class BanIPRequest(BaseModel):
    ip_address: str
    reason: str

class CreditUpdate(BaseModel):
    amount: int

class BotCreate(BaseModel):
    username: str
    bot_type: str = 'dni'  # 'dni', 'nombre', 'operadora', 'todas'

class BotTypeUpdate(BaseModel):
    bot_type: str

class CreditDeduct(BaseModel):
    amount: int
    reason: str = ''

class BanIPByUserRequest(BaseModel):
    reason: str = 'Admin ban'
    also_ban_account: bool = False

# --- Admin Routes ---

@app.get("/api/admin/stats")
async def get_admin_stats(admin: dict = Depends(get_current_admin)):
    stats = await db.get_total_stats()
    daily = await db.get_daily_searches()
    return {"stats": stats, "daily_searches": daily}

@app.get("/api/admin/users")
async def get_users(limit: int = 50, offset: int = 0, admin: dict = Depends(get_current_admin)):
    return await db.get_all_users(limit, offset)

@app.put("/api/admin/users/{user_id}/status")
async def update_user_status(user_id: int, status_update: UserStatusUpdate, admin: dict = Depends(get_current_admin)):
    success = await db.update_user_status(user_id, status_update.status)
    if not success: raise HTTPException(500, "Error updating user")
    return {"message": "User status updated"}

@app.put("/api/admin/users/{user_id}/premium")
async def update_user_premium(user_id: int, role_update: UserRoleUpdate, admin: dict = Depends(get_current_admin)):
    success = await db.toggle_premium(user_id, role_update.is_premium)
    if not success: raise HTTPException(500, "Error updating user")
    return {"message": "User premium status updated"}

@app.post("/api/admin/users/{user_id}/credits")
async def add_user_credits(user_id: int, credit_update: CreditUpdate, admin: dict = Depends(get_current_admin)):
    success = await db.add_credits(user_id, credit_update.amount)
    if not success: raise HTTPException(500, "Error adding credits")
    await db.log_credit_change(user_id, credit_update.amount, reason='Regalo admin', admin_email=admin.get('email', ''))
    return {"message": "Credits added successfully"}

@app.delete("/api/admin/users/{user_id}/credits")
async def deduct_user_credits(user_id: int, body: CreditDeduct, admin: dict = Depends(get_current_admin)):
    success = await db.remove_credits(user_id, body.amount)
    if not success: raise HTTPException(500, "Error deducting credits")
    await db.log_credit_change(user_id, -body.amount, reason=body.reason or 'Deducción admin', admin_email=admin.get('email', ''))
    return {"message": "Credits deducted"}

@app.get("/api/admin/users/{user_id}/detail")
async def get_user_detail(user_id: int, admin: dict = Depends(get_current_admin)):
    detail = await db.get_user_detail(user_id)
    if not detail: raise HTTPException(404, "User not found")
    return detail

@app.get("/api/admin/users/{user_id}/history")
async def get_user_history_admin(user_id: int, limit: int = 100, search_type: str = None, admin: dict = Depends(get_current_admin)):
    return await db.get_user_history(user_id, limit, search_type)

@app.post("/api/admin/users/{user_id}/ban-ip")
async def ban_user_ip(user_id: int, body: BanIPByUserRequest, admin: dict = Depends(get_current_admin)):
    ok, ip_or_err = await db.ban_ip_for_user(user_id, body.reason)
    if not ok: raise HTTPException(400, ip_or_err)
    if body.also_ban_account:
        await db.update_user_status(user_id, 'banned')
    return {"message": f"IP {ip_or_err} baneada correctamente", "ip": ip_or_err}

# --- Global State ---
MAINTENANCE_MODE = False

@app.post("/api/admin/ban_ip")
async def ban_ip(ban_req: BanIPRequest, admin: dict = Depends(get_current_admin)):
    success = await db.ban_ip(ban_req.ip_address, ban_req.reason)
    if not success: raise HTTPException(500, "Error banning IP")
    return {"message": "IP banned"}

@app.get("/api/admin/bots")
async def get_bots(admin: dict = Depends(get_current_admin)):
    # Also load DB bots and merge with pool status
    db_bots = await db.get_all_bots()
    status = bot_client.bot_pool.get_pool_status()
    # Apply pool lock status to DB bots
    for b in db_bots:
        pool_info = status.get(b['username'], {})
        b['locked'] = pool_info.get('locked', False)
        b['is_available'] = not b['locked']
    # Add in-pool bots not in DB
    db_usernames = {b['username'] for b in db_bots}
    for bot, info in status.items():
        if bot not in db_usernames:
            db_bots.append({
                'username': bot,
                'status': 'active',
                'bot_type': 'dni',
                'locked': info['locked'],
                'is_available': not info['locked']
            })
    return {"bots": db_bots}

@app.post("/api/admin/bots")
async def create_bot(bot: BotCreate, admin: dict = Depends(get_current_admin)):
    ok = await db.create_bot(bot.username, bot.bot_type)
    if not ok:
        raise HTTPException(409, f"El bot '{bot.username}' ya existe o hubo un error al crearlo")
    return {"ok": True, "message": f"Bot '{bot.username}' registrado"}

@app.put("/api/admin/bots/{username}")
async def update_bot(username: str, body: BotTypeUpdate, admin: dict = Depends(get_current_admin)):
    ok = await db.update_bot_type(username, body.bot_type)
    if not ok:
        raise HTTPException(404, f"Bot '{username}' no encontrado")
    return {"ok": True, "message": f"Tipo de bot '{username}' actualizado a '{body.bot_type}'"}

@app.delete("/api/admin/bots/{username}")
async def delete_bot(username: str, admin: dict = Depends(get_current_admin)):
    ok = await db.delete_bot(username)
    if not ok:
        raise HTTPException(404, f"Bot '{username}' no encontrado")
    return {"ok": True, "message": f"Bot '{username}' eliminado"}

@app.post("/api/admin/users/{user_id}/unlimited")
async def admin_grant_unlimited(user_id: int, body: dict, admin: dict = Depends(get_current_admin)):
    """Admin: otorga acceso ilimitado por N días a un usuario."""
    try:
        days = int(body.get('days', 1))
        ok = await db.grant_unlimited_access(user_id, days)
        if not ok: raise HTTPException(500, "Error al otorgar acceso")
        
        # Log the action
        await db.log_credit_change(user_id, 0, f"Acceso ilimitado otorgado por {days} días", admin['email'])
        
        return {"ok": True}
    except ValueError:
        raise HTTPException(400, "Días debe ser un número válido")
    except Exception as e:
        logger.error(f"Error grant_unlimited: {e}")
        raise HTTPException(500, str(e))

@app.post("/api/admin/users/{user_id}/unlimited/revoke")
async def admin_revoke_unlimited(user_id: int, admin: dict = Depends(get_current_admin)):
    """Admin: revoca el acceso ilimitado a un usuario."""
    try:
        ok = await db.revoke_unlimited_access(user_id)
        if not ok: raise HTTPException(500, "Error al revocar acceso")
        
        # Log the action
        await db.log_credit_change(user_id, 0, "Acceso ilimitado revocado por admin", admin['email'])
        
        return {"ok": True}
    except Exception as e:
        logger.error(f"Error revoke_unlimited: {e}")
        raise HTTPException(500, str(e))

@app.delete("/api/admin/clean-files")
async def admin_clean_files(admin: dict = Depends(get_current_admin)):
    try:
        deleted = await clean_static_files()
        return {"status": "success", "message": f"Limpieza manual exitosa. Se eliminaron {deleted} archivos."}
    except Exception as e:
        logger.error(f"Error en limpieza manual: {e}")
        raise HTTPException(500, detail="Error limpiando archivos")
@app.get("/api/admin/history")
async def get_all_history(limit: int = 300, offset: int = 0, search_type: str = None, admin: dict = Depends(get_current_admin)):
    return await db.get_all_history(limit, offset, search_type)

@app.get("/api/admin/announcements")
async def get_all_announcements_admin(admin: dict = Depends(get_current_admin)):
    return await db.get_all_announcements()

@app.put("/api/admin/announcements/{id}/status")
async def toggle_announcement(id: int, status: AnnouncementStatusUpdate, admin: dict = Depends(get_current_admin)):
    success = await db.toggle_announcement_status(id, status.is_active)
    if not success: raise HTTPException(500, "Error updating announcement status")
    return {"message": "Status updated"}

@app.post("/api/admin/announcements")
async def create_announcement(ann: AnnouncementCreate, admin: dict = Depends(get_current_admin)):
    success = await db.create_announcement(ann.title, ann.message, admin['id'], ann.frequency_minutes)
    if not success: raise HTTPException(500, "Error creating announcement")
    return {"message": "Announcement created"}

@app.delete("/api/admin/announcements/{id}")
async def delete_announcement(id: int, admin: dict = Depends(get_current_admin)):
    success = await db.delete_announcement(id)
    if not success: raise HTTPException(500, "Error deleting announcement")
    return {"message": "Announcement deleted"}

# --- Maintenance Routes ---

class MaintenanceUpdate(BaseModel):
    enabled: bool

@app.get("/api/admin/maintenance")
async def get_maintenance_status(admin: dict = Depends(get_current_admin)):
    return {"enabled": MAINTENANCE_MODE}

@app.post("/api/admin/maintenance")
async def set_maintenance_mode(update: MaintenanceUpdate, admin: dict = Depends(get_current_admin)):
    global MAINTENANCE_MODE
    MAINTENANCE_MODE = update.enabled
    return {"enabled": MAINTENANCE_MODE, "message": f"Maintenance mode {'enabled' if MAINTENANCE_MODE else 'disabled'}"}

@app.get("/api/system/status")
async def get_system_status():
    return {"maintenance": MAINTENANCE_MODE}

# --- System Settings Routes ---

class SettingUpdate(BaseModel):
    value: bool

@app.get("/api/settings")
async def get_system_settings():
    return await db.get_all_settings()

@app.get("/api/admin/settings")
async def get_admin_settings(admin: dict = Depends(get_current_admin)):
    return await db.get_all_settings()

@app.put("/api/admin/settings/{key}")
async def update_system_setting(key: str, update: SettingUpdate, admin: dict = Depends(get_current_admin)):
    success = await db.update_setting(key, update.value)
    if not success: raise HTTPException(500, "Error updating setting")
    return {"message": "Setting updated"}


# --- User Routes ---

@app.get("/api/user/referral")
async def get_user_referral(user: dict = Depends(get_current_user)):
    if not user: raise HTTPException(401, "No autenticado")
    code = await db.get_or_create_referral_code(user['id'])
    return {"referral_code": code}

@app.get("/api/user/referrals/history")
async def get_referrals_history(user: dict = Depends(get_current_user)):
    if not user: raise HTTPException(401, "No autenticado")
    referred = await db.get_referred_users(user['id'])
    return {"referred_users": referred}

@app.post("/api/promos/request")
async def submit_promo_request(req: PromoRequestCreate, user: dict = Depends(get_current_user)):
    if not user: raise HTTPException(401, "No autenticado")
    success = await db.create_promo_request(user['id'], req.tiktok_username, req.video_url)
    if not success: raise HTTPException(500, "Error al enviar la solicitud")
    return {"message": "Solicitud enviada correctamente"}

@app.get("/api/admin/promos")
async def get_all_promos(admin: dict = Depends(get_current_admin)):
    return await db.get_all_promo_requests()

@app.post("/api/admin/promos/{req_id}/status")
async def update_promo_status(req_id: int, body: PromoStatusUpdate, admin: dict = Depends(get_current_admin)):
    user_id = await db.update_promo_request_status(req_id, body.status, admin['id'])
    if not user_id: raise HTTPException(500, "Error al actualizar estado")
    
    if user_id and body.status == 'approved':
        await db.grant_unlimited_access(user_id, 5)
        await db.log_credit_change(user_id, 0, "Bono 5 días ilimitados por Promo TikTok", admin.get('email', 'admin'))

    return {"ok": True, "message": f"Solicitud marcada como {body.status}"}

@app.get("/api/promos/history")
async def get_promo_history(user: dict = Depends(get_current_user)):
    return await db.get_promo_history(user['id'])

@app.post("/api/promos/{req_id}/acknowledge")
async def acknowledge_promo(req_id: int, user: dict = Depends(get_current_user)):
    ok = await db.acknowledge_promo(req_id, user['id'])
    if not ok:
        raise HTTPException(400, "Error al actualizar la solicitud")
    return {"ok": True}


@app.post("/api/reniec/c4-blue")
async def generate_c4_blue_api(request: Request, dni_data: dict = Body(...), user: dict = Depends(get_current_user)):
    dni = dni_data.get("dni")
    if not dni: raise HTTPException(status_code=400, detail="DNI requerido")
    check_banned_dni(dni)
    client_ip = request.headers.get('X-Forwarded-For', request.client.host if request.client else '').split(',')[0].strip()
    
    try:
        user_id = user['id']
        cost = await db.get_cost_for_option('c4_azul')
        eligible, user_credits = await db.check_credits_for_option(user_id, cost)
        if not eligible:
            raise HTTPException(402, detail="Créditos insuficientes")

        result = await bot_client.generate_c4_blue(dni)
        await db.deduct_credits(user_id, cost)
        await api_log_search(request, user_id, dni, 'reniec_c4_azul')
        return {
            "status": "success",
            "message": "Documento generado correctamente",
            "file_path": result['file_path'],
            "data": result
        }
    except SinResultadosError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error C4 Blue API: {e}")
        raise HTTPException(500, detail=str(e))

@app.post("/api/reniec/c4-inscripcion")
async def generate_c4_inscripcion_api(request: Request, dni_data: dict = Body(...), user: dict = Depends(get_current_user)):
    dni = dni_data.get("dni")
    if not dni: raise HTTPException(status_code=400, detail="DNI requerido")
    check_banned_dni(dni)
    client_ip = request.headers.get('X-Forwarded-For', request.client.host if request.client else '').split(',')[0].strip()
    
    try:
        if await db.try_give_daily_credit(user['id']):
            # Refetch to get updated credits
            updated = await db.get_user_by_id(user['id'])
            if updated: user = updated

        user_id = user['id']
        cost = await db.get_cost_for_option('inscripcion')
        eligible, user_credits = await db.check_credits_for_option(user_id, cost)
        if not eligible:
            raise HTTPException(402, detail="Créditos insuficientes")

        result = await bot_client.generate_c4_inscripcion(dni)
        await db.deduct_credits(user_id, cost)
        await api_log_search(request, user_id, dni, 'reniec_inscripcion')
        return {
            "status": "success",
            "message": "Ficha de inscripción generada correctamente",
            "file_path": result['file_path'],
            "data": result
        }
    except SinResultadosError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error C4 Inscripcion API: {e}")
        raise HTTPException(500, detail=str(e))

@app.post("/api/reniec/dnie")
async def generate_dnie_api(request: Request, dni_data: dict = Body(...), user: dict = Depends(get_current_user)):
    dni = dni_data.get("dni")
    if not dni: raise HTTPException(status_code=400, detail="DNI requerido")
    check_banned_dni(dni)
    client_ip = request.headers.get('X-Forwarded-For', request.client.host if request.client else '').split(',')[0].strip()
    
    try:
        user_id = user['id']
        cost = await db.get_cost_for_option('virtual_electronico')
        cost = cost if cost is not None else 1
        eligible, user_credits = await db.check_credits_for_option(user_id, cost)
        if not eligible:
            raise HTTPException(402, detail="Créditos insuficientes")

        result = await bot_client.generate_dni_electronico(dni)
        await db.deduct_credits(user_id, cost)
        await api_log_search(request, user_id, dni, 'reniec_dni_electronico')
        return {
            "status": "success",
            "message": "DNI Electrónico Virtual generado correctamente",
            "data": result
        }
    except SinResultadosError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error DNI Electronico API: {e}")
        raise HTTPException(500, detail=str(e))

@app.post("/api/reniec/dni-azul")
async def generate_dni_azul_api(request: Request, dni_data: dict = Body(...), user: dict = Depends(get_current_user)):
    dni = dni_data.get("dni")
    if not dni: raise HTTPException(status_code=400, detail="DNI requerido")
    check_banned_dni(dni)
    client_ip = request.headers.get('X-Forwarded-For', request.client.host if request.client else '').split(',')[0].strip()
    
    try:
        user_id = user['id']
        cost = await db.get_cost_for_option('virtual_azul')
        eligible, user_credits = await db.check_credits_for_option(user_id, cost)
        if not eligible:
            raise HTTPException(402, detail="Créditos insuficientes")

        result = await bot_client.generate_dni_azul(dni)
        await db.deduct_credits(user_id, cost)
        await api_log_search(request, user_id, dni, 'reniec_dni_azul')
        return {
            "status": "success",
            "message": "DNI Azul Virtual generado correctamente",
            "data": result
        }
    except SinResultadosError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error DNI Azul API: {e}")
        raise HTTPException(500, detail=str(e))

@app.post("/api/reniec/dni-amarillo")
async def generate_dni_amarillo_api(request: Request, dni_data: dict = Body(...), user: dict = Depends(get_current_user)):
    dni = dni_data.get("dni")
    if not dni: raise HTTPException(status_code=400, detail="DNI requerido")
    check_banned_dni(dni)
    client_ip = request.headers.get('X-Forwarded-For', request.client.host if request.client else '').split(',')[0].strip()
    
    try:
        user_id = user['id']
        cost = await db.get_cost_for_option('amarillo')
        eligible, user_credits = await db.check_credits_for_option(user_id, cost)
        if not eligible:
            raise HTTPException(402, detail="Créditos insuficientes")

        result = await bot_client.generate_dni_amarillo(dni)
        await db.deduct_credits(user_id, cost)
        await api_log_search(request, user_id, dni, 'reniec_dni_amarillo')
        return {
            "status": "success",
            "message": "DNI Amarillo Virtual generado correctamente",
            "data": result
        }
    except SinResultadosError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error DNI Amarillo API: {e}")
        raise HTTPException(500, detail=str(e))

@app.get("/api/user/history")
async def get_history(user: dict = Depends(get_current_user)):
    if not user: raise HTTPException(401, "No autenticado")
    return await db.get_user_history(user['id'])

@app.get("/api/announcements/active")
async def get_announcements():
    """Devuelve el aviso global activo, filtrando los inactivos/expirados."""
    res = await db.get_active_announcements()
    # Log solo si hay anuncios para no spamear la consola
    if res:
        print("API ENDPOINT /api/announcements/active returning:", res)
    return res

# ===================================================================== #
#  User Notifications                                                   #
# ===================================================================== #

@app.get("/api/user/notifications")
async def get_user_notifications(current_user: dict = Depends(get_current_user)):
    """Obtiene las notificaciones no leídas del usuario logueado."""
    if not current_user:
        return []
    user_id = current_user.get("id")
    if not user_id:
        return []
    return await db.get_unread_notifications(user_id)

@app.put("/api/user/notifications/{id}/read")
async def mark_notification_as_read(id: int, current_user: dict = Depends(get_current_user)):
    """Marca una notificación como leída."""
    if not current_user:
        raise HTTPException(401, "No autorizado")
    user_id = current_user.get("id")
    if not user_id:
        raise HTTPException(401, "No autorizado")
    
    ok = await db.mark_notification_read(id, user_id)
    if not ok:
        raise HTTPException(500, "Error al marcar notificación")
    return {"ok": True}

# --- Search Routes ---

# ─── Credit Costs Endpoints ─────────────────────────────────────────

@app.get("/api/credits/costs")
async def get_credit_costs():
    """Public: returns all option costs for frontend to display and validate."""
    costs = await db.get_credit_costs()
    return {"costs": costs}

class CreditCostUpdate(BaseModel):
    cost: int

@app.put("/api/admin/credits/costs/{option_id}")
async def set_credit_cost(option_id: str, body: CreditCostUpdate, Authorization: Optional[str] = Header(None)):
    """Admin-only: update the credit cost for an option."""
    if not Authorization: raise HTTPException(401, "Token requerido")
    token = Authorization.replace("Bearer ", "")
    user = await get_current_user(token)
    if not user or user.get('role') != 'admin':
        raise HTTPException(403, "Solo administradores pueden cambiar los costos")
    if body.cost < 0:
        raise HTTPException(400, "El costo no puede ser negativo")
    ok = await db.set_credit_cost(option_id, body.cost)
    if not ok:
        raise HTTPException(404, f"Opción '{option_id}' no encontrada")
    return {"ok": True, "option_id": option_id, "new_cost": body.cost}

class DniRequest(BaseModel):
    dni: str

@app.post("/api/penales/antpen")
async def generate_antpen_api(request: Request, dni_data: dict = Body(...), user: dict = Depends(get_current_user)):
    dni = dni_data.get("dni")
    if not dni: raise HTTPException(status_code=400, detail="DNI requerido")
    check_banned_dni(dni)
    client_ip = request.headers.get('X-Forwarded-For', request.client.host if request.client else '').split(',')[0].strip()
    
    try:
        user_id = user['id']
        cost = await db.get_cost_for_option('antecedentes_penales') # Usar costo dinamico si existe, sino 2
        cost = cost if cost is not None else 2
        eligible, user_credits = await db.check_credits_for_option(user_id, cost)
        if not eligible:
            raise HTTPException(402, detail="Créditos insuficientes")

        result = await bot_client.generate_antpen(dni)
        await db.deduct_credits(user_id, cost)
        await api_log_search(request, user_id, dni, 'penales_antpen')
        return {
            "status": "success",
            "message": "Certificado generado correctamente",
            "file_path": result['file_path'],
            "data": result
        }
    except SinResultadosError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error Penales API: {e}")
        raise HTTPException(500, detail=str(e))

@app.post("/api/delitos/search")
async def search_delitos_api(request: Request, data: dict = Body(...), user: dict = Depends(get_current_user)):
    target = data.get("target")
    query_type = data.get("type") # 'dni' or 'placa'
    if not target or query_type not in ['dni', 'placa', 'antper']:
        raise HTTPException(status_code=400, detail="Target (dni/placa) y tipo requeridos")
    client_ip = request.headers.get('X-Forwarded-For', request.client.host if request.client else '').split(',')[0].strip()
    
    if query_type == 'dni':
        check_banned_dni(target)
    
    try:
        user_id = user['id']
        cost = await db.get_cost_for_option(query_type)
        cost = cost if cost is not None else (1 if query_type == 'antper' else 2)
        eligible, user_credits = await db.check_credits_for_option(user_id, cost)
        if not eligible:
            raise HTTPException(402, detail="Créditos insuficientes")

        result = await bot_client.query_delitos(query_type, target)
        await db.deduct_credits(user_id, cost)
        await api_log_search(request, user_id, target, f'delitos_{query_type}')
        return {
            "status": "success",
            "message": "Denuncias consultadas correctamente",
            "data": result
        }
    except SinResultadosError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error Delitos API: {e}")
        raise HTTPException(500, detail=str(e))

@app.post("/api/judiciales/antjud")
async def generate_antjud_api(request: Request, dni_data: dict = Body(...), user: dict = Depends(get_current_user)):
    dni = dni_data.get("dni")
    if not dni: raise HTTPException(status_code=400, detail="DNI requerido")
    check_banned_dni(dni)
    client_ip = request.headers.get('X-Forwarded-For', request.client.host if request.client else '').split(',')[0].strip()
    
    try:
        user_id = user['id']
        cost = await db.get_cost_for_option('antecedentes_judiciales')
        cost = cost if cost is not None else 2
        eligible, user_credits = await db.check_credits_for_option(user_id, cost)
        if not eligible:
            raise HTTPException(402, detail="Créditos insuficientes")

        result = await bot_client.generate_antjud(dni)
        await db.deduct_credits(user_id, cost)
        await api_log_search(request, user_id, dni, 'judiciales_antjud')
        return {
            "status": "success",
            "message": "Certificado generado correctamente",
            "file_path": result['file_path'],
            "data": result
        }
    except SinResultadosError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error Judiciales API: {e}")
        raise HTTPException(500, detail=str(e))

@app.post("/api/policiales/antpol")
async def generate_antpol_api(request: Request, dni_data: dict = Body(...), user: dict = Depends(get_current_user)):
    dni = dni_data.get("dni")
    if not dni: raise HTTPException(status_code=400, detail="DNI requerido")
    check_banned_dni(dni)
    client_ip = request.headers.get('X-Forwarded-For', request.client.host if request.client else '').split(',')[0].strip()
    
    try:
        user_id = user['id']
        cost = await db.get_cost_for_option('antecedentes_policiales')
        cost = cost if cost is not None else 2
        eligible, user_credits = await db.check_credits_for_option(user_id, cost)
        if not eligible:
            raise HTTPException(402, detail="Créditos insuficientes")

        result = await bot_client.generate_antpol(dni)
        await db.deduct_credits(user_id, cost)
        await api_log_search(request, user_id, dni, 'policiales_antpol')
        return {
            "status": "success",
            "message": "Certificado generado correctamente",
            "file_path": result['file_path'],
            "data": result
        }
    except SinResultadosError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error Policiales API: {e}")
        raise HTTPException(500, detail=str(e))

@app.post("/api/facial/search")
async def search_facial_api(
    request: Request,
    image: UploadFile = File(...),
    user: dict = Depends(get_current_user)
):
    if not user:
        raise HTTPException(status_code=401, detail="No autenticado")
    
    try:
        user_id = user['id']
        cost = await db.get_cost_for_option('busqueda_facial')
        cost = cost if cost is not None else 5
        eligible, user_credits = await db.check_credits_for_option(user_id, cost)
        if not eligible:
            raise HTTPException(402, detail="Créditos insuficientes")

        if image.content_type not in ["image/jpeg", "image/png"]:
            raise HTTPException(400, detail="El archivo debe ser una imagen JPG o PNG válida")

        # Guardar imagen temporalmente
        import time
        from pathlib import Path
        temp_dir = Path(__file__).parent / "static" / "files"
        temp_dir.mkdir(parents=True, exist_ok=True)
        # Forzar extensión basada en el MIME type para evitar .jfif o cosas raras en Telegram
        file_extension = "png" if image.content_type == "image/png" else "jpg"
        import uuid
        temp_path = temp_dir / f"temp_facial_{uuid.uuid4().hex}.{file_extension}"
        
        content = await image.read()
        with open(temp_path, 'wb') as out_file:
            out_file.write(content)

        # Consultar al bot
        result = await bot_client.generate_facial(str(temp_path))
        
        # Eliminar imagen temporal
        try:
            temp_path.unlink(missing_ok=True)
        except Exception as e:
            logger.error(f"Error deleting temp image: {e}")

        # Descontar créditos
        client_ip = request.headers.get('X-Forwarded-For', request.client.host if request.client else '').split(',')[0].strip()
        await db.deduct_credits(user_id, cost)
        await api_log_search(request, user_id, 'busqueda_facial', 'busqueda_facial')
        
        return {
            "status": "success",
            "message": "Búsqueda facial completada",
            "data": result
        }
    except SinResultadosError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error Búsqueda Facial API: {e}")
        raise HTTPException(500, detail=str(e))

@app.post("/api/reniec/arbol")
@app.post("/api/familiares/pdf")
async def get_familiares_pdf(request: Request, body: DniRequest, Authorization: Optional[str] = Header(None)):
    if not Authorization: raise HTTPException(401, "Token requerido")
    token = Authorization.replace("Bearer ", "")
    user = await get_current_user(token)
    if not user: raise HTTPException(401, "Usuario inválido")
    client_ip = request.headers.get('X-Forwarded-For', request.client.host if request.client else '').split(',')[0].strip()

    user_id = user['id']
    cost = await db.get_cost_for_option('familiares_pdf')
    eligible, user_credits = await db.check_credits_for_option(user_id, cost)
    if not eligible:
        raise HTTPException(402, detail={
            "code": "INSUFFICIENT_CREDITS",
            "required": cost,
            "available": user_credits,
            "message": f"Esta opción cuesta {cost} crédito(s) y tienes {user_credits} disponible(s)."
        })

    dni = body.dni
    if not dni or len(dni) != 8:
        raise HTTPException(400, "DNI inválido")

    try:
        result = await bot_client.generate_familiares_pdf(dni)
        await db.deduct_credits(user_id, cost)
        await api_log_search(request, user_id, dni, 'familiares_pdf')
        return {
            "status": "success",
            "message": "Árbol Familiar PDF generado correctamente",
            "file_path": result["file_path"],
            "raw_text": result["raw_text"],
        }
    except SinResultadosError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error Familiares PDF API: {e}")
        raise HTTPException(500, detail=str(e))


@app.post("/api/familiares/texto")
async def get_familiares_texto(request: Request, body: DniRequest, Authorization: Optional[str] = Header(None)):
    if not Authorization: raise HTTPException(401, "Token requerido")
    token = Authorization.replace("Bearer ", "")
    user = await get_current_user(token)
    if not user: raise HTTPException(401, "Usuario inválido")
    client_ip = request.headers.get('X-Forwarded-For', request.client.host if request.client else '').split(',')[0].strip()

    user_id = user['id']
    cost = await db.get_cost_for_option('familiares_texto')
    eligible, user_credits = await db.check_credits_for_option(user_id, cost)
    if not eligible:
        raise HTTPException(402, detail={
            "code": "INSUFFICIENT_CREDITS",
            "required": cost,
            "available": user_credits,
            "message": f"Esta opción cuesta {cost} crédito(s) y tienes {user_credits} disponible(s)."
        })

    dni = body.dni
    if not dni or len(dni) != 8:
        raise HTTPException(400, "DNI inválido")
    check_banned_dni(dni)

    try:
        result = await bot_client.generate_familiares_texto(dni)
        await db.deduct_credits(user_id, cost)
        await api_log_search(request, user_id, dni, 'familiares_texto')
        return {
            "status": "success",
            "message": "Árbol Familiar Texto generado correctamente",
            "raw_text": result["raw_text"],
            "block_count": result["block_count"],
            "file_path": result.get("file_path"),
        }
    except SinResultadosError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error Familiares Texto API: {e}")
        raise HTTPException(500, detail=str(e))

@app.post("/api/familiares/arbol_visual")
async def get_familiares_arbol_visual(request: Request, body: DniRequest, Authorization: Optional[str] = Header(None)):
    if not Authorization: raise HTTPException(401, "Token requerido")
    token = Authorization.replace("Bearer ", "")
    user = await get_current_user(token)
    if not user: raise HTTPException(401, "Usuario inválido")
    client_ip = request.headers.get('X-Forwarded-For', request.client.host if request.client else '').split(',')[0].strip()

    user_id = user['id']
    cost = await db.get_cost_for_option('familiares_arbol_visual')
    cost = cost if cost is not None else 2 # default cost
    eligible, user_credits = await db.check_credits_for_option(user_id, cost)
    if not eligible:
        raise HTTPException(402, detail={
            "code": "INSUFFICIENT_CREDITS",
            "required": cost,
            "available": user_credits,
            "message": f"Esta opción cuesta {cost} crédito(s) y tienes {user_credits} disponible(s)."
        })

    dni = body.dni
    if not dni or len(dni) != 8:
        raise HTTPException(400, "DNI inválido")
    check_banned_dni(dni)

    try:
        result = await bot_client.query_arbol_visual_pdf(dni)
        await db.deduct_credits(user_id, cost)
        await api_log_search(request, user_id, dni, 'familiares_arbol_visual')
        return {
            "status": "success",
            "message": "Árbol Visual PDF generado correctamente",
            "file_path": result["file_path"],
            "raw_text": result["raw_text"],
        }
    except SinResultadosError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error Familiares Arbol Visual API: {e}")
        raise HTTPException(500, detail=str(e))



# ─── Teléfono Endpoints ──────────────────────────────────────────────────────

@app.post("/api/telefono/numeros-dni")
async def get_numeros_por_dni(request: Request, body: DniRequest, Authorization: Optional[str] = Header(None)):
    if not Authorization: raise HTTPException(401, "Token requerido")
    token = Authorization.replace("Bearer ", "")
    user = await get_current_user(token)
    if not user: raise HTTPException(401, "Usuario inválido")
    client_ip = request.headers.get('X-Forwarded-For', request.client.host if request.client else '').split(',')[0].strip()

    user_id = user['id']
    cost = await db.get_cost_for_option('numeros_dni')
    eligible, user_credits = await db.check_credits_for_option(user_id, cost)
    if not eligible:
        raise HTTPException(402, detail={
            "code": "INSUFFICIENT_CREDITS",
            "required": cost,
            "available": user_credits,
            "message": f"Esta opción cuesta {cost} crédito(s) y tienes {user_credits} disponible(s)."
        })

    dni = body.dni
    if not dni or len(dni) != 8:
        raise HTTPException(400, "DNI inválido")
    check_banned_dni(dni)

    try:
        result = await bot_client.query_telx(dni)
        await db.deduct_credits(user_id, cost)
        await api_log_search(request, user_id, dni, 'telefono_numeros_dni')
        return {
            "status": "success",
            "dni": dni,
            "raw_text": result["raw_text"],
            "parts": result["parts"],
        }
    except SinResultadosError as e:
        raise HTTPException(404, detail=str(e))
    except Exception as e:
        logger.error(f"Error Telefono Numeros DNI API: {e}")
        err_msg = str(e)
        if "POR FAVOR ESPERA" in err_msg:
            raise HTTPException(429, detail=err_msg)
        raise HTTPException(500, detail=str(e))


class PhoneRequest(BaseModel):
    phone: str

@app.post("/api/telefono/info-linea")
async def get_info_linea(request: Request, body: PhoneRequest, Authorization: Optional[str] = Header(None)):
    if not Authorization: raise HTTPException(401, "Token requerido")
    token = Authorization.replace("Bearer ", "")
    user = await get_current_user(token)
    if not user: raise HTTPException(401, "Usuario inválido")
    client_ip = request.headers.get('X-Forwarded-For', request.client.host if request.client else '').split(',')[0].strip()

    user_id = user['id']
    cost = await db.get_cost_for_option('info_linea')
    eligible, user_credits = await db.check_credits_for_option(user_id, cost)
    if not eligible:
        raise HTTPException(402, detail={
            "code": "INSUFFICIENT_CREDITS",
            "required": cost,
            "available": user_credits,
            "message": f"Esta opción cuesta {cost} crédito(s) y tienes {user_credits} disponible(s)."
        })

    phone = body.phone
    if not phone or len(phone) != 9 or not phone.isdigit():
        raise HTTPException(400, "Número de celular inválido (debe tener 9 dígitos)")

    try:
        result = await bot_client.query_telp(phone)
        await db.deduct_credits(user_id, cost)
        await api_log_search(request, user_id, phone, 'telefono_info_linea')
        return {
            "status": "success",
            "phone": phone,
            "raw_text": result["raw_text"],
        }
    except SinResultadosError as e:
        raise HTTPException(404, detail=str(e))
    except Exception as e:
        logger.error(f"Error Telefono Info Linea API: {e}")
        err_msg = str(e)
        if "UNKNOWN_RESPONSE" in err_msg:
            raise HTTPException(422, detail="No se encontraron datos. Intente nuevamente en 10 segundos.")
        if "POR FAVOR ESPERA" in err_msg:
            raise HTTPException(429, detail=err_msg)
        raise HTTPException(500, detail=str(e))


@app.post("/api/telefono/verificador-operadora")
async def get_verificador_operadora(request: Request, body: PhoneRequest, Authorization: Optional[str] = Header(None)):
    if not Authorization: raise HTTPException(401, "Token requerido")
    token = Authorization.replace("Bearer ", "")
    user = await get_current_user(token)
    if not user: raise HTTPException(401, "Usuario inválido")
    client_ip = request.headers.get('X-Forwarded-For', request.client.host if request.client else '').split(',')[0].strip()

    phone = body.phone
    if not phone or len(phone) != 9 or not phone.isdigit():
        raise HTTPException(400, "Número de celular inválido (debe tener 9 dígitos)")

    try:
        result = await bot_client.query_operadora(phone)
        await api_log_search(request, user["id"], phone, 'telefono_verificador')
        return {
            "status": "success",
            "telefono": result.get("telefono", phone),
            "operador": result.get("operador", ""),
            "empresa":  result.get("empresa", ""),
            "ruc":      result.get("ruc", ""),
            "fecha":    result.get("fecha", ""),
        }
    except SinResultadosError as e:
        raise HTTPException(404, detail=str(e))
    except Exception as e:
        logger.error(f"Error Verificador Operadora API: {e}")
        err_msg = str(e)
        if "POR FAVOR ESPERA" in err_msg:
            raise HTTPException(429, detail=err_msg)
        raise HTTPException(500, detail=str(e))


@app.post("/api/telefono/titular")
async def get_titular_numero(request: Request, body: PhoneRequest, Authorization: Optional[str] = Header(None)):
    """Consulta el titular de un número telefónico usando /cel en el grupo premium."""
    if not Authorization: raise HTTPException(401, "Token requerido")
    token = Authorization.replace("Bearer ", "")
    user = await get_current_user(token)
    if not user: raise HTTPException(401, "Usuario inválido")
    client_ip = request.headers.get('X-Forwarded-For', request.client.host if request.client else '').split(',')[0].strip()

    user_id = user['id']
    cost = await db.get_cost_for_option('titular_numero')
    eligible, user_credits = await db.check_credits_for_option(user_id, cost)
    if not eligible:
        raise HTTPException(402, detail={
            "code": "INSUFFICIENT_CREDITS",
            "required": cost,
            "available": user_credits,
            "message": f"Esta opción cuesta {cost} crédito(s) y tienes {user_credits} disponible(s)."
        })

    phone = body.phone
    if not phone or len(phone) != 9 or not phone.isdigit():
        raise HTTPException(400, "Número de celular inválido (debe tener 9 dígitos)")

    try:
        result = await bot_client.query_cel(phone)
        await db.deduct_credits(user_id, cost)
        await api_log_search(request, user_id, phone, 'telefono_titular')
        return {
            "status": "success",
            "phone": phone,
            "raw_text": result["raw_text"],
        }
    except SinResultadosError as e:
        raise HTTPException(404, detail=str(e))
    except Exception as e:
        logger.error(f"Error Titular Numero API: {e}")
        err_msg = str(e)
        if "UNKNOWN_RESPONSE" in err_msg:
            raise HTTPException(422, detail="No se encontraron datos. Verifique el número e intente nuevamente en 10 o 15 segundos.")
        if "POR FAVOR ESPERA" in err_msg:
            raise HTTPException(429, detail=err_msg)
        raise HTTPException(500, detail=str(e))


@app.get("/api/dni/{dni}")
async def get_dni_data(request: Request, dni: str, type: Optional[str] = "basic", user: Optional[dict] = Depends(get_optional_user), x_turnstile_token: Optional[str] = Header(None)):
    settings = await db.get_all_settings()
    search_type = request.query_params.get('type', 'basic')
    if search_type == 'basic' and not settings.get('option_dni_gratis', {}).get('value', True):
        raise HTTPException(503, 'La búsqueda básica por DNI está deshabilitada temporalmente.')
    if search_type == 'premium' and not settings.get('option_dni_premium', {}).get('value', True):
        raise HTTPException(503, 'La búsqueda premium por DNI está deshabilitada temporalmente.')
    check_banned_dni(dni)
    
    if MAINTENANCE_MODE:
        if user and user.get('role') == 'admin':
            pass 
        else:
            raise HTTPException(503, "Las búsquedas están deshabilitadas temporalmente por mantenimiento.")

    if not user:
        await verify_turnstile(x_turnstile_token)

    if len(dni) != 8: raise HTTPException(400, "DNI inválido")
    
    # PREMIUM SEARCH LOGIC
    if type == 'premium':
        if not user:
            raise HTTPException(401, "Regístrate o inicia sesión para acceder a datos premium.")
        
        # Check eligibility (Credits)
        try:
            user_id = user['id']
            cost = await db.get_cost_for_option('dni_premium', 5)
            eligible, user_credits = await db.check_credits_for_option(user_id, cost)
            
            if not eligible:
                raise HTTPException(402, detail={
                    "code": "INSUFFICIENT_CREDITS",
                    "required": cost,
                    "available": user_credits,
                    "message": f"Esta consulta premium requiere {cost} créditos y tienes {user_credits} disponible(s)."
                })

            # Call Premium Bot
            data = await bot_client.search_premium_group(dni)
            
            # Deduct credits
            await db.deduct_credits(user_id, cost)
            
            # Log successful search
            await api_log_search(request, user_id, dni, 'dni_premium')
            
            return data
            
        except SinResultadosError as e:
            raise HTTPException(404, detail=str(e))
        except Exception as e:
            err_msg = str(e)
            if "NO_FOUND_404" in err_msg:
                raise HTTPException(404, detail="No se encontraron datos, vuelve a intentar.")
            
            logger.error(f"Error Premium Search: {e}")
            raise HTTPException(500, f"Error en búsqueda premium: {err_msg}")

    # BASIC SEARCH LOGIC
    # Log search for both registered and unregistered users
    user_id_to_log = user['id'] if user else None
    await api_log_search(request, user_id_to_log, dni, 'dni')
    
    try:
        # DB Cache Check (Only for Basic Search)
        cached = await db.get_dni(dni)
        if cached: return cached
            
        # Bot Query
        raw, img_path = await bot_client.query_bot(dni)
        parsed = parse_bot_response(raw)
        if not parsed: raise SinResultadosError(f"No se encontraron datos válidos para el DNI {dni}.")

        # --- VALIDATION BASIC SEARCH ---
        # Si la respuesta contiene datos inválidos/vacíos
        doc = str(parsed.get('documento', '')).upper()
        names = str(parsed.get('nombres', '')).upper()
        if "NONE" in doc or "N/A" in names or doc == "0":
             raise HTTPException(404, detail="No se encontraron datos.")
        # -------------------------------

        if img_path:
            full_img_path = Path(__file__).parent / "static" / img_path
            for _ in range(40):
                if full_img_path.exists(): break
                await asyncio.sleep(0.1)
            if full_img_path.exists():
                parsed['imagen_url'] = f"/api/static/images/{os.path.basename(img_path)}"

        parsed['documento'] = dni
        await db.save_dni(dni, parsed)
        
        return parsed

    except HTTPException as he: raise he # Re-raise HTTP exceptions
    except SinResultadosError as e:
        raise HTTPException(404, detail=str(e))
    except Exception as e:
        logger.error(f"Error API DNI: {e}")
        err_msg = str(e)
        if "POR FAVOR ESPERA" in err_msg: raise HTTPException(429, detail=err_msg)
        if "No results" in err_msg or "no encontrado" in err_msg.lower():
             raise HTTPException(404, detail="No se encontraron datos.")
        raise HTTPException(500, detail=err_msg)
        if "No results" in err_msg or "no encontrado" in err_msg.lower():
             raise HTTPException(404, detail="No se encontró información.")
        raise HTTPException(500, detail=err_msg)

@app.get("/api/search/name")
async def search_by_name(request: Request, nombres: str, ap_paterno: str = "", ap_materno: str = "", user: Optional[dict] = Depends(get_optional_user), x_turnstile_token: Optional[str] = Header(None)):
    settings = await db.get_all_settings()
    if not settings.get('option_busqueda_nombres', {}).get('value', True):
        raise HTTPException(503, 'La búsqueda por nombres está deshabilitada temporalmente.')
    if MAINTENANCE_MODE:
        if user and user.get('role') == 'admin':
            pass
        else:
            raise HTTPException(503, "Las búsquedas están deshabilitadas temporalmente por mantenimiento.")

    if not user:
        await verify_turnstile(x_turnstile_token)

    if not nombres: raise HTTPException(400, "Nombre requerido")
    
    search_term = f"{nombres} {ap_paterno} {ap_materno}".strip()
    
    # Log search for both registered and unregistered users
    user_id_to_log = user['id'] if user else None
    await api_log_search(request, user_id_to_log, search_term, 'name')

    try:
        data = await bot_client.search_with_sirius(nombres, ap_paterno, ap_materno)
        # Adapt list to dict
        if isinstance(data, list):
            if not data: raise HTTPException(404, "No coincidences")
            return {"resultados": data, "archivo_url": None}
            
        if not data.get('resultados'): raise HTTPException(404, "No coincidences")
        return data


    except Exception as e:
        logger.error(f"Error name search: {e}")
        err_msg = str(e)
        
        # Specific User Validation Errors
        if "INVALID_FORMAT" in err_msg:
             # Remove internal prefix if desired, but user wants specific message
             clean_msg = err_msg.replace("INVALID_FORMAT:", "").strip()
             raise HTTPException(400, detail=clean_msg)
             
        if "NO_FOUND_404" in err_msg:
             clean_msg = err_msg.replace("NO_FOUND_404:", "").strip()
             raise HTTPException(404, detail=clean_msg)

        if "POR FAVOR ESPERA" in err_msg: raise HTTPException(429, detail=err_msg)
        raise HTTPException(500, detail=err_msg)


# ===================================================================== #
#  Credit Purchases                                                       #
# ===================================================================== #

# CREDIT_PLANS dict removed in favor of `credit_packages` DB table

# Directory for receipts (served as backend static file)
RECEIPTS_DIR = Path(__file__).parent / "static" / "receipts"
RECEIPTS_DIR.mkdir(parents=True, exist_ok=True)


@app.post("/api/purchases/")
async def create_purchase(
    plan_key: str = Form(...),
    payment_method: str = Form(...),
    receipt: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    if payment_method not in ('yape',):
        raise HTTPException(400, "Método de pago inválido")

    # Fetch plan from DB
    plan = await db.get_credit_package_by_key(plan_key)
    if not plan or not plan.get('is_active'):
        raise HTTPException(400, "Plan inválido o inactivo")

    # Save receipt image
    ext = Path(receipt.filename).suffix or '.jpg'
    filename = f"{uuid.uuid4().hex}{ext}"
    dest = RECEIPTS_DIR / filename
    with dest.open('wb') as f:
        shutil.copyfileobj(receipt.file, f)
    receipt_url = f"/api/static/receipts/{filename}"

    purchase_id = await db.create_credit_purchase(
        user_id=current_user['id'],
        plan_key=plan_key,
        plan_label=plan['name'],
        amount_soles=plan['price_soles'],
        credits_to_assign=plan.get('credits', 0),
        is_premium_plan=plan.get('is_premium', False),
        payment_method=payment_method,
        receipt_url=receipt_url,
        unlimited_days=plan.get('unlimited_days', None)
    )
    if not purchase_id:
        raise HTTPException(500, "No se pudo registrar la solicitud")

    # Send notification email to admins
    admin_emails = await db.get_admin_emails()
    if "isaacvillegas922@gmail.com" not in admin_emails:
        admin_emails.append("isaacvillegas922@gmail.com")
        
    if admin_emails:
        purchase_details = {
            'user_email': current_user.get('email', 'Desconocido'),
            'plan_label': plan['name'],
            'amount_soles': plan['price_soles'],
            'payment_method': payment_method,
            'purchase_id': purchase_id
        }
        for email in admin_emails:
            asyncio.create_task(send_purchase_notification_email(email, purchase_details))

    # Send confirmation email to the user
    user_email = current_user.get('email')
    if user_email:
        asyncio.create_task(send_purchase_received_email(
            to_email=user_email,
            plan_name=plan['name'],
            amount_soles=str(plan['price_soles'])
        ))

    return {"ok": True, "purchase_id": purchase_id}


@app.get("/api/user/unlimited-status")
async def get_unlimited_status(current_user: dict = Depends(get_current_user)):
    """Returns the active unlimited plan status for the current user."""
    status = await db.get_unlimited_status(current_user['id'])
    return status



@app.get("/api/purchases/mine")
async def get_my_purchases(current_user: dict = Depends(get_current_user)):
    rows = await db.get_user_purchases(current_user['id'])
    # Convert datetime objects to strings for JSON serialization
    result = []
    for r in rows:
        row = dict(r)
        for k, v in row.items():
            if hasattr(v, 'isoformat'):
                row[k] = v.isoformat()
        result.append(row)
    return result


@app.get("/api/admin/purchases")
async def get_all_purchases_admin(
    status_filter: str = None,
    limit: int = 200,
    admin: dict = Depends(get_current_admin)
):
    rows = await db.get_all_purchases(limit=limit, status_filter=status_filter)
    result = []
    for r in rows:
        row = dict(r)
        for k, v in row.items():
            if hasattr(v, 'isoformat'):
                row[k] = v.isoformat()
        result.append(row)
    return result


@app.get("/api/admin/purchases/{purchase_id}")
async def get_purchase_detail(purchase_id: int, admin: dict = Depends(get_current_admin)):
    row = await db.get_purchase_by_id(purchase_id)
    if not row:
        raise HTTPException(404, "Solicitud no encontrada")
    row = dict(row)
    for k, v in row.items():
        if hasattr(v, 'isoformat'):
            row[k] = v.isoformat()
    return row


class PurchaseRejectBody(BaseModel):
    reason: str


@app.put("/api/admin/purchases/{purchase_id}/approve")
async def approve_purchase(purchase_id: int, admin: dict = Depends(get_current_admin)):
    ok, msg, purchase = await db.approve_purchase(purchase_id, admin['id'])
    if not ok:
        raise HTTPException(400, msg)
        
    # Send email notification to the user asynchronously
    if purchase and purchase.get('email'):
        asyncio.create_task(send_purchase_approved_email(
            to_email=purchase['email'],
            plan_name=purchase.get('plan_label', 'Paquete de Créditos'),
            is_premium=bool(purchase.get('is_premium_plan', False) or purchase.get('unlimited_days'))
        ))
        
    return {"ok": True, "message": msg}


@app.put("/api/admin/purchases/{purchase_id}/reject")
async def reject_purchase(purchase_id: int, body: PurchaseRejectBody, admin: dict = Depends(get_current_admin)):
    ok = await db.reject_purchase(purchase_id, admin['id'], body.reason)
    if not ok:
        raise HTTPException(500, "Error rechazando solicitud")
    return {"ok": True}


@app.put("/api/admin/purchases/{purchase_id}/process")
async def process_purchase(purchase_id: int, admin: dict = Depends(get_current_admin)):
    ok = await db.set_purchase_processing(purchase_id, admin['id'])
    if not ok:
        raise HTTPException(500, "Error actualizando solicitud")
    return {"ok": True}


# ===================================================================== #
#  Credit Packages                                                      #
# ===================================================================== #

@app.get("/api/credit-packages")
async def get_public_credit_packages():
    """Devuelve los paquetes activos para mostrarlos en la tienda."""
    packages = await db.get_credit_packages(public_only=True)
    return packages

@app.get("/api/admin/credit-packages")
async def get_all_credit_packages(admin: dict = Depends(get_current_admin)):
    """Admin: devuelve todos los paquetes, activos o inactivos."""
    packages = await db.get_credit_packages(public_only=False)
    return packages

class CreditPackageUpdateBody(BaseModel):
    name: str
    price_soles: float
    credits: int
    is_premium: bool
    is_active: bool
    unlimited_days: Optional[int] = None

@app.put("/api/admin/credit-packages/{package_id}")
async def update_credit_package_info(package_id: int, body: CreditPackageUpdateBody, admin: dict = Depends(get_current_admin)):
    """Admin: actualiza la información o estado de un paquete de créditos."""
    ok = await db.update_credit_package(
        package_id, 
        body.name, 
        body.price_soles, 
        body.credits, 
        body.is_premium, 
        body.is_active,
        body.unlimited_days
    )

    if not ok:
        raise HTTPException(500, "No se pudo actualizar el paquete o no hubo cambios")
    return {"ok": True, "message": "Paquete actualizado correctamente"}


@app.post("/api/vehiculos/record")
async def generate_record_api(request: Request, body_data: dict = Body(...), user: dict = Depends(get_current_user)):
    target = body_data.get("target")
    if not target: raise HTTPException(status_code=400, detail="Placa/DNI requerido")
    check_banned_dni(target)
    client_ip = request.headers.get('X-Forwarded-For', request.client.host if request.client else '').split(',')[0].strip()
    
    try:
        user_id = user['id']
        cost = await db.get_cost_for_option('record_vehicular')
        cost = cost if cost is not None else 2

        if user.get('role') != 'admin':
            if not user.get('is_premium') and user.get('credits', 0) < cost:
                raise HTTPException(status_code=402, detail="Créditos insuficientes")
            
            success = await db.deduct_credits(user_id, cost, f"Búsqueda RECORD para {target}")
            if not success:
                raise HTTPException(status_code=402, detail="Error al descontar créditos")

        res = await bot_client.query_record(target)

        await api_log_search(request, user_id, target, 'record_vehicular')
        
        return {"data": res, "file_path": res.get("file_path")}

    except SinResultadosError as e:
        if user.get('role') != 'admin' and not user.get('is_premium'):
            await db.refund_credits(user_id, cost, f"Reembolso RECORD (Sin resultados) para {target}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        if user.get('role') != 'admin' and not user.get('is_premium'):
            await db.refund_credits(user_id, cost, f"Reembolso RECORD (Error) para {target}")
        raise HTTPException(status_code=500, detail=str(e))

