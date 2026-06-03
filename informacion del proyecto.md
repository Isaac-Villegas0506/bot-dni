I'll examine the project structure to understand what you're working with.

Perfecto, he examinado tu proyecto **Bot DNI**. Aquí está el análisis completo:

## 📊 Resumen del Proyecto

**Bot DNI** es una aplicación web full-stack para consultas de información personal en Perú (DNI, RENIEC, datos policiales, etc.) con sistema de créditos y panel administrativo.

### 🏗️ Arquitectura

**Stack Tecnológico:**
- **Backend**: Python FastAPI + PostgreSQL (Supabase)
- **Frontend**: React 19 + Vite + TailwindCSS
- **Autenticación**: Firebase Auth + JWT
- **Bot Integration**: Telethon (Telegram bots)
- **Deployment**: Render.com (configurado)

### 📁 Estructura Principal

```
bot-dni/
├── backend/              # API FastAPI
│   ├── main.py          # Endpoints principales (1526 líneas)
│   ├── database.py      # Capa de datos PostgreSQL
│   ├── bot_client.py    # Cliente Telegram
│   ├── bot_pool.py      # Pool de bots
│   └── auth.py          # JWT + bcrypt
│
├── frontend/            # React SPA
│   ├── src/
│   │   ├── components/  # Componentes UI
│   │   │   ├── admin/   # Panel administrativo
│   │   │   └── ...      # Modales, búsqueda, etc.
│   │   ├── pages/       # Rutas principales
│   │   ├── context/     # AuthContext, LoadingContext
│   │   └── hooks/       # Custom hooks
│   └── dist/            # Build de producción
│
└── brain/               # (Directorio misterioso 🤔)
```

### ✨ Funcionalidades Principales

**Para Usuarios:**
1. **Búsquedas con créditos**:
   - DNI (RENIEC, C4, inscripción, biometría)
   - Familiares (árbol genealógico, PDF)
   - Teléfonos (operadora, titular)
   - Certificados policiales
   - Denuncias (DNI/placa)

2. **Sistema de Créditos**:
   - Compra de paquetes (5-130 créditos)
   - Planes ilimitados (1, 7, 20, 30 días)
   - Crédito diario gratis (5 créditos cada 24h si tienes 0)

3. **Autenticación**:
   - Email/Password con verificación OTP
   - Google OAuth (Firebase)
   - Protección anti-emails temporales

**Para Administradores:**
1. Dashboard con estadísticas
2. Gestión de usuarios (ban, premium, créditos)
3. Gestión de bots (pool dinámico)
4. Anuncios configurables
5. Precios ajustables por opción
6. Historial global de búsquedas
7. Solicitudes de compra de créditos
8. Ban de IPs

### 🔐 Seguridad

- JWT tokens para autenticación
- Bcrypt para passwords
- Cloudflare Turnstile (CAPTCHA)
- Blacklist de DNIs
- Ban de IPs por usuario
- Verificación de emails (anti-disposable)
- Rate limiting implícito (créditos)

### 🗄️ Base de Datos (PostgreSQL)

**Tablas principales:**
- `users` - Usuarios con créditos, premium, verificación
- `search_history` - Historial de búsquedas
- `credit_costs` - Precios configurables
- `credit_purchases` - Solicitudes de compra
- `credit_packages` - Planes disponibles
- `bots` - Pool de bots Telegram
- `announcements` - Anuncios del sistema
- `banned_ips` - IPs bloqueadas
- `personas` - Cache de consultas DNI

### 🚀 Deployment

**Configurado para Render.com:**
- Backend: Gunicorn + Uvicorn workers
- Frontend: Static site (Vite build)
- Database: PostgreSQL (Supabase via `DATABASE_URL`)

### 🎨 Frontend Highlights

- **React Router** para navegación
- **Framer Motion** para animaciones
- **Lucide React** para iconos
- **Sonner** para notificaciones toast
- **React PDF** para visualización de documentos
- **html2canvas + jsPDF** para generación de PDFs
- Tema oscuro/claro
- Responsive design (mobile-first)

### 🤖 Integración Telegram

- Pool de múltiples bots para balanceo
- Sistema de locks para evitar colisiones
- Parseo automático de respuestas
- Manejo de archivos (PDFs, imágenes)
- Limpieza automática de archivos a medianoche

### 📊 Características Avanzadas

1. **Sistema de créditos flexible**: Costos configurables por admin
2. **Acceso ilimitado temporal**: Planes de 1-30 días
3. **Crédito diario automático**: 5 créditos gratis cada 24h
4. **Generación de documentos**: C4, DNI virtual, árboles genealógicos
5. **Múltiples métodos de búsqueda**: DNI, nombre, teléfono, placa
6. **Historial persistente**: Por usuario y global

### ⚠️ Puntos de Atención

1. **Carpeta `brain/`**: Contiene un subdirectorio UUID, propósito no claro
2. **Sesiones Telegram**: Archivos `.session` en múltiples ubicaciones
3. **Firebase Admin**: Requiere `serviceAccountKey.json`
4. **Limpieza automática**: Borra archivos en `/static/files/` a medianoche
5. **Timezone**: Hardcoded a `America/Lima`

### 🔧 Configuración Requerida

**Variables de entorno críticas:**
- `DATABASE_URL` (PostgreSQL)
- `TELEGRAM_API_ID` / `TELEGRAM_API_HASH`
- `TARGET_BOT_USERNAME`
- `TURNSTILE_SECRET_KEY` (Cloudflare)
- Firebase credentials

---

¿Qué te gustaría hacer con el proyecto? ¿Necesitas ayuda con alguna funcionalidad específica, deployment, o mejoras?