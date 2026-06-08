import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParamState } from '../../hooks/useSearchParamState';
import { getApiUrl } from '../../utils/api';

const STATUS_UI = {
    pending:    { label: 'Pendiente',  color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
    processing: { label: 'En proceso', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    approved:   { label: 'Aprobada',   color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
    rejected:   { label: 'Rechazada', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
};

// ─── Skeleton Component ───────────────────────────────────────────────────
function RequestSkeleton() {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 animate-pulse">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                <div key={i} className="h-20 bg-slate-100 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700" />
            ))}
        </div>
    );
}

// ─── Request Detail Modal ─────────────────────────────────────────────────────
function RequestDetailModal({ purchase, onClose, onAction, onRejectModalOpen }) {
    const [imageError, setImageError] = useState(false);

    if (!purchase) return null;
    const s = STATUS_UI[purchase.status];

    const getImageUrl = (url) => {
        if (!url) return '';
        if (url.startsWith('/api/')) return getApiUrl(url);
        return url;
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                onClick={e => e.stopPropagation()}
                className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col md:flex-row overflow-hidden border-t sm:border border-slate-200 dark:border-slate-700"
            >
                {/* Image Section */}
                <div className="w-full md:w-1/2 h-[25dvh] min-h-[160px] max-h-[220px] md:max-h-none md:h-auto md:min-h-0 bg-slate-50 dark:bg-slate-950/50 border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-800 p-3 md:p-6 flex items-center justify-center relative shrink-0 overflow-hidden">
                    {!imageError ? (
                        <>
                            <motion.img 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                src={getImageUrl(purchase.receipt_image_url)} alt="Comprobante"
                                className="max-h-full max-w-full w-auto h-auto rounded-xl md:rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 object-contain cursor-zoom-in hover:shadow-2xl transition-all"
                                onError={() => setImageError(true)}
                                onClick={() => window.open(getImageUrl(purchase.receipt_image_url), '_blank')} />
                            <div className="absolute bottom-3 md:bottom-4 right-3 md:right-4 bg-black/50 backdrop-blur text-white px-2 py-1 rounded-lg pointer-events-none flex items-center gap-1.5 text-[9px] md:text-[10px] font-bold">
                                <span className="material-icons-round text-xs md:text-sm">zoom_in</span>
                                EXPANDIR
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center text-slate-400 dark:text-slate-500">
                            <span className="material-icons-round text-5xl mb-2 opacity-50">broken_image</span>
                            <span className="text-xs font-bold uppercase tracking-widest">Imagen no disponible</span>
                        </div>
                    )}
                </div>

                {/* Content Section */}
                <div className="w-full md:w-1/2 flex flex-col p-4 pb-12 sm:pb-4 md:p-6 md:pb-6 overflow-y-auto flex-1 min-h-0 min-w-0">
                    <div className="flex justify-between items-start mb-4 md:mb-6">
                        <div className="flex-1 min-w-0">
                            <h3 className="text-base md:text-xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent uppercase tracking-tight">Detalle de Pago</h3>
                            <p className="text-[9px] md:text-[10px] text-slate-400 font-mono mt-1 flex items-center gap-1.5 truncate">
                                <span className="w-1.5 h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full shrink-0" />
                                <span className="truncate">ID: {purchase.id}</span>
                            </p>
                        </div>
                        <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-all active:scale-90 shrink-0">
                            <span className="material-icons-round text-xl">close</span>
                        </button>
                    </div>

                    <div className="space-y-4 md:space-y-5 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className={`px-2.5 md:px-3 py-1 md:py-1 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest ring-1 ring-inset ${s.color}`}>
                                {s.label}
                            </span>
                            <span className="text-[10px] md:text-[11px] font-bold text-slate-400 flex items-center gap-1">
                                <span className="material-icons-round text-xs md:text-sm">schedule</span>
                                {new Date(purchase.created_at).toLocaleString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>

                        <div className="grid grid-cols-1 gap-3 md:gap-4">
                            <div className="bg-slate-50 dark:bg-slate-800/40 p-3 md:p-4 rounded-xl md:rounded-2xl border border-slate-100 dark:border-slate-800">
                                <p className="text-[8px] md:text-[9px] text-slate-400 uppercase font-black tracking-widest mb-2">Información del Cliente</p>
                                <div className="flex items-center gap-2.5 md:gap-3">
                                    <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 font-black text-sm shrink-0">
                                        {purchase.full_name?.charAt(0) || '?'}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="font-bold text-sm md:text-base text-slate-900 dark:text-white truncate">{purchase.full_name || 'Desconocido'}</p>
                                        <p className="text-[10px] md:text-xs text-slate-400 font-mono truncate">{purchase.email}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-blue-50 dark:bg-blue-900/10 p-3 md:p-4 rounded-xl md:rounded-2xl border border-blue-100 dark:border-blue-900/30">
                                <p className="text-[8px] md:text-[9px] text-blue-400 uppercase font-black tracking-widest mb-2">Plan y Método</p>
                                <div className="flex justify-between items-center gap-3">
                                    <div className="min-w-0 flex-1">
                                        <p className="font-black text-blue-800 dark:text-blue-400 text-lg md:text-2xl tracking-tight truncate leading-none mb-1">{purchase.plan_label || "No especificado"}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <img src={`/payments/${purchase.payment_method}/logo.png`} alt="" className="h-3 md:h-4 object-contain opacity-80" onError={e => e.target.style.display = 'none'} />
                                            <span className="text-[10px] md:text-[11px] font-black uppercase text-slate-500 dark:text-slate-400 truncate">{purchase.payment_method}</span>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0 flex flex-col items-end">
                                        <p className="text-[9px] md:text-[10px] text-slate-400 font-bold uppercase mb-1">Costo / A Recibir</p>
                                        <p className="text-base md:text-lg font-black text-slate-700 dark:text-slate-300 leading-none mb-1.5">S/ {purchase.amount_soles}</p>
                                        {purchase.is_premium_plan || purchase.unlimited_days ? (
                                            <span className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border border-indigo-200 dark:border-indigo-800">
                                                {purchase.unlimited_days ? `${purchase.unlimited_days} DÍAS ∞` : 'ILIMITADO ∞'}
                                            </span>
                                        ) : (
                                            <span className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border border-emerald-200 dark:border-emerald-800">
                                                +{purchase.credits_to_assign} CRÉDITOS
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {(purchase.status === 'approved' || purchase.status === 'rejected') && (
                            <div className={`p-3 md:p-4 rounded-xl md:rounded-2xl border ${purchase.status === 'approved' ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30' : 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30'}`}>
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="material-icons-round text-xs md:text-sm opacity-50">history</span>
                                    <p className="text-[9px] md:text-[10px] font-bold uppercase opacity-50 tracking-widest">Resolución del Sistema</p>
                                </div>
                                <p className="text-[10px] md:text-[11px] font-mono mb-2 opacity-70">Fecha: {new Date(purchase.reviewed_at).toLocaleString('es-PE')}</p>
                                {purchase.status === 'rejected' && (
                                    <div className="mt-2 pt-2 border-t border-red-200 dark:border-red-800/40">
                                        <p className="text-red-600 dark:text-red-400 font-black text-[9px] md:text-[10px] uppercase mb-1">Motivo del rechazo</p>
                                        <p className="text-slate-700 dark:text-slate-200 italic text-xs md:text-sm leading-relaxed">"{purchase.rejection_reason}"</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="pt-4 md:pt-6 mt-3 md:mt-4 border-t border-slate-100 dark:border-slate-800 flex gap-2 md:gap-3">
                        {purchase.status === 'pending' && (
                            <>
                                <button onClick={() => { onAction(purchase.id, 'process'); onClose(); }} className="flex-1 py-3 md:py-3.5 text-[10px] md:text-xs font-black uppercase tracking-widest rounded-xl md:rounded-2xl border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-blue-400 transition-all flex justify-center items-center gap-1.5 md:gap-2">
                                    <span className="material-icons-round text-base md:text-lg">autorenew</span> 
                                    <span className="hidden xs:inline">PROCESAR</span>
                                    <span className="xs:hidden">PROC.</span>
                                </button>
                                <button onClick={() => { onRejectModalOpen(purchase.id); onClose(); }} className="flex-1 py-3 md:py-3.5 text-[10px] md:text-xs font-black uppercase tracking-widest rounded-xl md:rounded-2xl bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/20 transition-all active:scale-95">RECHAZAR</button>
                            </>
                        )}
                        {purchase.status === 'processing' && (
                            <>
                                <button onClick={() => { onRejectModalOpen(purchase.id); onClose(); }} className="flex-[0.6] py-3 md:py-3.5 text-[10px] md:text-xs font-black uppercase tracking-widest rounded-xl md:rounded-2xl bg-red-50 dark:bg-red-900/20 hover:bg-red-100 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/50 transition-all">
                                    <span className="hidden xs:inline">RECHAZAR</span>
                                    <span className="xs:hidden">✕</span>
                                </button>
                                <button onClick={() => { onAction(purchase.id, 'approve'); onClose(); }} className="flex-1 py-3 md:py-3.5 text-[10px] md:text-xs font-black uppercase tracking-widest rounded-xl md:rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-lg shadow-emerald-500/20 transition-all active:scale-95 flex items-center justify-center gap-1.5 md:gap-2">
                                    <span className="material-icons-round text-lg md:text-xl">verified</span> 
                                    <span className="hidden xs:inline">APROBAR</span>
                                    <span className="xs:hidden">✓</span>
                                </button>
                            </>
                        )}
                        {(purchase.status === 'approved' || purchase.status === 'rejected') && (
                            <button onClick={onClose} className="w-full py-3 md:py-3.5 text-[10px] md:text-xs font-black uppercase tracking-widest rounded-xl md:rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">CERRAR</button>
                        )}
                    </div>
                </div>
            </motion.div>
        </div>
    );
}

// ─── Credit Requests ───────────────────────────────────────────────────────────
export default function CreditRequests() {
    const [purchases, setPurchases]         = useState([]);
    const [loading, setLoading]             = useState(true);
    const [filter, setFilter]               = useSearchParamState('s', 'pending');
    const [selectedPurchase, setSelectedPurchase] = useState(null);
    const [rejectModal, setRejectModal]     = useState({ isOpen: false, purchaseId: null, reason: '' });

    const getImageUrl = (url) => {
        if (!url) return '';
        if (url.startsWith('/api/')) return getApiUrl(url);
        return url;
    };

    const fetchPurchases = useCallback(async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const url = filter === 'all' ? '/api/admin/purchases' : `/api/admin/purchases?status_filter=${filter}`;
            const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
            if (res.ok) setPurchases(await res.json());
        } catch (e) { console.error(e); } finally { setLoading(false); }
    }, [filter]);

    useEffect(() => { fetchPurchases(); }, [fetchPurchases]);

    const handleAction = async (id, actionStr, reason = '') => {
        const token = localStorage.getItem('token');
        try {
            const opts = { method: 'PUT', headers: { 'Authorization': `Bearer ${token}` } };
            if (actionStr === 'reject') { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify({ reason }); }
            const res = await fetch(`/api/admin/purchases/${id}/${actionStr}`, opts);
            if (res.ok) {
                fetchPurchases();
                if (actionStr === 'reject') setRejectModal({ isOpen: false, purchaseId: null, reason: '' });
                if (selectedPurchase?.id === id) setSelectedPurchase(null);
            } else { const data = await res.json(); alert(data.detail || 'Error procesando'); }
        } catch (e) { console.error(e); }
    };

    const FILTER_TABS = [
        { id: 'pending',    label: 'Pendientes' },
        { id: 'processing', label: 'En Proceso' },
        { id: 'approved',   label: 'Aprobadas' },
        { id: 'rejected',   label: 'Rechazadas' },
        { id: 'all',        label: 'Ver Todo' },
    ];

    return (
        <div className="space-y-6 w-full">
            {/* Header Area */}
            <div className="flex flex-col gap-3 md:gap-4">
                <div>
                    <h2 className="text-lg md:text-2xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent uppercase tracking-tight">Solicitudes de Créditos</h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-1 text-xs md:text-sm font-medium">Revisión manual de comprobantes y activación de planes.</p>
                </div>
                <div
                    role="tablist"
                    aria-label="Filtros de solicitudes"
                    className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl overflow-x-auto snap-x snap-mandatory gap-1 w-full scrollbar-hide -mx-3 px-3 md:mx-0 md:px-1"
                >
                    {FILTER_TABS.map(f => {
                        const isActive = filter === f.id;
                        return (
                            <button
                                key={f.id}
                                role="tab"
                                aria-selected={isActive}
                                onClick={() => setFilter(f.id)}
                                className={`relative snap-start shrink-0 min-h-[44px] px-4 rounded-xl text-xs sm:text-sm font-bold uppercase tracking-wide transition-all whitespace-nowrap flex items-center justify-center gap-2
                                    ${isActive
                                        ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
                            >
                                <span>{f.label}</span>
                                {isActive && (
                                    <span className="shrink-0 bg-blue-600 text-white min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center text-[10px] font-black leading-none">
                                        {purchases.length}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {loading ? (
                <RequestSkeleton />
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    <AnimatePresence mode="popLayout">
                        {purchases.map((p, i) => {
                            const s = STATUS_UI[p.status];
                            return (
                                <motion.div 
                                    key={p.id}
                                    layout
                                    initial={{ opacity: 0, scale: 0.9, y: 10 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    transition={{ duration: 0.3, delay: i * 0.03 }}
                                    onClick={() => setSelectedPurchase(p)}
                                    className="group bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden cursor-pointer hover:shadow-xl hover:border-blue-400 dark:hover:border-blue-500 transition-all flex items-center p-4 gap-4 relative"
                                >
                                    <div className="relative shrink-0 overflow-hidden rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
                                        <div className="w-14 h-16 bg-slate-100 dark:bg-slate-900 flex items-center justify-center">
                                            {p.receipt_image_url ? (
                                                <img src={getImageUrl(p.receipt_image_url)} alt="Comp."
                                                    className="w-full h-full object-cover group-hover:scale-125 transition-transform duration-500"
                                                    onError={(e) => { e.target.onerror = null; e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
                                            ) : null}
                                            <div className="hidden absolute inset-0 items-center justify-center" style={{ display: !p.receipt_image_url ? 'flex' : 'none' }}>
                                                <span className="material-icons-round text-slate-400 text-xl">broken_image</span>
                                            </div>
                                        </div>
                                        <div className="absolute inset-0 bg-blue-600/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <span className="material-icons-round text-white text-sm">visibility</span>
                                        </div>
                                    </div>
                                    
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate tracking-tight mb-1">{p.full_name || p.email}</h4>
                                        <div className="flex flex-col gap-1">
                                            <div className="inline-block w-fit bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 rounded text-[10px] font-black text-blue-700 dark:text-blue-300 tracking-tight uppercase border border-blue-200 dark:border-blue-800/50">
                                                Plan: {p.plan_label || "No especificado"}
                                            </div>
                                            <div className="flex items-center gap-1.5 opacity-70">
                                                <img src={`/payments/${p.payment_method}/logo.png`} alt="" className="h-2.5 object-contain" onError={e => e.target.style.display = 'none'} />
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{p.payment_method}</span>
                                            </div>
                                        </div>
                                        <div className="mt-2 flex items-center justify-between">
                                            <span className={`px-2 py-0.5 rounded text-[8px] font-black tracking-widest uppercase ${s.color}`}>{s.label}</span>
                                            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-600">{new Date(p.created_at).toLocaleDateString('es-PE')}</span>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                    
                    {purchases.length === 0 && (
                        <motion.div 
                            initial={{ opacity: 0 }} 
                            animate={{ opacity: 1 }}
                            className="col-span-full py-20 flex flex-col items-center justify-center gap-4 text-slate-400 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-3xl"
                        >
                            <div className="w-16 h-16 bg-slate-50 dark:bg-slate-900 rounded-full flex items-center justify-center">
                                <span className="material-icons-round text-4xl opacity-20">done_all</span>
                            </div>
                            <div className="text-center">
                                <p className="font-black uppercase tracking-widest text-xs">¡Todo al día!</p>
                                <p className="text-[11px] mt-1 font-medium opacity-60">No hay solicitudes pendientes en este filtro.</p>
                            </div>
                        </motion.div>
                    )}
                </div>
            )}

            <AnimatePresence>
                {selectedPurchase && (
                    <RequestDetailModal purchase={selectedPurchase} onClose={() => setSelectedPurchase(null)} onAction={handleAction} onRejectModalOpen={id => setRejectModal({ isOpen: true, purchaseId: id, reason: '' })} />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {rejectModal.isOpen && (
                    <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setRejectModal({ isOpen: false, purchaseId: null, reason: '' })}>
                        <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} onClick={e => e.stopPropagation()} className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-slate-200 dark:border-slate-700">
                            <div className="w-14 h-14 rounded-full bg-red-50 dark:bg-red-900/30 text-red-500 flex items-center justify-center mb-4 mx-auto">
                                <span className="material-icons-round text-3xl">cancel</span>
                            </div>
                            <h3 className="font-black text-lg mb-1 text-center text-slate-900 dark:text-white uppercase tracking-tighter">Rechazar Solicitud</h3>
                            <p className="text-xs text-slate-500 mb-5 text-center font-medium leading-relaxed">Ingresa un motivo claro. El cliente recibirá una notificación con este mensaje.</p>
                            <textarea value={rejectModal.reason} onChange={e => setRejectModal({ ...rejectModal, reason: e.target.value })} placeholder="Ej: Comprobante ya usado, monto incorrecto o captura ilegible..."
                                className="w-full px-4 py-3 text-sm bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl focus:border-red-400 outline-none focus:ring-4 focus:ring-red-500/5 mb-4 transition-all font-medium dark:text-white resize-none h-24" autoFocus />
                            <div className="flex gap-3">
                                <button onClick={() => setRejectModal({ isOpen: false, purchaseId: null, reason: '' })} className="flex-1 py-3.5 rounded-2xl border-2 border-slate-100 dark:border-slate-700 text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">Cancelar</button>
                                <button onClick={() => handleAction(rejectModal.purchaseId, 'reject', rejectModal.reason)} disabled={!rejectModal.reason.trim()} className="flex-1 py-3.5 rounded-2xl bg-red-600 hover:bg-red-700 text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-red-500/20 active:scale-95 disabled:opacity-50 transition-all">Rechazar</button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
