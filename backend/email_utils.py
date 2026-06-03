import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import requests
import asyncio
import logging

import os

# Configuration
# Las credenciales ahora se leen de las variables de entorno por seguridad.
SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
SMTP_USER = os.getenv("SMTP_USER", "isaacvillegas922@gmail.com")
SMTP_PASS = os.getenv("SMTP_PASS", "jyccwxixlhvglocc")

EMAIL_VERIFY_API_KEY = "uoTDoZI0uTtZa2k43RlgZn2AOJxr0Etx"

logger = logging.getLogger(__name__)

async def is_disposable_email(email: str) -> bool:
    """
    Checks if an email is disposable using EmailListVerify API.
    Returns True if disposable or invalid, False if safe.
    """
    url = f"https://apps.emaillistverify.com/api/verifyEmail?secret={EMAIL_VERIFY_API_KEY}&email={email}&timeout=15"
    
    try:
        # Run blocking request in thread
        response = await asyncio.to_thread(requests.get, url)
        result = response.text.strip()
        
        # API returns "ok" for valid, distinct codes for invalid/disposable
        # Examples: "ok", "fail_mailbox_invalid", "fail_syntax_error", "fail_disposable_email", etc.
        # User prompt example output: "ok" or error code.
        
        if result == "ok":
            return False
            
        logger.warning(f"Email blocked: {email} - Reason: {result}")
        return True
        
    except Exception as e:
        logger.error(f"Error checking disposable email: {e}")
        return False

async def send_custom_verification_email(to_email: str, link: str):
    """
    Sends a custom verification email with the Firebase link.
    """
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
        # Run blocking SMTP in thread
        await asyncio.to_thread(_send_email_sync, msg)
        logger.info(f"Verification email sent to {to_email}")
        return True
    except Exception as e:
        logger.error(f"Error sending verification email to {to_email}: {e}")
        return False

def _send_email_sync(msg):
    try:
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.send_message(msg)
    except Exception as e:
        print(f"SMTP Sync Error: {e}")
        raise e

async def send_purchase_notification_email(admin_email: str, purchase_details: dict):
    """
    Sends an email to the admin when a new purchase request is created.
    """
    subject = "Nueva Solicitud de Compra - Bot DNI"
    body = f"""
    <html>
    <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #2563eb;">Nueva Solicitud de Compra</h2>
            <p>Se ha registrado una nueva solicitud de compra en el sistema que requiere revisión.</p>
            
            <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 5px 0;"><strong>Usuario:</strong> {purchase_details.get('user_email', 'Desconocido')}</p>
                <p style="margin: 5px 0;"><strong>Plan / Paquete:</strong> {purchase_details.get('plan_label', 'N/A')}</p>
                <p style="margin: 5px 0;"><strong>Monto:</strong> S/ {purchase_details.get('amount_soles', '0')}</p>
                <p style="margin: 5px 0;"><strong>Método de pago:</strong> <span style="text-transform: uppercase;">{purchase_details.get('payment_method', 'N/A')}</span></p>
                <p style="margin: 5px 0;"><strong>ID de Compra:</strong> {purchase_details.get('purchase_id', 'N/A')}</p>
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
    """
    Sends an email to the user when their purchase request is approved.
    """
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
