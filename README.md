# 🚀 Bot DNI - Proyecto Unificado

## 📂 Estructura del Proyecto

```
bot-dni/
├── backend/           # API Python FastAPI
│   ├── main.py
│   ├── database.py
│   ├── setup_database.sql
│   └── ...
│
└── frontend/         # Interfaz React + Vite
    ├── src/
    │   ├── components/
    │   │   ├── admin/       # Panel de Administración
    │   │   ├── Sidebar.jsx  # Navegación Centralizada
    │   │   └── ...
    └── dist/
```

## ✨ Características (v2.0.2 Beta)
- **Búsqueda Pública**: DNI y Nombres.
- **Sistema de Usuarios**: Registro, Login, Historial.
- **Panel de Administración**:
    - Dashboard con estadísticas.
    - Gestión de Usuarios (Ban/Premium).
    - Gestión de Bots y Anuncios.
- **Interfaz**: Diseño moderno con Sidebar dinámico y Tema Oscuro.

---

## 🛠️ DESARROLLO LOCAL

### 1. Configurar Backend

```bash
cd backend
pip install -r requirements.txt
```

**Editar `.env`:**
```env
TELEGRAM_API_ID=tu_api_id
TELEGRAM_API_HASH=tu_api_hash
TARGET_BOT_USERNAME=@SectaData_Bot

MYSQL_HOST=localhost
MYSQL_USER=root
MYSQL_PASSWORD=
MYSQL_DB=bot_dni
```

**Iniciar backend:**
```bash
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 2. Configurar Frontend

```bash
cd frontend
npm install
npm run dev
```

Abre: `http://localhost:5173`

---

## 📦 PRODUCCIÓN

### 1. Build del frontend

```bash
cd frontend
npm run build
```

### 2. Estructura para deployment

Sube al hosting:
- Todo el contenido de `frontend/dist/` → raíz del dominio
- Toda la carpeta `backend/` → dentro del dominio
- Archivo `.htaccess` configurado
- Archivo `api.php` (proxy)

**Archivos críticos:**
- `backend/.env` (con credenciales del hosting)
- `.htaccess` (redirección)
- `api.php` (proxy PHP)

---

## ✅ CHECKLIST LOCAL

- [ ] Backend corriendo en puerto 8000
- [ ] Frontend dev en puerto 5173
- [ ] MySQL corriendo
- [ ] Telegram autenticado
- [ ] Búsqueda de DNI funciona

---

## 🌐 CHECKLIST PRODUCCIÓN

- [ ] Frontend compilado (`npm run build`)
- [ ] Backend con `.env` configurado
- [ ] MySQL del hosting creado
- [ ] Backend corriendo con `nohup`
- [ ] `.htaccess` y `api.php` en su lugar
- [ ] Sitio funcionando

---

**Hecho con ❤️ - v1.0**
