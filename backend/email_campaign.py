"""
Envío masivo de correos desde el servidor, reanudable.

Diseño: el trabajo avanza en tandas cortas (BATCH_SIZE correos) dentro de una
tarea de fondo. Si Render reinicia el proceso (deploy, suspensión del plan
free), la tabla `email_log` marca lo ya enviado y la siguiente llamada a
`reanudar()` continúa donde quedó, sin repetir a nadie.

Endpoints (en main.py):
    POST /api/admin/email/campaign/start   -> arranca o reanuda
    GET  /api/admin/email/campaign/status  -> progreso
    POST /api/admin/email/campaign/stop    -> detiene (lo enviado queda)
"""
from __future__ import annotations

import asyncio
import os
from datetime import datetime

import psycopg2
from dotenv import load_dotenv

from email_utils import _send_email_sync
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.header import Header

load_dotenv()

APP_URL = os.getenv("APP_URL", "https://bot-dni.vercel.app")
CAMPAIGN = "reactivacion_2026_11"

SMTP_USER = os.getenv("SMTP_USER") or ""

# Estado en memoria del proceso actual (se pierde al reiniciar: por eso
# email_log es la fuente de verdad de lo enviado).
_estado = {
    "corriendo": False,
    "enviados": 0,
    "fallidos": 0,
    "total": 0,
    "ultimo": None,
    "iniciado": None,
    "terminado": False,
}
_lock = asyncio.Lock()


# ── Plantilla ────────────────────────────────────────────────────────────────
def construir_correo(nombre: str, creditos: int, es_premium: bool) -> tuple[str, str]:
    """Devuelve (asunto, html) personalizado para el usuario."""
    nombre = (nombre or "").strip()
    primer_nombre = nombre.split()[0].capitalize() if nombre else ""
    titular_hero = f"{primer_nombre}, volvimos a estar en línea" if primer_nombre \
        else "Volvimos a estar en línea"

    if es_premium:
        saldo_titulo = "Sigues siendo Premium"
        saldo_detalle = "Tu acceso Premium está intacto. No pagaste de más ni perdiste nada."
        saldo_num = "∞"
        saldo_label = "ACCESO PREMIUM"
        saldo_color = "#059669"
        saldo_bg = "#ecfdf5"
        saldo_borde = "#a7f3d0"
        subject = f"Volvimos 🚀 {primer_nombre}, tu Premium sigue activo" if primer_nombre \
            else "Volvimos 🚀 tu Premium sigue activo"
        preheader = "Volvimos. Tu acceso Premium sigue intacto y las consultas ya funcionan."
    elif creditos > 0:
        saldo_titulo = "Tus créditos te están esperando"
        saldo_detalle = "No caducaron. Siguen ahí, listos para usar."
        saldo_num = str(creditos)
        saldo_label = "CRÉDITOS DISPONIBLES"
        saldo_color = "#2563eb"
        saldo_bg = "#eff6ff"
        saldo_borde = "#bfdbfe"
        subject = f"Volvimos 🚀 {primer_nombre}, tus {creditos} créditos siguen intactos" if primer_nombre \
            else f"Volvimos 🚀 tus {creditos} créditos siguen intactos"
        preheader = f"Volvimos. Tus {creditos} créditos siguen ahi y las consultas ya funcionan."
    else:
        saldo_titulo = "Tu cuenta sigue activa"
        saldo_detalle = "Entra con el mismo correo de Google, sin registrarte otra vez."
        saldo_num = "✓"
        saldo_label = "CUENTA VERIFICADA"
        saldo_color = "#0f766e"
        saldo_bg = "#f0fdfa"
        saldo_borde = "#99f6e4"
        subject = f"Volvimos 🚀 {primer_nombre}, tu cuenta te espera" if primer_nombre \
            else "Volvimos 🚀 tu cuenta te espera"
        preheader = "Volvimos. Tu cuenta sigue activa y las consultas ya funcionan otra vez."

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
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">{preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 6px 24px rgba(15,23,42,0.08);border:1px solid #e2e8f0;">
        <tr><td style="background:#2563eb;padding:16px 32px;">
          <table role="presentation" width="100%"><tr>
            <td style="font-size:16px;font-weight:800;color:#ffffff;letter-spacing:-0.2px;">Bot DNI</td>
            <td align="right" style="font-size:11px;font-weight:700;color:#bfdbfe;letter-spacing:0.8px;">PLATAFORMA ACTIVA</td>
          </tr></table>
        </td></tr>
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
        <tr><td style="padding:22px 32px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{saldo_bg};border:1px solid {saldo_borde};border-radius:14px;">
            <tr><td style="padding:20px 22px;">
              <div style="font-size:10px;font-weight:800;letter-spacing:1.1px;color:{saldo_color};margin-bottom:4px;">{saldo_label}</div>
              <div style="font-size:34px;line-height:1;font-weight:800;color:{saldo_color};letter-spacing:-1px;">{saldo_num}</div>
              <div style="margin-top:14px;padding-top:14px;border-top:1px solid {saldo_borde};">
                <div style="font-size:14px;font-weight:700;color:#0f172a;">{saldo_titulo}</div>
                <div style="margin-top:3px;font-size:13px;line-height:1.55;color:#475569;">{saldo_detalle}</div>
              </div>
            </td></tr>
          </table>
        </td></tr>
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
        <tr><td style="padding:24px 32px 0;">
          <div style="font-size:11px;font-weight:800;letter-spacing:1.1px;color:#94a3b8;margin-bottom:6px;">YA DISPONIBLE</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">{filas_funciones}</table>
        </td></tr>
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
    return subject, html


def construir_msg(email: str, subject: str, html: str) -> MIMEMultipart:
    msg = MIMEMultipart()
    msg["From"] = f"Bot DNI <{SMTP_USER}>"
    msg["To"] = email
    msg["Subject"] = Header(subject, "utf-8")
    msg.attach(MIMEText(html, "html", "utf-8"))
    return msg


# ── Base de datos ────────────────────────────────────────────────────────────
def _conectar():
    return psycopg2.connect(os.getenv("DATABASE_URL"))


def asegurar_tabla(con) -> None:
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


def contar(con) -> dict:
    """Progreso global de la campaña."""
    cur = con.cursor()
    cur.execute("SELECT estado, COUNT(*) FROM email_log WHERE campaign=%s GROUP BY estado", (CAMPAIGN,))
    por_estado = dict(cur.fetchall())
    cur.execute("""
        SELECT COUNT(*) FROM users
        WHERE email IS NOT NULL AND email <> '' AND email LIKE '%%@%%'
          AND COALESCE(status,'active') = 'active'
    """)
    total = cur.fetchone()[0]
    ok = por_estado.get("ok", 0)
    err = por_estado.get("error", 0)
    return {
        "total": total,
        "enviados": ok,
        "fallidos": err,
        "pendientes": max(total - ok - err, 0),
        "porcentaje": round(100 * (ok + err) / total, 1) if total else 0.0,
    }


def _pendientes(con, limite: int) -> list[tuple[str, str, int, bool]]:
    """Siguientes destinatarios que aún no tienen registro 'ok'."""
    cur = con.cursor()
    cur.execute("""
        SELECT u.email,
               COALESCE(NULLIF(TRIM(u.full_name),''), '') AS nombre,
               COALESCE(u.credits, 0) AS creditos,
               COALESCE(u.is_premium, false) AS es_premium
        FROM users u
        WHERE u.email IS NOT NULL AND u.email <> '' AND u.email LIKE '%%@%%'
          AND COALESCE(u.status,'active') = 'active'
          AND NOT EXISTS (
              SELECT 1 FROM email_log l
              WHERE l.email = u.email AND l.campaign = %s AND l.estado = 'ok'
          )
        ORDER BY u.id
        LIMIT %s
    """, (CAMPAIGN, limite))
    return cur.fetchall()


def _registrar(con, email: str, estado: str, error: str | None = None) -> None:
    cur = con.cursor()
    cur.execute("""
        INSERT INTO email_log (email, campaign, estado, error)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (email, campaign) DO UPDATE
        SET estado = EXCLUDED.estado, error = EXCLUDED.error, enviado_at = NOW()
    """, (email, CAMPAIGN, estado, error))
    con.commit()


# ── Motor del envío ──────────────────────────────────────────────────────────
BATCH_SIZE = 50      # correos por tanda antes de soltar el proceso
PAUSA = 5.0          # segundos entre correos (ritmo aceptado por Gmail)


async def _bucle_envio() -> None:
    """Envía en tandas hasta terminar o hasta que se pida parar."""
    global _estado
    con = _conectar()
    asegurar_tabla(con)
    _estado["iniciado"] = datetime.utcnow().isoformat()
    _estado["terminado"] = False

    try:
        while _estado["corriendo"]:
            lote = _pendientes(con, BATCH_SIZE)
            if not lote:
                break

            for email, nombre, creditos, premium in lote:
                if not _estado["corriendo"]:
                    break
                subject, html = construir_correo(nombre, creditos, premium)
                msg = construir_msg(email, subject, html)
                try:
                    await asyncio.to_thread(_send_email_sync, msg)
                    _registrar(con, email, "ok")
                    _estado["enviados"] += 1
                    _estado["ultimo"] = email
                except Exception as e:
                    _registrar(con, email, "error", str(e)[:500])
                    _estado["fallidos"] += 1
                await asyncio.sleep(PAUSA)

            progreso = contar(con)
            _estado["total"] = progreso["total"]
    finally:
        try:
            con.close()
        except Exception:
            pass
        _estado["corriendo"] = False
        _estado["terminado"] = True


async def iniciar() -> dict:
    """Arranca (o reanuda) el envío. Idempotente: si ya corre, no duplica."""
    async with _lock:
        if _estado["corriendo"]:
            return {"ok": False, "mensaje": "Ya hay un envío en curso", **_estado}

        con = _conectar()
        asegurar_tabla(con)
        progreso = contar(con)
        con.close()

        if progreso["pendientes"] == 0:
            return {"ok": False, "mensaje": "No quedan destinatarios pendientes", **progreso}

        _estado.update({
            "corriendo": True,
            "terminado": False,
            "enviados": 0,
            "fallidos": 0,
            "total": progreso["total"],
            "ultimo": None,
        })
        asyncio.create_task(_bucle_envio())
        return {"ok": True, "mensaje": f"Envío iniciado: {progreso['pendientes']} pendientes", **progreso}


async def detener() -> dict:
    _estado["corriendo"] = False
    return {"ok": True, "mensaje": "Detención solicitada; lo enviado queda registrado", **_estado}


def estado_actual() -> dict:
    try:
        con = _conectar()
        asegurar_tabla(con)
        progreso = contar(con)
        con.close()
    except Exception as e:
        return {**_estado, "error": str(e)}
    return {**progreso, "corriendo": _estado["corriendo"], "ultimo": _estado["ultimo"]}
