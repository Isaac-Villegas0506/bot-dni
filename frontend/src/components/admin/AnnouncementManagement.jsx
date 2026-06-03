import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmationModal from './ConfirmationModal';

const FREQUENCIES = [
    { value: 15,   label: 'Cada 15 minutos' },
    { value: 30,   label: 'Cada 30 minutos' },
    { value: 60,   label: 'Cada 1 hora' },
    { value: 120,  label: 'Cada 2 horas' },
    { value: 360,  label: 'Cada 6 horas' },
    { value: 720,  label: 'Cada 12 horas' },
    { value: 1440, label: 'Cada 24 horas' },
];

// ─── Skeleton Component ───────────────────────────────────────────────────
function AnnouncementSkeleton() {
    return (
        <div className="space-y-3 animate-pulse">
            {[1, 2, 3].map(i => (
                <div key={i} className="h-28 bg-slate-100 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700" />
            ))}
        </div>
    );
}

export default function AnnouncementManagement() {
    const [announcements, setAnnouncements] = useState([]);
    const [loading, setLoading]       = useState(true);
    const [title, setTitle]           = useState('');
    const [msg, setMsg]               = useState('');
    const [frequency, setFrequency]   = useState(60);
    const [isCreating, setIsCreating] = useState(false);
    const [modal, setModal]           = useState({ isOpen: false, idToDelete: null });

    useEffect(() => { loadAnn(); }, []);

    const loadAnn = async () => {
        setLoading(true);
        const token = localStorage.getItem('token');
        try {
            const res = await fetch('/api/admin/announcements', { headers: { 'Authorization': `Bearer ${token}` } });
            if (res.ok) setAnnouncements(await res.json());
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    const create = async (e) => {
        e.preventDefault();
        const token = localStorage.getItem('token');
        await fetch('/api/admin/announcements', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, message: msg, frequency_minutes: Number(frequency) })
        });
        setTitle(''); setMsg(''); setFrequency(60); setIsCreating(false); loadAnn();
    };

    const handleDelete = async () => {
        if (!modal.idToDelete) return;
        const token = localStorage.getItem('token');
        await fetch(`/api/admin/announcements/${modal.idToDelete}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
        setModal({ isOpen: false, idToDelete: null });
        loadAnn();
    };

    const toggleStatus = async (ann) => {
        const token = localStorage.getItem('token');
        await fetch(`/api/admin/announcements/${ann.id}/status`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_active: !ann.is_active })
        });
        loadAnn();
    };

    return (
        <div className="space-y-6 w-full">
            <ConfirmationModal isOpen={modal.isOpen} onClose={() => setModal({ ...modal, isOpen: false })} onConfirm={handleDelete}
                title="Eliminar Anuncio" message="¿Estás seguro de eliminar este comunicado permanentemente?" type="danger" />

            {/* Header */}
            <div className="flex flex-col gap-3">
                <div>
                    <h2 className="text-lg md:text-2xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent uppercase tracking-tight">Comunicados Globales</h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-1 text-xs md:text-sm font-medium">Gestiona los avisos que aparecen en la parte superior del bot.</p>
                </div>
                <button
                    onClick={() => setIsCreating(true)}
                    aria-expanded={isCreating}
                    aria-label="Crear nuevo aviso"
                    className={`w-full sm:w-fit min-h-[44px] flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 shadow-lg
                        ${isCreating ? 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400' : 'bg-blue-600 text-white shadow-blue-500/20'}`}>
                    <span className="material-icons-round text-[20px]" aria-hidden="true">add_alert</span>
                    <span className="hidden xs:inline">Crear Aviso</span>
                    <span className="xs:hidden">Nuevo</span>
                </button>
            </div>

            <AnimatePresence>
                {isCreating && (
                    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20, scale: 0.95 }}>
                        <form onSubmit={create} className="bg-white dark:bg-slate-800 p-4 md:p-6 rounded-2xl md:rounded-3xl shadow-xl border-2 border-blue-50 dark:border-blue-900/20 space-y-4 md:space-y-5">
                            <div className="flex justify-between items-center border-b border-slate-50 dark:border-slate-700/50 pb-3 md:pb-4">
                                <h3 className="font-black flex items-center gap-2 text-sm md:text-base text-slate-900 dark:text-white uppercase tracking-tighter">
                                    <span className="material-icons-round text-blue-500 text-lg md:text-xl" aria-hidden="true">campaign</span>
                                    <span className="hidden xs:inline">Nuevo Comunicado</span>
                                    <span className="xs:hidden">Nuevo</span>
                                </h3>
                                <button
                                    type="button"
                                    onClick={() => setIsCreating(false)}
                                    aria-label="Cerrar formulario"
                                    className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-all">
                                    <span className="material-icons-round text-xl" aria-hidden="true">close</span>
                                </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Título del Aviso</label>
                                    <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ej: Mantenimiento programado" required
                                        aria-label="Título del aviso"
                                        className="w-full px-3 md:px-4 py-2.5 md:py-3 rounded-xl md:rounded-2xl border-2 border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:border-blue-500 outline-none text-xs md:text-sm font-bold dark:text-white transition-all" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Frecuencia de Repetición</label>
                                    <select value={frequency} onChange={e => setFrequency(e.target.value)}
                                        aria-label="Frecuencia de repetición"
                                        className="w-full px-3 md:px-4 py-2.5 md:py-3 rounded-xl md:rounded-2xl border-2 border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:border-blue-500 outline-none text-xs md:text-sm font-bold dark:text-white transition-all appearance-none cursor-pointer">
                                        {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <div className="flex justify-between items-center px-1">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Mensaje Detallado</label>
                                    <span
                                        aria-live="polite"
                                        aria-label={`${msg.length} de 340 caracteres`}
                                        className={`text-xs font-black tabular-nums ${msg.length > 300 ? 'text-amber-500 dark:text-amber-400' : 'text-slate-400'}`}>
                                        {msg.length}/340
                                    </span>
                                </div>
                                <textarea value={msg} onChange={e => setMsg(e.target.value.slice(0, 340))} placeholder="Escribe el contenido del mensaje..." required
                                    aria-label="Contenido del mensaje"
                                    className="w-full px-3 md:px-4 py-2.5 md:py-3 rounded-xl md:rounded-2xl border-2 border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 min-h-[120px] focus:border-blue-500 outline-none text-xs md:text-sm font-medium dark:text-white resize-y transition-all" />
                            </div>
                            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 md:gap-3 pt-2">
                                <button type="button" onClick={() => setIsCreating(false)}
                                    className="min-h-[44px] px-4 md:px-6 py-2.5 md:py-3 text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl md:rounded-2xl transition-all">
                                    Descartar
                                </button>
                                <button type="submit"
                                    className="min-h-[44px] px-6 md:px-8 py-2.5 md:py-3 text-xs font-black uppercase tracking-widest bg-blue-600 text-white rounded-xl md:rounded-2xl hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all active:scale-95">
                                    Publicar Aviso
                                </button>
                            </div>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>

            {loading ? (
                <AnnouncementSkeleton />
            ) : (
                <div className="space-y-3">
                    <AnimatePresence mode="popLayout">
                        {announcements.map(a => (
                            <motion.div
                                key={a.id}
                                layout
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className={`p-5 rounded-3xl border-2 transition-all group relative overflow-hidden
                                    ${a.is_active
                                        ? 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md hover:border-blue-200 dark:hover:border-blue-900/50'
                                        : 'bg-slate-50 dark:bg-slate-900/30 border-slate-100 dark:border-slate-800/50 opacity-60'}`}>

                                <div className="flex flex-col md:flex-row gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${a.is_active ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'}`}
                                                aria-hidden="true">
                                                <span className="material-icons-round text-lg">{a.is_active ? 'campaign' : 'notifications_paused'}</span>
                                            </div>
                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                                <h3 className={`font-black text-sm uppercase tracking-tight truncate ${a.is_active ? 'text-slate-900 dark:text-white' : 'text-slate-500'}`}>{a.title}</h3>
                                                {a.is_active && (
                                                    <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 text-[10px] font-black uppercase tracking-widest ring-1 ring-emerald-500/20 shrink-0">
                                                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" aria-hidden="true" />
                                                        En Vivo
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <p className={`text-sm leading-relaxed font-medium ${a.is_active ? 'text-slate-600 dark:text-slate-300' : 'text-slate-500'}`}>{a.message}</p>
                                        <div className="flex flex-wrap items-center gap-4 mt-4 text-xs font-black uppercase tracking-widest text-slate-400">
                                            <span className="flex items-center gap-1.5">
                                                <span className="material-icons-round text-sm" aria-hidden="true">event</span>
                                                {new Date(a.created_at).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}
                                            </span>
                                            <span className="flex items-center gap-1.5">
                                                <span className="material-icons-round text-sm" aria-hidden="true">history</span>
                                                {FREQUENCIES.find(f => f.value === a.frequency_minutes)?.label || `${a.frequency_minutes} min`}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex md:flex-col items-center justify-end gap-2 border-t md:border-t-0 md:border-l border-slate-50 dark:border-slate-700/50 pt-3 md:pt-0 md:pl-4 shrink-0">
                                        <button
                                            onClick={() => toggleStatus(a)}
                                            aria-label={a.is_active ? `Pausar "${a.title}"` : `Reactivar "${a.title}"`}
                                            className={`flex-1 md:flex-none min-h-[44px] flex items-center justify-center gap-2 px-3 py-2 rounded-xl transition-all font-black text-xs uppercase tracking-widest
                                                ${a.is_active
                                                    ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/30'
                                                    : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-900/30'}`}>
                                            <span className="material-icons-round text-lg" aria-hidden="true">{a.is_active ? 'pause_circle' : 'play_circle'}</span>
                                            {a.is_active ? 'Pausar' : 'Activar'}
                                        </button>
                                        <button
                                            onClick={() => setModal({ isOpen: true, idToDelete: a.id })}
                                            aria-label={`Eliminar "${a.title}"`}
                                            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all">
                                            <span className="material-icons-round" aria-hidden="true">delete_outline</span>
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            )}

            {/* Empty state — only shown when not loading, no announcements, and form is closed */}
            {!loading && announcements.length === 0 && !isCreating && (
                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="flex flex-col items-center justify-center text-center py-16 px-6 bg-slate-50 dark:bg-slate-900/20 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-blue-500/20">
                        <span className="material-icons-round text-3xl text-white" aria-hidden="true">campaign</span>
                    </div>
                    <h3 className="text-base font-black text-slate-700 dark:text-slate-200 uppercase tracking-tight mb-2">
                        Todavía no hay comunicados
                    </h3>
                    <p className="text-sm text-slate-400 dark:text-slate-500 max-w-xs leading-relaxed mb-6">
                        Mantén a tus usuarios informados sobre mantenimiento, novedades y actualizaciones del servicio.
                    </p>
                    <button
                        onClick={() => setIsCreating(true)}
                        className="min-h-[44px] flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-blue-500/20">
                        <span className="material-icons-round text-[20px]" aria-hidden="true">add_alert</span>
                        Crear primer comunicado
                    </button>
                </motion.div>
            )}
        </div>
    );
}
