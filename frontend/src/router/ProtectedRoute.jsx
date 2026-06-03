import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// ─── Spinner mientras se verifica la sesión ──────────────────────────────────
function AuthLoadingSpinner() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark">
            <div className="flex flex-col items-center gap-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
                    Verificando sesión...
                </p>
            </div>
        </div>
    );
}

// ─── Requiere login ───────────────────────────────────────────────────────────
// Si el usuario no está autenticado → redirige a /
// Si authLoading → muestra spinner (evita redirect falso en recarga de página)
// Si openModalOnFail → abre el modal de login antes de redirigir
export function RequireAuth({ children, openModalOnFail = false }) {
    const { isLoggedIn, authLoading, openLoginModal } = useAuth();

    if (authLoading) return <AuthLoadingSpinner />;

    if (!isLoggedIn) {
        if (openModalOnFail) openLoginModal();
        return <Navigate to="/" replace />;
    }

    return children;
}

// ─── Requiere rol admin ───────────────────────────────────────────────────────
// Si el usuario no es admin → redirige a /
// Si authLoading → muestra spinner (evita redirect falso en recarga de página)
export function RequireAdmin({ children }) {
    const { user, authLoading } = useAuth();

    if (authLoading) return <AuthLoadingSpinner />;

    if (!user || user.role !== 'admin') {
        return <Navigate to="/" replace />;
    }

    return children;
}
