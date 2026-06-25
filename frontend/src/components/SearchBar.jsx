import { motion } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { useSettings } from '../context/settingsContextValue';

export default function SearchBar({ searchMode, setSearchMode, searchDni, searchName, loading }) {
    const { isFeatureEnabled } = useSettings();
    const autoSearchTriggered = useRef(false);
    // Destructure to keep effect deps stable (searchDni is a fresh object each parent render).
    const { value: dniValue, handleSubmit: handleDniSubmit } = searchDni;

    // Auto-search when DNI reaches 8 digits
    useEffect(() => {
        if (searchMode === 'dni' && dniValue?.length === 8 && !loading && !autoSearchTriggered.current) {
            autoSearchTriggered.current = true;
            handleDniSubmit(null);
        }
        // Reset the flag when DNI changes (so user can search again after clearing/modifying)
        if (dniValue?.length !== 8) {
            autoSearchTriggered.current = false;
        }
    }, [dniValue, searchMode, loading, handleDniSubmit]);

    // Ensure valid search mode if features are disabled
    useEffect(() => {
        if (searchMode === 'name' && !isFeatureEnabled('option_busqueda_nombres')) {
            setSearchMode('dni');
        }
        if (searchMode === 'dni' && searchDni.searchType === 'basic' && !isFeatureEnabled('option_dni_gratis')) {
            searchDni.setSearchType('premium');
        }
        if (searchMode === 'dni' && searchDni.searchType === 'premium' && !isFeatureEnabled('option_dni_premium')) {
            searchDni.setSearchType('basic');
        }
    }, [isFeatureEnabled, searchMode, searchDni, setSearchMode]);

    const handleSubmit = (e) => {
        if (e) e.preventDefault();
        if (loading) return;
        if (searchMode === 'dni') searchDni.handleSubmit(e);
        else searchName.handleSubmit(e);
    };

    return (
        <div className="w-full flex flex-col items-center">

            {/* ── Heading ─────────────────────────────────────────────────── */}
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-center mb-10 lg:mb-12 text-text-main-light dark:text-text-main-dark transition-colors duration-300">
                Consulta{' '}
                <span className="relative inline-block">
                    <span className="text-primary dark:text-primary-dark">DNI</span>
                    <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-primary/30 dark:bg-primary-dark/30 rounded-full" />
                </span>
            </h1>

            {/* ── Mode Tabs ────────────────────────────────────────────────── */}
            <div role="tablist" aria-label="Modo de búsqueda" className="flex gap-1.5 bg-slate-100 dark:bg-slate-800/70 p-1.5 rounded-2xl mb-10 lg:mb-12 border border-slate-200/80 dark:border-slate-700/60 w-full max-w-xs sm:max-w-sm lg:max-w-md shadow-sm">
                {[
                    { mode: 'dni', label: 'Por DNI', option: 'option_dni_gratis' }, // Fallback to option_dni_premium if this is disabled? 
                    { mode: 'name', label: 'Por Nombre', option: 'option_busqueda_nombres' },
                ].filter(tab => {
                    // Si Por Nombre está desactivado, no lo mostramos.
                    if (tab.mode === 'name' && !isFeatureEnabled('option_busqueda_nombres')) return false;
                    // Si ambos dni están desactivados, ocultamos Por DNI (raro, pero bueno)
                    if (tab.mode === 'dni' && !isFeatureEnabled('option_dni_gratis') && !isFeatureEnabled('option_dni_premium')) return false;
                    return true;
                }).map(({ mode, label }) => (
                    <button
                        key={mode}
                        role="tab"
                        aria-selected={searchMode === mode}
                        onClick={() => setSearchMode(mode)}
                        className={`
                            flex-1 min-h-[44px] py-2.5 lg:py-3 px-4 rounded-xl text-sm lg:text-base font-semibold
                            transition-all duration-200 ease-smooth focus-ring
                            ${searchMode === mode
                                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                            }
                        `}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {/* ── Search Input ─────────────────────────────────────────────── */}
            <div className="w-full max-w-sm sm:max-w-lg lg:max-w-2xl relative group">
                <form
                    onSubmit={handleSubmit}
                    className="relative flex items-center bg-white dark:bg-card-dark rounded-lg border border-slate-200 dark:border-slate-700 group-focus-within:border-blue-400 dark:group-focus-within:border-blue-500 transition-colors duration-150"
                >
                    {searchMode === 'dni' ? (
                        <input
                            className="w-full bg-transparent text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 text-lg sm:text-xl lg:text-2xl px-6 sm:px-8 py-4 sm:py-5 lg:py-6 rounded-lg focus:outline-none font-mono tracking-wider"
                            inputMode="numeric"
                            maxLength={8}
                            placeholder="Ingresa un DNI..."
                            aria-label="Número de DNI"
                            value={searchDni.value}
                            onChange={searchDni.onChange}
                            autoFocus
                        />
                    ) : (
                        <input
                            className="w-full bg-transparent text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-lg sm:text-xl lg:text-2xl px-6 sm:px-8 py-4 sm:py-5 lg:py-6 rounded-lg focus:outline-none"
                            placeholder="Nombres y apellidos..."
                            aria-label="Nombres y apellidos"
                            value={searchName.nombres}
                            onChange={(e) => searchName.setNombres(e.target.value.toUpperCase())}
                        />
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="absolute right-2 sm:right-2.5 min-h-[44px] min-w-[44px] rounded-lg bg-slate-900 dark:bg-blue-600 hover:bg-slate-700 dark:hover:bg-blue-500 text-white transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center focus-ring"
                        aria-label="Buscar"
                    >
                        {loading ? (
                            <span className="block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <span className="material-icons-round text-xl lg:text-2xl">arrow_forward</span>
                        )}
                    </button>
                </form>
            </div>

            {/* ── Search Type (DNI mode only) ──────────────────────────────── */}
            {searchMode === 'dni' && (
                <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="flex justify-center gap-5 mt-5"
                >
                    {[
                        { value: 'basic', label: 'Datos básicos', dotColor: 'bg-blue-500', ringColor: 'border-blue-500', textActive: 'text-slate-800 dark:text-slate-100', textInactive: 'text-slate-500 dark:text-slate-400', feature: 'option_dni_gratis' },
                        { value: 'premium', label: 'Datos premium', dotColor: 'bg-amber-500', ringColor: 'border-amber-500', textActive: 'text-amber-600 dark:text-amber-400', textInactive: 'text-slate-500 dark:text-slate-400', feature: 'option_dni_premium' },
                    ].filter(opt => isFeatureEnabled(opt.feature)).map(({ value, label, dotColor, ringColor, textActive, textInactive }) => {
                        const isActive = searchDni.searchType === value;
                        return (
                            <label
                                key={value}
                                className="flex items-center gap-2.5 cursor-pointer group select-none"
                            >
                                <input
                                    type="radio"
                                    name="searchType"
                                    value={value}
                                    checked={isActive}
                                    onChange={() => searchDni.setSearchType(value)}
                                    className="sr-only"
                                />
                                <span className={`w-4.5 h-4.5 rounded-full border-2 flex items-center justify-center transition-all duration-150 ${isActive ? ringColor : 'border-slate-300 dark:border-slate-600 group-hover:border-slate-400'}`}>
                                    {isActive && <span className={`w-2 h-2 rounded-full ${dotColor}`} />}
                                </span>
                                <span className={`text-sm font-medium transition-colors duration-150 ${isActive ? textActive : textInactive}`}>
                                    {label}
                                </span>
                            </label>
                        );
                    })}
                </motion.div>
            )}
        </div>
    );
}
