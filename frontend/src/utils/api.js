import axios from 'axios';

// Detectar si estamos en local o producción
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// En local usamos rutas relativas para que el proxy de Vite funcione
// En producción usamos la URL de Render
export const API_URL = isLocal ? '' : (import.meta.env.VITE_API_URL || 'https://bot-dni-backend.onrender.com');

// Configuración global de Axios
axios.defaults.baseURL = API_URL;

// Interceptor global para inyectar el token en todas las peticiones
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});
export const getApiUrl = (path) => {
  if (typeof path !== 'string') return path;
  if (path.startsWith('http')) return path;

  let cleanPath = path.startsWith('/') ? path : `/${path}`;

  // Soporte para rutas viejas en la DB (ej: "images/123.jpg" -> "/api/static/images/123.jpg")
  if (!cleanPath.startsWith('/api/')) {
    cleanPath = `/api/static${cleanPath}`;
  }

  return `${API_URL}${cleanPath}`;
};

// Tiempos máximos por tipo de consulta (el backend espera al bot de Telegram
// de forma síncrona; sin este límite un fetch colgado deja el modal para siempre).
export const QUERY_TIMEOUTS = {
  reniec: 90_000,
  generador: 120_000,
  fiscalia: 240_000,
  delitos: 120_000,
  policiales: 90_000,
  judiciales: 90_000,
  penales: 90_000,
  vehiculos: 90_000,
  telefonos: 90_000,
  familiares: 150_000,
  metadata: 90_000,
  facial: 120_000,
  default: 90_000,
};

export async function queryFetch(url, options = {}, { timeoutMs = QUERY_TIMEOUTS.default, registerAbort } = {}) {
  const controller = new AbortController();
  registerAbort?.(controller);
  const timer = setTimeout(() => controller.abort(new DOMException('timeout', 'TimeoutError')), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export function getQueryErrorMessage(e) {
  if (e?.name === 'TimeoutError') return 'La consulta tardó demasiado en responder. Intenta nuevamente.';
  if (e?.name === 'AbortError') return 'Consulta cancelada.';
  return e?.message || 'Error en la consulta';
}
