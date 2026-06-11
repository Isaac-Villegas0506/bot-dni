import { useSettings } from '../context/SettingsContext';
import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import HelpModal from './HelpModal';
import { useCreditCosts } from '../hooks/useCredits';
import { useAuth } from '../context/AuthContext';
import { useLoading } from '../context/LoadingContext';
import AlertModal from './AlertModal';
import { getApiUrl } from '../utils/api';
import PdfViewer from './PdfViewer';

export default function CertificadosPoliciales() {
    const { isFeatureEnabled } = useSettings();
    const { user, openLoginModal } = useAuth();
    const { loading, showLoading, hideLoading } = useLoading();
    const [view, setView] = useState(() => sessionStorage.getItem('certificados_view') || 'selection'); // 'selection' | 'result'
    const [selectedOption, setSelectedOption] = useState(null);
    const [showInputModal, setShowInputModal] = useState(false);
    const [dni, setDni] = useState('');
    const [helpModal, setHelpModal] = useState({ isOpen: false, title: '', description: '', details: [] });
    const [generatedData, setGeneratedData] = useState(() => {
        const saved = sessionStorage.getItem('certificados_data');
        return saved ? JSON.parse(saved) : null;
    });
    const [alert, setAlert] = useState({ isOpen: false, type: 'info', message: '' });

    useEffect(() => {
        sessionStorage.setItem('certificados_view', view);
    }, [view]);

    useEffect(() => {
        if (generatedData) {
            sessionStorage.setItem('certificados_data', JSON.stringify(generatedData));
        } else {
            sessionStorage.removeItem('certificados_data');
        }
    }, [generatedData]);
    const [hasDownloaded, setHasDownloaded] = useState(false);
    const [showExitModal, setShowExitModal] = useState(false);
    const [exitCountDown, setExitCountDown] = useState(5);
    const autoSearchTriggered = useRef(false);

    // Dynamic credit costs from backend
    const { getCost } = useCreditCosts();

    const options = [
        {
            id: 'antecedentes_policiales',
            title: 'Certificado de Antecedentes Policiales',
            icon: 'policy',
            color: 'bg-slate-700',
            desc: 'Consulta de antecedentes en la Policía Nacional',
            credits: getCost('antecedentes_policiales', 2),
            helpDesc: 'Documento oficial que muestra si la persona tiene o no antecedentes registrados ante la Policía Nacional.',
            helpDetails: [
                'Verificación en base de datos PNP',
                'Registro de denuncias y detenciones',
                'Válido para trámites oficiales'
            ]
        },
        {
            id: 'antecedentes_penales',
            title: 'Certificado de Antecedentes Penales',
            icon: 'gavel',
            color: 'bg-red-800',
            desc: 'Acredita condenas por delitos penales',
            credits: getCost('antecedentes_penales', 2),
            helpDesc: 'Documento que acredita si la persona ha sido procesada o condenada por delitos penales.',
            helpDetails: [
                'Registro Nacional de Condenas',
                'Verificación de procesos concluidos',
                'Documento emitido por el INPE'
            ]
        },
        {
            id: 'antecedentes_judiciales',
            title: 'Certificado de Antecedentes Judiciales',
            icon: 'account_balance',
            color: 'bg-indigo-900',
            desc: 'Procesos judiciales activos o sentencias',
            credits: getCost('antecedentes_judiciales', 2),
            helpDesc: 'Documento emitido por el Poder Judicial que indica si la persona tiene procesos judiciales activos o sentencias registradas.',
            helpDetails: [
                'Procesos en curso o archivados',
                'Sentencias del Poder Judicial',
                'Información de carácter jurisdiccional'
            ]
        },
    ];

    // Effect for exit countdown
    useEffect(() => {
        let timer;
        if (showExitModal && exitCountDown > 0) {
            timer = setTimeout(() => setExitCountDown(prev => prev - 1), 1000);
        }
        return () => clearTimeout(timer);
    }, [showExitModal, exitCountDown]);

    const openHelp = (e, opt) => {
        e.stopPropagation();
        setHelpModal({
            isOpen: true,
            title: opt.title,
            description: opt.helpDesc,
            details: opt.helpDetails
        });
    };

    const handleOptionClick = (opt) => {
        setSelectedOption(opt);
        setDni('');
        setShowInputModal(true);
    };

    const handleGenerate = useCallback(async () => {
        if (!user) {
            openLoginModal();
            return;
        }
        if (!dni || dni.length !== 8) return;

        const cost = selectedOption.credits;
        const userCredits = user?.credits ?? 0;
        const isPremium = user?.is_premium ?? false;

        if (userCredits < cost && !isPremium) {
            setAlert({
                isOpen: true,
                type: 'insufficient_credits',
                message: `No tienes suficientes créditos para realizar esta consulta. Esta acción requiere ${cost} créditos.`,
            });
            setShowInputModal(false);
            return;
        }

        setShowInputModal(false);
        showLoading();

        try {
            const token = localStorage.getItem('token');
            const endpoints = {
                'antecedentes_policiales': '/api/policiales/antpol',
                'antecedentes_penales': '/api/penales/antpen',
                'antecedentes_judiciales': '/api/judiciales/antjud'
            };
            const endpoint = endpoints[selectedOption.id];

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ dni })
            });

            const data = await res.json();

            if (!res.ok) {
                let errMsg = "Ocurrió un error inesperado. Intenta nuevamente.";
                if (res.status === 402) {
                    errMsg = 'Créditos insuficientes. Recarga para continuar.';
                } else if (res.status === 404) {
                    errMsg = '⚠️ No se encontraron resultados para el DNI ingresado. Verifica los datos e intenta nuevamente en 15 segundos.';
                } else if (data.detail) {
                    errMsg = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
                }
                throw new Error(errMsg);
            }

            // Success
            setGeneratedData({
                dni: dni,
                type: selectedOption,
                timestamp: new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' }),
                file_path: data.file_path,
                data: data.data || data
            });
            setView('result');
            setHasDownloaded(false);
        } catch (err) {
            setAlert({ isOpen: true, type: 'error', message: err.message });
        } finally {
            hideLoading();
        }
    }, [dni, selectedOption, user, showLoading, hideLoading]);

    // Auto-search when DNI reaches 8 digits in the input modal.
    // Declared AFTER handleGenerate to avoid TDZ on the dep array.
    useEffect(() => {
        if (showInputModal && dni.length === 8 && !loading && !autoSearchTriggered.current) {
            autoSearchTriggered.current = true;
            handleGenerate();
        }
        if (dni.length !== 8) {
            autoSearchTriggered.current = false;
        }
    }, [dni, showInputModal, loading, handleGenerate]);

    const handleBackClick = () => {
        if (view === 'result' && !hasDownloaded) {
            setExitCountDown(5);
            setShowExitModal(true);
        } else {
            resetView();
        }
    };

    const confirmExit = () => {
        setShowExitModal(false);
        resetView();
    };

    const resetView = () => {
        setView('selection');
        setGeneratedData(null);
        sessionStorage.removeItem('certificados_view');
        sessionStorage.removeItem('certificados_data');
        setSelectedOption(null);
        setDni('');
        setHasDownloaded(false);
    };

    const forceDownload = async (url, filename) => {
        try {
            const res = await fetch(url);
            const blob = await res.blob();
            const blobUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(blobUrl), 200);
        } catch (e) {
            console.error('Download failed:', e);
        }
    };

    const downloadPdf = async () => {
        if (!generatedData?.file_path) return;
        setHasDownloaded(true);
        const filename = generatedData.file_path.split('/').pop();
        await forceDownload(getApiUrl(generatedData.file_path), filename);
    };

    const handleCopy = (text) => {
        navigator.clipboard.writeText(text)
            .then(() => setAlert({ isOpen: true, type: 'success', message: 'Copiado al portapapeles' }))
            .catch(() => setAlert({ isOpen: true, type: 'error', message: 'Error al copiar' }));
    };

    const getParsedData = () => {
        if (!generatedData) return [];

        return [
            { label: 'DNI', value: generatedData.dni },
            { label: 'CERTIFICADO', value: generatedData.type.title },
            { label: 'FECHA', value: generatedData.timestamp },
            { label: 'ESTADO', value: 'Generado con Éxito' }
        ];
    };

    const parsedData = view === 'result' ? getParsedData() : [];

    return (
        <div className="w-full max-w-5xl mx-auto p-4 flex flex-col items-center min-h-[80vh]">

            <HelpModal
                isOpen={helpModal.isOpen}
                onClose={() => setHelpModal({ ...helpModal, isOpen: false })}
                title={helpModal.title}
                description={helpModal.description}
                details={helpModal.details}
            />

            {/* SELECTION VIEW */}
            {view === 'selection' && !loading && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl"
                >
                    {options.filter(opt => isFeatureEnabled('option_' + opt.id)).map((opt) => (
                        <div
                            key={opt.id}
                            onClick={() => handleOptionClick(opt)}
                            className="group relative bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 hover:shadow-xl hover:border-blue-500 dark:hover:border-blue-500 transition-all text-left flex flex-col gap-3 hover:-translate-y-1 min-h-[140px] cursor-pointer"
                        >
                            <button
                                onClick={(e) => openHelp(e, opt)}
                                className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center transition-colors z-10 border border-slate-100 dark:border-slate-700"
                                aria-label="Información"
                            >
                                <span className="material-icons-round text-slate-400 dark:text-slate-500 text-base">help_outline</span>
                            </button>

                            <div className={`w-12 h-12 rounded-xl ${opt.color} flex items-center justify-center text-white shadow-lg shrink-0 group-hover:scale-110 transition-transform`}>
                                <span className="material-icons-round text-2xl">{opt.icon}</span>
                            </div>

                            <div>
                                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-0.5 leading-tight">{opt.title}</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">{opt.desc}</p>
                            </div>

                            <div className="mt-auto pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-bold text-sm">
                                    <span className="material-icons-round text-sm">toll</span>
                                    {opt.credits} créditos
                                </div>
                                <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-slate-400 group-hover:text-blue-500 transition-colors font-black">
                                    Consultar
                                    <span className="material-icons-round text-xs">arrow_forward</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </motion.div>
            )}

            {/* RESULT VIEW */}
            {view === 'result' && generatedData && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-3xl shadow-xl overflow-hidden border border-slate-200 dark:border-slate-800"
                >
                    <div className="p-8 flex flex-col items-center relative">
                        {/* Back button (Arrow) */}
                        <button
                            onClick={handleBackClick}
                            className="absolute top-6 left-6 w-10 h-10 flex items-center justify-center shrink-0 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all hover:scale-110 active:scale-95 shadow-md shadow-black/10 dark:shadow-black/30"
                            title="Volver"
                        >
                            <span className="material-icons-round">arrow_back</span>
                        </button>

                        {/* 1. Success Icon */}
                        <div className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center text-white mb-4 shadow-lg shadow-emerald-500/30">
                            <span className="material-icons-round text-4xl">check</span>
                        </div>

                        <h3 className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mb-6 tracking-wide text-center">
                            CERTIFICADO GENERADO CON ÉXITO
                        </h3>

                        {/* Data Table */}
                        <div className="w-full bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 mb-6 border border-slate-100 dark:border-slate-700">
                            <div className="grid grid-cols-1 gap-2">
                                {parsedData.map((item, idx) => (
                                    <div key={idx} className="flex items-start text-sm">
                                        <span className="font-bold text-slate-500 dark:text-slate-400 w-24 shrink-0">{item.label}</span>
                                        <span className="text-slate-400 mx-2">:</span>
                                        <span className="font-bold text-slate-800 dark:text-white truncate flex items-center gap-2">
                                            {item.value}
                                            {item.label === 'DNI' && (
                                                <button
                                                    onClick={() => handleCopy(item.value)}
                                                    className="text-slate-400 hover:text-blue-500 transition-colors active:scale-90 p-0.5"
                                                >
                                                    <span className="material-icons-round text-sm">content_copy</span>
                                                </button>
                                            )}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Document Preview — funciona en desktop y móvil */}
                        {generatedData.file_path && (
                            <PdfViewer
                                url={getApiUrl(`/api/static/${generatedData.file_path}`)}
                                height="420px"
                                className="mb-8"
                            />
                        )}

                        {/* Buttons */}
                        <div className="flex flex-col w-full gap-3">
                            <button
                                onClick={downloadPdf}
                                className="w-full py-4 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 text-lg hover:scale-[1.02]"
                            >
                                <span className="material-icons-round">download</span>
                                Descargar Certificado
                            </button>

                            <button
                                onClick={handleBackClick}
                                className="w-full py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm"
                            >
                                Volver
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* INPUT DNI MODAL (PORTAL) */}
            {createPortal(
                <AnimatePresence>
                    {showInputModal && selectedOption && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.9, opacity: 0 }}
                                className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-2xl max-w-sm w-full border border-slate-200 dark:border-slate-700"
                            >
                                <div className="flex items-center gap-3 mb-6">
                                    <div className={`w-10 h-10 rounded-lg ${selectedOption.color} flex items-center justify-center text-white shrink-0`}>
                                        <span className="material-icons-round">{selectedOption.icon}</span>
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-900 dark:text-white leading-tight">
                                            {selectedOption.title}
                                        </h3>
                                        <p className="text-xs text-slate-500">Ingrese DNI para consultar</p>
                                    </div>
                                </div>

                                <input
                                    type="text"
                                    value={dni}
                                    onChange={(e) => setDni(e.target.value.replace(/\D/g, '').slice(0, 8))}
                                    onKeyDown={(e) => e.key === 'Enter' && dni.length === 8 && handleGenerate()}
                                    placeholder="DNI (8 dígitos)"
                                    className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border-none ring-1 ring-slate-200 dark:ring-slate-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all font-mono text-lg text-center mb-6 text-slate-900 dark:text-white"
                                    autoFocus
                                />

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setShowInputModal(false)}
                                        className="flex-1 py-2.5 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleGenerate}
                                        disabled={!dni || dni.length !== 8}
                                        className={`flex-1 py-2.5 rounded-xl font-bold text-white transition-all shadow-lg ${!dni || dni.length !== 8 ? 'bg-slate-300 dark:bg-slate-700 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/30'
                                            }`}
                                    >
                                        Consultar
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>,
                document.body
            )}

            {/* EXIT CONFIRMATION MODAL */}
            {createPortal(
                <AnimatePresence>
                    {showExitModal && (
                        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.9, opacity: 0 }}
                                className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-2xl max-w-sm w-full border border-slate-200 dark:border-slate-700"
                            >
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                                        <span className="material-icons-round text-amber-600 dark:text-amber-400">warning</span>
                                    </div>
                                    <h3 className="font-bold text-slate-900 dark:text-white text-base">¿Salir sin descargar?</h3>
                                </div>
                                <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                                    No has descargado el resultado todavía. Si sales, perderás el resultado generado y <strong>no se reembolsarán los créditos</strong>.
                                </p>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setShowExitModal(false)}
                                        className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm"
                                    >
                                        Quedarse
                                    </button>
                                    <button
                                        onClick={confirmExit}
                                        disabled={exitCountDown > 0}
                                        className={`flex-1 py-3 rounded-xl font-bold text-white text-sm transition-all flex items-center justify-center gap-2 ${exitCountDown > 0 ? 'bg-slate-400 cursor-not-allowed' : 'bg-red-500 hover:bg-red-600'}`}
                                    >
                                        {exitCountDown > 0 ? (
                                            <>
                                                <span className="material-icons-round text-base animate-spin">sync</span>
                                                Salir ({exitCountDown}s)
                                            </>
                                        ) : (
                                            <>
                                                <span className="material-icons-round text-base">exit_to_app</span>
                                                Sí, salir
                                            </>
                                        )}
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>,
                document.body
            )}

            {createPortal(
                <AlertModal
                    isOpen={alert.isOpen}
                    type={alert.type}
                    message={alert.message}
                    onClose={() => setAlert({ ...alert, isOpen: false })}
                />,
                document.body
            )}
        </div>
    );
}
