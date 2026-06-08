import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from './Sidebar';

export default function Header({ setView, darkMode, setDarkMode, onBack }) {
    const [scrolled, setScrolled] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const { user, openLoginModal } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const handleNav = (targetView) => {
        if (setView) setView(targetView);
        else if (targetView === 'home' && onBack) onBack();
    };

    return (
        <header className={`
            sticky top-0 z-header py-3 transition-all duration-200
            ${scrolled
                ? 'bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 shadow-sm'
                : 'bg-transparent border-b border-transparent'
            }
        `}>
            <div className="container mx-auto px-4 sm:px-6 flex items-center justify-between h-12">

                {/* Left: Hamburger (Desktop Only) */}
                <button
                    id="sidebar-toggle-btn"
                    onClick={() => setMenuOpen(true)}
                    aria-label="Abrir menú"
                    className="hidden md:flex w-11 h-11 items-center justify-center shrink-0 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all duration-150 focus-ring"
                >
                    <span className="material-icons-round text-2xl">menu</span>
                </button>

                {/* Left: User Avatar (Mobile Only) */}
                <div className="flex md:hidden items-center justify-center shrink-0">
                    {user ? (
                        <button onClick={() => navigate('/tienda')} className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-base overflow-hidden border-2 border-transparent hover:border-blue-200 dark:hover:border-blue-800 transition-colors">
                            {user.avatar_url ? (
                                <img src={user.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                                user.full_name?.charAt(0).toUpperCase() || 'U'
                            )}
                        </button>
                    ) : (
                        <button onClick={openLoginModal} className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                            <span className="material-icons-round text-lg">person</span>
                        </button>
                    )}
                </div>

                {/* Center: Version Badge */}
                <div className="absolute left-1/2 -translate-x-1/2 pointer-events-none">
                    <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/50 px-3 py-1 rounded-full border border-slate-100 dark:border-slate-700 tracking-wide">
                        v2.0.2                    </span>
                </div>

                {/* Right: Theme Toggle */}
                <button
                    onClick={() => setDarkMode(!darkMode)}
                    aria-label={darkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                    className="w-11 h-11 flex items-center justify-center shrink-0 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all duration-150 focus-ring"
                >
                    <span className="material-icons-round text-2xl">
                        {darkMode ? 'light_mode' : 'dark_mode'}
                    </span>
                </button>

                {/* Sidebar */}
                <Sidebar
                    isOpen={menuOpen}
                    onClose={() => setMenuOpen(false)}
                    onNav={handleNav}
                />
            </div>
        </header>
    );
}
