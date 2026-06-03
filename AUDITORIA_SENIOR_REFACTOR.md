# Auditoría Senior & Plan Maestro de Refactorización

Fecha: 2026-05-23  
Proyecto: **bot-dni**  
Stack: React + Vite + Tailwind + FastAPI + PostgreSQL + Telethon

---

## 1) Resumen Ejecutivo

El sistema está funcional, pero **no está listo para escala productiva seria** sin una refactorización estructural.

Hallazgos principales:

1. **Backend monolítico** y altamente acoplado (`backend/main.py`, `backend/database.py`, `backend/bot_client.py` demasiado grandes).
2. **Riesgo de bloqueo de event loop**: FastAPI async + DB síncrona (`psycopg2`) con conexión compartida.
3. **Riesgos de seguridad**: CORS abierto, fallback inseguro de `SECRET_KEY`, fallback de auth Firebase sin verificación robusta.
4. **Riesgo de inestabilidad multiworker**: diseño de Telethon/BotPool en memoria no compatible con `gunicorn -w 4`.
5. **Frontend compila pero no cumple higiene técnica**: `npm run lint` falla con 80 errores.
6. **Rendimiento móvil mejorable de forma crítica**: bundles/chunks grandes y carga temprana de librerías pesadas.
7. **Accesibilidad y responsive** con brechas en modales, foco, labels, touch targets y semántica.

Conclusión: se requiere plan por etapas con prioridad en seguridad/estabilidad (P0), arquitectura y performance (P1), UX móvil y accesibilidad (P2), y optimización final (P3).

---

## 2) Auditoría Detallada (Problema / Gravedad / Impacto / Riesgo / Solución)

## A. Backend

### A.1 Arquitectura y mantenibilidad

- **Problema**: `backend/main.py` concentra rutas, auth, startup/shutdown, mantenimiento, créditos, compras, archivos y lógica de negocio.  
  - Evidencia: archivo de 1525 líneas con múltiples dominios mezclados.
- **Gravedad**: Alta.
- **Impacto**: baja mantenibilidad, pruebas difíciles, alta probabilidad de regresión.
- **Riesgo de ruptura**: Alto en cada cambio transversal.
- **Solución recomendada**:
  - Separar por capas:
    - `backend/api/routers/*`
    - `backend/services/*`
    - `backend/repositories/*`
    - `backend/core/*`
    - `backend/db/*`
    - `backend/models/*`
    - `backend/schemas/*`
  - Mantener `main.py` como ensamblador de app + include_router.

---

### A.2 Capa de datos

- **Problema**: `backend/database.py` (1456 líneas) combina conexión, DDL/migraciones runtime, repositorio de usuarios, créditos, admin, historial, compras y paquetes.
- **Gravedad**: Crítica.
- **Impacto**: acoplamiento extremo, transacciones frágiles, dificultad de escalar.
- **Riesgo**: Alto de degradación bajo concurrencia.
- **Solución**:
  - Migrar acceso DB a async real (`SQLAlchemy Async` + `asyncpg`) o `asyncpg` puro por repositorio.
  - Implementar pool de conexiones.
  - Separar migraciones a Alembic (fuera del runtime).
  - Dividir repositorios por dominio (`users`, `credits`, `search`, `admin`, `purchases`).

---

### A.3 Rendimiento/Concurrencia

- **Problema**: DB sync (`psycopg2`) en app async + conexión global (`self.conn`) compartida.
- **Gravedad**: Crítica.
- **Impacto**: bloqueo event loop, throughput bajo, latencia alta con múltiples requests.
- **Riesgo**: Alto bajo carga concurrente.
- **Solución**:
  - Migración incremental a async DB con pool.
  - Unit of work/transaction boundaries por caso de uso.
  - Reintentos y timeouts explícitos.

---

### A.4 Seguridad

- **Problema 1**: CORS permisivo (`allow_origins=["*"]` + credenciales). (`backend/main.py:45`).
- **Problema 2**: `SECRET_KEY` con fallback hardcodeado (`backend/auth.py:6`).
- **Problema 3**: fallback Firebase de token sin verificación robusta (flujo de `firebase_login`).
- **Problema 4**: bypass de CAPTCHA si variable no configurada (`verify_turnstile`).
- **Gravedad**: Crítica.
- **Impacto**: superficie de ataque alta.
- **Riesgo**: Alto (secuestro sesión, abuso endpoints, fraude).
- **Solución**:
  - Configuración estricta por entorno con Pydantic Settings.
  - CORS por whitelist.
  - Obligatoriedad de `SECRET_KEY` y rotación.
  - Eliminar rutas/fallbacks inseguros en producción.
  - Política de rate-limit per IP/usuario/endpoints sensibles.

---

### A.5 Telethon/Bots y multiworker

- **Problema**: locks de `BotPool` en memoria por proceso + `gunicorn -w 4` en `render.yaml`.
- **Gravedad**: Crítica.
- **Impacto**: colisiones de sesiones Telegram, errores intermitentes, comportamientos no determinísticos.
- **Riesgo**: Muy alto en producción.
- **Solución**:
  - Fase inmediata: forzar `workers=1` para estabilidad.
  - Fase estructural:
    - Cola de trabajos (RQ/Celery/Arq) o broker ligero.
    - lock distribuido (Redis) por bot/cuenta.
    - worker dedicado para consultas Telegram.

---

### A.6 Calidad de código / errores

- Duplicidad de `except` y bloques repetidos en `main.py`.
- `except` genéricos que silencian errores (`except: pass`).
- estado global mutable (`MAINTENANCE_MODE`) no resiliente multiinstancia.
- validaciones repetidas manualmente en muchos endpoints.

**Gravedad**: Alta.  
**Solución**: manejo de errores centralizado, schemas de request/response, middleware/depends reutilizable.

---

## B. Frontend

### B.1 Estado de calidad actual

- `npm run lint` => **89 problemas** (80 errores, 9 warnings).
- `npm run build` => compila, pero con warning de chunks > 500 kB.

**Lectura técnica**: la app funciona, pero está en deuda técnica alta para producción mantenible.

---

### B.2 Arquitectura frontend

- **Problema**: componentes gigantes y mezcla de UI + lógica + IO.
  - `TelefonoDNI.jsx` extremadamente grande y compleja.
  - `ResultCard.jsx` mezcla render, parsing y generación PDF.
  - `AuthContext.jsx` concentra auth, navegación y modal orchestration.
- **Gravedad**: Alta.
- **Impacto**: difícil depuración, regresiones frecuentes.
- **Solución**:
  - separar servicios API, hooks de dominio y componentes presentacionales.
  - desacoplar lógica pesada de UI.

---

### B.3 Performance móvil y bundles

- Chunks grandes:
  - `index-CxYRzlNV.js` ~613 kB min.
  - `Home-d8V0I0Xt.js` ~441 kB min.
  - `PdfViewer-gOrpQ2mL.js` ~426 kB min.
- Librerías pesadas (`jspdf`, `html2canvas`, `react-pdf`, `html-to-image`) cargadas en rutas/componentes con alto impacto.

**Gravedad**: Alta.  
**Impacto**: TTI/LCP peor en móvil, consumo de RAM y CPU mayor.

**Solución**:
- Lazy import bajo demanda de herramientas PDF/canvas.
- `manualChunks` en Vite por dominios (`pdf`, `vendor-react`, `firebase`, `motion`).
- reducir JS inicial en Home y zonas no críticas.

---

### B.4 Accesibilidad y responsive

- Modales sin contrato completo de accesibilidad (`role="dialog"`, `aria-modal`, focus trap/restore).
- Inputs sin labels semánticos en múltiples puntos.
- `autoFocus` agresivo en móvil.
- touch targets < 44px en algunos botones.
- uso extenso de `transition-all`.

**Gravedad**: Alta (WCAG/UX).  
**Impacto**: navegación teclado/lectores comprometida y fricción en Android/iOS.

**Solución**:
- sistema de modal accesible reutilizable.
- estándar de inputs (label + name + autocomplete + aria).
- política móvil para autofocus.
- tokens/utility para tamaños táctiles mínimos.

---

### B.5 Hallazgos funcionales relevantes

- `AuthContext.jsx`: referencia de `logout` antes de su declaración (lint).
- `ResultCard.jsx`: mutación de objeto derivado de props.
- `TelefonoDNI.jsx`: referencia(s) a función no definida en algunos paths (`handleCopy`) según lint.
- uso de `process` en frontend (`ErrorBoundary`) incompatible con Vite sin adaptación.

**Gravedad**: Alta.  
**Impacto**: bugs potenciales en runtime y fragilidad de build quality gate.

---

## C. Configuración, Build y Deploy

- `frontend/vite.config.js`: proxy local en `8001` mientras README sugiere `8000`.
- `render.yaml`: 4 workers potencialmente incompatibles con diseño Telegram actual.
- `.eslintignore` deprecado con ESLint moderno.

**Gravedad**: Media/Alta según entorno.  
**Solución**: alinear puertos, endurecer pipeline, usar config ESLint actual.

---

## 3) Matriz de Prioridad (justificación)

## P0 — Crítico (seguridad/estabilidad producción)

1. Endurecimiento de configuración (`SECRET_KEY`, CORS, fallback auth, CAPTCHA en prod).
2. Estabilidad operativa de Telegram/multiworker (evitar colisiones ya).
3. Correcciones de errores funcionales/lint críticos que pueden romper flujo principal.

**Justificación**: protege datos y reduce incidentes productivos inmediatos.

---

## P1 — Alto (arquitectura + rendimiento base)

1. Reorganización backend por capas y extracción progresiva desde `main.py`.
2. Inicio migración DB a async con pool y repositorios.
3. Limpieza técnica frontend a `lint=0`.
4. Reducción de JS inicial mediante lazy + manualChunks.

**Justificación**: reduce deuda estructural y prepara escalabilidad real.

---

## P2 — Medio (responsive móvil + accesibilidad)

1. Sistema de modales accesible reutilizable.
2. Normalización de formularios y foco.
3. Touch targets, safe area, scroll/overlay behavior, tablas móviles.

**Justificación**: mejora UX real en móvil y cumplimiento de buenas prácticas.

---

## P3 — Mejoras (polish + hardening final)

1. Optimización fina de animaciones y `prefers-reduced-motion`.
2. Refinamiento de microinteracciones y estado de carga.
3. Métricas y observabilidad básica (logs estructurados, tiempos de endpoint).

**Justificación**: eleva calidad final sin desplazar prioridades críticas.

---

## 4) Plan de Ejecución Propuesto (sin hacks, incremental, controlado)

### Etapa P0 (primera implementación)

- Backend:
  - `core/settings.py` con validaciones de entorno.
  - CORS whitelist por env.
  - eliminar fallback inseguro de `SECRET_KEY`.
  - proteger rutas de desarrollo (`/api/auth/dev-login`) detrás de flag.
  - ajustar worker strategy temporal para Telegram (1 worker mientras se rediseña colas/locks).
- Frontend:
  - corregir errores de lint críticos que afectan funcionamiento.
  - resolver referencias inválidas y mutaciones de props.

**Validación**: `npm run lint`, `npm run build`, smoke de login/búsqueda/admin.

---

### Etapa P1

- Backend modular:
  - crear estructura `api/services/repositories/core/db/models/schemas`.
  - mover endpoints admin, auth, search por router.
  - extraer servicios de crédito/búsqueda/bots.
- DB:
  - introducir capa repositorio async (primeros módulos: auth/users/search_history).
- Frontend:
  - refactor inicial de `AuthContext`, `ResultCard`, `TelefonoDNI` en piezas.
  - lazy load real de módulos PDF/canvas.
  - `manualChunks` en Vite.

**Validación**: lint/build + pruebas de flujo crítico.

---

### Etapa P2

- Diseño responsive/a11y:
  - modal base accesible reutilizable.
  - inputs con labels y semántica consistente.
  - eliminación de autofocus móvil no esencial.
  - botones táctiles mínimos 44x44.
  - reducir `transition-all`.

**Validación**: checklist WCAG base + test manual móvil.

---

### Etapa P3

- Ajustes finos de UX/perf.
- hardening final, documentación de arquitectura y guía de contribución.

---

## 5) Riesgos de ruptura y mitigación

1. **Riesgo**: romper endpoints consumidos por frontend.
   - Mitigación: conservar contratos de API durante P0/P1; deprecación gradual.
2. **Riesgo**: regresión en consultas Telegram.
   - Mitigación: migración por feature flags + smoke tests por endpoint.
3. **Riesgo**: cambios masivos en frontend.
   - Mitigación: refactor por componentes críticos, no big-bang.
4. **Riesgo**: migración DB incompleta.
   - Mitigación: estrategia híbrida temporal con cobertura por módulo.

---

## 6) Criterios de éxito por fase

- P0:
  - seguridad base endurecida
  - estabilidad operativa Telegram/worker controlada
  - build/lint sin errores críticos funcionales
- P1:
  - backend modular en rutas principales
  - capa DB async/pool iniciada en producción
  - reducción tangible de bundle inicial
- P2:
  - modales accesibles y UX móvil estable
  - mejora de formularios/foco/touch targets
- P3:
  - observabilidad y performance polish

---

## 7) Próximo paso inmediato

Iniciar **Ejecución P0** con cambios mínimos de alto impacto y bajo riesgo, validando en cada subpaso con lint/build y pruebas de humo.
