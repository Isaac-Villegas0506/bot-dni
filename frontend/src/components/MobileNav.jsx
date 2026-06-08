import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { toast } from 'sonner';

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
        { id: '/facial', icon: 'face', label: 'Búsqueda Facial', featureKey: 'feature_facial' },
        { id: '/generador', icon: 'badge', label: 'Generador Reniec', featureKey: 'feature_generador' },
        { id: '/familiares', icon: 'family_restroom', label: 'Familiares', featureKey: 'feature_familiares' },
        { id: '/telefono', icon: 'phone_android', label: 'Teléfonos', featureKey: 'feature_telefono' },
        { id: '/delitos', icon: 'gavel', label: 'Delitos', featureKey: 'feature_delitos' },
        { id: '/policiales', icon: 'policy', label: 'Certificados Policiales', featureKey: 'feature_policiales' },
        { id: '/vehiculos', icon: 'directions_car', label: 'Vehículos', featureKey: 'feature_vehiculos' }
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
                            <div className="px-6 pb-2 shrink-0 flex justify-between items-center">
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Menú Principal</h3>
                                <button onClick={() => setShowMobileMenu(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
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
                                        <span className={`material-icons-round text-[22px] ${path === item.id ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`}>
                                            {item.icon}
                                        </span>
                                        <span className="text-sm font-semibold">{item.label}</span>
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
