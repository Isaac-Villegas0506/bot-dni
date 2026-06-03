import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AlertModal from '../AlertModal';
import ConfirmationModal from './ConfirmationModal';
import { formatLimaDate, formatLimaTime } from './utils';
import UserDetailPanel from './UserDetailPanel';

// ─── Skeleton Component ───────────────────────────────────────────────────
function TableSkeleton() {
    return (
        <div className="space-y-4 animate-pulse">
            {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-16 bg-slate-100 dark:bg-slate-800/50 rounded-xl" />
            ))}
        </div>
    );
}

export default function UserManagement() {
    const [users, setUsers]               = useState([]);
    const [loading, setLoading]           = useState(false);
    const [selectedUserId, setSelectedUserId] = useState(null);
    const [searchQuery, setSearchQuery]   = useState('');
    const [activeFilter, setActiveFilter] = useState('todos'); // 'todos', 'premium', 'admin', 'banned'
    const [modal, setModal]               = useState({ isOpen: false, title: '', message: '', type: 'warning', action: null });
    const [alert, setAlert]               = useState({ isOpen: false, type: 'info', title: '', message: '' });

    useEffect(() => { loadUsers(); }, []);

    const loadUsers = async () => {
        setLoading(true);
        const token = localStorage.getItem('token');
        try {
            const res = await fetch('/api/admin/users?limit=100', { headers: { 'Authorization': `Bearer ${token}` } });
            const data = await res.json();
            setUsers(data);
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    const confirmAction = (title, message, action, type = 'warning') => setModal({ isOpen: true, title, message, action, type });

    const handleToggleStatus = async (user) => {
        if (user.role === 'admin') {
            setAlert({ isOpen: true, type: 'warning', title: 'Acción Denegada', message: 'No puedes banear a un administrador.' });
            return;
        }
        const newStatus = user.status === 'active' ? 'banned' : 'active';
        const token = localStorage.getItem('token');
        await fetch(`/api/admin/users/${user.id}/status`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });
        loadUsers();
    };

    const handleTogglePremium = async (user) => {
        const token = localStorage.getItem('token');
        await fetch(`/api/admin/users/${user.id}/premium`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_premium: !user.is_premium })
        });
        loadUsers();
    };

    const filteredUsers = useMemo(() => {
        let list = users.filter(u => {
            const q = searchQuery.toLowerCase();
            return (u.full_name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q);
        });

        if (activeFilter === 'premium') list = list.filter(u => u.is_premium);
        if (activeFilter === 'admin')   list = list.filter(u => u.role === 'admin');
        if (activeFilter === 'banned')  list = list.filter(u => u.status !== 'active');

        return list;
    }, [users, searchQuery, activeFilter]);

    const FILTER_CHIPS = [
        { id: 'todos',   label: 'Todos',    icon: 'group' },
        { id: 'premium', label: 'Premium',  icon: 'star' },
        { id: 'admin',   label: 'Admins',   icon: 'admin_panel_settings' },
        { id: 'banned',  label: 'Baneados', icon: 'block' },
    ];

    return (
        <div className="space-y-6 w-full">
            <ConfirmationModal isOpen={modal.isOpen} onClose={() => setModal({ ...modal, isOpen: false })} onConfirm={modal.action} title={modal.title} message={modal.message} type={modal.type} />
            <AlertModal isOpen={alert.isOpen} onClose={() => setAlert({ ...alert, isOpen: false })} title={alert.title} message={alert.message} type={alert.type} />

            {/* Header */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div className="flex items-center gap-4">
                    <div>
                        <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white">Gestión de Usuarios</h2>
                        <p className="text-slate-500 dark:text-slate-400 mt-0.5 text-sm">Administra roles, estados y accesos.</p>
                    </div>
                    <div className="hidden sm:flex bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-3 py-1 rounded-full font-black text-sm">
                        {users.length}
                    </div>
                </div>
                
                <div className="flex flex-row items-center gap-2 w-full lg:w-auto mt-2 lg:mt-0">
                    <div className="relative flex-1 lg:min-w-[320px] group w-full">
                        <span className="material-icons-round absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg transition-colors group-focus-within:text-blue-500">search</span>
                        <input
                            type="text"
                            placeholder="Nombre o correo..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full pl-11 pr-4 h-[46px] bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-2xl focus:border-blue-500 outline-none text-[13px] font-bold dark:text-white transition-all shadow-sm"
                        />
                    </div>
                    <button 
                        onClick={loadUsers} 
                        title="Actualizar" 
                        className={`w-[46px] h-[46px] shrink-0 flex items-center justify-center rounded-2xl bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm active:scale-90 ${loading ? 'animate-spin' : ''}`}
                    >
                        <span className="material-icons-round text-slate-400">refresh</span>
                    </button>
                </div>
            </div>

            {/* Quick Filters */}
            <div
                role="tablist"
                aria-label="Filtrar usuarios"
                className="flex gap-2 overflow-x-auto snap-x snap-mandatory pb-2 scrollbar-hide -mx-3 px-3 md:mx-0 md:px-0"
            >
                {FILTER_CHIPS.map(chip => {
                    const isActive = activeFilter === chip.id;
                    return (
                        <button
                            key={chip.id}
                            role="tab"
                            aria-selected={isActive}
                            onClick={() => setActiveFilter(chip.id)}
                            className={`snap-start shrink-0 min-h-[44px] flex items-center gap-2 px-4 rounded-full text-xs md:text-sm font-bold transition-all border-2
                                ${isActive
                                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white shadow-md'
                                    : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-400'}`}
                        >
                            <span className="material-icons-round text-[18px]" aria-hidden="true">{chip.icon}</span>
                            <span className="whitespace-nowrap">{chip.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* ── Tabla (desktop) ─────────────────────────────────── */}
            <div className="hidden md:block bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden relative">
                <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600 scrollbar-track-transparent">
                    <table className="w-full text-left border-collapse min-w-[860px]">
                        <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-400 dark:text-slate-500 text-[10px] uppercase font-black tracking-widest">
                            <tr>
                                <th className="px-5 py-4 flex items-center gap-2">
                                    <span className="material-icons-round text-[14px]">person</span>
                                    Usuario
                                </th>
                                <th className="px-5 py-4">
                                    <div className="flex items-center gap-2">
                                        <span className="material-icons-round text-[14px]">verified</span>
                                        Estado
                                    </div>
                                </th>
                                <th className="px-5 py-4">
                                    <div className="flex items-center gap-2">
                                        <span className="material-icons-round text-[14px]">stars</span>
                                        Membresía
                                    </div>
                                </th>
                                <th className="px-5 py-4">
                                    <div className="flex items-center gap-2">
                                        <span className="material-icons-round text-[14px]">history</span>
                                        Último Acceso
                                    </div>
                                </th>
                                <th className="px-5 py-4 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                            {loading && !users.length ? (
                                <tr>
                                    <td colSpan="5" className="p-5">
                                        <TableSkeleton />
                                    </td>
                                </tr>
                            ) : filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-5 py-20">
                                        <div className="flex flex-col items-center justify-center text-slate-400 gap-3">
                                            <div className="w-16 h-16 bg-slate-50 dark:bg-slate-700/30 rounded-full flex items-center justify-center">
                                                <span className="material-icons-round text-3xl opacity-30">person_search</span>
                                            </div>
                                            <p className="font-bold text-sm">No se encontraron usuarios en esta lista</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredUsers.map(u => (
                                <tr key={u.id} className="group hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors">
                                    <td className="px-5 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 font-bold text-sm shrink-0 border-2 border-white dark:border-slate-800">
                                                {u.full_name ? u.full_name.charAt(0).toUpperCase() : '?'}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="font-bold text-slate-900 dark:text-white text-sm truncate">{u.full_name || 'Sin nombre'}</div>
                                                <div className="text-[11px] text-slate-400 font-mono truncate">{u.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-5 py-4">
                                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black tracking-widest ring-1 ring-inset transition-colors
                                            ${u.status === 'active' 
                                                ? 'bg-emerald-50 text-emerald-600 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20' 
                                                : 'bg-red-50 text-red-600 ring-red-600/20 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/20'}`}>
                                            {u.status === 'active' ? 'ACTIVO' : 'BANEADO'}
                                        </span>
                                    </td>
                                    <td className="px-5 py-4">
                                        <div className="flex flex-col gap-1 items-start">
                                            {u.role === 'admin' && (
                                                <span className="text-[10px] font-black bg-slate-900 text-white px-2 py-0.5 rounded uppercase tracking-tighter mb-1">
                                                    Administrador
                                                </span>
                                            )}
                                            {u.is_premium ? (
                                                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-500 dark:text-amber-400">
                                                    <span className="material-icons-round text-[16px]">stars</span>
                                                    PREMIUM ∞
                                                </div>
                                            ) : u.unlimited_until ? (
                                                <div className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                                                    <span className="material-icons-round text-[14px]">timer</span>
                                                    HASTA {formatLimaDate(u.unlimited_until)}
                                                </div>
                                            ) : (
                                                <span className="text-xs text-slate-400 font-medium italic">Plan Estándar</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-5 py-4 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                                        <div className="font-bold text-slate-700 dark:text-slate-300">{formatLimaDate(u.last_login)}</div>
                                        <div className="opacity-70 mt-0.5">{formatLimaTime(u.last_login)} · {u.last_ip || 'Sin IP'}</div>
                                    </td>
                                    <td className="px-5 py-4 text-right">
                                        <div className="flex justify-end items-center gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => setSelectedUserId(u.id)} title="Gestionar" className="w-9 h-9 flex items-center justify-center shrink-0 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-500 rounded-xl transition-all active:scale-90">
                                                <span className="material-icons-round text-[20px]">tune</span>
                                            </button>
                                            <button onClick={() => confirmAction('Membresía', `¿${u.is_premium ? 'Quitar' : 'Otorgar'} Premium a ${u.full_name}?`, () => handleTogglePremium(u), 'info')} title="Membresía" className="w-9 h-9 flex items-center justify-center shrink-0 hover:bg-amber-50 dark:hover:bg-amber-900/20 text-amber-500 rounded-xl transition-all active:scale-90">
                                                <span className="material-icons-round text-[20px]">{u.is_premium ? 'star_border' : 'star'}</span>
                                            </button>
                                            <button onClick={() => confirmAction(u.status === 'active' ? 'Banear' : 'Activar', u.status === 'active' ? `¿Banear a ${u.full_name}?` : `¿Activar a ${u.full_name}?`, () => handleToggleStatus(u), u.status === 'active' ? 'danger' : 'warning')} title={u.status === 'active' ? 'Banear' : 'Reactivar'} className={`w-9 h-9 flex items-center justify-center shrink-0 rounded-xl transition-all active:scale-90 ${u.status === 'active' ? 'hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400' : 'hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-emerald-400'}`}>
                                                <span className="material-icons-round text-[20px]">{u.status === 'active' ? 'block' : 'check_circle'}</span>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── Vista Cards (móvil) ───────────────────────────────── */}
            <div className="md:hidden space-y-2">
                {loading && !users.length ? (
                    <TableSkeleton />
                ) : filteredUsers.length === 0 ? (
                    <div className="py-16 flex flex-col items-center gap-3 text-slate-400 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl">
                        <span className="material-icons-round text-5xl opacity-20">person_search</span>
                        <p className="text-xs font-bold">Sin usuarios en esta lista</p>
                    </div>
                ) : filteredUsers.map(u => (
                    <motion.div
                        key={u.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-3 flex items-center gap-3"
                    >
                        {/* Avatar */}
                        <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 font-bold shrink-0 border-2 border-white dark:border-slate-600">
                            {u.full_name?.charAt(0)?.toUpperCase() || '?'}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{u.full_name || 'Sin nombre'}</p>
                                <span className={`px-2 py-0.5 rounded text-[9px] font-black tracking-widest uppercase
                                    ${u.status === 'active' 
                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' 
                                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                                    {u.status === 'active' ? 'Activo' : 'Baneado'}
                                </span>
                                {u.is_premium && (
                                    <span className="px-2 py-0.5 rounded text-[9px] font-black tracking-widest uppercase bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                        Premium
                                    </span>
                                )}
                                {u.role === 'admin' && (
                                    <span className="px-2 py-0.5 rounded text-[9px] font-black tracking-widest uppercase bg-slate-900 text-white dark:bg-white dark:text-slate-900">
                                        Admin
                                    </span>
                                )}
                            </div>
                            <p className="text-[10px] text-slate-400 font-mono truncate mt-0.5">{u.email}</p>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 shrink-0">
                            <button
                                onClick={() => setSelectedUserId(u.id)}
                                aria-label={`Gestionar ${u.full_name || u.email}`}
                                className="w-11 h-11 flex items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-500 active:scale-90 transition-all"
                            >
                                <span className="material-icons-round text-[20px]" aria-hidden="true">tune</span>
                            </button>
                            <button
                                onClick={() => confirmAction(u.status === 'active' ? 'Banear' : 'Activar', u.status === 'active' ? `¿Banear a ${u.full_name}?` : `¿Activar a ${u.full_name}?`, () => handleToggleStatus(u), u.status === 'active' ? 'danger' : 'warning')}
                                aria-label={u.status === 'active' ? `Banear a ${u.full_name || u.email}` : `Reactivar a ${u.full_name || u.email}`}
                                className={`w-11 h-11 flex items-center justify-center rounded-xl active:scale-90 transition-all ${u.status === 'active' ? 'bg-red-50 dark:bg-red-900/20 text-red-400' : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500'}`}
                            >
                                <span className="material-icons-round text-[20px]" aria-hidden="true">{u.status === 'active' ? 'block' : 'check_circle'}</span>
                            </button>
                        </div>
                    </motion.div>
                ))}
            </div>

            <AnimatePresence>
                {selectedUserId && <UserDetailPanel userId={selectedUserId} onClose={() => setSelectedUserId(null)} onUpdate={loadUsers} />}
            </AnimatePresence>
        </div>
    );
}
