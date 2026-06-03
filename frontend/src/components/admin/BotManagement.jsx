import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AlertModal from '../AlertModal';
import ConfirmationModal from './ConfirmationModal';

const BOT_TYPES = [
    { value: 'dni',      label: 'Búsqueda DNI',      icon: 'badge',        color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' },
    { value: 'nombre',   label: 'Búsqueda Nombre',   icon: 'person_search', color: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20' },
    { value: 'operadora',label: 'Verificar Operadora',icon: 'wifi_calling', color: 'text-cyan-600 bg-cyan-50 dark:bg-cyan-900/20' },
    { value: 'todas',    label: 'Todas las opciones', icon: 'hub',          color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20' },
];

// ─── Skeleton Component ───────────────────────────────────────────────────
function BotSkeleton() {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
            {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="h-32 bg-slate-100 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700" />
            ))}
        </div>
    );
}

export default function BotManagement() {
    const [bots, setBots]             = useState([]);
    const [loading, setLoading]       = useState(true);
    const [newUsername, setNewUsername] = useState('');
    const [newType, setNewType]       = useState('dni');
    const [adding, setAdding]         = useState(false);
    const [showForm, setShowForm]     = useState(false);
    const [editingBot, setEditingBot] = useState(null);
    const [filterType, setFilterType] = useState('all');
    const [modal, setModal]           = useState({ isOpen: false, bot: null });
    const [alert, setAlert]           = useState({ isOpen: false, type: 'info', title: '', message: '' });

    useEffect(() => { loadBots(); }, []);

    const loadBots = async () => {
        setLoading(true);
        const token = localStorage.getItem('token');
        try {
            const res = await fetch('/api/admin/bots', { headers: { 'Authorization': `Bearer ${token}` } });
            if (res.ok) setBots((await res.json()).bots || []);
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!newUsername.trim()) return;
        setAdding(true);
        const token = localStorage.getItem('token');
        try {
            const res = await fetch('/api/admin/bots', { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ username: newUsername.trim(), bot_type: newType }) });
            if (res.ok) { setAlert({ isOpen: true, type: 'success', title: '¡Bot registrado!', message: `Bot ${newUsername} añadido.` }); setNewUsername(''); setShowForm(false); loadBots(); }
            else { const err = await res.json(); setAlert({ isOpen: true, type: 'error', title: 'Error', message: err.detail || 'No se pudo registrar.' }); }
        } catch (e) { console.error(e); } finally { setAdding(false); }
    };

    const handleUpdateType = async (bot, newBotType) => {
        const token = localStorage.getItem('token');
        await fetch(`/api/admin/bots/${encodeURIComponent(bot.username)}`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ bot_type: newBotType }) });
        setEditingBot(null); loadBots();
    };

    const handleDelete = async () => {
        if (!modal.bot) return;
        const token = localStorage.getItem('token');
        await fetch(`/api/admin/bots/${encodeURIComponent(modal.bot.username)}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
        setModal({ isOpen: false, bot: null }); loadBots();
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text)
            .then(() => setAlert({ isOpen: true, type: 'info', title: 'Copiado', message: 'Username copiado al portapapeles.' }))
            .catch(() => setAlert({ isOpen: true, type: 'error', title: 'Error', message: 'No se pudo copiar al portapapeles.' }));
    };

    const filtered = filterType === 'all' ? bots : bots.filter(b => b.bot_type === filterType);

    return (
        <div className="space-y-6 w-full">
            <AlertModal isOpen={alert.isOpen} onClose={() => setAlert({ ...alert, isOpen: false })} title={alert.title} message={alert.message} type={alert.type} />
            <ConfirmationModal isOpen={modal.isOpen} onClose={() => setModal({ isOpen: false, bot: null })} onConfirm={handleDelete} title="Eliminar Bot" message={`¿Eliminar el bot ${modal.bot?.username}?`} type="danger" />

            {/* Header */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                    <h2 className="text-lg md:text-2xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent uppercase tracking-tight">Gestión de Bots</h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-1 text-xs md:text-sm font-medium">Controla los agentes de Telegram que procesan las búsquedas.</p>
                </div>
                <div className="flex flex-row items-center gap-2 w-full lg:w-auto mt-2 lg:mt-0">
                    <button onClick={loadBots} className={`w-[46px] h-[46px] shrink-0 flex items-center justify-center rounded-2xl bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm active:scale-90 ${loading ? 'animate-spin' : ''}`}>
                        <span className="material-icons-round text-slate-400">refresh</span>
                    </button>
                    <button onClick={() => setShowForm(v => !v)} className={`flex-1 lg:min-w-[200px] h-[46px] flex items-center justify-center gap-2 ${showForm ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-white' : 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'} rounded-2xl font-black text-[11px] md:text-xs uppercase tracking-widest transition-all active:scale-95`}>
                        <span className="material-icons-round text-[18px] md:text-[20px]">{showForm ? 'close' : 'add'}</span>
                        <span className="hidden xs:inline">{showForm ? 'Cancelar' : 'Añadir Bot'}</span>
                        <span className="xs:hidden">{showForm ? 'Cerrar' : 'Añadir'}</span>
                    </button>
                </div>
            </div>

            <AnimatePresence>
                {showForm && (
                    <motion.form onSubmit={handleAdd} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                        className="bg-white dark:bg-slate-800 border-2 border-blue-100 dark:border-blue-900/30 rounded-3xl p-6 space-y-5 shadow-xl">
                        <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-700 pb-4">
                            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center">
                                <span className="material-icons-round text-[22px]">smart_toy</span>
                            </div>
                            <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-tight">Configurar Nuevo Agente</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Username en Telegram</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">@</span>
                                    <input value={newUsername} onChange={e => setNewUsername(e.target.value)} placeholder="username_bot"
                                        className="w-full pl-8 pr-4 py-3 rounded-2xl border-2 border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:border-blue-500 outline-none text-sm font-bold dark:text-white transition-all" required />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipo de Especialidad</label>
                                <select value={newType} onChange={e => setNewType(e.target.value)}
                                    className="w-full px-4 py-3 rounded-2xl border-2 border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:border-blue-500 outline-none text-sm font-bold dark:text-white transition-all appearance-none cursor-pointer">
                                    {BOT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="flex justify-end pt-2">
                            <button type="submit" disabled={adding} className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest rounded-2xl text-[11px] shadow-lg shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-50">
                                {adding ? 'Registrando...' : 'Confirmar Registro'}
                            </button>
                        </div>
                    </motion.form>
                )}
            </AnimatePresence>

            {/* Category Filter Chips */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-3 px-3 md:mx-0 md:px-0">
                {[{ value: 'all', label: 'Todos los Bots', icon: 'apps' }, ...BOT_TYPES].map(t => (
                    <button key={t.value} onClick={() => setFilterType(t.value)}
                        className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-full text-[10px] md:text-[10px] font-black uppercase tracking-widest border transition-all shrink-0
                            ${filterType === t.value 
                                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white shadow-md' 
                                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-400'}`}>
                        <span className="material-icons-round text-[16px]">{t.icon || 'smart_toy'}</span>
                        <span className="whitespace-nowrap">{t.label}</span>
                    </button>
                ))}
            </div>

            {/* Bots Grid */}
            {loading ? (
                <BotSkeleton />
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.length === 0 && (
                        <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-3xl gap-3">
                            <span className="material-icons-round text-4xl opacity-20">smart_toy</span>
                            <p className="text-xs font-black uppercase tracking-widest">No hay bots en esta categoría</p>
                        </div>
                    )}
                    {filtered.map((bot) => {
                        const typeInfo = BOT_TYPES.find(t => t.value === bot.bot_type) || BOT_TYPES[0];
                        const isEditing = editingBot === bot.username;
                        return (
                            <motion.div key={bot.username} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                                className={`bg-white dark:bg-slate-800 p-5 rounded-3xl border-2 shadow-sm flex flex-col gap-4 relative group transition-all hover:shadow-md
                                    ${bot.locked ? 'border-amber-100 dark:border-amber-900/30' : 'border-slate-100 dark:border-slate-700/50'}`}>
                                
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className={`w-12 h-12 rounded-2xl ${typeInfo.color} flex items-center justify-center shrink-0`}>
                                            <span className="material-icons-round text-2xl">{typeInfo.icon}</span>
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-1">
                                                <p className="font-black text-sm truncate text-slate-900 dark:text-white uppercase tracking-tight">@{bot.username.replace(/^@/, '')}</p>
                                                <button onClick={() => copyToClipboard(bot.username)} className="p-1 text-slate-300 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                    <span className="material-icons-round text-[14px]">content_copy</span>
                                                </button>
                                            </div>
                                            <div className="flex items-center gap-1.5 mt-1">
                                                <div className={`w-2 h-2 rounded-full ${bot.locked ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]'}`} />
                                                <span className={`text-[10px] font-black uppercase tracking-widest ${bot.locked ? 'text-amber-600' : 'text-emerald-600'}`}>
                                                    {bot.locked ? 'Ocupado' : 'Disponible'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {!isEditing && (
                                        <div className="flex flex-col gap-1 shrink-0 ml-2">
                                            <button onClick={() => setEditingBot(bot.username)} className="w-9 h-9 flex items-center justify-center shrink-0 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-500 transition-all active:scale-90" title="Gestionar">
                                                <span className="material-icons-round text-[20px]">tune</span>
                                            </button>
                                            <button onClick={() => setModal({ isOpen: true, bot })} className="w-9 h-9 flex items-center justify-center shrink-0 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400 transition-all active:scale-90" title="Eliminar">
                                                <span className="material-icons-round text-[18px]">delete</span>
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {isEditing ? (
                                    <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 pt-2">
                                        <select defaultValue={bot.bot_type} id={`type-${bot.username}`} 
                                            className="flex-1 min-w-0 h-10 px-2 sm:px-3 rounded-xl border-2 border-blue-100 dark:border-blue-900/30 bg-slate-50 dark:bg-slate-900 text-xs font-bold dark:text-white outline-none focus:border-blue-500">
                                            {BOT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                        </select>
                                        <button onClick={() => handleUpdateType(bot, document.getElementById(`type-${bot.username}`).value)} className="h-10 px-3 sm:px-4 shrink-0 bg-blue-600 text-white rounded-xl text-xs font-black shadow-lg shadow-blue-500/20 active:scale-95 whitespace-nowrap">OK</button>
                                        <button onClick={() => setEditingBot(null)} className="h-10 w-10 shrink-0 flex items-center justify-center bg-slate-100 dark:bg-slate-700 rounded-xl text-xs font-bold text-slate-500 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">✕</button>
                                    </motion.div>
                                ) : (
                                    <div className="mt-auto pt-2 flex items-center justify-between border-t border-slate-50 dark:border-slate-700/50">
                                        <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-lg ${typeInfo.color}`}>
                                            {typeInfo.label}
                                        </span>
                                        <div className="text-[9px] font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1">
                                            <span className="material-icons-round text-[12px]">verified</span>
                                            SISTEMA ACTIVO
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
