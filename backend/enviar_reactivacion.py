"""
Reactivación: avisa por correo a los usuarios registrados de que la plataforma
está de nuevo activa.

Uso:
    # 1) Simulacro: muestra a quién se enviaría, sin enviar nada
    python enviar_reactivacion.py --dry-run

    # 2) Prueba real a una sola dirección
    python enviar_reactivacion.py --solo tu@correo.com

    # 3) Envío real a todos (pide confirmación escribiendo ENVIAR)
    python enviar_reactivacion.py --enviar

Opciones:
    --limite N      Envía solo a los primeros N (para probar por tandas).
    --solo EMAIL    Envía únicamente a ese correo (ignora el resto).
    --pausa S       Segundos entre envíos (por defecto 2.0).
    --reanudar      Salta a quienes ya recibieron el correo (tabla email_log).

El envío usa el SMTP ya configurado en .env y registra cada envío en la tabla
email_log para no repetir a nadie entre ejecuciones.
"""
from __future__ import annotations

import argparse
import asyncio
import os
import sys
from datetime import datetime

import psycopg2
from dotenv import load_dotenv

load_dotenv()

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from email_utils import _send_email_sync  # noqa: E402

from email.header import Header  # noqa: E402
from email.mime.multipart import MIMEMultipart  # noqa: E402
from email.mime.text import MIMEText  # noqa: E402

APP_URL = os.getenv("APP_URL", "https://bot-dni.vercel.app")
CAMPAIGN = "reactivacion_2026_11"   # identificador para no repetir envíos

# Se leen del entorno directamente: config.settings usa @property con
# os.getenv y el .env se carga después de importar el módulo, por lo que
# settings.smtp_user devolvía None.
SMTP_HOST = os.getenv("SMTP_HOST") or os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER") or ""
SMTP_PASS = os.getenv("SMTP_PASSWORD") or os.getenv("SMTP_PASS") or ""


# ── Plantilla ────────────────────────────────────────────────────────────────
def construir_correo(nombre: str, creditos: int, es_premium: bool) -> tuple[str, str]:
    """Devuelve (asunto, html) personalizado para el usuario."""
    nombre = (nombre or "").strip() or "hola"
    primer_nombre = nombre.split()[0] if nombre != "hola" else ""

    saludo = f"Hola, {primer_nombre}" if primer_nombre else "Hola"

    # Bloque de saldo sólo si tiene algo que conservar
    if es_premium:
        saldo_html = """
        <div style="background:#ecfdf5;border-left:4px solid #10b981;padding:14px 18px;border-radius:8px;margin:22px 0;">
          <p style="margin:0;color:#065f46;font-weight:700;">Tu cuenta sigue siendo Premium</p>
          <p style="margin:6px 0 0;color:#065f46;font-size:14px;">
            Mantienes el acceso Premium que ya tenías. No necesitas hacer nada.
          </p>
        </div>"""
    elif creditos > 0:
        saldo_html = f"""
        <div style="background:#eff6ff;border-left:4px solid #2563eb;padding:14px 18px;border-radius:8px;margin:22px 0;">
          <p style="margin:0;color:#1e40af;font-weight:700;">Tus {creditos} crédito{'s' if creditos != 1 else ''} siguen ahí</p>
          <p style="margin:6px 0 0;color:#1e40af;font-size:14px;">
            Conservas íntegro el saldo que tenías antes de la pausa.
          </p>
        </div>"""
    else:
        saldo_html = """
        <div style="background:#f8fafc;border-left:4px solid #94a3b8;padding:14px 18px;border-radius:8px;margin:22px 0;">
          <p style="margin:0;color:#334155;font-weight:700;">Tu cuenta sigue activa</p>
          <p style="margin:6px 0 0;color:#334155;font-size:14px;">
            Puedes entrar cuando quieras con el mismo correo de Google.
          </p>
        </div>"""

    html = f"""<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr><td style="padding:30px 32px 8px;">
          <h1 style="margin:0 0 6px;font-size:21px;line-height:1.3;color:#0f172a;">{saludo}</h1>
          <p style="margin:0;font-size:15px;color:#475569;">Bot DNI está de vuelta en línea.</p>
        </td></tr>
        <tr><td style="padding:18px 32px 0;">
          <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#334155;">
            Te escribimos para contarte que la plataforma ya está activa otra vez.
            Estuvo pausada un tiempo, así que entendemos que dejaras de usarla.
          </p>
          <p style="margin:0;font-size:15px;line-height:1.6;color:#334155;">
            Puedes volver a entrar <strong>con el mismo correo de Google</strong> que usaste antes.
            No tienes que registrarte de nuevo ni cambiar nada.
          </p>
          {saldo_html}
          <p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#334155;">
            Las consultas vuelven a funcionar con normalidad: datos RENIEC,
            teléfonos asociados, denuncias, certificados y el resto de opciones.
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 26px;">
            <tr><td style="border-radius:10px;background:#2563eb;">
              <a href="{APP_URL}" style="display:inline-block;padding:14px 30px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">
                Volver a Bot DNI
              </a>
            </td></tr>
          </table>
          <p style="margin:0 0 26px;font-size:13px;line-height:1.6;color:#64748b;">
            Si el botón no abre, copia este enlace en tu navegador:<br>
            <a href="{APP_URL}" style="color:#2563eb;word-break:break-all;">{APP_URL}</a>
          </p>
        </td></tr>
        <tr><td style="padding:18px 32px 28px;border-top:1px solid #e2e8f0;">
          <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">
            Recibes este correo porque tienes una cuenta registrada en Bot DNI.
            Si no quieres recibir más avisos, responde a este mensaje con la palabra
            <strong>BAJA</strong> y eliminaremos tu correo de la lista.
          </p>
          <p style="margin:12px 0 0;font-size:13px;color:#94a3b8;">
            El equipo de Bot DNI
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""
    subject = "Bot DNI está activo de nuevo — puedes volver a usarlo"
    return subject, html


def construir_msg(email: str, subject: str, html: str) -> MIMEMultipart:
    msg = MIMEMultipart()
    msg["From"] = f"Bot DNI <{SMTP_USER}>"
    msg["To"] = email
    msg["Subject"] = Header(subject, "utf-8")
    msg.attach(MIMEText(html, "html", "utf-8"))
    return msg


# ── Base de datos ────────────────────────────────────────────────────────────
def conectar():
    return psycopg2.connect(os.getenv("DATABASE_URL"))


def asegurar_tabla(cur) -> None:
    cur.execute("""
        CREATE TABLE IF NOT EXISTS email_log (
            id SERIAL PRIMARY KEY,
            email VARCHAR(320) NOT NULL,
            campaign VARCHAR(80) NOT NULL,
            estado VARCHAR(20) NOT NULL,
            error TEXT,
            enviado_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE (email, campaign)
        )
    """)


def obtener_destinatarios(cur, reanudar: bool) -> list[tuple[str, str, int, bool]]:
    """(email, nombre, creditos, es_premium) de usuarios activos con correo."""
    filtro_reanudar = ""
    if reanudar:
        filtro_reanudar = """
          AND NOT EXISTS (
              SELECT 1 FROM email_log l
              WHERE l.email = u.email AND l.campaign = %s AND l.estado = 'ok'
          )
        """
    cur.execute(f"""
        SELECT u.email,
               COALESCE(NULLIF(TRIM(u.full_name), ''), '') AS nombre,
               COALESCE(u.credits, 0) AS creditos,
               COALESCE(u.is_premium, false) AS es_premium
        FROM users u
        WHERE u.email IS NOT NULL
          AND u.email <> ''
          AND u.email LIKE '%%@%%'
          AND COALESCE(u.status, 'active') = 'active'
          {filtro_reanudar}
        ORDER BY u.id
    """, (CAMPAIGN,) if reanudar else ())
    return cur.fetchall()


def registrar(cur, con, email: str, estado: str, error: str | None = None) -> None:
    cur.execute("""
        INSERT INTO email_log (email, campaign, estado, error)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (email, campaign) DO UPDATE
        SET estado = EXCLUDED.estado, error = EXCLUDED.error, enviado_at = NOW()
    """, (email, CAMPAIGN, estado, error))
    con.commit()


# ── Main ─────────────────────────────────────────────────────────────────────
async def main() -> None:
    ap = argparse.ArgumentParser(description="Aviso de reactivación de Bot DNI")
    ap.add_argument("--dry-run", action="store_true", help="Simulacro: no envía nada")
    ap.add_argument("--enviar", action="store_true", help="Envío real a todos")
    ap.add_argument("--solo", metavar="EMAIL", help="Enviar solo a ese correo")
    ap.add_argument("--limite", type=int, default=0, help="Máximo de envíos")
    ap.add_argument("--pausa", type=float, default=6.0, help="Segundos entre envíos (Gmail limita el ritmo)")
    ap.add_argument("--reanudar", action="store_true", help="Saltar ya enviados")
    args = ap.parse_args()

    if not args.dry_run and not args.enviar and not args.solo:
        print("Indica un modo: --dry-run (simulacro), --solo EMAIL (prueba) o --enviar (real).")
        sys.exit(1)

    if not SMTP_USER or not SMTP_PASS:
        print("ERROR: faltan SMTP_USER / SMTP_PASS en .env")
        sys.exit(1)

    con = conectar()
    cur = con.cursor()
    asegurar_tabla(cur)
    con.commit()

    if args.solo:
        destinatarios = [(args.solo, "", 0, False)]
    else:
        destinatarios = obtener_destinatarios(cur, args.reanudar)

    if args.limite:
        destinatarios = destinatarios[: args.limite]

    total = len(destinatarios)
    print(f"Destinatarios: {total}   campaña: {CAMPAIGN}")
    print(f"SMTP: {SMTP_USER} via {SMTP_HOST}:{SMTP_PORT}")
    print("-" * 60)

    if args.dry_run:
        for email, nombre, creditos, premium in destinatarios[:20]:
            etiqueta = "premium" if premium else f"{creditos} créd."
            print(f"  {email:<42} {nombre[:28]:<28} {etiqueta}")
        if total > 20:
            print(f"  ... y {total - 20} más")
        print("\nSIMULACRO: no se envió ningún correo.")
        return

    if args.enviar:
        respuesta = input(f"\n¿Enviar a {total} usuarios? Escribe ENVIAR para confirmar: ")
        if respuesta.strip() != "ENVIAR":
            print("Cancelado.")
            return

    enviados = fallidos = 0
    for i, (email, nombre, creditos, premium) in enumerate(destinatarios, 1):
        subject, html = construir_correo(nombre, creditos, premium)
        msg = construir_msg(email, subject, html)
        try:
            await asyncio.to_thread(_send_email_sync, msg)
            registrar(cur, con, email, "ok")
            enviados += 1
            print(f"  [{i}/{total}] OK   {email}")
        except Exception as e:
            registrar(cur, con, email, "error", str(e)[:500])
            fallidos += 1
            print(f"  [{i}/{total}] FAIL {email}  -> {type(e).__name__}: {str(e)[:80]}")
        if i < total:
            await asyncio.sleep(args.pausa)

    print("-" * 60)
    print(f"Enviados: {enviados}   Fallidos: {fallidos}   Total: {total}")
    if fallidos:
        print("Revisa la tabla email_log para ver los errores y reintenta con --reanudar.")


if __name__ == "__main__":
    asyncio.run(main())
