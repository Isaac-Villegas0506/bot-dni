import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/settingsContextValue';
import { toast } from 'sonner';

// ─── Compact Countdown Timer ───────────────────────────────────────────────────
const CompactCountdown = ({ lastSearch }) => {
    const [timeLeft, setTimeLeft] = useState(null);

    useEffect(() => {
        if (!lastSearch) {
            const resetTimer = setTimeout(() => setTimeLeft(null), 0);
            return () => clearTimeout(resetTimer);
        }

        const calculate = () => {
            try {
                const safeStr = typeof lastSearch === 'string' ? lastSearch.replace(' ', 'T') : lastSearch;
                const lastDate = new Date(safeStr);
                if (isNaN(lastDate.getTime())) { setTimeLeft(null); return; }

                const diff = new Date(lastDate.getTime() + 24 * 60 * 60 * 1000) - new Date();
                if (diff > 0) {
                    const h = Math.floor(diff / 3600000).toString().padStart(2, '0');
                    const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
                    const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
                    setTimeLeft(`${h}:${m}:${s}`);
                } else {
                    setTimeLeft(null);
                }
            } catch { setTimeLeft(null); }
        };

        calculate();
        const timer = setInterval(calculate, 1000);
        return () => clearInterval(timer);
    }, [lastSearch]);

    if (!timeLeft) return <span className="text-emerald-600 dark:text-emerald-400">Disponible</span>;
    return (
        <span className="text-red-500 dark:text-red-400 font-mono tracking-tighter">{timeLeft}</span>
    );
};

export default function MobileNav() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, openLoginModal, openRegisterModal } = useAuth();
    const { isFeatureEnabled } = useSettings();
    const [showMobileMenu, setShowMobileMenu] = useState(false);

    const path = location.pathname;

    const bottomTabs = [
        { id: '/', icon: 'home', label: 'Inicio', requireAuth: false },
        { id: '/historial', icon: 'history', label: 'Historial', requireAuth: true },
        { id: '/tienda', icon: 'shopping_cart', label: 'Créditos', requireAuth: true },
        { id: 'menu', icon: 'menu', label: 'Menú', requireAuth: false }
    ];

    const menuItems = [
        { id: '/facial', icon: 'face', label: 'Búsqueda Facial', featureKey: 'feature_facial', isNew: true },
        { id: '/generador', icon: 'badge', label: 'Generador Reniec', featureKey: 'feature_generador' },
        { id: '/familiares', icon: 'family_restroom', label: 'Familiares', featureKey: 'feature_familiares' },
        { id: '/telefono', icon: 'phone_android', label: 'Teléfonos', featureKey: 'feature_telefono' },
        { id: '/delitos', icon: 'gavel', label: 'Delitos', featureKey: 'feature_delitos', isNew: true },
        { id: '/fiscalia', icon: 'balance', label: 'Fiscalía', featureKey: 'feature_fiscalia', isNew: true },
        { id: '/policiales', icon: 'policy', label: 'Certificados Policiales', featureKey: 'feature_policiales' },
        { id: '/vehiculos', icon: 'directions_car', label: 'Vehículos', featureKey: 'feature_vehiculos', isNew: true }
    ];

    const handleTabClick = (id, requireAuth) => {
        if (id === 'menu') {
            setShowMobileMenu(true);
            return;
        }
        if (requireAuth && !user) {
            openLoginModal();
            return;
        }
        setShowMobileMenu(false);
        navigate(id);
    };

    const handleMenuClick = (targetPath, featureKey) => {
        if (featureKey && !isFeatureEnabled(featureKey)) {
            toast.info('Esta función está en mantenimiento o deshabilitada temporalmente.');
            return;
        }
        setShowMobileMenu(false);
        navigate(targetPath);
    };

    return (
        <>
            {/* ── Apple-Style Mobile Bottom Tab Bar ──────────── */}
            <nav
                role="tablist"
                aria-label="Navegación principal"
                className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t border-slate-200/50 dark:border-slate-800/50 z-30 pb-[env(safe-area-inset-bottom)] px-2"
            >
                <div className="flex justify-between items-center h-16 max-w-sm mx-auto">
                    {bottomTabs.map(({ id, icon, label, requireAuth }) => {
                        const isActive = id === 'menu' ? showMobileMenu : path === id;
                        return (
                            <button
                                key={id}
                                onClick={() => handleTabClick(id, requireAuth)}
                                className={`flex-1 flex flex-col items-center justify-center gap-1 h-full transition-colors ${isActive ? 'text-blue-600 dark:text-blue-500' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
                            >
                                <span className={`material-icons-round text-2xl transition-transform ${isActive ? 'scale-110' : ''}`}>
                                    {icon}
                                </span>
                                <span className="text-[10px] font-medium leading-none">{label}</span>
                            </button>
                        );
                    })}
                </div>
            </nav>

            {/* ── Mobile Menu Bottom Sheet ──────────── */}
            <AnimatePresence>
                {showMobileMenu && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowMobileMenu(false)}
                            className="md:hidden fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm"
                            style={{ willChange: 'opacity' }}
                        />
                        {/* Sheet */}
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl pb-[env(safe-area-inset-bottom)] h-[90dvh] flex flex-col"
                            style={{ willChange: 'transform' }}
                        >
                            <div className="flex justify-center pt-4 pb-2 shrink-0">
                                <div className="w-16 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full" />
                            </div>
                            <div className="px-5 pb-4 shrink-0 flex justify-between items-center border-b border-slate-100 dark:border-slate-800 mb-2">
                                {user ? (
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-lg shrink-0 overflow-hidden">
                                            {user.avatar_url ? (
                                                <img src={user.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                                            ) : (
                                                user.full_name?.charAt(0).toUpperCase() || 'U'
                                            )}
                                        </div>
                                        <div className="min-w-0 flex flex-col justify-center">
                                            <p className="font-bold text-slate-900 dark:text-white text-[15px] truncate max-w-[200px] leading-tight">{user.full_name}</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[200px] leading-tight mt-0.5">{user.email}</p>
                                            <div className="mt-1.5 flex items-center gap-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-md w-fit">
                                                <span className="material-icons-round text-[12px]">monetization_on</span>
                                                {user.is_premium
                                                    ? 'Premium'
                                                    : user.credits > 0
                                                        ? `${user.credits} crédito${user.credits !== 1 ? 's' : ''}`
                                                        : <CompactCountdown lastSearch={user.last_premium_search} />
                                                }
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex min-w-0 flex-1 flex-col gap-3 pr-3">
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Menú principal</h3>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">Ingresa para ver historial, créditos y compras.</p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setShowMobileMenu(false);
                                                    openLoginModal();
                                                }}
                                                className="min-h-[44px] rounded-lg bg-blue-600 px-3 text-sm font-bold text-white transition-colors hover:bg-blue-700"
                                            >
                                                Ingresar
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setShowMobileMenu(false);
                                                    openRegisterModal();
                                                }}
                                                className="min-h-[44px] rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                                            >
                                                Crear cuenta
                                            </button>
                                        </div>
                                    </div>
                                )}
                                <button onClick={() => setShowMobileMenu(false)} className="w-10 h-10 flex items-center justify-center shrink-0 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors" aria-label="Cerrar menu">
                                    <span className="material-icons-round text-xl">close</span>
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto px-4 pb-8 space-y-4 custom-scrollbar">
                                {user && (
                                    <div className="mt-2">
                                        <p className="px-2 mb-2 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Mi Cuenta</p>
                                        <div className="grid grid-cols-3 gap-2">
                                            <button onClick={() => { setShowMobileMenu(false); navigate('/tienda'); }} className="flex flex-col items-center justify-center gap-2 p-3 rounded-2xl bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100/50 dark:border-blue-800/30 text-slate-700 dark:text-slate-300 active:scale-95 transition-transform">
                                                <span className="material-icons-round text-blue-500 text-2xl">shopping_cart</span>
                                                <span className="text-[11px] font-bold">Créditos</span>
                                            </button>
                                            <button onClick={() => { setShowMobileMenu(false); navigate('/historial'); }} className="flex flex-col items-center justify-center gap-2 p-3 rounded-2xl bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100/50 dark:border-emerald-800/30 text-slate-700 dark:text-slate-300 active:scale-95 transition-transform">
                                                <span className="material-icons-round text-emerald-500 text-2xl">history</span>
                                                <span className="text-[11px] font-bold">Historial</span>
                                            </button>
                                            <button onClick={() => { setShowMobileMenu(false); navigate('/creditos'); }} className="flex flex-col items-center justify-center gap-2 p-3 rounded-2xl bg-purple-50/50 dark:bg-purple-900/10 border border-purple-100/50 dark:border-purple-800/30 text-slate-700 dark:text-slate-300 active:scale-95 transition-transform">
                                                <span className="material-icons-round text-purple-500 text-2xl">group_add</span>
                                                <span className="text-[11px] font-bold">Referidos</span>
                                            </button>
                                        </div>
                                    </div>
                                )}
                                
                                <div>
                                    <p className="px-2 mb-2 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Servicios</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {menuItems.map(item => (
                                            <button
                                                key={item.id}
                                                onClick={() => handleMenuClick(item.id, item.featureKey)}
                                                className={`flex flex-col items-start gap-2 p-3.5 rounded-2xl border transition-all ${path === item.id ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : 'bg-slate-50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800/60 active:scale-95'}`}
                                            >
                                                <div className="flex justify-between items-start w-full">
                                                    <span className={`material-icons-round text-[22px] ${path === item.id ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'}`}>
                                                        {item.icon}
                                                    </span>
                                                    {item.isNew && (
                                                        <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-yellow-400 text-yellow-900 font-black">NUEVO</span>
                                                    )}
                                                </div>
                                                <span className={`text-[13px] font-bold text-left leading-tight ${path === item.id ? 'text-blue-700 dark:text-blue-300' : 'text-slate-700 dark:text-slate-300'}`}>{item.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                
                                {user?.role === 'admin' && (
                                    <>
                                        <div className="my-2 border-t border-slate-100 dark:border-slate-800" />
                                        <button
                                            onClick={() => { setShowMobileMenu(false); navigate('/admin'); }}
                                            className="w-full flex items-center gap-4 p-4 rounded-2xl text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60 active:scale-95 transition-transform"
                                        >
                                            <span className="material-icons-round text-[22px] text-slate-500">admin_panel_settings</span>
                                            <span className="text-sm font-bold">Panel de Administración</span>
                                        </button>
                                    </>
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}

