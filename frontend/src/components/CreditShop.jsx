import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import Modal from './ui/Modal';
import { ModalButton, ModalCloseButton, ModalHeader, ModalSection } from './ui/ModalElements';
import { Z_INDEX } from '../lib/zIndex';

const STATUS_INFO = {
    pending: { label: 'Pendiente', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', icon: 'schedule' },
    processing: { label: 'En proceso', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300', icon: 'autorenew' },
    approved: { label: 'Aprobado', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300', icon: 'check_circle' },
    rejected: { label: 'Rechazado', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300', icon: 'cancel' },
};

// ─── Payment Method Modal ──────────────────────────────────────────────────
function PaymentMethodModal({ plan, onSelect, onClose }) {
    return (
        <Modal isOpen onClose={onClose} size="sm" panelClassName="overflow-hidden" zIndex={Z_INDEX.modalAbove}>
            <ModalCloseButton onClick={onClose} />
            <div className="space-y-5 p-5 pt-6">
                <ModalHeader
                    title="Metodo de pago"
                    description="Confirma el plan y elige como realizaras el pago."
                    align="center"
                />
                <ModalSection className="text-center">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Plan a comprar</p>
                    <p className="mt-1 text-base font-bold text-slate-900 dark:text-white">{plan.name}</p>
                    <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">S/ {parseFloat(plan.price_soles).toFixed(2)}</p>
                </ModalSection>
                <div className="grid grid-cols-1 gap-3">
                    {['yape'].map(method => (
                        <button
                            key={method}
                            type="button"
                            onClick={() => onSelect(method)}
                            className="flex min-h-[44px] items-center justify-center gap-3 rounded-lg border border-slate-200 p-4 font-bold uppercase tracking-wide text-slate-700 transition-colors hover:border-blue-400 hover:bg-blue-50 dark:border-slate-700 dark:text-slate-200 dark:hover:border-blue-700 dark:hover:bg-blue-950/20"
                        >
                            <img
                                src={`/payments/${method}/${method}-logo.png`}
                                alt={method}
                                className="h-8 object-contain"
                                onError={e => { e.target.style.display = 'none'; }}
                            />
                            <span className="text-sm">{method}</span>
                        </button>
                    ))}
                </div>
                <ModalButton onClick={onClose} variant="secondary" className="w-full">Cerrar</ModalButton>
            </div>
        </Modal>
    );
}

function _PaymentMethodModalLegacy({ plan, onSelect, onClose }) {
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center px-[max(1rem,var(--safe-left))] pr-[max(1rem,var(--safe-right))] py-[max(1rem,var(--safe-top))] pb-[max(1rem,var(--safe-bottom))] bg-slate-950/40 backdrop-blur-md" onClick={onClose}>
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                onClick={e => e.stopPropagation()}
                className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-8 w-full max-w-sm border border-slate-200 dark:border-slate-800"
            >
                <h3 className="text-xl font-bold text-slate-900 dark:text-white text-center mb-4">Método de Pago</h3>
                <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-4 mb-6 flex flex-col items-center border border-indigo-100 dark:border-indigo-800/50">
                    <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">Plan a comprar</p>
                    <p className="text-lg font-black text-indigo-700 dark:text-indigo-400 text-center leading-tight mb-2">{plan.name}</p>
                    <div className="w-full h-px bg-indigo-200/50 dark:bg-indigo-800/50 my-1"></div>
                    <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">S/ {parseFloat(plan.price_soles).toFixed(2)}</p>
                </div>
                <div className="grid grid-cols-1 gap-4">
                    {['yape'].map(method => (
                        <button
                            key={method}
                            onClick={() => onSelect(method)}
                            className="flex flex-col items-center gap-3 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-all group"
                        >
                            <img
                                src={`/payments/${method}/${method}-logo.png`}
                                alt={method}
                                className="h-10 object-contain grayscale group-hover:grayscale-0 transition-all"
                                onError={e => { e.target.style.display = 'none'; }}
                            />
                            <span className="uppercase font-bold text-xs tracking-widest text-slate-500 dark:text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">{method}</span>
                        </button>
                    ))}
                </div>
                <button onClick={onClose} className="mt-8 w-full text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">Cerrar</button>
            </motion.div>
        </div>
    );
}

// ─── QR Payment Modal ──────────────────────────────────────────────────────
function QRPaymentModal({ plan, method, onClose, onSuccess }) {
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [qrZoom, setQrZoom] = useState(false);
    const [showWarning, setShowWarning] = useState(false);

    const handleFile = e => {
        const f = e.target.files[0];
        if (!f) return;
        setFile(f);
        setPreview(URL.createObjectURL(f));
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        setError('');
        setShowWarning(false);
        try {
            const token = localStorage.getItem('token');
            const fd = new FormData();
            fd.append('plan_key', plan.plan_key);
            fd.append('payment_method', method);
            fd.append('receipt', file);
            const res = await fetch('/api/purchases/', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: fd,
            });
            if (!res.ok) {
                const d = await res.json();
                throw new Error(d.detail || 'Error al procesar la solicitud');
            }
            onSuccess();
        } catch (e) {
            setError(e.message);
        } finally {
            setSubmitting(false);
        }
    };

    const preSubmitCheck = () => {
        if (!file) { setError('Por favor sube el comprobante de pago.'); return; }
        setShowWarning(true);
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center px-[max(1rem,var(--safe-left))] pr-[max(1rem,var(--safe-right))] py-[max(1rem,var(--safe-top))] pb-[max(1rem,var(--safe-bottom))] bg-slate-950/40 backdrop-blur-md" onClick={onClose}>
            {qrZoom && (
                <div className="fixed inset-0 z-[210] flex items-center justify-center bg-slate-950/90 px-[max(1rem,var(--safe-left))] pr-[max(1rem,var(--safe-right))] py-[max(1rem,var(--safe-top))] pb-[max(1rem,var(--safe-bottom))]" onClick={() => setQrZoom(false)}>
                    <img src={`/payments/${method}/${method}-qr.png`} alt="QR" className="max-w-full max-h-[85dvh] object-contain rounded-xl" />
                </div>
            )}

            <AnimatePresence>
                {showWarning && (
                    <WarningModal 
                        onConfirm={handleSubmit} 
                        onClose={() => setShowWarning(false)} 
                    />
                )}
            </AnimatePresence>

            <motion.div
                initial={{ opacity: 0, scale: 0.98, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: 20 }}
                onClick={e => e.stopPropagation()}
                className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[85dvh] border border-slate-200 dark:border-slate-800"
            >
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <img src={`/payments/${method}/${method}-logo.png`} alt={method} className="h-8 object-contain" />
                        <div>
                            <p className="font-bold text-slate-900 dark:text-white capitalize">{method}</p>
                            <p className="text-xs text-slate-500">{plan.name} — S/{parseFloat(plan.price_soles).toFixed(2)}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors">
                        <span className="material-icons-round">close</span>
                    </button>
                </div>

                <div className="p-4 md:p-8 overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-12">
                        <div className="flex flex-col items-center gap-4 md:gap-6">
                            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 cursor-zoom-in" onClick={() => setQrZoom(true)}>
                                <img src={`/payments/${method}/${method}-qr.png`} alt="QR" className="w-32 h-32 md:w-48 md:h-48 object-contain" />
                            </div>
                            <div className="text-center flex flex-col items-center w-full">
                                <div className="mb-5 w-full bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/50 p-4 rounded-2xl">
                                    <p className="text-[10px] md:text-xs text-indigo-400 uppercase tracking-widest font-bold mb-1">Plan a Comprar</p>
                                    <p className="text-xl md:text-2xl font-black text-indigo-700 dark:text-indigo-400 leading-tight">
                                        {plan.name}
                                    </p>
                                </div>
                                <div className="w-full">
                                    <p className="text-xs text-slate-400 uppercase tracking-widest font-bold mb-1">Total a Pagar</p>
                                    <p className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tighter">S/ {parseFloat(plan.price_soles).toFixed(2)}</p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4 md:space-y-8">
                            <div className="p-4 md:p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                                <p className="text-xs md:text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                                    Escanea el código QR desde tu aplicación y realiza el pago. Luego, adjunta la captura de pantalla del comprobante.
                                </p>
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Comprobante de Pago</label>
                                <label className="relative group flex flex-col items-center justify-center p-4 md:p-8 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-500 hover:bg-indigo-50/30 dark:hover:bg-indigo-500/5 transition-all cursor-pointer">
                                    {preview ? (
                                        <img src={preview} alt="preview" className="max-h-48 rounded-lg shadow-sm" />
                                    ) : (
                                        <div className="text-center">
                                            <span className="material-icons-round text-3xl text-slate-300 group-hover:text-indigo-400 mb-2">upload_file</span>
                                            <p className="text-sm font-bold text-slate-400 group-hover:text-indigo-500">Seleccionar imagen</p>
                                        </div>
                                    )}
                                    <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
                                </label>
                            </div>

                            {error && <p className="text-sm font-medium text-red-500">{error}</p>}

                            <button
                                onClick={preSubmitCheck}
                                disabled={submitting}
                                className="w-full py-3 md:py-4 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold tracking-wide hover:shadow-xl hover:-translate-y-1 transition-all disabled:opacity-50"
                            >
                                {submitting ? 'Procesando...' : 'Confirmar Envío'}
                            </button>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}

// ─── Warning Modal ──────────────────────────────────────────────────────────
function WarningModal({ onConfirm, onClose }) {
    return (
        <Modal isOpen onClose={onClose} size="sm" panelClassName="overflow-hidden" zIndex={Z_INDEX.modalAbove + 1}>
            <ModalCloseButton onClick={onClose} />
            <div className="space-y-5 p-5 pt-6">
                <ModalHeader
                    title="Aviso de seguridad"
                    description="Confirma que el comprobante corresponde al pago real y al monto indicado."
                    tone="danger"
                    align="center"
                />
                <ModalSection className="border-red-200 bg-red-50 text-sm leading-relaxed text-red-700 dark:border-red-900/60 dark:bg-red-950/25 dark:text-red-300">
                    Los comprobantes falsos o bromas pueden causar expulsion permanente del sistema.
                </ModalSection>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <ModalButton onClick={onClose} variant="secondary" className="w-full">Cancelar</ModalButton>
                    <ModalButton onClick={onConfirm} variant="danger" className="w-full">Entendido, enviar</ModalButton>
                </div>
            </div>
        </Modal>
    );
}

function _WarningModalLegacy({ onConfirm, onClose }) {
    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center px-[max(1rem,var(--safe-left))] pr-[max(1rem,var(--safe-right))] py-[max(1rem,var(--safe-top))] pb-[max(1rem,var(--safe-bottom))] bg-slate-950/60 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-8 w-full max-w-md border border-slate-200 dark:border-slate-800"
            >
                <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center mx-auto mb-6">
                    <span className="material-icons-round text-3xl text-red-500">gavel</span>
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white text-center mb-4">Aviso de Seguridad</h3>
                <div className="space-y-4 text-sm text-slate-600 dark:text-slate-400 leading-relaxed text-center mb-8">
                    <p>
                        Al enviar este comprobante, declaras que el pago es real y corresponde al monto indicado.
                    </p>
                    <div className="p-4 bg-red-50 dark:bg-red-950/20 rounded-2xl border border-red-100 dark:border-red-900/30 text-red-700 dark:text-red-400 font-medium">
                        Cualquier intento de fraude, envío de comprobantes falsos o bromas resultará en la <strong>expulsión permanente</strong> del sistema.
                    </div>
                    <ul className="text-left space-y-2 inline-block mx-auto">
                        <li className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                            Baneo permanente de su cuenta.
                        </li>
                        <li className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                            Bloqueo total de acceso.
                        </li>
                        <li className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                            Bloqueo de dirección IP.
                        </li>
                    </ul>
                </div>
                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Cancelar</button>
                    <button onClick={onConfirm} className="flex-1 py-3.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold hover:opacity-90 transition-opacity">Entendido, enviar</button>
                </div>
            </motion.div>
        </div>
    );
}

// ─── Success Modal ─────────────────────────────────────────────────────────
function SuccessModal({ onClose }) {
    return (
        <Modal isOpen onClose={onClose} size="sm" panelClassName="overflow-hidden" zIndex={Z_INDEX.modalAbove}>
            <div className="space-y-5 p-5 pt-6">
                <ModalHeader
                    title="Envio exitoso"
                    description="Tu pago esta siendo revisado. Recibiras una notificacion cuando sea aprobado."
                    tone="success"
                    align="center"
                    reserveCloseSpace={false}
                />
                <ModalButton onClick={onClose} variant="success" className="w-full">Entendido</ModalButton>
            </div>
        </Modal>
    );
}

function _SuccessModalLegacy({ onClose }) {
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center px-[max(1rem,var(--safe-left))] pr-[max(1rem,var(--safe-right))] py-[max(1rem,var(--safe-top))] pb-[max(1rem,var(--safe-bottom))] bg-slate-950/40 backdrop-blur-md">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-10 w-full max-w-sm text-center border border-slate-200 dark:border-slate-800"
            >
                <div className="w-20 h-20 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center mx-auto mb-6">
                    <span className="material-icons-round text-4xl text-emerald-500">done_all</span>
                </div>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">Envío Exitoso</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-8">
                    Tu pago está siendo revisado. Recibirás una notificación en cuanto sea aprobado (tiempo estimado: 5-15 min).
                </p>
                <button onClick={onClose} className="w-full py-4 rounded-2xl bg-emerald-500 text-white font-bold tracking-wide hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/20">Entendido</button>
            </motion.div>
        </div>
    );
}

// ─── Purchase History Modal ────────────────────────────────────────────────
function PurchaseHistoryModal({ onClose }) {
    const [purchases, setPurchases] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('token');
        fetch('/api/purchases/mine', { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.json())
            .then(d => { if (Array.isArray(d)) setPurchases(d); })
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    const getStatusStyles = (status) => {
        switch (status) {
            case 'approved': return 'border-emerald-500 bg-emerald-50/30 dark:bg-emerald-500/5 text-emerald-600 dark:text-emerald-400';
            case 'rejected': return 'border-red-500 bg-red-50/30 dark:bg-red-500/5 text-red-600 dark:text-red-400';
            case 'processing': return 'border-blue-500 bg-blue-50/30 dark:bg-blue-500/5 text-blue-600 dark:text-blue-400';
            default: return 'border-amber-500 bg-amber-50/30 dark:bg-amber-500/5 text-amber-600 dark:text-amber-400';
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center px-[max(1rem,var(--safe-left))] pr-[max(1rem,var(--safe-right))] py-[max(1rem,var(--safe-top))] pb-[max(1rem,var(--safe-bottom))] bg-slate-950/60 backdrop-blur-sm" onClick={onClose}>
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                onClick={e => e.stopPropagation()}
                className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-xl max-h-[85dvh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800"
            >
                <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-800/30">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                            <span className="material-icons-round">history</span>
                        </div>
                        <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Historial de Compras</h3>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors flex items-center justify-center">
                        <span className="material-icons-round">close</span>
                    </button>
                </div>

                <div className="p-8 overflow-y-auto flex-1 custom-scrollbar">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <div className="w-10 h-10 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin"></div>
                            <p className="text-sm font-bold text-slate-400 animate-pulse">Cargando tus registros...</p>
                        </div>
                    ) : purchases.length === 0 ? (
                        <div className="text-center py-20">
                            <div className="w-20 h-20 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center mx-auto mb-6">
                                <span className="material-icons-round text-4xl text-slate-200 dark:text-slate-700">receipt_long</span>
                            </div>
                            <p className="text-lg font-bold text-slate-900 dark:text-white mb-1">Sin movimientos</p>
                            <p className="text-slate-400 text-sm">Aún no has realizado ninguna compra en el sistema.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {purchases.map(p => {
                                const info = STATUS_INFO[p.status] || STATUS_INFO.pending;
                                const statusClasses = getStatusStyles(p.status);
                                return (
                                    <motion.div 
                                        key={p.id}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className={`group relative flex items-center gap-5 p-5 rounded-3xl border-l-4 ${statusClasses} border-t border-r border-b border-transparent dark:border-slate-800 hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-none transition-all duration-300`}
                                    >
                                        <div className={`shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner ${info.color}`}>
                                            <span className="material-icons-round text-2xl">{info.icon}</span>
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1.5">
                                                <p className="font-black text-slate-900 dark:text-white truncate tracking-tight text-lg">{p.plan_label}</p>
                                                <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${info.color} shadow-sm`}>
                                                    {info.label}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
                                                <div className="flex items-center gap-1 text-[11px] font-bold">
                                                    <span className="material-icons-round text-xs">calendar_today</span>
                                                    {p.created_at ? new Date(p.created_at).toLocaleDateString('es-PE', {timeZone: 'America/Lima'}) : ''}
                                                </div>
                                                <div className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700"></div>
                                                <div className="flex items-center gap-1 text-[11px] font-bold text-indigo-500">
                                                    <span className="material-icons-round text-xs">payments</span>
                                                    {p.payment_method?.toUpperCase()}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="text-right shrink-0">
                                            <p className="text-xl font-black text-slate-900 dark:text-white tracking-tighter">S/ {parseFloat(p.amount_soles).toFixed(2)}</p>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total</p>
                                        </div>

                                        {p.payment_method && (
                                            <div className="absolute top-4 right-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                                <img src={`/payments/${p.payment_method}/${p.payment_method}-logo.png`} alt={p.payment_method} className="h-6 object-contain grayscale" />
                                            </div>
                                        )}
                                    </motion.div>
                                );
                            })}
                        </div>
                    )}
                </div>
                
                <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Bot DNI — Sistema de Facturación</p>
                </div>
            </motion.div>
        </div>
    );
}

import { useSettings } from '../context/settingsContextValue';

// ─── Main Component ────────────────────────────────────────────────────────
export default function CreditShop() {
    const { user } = useAuth();
    const { isFeatureEnabled } = useSettings();
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [unlimitedStatus, setUnlimitedStatus] = useState(null);

    const [selectedPlan, setSelectedPlan] = useState(null);
    const [paymentMethod, setPaymentMethod] = useState(null);
    const [showSuccess, setShowSuccess] = useState(false);
    const [showHistoryModal, setShowHistoryModal] = useState(false);

    useEffect(() => {
        const fetchPlans = async () => {
            try {
                const r = await fetch('/api/credit-packages');
                const data = await r.json();
                if (Array.isArray(data)) setPlans(data);
            } catch (e) {
                console.error("Error fetching plans:", e);
            }
        };

        const fetchUnlimited = async () => {
            const token = localStorage.getItem('token');
            if (!token) return;
            try {
                const r = await fetch('/api/user/unlimited-status', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (r.ok) {
                    const data = await r.json();
                    setUnlimitedStatus(data);
                }
            } catch {
                console.warn('No se pudo cargar estado ilimitado del usuario');
            }
        };

        Promise.all([fetchPlans(), fetchUnlimited()]).finally(() => setLoading(false));
    }, []);

    const handlePlanSelect = (plan) => {
        setSelectedPlan(plan);
        setPaymentMethod(null);
    };

    const handleMethodSelect = (method) => {
        setPaymentMethod(method);
    };

    const handleSuccess = () => {
        setSelectedPlan(null);
        setPaymentMethod(null);
        setShowSuccess(true);
    };

    const creditPlans = plans.filter(p => !p.is_premium).sort((a, b) => a.price_soles - b.price_soles);
    const unlimitedPlans = plans.filter(p => p.is_premium).sort((a, b) => a.price_soles - b.price_soles);

    return (
        <div className="w-full max-w-6xl mx-auto pb-20 px-4">
            
            {/* Header & History */}
            <div className="flex flex-col md:flex-row items-center justify-between mb-12 gap-6">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-2">Tienda de Créditos</h1>
                    <p className="text-slate-500 text-sm">Adquiere paquetes para realizar tus consultas al instante.</p>
                </div>
                <button
                    onClick={() => setShowHistoryModal(true)}
                    className="flex items-center gap-2 px-6 py-3 rounded-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 transition-all shadow-sm"
                >
                    <span className="material-icons-round text-lg">history</span>
                    Historial de Compras
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-20">
                    <div className="w-12 h-12 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin"></div>
                </div>
            ) : (
                <div className="space-y-20">
                    
                    {/* Unlimited Status Banner */}
                    {unlimitedStatus?.active && (
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-indigo-600 rounded-3xl p-8 text-white relative overflow-hidden shadow-2xl shadow-indigo-500/20"
                        >
                            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                                <div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className="material-icons-round">verified</span>
                                        <p className="text-xs font-bold uppercase tracking-widest text-indigo-100">Acceso Ilimitado Activo</p>
                                    </div>
                                    <h2 className="text-2xl font-bold">Tienes {unlimitedStatus.days_remaining} días restantes</h2>
                                    <p className="text-indigo-100/70 text-sm mt-1">Disfruta de búsquedas sin límites en todas nuestras herramientas.</p>
                                </div>
                                <div className="text-center px-6 py-3 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10">
                                    <p className="text-[10px] uppercase font-bold text-indigo-200 mb-1">Vence el</p>
                                    <p className="font-mono font-bold">{new Date(unlimitedStatus.unlimited_until).toLocaleDateString('es-PE', {timeZone: 'America/Lima'})}</p>
                                </div>
                            </div>
                            <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-white/5 rounded-full blur-3xl"></div>
                        </motion.div>
                    )}

                    {/* ── Paquetes de Créditos ── */}
                    <section>
                        <div className="flex items-center gap-4 mb-8">
                            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800"></div>
                            <h2 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">Paquetes de Créditos</h2>
                            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800"></div>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {creditPlans.map((plan, i) => {
                                const isPromo = plan.plan_key === 'cr_promo_1sol';
                                
                                // Ocultar paquete promo si el usuario ya lo compró o no está activo
                                if (isPromo) {
                                    if (!isFeatureEnabled('promo_pack_active')) return null;
                                    if (user?.has_bought_promo) return null;
                                }

                                const isBestValue = plan.plan_key === 'cr_pro';
                                const isPopular = plan.plan_key === 'cr_popular';
                                
                                return (
                                    <motion.div
                                        key={plan.plan_key}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.05 }}
                                        className={`relative group flex flex-col p-8 rounded-3xl bg-white dark:bg-slate-900 border transition-all hover:shadow-2xl hover:-translate-y-1 ${
                                            isPromo 
                                                ? 'border-fuchsia-500 shadow-xl shadow-fuchsia-500/10 ring-4 ring-fuchsia-500/10 dark:bg-slate-900'
                                                : isPopular 
                                                    ? 'border-indigo-500 shadow-xl shadow-indigo-500/5 ring-4 ring-indigo-500/5' 
                                                    : 'border-slate-100 dark:border-slate-800 shadow-sm'
                                        }`}
                                    >
                                        {isPromo && (
                                            <div className="absolute top-0 right-0 w-32 h-32 bg-fuchsia-500/10 blur-[40px] rounded-full pointer-events-none -mt-10 -mr-10"></div>
                                        )}

                                        {(isPopular || isBestValue || isPromo) && (
                                            <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-white shadow-lg z-10 ${
                                                isPromo ? 'bg-fuchsia-500' :
                                                isPopular ? 'bg-indigo-500' : 'bg-slate-800 dark:bg-slate-700'
                                            }`}>
                                                {isPromo ? 'Oferta Única' : isPopular ? 'Más Popular' : 'Mejor Valor'}
                                            </div>
                                        )}
                                        
                                        <div className="mb-6 flex justify-between items-start relative z-10">
                                            <div>
                                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{plan.name}</p>
                                                <div className="flex items-baseline gap-1">
                                                    <span className="text-5xl font-black text-slate-900 dark:text-white">{plan.credits}</span>
                                                    <span className="text-sm font-bold text-slate-400">créditos</span>
                                                </div>
                                            </div>
                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center relative z-10 ${
                                                isPromo ? 'bg-fuchsia-50 dark:bg-fuchsia-500/10 text-fuchsia-500' :
                                                isPopular ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500' : 'bg-slate-50 dark:bg-slate-800 text-slate-400'
                                            }`}>
                                                <span className="material-icons-round">{isPromo ? 'redeem' : isPopular ? 'star' : 'bolt'}</span>
                                            </div>
                                        </div>

                                        <div className="mt-auto pt-8 border-t border-slate-50 dark:border-slate-800 flex items-center justify-between relative z-10">
                                            <p className="text-2xl font-bold text-slate-900 dark:text-white">S/ {parseFloat(plan.price_soles).toFixed(2)}</p>
                                            <button
                                                onClick={() => handlePlanSelect(plan)}
                                                className={`px-6 py-3 rounded-xl text-sm font-black uppercase tracking-widest transition-all active:scale-95 ${
                                                    isPromo
                                                        ? 'bg-fuchsia-500 text-white hover:bg-fuchsia-600 shadow-lg shadow-fuchsia-500/20'
                                                        : isPopular 
                                                            ? 'bg-indigo-500 text-white hover:bg-indigo-600 shadow-lg shadow-indigo-500/20' 
                                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-700'
                                                }`}
                                            >
                                                Comprar
                                            </button>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </section>

                    {/* ── Planes Ilimitados ── */}
                    <section>
                        <div className="flex items-center gap-4 mb-8">
                            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800"></div>
                            <h2 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">Acceso Ilimitado</h2>
                            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800"></div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            {unlimitedPlans.map((plan, i) => {
                                const isPremium = plan.plan_key === 'unl_30d';
                                return (
                                    <motion.div
                                        key={plan.plan_key}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.05 + 0.3 }}
                                        className={`relative group flex flex-col p-8 rounded-3xl transition-all hover:shadow-2xl hover:-translate-y-1 overflow-hidden border ${
                                            isPremium 
                                                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent shadow-2xl' 
                                                : 'bg-indigo-50/50 dark:bg-slate-900 border-indigo-100 dark:border-indigo-900/30'
                                        }`}
                                    >
                                        {isPremium && (
                                            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 blur-[60px] rounded-full -mr-10 -mt-10"></div>
                                        )}
                                        
                                        <div className="mb-8">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-6 ${isPremium ? 'bg-white/10 dark:bg-slate-100 text-indigo-400' : 'bg-indigo-500 text-white'}`}>
                                                <span className="material-icons-round">{isPremium ? 'workspace_premium' : 'all_inclusive'}</span>
                                            </div>
                                            <h3 className="text-lg font-bold mb-1">{plan.name}</h3>
                                            <p className={`text-xs ${isPremium ? 'text-slate-400 dark:text-slate-500' : 'text-slate-500 dark:text-slate-400'}`}>Búsquedas sin límites</p>
                                        </div>

                                        <div className="mt-auto">
                                            <div className="flex items-baseline gap-1 mb-6">
                                                <span className="text-3xl font-black">S/ {parseFloat(plan.price_soles).toFixed(2)}</span>
                                            </div>
                                            <button
                                                onClick={() => handlePlanSelect(plan)}
                                                className={`w-full py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 ${
                                                    isPremium 
                                                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800' 
                                                        : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-600/20'
                                                }`}
                                            >
                                                Activar
                                            </button>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </section>
                </div>
            )}

            {/* Modals */}
            <AnimatePresence>
                {selectedPlan && !paymentMethod && (
                    <PaymentMethodModal plan={selectedPlan} onSelect={handleMethodSelect} onClose={() => setSelectedPlan(null)} />
                )}
                {selectedPlan && paymentMethod && (
                    <QRPaymentModal
                        plan={selectedPlan}
                        method={paymentMethod}
                        onClose={() => { setSelectedPlan(null); setPaymentMethod(null); }}
                        onSuccess={handleSuccess}
                    />
                )}
                {showSuccess && <SuccessModal onClose={() => setShowSuccess(false)} />}
                {showHistoryModal && <PurchaseHistoryModal onClose={() => setShowHistoryModal(false)} />}
            </AnimatePresence>
        </div>
    );
}
