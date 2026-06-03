import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApiUrl } from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const navigate = useNavigate();
    const initialToken = localStorage.getItem('token');

    const [user, setUser] = useState(null);
    const [token, setToken] = useState(initialToken);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [authLoading, setAuthLoading] = useState(Boolean(initialToken));

    // Modal state
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [authMode, setAuthMode] = useState('login');
    const [showWelcomeModal, setShowWelcomeModal] = useState(false);

    // Acción a ejecutar después de un login exitoso (gate de UX no-logueado).
    // Si hay pendingAction, login() NO navega: el usuario se queda donde estaba
    // y la acción solicitada se ejecuta automáticamente.
    const pendingActionRef = useRef(null);

    const logout = useCallback(() => {
        setUser(null);
        setIsLoggedIn(false);
        setToken(null);
        localStorage.removeItem('token');
        navigate('/');
    }, [navigate]);

    // On mount: validate stored token
    useEffect(() => {
        if (initialToken) {
            fetch(getApiUrl('/api/auth/me'), {
                headers: { 'Authorization': `Bearer ${initialToken}` }
            })
                .then(res => {
                    if (res.ok) return res.json();
                    throw new Error('Sesión inválida');
                })
                .then(userData => {
                    setUser(userData);
                    setToken(initialToken);
                    setIsLoggedIn(true);
                })
                .catch(() => {
                    logout();
                })
                .finally(() => setAuthLoading(false));
        }
    }, [initialToken, logout]);

    const openLoginModal = useCallback(() => {
        setAuthMode('login');
        setShowAuthModal(true);
        setShowWelcomeModal(false);
    }, []);

    const openRegisterModal = useCallback(() => {
        setAuthMode('register');
        setShowAuthModal(true);
        setShowWelcomeModal(false);
    }, []);

    /**
     * Gate de acción protegida. Si el usuario está logueado ejecuta `action`
     * inmediatamente. Si no, guarda la acción y abre el modal de login; la
     * acción se ejecuta automáticamente cuando el login completa.
     *
     * Devuelve true si la acción se ejecutó ya; false si quedó pendiente.
     */
    const requireAuth = useCallback((action) => {
        if (isLoggedIn) {
            if (typeof action === 'function') action();
            return true;
        }
        pendingActionRef.current = typeof action === 'function' ? action : null;
        openLoginModal();
        return false;
    }, [isLoggedIn, openLoginModal]);

    const login = async (userData, accessToken) => {
        localStorage.setItem('token', accessToken);
        setToken(accessToken);
        setShowAuthModal(false);
        setShowWelcomeModal(false);

        // Si hubo una acción pendiente, no navegamos automáticamente: el usuario
        // se queda en su página y la acción se reanuda. Admin siempre va a /admin.
        const hadPendingAction = pendingActionRef.current != null;

        const finalize = (resolvedUser) => {
            setUser(resolvedUser);
            setIsLoggedIn(true);
            if (resolvedUser.role === 'admin') {
                navigate('/admin');
            } else if (!hadPendingAction) {
                navigate('/');
            }
            if (pendingActionRef.current) {
                const action = pendingActionRef.current;
                pendingActionRef.current = null;
                // Diferimos para que el state ya esté sincronizado.
                setTimeout(action, 50);
            }
        };

        try {
            const res = await fetch(getApiUrl('/api/auth/me'), {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            if (res.ok) {
                finalize(await res.json());
            } else {
                finalize(userData);
            }
        } catch {
            finalize(userData);
        }
    };

    const refreshUser = () => {
        const storedToken = localStorage.getItem('token');
        if (!storedToken) return;
        fetch(getApiUrl('/api/auth/me'), {
            headers: { 'Authorization': `Bearer ${storedToken}` }
        })
            .then(r => r.json())
            .then(userData => setUser(userData))
            .catch(() => { });
    };

    return (
        <AuthContext.Provider value={{
            user, setUser, token, isLoggedIn, authLoading,
            showAuthModal, setShowAuthModal,
            authMode, setAuthMode,
            showWelcomeModal, setShowWelcomeModal,
            login, logout,
            openLoginModal, openRegisterModal,
            requireAuth,
            refreshUser,
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
    return ctx;
}
