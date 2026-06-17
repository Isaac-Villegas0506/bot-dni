import { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { RequireAuth, RequireAdmin } from './router/ProtectedRoute';
import { getApiUrl } from './utils/api';
import { useNotifications } from './hooks/useNotifications';

// Layout
import Header from './components/Header';
import AuthModal from './components/AuthModal';
import WelcomeModal from './components/WelcomeModal';
import ModalLoading from './components/ModalLoading';
import { useLoading } from './context/LoadingContext';
import { createPortal } from 'react-dom';
import UserNotificationModal from './components/UserNotificationModal';
import MobileNav from './components/MobileNav';
import PromoModal from './components/PromoModal';
import { useSettings } from './context/SettingsContext';

import { Suspense, lazy } from 'react';

// Pages lazily loaded for Code Splitting
const Home = lazy(() => import('./pages/Home'));
const HistorialPage = lazy(() => import('./pages/Historial'));
const TiendaPage = lazy(() => import('./pages/Tienda'));
const GeneradorPage = lazy(() => import('./pages/Generador'));
const FamiliaresPage = lazy(() => import('./pages/Familiares'));
const TelefonoPage = lazy(() => import('./pages/Telefono'));
const PolicialesPage = lazy(() => import('./pages/Policiales'));
const DelitosPage = lazy(() => import('./components/Delitos'));
const FiscaliaPage = lazy(() => import('./components/Fiscalia'));
const VehiculosPage = lazy(() => import('./pages/Vehiculos'));
const AdminPage = lazy(() => import('./pages/Admin'));
const TermsPage = lazy(() => import('./pages/Terms'));
const FacialPage = lazy(() => import('./pages/Facial'));
const ReferidosPage = lazy(() => import('./pages/Referidos'));
import TermsModal from './components/TermsModal';

// --- PARCHE GLOBAL PARA FETCH ---
const originalFetch = window.fetch;
window.fetch = (...args) => {
    if (typeof args[0] === 'string' && args[0].startsWith('/api/')) {
        args[0] = getApiUrl(args[0]);
    }
    return originalFetch(...args);
};

// Mapa de vistas legacy → rutas reales (compatibilidad con Sidebar)
const VIEW_ROUTES = {
    home: '/', history: '/historial', shop: '/tienda',
    generator: '/generador', familiares: '/familiares',
    telefono: '/telefono', policiales: '/policiales', delitos: '/delitos', vehiculos: '/vehiculos', admin: '/admin',
    terms: '/terminos', facial: '/facial', creditos: '/creditos', fiscalia: '/fiscalia'
};

export default function App() {
    const navigate = useNavigate();
    const location = useLocation();

    const {
        isLoggedIn, user,
        showAuthModal, setShowAuthModal,
        authMode,
        showWelcomeModal, setShowWelcomeModal,
        login,
        openLoginModal, openRegisterModal,
    } = useAuth();

    const { loading, message, showDonation, closeDonation } = useLoading();
    const { notifications, markAsRead } = useNotifications();

    const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') !== 'light');

    const isAdminRoute = location.pathname === '/admin';
    const { isFeatureEnabled } = useSettings();
    const [showPromoModal, setShowPromoModal] = useState(false);

    // Dark mode effect
    useEffect(() => {
        document.documentElement.classList.toggle('dark', darkMode);
        localStorage.setItem('theme', darkMode ? 'dark' : 'light');
    }, [darkMode]);

    // Leer código de referido de la URL
    useEffect(() => {
        const queryParams = new URLSearchParams(location.search);
        const ref = queryParams.get('ref');
        if (ref) {
            localStorage.setItem('referralCode', ref);
        }
    }, [location.search]);

    // Lógica para mostrar la promoción (1 sol = 15 créditos)
    useEffect(() => {
        if (isLoggedIn && user && !user.has_bought_promo && isFeatureEnabled('promo_pack_active')) {
            const lastShownStr = localStorage.getItem('last_promo_shown_time');
            if (lastShownStr) {
                const lastShown = parseInt(lastShownStr, 10);
                const oneHour = 60 * 60 * 1000;
                if (Date.now() - lastShown < oneHour) {
                    return;
                }
            }
            setShowPromoModal(true);
            localStorage.setItem('last_promo_shown_time', Date.now().toString());
        } else {
            setShowPromoModal(false);
        }
    }, [isLoggedIn, user, isFeatureEnabled]);

    // Compatibilidad con Sidebar/Header que aún usan nombres de vista legacy
    const handleViewChange = (newView) => {
        if (newView === 'home') { navigate('/'); return; }
        navigate(VIEW_ROUTES[newView] || '/');
    };

    return (
        <div className={`
            min-h-[100dvh] flex flex-col transition-colors duration-300 relative overflow-hidden font-body
            bg-background-light dark:bg-background-dark text-text-main-light dark:text-text-main-dark
            ${isAdminRoute ? 'p-0 overflow-hidden h-[100dvh] items-stretch' : 'justify-start items-center py-6 lg:py-10 px-4 sm:px-8'}
        `}>

            {/* Background gradient */}
            {!isAdminRoute && (
                <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-blue-100/50 to-transparent dark:from-blue-900/10 dark:to-transparent pointer-events-none z-0" />
            )}

            {/* Header */}
            {!isAdminRoute && (
                <div className="w-full">
                    <Header
                        setView={handleViewChange}
                        darkMode={darkMode}
                        setDarkMode={setDarkMode}
                    />
                </div>
            )}

            {/* Main content */}
            <main className={`flex-grow flex flex-col w-full pb-20 md:pb-0 ${isAdminRoute ? 'w-full h-full' : 'items-center justify-start max-w-6xl'}`}>
                <Suspense fallback={<div className="flex items-center justify-center w-full h-64"><div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>}>
                    <Routes>
                        <Route path="/" element={<Home darkMode={darkMode} />} />
                        <Route path="/historial" element={<RequireAuth openModalOnFail={true}><HistorialPage /></RequireAuth>} />
                        <Route path="/tienda" element={<RequireAuth openModalOnFail={true}><TiendaPage /></RequireAuth>} />
                        <Route path="/generador" element={<GeneradorPage />} />
                        <Route path="/familiares" element={<FamiliaresPage />} />
                        <Route path="/telefono" element={<TelefonoPage />} />
                        <Route path="/policiales" element={<PolicialesPage />} />
                        <Route path="/delitos" element={<DelitosPage />} />
                        <Route path="/fiscalia" element={<FiscaliaPage />} />
                        <Route path="/vehiculos" element={<VehiculosPage />} />
                        <Route path="/admin" element={<RequireAdmin><AdminPage /></RequireAdmin>} />
                        <Route path="/terminos" element={<TermsPage />} />
                        <Route path="/facial" element={<FacialPage />} />
                        <Route path="/creditos" element={<RequireAuth openModalOnFail={true}><ReferidosPage /></RequireAuth>} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </Suspense>
            </main>

            {!isAdminRoute && <MobileNav />}

            {/* Global auth modals — visibles desde cualquier ruta */}
            <AuthModal
                isOpen={showAuthModal}
                onClose={() => setShowAuthModal(false)}
                initialMode={authMode}
                onLoginSuccess={login}
            />
            <WelcomeModal
                isOpen={!isLoggedIn && showWelcomeModal}
                onClose={() => setShowWelcomeModal(false)}
                onLogin={openLoginModal}
                onRegister={openRegisterModal}
            />
            <TermsModal />
            
            {/* User Notifications */}
            {showPromoModal && (
                <PromoModal onClose={() => setShowPromoModal(false)} />
            )}
            
            {notifications.length > 0 && (
                <UserNotificationModal 
                    notification={notifications[0]} 
                    onClose={markAsRead} 
                />
            )}

            {createPortal(
                <ModalLoading 
                    loading={loading} 
                    customMessage={message} 
                    showDonation={showDonation} 
                    onClose={closeDonation} 
                />,
                document.body
            )}
        </div>
    );
}
