import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const HIST_TYPE_INFO = {
    dni:                 { icon: 'badge',          label: 'DNI Básico',      color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
    dni_premium:         { icon: 'verified_user',   label: 'DNI Premium',     color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
    name:                { icon: 'person_search',   label: 'Búsq. Nombre',    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' },
    reniec_c4_azul:      { icon: 'article',         label: 'C4 Azul Onyx',    color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300' },
    reniec_inscripcion:  { icon: 'assignment',      label: 'Inscripción',     color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300' },
    reniec_dni_azul:     { icon: 'credit_card',     label: 'DNI Azul',        color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300' },
    reniec_dni_amarillo: { icon: 'credit_card',     label: 'DNI Amarillo',    color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300' },
    familiares_pdf:      { icon: 'family_restroom', label: 'Familiares PDF',  color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
    familiares_texto:    { icon: 'family_restroom', label: 'Familiares Texto',color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
    telefono_numeros_dni:{ icon: 'phone_in_talk',   label: 'Números x DNI',   color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300' },
    telefono_info_linea: { icon: 'sim_card',        label: 'Info Línea',      color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' },
    telefono_verificador:{ icon: 'wifi_calling',    label: 'Operadora',       color: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' },
    telefono_titular:    { icon: 'contact_phone',   label: 'Titular',         color: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/40 dark:text-fuchsia-300' },
    busqueda_facial:     { icon: 'face',            label: 'Búsq. Facial',    color: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300' },
    delitos_dni:         { icon: 'gavel',           label: 'Delitos (DNI)',   color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
    delitos_placa:       { icon: 'directions_car',  label: 'Delitos (Placa)', color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300' },
    fiscalia_dni:        { icon: 'badge',           label: 'Fiscalía (DNI)',  color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
    fiscalia_nombre:     { icon: 'person_search',   label: 'Fiscalía (Nom)',  color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' },
    fiscalia_ruc:        { icon: 'domain',          label: 'Fiscalía (RUC)',  color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
    caso_fiscal:         { icon: 'gavel',           label: 'Caso Fiscal',     color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
    policiales_antpo:    { icon: 'local_police',    label: 'Antecedentes Pol.',color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' },
    policiales_antpol:   { icon: 'local_police',    label: 'Antecedentes Pol.',color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' },
    penales_antpen:      { icon: 'policy',          label: 'Antecedentes Pen.',color: 'bg-stone-100 text-stone-700 dark:bg-stone-900/40 dark:text-stone-300' },
};

const HIST_FILTERS = [
    { id: 'todos',       label: 'Todos',        icon: 'all_inclusive' },
    { id: 'RENIEC',      label: 'RENIEC',       icon: 'badge', types: ['dni', 'dni_premium', 'name'] },
    { id: 'Generador',   label: 'Generador',    icon: 'description', types: ['reniec_c4_azul', 'reniec_inscripcion', 'reniec_dni_azul', 'reniec_dni_amarillo'] },
    { id: 'Familiares',  label: 'Familiares',   icon: 'group', types: ['familiares_pdf', 'familiares_texto'] },
    { id: 'Telefonos',   label: 'Teléfonos',    icon: 'sensors', types: ['telefono_numeros_dni', 'telefono_info_linea', 'telefono_verificador', 'telefono_titular'] },
    { id: 'Facial',      label: 'Facial',       icon: 'face', types: ['busqueda_facial'] },
    { id: 'Delitos',     label: 'Delitos',      icon: 'gavel', types: ['delitos_dni', 'delitos_placa', 'antper'] },
    { id: 'Fiscalía',    label: 'Fiscalía',     icon: 'balance', types: ['fiscalia_dni', 'fiscalia_nombre', 'fiscalia_ruc', 'caso_fiscal'] },
    { id: 'Policiales',  label: 'Policiales',   icon: 'local_police', types: ['policiales_antpo', 'policiales_antpol', 'penales_antpen'] },
];

// ─── Skeleton Component ───────────────────────────────────────────────────
function HistoryModal({ h, onClose }) {
    const info = HIST_TYPE_INFO[h.search_type] || { icon: 'search', label: h.search_type, color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' };
    const [ipInfo, setIpInfo] = useState(null);
    const [loadingIp, setLoadingIp] = useState(false);

    useEffect(() => {
        if (h.ip_address && h.ip_address !== '—') {
            const fetchIpInfo = async () => {
                setLoadingIp(true);
                try {
                    const res = await fetch(`https://ip.guide/${h.ip_address}`);
                    if (res.ok) {
                        const data = await res.json();
                        setIpInfo(data);
                    }
                } catch (err) {
                    console.error("Error fetching IP info:", err);
                } finally {
                    setLoadingIp(false);
                }
            };
            fetchIpInfo();
        }
    }, [h.ip_address]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}>
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800"
            >
                {/* Modal Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${info.color.split(' ')[0]} ${info.color.split(' ')[2] || ''}`}>
                            <span className="material-icons-round text-2xl">{info.icon}</span>
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Detalles del Registro</h3>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">ID de búsqueda: {h.id || 'N/A'}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                        <span className="material-icons-round">close</span>
                    </button>
                </div>

                {/* Modal Body */}
                <div className="p-6 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600 space-y-8">
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Grupo 1: Búsqueda y Usuario */}
                        <div className="space-y-4">
                            <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                <span className="material-icons-round text-[16px]">person_search</span>
                                Búsqueda y Usuario
                            </h4>
                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-700/50 space-y-3">
                                <DetailItem label="Término de Búsqueda" value={h.search_term} highlight />
                                <DetailItem label="Tipo de Servicio" value={info.label} />
                                <DetailItem label="Email de Usuario" value={h.user_email || 'No registrado'} />
                                <DetailItem label="Nombre de Usuario" value={h.user_name || 'No registrado'} />
                                <DetailItem label="Fecha de Acceso" value={new Date(h.created_at).toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'America/Lima' })} />
                                <DetailItem label="Hora de Acceso" value={new Date(h.created_at).toLocaleTimeString('es-PE', { timeZone: 'America/Lima' })} />
                            </div>
                        </div>

                        {/* Grupo 2: Red y Ubicación */}
                        <div className="space-y-4">
                            <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                <span className="material-icons-round text-[16px]">public</span>
                                Red y Ubicación
                            </h4>
                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-700/50 space-y-3">
                                <DetailItem label="Dirección IP" value={h.ip_address || 'Desconocida'} highlight />
                                <DetailItem label="País" value={loadingIp ? 'Cargando...' : (ipInfo?.location?.country || 'No disponible')} />
                                <DetailItem label="Ciudad Aproximada" value={loadingIp ? 'Cargando...' : (ipInfo?.location?.city || 'No disponible')} />
                                <DetailItem label="Proveedor de Internet" value={loadingIp ? 'Cargando...' : (ipInfo?.network?.autonomous_system?.organization || 'No disponible')} />
                            </div>
                        </div>

                        {/* Grupo 3: Dispositivo y Navegador */}
                        <div className="space-y-4">
                            <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                <span className="material-icons-round text-[16px]">devices</span>
                                Dispositivo y Navegador
                            </h4>
                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-700/50 space-y-3">
                                <DetailItem label="Tipo de Dispositivo" value={h.device || 'Desconocido'} />
                                <DetailItem label="Sistema Operativo" value={h.os || 'Desconocido'} />
                                <DetailItem label="Navegador y Versión" value={h.browser || 'Desconocido'} />
                                <DetailItem label="Resolución de Pantalla" value="No registrada" />
                                <DetailItem label="Idioma del Navegador" value="No registrado" />
                            </div>
                        </div>

                        {/* Grupo 4: Sesión y Navegación */}
                        <div className="space-y-4">
                            <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                <span className="material-icons-round text-[16px]">travel_explore</span>
                                Navegación y Rendimiento
                            </h4>
                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-700/50 space-y-3">
                                <DetailItem label="Referencia (Referrer)" value="Directo / No disponible" />
                                <DetailItem label="Páginas Visitadas" value="1 (Solo registro actual)" />
                                <DetailItem label="Tiempo en Página" value="No registrado" />
                                <DetailItem label="Clicks en la web" value="No registrado" />
                                <DetailItem label="Cookies y Sesiones" value="Activas" />
                                <DetailItem label="ID de Sesión" value="No registrado" />
                                <DetailItem label="Errores de Navegador" value="Ninguno registrado" />
                                <DetailItem label="Velocidad de Carga" value="No registrada" />
                            </div>
                        </div>
                    </div>
                    
                    {/* User Agent Raw */}
                    {h.user_agent && (
                        <div className="space-y-2 mt-4">
                            <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">User Agent Raw</h4>
                            <div className="bg-slate-900 rounded-xl p-3 border border-slate-800">
                                <p className="text-[11px] font-mono text-slate-400 break-all">{h.user_agent}</p>
                            </div>
                        </div>
                    )}

                </div>
            </motion.div>
        </div>
    );
}

function DetailItem({ label, value, highlight }) {
    return (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between py-1 gap-1 sm:gap-4 border-b border-slate-200/50 dark:border-slate-700/50 last:border-0">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{label}</span>
            <span className={`text-sm ${highlight ? 'font-black text-blue-600 dark:text-blue-400 font-mono' : 'font-medium text-slate-900 dark:text-slate-200'} text-right truncate max-w-[200px] sm:max-w-[300px]`} title={value}>
                {value}
            </span>
        </div>
    );
}

function HistorySkeleton() {
    return (
        <div className="space-y-2 animate-pulse">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                <div key={i} className="h-12 bg-slate-100 dark:bg-slate-800/50 rounded-xl" />
            ))}
        </div>
    );
}

export default function HistorialAdmin() {
    const [history, setHistory]           = useState([]);
    const [loading, setLoading]           = useState(true);
    const [search, setSearch]             = useState('');
    const [activeFilter, setActiveFilter] = useState('todos');
    const [dateFilter, setDateFilter]     = useState('all');
    const [userFilter, setUserFilter]     = useState('all');
    const [selectedHistory, setSelectedHistory] = useState(null);

    useEffect(() => { loadHistory(); }, []);

    const loadHistory = async () => {
        setLoading(true);
        const token = localStorage.getItem('token');
        try {
            const res = await fetch('/api/admin/history?limit=300', { headers: { 'Authorization': `Bearer ${token}` } });
            if (res.ok) setHistory(await res.json());
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    const filtered = useMemo(() => {
        const cat = HIST_FILTERS.find(f => f.id === activeFilter);
        let list = history;
        
        // Tipo de búsqueda
        if (cat?.types) list = list.filter(h => cat.types.includes(h.search_type));
        
        // Fecha
        if (dateFilter !== 'all') {
            const now = new Date();
            const past = new Date();
            if (dateFilter === 'today') past.setHours(0,0,0,0);
            else if (dateFilter === '7d') past.setDate(now.getDate() - 7);
            else if (dateFilter === '30d') past.setDate(now.getDate() - 30);
            list = list.filter(h => new Date(h.created_at) >= past);
        }

        // Usuario
        if (userFilter === 'registered') list = list.filter(h => h.user_email);
        if (userFilter === 'guest') list = list.filter(h => !h.user_email);

        // Búsqueda de texto
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(h => h.search_term?.toLowerCase().includes(q) || h.user_email?.toLowerCase().includes(q) || h.search_type?.toLowerCase().includes(q));
        }
        return list;
    }, [history, activeFilter, dateFilter, userFilter, search]);

    return (
        <div className="space-y-6 w-full">
            {/* Header */}
            <div className="flex flex-col gap-3 md:gap-4">
                <div>
                    <h2 className="text-lg md:text-2xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent uppercase tracking-tight">Registro de Auditoría</h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-1 text-xs md:text-sm font-medium">Monitoreo en tiempo real de las últimas 300 transacciones.</p>
                </div>
                <div className="flex items-center gap-2 w-full">
                    <div className="relative flex-1 group">
                        <span className="material-icons-round absolute left-3 md:left-4 top-1/2 -translate-y-1/2 text-slate-400 text-base md:text-lg transition-colors group-focus-within:text-blue-500">search</span>
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..."
                            className="w-full pl-10 md:pl-11 pr-3 md:pr-4 h-[42px] md:h-[46px] rounded-xl md:rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 outline-none focus:border-blue-500 text-xs md:text-[13px] font-bold dark:text-white transition-all shadow-sm" />
                    </div>
                    <button onClick={loadHistory} className={`w-[42px] h-[42px] md:w-[46px] md:h-[46px] shrink-0 flex items-center justify-center rounded-xl md:rounded-2xl bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm active:scale-90 ${loading ? 'animate-spin' : ''}`}>
                        <span className="material-icons-round text-slate-400 text-lg md:text-xl">refresh</span>
                    </button>
                </div>
            </div>

            {/* Filtros Dropdown */}
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                <div className="flex-1 w-full flex flex-col sm:flex-row gap-3">
                    <div className="flex-1 relative">
                        <span className="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">filter_alt</span>
                        <select 
                            value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)}
                            className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none focus:border-blue-500 appearance-none cursor-pointer"
                        >
                            {HIST_FILTERS.map(f => (
                                <option key={f.id} value={f.id}>{f.label}</option>
                            ))}
                        </select>
                        <span className="material-icons-round absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">expand_more</span>
                    </div>

                    <div className="flex-1 relative">
                        <span className="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">calendar_today</span>
                        <select 
                            value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}
                            className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none focus:border-blue-500 appearance-none cursor-pointer"
                        >
                            <option value="all">Cualquier Fecha</option>
                            <option value="today">Hoy</option>
                            <option value="7d">Últimos 7 días</option>
                            <option value="30d">Últimos 30 días</option>
                        </select>
                        <span className="material-icons-round absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">expand_more</span>
                    </div>

                    <div className="flex-1 relative">
                        <span className="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">person</span>
                        <select 
                            value={userFilter} onChange={(e) => setUserFilter(e.target.value)}
                            className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none focus:border-blue-500 appearance-none cursor-pointer"
                        >
                            <option value="all">Todos los usuarios</option>
                            <option value="registered">Registrados</option>
                            <option value="guest">Invitados (Sin registro)</option>
                        </select>
                        <span className="material-icons-round absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">expand_more</span>
                    </div>
                </div>
                
                <div className="shrink-0 flex items-center justify-center px-4 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 text-xs font-black uppercase text-blue-600 dark:text-blue-400 tracking-widest min-w-[120px]">
                    <span className="material-icons-round text-sm mr-1">list_alt</span>
                    {filtered.length} reg.
                </div>
            </div>

            {/* ── Tabla (desktop) ───────────────────────────────────── */}
            <div className="hidden md:block bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="overflow-x-auto max-h-[65vh] scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600 scrollbar-track-transparent">
                    <table className="w-full text-left border-collapse min-w-[900px]">
                        <thead>
                            <tr className="bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800">
                                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Servicio</th>
                                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Búsqueda</th>
                                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Usuario</th>
                                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Red / Dispositivo</th>
                                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 text-right">Fecha y Hora</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-10"><HistorySkeleton /></td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-24 text-center">
                                        <div className="flex flex-col items-center opacity-20">
                                            <span className="material-icons-round text-6xl">cloud_off</span>
                                            <p className="text-sm font-black uppercase tracking-widest mt-4">Sin registros</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : filtered.map((h, i) => {
                                const info = HIST_TYPE_INFO[h.search_type] || { icon: 'search', label: h.search_type, color: 'bg-slate-100 text-slate-600' };
                                return (
                                    <motion.tr 
                                        initial={{ opacity: 0, y: 10 }} 
                                        animate={{ opacity: 1, y: 0 }} 
                                        transition={{ delay: i < 20 ? i * 0.01 : 0 }}
                                        key={h.id || i} 
                                        onClick={() => setSelectedHistory(h)}
                                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-all group cursor-pointer"
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${info.color.split(' ')[0]} ${info.color.split(' ')[2] || ''} group-hover:scale-110 transition-transform`}>
                                                    <span className="material-icons-round text-sm">{info.icon}</span>
                                                </div>
                                                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-tighter">
                                                    {info.label}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="font-mono text-[13px] font-bold text-slate-900 dark:text-white tracking-tighter">
                                                {h.search_term}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-black border ${h.user_email ? 'bg-blue-50 text-blue-500 border-blue-200 dark:bg-blue-900/30 dark:border-blue-800' : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:border-slate-700'}`}>
                                                    {h.user_email ? h.user_email.charAt(0).toUpperCase() : '?'}
                                                </div>
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{h.user_name || (h.user_email ? 'Sin nombre' : 'No registrado')}</span>
                                                    <span className="text-[10px] text-slate-400 font-medium truncate">{h.user_email || 'Visitante anónimo'}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1.5">
                                                <span className="text-[11px] font-mono font-bold text-slate-400 bg-slate-50 dark:bg-slate-800/50 px-2.5 py-1 rounded-lg border border-slate-100 dark:border-slate-700/50 w-fit">
                                                    {h.ip_address || '—'}
                                                </span>
                                                {(h.device || h.browser || h.os) && (
                                                    <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-500 dark:text-slate-400">
                                                        {h.device && (
                                                            <span className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded" title="Dispositivo">
                                                                <span className="material-icons-round text-[12px]">{h.device === 'Mobile' ? 'smartphone' : h.device === 'Tablet' ? 'tablet_mac' : 'computer'}</span>
                                                                {h.device}
                                                            </span>
                                                        )}
                                                        {h.os && (
                                                            <span className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded" title="Sistema">
                                                                {h.os}
                                                            </span>
                                                        )}
                                                        {h.browser && (
                                                            <span className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded" title="Navegador">
                                                                <span className="material-icons-round text-[12px]">language</span>
                                                                {h.browser}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex flex-col items-end">
                                                <span className="text-[11px] font-black text-slate-600 dark:text-slate-300 tracking-tighter">
                                                    {new Date(h.created_at).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Lima' })}
                                                </span>
                                                <span className="text-[10px] text-slate-400 font-mono opacity-70">
                                                    {new Date(h.created_at).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima' })}
                                                </span>
                                            </div>
                                        </td>
                                    </motion.tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── Vista Cards (móvil) ───────────────────────────────── */}
            <div className="md:hidden space-y-2">
                {loading ? (
                    <HistorySkeleton />
                ) : filtered.length === 0 ? (
                    <div className="py-16 flex flex-col items-center gap-3 text-slate-400 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl">
                        <span className="material-icons-round text-5xl opacity-20">cloud_off</span>
                        <p className="text-xs font-black uppercase tracking-widest">Sin registros</p>
                    </div>
                ) : filtered.map((h, i) => {
                    const info = HIST_TYPE_INFO[h.search_type] || { icon: 'search', label: h.search_type, color: 'bg-slate-100 text-slate-600' };
                    const colorParts = info.color.split(' ');
                    const bgCls = colorParts[0] || 'bg-slate-100';
                    const textCls = colorParts[1] || 'text-slate-600';
                    const darkBgCls = colorParts[2] || '';
                    const darkTextCls = colorParts[3] || '';
                    return (
                        <motion.div
                            key={h.id || i}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i < 30 ? i * 0.015 : 0 }}
                            onClick={() => setSelectedHistory(h)}
                            className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-3 flex items-start gap-3 cursor-pointer hover:border-blue-500/50 transition-colors"
                        >
                            {/* Icono de tipo */}
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${bgCls} ${darkBgCls}`}>
                                <span className={`material-icons-round text-[18px] ${textCls} ${darkTextCls}`}>{info.icon}</span>
                            </div>

                            {/* Contenido */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="font-mono text-sm font-bold text-slate-900 dark:text-white truncate">{h.search_term}</p>
                                        <p className={`text-[9px] font-black uppercase tracking-widest mt-0.5 ${textCls} ${darkTextCls}`}>{info.label}</p>
                                    </div>
                                    <span className="text-[9px] font-mono text-slate-400 shrink-0 whitespace-nowrap">
                                        {new Date(h.created_at).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', timeZone: 'America/Lima' })}
                                        {' '}{new Date(h.created_at).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima' })}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 truncate max-w-[140px]">{h.user_email || 'No registrado'}</span>
                                    {h.ip_address && (
                                        <span className="text-[9px] font-mono text-slate-400 bg-slate-50 dark:bg-slate-900/50 px-1.5 py-0.5 rounded border border-slate-100 dark:border-slate-700 shrink-0">{h.ip_address}</span>
                                    )}
                                    {h.device && (
                                        <span className="text-[9px] font-medium text-slate-400 bg-slate-50 dark:bg-slate-900/50 px-1.5 py-0.5 rounded border border-slate-100 dark:border-slate-700 shrink-0 flex items-center gap-0.5">
                                            <span className="material-icons-round text-[10px]">{h.device === 'Mobile' ? 'smartphone' : 'computer'}</span> {h.os || h.device}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            {/* Modal de Detalles */}
            <AnimatePresence>
                {selectedHistory && (
                    <HistoryModal h={selectedHistory} onClose={() => setSelectedHistory(null)} />
                )}
            </AnimatePresence>
        </div>
    );
}
