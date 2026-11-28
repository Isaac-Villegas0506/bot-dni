"""
Correo de novedades: presenta las consultas disponibles en la web.

Campaña independiente de `reactivacion_2026_11`: usa su propio identificador en
email_log, así que los 211 usuarios que ya recibieron aquel correo sí reciben
este.

Uso:
    python enviar_novedades.py --dry-run          # simulacro
    python enviar_novedades.py --solo tu@correo   # prueba a una dirección
    python enviar_novedades.py --enviar --yes     # envío real
    python enviar_novedades.py --enviar --reanudar --yes   # continuar

El envío usa el SMTP de .env (el de Render está bloqueado por el proveedor).
"""
from __future__ import annotations

import argparse
import asyncio
import os
import sys
import time

import psycopg2
from dotenv import load_dotenv

load_dotenv()
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from email_utils import _send_email_sync  # noqa: E402
from email.header import Header  # noqa: E402
from email.mime.multipart import MIMEMultipart  # noqa: E402
from email.mime.text import MIMEText  # noqa: E402

APP_URL = os.getenv("APP_URL", "https://bot-dni.vercel.app")
CAMPAIGN = "novedades_consultas_2026_11"

SMTP_USER = os.getenv("SMTP_USER") or ""


# ── Contenido: las consultas reales que ofrece la web ────────────────────────
# Fuente: GeneratorReniec (5 fichas), Header (9 apartados) y Home (DNI y nombre).
CONSULTAS = [
    {
        "icono": "🔍",
        "titulo": "Datos RENIEC",
        "detalle": "Nombres, filiación, domicilio, ubigeo y foto del titular.",
        "badge": "GRATIS",
    },
    {
        "icono": "🆔",
        "titulo": "Fichas C4 y DNI virtual",
        "detalle": "C4 Azul, Ficha de Inscripción, DNI Azul, Amarillo y Electrónico.",
        "badge": "PREMIUM",
    },
    {
        "icono": "📞",
        "titulo": "Teléfonos por DNI",
        "detalle": "Todas las líneas a nombre de la persona: operador y periodo.",
        "badge": "GRATIS",
    },
    {
        "icono": "👨‍👩‍👧",
        "titulo": "Familiares y hogar",
        "detalle": "Árbol genealógico y reporte SISFOH con los integrantes del hogar.",
        "badge": "PREMIUM",
    },
    {
        "icono": "⚖️",
        "titulo": "Denuncias y delitos",
        "detalle": "Denuncias por DNI y por placa, con el detalle de cada registro.",
        "badge": "PREMIUM",
    },
    {
        "icono": "🏛️",
        "titulo": "Certificados policiales",
        "detalle": "Antecedentes policiales, penales y judiciales en PDF.",
        "badge": "PREMIUM",
    },
    {
        "icono": "🧾",
        "titulo": "Fiscalía",
        "detalle": "Consultas por DNI o RUC del Ministerio Público.",
        "badge": "PREMIUM",
    },
    {
        "icono": "🚗",
        "titulo": "Vehículos",
        "detalle": "Récord vehicular y datos del automotor por placa.",
        "badge": "PREMIUM",
    },
    {
        "icono": "📄",
        "titulo": "Info Global",
        "detalle": "Reporte integrado con PDF consolidado de la persona.",
        "badge": "PREMIUM",
    },
    {
        "icono": "🙂",
        "titulo": "Búsqueda facial",
        "detalle": "Sube una foto y encuentra a quién pertenece el rostro.",
        "badge": "PREMIUM",
    },
]


def construir_correo(nombre: str, creditos: int, es_premium: bool) -> tuple[str, str, str]:
    """Devuelve (asunto, preheader, html)."""
    primer_nombre = (nombre or "").strip().split()[0].capitalize() if (nombre or "").strip() else ""
    saludo = f"{primer_nombre}, ya está todo listo" if primer_nombre else "Ya está todo listo"

    if es_premium:
        asunto = f"{primer_nombre}, tu cuenta Premium abre las 10 consultas" if primer_nombre \
            else "Tu cuenta Premium abre las 10 consultas"
        preheader = "DNI, teléfonos, familia, denuncias, vehículos y más. Todo en la misma web."
    elif creditos > 0:
        asunto = f"{primer_nombre}, tienes {creditos} crédito{'s' if creditos != 1 else ''} y 10 consultas" if primer_nombre \
            else f"Tienes {creditos} crédito{'s' if creditos != 1 else ''} y 10 consultas disponibles"
        preheader = "Mira todo lo que puedes consultar con tu saldo: DNI, teléfonos, familia y más."
    else:
        asunto = f"{primer_nombre}, diez formas de averiguar sobre una persona" if primer_nombre \
            else "Diez formas de averiguar sobre una persona"
        preheader = "DNI, teléfonos, familia, denuncias, vehículos y más. Empieza gratis."

    # ── Filas de consultas (2 columnas en escritorio, 1 en móvil) ────────────
    filas = []
    for c in CONSULTAS:
        badge_color = "#047857" if c["badge"] == "GRATIS" else "#4338ca"
        badge_bg = "#d1fae5" if c["badge"] == "GRATIS" else "#e0e7ff"
        filas.append(f"""
        <tr><td style="padding:0 0 10px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                 style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;">
            <tr><td style="padding:14px 16px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width:34px;vertical-align:top;font-size:20px;line-height:1.2;">{c['icono']}</td>
                  <td style="vertical-align:top;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size:14px;font-weight:700;color:#0f172a;line-height:1.35;">{c['titulo']}</td>
                        <td align="right" style="white-space:nowrap;">
                          <span style="display:inline-block;background:{badge_bg};color:{badge_color};font-size:9px;font-weight:800;letter-spacing:0.6px;padding:3px 7px;border-radius:99px;">{c['badge']}</span>
                        </td>
                      </tr>
                    </table>
                    <div style="margin-top:4px;font-size:12.5px;line-height:1.55;color:#64748b;">{c['detalle']}</div>
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>
        </td></tr>""")
    filas_html = "".join(filas)

    html = f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
</head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">{preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;padding:30px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 8px 28px rgba(15,23,42,0.08);">

        <!-- Cabecera con degradado -->
        <tr><td style="background:#1e40af;background-image:linear-gradient(135deg,#1e3a8a 0%,#2563eb 55%,#4f46e5 100%);padding:34px 32px 30px;">
          <div style="font-size:13px;font-weight:800;color:#bfdbfe;letter-spacing:1.4px;margin-bottom:20px;">BOT DNI</div>
          <h1 style="margin:0 0 12px;font-size:29px;line-height:1.22;color:#ffffff;font-weight:800;letter-spacing:-0.7px;">
            {saludo}
          </h1>
          <p style="margin:0;font-size:15px;line-height:1.6;color:#dbeafe;">
            Una sola web para averiguar lo que necesitas sobre una persona,
            un teléfono o un vehículo. Estas son las <strong style="color:#ffffff;">10 consultas</strong> disponibles hoy.
          </p>
        </td></tr>

        <!-- Datos: qué es gratis y qué es premium -->
        <tr><td style="padding:24px 32px 4px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:12px;border:1px solid #eef2f7;">
            <tr>
              <td align="center" style="padding:14px 8px;border-right:1px solid #e2e8f0;">
                <div style="font-size:22px;font-weight:800;color:#0f172a;line-height:1;">2</div>
                <div style="margin-top:3px;font-size:10.5px;font-weight:700;color:#64748b;letter-spacing:0.5px;">GRATIS</div>
              </td>
              <td align="center" style="padding:14px 8px;border-right:1px solid #e2e8f0;">
                <div style="font-size:22px;font-weight:800;color:#0f172a;line-height:1;">8</div>
                <div style="margin-top:3px;font-size:10.5px;font-weight:700;color:#64748b;letter-spacing:0.5px;">PREMIUM</div>
              </td>
              <td align="center" style="padding:14px 8px;">
                <div style="font-size:22px;font-weight:800;color:#0f172a;line-height:1;">{creditos}</div>
                <div style="margin-top:3px;font-size:10.5px;font-weight:700;color:#64748b;letter-spacing:0.5px;">TUS CRÉDITOS</div>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Lista de consultas -->
        <tr><td style="padding:22px 32px 0;">
          <div style="font-size:11px;font-weight:800;letter-spacing:1.2px;color:#94a3b8;margin-bottom:12px;">QUÉ PUEDES CONSULTAR</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            {filas_html}
          </table>
        </td></tr>

        <!-- CTA -->
        <tr><td style="padding:14px 32px 10px;" align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            <tr><td align="center" style="border-radius:12px;background:#2563eb;box-shadow:0 4px 16px rgba(37,99,235,0.35);">
              <a href="{APP_URL}" style="display:block;padding:17px 28px;font-size:16.5px;font-weight:800;color:#ffffff;text-decoration:none;border-radius:12px;letter-spacing:-0.2px;">
                Probar una consulta ahora →
              </a>
            </td></tr>
          </table>
          <p style="margin:12px 0 0;font-size:12.5px;color:#94a3b8;">
            Entras con tu correo de Google. Sin registrarte otra vez.
          </p>
        </td></tr>

        <!-- Nota premium -->
        <tr><td style="padding:16px 32px 30px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;">
            <tr><td style="padding:15px 18px;">
              <div style="font-size:13.5px;font-weight:700;color:#1e40af;margin-bottom:4px;">
                {"Tienes acceso Premium activo" if es_premium else "Cómo desbloqueas las premium"}
              </div>
              <div style="font-size:12.5px;line-height:1.6;color:#1e40af;">
                {"No necesitas hacer nada: entras y las 8 consultas premium están disponibles." if es_premium else "Ganas 1 crédito gratis cada 24 horas, o compras los que necesites desde la web con Yape."}
              </div>
            </td></tr>
          </table>
          <p style="margin:18px 0 0;font-size:13.5px;line-height:1.6;color:#475569;">
            Cualquier duda, respóndenos a este correo.<br>
            <strong style="color:#0f172a;">El equipo de Bot DNI</strong>
          </p>
        </td></tr>

        <!-- Pie -->
        <tr><td style="padding:16px 32px 24px;border-top:1px solid #eef2f7;background:#fafbfc;">
          <p style="margin:0 0 6px;font-size:11.5px;line-height:1.6;color:#94a3b8;">
            Recibes este correo porque tienes una cuenta en Bot DNI.
          </p>
          <p style="margin:0;font-size:11.5px;line-height:1.6;color:#94a3b8;">
            ¿No quieres más avisos? Responde con la palabra <strong>BAJA</strong> y te sacamos de la lista.
          </p>
        </td></tr>

      </table>
      <p style="margin:16px 0 0;font-size:11px;color:#94a3b8;">
        Si el botón no abre: <a href="{APP_URL}" style="color:#2563eb;word-break:break-all;">{APP_URL}</a>
      </p>
    </td></tr>
  </table>
</body>
</html>"""
    return asunto, preheader, html


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


def asegurar_tabla():
    con = conectar()
    cur = con.cursor()
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
    con.commit()
    con.close()


def destinatarios(reanudar: bool) -> list[tuple[str, str, int, bool]]:
    con = conectar()
    cur = con.cursor()
    filtro = ""
    if reanudar:
        filtro = """
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
        WHERE u.email IS NOT NULL AND u.email <> '' AND u.email LIKE '%%@%%'
          AND COALESCE(u.status, 'active') = 'active'
          {filtro}
        ORDER BY u.id
    """, (CAMPAIGN,) if reanudar else ())
    filas = cur.fetchall()
    con.close()
    return filas


def registrar(email: str, estado: str, error: str | None = None, intentos: int = 3) -> bool:
    """Registra el envío, reconectando si Supabase cerró la conexión."""
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
    print(f"      ❌ no se pudo registrar {email}")
    return False


# ── Main ─────────────────────────────────────────────────────────────────────
async def main() -> None:
    ap = argparse.ArgumentParser(description="Correo de novedades de Bot DNI")
    ap.add_argument("--dry-run", action="store_true", help="Simulacro: no envía")
    ap.add_argument("--enviar", action="store_true", help="Envío real")
    ap.add_argument("--solo", metavar="EMAIL", help="Enviar solo a ese correo")
    ap.add_argument("--limite", type=int, default=0)
    ap.add_argument("--pausa", type=float, default=6.0, help="Segundos entre envíos")
    ap.add_argument("--reanudar", action="store_true", help="Saltar ya enviados")
    ap.add_argument("--yes", "-y", action="store_true", help="Sin confirmación")
    args = ap.parse_args()

    if not args.dry_run and not args.enviar and not args.solo:
        print("Indica un modo: --dry-run, --solo EMAIL o --enviar")
        sys.exit(1)

    if not SMTP_USER or not (os.getenv("SMTP_PASSWORD") or os.getenv("SMTP_PASS")):
        print("ERROR: faltan SMTP_USER / SMTP_PASS en .env")
        sys.exit(1)

    asegurar_tabla()
    if args.solo:
        lista = [(args.solo, "", 0, False)]
    else:
        lista = destinatarios(args.reanudar)
    if args.limite:
        lista = lista[: args.limite]

    total = len(lista)
    print(f"Destinatarios: {total}   campaña: {CAMPAIGN}")
    print(f"SMTP: {SMTP_USER} via {os.getenv('SMTP_HOST', 'smtp.gmail.com')}")
    print("-" * 62)

    if args.dry_run:
        for email, nombre, creditos, premium in lista[:15]:
            etiqueta = "premium" if premium else f"{creditos} créd."
            print(f"  {email:<42} {nombre[:26]:<26} {etiqueta}")
        if total > 15:
            print(f"  ... y {total - 15} más")
        print(f"\nSIMULACRO: se enviarían {total} correos. No se envió nada.")
        return

    if args.enviar and not args.yes:
        r = input(f"\n¿Enviar a {total} usuarios? Escribe ENVIAR para confirmar: ")
        if r.strip() != "ENVIAR":
            print("Cancelado.")
            return

    enviados = fallidos = 0
    for i, (email, nombre, creditos, premium) in enumerate(lista, 1):
        asunto, _, html = construir_correo(nombre, creditos, premium)
        try:
            await asyncio.to_thread(_send_email_sync, construir_msg(email, asunto, html))
            registrar(email, "ok")
            enviados += 1
            print(f"  [{i}/{total}] OK   {email}")
        except Exception as e:
            registrar(email, "error", str(e)[:500])
            fallidos += 1
            print(f"  [{i}/{total}] FAIL {email} -> {type(e).__name__}: {str(e)[:70]}")
        if i < total:
            await asyncio.sleep(args.pausa)

    print("-" * 62)
    print(f"Enviados: {enviados}   Fallidos: {fallidos}   Total: {total}")
    if fallidos:
        print("Revisa email_log y reintenta con --reanudar.")


if __name__ == "__main__":
    asyncio.run(main())
