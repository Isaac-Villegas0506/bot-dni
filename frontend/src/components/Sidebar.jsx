import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/settingsContextValue';
import { toast } from 'sonner';

// ─── Countdown Timer ─────────────────────────────────────────────────────────
const CountdownTimer = ({ lastSearch }) => {
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

    if (!timeLeft) return <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Disponible</span>;
    return (
        <span className="flex flex-col">
            <span className="text-xs text-slate-400 uppercase tracking-wider">Próximo crédito</span>
            <span className="text-red-500 dark:text-red-400 font-mono text-sm font-bold">{timeLeft}</span>
        </span>
    );
};

// ─── MenuItem ─────────────────────────────────────────────────────────────────
function MenuItem({ icon, label, active, onClick, disabled, isNew }) {
    return (
        <button
            onClick={(e) => {
                if (disabled) {
                    e.preventDefault();
                    toast.info('Esta función está en mantenimiento o deshabilitada temporalmente.');
                    return;
                }
                onClick(e);
            }}
            className={`
                w-full min-h-[44px] flex items-center justify-between px-3 py-2.5 rounded-xl font-medium
                transition-all duration-150 focus-ring
                ${disabled
                    ? 'opacity-60 cursor-not-allowed bg-slate-50/50 dark:bg-slate-800/30 text-slate-400 dark:text-slate-500'
                    : active
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                }
            `}
        >
            <div className="flex items-center gap-3 flex-1 min-w-0">
                <span className={`material-icons-round text-[20px] shrink-0 ${active && !disabled ? 'text-white' : 'text-slate-400'}`}>
                    {icon}
                </span>
                <span className="text-sm truncate">{label}</span>
            </div>
            {isNew && !disabled && (
                <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-black shrink-0 ${active ? 'bg-white/20 text-white' : 'bg-yellow-200/50 dark:bg-yellow-800/50 text-yellow-800 dark:text-yellow-300'}`}>
                    NUEVO
                </span>
            )}
            {disabled && <span className="material-icons-round text-[16px] opacity-70 shrink-0">lock</span>}
        </button>
    );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────
export default function Sidebar({ isOpen, onClose, onNav }) {
    const { user, logout, openLoginModal } = useAuth();
    const { isFeatureEnabled } = useSettings();
    const location = useLocation();
    const path = location.pathname;
    const [menuMode, setMenuMode] = useState('main');

    useEffect(() => {
        if (!isOpen) setTimeout(() => setMenuMode('main'), 250);
    }, [isOpen]);

    const handleNavClick = (target) => { onNav(target); onClose(); };

    const sidebarVariants = {
        closed: { x: '-100%', opacity: 0 },
        open: {
            x: 0,
            opacity: 1,
            transition: { type: 'tween', duration: 0.22, ease: [0.4, 0, 0.2, 1] }
        }
    };

    const contentVariants = {
        hidden:  { opacity: 0, x: -12 },
        visible: { opacity: 1, x: 0, transition: { duration: 0.15 } }
    };

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={onClose}
                        className="hidden md:block fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
                    />

                    {/* Panel */}
                    <motion.div
                        initial="closed"
                        animate="open"
                        exit="closed"
                        variants={sidebarVariants}
                        className="hidden md:flex fixed top-0 left-0 h-full w-80 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shadow-xl z-[70] flex-col overflow-hidden"
                    >
                        {/* Header */}
                        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-800/40 shrink-0">
                            {user ? (
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-base shrink-0 overflow-hidden">
                                        {user.avatar_url
                                            ? <img src={user.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                                            : (user.full_name?.charAt(0).toUpperCase() || 'U')
                                        }
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-bold text-slate-900 dark:text-white text-sm truncate max-w-[160px]">{user.full_name}</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[160px]">{user.email}</p>
                                    </div>
                                </div>
                            ) : (
                                <span className="font-bold text-slate-800 dark:text-white">Menú</span>
                            )}
                            <button
                                onClick={onClose}
                                aria-label="Cerrar menú"
                                className="min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors duration-150 focus-ring"
                            >
                                <span className="material-icons-round text-xl">close</span>
                            </button>
                        </div>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto p-3">
                            <AnimatePresence mode="wait">
                                {menuMode === 'main' ? (
                                    <motion.div key="main" initial="hidden" animate="visible" exit="hidden" variants={contentVariants} className="space-y-4">

                                        {/* Credits Badge */}
                                        {user && (
                                            <div className="mx-1 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
                                                <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">Créditos Premium</p>
                                                <div className="text-sm text-slate-700 dark:text-slate-300">
                                                    {user.is_premium
                                                        ? <span className="font-bold text-blue-600 dark:text-blue-400">∞ Versión Premium</span>
                                                        : user.credits > 0
                                                            ? <span className="font-semibold">{user.credits} crédito{user.credits !== 1 ? 's' : ''} disponible{user.credits !== 1 ? 's' : ''}</span>
                                                            : <CountdownTimer lastSearch={user.last_premium_search} />
                                                    }
                                                </div>
                                            </div>
                                        )}

                                        {/* Servicios */}
                                        <div>
                                            <p className="px-3 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">Servicios</p>
                                            <div className="space-y-0.5">
                                                <MenuItem icon="face" label="Búsqueda Facial" active={path === '/facial'} disabled={!isFeatureEnabled('feature_facial')} onClick={() => handleNavClick('facial')} isNew={true} />
                                                <MenuItem icon="home" label="Reniec" active={path === '/'} onClick={() => handleNavClick('home')} />
                                                <MenuItem icon="manage_search" label="Info Global" active={path === '/infoglobal'} disabled={!isFeatureEnabled('feature_infoglobal')} onClick={() => handleNavClick('infoglobal')} isNew={true} />
                                                <MenuItem icon="badge" label="Generador Reniec" active={path === '/generador'} disabled={!isFeatureEnabled('feature_generador')} onClick={() => handleNavClick('generator')} />
                                                <MenuItem icon="family_restroom" label="Familiares" active={path === '/familiares'} disabled={!isFeatureEnabled('feature_familiares')} onClick={() => handleNavClick('familiares')} />
                                                <MenuItem icon="phone_android" label="Teléfono" active={path === '/telefono'} disabled={!isFeatureEnabled('feature_telefono')} onClick={() => handleNavClick('telefono')} />
                                                <MenuItem icon="gavel" label="Delitos" active={path === '/delitos'} disabled={!isFeatureEnabled('feature_delitos')} onClick={() => handleNavClick('delitos')} isNew={true} />
                                                <MenuItem icon="balance" label="Fiscalía" active={path === '/fiscalia'} disabled={!isFeatureEnabled('feature_fiscalia')} onClick={() => handleNavClick('fiscalia')} isNew={true} />
                                                <MenuItem icon="policy" label="Certificados Policiales" active={path === '/policiales'} disabled={!isFeatureEnabled('feature_policiales')} onClick={() => handleNavClick('policiales')} />
                                                <MenuItem icon="directions_car" label="Vehículos" active={path === '/vehiculos'} disabled={!isFeatureEnabled('feature_vehiculos')} onClick={() => handleNavClick('vehiculos')} isNew={true} />
                                            </div>
                                        </div>

                                        {/* Mi Cuenta */}
                                        {user && (
                                            <div>
                                                <p className="px-3 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">Mi Cuenta</p>
                                                <div className="space-y-0.5">
                                                    <MenuItem icon="history" label="Historial de Búsquedas" active={path === '/historial'} onClick={() => handleNavClick('history')} />
                                                    <MenuItem icon="shopping_cart" label="Comprar Créditos" active={path === '/tienda'} onClick={() => handleNavClick('shop')} />
                                                    <MenuItem icon="redeem" label="Ganar Créditos" active={path === '/creditos'} onClick={() => handleNavClick('creditos')} />
                                                </div>
                                            </div>
                                        )}

                                        {/* Admin */}
                                        {user?.role === 'admin' && (
                                            <div>
                                                <p className="px-3 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">Administración</p>
                                                <button
                                                    onClick={() => setMenuMode('admin')}
                                                    className="w-full min-h-[44px] flex items-center justify-between px-3 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-sm font-medium hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors duration-150 focus-ring"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <span className="material-icons-round text-[20px]">admin_panel_settings</span>
                                                        Panel Admin
                                                    </div>
                                                    <span className="material-icons-round text-[18px] opacity-60">chevron_right</span>
                                                </button>
                                            </div>
                                        )}

                                        {/* Auth Actions */}
                                        {user ? (
                                            <div className="pt-1">
                                                <div className="h-px bg-slate-100 dark:bg-slate-800 mb-3" />
                                                <button
                                                    onClick={() => { logout(); onClose(); }}
                                                    className="w-full min-h-[44px] flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors duration-150 text-sm font-medium focus-ring"
                                                >
                                                    <span className="material-icons-round text-[20px]">logout</span>
                                                    Cerrar Sesión
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="pt-1">
                                                <div className="h-px bg-slate-100 dark:bg-slate-800 mb-3" />
                                                <button
                                                    onClick={() => { openLoginModal(); onClose(); }}
                                                    className="w-full min-h-[44px] py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors duration-150 focus-ring"
                                                >
                                                    Ingresar
                                                </button>
                                            </div>
                                        )}
                                    </motion.div>
                                ) : (
                                    <motion.div key="admin" initial="hidden" animate="visible" exit="hidden" variants={contentVariants} className="space-y-3">
                                        <button
                                            onClick={() => setMenuMode('main')}
                                            className="min-h-[44px] flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors duration-150 font-medium mb-2 focus-ring rounded-lg px-2"
                                        >
                                            <span className="material-icons-round text-base">arrow_back</span>
                                            Volver al menú
                                        </button>

                                        <p className="px-3 text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Administración</p>
                                        <MenuItem icon="dashboard" label="Dashboard General" active={path === '/admin'} onClick={() => handleNavClick('admin')} />

                                        <div className="mt-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                                            <p className="text-xs text-slate-500 dark:text-slate-400 flex items-start gap-2">
                                                <span className="material-icons-round text-sm text-blue-500 mt-0.5 shrink-0">info</span>
                                                Gestiona usuarios, bots y anuncios desde el panel central.
                                            </p>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Footer */}
                        <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-800 shrink-0">
                            <div className="flex flex-col items-center gap-1">
                                <p className="text-xs text-slate-400 dark:text-slate-600 text-center tracking-wider">
                                    Bot DNI · Isaac Dev · v1.2
                                </p>
                                <button
                                    onClick={() => handleNavClick('terms')}
                                    className="min-h-[44px] px-2 text-xs font-bold text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 uppercase tracking-tighter transition-colors"
                                >
                                    Términos y Condiciones
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>,
        document.body
    );
}
