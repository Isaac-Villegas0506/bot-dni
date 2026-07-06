import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { useSearchParamState } from '../../hooks/useSearchParamState';

// ─── Module Imports ────────────────────────────────────────────────────────────
import DashboardHome          from './DashboardHome';
import UserManagement         from './UserManagement';
import BotManagement          from './BotManagement';
import AnnouncementManagement from './AnnouncementManagement';
import PriceManagement        from './PriceManagement';
import HistorialAdmin         from './HistorialAdmin';
import CreditRequests         from './CreditRequests';
import PromoRequests          from './PromoRequests';
import SettingsManagement     from './SettingsManagement';
import BannersManagement      from './BannersManagement';

// ─── Nav config ───────────────────────────────────────────────────────────────
const NAV_GROUPS = [
    {
        title: "Principal",
        items: [
            { id: 'dashboard', icon: 'dashboard', label: 'Dashboard', mobileLabel: 'Home' }
        ]
    },
    {
        title: "Comunidad",
        items: [
            { id: 'users', icon: 'people', label: 'Usuarios', mobileLabel: 'Usuarios' },
            { id: 'historial', icon: 'manage_search', label: 'Historial', mobileLabel: 'Búsquedas' }
        ]
    },
    {
        title: "Ventas y Planes",
        items: [
            { id: 'purchases', icon: 'point_of_sale', label: 'Pagos', mobileLabel: 'Pagos' },
            { id: 'promos', icon: 'smart_display', label: 'Promos TikTok', mobileLabel: 'Promos' },
            { id: 'precios', icon: 'sell', label: 'Precios', mobileLabel: 'Precios' },
            { id: 'banners', icon: 'view_carousel', label: 'Banners', mobileLabel: 'Banners' }
        ]
    },
    {
        title: "Sistema",
        items: [
            { id: 'announcements', icon: 'campaign', label: 'Anuncios', mobileLabel: 'Avisos' },
            { id: 'bots', icon: 'smart_toy', label: 'Bots', mobileLabel: 'Bots' },
            { id: 'settings', icon: 'tune', label: 'Configuración', mobileLabel: 'Ajustes' }
        ]
    }
];

// Helper to get all items flat (useful for mobile menu iteration)
const ALL_NAV_ITEMS = NAV_GROUPS.flatMap(g => g.items);

// ─── Sidebar NavButton ────────────────────────────────────────────────────────
function NavButton({ active, onClick, icon, label }) {
    return (
        <button
            onClick={onClick}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 text-[11px] font-black uppercase tracking-widest focus-ring
                ${active
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-white'
                }`}
        >
            <span className={`material-icons-round text-[20px] shrink-0 ${active ? 'text-white' : 'text-slate-400'}`}>{icon}</span>
            <span>{label}</span>
            {active && <span className="ml-auto material-icons-round text-[16px] opacity-60">chevron_right</span>}
        </button>
    );
}

// ─── Main Admin Dashboard ────────────────────────────────────────────────────
export default function AdminDashboard({ onBackToHome }) {
    const { logout } = useAuth();
    const [activeTab, setActiveTab] = useSearchParamState('tab', 'dashboard');
    const [stats, setStats]         = useState(null);
    const [loading, setLoading]     = useState(true);
    const [showMobileMenu, setShowMobileMenu] = useState(false);

    useEffect(() => { fetchStats(); }, []);

    const fetchStats = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/admin/stats', { headers: { 'Authorization': `Bearer ${token}` } });
            if (res.ok) setStats(await res.json());
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'dashboard':     return <DashboardHome stats={stats} />;
            case 'users':         return <UserManagement />;
            case 'bots':          return <BotManagement />;
            case 'announcements': return <AnnouncementManagement />;
            case 'precios':       return <PriceManagement />;
            case 'historial':     return <HistorialAdmin />;
            case 'purchases':     return <CreditRequests />;
            case 'promos':        return <PromoRequests />;
            case 'banners':       return <BannersManagement />;
            case 'settings':      return <SettingsManagement />;
            default:              return <DashboardHome stats={stats} />;
        }
    };

    return (
        <div className="flex h-[100dvh] bg-slate-50 dark:bg-slate-900 font-body text-slate-900 dark:text-white overflow-hidden">

            {/* ── Desktop Sidebar ─────────────────────────────────────────── */}
            <aside className="hidden md:flex w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex-col shrink-0 z-20">
                <div className="px-5 py-5 border-b border-slate-100 dark:border-slate-700 shrink-0">
                    <h2 className="text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                        Admin Panel
                    </h2>
                    <p className="text-[11px] text-slate-400 mt-0.5">v2.0.2 · Stable</p>
                </div>

                <nav className="flex-1 p-3 overflow-y-auto space-y-4">
                    {NAV_GROUPS.map((group, i) => (
                        <div key={i}>
                            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-3 mb-2">
                                {group.title}
                            </p>
                            <div className="space-y-0.5">
                                {group.items.map(item => (
                                    <NavButton
                                        key={item.id}
                                        active={activeTab === item.id}
                                        onClick={() => setActiveTab(item.id)}
                                        icon={item.icon}
                                        label={item.label}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                </nav>

                <div className="p-3 border-t border-slate-100 dark:border-slate-700 shrink-0 space-y-1">
                    {onBackToHome && (
                        <button
                            onClick={onBackToHome}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-white transition-colors text-sm font-medium"
                        >
                            <span className="material-icons-round text-[20px]">home</span>
                            Volver a la Web
                        </button>
                    )}
                    <button
                        onClick={logout}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors text-sm font-medium"
                    >
                        <span className="material-icons-round text-[20px]">logout</span>
                        Cerrar Sesión
                    </button>
                </div>
            </aside>

            {/* ── Main Area ──────────────────────────────────────────────── */}
            <main className="flex-1 flex flex-col min-w-0 relative overflow-hidden">

                {/* Mobile top bar */}
                <div className="md:hidden flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shrink-0">
                    <h2 className="text-base font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                        Admin Panel
                    </h2>
                    <button onClick={logout} className="p-2 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors">
                        <span className="material-icons-round text-xl">logout</span>
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-3 md:p-6 pb-20 md:pb-6 scroll-smooth">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-full gap-3">
                            <div className="w-10 h-10 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
                            <p className="text-sm text-slate-400">Cargando panel...</p>
                        </div>
                    ) : (
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={activeTab}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.15 }}
                                className="w-full max-w-full"
                            >
                                {renderContent()}
                            </motion.div>
                        </AnimatePresence>
                    )}
                </div>

                {/* ── Apple-Style Mobile Bottom Tab Bar ──────────── */}
                <nav
                    role="tablist"
                    aria-label="Navegación admin"
                    className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t border-slate-200/50 dark:border-slate-800/50 z-30 pb-[env(safe-area-inset-bottom)] px-2"
                >
                    <div className="flex justify-between items-center h-16 max-w-sm mx-auto">
                        {[
                            { id: 'dashboard', icon: 'dashboard', label: 'Inicio' },
                            { id: 'users', icon: 'group', label: 'Usuarios' },
                            { id: 'purchases', icon: 'point_of_sale', label: 'Ventas' },
                            { id: 'menu', icon: 'menu', label: 'Menú' }
                        ].map(({ id, icon, label }) => {
                            const isActive = id === 'menu' ? showMobileMenu : activeTab === id;
                            return (
                                <button
                                    key={id}
                                    onClick={() => id === 'menu' ? setShowMobileMenu(true) : setActiveTab(id)}
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
                                className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl pb-[env(safe-area-inset-bottom)] max-h-[85dvh] flex flex-col"
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
                                <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-4">
                                    {NAV_GROUPS.map((group, i) => (
                                        <div key={i}>
                                            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-3 mb-2">
                                                {group.title}
                                            </p>
                                            <div className="space-y-1">
                                                {group.items.map(item => (
                                                    <button
                                                        key={item.id}
                                                        onClick={() => {
                                                            setActiveTab(item.id);
                                                            setShowMobileMenu(false);
                                                        }}
                                                        className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-colors ${activeTab === item.id ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300 active:bg-slate-100 dark:active:bg-slate-800'}`}
                                                    >
                                                        <span className={`material-icons-round text-[22px] ${activeTab === item.id ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`}>
                                                            {item.icon}
                                                        </span>
                                                        <span className="text-sm font-semibold">{item.label}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                    
                                    <div className="my-2 border-t border-slate-100 dark:border-slate-800" />
                                    
                                    <button
                                        onClick={() => {
                                            setShowMobileMenu(false);
                                            if(onBackToHome) onBackToHome();
                                        }}
                                        className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-slate-700 dark:text-slate-300 active:bg-slate-100 dark:active:bg-slate-800"
                                    >
                                        <span className="material-icons-round text-[22px] text-slate-400">home</span>
                                        <span className="text-sm font-semibold">Volver a la Web</span>
                                    </button>
                                </div>
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
}
