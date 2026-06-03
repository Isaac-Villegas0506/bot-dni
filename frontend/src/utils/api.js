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
