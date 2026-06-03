import { useState, useEffect } from 'react';
import Modal from './ui/Modal';

export default function SearchOptionModal({ isOpen, onClose, onConfirm, user, targetUser, premiumCost }) {
    const [searchType, setSearchType] = useState('basic');
    const [dniBusCost, setDniBusCost] = useState(premiumCost ?? null);

    // Fetch cost dynamically if not passed as prop
    useEffect(() => {
        if (premiumCost != null) {
            const syncTimer = setTimeout(() => setDniBusCost(premiumCost), 0);
            return () => clearTimeout(syncTimer);
        }
        fetch('/api/credits/costs')
            .then(r => r.ok ? r.json() : null)
            .then(d => { if (d?.costs?.dni_busqueda_premium?.cost != null) setDniBusCost(d.costs.dni_busqueda_premium.cost); })
            .catch(() => { });
    }, [premiumCost]);

    const handleConfirm = () => {
        onConfirm(searchType);
        onClose();
    };

    const premiumLabel = dniBusCost === 0
        ? null
        : dniBusCost != null
            ? `${dniBusCost} crédito${dniBusCost !== 1 ? 's' : ''}`
            : '5 créditos';

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="md" panelClassName="overflow-hidden">
            <div className="p-6">
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2 text-center">
                    Selecciona el tipo de consulta
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-center mb-6 text-sm">
                    Para: <span className="font-bold text-slate-700 dark:text-slate-300">{targetUser?.nombre_completo || 'Usuario'}</span>
                </p>

                <div className="space-y-4">
                    {/* Basic Option */}
                    <label className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${searchType === 'basic'
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-slate-200 dark:border-slate-700 hover:border-blue-400'
                        }`}>
                        <div className={`mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${searchType === 'basic' ? 'border-blue-600' : 'border-slate-400'
                            }`}>
                            {searchType === 'basic' && <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />}
                        </div>
                        <input
                            type="radio"
                            name="modalSearchType"
                            value="basic"
                            checked={searchType === 'basic'}
                            onChange={() => setSearchType('basic')}
                            className="hidden"
                        />
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-0.5">
                                <span className="font-bold text-slate-900 dark:text-white">Datos básicos</span>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                    <span className="material-icons-round text-[12px]" aria-hidden="true">check_circle</span>
                                    Gratis
                                </span>
                            </div>
                            <div className="text-sm text-slate-500">Consulta estándar ilimitada.</div>
                        </div>
                    </label>

                    {/* Premium Option */}
                    <label className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${searchType === 'premium'
                        ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20'
                        : 'border-slate-200 dark:border-slate-700 hover:border-amber-400'
                        }`}>
                        <div className={`mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${searchType === 'premium' ? 'border-amber-500' : 'border-slate-400'
                            }`}>
                            {searchType === 'premium' && <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />}
                        </div>
                        <input
                            type="radio"
                            name="modalSearchType"
                            value="premium"
                            checked={searchType === 'premium'}
                            onChange={() => setSearchType('premium')}
                            className="hidden"
                        />
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-0.5">
                                <span className="font-bold text-slate-900 dark:text-white">Datos premium</span>
                                {premiumLabel && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                        <span className="material-icons-round text-[12px]" aria-hidden="true">toll</span>
                                        {premiumLabel}
                                    </span>
                                )}
                            </div>
                            <div className="text-sm text-slate-500">Incluye fotos de rostro, firma y huellas.</div>
                            {!user && <div className="text-xs text-amber-600 mt-1 font-medium">Requiere registro/login.</div>}
                            {user && !user.is_premium && <div className="text-xs text-amber-600 mt-1 font-medium">5 créditos cada 24h (Gratis).</div>}
                        </div>
                    </label>
                </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-700">
                <button
                    onClick={onClose}
                    className="px-5 py-2.5 rounded-xl font-medium text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
                >
                    Cancelar
                </button>
                <button
                    onClick={handleConfirm}
                    className="px-6 py-2.5 rounded-xl font-bold text-white bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 shadow-lg shadow-blue-500/20 transition-all active:scale-95"
                >
                    Consultar
                </button>
            </div>
        </Modal>
    );
}
