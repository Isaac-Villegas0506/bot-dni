import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { getApiUrl } from '../utils/api';
import ModalLoading from '../components/ModalLoading';
import AlertModal from '../components/AlertModal';
import { OptionCard, ResultPanel, BackButton } from '../components/ui/ConsultSurface';
import HelpModal from '../components/HelpModal';
import PdfViewer from '../components/PdfViewer';

const option = {
    id: 'metadata',
    title: 'Info Global',
    icon: 'manage_search',
    color: 'bg-blue-600',
    desc: 'Toda la información de una persona por su DNI.',
    helpDesc: 'Obtiene el reporte integrado con toda la información de la persona consultada, incluyendo datos personales, teléfonos y denuncias.',
    helpDetails: ['Datos Personales Completos', 'Teléfonos y Líneas Asociadas', 'Denuncias y Registro Judicial']
};

export default function InfoGlobal() {
    const { user, token, openLoginModal } = useAuth();
    const [view, setView] = useState('selection');
    const [showInputModal, setShowInputModal] = useState(false);
    const [dni, setDni] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [alertMessage, setAlertMessage] = useState(null);
    const [helpModal, setHelpModal] = useState({ isOpen: false, title: '', description: '', details: [] });
    
    const [hasDownloaded, setHasDownloaded] = useState(false);
    const [showExitModal, setShowExitModal] = useState(false);
    const [exitCountDown, setExitCountDown] = useState(5);
    const autoSearchTriggered = useRef(false);

    // Auto-scroll a resultados
    useEffect(() => {
        if (view === 'result') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, [view]);

    // Exit countdown effect
    useEffect(() => {
        let timer;
        if (showExitModal && exitCountDown > 0) {
            timer = setInterval(() => {
                setExitCountDown(prev => prev - 1);
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [showExitModal, exitCountDown]);

    const openHelp = (e) => {
        e.stopPropagation();
        setHelpModal({
            isOpen: true,
            title: option.title,
            description: option.helpDesc,
            details: option.helpDetails
        });
    };

    const handleGenerate = useCallback(async (targetDni = dni) => {
        if (!targetDni || targetDni.length !== 8) {
            setAlertMessage('Por favor ingresa un DNI válido de 8 dígitos.');
            return;
        }

        if (!user) {
            setAlertMessage('Debes iniciar sesión para usar esta consulta premium.');
            setShowInputModal(false);
            openLoginModal();
            return;
        }

        setShowInputModal(false);
        setLoading(true);
        setAlertMessage(null);
        autoSearchTriggered.current = false; // reset for next time

        try {
            const response = await fetch(getApiUrl('/api/metadata'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ dni: targetDni })
            });

            const data = await response.json();

            if (!response.ok) {
                if (response.status === 402) {
                    setAlertMessage(data.detail?.message || 'Créditos insuficientes para realizar esta consulta.');
                } else if (response.status === 404) {
                    setAlertMessage('No se encontró información para este DNI.');
                } else if (response.status === 429) {
                    setAlertMessage('El bot está procesando demasiadas solicitudes. Por favor, intenta de nuevo en unos momentos.');
                } else {
                    setAlertMessage(data.detail || 'Error al buscar información.');
                }
                setLoading(false);
                return;
            }

            setResult(data);
            setHasDownloaded(false);
            setView('result');
        } catch (error) {
            setAlertMessage('Error de conexión con el servidor.');
        } finally {
            setLoading(false);
        }
    }, [dni, user, token, openLoginModal]);

    const handleDniChange = (e) => {
        const val = e.target.value.replace(/\D/g, '').slice(0, 8);
        setDni(val);
        if (val.length === 8 && !autoSearchTriggered.current) {
            autoSearchTriggered.current = true;
            handleGenerate(val);
        }
    };

    const handleOptionClick = () => {
        setDni('');
        autoSearchTriggered.current = false;
        setShowInputModal(true);
    };

    const handleBackClick = () => {
        if (view === 'result' && !hasDownloaded && result?.pdf_url) {
            setExitCountDown(5);
            setShowExitModal(true);
        } else {
            confirmExit();
        }
    };

    const confirmExit = () => {
        setShowExitModal(false);
        setView('selection');
        setDni('');
        setResult(null);
    };

    const handleDownloadPdf = async (pdfUrl) => {
        try {
            const response = await fetch(getApiUrl(`/api/static/${pdfUrl}`));
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = pdfUrl.split('/').pop() || 'metadata.pdf';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            // Delay revoke
            setTimeout(() => window.URL.revokeObjectURL(url), 200);
            setHasDownloaded(true);
        } catch (error) {
            console.error('Error downloading PDF:', error);
            setAlertMessage('No se pudo descargar el archivo.');
        }
    };

    return (
        <div className="w-full max-w-5xl mx-auto p-4 flex flex-col items-center">
            
            <HelpModal
                isOpen={helpModal.isOpen}
                onClose={() => setHelpModal({ ...helpModal, isOpen: false })}
                title={helpModal.title}
                description={helpModal.description}
                details={helpModal.details}
            />

            {/* VISTA 1: Selección (Option Card) */}
            {view === 'selection' && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl">
                        <OptionCard
                            option={option}
                            onSelect={handleOptionClick}
                            onHelp={openHelp}
                            creditsLabel="1 Crédito"
                            actionLabel="Generar"
                            accent="blue"
                        />
                </motion.div>
            )}

            {/* VISTA 2: Resultados */}
            {view === 'result' && result && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-4xl space-y-6 pb-20">
                    <ResultPanel className="overflow-hidden">
                        
                        {/* Header de Resultados */}
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50 dark:bg-slate-800/50 p-4 md:px-6 border-b border-slate-200 dark:border-slate-800">
                            <div>
                                <h2 className="text-xl font-black flex items-center gap-2">
                                    <span className="material-icons-round text-emerald-500">check_circle</span>
                                    Reporte Integrado de Persona
                                </h2>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Resultados para el DNI: <span className="font-bold text-slate-700 dark:text-slate-200">{result.dni}</span></p>
                            </div>
                        </div>

                        {/* Tarjeta de Datos Estructurados */}
                        <div className="bg-slate-50 dark:bg-slate-800/50 px-6 py-4 border-b border-slate-200 dark:border-slate-700 mt-4">
                            <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                <span className="material-icons-round text-blue-500">person</span>
                                Datos Personales
                            </h3>
                        </div>
                        <div className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                                <div className="space-y-1">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nombre Completo</p>
                                    <p className="font-semibold text-lg">{result.datos.nombre || 'No registrado'}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Sexo</p>
                                    <p className="font-semibold text-lg">{result.datos.sexo || 'No registrado'}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Fecha de Nacimiento</p>
                                    <p className="font-semibold text-lg">{result.datos.nacimiento || 'No registrado'}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Edad</p>
                                    <p className="font-semibold text-lg">{result.datos.edad || 'No registrado'}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Estado Civil</p>
                                    <p className="font-semibold text-lg">{result.datos.estado_civil || 'No registrado'}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Caducidad DNI</p>
                                    <p className="font-semibold text-lg">{result.datos.caducidad_dni || 'No registrado'}</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-800/50 px-6 py-4 border-y border-slate-200 dark:border-slate-700">
                            <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                <span className="material-icons-round text-blue-500">location_on</span>
                                Ubicación
                            </h3>
                        </div>
                        <div className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="md:col-span-3 space-y-1">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Dirección</p>
                                    <p className="font-semibold text-lg">{result.datos.direccion || 'No registrado'}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Distrito</p>
                                    <p className="font-semibold text-lg">{result.datos.distrito || 'No registrado'}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Provincia</p>
                                    <p className="font-semibold text-lg">{result.datos.provincia || 'No registrado'}</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-800/50 px-6 py-4 border-y border-slate-200 dark:border-slate-700">
                            <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                <span className="material-icons-round text-blue-500">phone_android</span>
                                Teléfonos Asociados
                            </h3>
                        </div>
                        <div className="p-6">
                            {result.datos.telefonos && result.datos.telefonos.length > 0 ? (
                                <div className="flex flex-wrap gap-4">
                                    {result.datos.telefonos.map((tel, idx) => (
                                        <div key={idx} className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-3 rounded-xl flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                                <span className="material-icons-round text-blue-600 dark:text-blue-400">phone</span>
                                            </div>
                                            <div>
                                                <p className="font-black text-lg text-slate-800 dark:text-white leading-tight">{tel.numero}</p>
                                                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{tel.operadora}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-slate-500 italic">No se encontraron teléfonos asociados.</p>
                            )}
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-800/50 px-6 py-4 border-y border-slate-200 dark:border-slate-700">
                            <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                <span className="material-icons-round text-red-500">gavel</span>
                                Denuncias Policiales / Judiciales
                            </h3>
                        </div>
                        <div className="p-6">
                            <div className="flex items-center gap-4">
                                <div className={`w-14 h-14 rounded-full flex items-center justify-center ${parseInt(result.datos.denuncias) > 0 ? 'bg-red-100 dark:bg-red-900/30 text-red-600' : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600'}`}>
                                    <span className="material-icons-round text-3xl">{parseInt(result.datos.denuncias) > 0 ? 'warning' : 'verified_user'}</span>
                                </div>
                                <div>
                                    <p className="font-black text-2xl">{result.datos.denuncias}</p>
                                    <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Denuncias Registradas</p>
                                </div>
                            </div>
                            {parseInt(result.datos.denuncias) > 0 && (
                                <p className="mt-4 text-sm text-red-600 dark:text-red-400 font-medium bg-red-50 dark:bg-red-900/10 p-3 rounded-lg">
                                    Esta persona cuenta con registros. Revisa el documento PDF a continuación para ver el detalle completo de las denuncias, roles y comisarías.
                                </p>
                            )}
                        </div>

                        {/* Visor de PDF embebido */}
                        {result.pdf_url && (
                            <div className="mt-4 px-6 pb-4">
                                <h3 className="text-xs font-bold text-slate-500 mb-3 uppercase tracking-wider">Vista Previa del Informe</h3>
                                <PdfViewer
                                    url={getApiUrl(`/api/static/${result.pdf_url}`)}
                                    height="500px"
                                />
                            </div>
                        )}
                        
                        {/* 3. Buttons Bottom */}
                        <div className="flex flex-row w-full gap-3 p-6 border-t border-slate-200 dark:border-slate-800">
                            {result.pdf_url && (
                                <button
                                    onClick={() => handleDownloadPdf(result.pdf_url)}
                                    className="flex-1 py-4 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 text-lg"
                                >
                                    <span className="material-icons-round">download</span>
                                    Descargar PDF
                                </button>
                            )}

                            <button
                                onClick={handleBackClick}
                                className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm"
                            >
                                Volver
                            </button>
                        </div>

                    </ResultPanel>
                </motion.div>
            )}

            {/* Modal de Input de DNI */}
            {createPortal(
                <AnimatePresence>
                    {showInputModal && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center px-[max(1rem,var(--safe-left))] pr-[max(1rem,var(--safe-right))] py-[max(1rem,var(--safe-top))] pb-[max(1rem,var(--safe-bottom))] bg-black/50 backdrop-blur-sm">
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.9, opacity: 0 }}
                                className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-2xl max-w-sm w-full border border-slate-200 dark:border-slate-700"
                            >
                                <div className="flex items-center gap-3 mb-6">
                                    <div className={`w-10 h-10 rounded-lg ${option.color} flex items-center justify-center text-white shrink-0`}>
                                        <span className="material-icons-round">{option.icon}</span>
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-900 dark:text-white leading-tight">
                                            {option.title}
                                        </h3>
                                        <p className="text-xs text-slate-500">Ingrese DNI para generar</p>
                                    </div>
                                </div>

                                <input
                                    type="text"
                                    value={dni}
                                    onChange={handleDniChange}
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
                                        onClick={() => handleGenerate()}
                                        disabled={!dni || dni.length !== 8}
                                        className={`flex-1 py-2.5 rounded-xl font-bold text-white transition-all shadow-lg ${!dni || dni.length !== 8 ? 'bg-slate-300 dark:bg-slate-700 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/30'}`}
                                    >
                                        Generar
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
                    <div className="fixed inset-0 z-[150] flex items-center justify-center px-[max(1rem,var(--safe-left))] pr-[max(1rem,var(--safe-right))] py-[max(1rem,var(--safe-top))] pb-[max(1rem,var(--safe-bottom))] bg-black/60 backdrop-blur-md">
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

            {loading && <ModalLoading loading={loading} />}
            <AlertModal isOpen={!!alertMessage} message={alertMessage} onClose={() => setAlertMessage(null)} />
        </div>
    );
}
