import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { useSearchParamState } from '../hooks/useSearchParamState';

// Maps search_type to { icon, label, color, category }
const TYPE_INFO = {
    dni: { icon: 'badge', label: 'DNI Básico', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100/50 dark:bg-blue-900/30', border: 'border-blue-500', category: 'reniec' },
    dni_premium: { icon: 'verified_user', label: 'DNI Premium', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100/50 dark:bg-amber-900/30', border: 'border-amber-500', category: 'reniec' },
    name: { icon: 'person_search', label: 'Búsqueda Nombre', color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-100/50 dark:bg-purple-900/30', border: 'border-purple-500', category: 'reniec' },
    reniec_c4_azul: { icon: 'article', label: 'C4 Azul', color: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-100/50 dark:bg-cyan-900/30', border: 'border-cyan-500', category: 'generador' },
    reniec_inscripcion: { icon: 'assignment', label: 'Inscripción', color: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-100/50 dark:bg-cyan-900/30', border: 'border-cyan-500', category: 'generador' },
    reniec_dni_azul: { icon: 'credit_card', label: 'DNI Azul Virtual', color: 'text-sky-600 dark:text-sky-400', bg: 'bg-sky-100/50 dark:bg-sky-900/30', border: 'border-sky-500', category: 'generador' },
    reniec_dni_amarillo: { icon: 'credit_card', label: 'DNI Amarillo', color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-100/50 dark:bg-yellow-900/30', border: 'border-yellow-500', category: 'generador' },
    familiares_pdf: { icon: 'family_restroom', label: 'Familiares PDF', color: 'text-green-600 dark:text-green-400', bg: 'bg-green-100/50 dark:bg-green-900/30', border: 'border-green-500', category: 'familiares' },
    familiares_texto: { icon: 'family_restroom', label: 'Familiares Texto', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100/50 dark:bg-emerald-900/30', border: 'border-emerald-500', category: 'familiares' },
    telefono_numeros_dni: { icon: 'phone_in_talk', label: 'Números x DNI', color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-100/50 dark:bg-violet-900/30', border: 'border-violet-500', category: 'telefonos' },
    telefono_info_linea: { icon: 'sim_card', label: 'Info de Línea', color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-100/50 dark:bg-indigo-900/30', border: 'border-indigo-500', category: 'telefonos' },
    telefono_verificador: { icon: 'wifi_calling', label: 'Operadora', color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-800', border: 'border-slate-500', category: 'telefonos' },
    telefono_titular: { icon: 'contact_phone', label: 'Titular Número', color: 'text-fuchsia-600 dark:text-fuchsia-400', bg: 'bg-fuchsia-100/50 dark:bg-fuchsia-900/30', border: 'border-fuchsia-500', category: 'telefonos' },
};

const CATEGORY_CLASSES = {
    todos: 'bg-blue-600 border-blue-600 text-white shadow-xl shadow-blue-500/20',
    reniec: 'bg-amber-600 border-amber-600 text-white shadow-xl shadow-amber-500/20',
    generador: 'bg-cyan-600 border-cyan-600 text-white shadow-xl shadow-cyan-500/20',
    familiares: 'bg-green-600 border-green-600 text-white shadow-xl shadow-green-500/20',
    telefonos: 'bg-violet-600 border-violet-600 text-white shadow-xl shadow-violet-500/20',
};

function getTypeInfo(type) {
    return TYPE_INFO[type] || { icon: 'search', label: type, color: 'text-slate-600', bg: 'bg-slate-100', border: 'border-slate-500', category: 'otros' };
}

const FILTERS = [
    { id: 'todos', label: 'Todos', icon: 'grid_view' },
    { id: 'reniec', label: 'RENIEC', icon: 'badge' },
    { id: 'generador', label: 'Generador', icon: 'article' },
    { id: 'familiares', label: 'Familiares', icon: 'family_restroom' },
    { id: 'telefonos', label: 'Teléfonos', icon: 'phone_in_talk' },
];

function HistoryList() {
    const navigate = useNavigate();
    const { isLoggedIn, authLoading, openLoginModal } = useAuth();
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useSearchParamState('q', '');
    const [activeFilter, setActiveFilter] = useSearchParamState('cat', 'todos');

    useEffect(() => {
        if (authLoading) return;
        if (isLoggedIn) {
            fetchHistory();
        } else {
            setLoading(false);
        }
    }, [isLoggedIn, authLoading]);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/user/history', { headers: { 'Authorization': `Bearer ${token}` } });
            if (res.ok) setHistory(await res.json());
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    const filtered = useMemo(() => {
        let list = history;
        if (activeFilter !== 'todos') {
            list = list.filter(item => getTypeInfo(item.search_type).category === activeFilter);
        }
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(item => item.search_term?.toLowerCase().includes(q) || item.search_type?.toLowerCase().includes(q));
        }
        return list;
    }, [history, activeFilter, search]);

    const hasActiveFilters = activeFilter !== 'todos' || search.trim() !== '';
    const isEmptyByFilter = filtered.length === 0 && history.length > 0 && hasActiveFilters;
    const isEmptyTotal = filtered.length === 0 && history.length === 0;

    const clearFilters = () => {
        setSearch('');
        setActiveFilter('todos');
    };

    // Empty state para usuarios no autenticados: UI completa visible, CTA suave a login.
    if (!authLoading && !isLoggedIn) {
        return (
            <div className="text-center py-12 sm:py-16 px-5 bg-slate-50/50 dark:bg-slate-800/30 rounded-[2rem] border border-dashed border-slate-200 dark:border-slate-700">
                <div className="w-20 h-20 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center mx-auto mb-5">
                    <span className="material-icons-round text-4xl text-blue-600 dark:text-blue-400" aria-hidden="true">lock_person</span>
                </div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">Inicia sesión para ver tu historial</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm max-w-sm mx-auto leading-relaxed mb-6">
                    Cuando inicias sesión, guardamos automáticamente cada consulta para que puedas repetirla con un clic.
                </p>
                <button
                    onClick={openLoginModal}
                    className="inline-flex items-center gap-2 min-h-[44px] px-6 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-lg shadow-blue-500/30 transition-all active:scale-95"
                >
                    <span className="material-icons-round text-base" aria-hidden="true">login</span>
                    Iniciar sesión
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-5 md:space-y-6">
            {/* Search Bar */}
            <div className="relative group">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                    <span className="material-icons-round text-slate-400 group-focus-within:text-blue-500 transition-colors" aria-hidden="true">search</span>
                </div>
                <input
                    type="text"
                    aria-label="Buscar en historial"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Busca por DNI, nombre o tipo de consulta..."
                    className="w-full pl-12 pr-12 py-3.5 sm:py-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:bg-white dark:focus:bg-slate-800 transition-all shadow-inner text-sm sm:text-base"
                />
                {search && (
                    <button
                        onClick={() => setSearch('')}
                        aria-label="Limpiar búsqueda"
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 transition-all"
                    >
                        <span className="material-icons-round text-lg" aria-hidden="true">close</span>
                    </button>
                )}
            </div>

            {/* Filter Buttons */}
            <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
                <div
                    role="tablist"
                    aria-label="Filtrar por categoría"
                    className="flex gap-2 overflow-x-auto snap-x snap-mandatory pb-2 scrollbar-hide -mx-1 px-1 flex-1 min-w-0"
                >
                    {FILTERS.map(f => {
                        const isActive = activeFilter === f.id;
                        const activeClass = CATEGORY_CLASSES[f.id] || CATEGORY_CLASSES['todos'];
                        return (
                            <button
                                key={f.id}
                                role="tab"
                                aria-selected={isActive}
                                onClick={() => setActiveFilter(f.id)}
                                className={`snap-start shrink-0 min-h-[44px] flex items-center gap-2 px-4 sm:px-5 rounded-full text-xs font-black uppercase tracking-wide sm:tracking-widest border transition-all whitespace-nowrap ${isActive
                                        ? activeClass
                                        : 'bg-white dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                                    }`}
                            >
                                <span className="material-icons-round text-base" aria-hidden="true">{f.icon}</span>
                                {f.label}
                            </button>
                        );
                    })}
                </div>
                <div className="hidden md:flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-4 py-2 rounded-full border border-slate-200 dark:border-slate-700 shrink-0">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" aria-hidden="true"></span>
                    <span className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">{filtered.length} Registros</span>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-16 sm:py-20 gap-4">
                    <div className="w-10 h-10 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin" />
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Sincronizando historial...</p>
                </div>
            ) : (
                <div className="space-y-3">
                    <AnimatePresence mode="popLayout">
                        {isEmptyByFilter ? (
                            <motion.div
                                key="empty-filter"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="text-center py-12 sm:py-16 px-5 bg-slate-50/50 dark:bg-slate-800/30 rounded-[2rem] border border-dashed border-slate-200 dark:border-slate-700"
                            >
                                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                                    <span className="material-icons-round text-3xl sm:text-4xl text-slate-300 dark:text-slate-600" aria-hidden="true">filter_alt_off</span>
                                </div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Sin coincidencias</h3>
                                <p className="text-slate-400 text-sm max-w-xs mx-auto leading-relaxed mb-5">
                                    Ningún registro coincide con los filtros que aplicaste.
                                </p>
                                <button
                                    onClick={clearFilters}
                                    className="inline-flex items-center gap-2 min-h-[44px] px-5 rounded-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-bold text-xs uppercase tracking-wide hover:bg-slate-50 dark:hover:bg-slate-600 transition-all"
                                >
                                    <span className="material-icons-round text-base" aria-hidden="true">refresh</span>
                                    Limpiar filtros
                                </button>
                            </motion.div>
                        ) : isEmptyTotal ? (
                            <motion.div
                                key="empty-total"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="text-center py-12 sm:py-16 px-5 bg-slate-50/50 dark:bg-slate-800/30 rounded-[2rem] border border-dashed border-slate-200 dark:border-slate-700"
                            >
                                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto mb-4">
                                    <span className="material-icons-round text-3xl sm:text-4xl text-blue-600 dark:text-blue-400" aria-hidden="true">manage_search</span>
                                </div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Aún no hay consultas</h3>
                                <p className="text-slate-400 text-sm max-w-xs mx-auto leading-relaxed">
                                    Cuando hagas tu primera búsqueda aparecerá aquí para que puedas repetirla en un clic.
                                </p>
                            </motion.div>
                        ) : (
                            filtered.map((item, i) => {
                                const info = getTypeInfo(item.search_type);
                                return (
                                    <motion.div
                                        key={item.id || i}
                                        layout
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.98 }}
                                        transition={{ duration: 0.2, delay: Math.min(i * 0.02, 0.2) }}
                                        className={`group relative bg-white dark:bg-slate-900 rounded-2xl border-l-4 ${info.border} border-t border-r border-b border-slate-100 dark:border-slate-800/50 hover:shadow-xl hover:shadow-slate-200/40 dark:hover:shadow-none hover:-translate-y-0.5 transition-all duration-300 p-3 sm:p-4`}
                                    >
                                        <div className="flex items-center gap-3 sm:gap-4">
                                            <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl shrink-0 flex items-center justify-center ${info.bg} ${info.color} shadow-inner`}>
                                                <span className="material-icons-round text-xl sm:text-2xl" aria-hidden="true">{info.icon}</span>
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="font-black text-slate-900 dark:text-white truncate tracking-tight text-base sm:text-lg leading-tight mb-1">
                                                    {item.search_term}
                                                </p>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className={`text-xs font-black uppercase tracking-wide ${info.color}`}>
                                                        {info.label}
                                                    </span>
                                                    <span className="hidden sm:inline w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" aria-hidden="true"></span>
                                                    <div className="flex items-center gap-1 text-xs font-medium text-slate-400">
                                                        <span className="material-icons-round text-[13px]" aria-hidden="true">calendar_today</span>
                                                        {item.created_at?.split(' ')[0]}
                                                        <span className="w-1 h-1 rounded-full bg-slate-200 dark:bg-slate-800 mx-1" aria-hidden="true"></span>
                                                        <span className="material-icons-round text-[13px]" aria-hidden="true">schedule</span>
                                                        {item.created_at?.split(' ')[1]?.substring(0, 5)}
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    toast.info('Redirigiendo a la consulta...');
                                                    let path = `/${info.category}`;
                                                    if (info.category === 'reniec') path = '/';
                                                    if (info.category === 'telefonos') path = '/telefono';

                                                    const searchState = info.category === 'reniec'
                                                        ? { autoSearch: item.search_term, type: item.search_type }
                                                        : { autoDni: item.search_term, autoOption: item.search_type };
                                                    navigate(path, { state: searchState });
                                                }}
                                                aria-label={`Repetir consulta ${item.search_term}`}
                                                className="shrink-0 inline-flex items-center justify-center gap-1.5 min-h-[44px] min-w-[44px] sm:px-4 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-blue-600 hover:text-white active:scale-95 transition-all"
                                            >
                                                <span className="hidden sm:inline text-xs font-black uppercase tracking-wide">Ver de nuevo</span>
                                                <span className="material-icons-round text-lg" aria-hidden="true">arrow_forward</span>
                                            </button>
                                        </div>
                                    </motion.div>
                                );
                            })
                        )}
                    </AnimatePresence>
                </div>
            )}
        </div>
    );
}

export default function UserHistory() {
    return (
        <div className="w-full max-w-5xl mx-auto pb-20">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-slate-900 rounded-3xl md:rounded-[2.5rem] shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden"
            >
                <div className="p-5 sm:p-8 md:p-12">
                    <header className="flex items-center gap-3 sm:gap-4 mb-6 md:mb-10">
                        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl sm:rounded-3xl bg-blue-600 flex items-center justify-center text-white shadow-2xl shadow-blue-500/30 shrink-0">
                            <span className="material-icons-round text-2xl sm:text-3xl" aria-hidden="true">history_edu</span>
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">Historial de Búsquedas</h1>
                            <p className="text-slate-500 text-xs sm:text-sm font-medium">Revisa y repite tus consultas anteriores.</p>
                        </div>
                    </header>

                    <HistoryList />
                </div>

                <div className="px-5 sm:px-8 md:px-12 py-5 md:py-6 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tus búsquedas están seguras y solo tú puedes verlas</p>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Bot DNI v2.0.2</span>
                </div>
            </motion.div>
        </div>
    );
}
