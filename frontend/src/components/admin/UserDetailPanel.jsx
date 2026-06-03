import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AlertModal from '../AlertModal';
import { formatLimaDate, formatLimaTime } from './utils';
import ConfirmationModal from './ConfirmationModal';

const HIST_CATEGORIES_PANEL = [
    { id: null,         label: 'Todos',      icon: 'apps' },
    { id: 'reniec',     label: 'RENIEC',     types: ['dni', 'dni_premium', 'name'] },
    { id: 'generador',  label: 'Generador',  types: ['reniec_c4_azul', 'reniec_inscripcion', 'reniec_dni_azul', 'reniec_dni_amarillo'] },
    { id: 'familiares', label: 'Familiares', types: ['familiares_pdf', 'familiares_texto'] },
    { id: 'telefonos',  label: 'Teléfonos',  types: ['telefono_numeros_dni', 'telefono_info_linea', 'telefono_verificador', 'telefono_titular'] },
];

function CreditHistoryModal({ logs, onClose }) {
    const [searchAmount, setSearchAmount] = useState('');
    const [filterDate, setFilterDate]     = useState('');

    const filteredLogs = useMemo(() => {
        let res = logs;
        if (searchAmount.trim()) {
            res = res.filter(l =>
                l.amount.toString() === searchAmount.trim() ||
                `+${l.amount}` === searchAmount.trim() ||
                `-${l.amount}` === searchAmount.trim()
            );
        }
        if (filterDate) res = res.filter(l => l.created_at?.startsWith(filterDate));
        return res;
    }, [logs, searchAmount, filterDate]);

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={e => e.stopPropagation()}
                className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[88vh] overflow-hidden border border-slate-200 dark:border-slate-700"
            >
                <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
                    <h3 className="font-bold text-base flex items-center gap-2">
                        <span className="material-icons-round text-blue-500 text-[20px]">receipt_long</span>
                        Historial de Créditos
                    </h3>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors">
                        <span className="material-icons-round text-xl">close</span>
                    </button>
                </div>

                <div className="p-4 grid grid-cols-2 gap-3 shrink-0 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Buscar monto</label>
                        <input type="text" placeholder="Ej: 5, -2, +10" value={searchAmount}
                            onChange={e => setSearchAmount(e.target.value)}
                            className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white" />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Filtrar por fecha</label>
                        <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
                            className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white" />
                    </div>
                </div>

                <div className="p-4 flex-1 overflow-y-auto space-y-2.5">
                    {filteredLogs.length === 0 ? (
                        <div className="text-center py-10 text-slate-400 flex flex-col items-center gap-2">
                            <span className="material-icons-round text-3xl opacity-30">inbox</span>
                            <p className="text-sm">No se encontraron registros.</p>
                        </div>
                    ) : filteredLogs.map((log, i) => (
                        <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-800/50 hover:border-slate-200 dark:hover:border-slate-700 transition-colors gap-2">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-sm font-extrabold ${log.amount > 0 ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30' : 'bg-red-100 text-red-600 dark:bg-red-900/30'}`}>
                                    {log.amount > 0 ? `+${log.amount}` : log.amount}
                                </div>
                                <div className="min-w-0">
                                    <p className="font-semibold text-slate-900 dark:text-white text-sm truncate">{log.reason || 'Sin motivo'}</p>
                                    <p className="text-xs text-slate-400 font-mono mt-0.5 truncate">{formatLimaDate(log.created_at)} {formatLimaTime(log.created_at)}</p>
                                </div>
                            </div>
                            {log.admin_email && log.admin_email !== 'sistema' && (
                                <span className="w-fit text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500 px-2 py-0.5 rounded-full font-mono shrink-0 sm:ml-2">Admin</span>
                            )}
                        </div>
                    ))}
                </div>
            </motion.div>
        </div>
    );
}

function ManageCreditsModal({ user, onClose, onUpdate }) {
    const [action, setAction] = useState('credits'); // 'credits' or 'premium'
    const [amount, setAmount] = useState(1);
    const [reason, setReason] = useState('');
    const [days, setDays] = useState(1);
    const [saving, setSaving] = useState(false);

    const handleAction = async (type) => {
        setSaving(true);
        const token = localStorage.getItem('token');
        try {
            let url, method, body;
            if (type === 'add_credits') {
                url = `/api/admin/users/${user.id}/credits`;
                method = 'POST';
                body = { amount: parseInt(amount) };
            } else if (type === 'remove_credits') {
                url = `/api/admin/users/${user.id}/credits`;
                method = 'DELETE';
                body = { amount: parseInt(amount), reason: reason || 'Deducción admin' };
            } else if (type === 'grant_unlimited') {
                url = `/api/admin/users/${user.id}/unlimited`;
                method = 'POST';
                body = { days: parseInt(days) };
            } else if (type === 'revoke_unlimited') {
                url = `/api/admin/users/${user.id}/unlimited/revoke`;
                method = 'POST';
            }
            const res = await fetch(url, {
                method,
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: body ? JSON.stringify(body) : undefined
            });
            if (res.ok) { onUpdate(); onClose(); }
            else { const data = await res.json(); alert(data.detail || 'Error'); }
        } catch { alert('Error de red'); } finally { setSaving(false); }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} onClick={e => e.stopPropagation()} className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 max-h-[95vh] flex flex-col">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <h3 className="font-bold text-lg flex items-center gap-2 text-slate-900 dark:text-white"><span className="material-icons-round text-blue-500">settings_suggest</span>Gestionar Créditos</h3>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors"><span className="material-icons-round">close</span></button>
                </div>
                <div className="p-4 sm:p-6 space-y-6 overflow-y-auto flex-1">
                    <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
                        <button onClick={() => setAction('credits')} className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${action === 'credits' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-500'}`}>Créditos</button>
                        <button onClick={() => setAction('premium')} className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${action === 'premium' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500'}`}>Membresía</button>
                    </div>
                    {action === 'credits' ? (
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Cantidad</label>
                                <div className="flex items-center gap-3">
                                    <button onClick={() => setAmount(Math.max(1, amount - 1))} className="w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                        <span className="material-icons-round">remove</span>
                                    </button>
                                    <input type="number" value={amount} onChange={e => setAmount(parseInt(e.target.value) || 0)} className="flex-1 h-10 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-center font-bold dark:text-white" />
                                    <button onClick={() => setAmount(amount + 1)} className="w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                        <span className="material-icons-round">add</span>
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Motivo</label>
                                <input type="text" placeholder="Ej: Recarga manual..." value={reason} onChange={e => setReason(e.target.value)} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm dark:text-white" />
                            </div>
                            <div className="grid grid-cols-2 gap-3 pt-2">
                                <button onClick={() => handleAction('remove_credits')} disabled={saving} className="py-3 rounded-2xl font-bold text-sm bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400">Quitar</button>
                                <button onClick={() => handleAction('add_credits')} disabled={saving} className="py-3 rounded-2xl font-bold text-sm bg-blue-600 text-white shadow-lg shadow-blue-500/20">Añadir</button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800/30">
                                <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-1">Estado Actual</p>
                                <p className="font-bold text-slate-900 dark:text-white">{user.is_premium ? 'Premium Activo' : 'Usuario Estándar'}</p>
                                {user.is_premium && user.unlimited_until && <p className="text-[10px] text-slate-500 mt-1 font-mono">Vence: {user.unlimited_until}</p>}
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Días</label>
                                <div className="flex items-center gap-3">
                                    <button onClick={() => setDays(Math.max(1, days - 1))} className="w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                        <span className="material-icons-round">remove</span>
                                    </button>
                                    <input type="number" value={days} onChange={e => setDays(parseInt(e.target.value) || 1)} className="flex-1 h-10 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-center font-bold dark:text-white" />
                                    <button onClick={() => setDays(days + 1)} className="w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                        <span className="material-icons-round">add</span>
                                    </button>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3 pt-2">
                                <button onClick={() => handleAction('revoke_unlimited')} disabled={saving || !user.is_premium} className="py-3 rounded-2xl font-bold text-sm bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 disabled:opacity-30">Quitar Acceso</button>
                                <button onClick={() => handleAction('grant_unlimited')} disabled={saving} className="py-3 rounded-2xl font-bold text-sm bg-indigo-600 text-white shadow-lg shadow-indigo-500/30">Dar Acceso</button>
                            </div>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
}

export default function UserDetailPanel({ userId, onClose, onUpdate }) {
    const [detail, setDetail]               = useState(null);
    const [loading, setLoading]             = useState(true);
    const [banIpLoading, setBanIpLoading]   = useState(false);
    const [histSearch, setHistSearch]       = useState('');
    const [histFilter, setHistFilter]       = useState(null);
    const [showCreditModal, setShowCreditModal] = useState(false);
    const [showManageModal, setShowManageModal] = useState(false);
    const [alert, setAlert] = useState({ isOpen: false, type: 'info', title: '', message: '' });

    const loadDetail = async () => {
        setLoading(true);
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`/api/admin/users/${userId}/detail`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (res.ok) setDetail(await res.json());
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    useState(() => { if (userId) loadDetail(); }, [userId]);

    // Removed handleCredit in favor of ManageCreditsModal logic

    const handleBanIP = async () => {
        if (!detail?.last_ip) return setAlert({ isOpen: true, type: 'warning', title: 'Sin IP', message: 'Sin IP registrada.' });
        setBanIpLoading(true);
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`/api/admin/users/${userId}/ban-ip`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: 'Admin ban', also_ban_account: true }) });
            const data = await res.json();
            if (res.ok) { setAlert({ isOpen: true, type: 'success', title: '🚫 IP Baneada', message: `IP ${data.ip} bloqueada.` }); loadDetail(); onUpdate(); }
            else setAlert({ isOpen: true, type: 'error', title: 'Error', message: data.detail || 'Error al banear.' });
        } catch { setAlert({ isOpen: true, type: 'error', title: 'Error', message: 'Error de red.' }); }
        finally { setBanIpLoading(false); }
    };

    const filteredHistory = useMemo(() => {
        if (!detail?.search_history) return [];
        let list = detail.search_history;
        const cat = HIST_CATEGORIES_PANEL.find(c => c.id === histFilter);
        if (cat?.types) list = list.filter(h => cat.types.includes(h.search_type));
        if (histSearch.trim()) { const q = histSearch.toLowerCase(); list = list.filter(h => h.search_term?.toLowerCase().includes(q) || h.search_type?.toLowerCase().includes(q)); }
        return list;
    }, [detail, histFilter, histSearch]);

    if (!userId) return null;

    const CREDIT_BTN = [
        { id: 'add',       label: '+ Créditos', active: 'bg-blue-600 text-white border-blue-600',    inactive: '' },
        { id: 'remove',    label: '− Créditos', active: 'bg-red-500 text-white border-red-500',      inactive: '' },
        { id: 'unlimited', label: '∞ Días',      active: 'bg-indigo-600 text-white border-indigo-600', inactive: '' },
    ];
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-3 bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <motion.div
                initial={{ opacity: 0, scale: 0.97, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: 16 }}
                transition={{ duration: 0.2 }}
                onClick={e => e.stopPropagation()}
                className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden"
            >
                <AlertModal isOpen={alert.isOpen} onClose={() => setAlert({ ...alert, isOpen: false })} title={alert.title} message={alert.message} type={alert.type} />

                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">Detalle de Usuario</h2>
                    <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors">
                        <span className="material-icons-round">close</span>
                    </button>
                </div>

                <div className="overflow-y-auto flex-1 p-4 sm:p-6">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-40 gap-3">
                            <div className="w-8 h-8 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
                            <p className="text-sm text-slate-400">Cargando usuario...</p>
                        </div>
                    ) : !detail ? (
                        <p className="text-center text-slate-400 py-12">No se pudo cargar el usuario.</p>
                    ) : (
                        <div className="space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                {/* User Info */}
                                <div className="md:order-2 bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xl shadow-md shrink-0">
                                            {detail.full_name?.charAt(0)?.toUpperCase() || '?'}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-bold text-slate-900 dark:text-white truncate">{detail.full_name || 'Sin nombre'}</p>
                                            <p className="text-xs text-slate-500 font-mono truncate">{detail.email}</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2.5">
                                        {[
                                            { label: 'Estado', value: <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${detail.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{detail.status === 'active' ? '✓ Activo' : '✗ Baneado'}</span> },
                                            { label: 'Créditos', value: <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{detail.is_premium ? '∞' : detail.credits ?? 0}</p> },
                                            { label: 'Membresía', value: 
                                                <div className="flex flex-col">
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold w-fit ${detail.is_premium ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
                                                        {detail.is_premium ? '⭐ Premium' : 'Estándar'}
                                                    </span>
                                                    {detail.is_premium && detail.unlimited_until && (
                                                        <span className="text-[9px] text-slate-400 mt-1 font-mono">Vence: {detail.unlimited_until.split(' ')[0]}</span>
                                                    )}
                                                </div>
                                            },
                                            { label: 'Rol', value: <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{detail.role?.toUpperCase()}</span> },
                                        ].map(({ label, value }) => (
                                            <div key={label} className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-600">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">{label}</p>
                                                {value}
                                            </div>
                                        ))}
                                    </div>
                                    <div className="text-xs text-slate-400 space-y-0.5">
                                        <p>📅 Registro: <span className="font-mono">{formatLimaDate(detail.created_at)} {formatLimaTime(detail.created_at)}</span></p>
                                        <p>🕐 Último acceso: <span className="font-mono">{formatLimaDate(detail.last_login)} {formatLimaTime(detail.last_login)}</span></p>
                                    </div>
                                </div>

                                {/* Credit Management + IP */}
                                <div className="md:order-1 space-y-3">
                                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                                                <span className="material-icons-round">toll</span>
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-slate-900 dark:text-white text-sm">Créditos y Membresía</h3>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Control Administrativo</p>
                                            </div>
                                        </div>
                                        
                                        <button 
                                            onClick={() => setShowManageModal(true)}
                                            className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                                        >
                                            <span className="material-icons-round text-[18px]">manage_accounts</span>
                                            Gestionar Créditos
                                        </button>
                                    </div>

                                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700">
                                        <h3 className="font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2 text-sm">
                                            <span className="material-icons-round text-red-500 text-[18px]">router</span>
                                            Control de IP
                                        </h3>
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="text-[10px] text-slate-400 mb-1">Última IP</p>
                                                <code className="text-sm font-mono font-bold text-slate-800 dark:text-slate-200 break-all">{detail.last_ip || '—'}</code>
                                            </div>
                                            {detail.last_ip && (
                                                <button onClick={handleBanIP} disabled={banIpLoading} className="w-full sm:w-auto justify-center px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-xs font-bold transition-colors active:scale-95 disabled:opacity-50 flex items-center gap-1.5 shrink-0">
                                                    <span className="material-icons-round text-[14px]">block</span>
                                                    {banIpLoading ? 'Baneando...' : 'Banear IP'}
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700">
                                        <h3 className="font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2 text-sm">
                                            <span className="material-icons-round text-blue-500 text-[18px]">receipt_long</span>
                                            Historial de Créditos
                                        </h3>
                                        <button onClick={() => setShowCreditModal(true)} className="w-full py-2 rounded-xl border-2 border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:border-blue-500 hover:text-blue-600 transition-colors flex items-center justify-center gap-1.5">
                                            <span className="material-icons-round text-[16px]">open_in_new</span>
                                            Ver historial completo
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Search History */}
                            <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 text-sm">
                                        <span className="material-icons-round text-blue-500 text-[18px]">history</span>
                                        Historial de Búsquedas
                                    </h3>
                                    <span className="text-xs text-slate-400">{filteredHistory.length} resultado{filteredHistory.length !== 1 ? 's' : ''}</span>
                                </div>
                                <div className="relative mb-3 group">
                                    <span className="material-icons-round absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg transition-colors group-focus-within:text-blue-500">search</span>
                                    <input type="text" value={histSearch} onChange={e => setHistSearch(e.target.value)} placeholder="Buscar en historial..."
                                        className="w-full pl-11 pr-4 h-[44px] rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-[13px] font-bold focus:border-blue-500 outline-none dark:text-white transition-all" />
                                </div>
                                <div className="flex flex-wrap gap-1.5 mb-3">
                                    {HIST_CATEGORIES_PANEL.map(f => (
                                        <button key={String(f.id)} onClick={() => setHistFilter(f.id)} className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${histFilter === f.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-600 hover:border-blue-400'}`}>
                                            {f.label}
                                        </button>
                                    ))}
                                </div>
                                <div className="max-h-48 overflow-y-auto space-y-1.5">
                                    {filteredHistory.length === 0 ? (
                                        <p className="text-center text-slate-400 py-4 text-sm">Sin búsquedas.</p>
                                    ) : filteredHistory.map((h, i) => (
                                        <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm gap-2">
                                            <div className="min-w-0">
                                                <span className="font-bold text-slate-900 dark:text-white font-mono text-xs break-all">{h.search_term}</span>
                                                <span className="inline-block ml-2 text-[10px] text-slate-400">{h.search_type}</span>
                                            </div>
                                            <span className="text-[10px] font-mono text-slate-400 shrink-0">{formatLimaDate(h.created_at)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <AnimatePresence>
                    {showCreditModal && <CreditHistoryModal logs={detail?.credit_log || []} onClose={() => setShowCreditModal(false)} />}
                    {showManageModal && (
                        <ManageCreditsModal 
                            user={detail} 
                            onClose={() => setShowManageModal(false)} 
                            onUpdate={() => { loadDetail(); onUpdate(); }} 
                        />
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
}
