import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';

export default function Header({ setView, darkMode, setDarkMode, onBack }) {
    const [scrolled, setScrolled] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);

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

                {/* Left: Hamburger */}
                <button
                    id="sidebar-toggle-btn"
                    onClick={() => setMenuOpen(true)}
                    aria-label="Abrir menú"
                    className="w-11 h-11 flex items-center justify-center shrink-0 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all duration-150 focus-ring"
                >
                    <span className="material-icons-round text-2xl">menu</span>
                </button>

                {/* Center: Version Badge */}
                <div className="absolute left-1/2 -translate-x-1/2 pointer-events-none">
                    <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/50 px-3 py-1 rounded-full border border-slate-100 dark:border-slate-700 tracking-wide">
                        v1.2
                    </span>
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
