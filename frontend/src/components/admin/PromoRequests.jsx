import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

export default function PromoRequests() {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(null);
    const [activeTab, setActiveTab] = useState('pending');
    
    // Modal state
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, reqId: null, status: null });

    useEffect(() => {
        fetchRequests();
    }, []);

    const fetchRequests = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/admin/promos', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                setRequests(await res.json());
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const executeUpdateStatus = async () => {
        const { reqId, status } = confirmModal;
        setConfirmModal({ isOpen: false, reqId: null, status: null });
        setUpdating(reqId);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/admin/promos/${reqId}/status`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ status })
            });
            const data = await res.json();
            if (res.ok) {
                toast.success(data.message || 'Estado actualizado');
                fetchRequests();
            } else {
                toast.error(data.detail || 'Error al actualizar');
            }
        } catch (err) {
            toast.error('Error de conexión');
        } finally {
            setUpdating(null);
        }
    };

    const filteredRequests = requests.filter(r => r.status === activeTab);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl md:text-2xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent uppercase tracking-tight">
                        Promociones TikTok
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm font-medium">Gestiona los videos enviados por la comunidad.</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 bg-slate-100 dark:bg-slate-800/70 p-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 w-full max-w-md shadow-sm">
                {[
                    { id: 'pending', label: 'Pendientes' },
                    { id: 'approved', label: 'Aprobadas' },
                    { id: 'rejected', label: 'Rechazadas' }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 py-2 px-3 rounded-xl text-sm font-semibold transition-all duration-200 focus-ring ${
                            activeTab === tab.id 
                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' 
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                        }`}
                    >
                        {tab.label}
                        <span className="ml-2 text-xs opacity-70">
                            ({requests.filter(r => r.status === tab.id).length})
                        </span>
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="flex justify-center py-10">
                    <div className="w-8 h-8 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
                </div>
            ) : filteredRequests.length === 0 ? (
                <div className="bg-white dark:bg-slate-800 p-10 rounded-3xl border border-slate-200 dark:border-slate-700 text-center">
                    <p className="text-slate-500">No hay solicitudes en esta categoría.</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {filteredRequests.map(req => (
                        <div key={req.id} className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row justify-between gap-4 shadow-sm hover:shadow-md transition-shadow">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="font-bold text-slate-900 dark:text-white text-lg">{req.tiktok_username}</span>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                                        req.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                                        req.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                                        'bg-red-100 text-red-700'
                                    }`}>
                                        {req.status}
                                    </span>
                                </div>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
                                    Usuario: <span className="font-medium text-slate-700 dark:text-slate-300">{req.full_name}</span> ({req.email})
                                </p>
                                <a 
                                    href={req.video_url} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 mt-1 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline text-sm font-semibold bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-lg"
                                >
                                    <span className="material-icons-round text-[16px]">play_circle</span>
                                    Ver Video en TikTok
                                </a>
                                <p className="text-xs text-slate-400 mt-3 flex items-center gap-1">
                                    <span className="material-icons-round text-[14px]">schedule</span> 
                                    Enviado: {req.created_at}
                                </p>
                            </div>
                            
                            {req.status === 'pending' && (
                                <div className="flex items-center gap-2 shrink-0 self-start md:self-center">
                                    <button 
                                        disabled={updating === req.id}
                                        onClick={() => setConfirmModal({ isOpen: true, reqId: req.id, status: 'approved' })}
                                        className="bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm hover:shadow-md transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2 focus-ring"
                                    >
                                        <span className="material-icons-round text-[18px]">check_circle</span>
                                        Aprobar (5 días)
                                    </button>
                                    <button 
                                        disabled={updating === req.id}
                                        onClick={() => setConfirmModal({ isOpen: true, reqId: req.id, status: 'rejected' })}
                                        className="bg-red-500 hover:bg-red-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm hover:shadow-md transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2 focus-ring"
                                    >
                                        <span className="material-icons-round text-[18px]">cancel</span>
                                        Rechazar
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Custom Confirm Modal */}
            <AnimatePresence>
                {confirmModal.isOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-6 max-w-sm w-full border border-slate-200 dark:border-slate-800"
                        >
                            <div className="flex items-center gap-3 mb-4">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${confirmModal.status === 'approved' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                                    <span className="material-icons-round text-2xl">
                                        {confirmModal.status === 'approved' ? 'verified' : 'warning'}
                                    </span>
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Confirmar acción</h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                        ¿Marcar como {confirmModal.status === 'approved' ? 'Aprobada' : 'Rechazada'}?
                                    </p>
                                </div>
                            </div>
                            
                            {confirmModal.status === 'approved' && (
                                <p className="text-sm text-slate-600 dark:text-slate-300 mb-6 bg-slate-50 dark:bg-slate-800 p-3 rounded-xl">
                                    Se le otorgarán <strong>5 días ilimitados</strong> al usuario automáticamente.
                                </p>
                            )}

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setConfirmModal({ isOpen: false, reqId: null, status: null })}
                                    className="flex-1 px-4 py-2.5 rounded-xl font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 dark:text-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={executeUpdateStatus}
                                    className={`flex-1 px-4 py-2.5 rounded-xl font-bold text-white shadow-md transition-all active:scale-95 ${
                                        confirmModal.status === 'approved' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
                                    }`}
                                >
                                    Confirmar
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
