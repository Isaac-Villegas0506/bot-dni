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
import time
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
    nombre = (nombre or "").strip()
    primer_nombre = nombre.split()[0].capitalize() if nombre else ""
    # Titular del hero: personalizado si hay nombre, genérico si no.
    titular_hero = f"{primer_nombre}, volvimos a estar en línea" if primer_nombre \
        else "Volvimos a estar en línea"

    # ── Tarjeta de saldo: el gancho emocional del correo ────────────────────
    if es_premium:
        saldo_titulo = "Sigues siendo Premium"
        saldo_detalle = "Tu acceso Premium está intacto. No pagaste de más ni perdiste nada."
        saldo_num = "∞"
        saldo_label = "ACCESO PREMIUM"
        saldo_color = "#059669"
        saldo_bg = "#ecfdf5"
        saldo_borde = "#a7f3d0"
    elif creditos > 0:
        saldo_titulo = "Tus créditos te están esperando"
        saldo_detalle = "No caducaron. Siguen ahí, listos para usar."
        saldo_num = str(creditos)
        saldo_label = "CRÉDITOS DISPONIBLES"
        saldo_color = "#2563eb"
        saldo_bg = "#eff6ff"
        saldo_borde = "#bfdbfe"
    else:
        saldo_titulo = "Tu cuenta sigue activa"
        saldo_detalle = "Entra con el mismo correo de Google, sin registrarte otra vez."
        saldo_num = "✓"
        saldo_label = "CUENTA VERIFICADA"
        saldo_color = "#0f766e"
        saldo_bg = "#f0fdfa"
        saldo_borde = "#99f6e4"

    preheader = {
        "premium": "Volvimos. Tu acceso Premium sigue intacto y las consultas ya funcionan.",
        "creditos": f"Volvimos. Tus {creditos} créditos siguen ahi y las consultas ya funcionan.",
        "vacio": "Volvimos. Tu cuenta sigue activa y las consultas ya funcionan otra vez.",
    }["premium" if es_premium else ("creditos" if creditos > 0 else "vacio")]

    # ── Funciones: lo que puede volver a hacer hoy mismo ────────────────────
    funciones = [
        ("Datos RENIEC completos", "Nombres, filiación, domicilio y ubigeo"),
        ("DNI virtual y C4", "Azul, amarillo, electrónico y ficha de inscripción"),
        ("Teléfonos asociados", "Todas las líneas a nombre del titular"),
        ("Denuncias y certificados", "Policiales, judiciales y fiscales"),
    ]
    filas_funciones = ""
    for titulo, detalle in funciones:
        filas_funciones += f"""
        <tr>
          <td style="padding:9px 0;vertical-align:top;width:26px;">
            <span style="color:#16a34a;font-size:15px;font-weight:700;">✓</span>
          </td>
          <td style="padding:9px 0;">
            <span style="font-size:14px;font-weight:600;color:#0f172a;">{titulo}</span><br>
            <span style="font-size:13px;color:#64748b;">{detalle}</span>
          </td>
        </tr>"""

    html = f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
</head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    {preheader}
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;padding:32px 12px;">
    <tr><td align="center">

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 6px 24px rgba(15,23,42,0.08);border:1px solid #e2e8f0;">

        <!-- Barra superior de marca -->
        <tr><td style="background:#2563eb;padding:16px 32px;">
          <table role="presentation" width="100%"><tr>
            <td style="font-size:16px;font-weight:800;color:#ffffff;letter-spacing:-0.2px;">Bot DNI</td>
            <td align="right" style="font-size:11px;font-weight:700;color:#bfdbfe;letter-spacing:0.8px;">PLATAFORMA ACTIVA</td>
          </tr></table>
        </td></tr>

        <!-- Hero -->
        <tr><td style="padding:34px 32px 10px;">
          <div style="display:inline-block;background:#dcfce7;color:#15803d;font-size:11px;font-weight:800;letter-spacing:1px;padding:6px 12px;border-radius:99px;margin-bottom:16px;">
            ● ESTAMOS DE VUELTA
          </div>
          <h1 style="margin:0 0 12px;font-size:27px;line-height:1.25;color:#0f172a;font-weight:800;letter-spacing:-0.6px;">
            {titular_hero}
          </h1>
          <p style="margin:0;font-size:15px;line-height:1.65;color:#475569;">
            La plataforma estuvo pausada y entendemos que dejaras de entrar.
            La buena noticia: <strong style="color:#0f172a;">ya funciona otra vez</strong>
            y no perdiste nada de lo que tenías.
          </p>
        </td></tr>

        <!-- Tarjeta de saldo -->
        <tr><td style="padding:22px 32px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{saldo_bg};border:1px solid {saldo_borde};border-radius:14px;">
            <tr><td style="padding:20px 22px;">
              <table role="presentation" width="100%"><tr>
                <td style="vertical-align:middle;">
                  <div style="font-size:10px;font-weight:800;letter-spacing:1.1px;color:{saldo_color};margin-bottom:4px;">{saldo_label}</div>
                  <div style="font-size:34px;line-height:1;font-weight:800;color:{saldo_color};letter-spacing:-1px;">{saldo_num}</div>
                </td>
              </tr></table>
              <div style="margin-top:14px;padding-top:14px;border-top:1px solid {saldo_borde};">
                <div style="font-size:14px;font-weight:700;color:#0f172a;">{saldo_titulo}</div>
                <div style="margin-top:3px;font-size:13px;line-height:1.55;color:#475569;">{saldo_detalle}</div>
              </div>
            </td></tr>
          </table>
        </td></tr>

        <!-- CTA principal -->
        <tr><td style="padding:26px 32px 8px;" align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            <tr><td align="center" style="border-radius:12px;background:#2563eb;box-shadow:0 4px 14px rgba(37,99,235,0.32);">
              <a href="{APP_URL}" style="display:block;padding:16px 28px;font-size:16px;font-weight:800;color:#ffffff;text-decoration:none;border-radius:12px;letter-spacing:-0.2px;">
                Entrar a mi cuenta →
              </a>
            </td></tr>
          </table>
          <p style="margin:12px 0 0;font-size:12.5px;color:#94a3b8;">
            Con tu mismo correo de Google. Sin registrarte de nuevo.
          </p>
        </td></tr>

        <!-- Qué puedes hacer -->
        <tr><td style="padding:24px 32px 0;">
          <div style="font-size:11px;font-weight:800;letter-spacing:1.1px;color:#94a3b8;margin-bottom:6px;">YA DISPONIBLE</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            {filas_funciones}
          </table>
        </td></tr>

        <!-- Cierre -->
        <tr><td style="padding:22px 32px 30px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:12px;border:1px solid #eef2f7;">
            <tr><td style="padding:16px 18px;">
              <p style="margin:0;font-size:13.5px;line-height:1.6;color:#475569;">
                <strong style="color:#0f172a;">Un detalle:</strong> si tuviste problemas
                para entrar en algún momento, prueba de nuevo ahora — los accesos
                con Google quedaron restablecidos.
              </p>
            </td></tr>
          </table>
          <p style="margin:18px 0 0;font-size:13.5px;line-height:1.6;color:#475569;">
            Nos alegra tenerte de vuelta.<br>
            <strong style="color:#0f172a;">El equipo de Bot DNI</strong>
          </p>
        </td></tr>

        <!-- Pie legal -->
        <tr><td style="padding:16px 32px 24px;border-top:1px solid #eef2f7;background:#fafbfc;">
          <p style="margin:0 0 6px;font-size:11.5px;line-height:1.6;color:#94a3b8;">
            Recibes este correo porque tienes una cuenta registrada en Bot DNI.
          </p>
          <p style="margin:0;font-size:11.5px;line-height:1.6;color:#94a3b8;">
            ¿No quieres más avisos? Responde con la palabra <strong>BAJA</strong>
            y eliminamos tu correo de la lista.
          </p>
        </td></tr>

      </table>

      <p style="margin:18px 0 0;font-size:11px;color:#94a3b8;">
        Si el botón no abre, copia este enlace:<br>
        <a href="{APP_URL}" style="color:#2563eb;word-break:break-all;">{APP_URL}</a>
      </p>

    </td></tr>
  </table>
</body>
</html>"""
    # El asunto cambia segun lo que el usuario tiene en su cuenta: es lo que
    # hace que abra el correo.
    if es_premium:
        subject = f"Volvimos 🚀 {primer_nombre}, tu Premium sigue activo" if primer_nombre \
            else "Volvimos 🚀 tu Premium sigue activo"
    elif creditos > 0:
        subject = f"Volvimos 🚀 {primer_nombre}, tus {creditos} créditos siguen intactos" if primer_nombre \
            else f"Volvimos 🚀 tus {creditos} créditos siguen intactos"
    else:
        subject = f"Volvimos 🚀 {primer_nombre}, tu cuenta te espera" if primer_nombre \
            else "Volvimos 🚀 tu cuenta te espera"
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


def registrar(email: str, estado: str, error: str | None = None, intentos: int = 3) -> bool:
    """
    Registra el envío reconectando si Supabase cerró la conexión.

    El plan gratuito de Supabase corta conexiones ociosas: en una campaña
    larga pasa a mitad del envío (psycopg2.OperationalError: server closed the
    connection). Antes eso tumbaba el script entero; ahora se reintenta con
    una conexión nueva. Devuelve True si quedó registrado.
    """
    for n in range(1, intentos + 1):
        try:
            con = conectar()
            cur = con.cursor()
            cur.execute("""
                INSERT INTO email_log (email, campaign, estado, error)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (email, campaign) DO UPDATE
                SET estado = EXCLUDED.estado, error = EXCLUDED.error, enviado_at = NOW()
            """, (email, CAMPAIGN, estado, error))
            con.commit()
            con.close()
            return True
        except (psycopg2.OperationalError, psycopg2.InterfaceError) as e:
            print(f"      ⚠️  BD caída al registrar {email} (intento {n}/{intentos}): {e}")
            if n < intentos:
                time.sleep(2 * n)
        except Exception as e:
            print(f"      ⚠️  error registrando {email}: {e}")
            return False
    print(f"      ❌ no se pudo registrar {email} tras {intentos} intentos")
    return False


# ── Main ─────────────────────────────────────────────────────────────────────
async def main() -> None:
    ap = argparse.ArgumentParser(description="Aviso de reactivación de Bot DNI")
    ap.add_argument("--dry-run", action="store_true", help="Simulacro: no envía nada")
    ap.add_argument("--enviar", action="store_true", help="Envío real a todos")
    ap.add_argument("--solo", metavar="EMAIL", help="Enviar solo a ese correo")
    ap.add_argument("--limite", type=int, default=0, help="Máximo de envíos")
    ap.add_argument("--pausa", type=float, default=6.0, help="Segundos entre envíos (Gmail limita el ritmo)")
    ap.add_argument("--reanudar", action="store_true", help="Saltar ya enviados")
    ap.add_argument("--yes", "-y", action="store_true", help="No pedir confirmación (para ejecución desatendida)")
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

    if args.enviar and not args.yes:
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
            registrar(email, "ok")
            enviados += 1
            print(f"  [{i}/{total}] OK   {email}")
        except Exception as e:
            registrar(email, "error", str(e)[:500])
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
