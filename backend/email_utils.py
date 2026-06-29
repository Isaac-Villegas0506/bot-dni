import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import requests
import asyncio
import logging

from dotenv import load_dotenv
from config.settings import settings

load_dotenv()

SMTP_SERVER = settings.smtp_host
SMTP_PORT = settings.smtp_port
SMTP_USER = settings.smtp_user
SMTP_PASS = settings.smtp_password
EMAIL_VERIFY_API_KEY = settings.email_verify_api_key

logger = logging.getLogger(__name__)

async def is_disposable_email(email: str) -> bool:
    if not EMAIL_VERIFY_API_KEY:
        return False
    try:
        response = await asyncio.to_thread(
            requests.get,
            "https://apps.emaillistverify.com/api/verifyEmail",
            params={"secret": EMAIL_VERIFY_API_KEY, "email": email, "timeout": 15},
            timeout=20,
        )
        result = response.text.strip()
        if result == "ok":
            return False
        logger.warning(f"Email blocked: {email} - Reason: {result}")
        return True
    except Exception as e:
        logger.error(f"Error checking disposable email: {e}")
        return False

async def send_custom_verification_email(to_email: str, link: str):
    subject = "Activa tu cuenta ahora"
    body = f"""
    <html>
    <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <p>Hola,</p>
            <p>Gracias por registrarte en nuestra plataforma.<br>
            Para completar tu registro y activar tu cuenta, necesitamos que verifiques tu dirección de correo electrónico.</p>
            <p>Por favor, haz clic en el siguiente enlace para confirmar tu cuenta:</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="{link}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 5px; font-weight: bold;">👉 Verificar Cuenta</a>
            </div>
            <p style="font-size: 14px; color: #555;">Si el botón no funciona, copia y pega este enlace en tu navegador:<br>
            <a href="{link}" style="color: #2563eb;">{link}</a></p>
            <p>Este paso es importante para garantizar la seguridad de tu cuenta y asegurarnos de que el correo ingresado sea válido.</p>
            <p>Si tú no solicitaste este registro, puedes ignorar este mensaje sin ningún problema.</p>
            <br>
            <p>Saludos cordiales,<br><strong>El equipo de soporte de Bot DNI</strong></p>
        </div>
    </body>
    </html>
    """
    msg = MIMEMultipart()
    msg['From'] = f"El equipo de soporte de Bot DNI <{SMTP_USER}>"
    msg['To'] = to_email
    msg['Subject'] = subject
    msg.attach(MIMEText(body, 'html'))
    try:
        await asyncio.to_thread(_send_email_sync, msg)
        logger.info(f"Verification email sent to {to_email}")
        return True
    except Exception as e:
        logger.error(f"Error sending verification email to {to_email}: {e}")
        return False

async def send_promo_purchase_email(to_email: str, amount_soles: int):
    subject = "¡Compra Exitosa! Tu recarga ha sido aprobada 🎉"
    body = f"""
    <html>
    <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <p>¡Felicidades!</p>
            <p>Tu recarga de <strong>S/ {amount_soles}.00</strong> ha sido validada y aprobada exitosamente.</p>
            <p>Tus créditos o beneficios han sido añadidos a tu cuenta de Bot DNI. Ya puedes ingresar al sistema y empezar a realizar tus consultas premium.</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="https://bot-dni.com/" style="display: inline-block; padding: 12px 24px; background-color: #10b981; color: #ffffff; text-decoration: none; border-radius: 5px; font-weight: bold;">👉 Ingresar a mi Cuenta</a>
            </div>
            <p style="font-size: 14px; color: #555;">Si tienes alguna duda, puedes contactarnos respondiendo a este correo.</p>
            <br>
            <p>Saludos cordiales,<br><strong>El equipo de Bot DNI</strong></p>
        </div>
    </body>
    </html>
    """
    msg = MIMEMultipart()
    msg['From'] = f"Ventas - Bot DNI <{SMTP_USER}>"
    msg['To'] = to_email
    msg['Subject'] = subject
    msg.attach(MIMEText(body, 'html'))
    try:
        await asyncio.to_thread(_send_email_sync, msg)
        logger.info(f"Promo purchase email sent to {to_email}")
        return True
    except Exception as e:
        logger.error(f"Error sending promo email to {to_email}: {e}")
        return False

def _send_email_sync(msg):
    if not SMTP_USER or not SMTP_PASS:
        raise RuntimeError("Credenciales SMTP no configuradas")
    try:
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.send_message(msg)
    except Exception as e:
        logger.error("SMTP Sync Error", exc_info=True)
        raise e

async def send_purchase_notification_email(admin_email: str, purchase_details: dict):
    subject = "Nueva Solicitud de Compra - Bot DNI"
    body = f"""
    <html>
    <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #2563eb;">Nueva Solicitud de Compra</h2>
            <p>Se ha registrado una nueva solicitud de compra en el sistema que requiere revisión.</p>
            <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb;">
                <p style="margin: 0 0 10px 0; font-size: 18px; color: #1e40af;"><strong>Plan Comprado: <span style="background: #dbeafe; padding: 2px 8px; border-radius: 4px;">{purchase_details.get('plan_label', 'N/A')}</span></strong></p>
                <p style="margin: 5px 0;"><strong>Usuario:</strong> {purchase_details.get('user_email', 'Desconocido')}</p>
                <p style="margin: 5px 0;"><strong>Monto:</strong> S/ {purchase_details.get('amount_soles', '0')}</p>
                <p style="margin: 5px 0;"><strong>Método de pago:</strong> <span style="text-transform: uppercase;">{purchase_details.get('payment_method', 'N/A')}</span></p>
                <p style="margin: 5px 0; font-size: 12px; color: #64748b;"><strong>ID de Compra:</strong> {purchase_details.get('purchase_id', 'N/A')}</p>
            </div>
            <p>Por favor, ingresa al Panel de Administrador para validar el comprobante y aprobar o rechazar la solicitud.</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="https://bot-dni.vercel.app/admin" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 5px; font-weight: bold;">👉 Ir al Panel Admin</a>
            </div>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="font-size: 12px; color: #888; text-align: center;">Este es un mensaje automático del sistema. No respondas a este correo.</p>
        </div>
    </body>
    </html>
    """
    msg = MIMEMultipart()
    msg['From'] = f"Bot DNI Notificaciones <{SMTP_USER}>"
    msg['To'] = admin_email
    msg['Subject'] = subject
    msg.attach(MIMEText(body, 'html'))
    try:
        await asyncio.to_thread(_send_email_sync, msg)
        logger.info(f"Purchase notification sent to {admin_email}")
        return True
    except Exception as e:
        logger.error(f"Error sending purchase notification to {admin_email}: {e}")
        return False

async def send_purchase_approved_email(to_email: str, plan_name: str, is_premium: bool):
    subject = "¡Compra Aprobada! - Bot DNI"
    body = f"""
    <html>
    <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #10b981;">¡Tu compra ha sido aprobada! 🎉</h2>
            <p>Hola,</p>
            <p>Te informamos que tu solicitud de compra para el paquete <strong>{plan_name}</strong> ha sido validada y aprobada exitosamente por un administrador.</p>
            <p>Tus {"días ilimitados de acceso" if is_premium else "créditos"} ya han sido agregados a tu cuenta y están listos para ser utilizados.</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="https://bot-dni.vercel.app/" style="display: inline-block; padding: 12px 24px; background-color: #10b981; color: #ffffff; text-decoration: none; border-radius: 5px; font-weight: bold;">👉 Ir a Bot DNI</a>
            </div>
            <p>Si tienes alguna duda o inconveniente, no dudes en contactarnos.</p>
            <br>
            <p>Saludos cordiales,<br><strong>El equipo de Bot DNI</strong></p>
        </div>
    </body>
    </html>
    """
    msg = MIMEMultipart()
    msg['From'] = f"Bot DNI <{SMTP_USER}>"
    msg['To'] = to_email
    msg['Subject'] = subject
    msg.attach(MIMEText(body, 'html'))
    try:
        await asyncio.to_thread(_send_email_sync, msg)
        logger.info(f"Purchase approved email sent to {to_email}")
        return True
    except Exception as e:
        logger.error(f"Error sending purchase approved email to {to_email}: {e}")
        return False

async def send_purchase_received_email(to_email: str, plan_name: str, amount_soles: str):
    subject = "Solicitud de Compra Recibida - Bot DNI"
    body = f"""
    <html>
    <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #2563eb;">Hemos recibido tu solicitud de compra</h2>
            <p>Hola,</p>
            <p>Queremos confirmarte que hemos recibido tu solicitud de compra para el paquete <strong>{plan_name}</strong> por S/ {amount_soles}.</p>
            <p>Actualmente, tu comprobante de pago está siendo revisado por nuestro equipo de administradores. Este proceso suele ser rápido, y te notificaremos por correo electrónico en cuanto tu compra sea aprobada y tus beneficios estén activos.</p>
            <p>Si tienes alguna duda, no dudes en contactarnos.</p>
            <br>
            <p>Saludos cordiales,<br><strong>El equipo de Bot DNI</strong></p>
        </div>
    </body>
    </html>
    """
    msg = MIMEMultipart()
    msg['From'] = f"Bot DNI <{SMTP_USER}>"
    msg['To'] = to_email
    msg['Subject'] = subject
    msg.attach(MIMEText(body, 'html'))
    try:
        await asyncio.to_thread(_send_email_sync, msg)
        logger.info(f"Purchase received email sent to {to_email}")
        return True
    except Exception as e:
        logger.error(f"Error sending purchase received email to {to_email}: {e}")
        return False
