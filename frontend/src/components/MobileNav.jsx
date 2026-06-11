import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
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
    const { user } = useAuth();
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
            toast.error('Debes iniciar sesión para acceder a esta sección.');
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
                        />
                        {/* Sheet */}
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl pb-[env(safe-area-inset-bottom)] max-h-[85vh] flex flex-col"
                        >
                            <div className="flex justify-center pt-3 pb-2 shrink-0">
                                <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full" />
                            </div>
                            <div className="px-5 pb-3 shrink-0 flex justify-between items-start border-b border-slate-100 dark:border-slate-800 mb-2">
                                {user ? (
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-base shrink-0 overflow-hidden">
                                            {user.full_name?.charAt(0).toUpperCase() || 'U'}
                                        </div>
                                        <div className="min-w-0 flex flex-col justify-center">
                                            <p className="font-bold text-slate-900 dark:text-white text-sm truncate max-w-[180px] leading-tight">{user.full_name}</p>
                                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[180px] leading-tight mt-0.5">{user.email}</p>
                                            <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full w-fit">
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
                                    <div className="flex flex-col">
                                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">Menú Principal</h3>
                                        <p className="text-xs text-slate-500">Invitado</p>
                                    </div>
                                )}
                                <button onClick={() => setShowMobileMenu(false)} className="w-8 h-8 flex items-center justify-center shrink-0 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                                    <span className="material-icons-round text-xl">close</span>
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-1">
                                <p className="px-4 mt-2 mb-1 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Servicios</p>
                                {menuItems.map(item => (
                                    <button
                                        key={item.id}
                                        onClick={() => handleMenuClick(item.id, item.featureKey)}
                                        className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-colors ${path === item.id ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300 active:bg-slate-100 dark:active:bg-slate-800'}`}
                                    >
                                        <div className="flex items-center gap-4 flex-1">
                                            <span className={`material-icons-round text-[22px] ${path === item.id ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`}>
                                                {item.icon}
                                            </span>
                                            <span className="text-sm font-semibold">{item.label}</span>
                                        </div>
                                        {item.isNew && (
                                            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-yellow-200/50 dark:bg-yellow-800/50 text-yellow-800 dark:text-yellow-300 font-black shrink-0">NUEVO</span>
                                        )}
                                    </button>
                                ))}
                                
                                {user?.role === 'admin' && (
                                    <>
                                        <div className="my-2 border-t border-slate-100 dark:border-slate-800" />
                                        <button
                                            onClick={() => { setShowMobileMenu(false); navigate('/admin'); }}
                                            className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-slate-700 dark:text-slate-300 active:bg-slate-100 dark:active:bg-slate-800"
                                        >
                                            <span className="material-icons-round text-[22px] text-slate-400">admin_panel_settings</span>
                                            <span className="text-sm font-semibold">Panel de Administración</span>
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
