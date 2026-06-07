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

function parseRecord(rawText) {
    if (!rawText) return [];
    
    const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
    const groups = [];
    let currentGroup = { title: 'Información', icon: 'info', items: [] };
    
    for (const line of lines) {
        // Remover caracteres especiales de Telegram
        let cleanLine = line.replace(/[*_`~]/g, '').trim();
        
        if (cleanLine.includes('INFOR DATA') || cleanLine.includes('RECORD VEHICULAR 「PREMIUM」')) continue;
        if (cleanLine.includes('CUENTA:') || cleanLine.includes('USUARIO:')) continue;
        
        // Detectar headers (con o sin emojis, que se van a eliminar)
        const headerMatch = cleanLine.match(/^(?:\u2700-\u27BF|\uE000-\uF8FF|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])?\s*(DATOS DEL CONDUCTOR|DATOS DE LICENCIA|UBICACIÓN|UBICACION|RECORD VEHICULAR)/i);
        
        if (headerMatch) {
            if (currentGroup.items.length > 0 || currentGroup.title !== 'Información') {
                groups.push(currentGroup);
            }
            let label = headerMatch[1].toUpperCase();
            let icon = 'info';
            if (label.includes('CONDUCTOR')) icon = 'person';
            else if (label.includes('LICENCIA')) icon = 'card_membership';
            else if (label.includes('UBICACIÓN') || label.includes('UBICACION')) icon = 'location_on';
            else if (label.includes('VEHICULAR')) icon = 'directions_car';
            
            currentGroup = { title: label, icon, items: [] };
            continue;
        }
        
        // Limpiar emojis al inicio de las líneas de datos
        cleanLine = cleanLine.replace(/^(?:\u2700-\u27BF|\uE000-\uF8FF|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])?\s*/, '');

        let parts = cleanLine.split('➣');
        if (parts.length < 2) parts = cleanLine.split(':');
        
        if (parts.length >= 2) {
            let label = parts[0].replace(/^[•\d.\s]+/, '').trim();
            let value = parts.slice(1).join('➣').trim();
            
            let icon = 'info';
            const labelUpper = label.toUpperCase();
            if (labelUpper.includes('DNI') || labelUpper.includes('DOC')) icon = 'badge';
            else if (labelUpper.includes('NOMBRE') || labelUpper.includes('PATERNO') || labelUpper.includes('MATERNO')) icon = 'person';
            else if (labelUpper.includes('LICENCIA')) icon = 'card_membership';
            else if (labelUpper.includes('CATEGORÍA') || labelUpper.includes('CLASE')) icon = 'category';
            else if (labelUpper.includes('ESTADO')) icon = 'verified';
            else if (labelUpper.includes('EXPEDICIÓN') || labelUpper.includes('VIGENTE') || labelUpper.includes('FECHA')) icon = 'event';
            else if (labelUpper.includes('DIRECCIÓN') || labelUpper.includes('DISTRITO') || labelUpper.includes('PROVINCIA') || labelUpper.includes('DEPARTAMENTO')) icon = 'location_on';
            else if (labelUpper.includes('INFRACCION') || labelUpper.includes('SANCION')) icon = 'warning';
            else if (labelUpper.includes('RECORD')) icon = 'history';
            
            currentGroup.items.push({ label, value, icon });
        }
    }
    
    if (currentGroup.items.length > 0) {
        groups.push(currentGroup);
    }
    return groups;
}

export default function Vehiculos() {
    const { user, openLoginModal } = useAuth();
    const { loading, showLoading, hideLoading } = useLoading();
    const [view, setView] = useState(() => sessionStorage.getItem('vehiculos_view') || 'selection');
    const [selectedOption, setSelectedOption] = useState(null);
    const [showInputModal, setShowInputModal] = useState(false);
    const [targetId, setTargetId] = useState('');
    const [helpModal, setHelpModal] = useState({ isOpen: false, title: '', description: '', details: [] });
    const [generatedData, setGeneratedData] = useState(() => {
        const saved = sessionStorage.getItem('vehiculos_data');
        return saved ? JSON.parse(saved) : null;
    });
    const [alert, setAlert] = useState({ isOpen: false, type: 'info', message: '' });

    useEffect(() => {
        sessionStorage.setItem('vehiculos_view', view);
    }, [view]);

    useEffect(() => {
        if (generatedData) {
            sessionStorage.setItem('vehiculos_data', JSON.stringify(generatedData));
        } else {
            sessionStorage.removeItem('vehiculos_data');
        }
    }, [generatedData]);
    const [hasDownloaded, setHasDownloaded] = useState(false);
    const [showExitModal, setShowExitModal] = useState(false);
    const [exitCountDown, setExitCountDown] = useState(5);

    const { getCost } = useCreditCosts();

    const options = [
        {
            id: 'record',
            title: 'Récord Vehicular',
            icon: 'directions_car',
            color: 'bg-indigo-600',
            desc: 'Récord vehicular de un conductor por DNI',
            credits: getCost('record_vehicular', 7),
            placeholder: 'DNI',
            helpDesc: 'Reporte completo que detalla el récord vehicular, datos del conductor, licencias, infracciones y sanciones.',
            helpDetails: [
                'Datos de licencia e infracciones',
                'Reporte de sanciones',
                'Documento en formato PDF si está disponible'
            ]
        }
    ];

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
        setTargetId('');
        setShowInputModal(true);
    };

    const handleGenerate = useCallback(async (overrideId = null) => {
        if (loading) return;
        if (!user) {
            openLoginModal();
            return;
        }
        const finalTargetId = typeof overrideId === 'string' ? overrideId : targetId;
        if (!finalTargetId) return;

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
            const res = await fetch('/api/vehiculos/record', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ target: finalTargetId })
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.detail || 'Error al generar la búsqueda');
            }

            setGeneratedData({
                ...data.data,
                parsedRecord: parseRecord(data.data.raw_text),
                queryTarget: finalTargetId,
                queryType: selectedOption.id,
                file_path: data.file_path
            });
            setHasDownloaded(false);
            setExitCountDown(5);
            setView('result');

        } catch (error) {
            setAlert({
                isOpen: true,
                type: 'error',
                message: error.message
            });
        } finally {
            hideLoading();
        }
    }, [user, openLoginModal, targetId, selectedOption, showLoading, hideLoading]);

    const downloadPdf = async () => {
        if (!generatedData?.file_path) return;
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(getApiUrl(`/api/static/${generatedData.file_path}`), {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (!res.ok) throw new Error("Error descargando el archivo");
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `RECORD_${generatedData.queryTarget}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            setHasDownloaded(true);
        } catch {
            setAlert({ isOpen: true, type: 'error', message: 'No se pudo descargar el archivo de forma segura.' });
        }
    };

    const handleBackClick = () => {
        if (!hasDownloaded && generatedData?.file_path) {
            setShowExitModal(true);
        } else {
            setView('selection');
            setGeneratedData(null);
            sessionStorage.removeItem('vehiculos_view');
            sessionStorage.removeItem('vehiculos_data');
        }
    };

    const confirmExit = () => {
        if (exitCountDown > 0) return;
        setShowExitModal(false);
        setView('selection');
        setGeneratedData(null);
        sessionStorage.removeItem('vehiculos_view');
        sessionStorage.removeItem('vehiculos_data');
    };

    return (
        <div className="w-full max-w-5xl mx-auto p-4 flex flex-col items-center min-h-[80vh]">
            {view === 'selection' && !loading && (
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl"
                    >
                        {options.map((opt) => (
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
                                    <span className="material-icons-round text-slate-300 dark:text-slate-600 group-hover:text-blue-500 transition-colors">
                                        arrow_forward
                                    </span>
                                </div>
                            </div>
                        ))}
                    </motion.div>
                )}

                {view === 'result' && generatedData && (
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="w-full max-w-5xl"
                    >
                        <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-200 dark:border-slate-800">
                            <button
                                onClick={handleBackClick}
                                className="bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-95 text-slate-700 dark:text-white font-semibold h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 transition-all duration-150 flex items-center justify-center gap-2 text-sm shadow-sm"
                            >
                                <span className="material-icons-round text-slate-400 text-[18px]">arrow_back</span>
                                <span>Regresar</span>
                            </button>
                            <h2 className="hidden sm:flex text-xl font-black text-slate-800 dark:text-white items-center gap-2">
                                <span className="material-icons-round text-green-500">check_circle</span>
                                Resultados de Búsqueda
                            </h2>
                        </div>
                        <div className="w-full max-w-3xl mx-auto flex flex-col gap-6">
                                {/* Visor de PDF (Arriba) */}
                                {generatedData.file_path ? (
                                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm flex flex-col">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                                                <span className="material-icons-round text-red-600 dark:text-red-400">picture_as_pdf</span>
                                            </div>
                                            <div className="flex-1 truncate">
                                                <span className="text-sm font-bold text-slate-800 dark:text-white block truncate">
                                                    RECORD_{generatedData.queryTarget}.pdf
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex-1 w-full flex justify-center">
                                            <PdfViewer
                                                url={getApiUrl(`/api/static/${generatedData.file_path}`)}
                                                height="500px"
                                                className="w-full max-w-[600px] object-contain bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700"
                                            />
                                        </div>
                                        <button
                                            onClick={downloadPdf}
                                            className="mt-4 w-full py-3 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-900 font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-sm shadow-md"
                                        >
                                            <span className="material-icons-round text-base">download</span>
                                            Descargar PDF
                                        </button>
                                    </div>
                                ) : (
                                    <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 text-center flex flex-col items-center justify-center min-h-[200px]">
                                        <span className="material-icons-round text-slate-400 text-4xl mb-3">description</span>
                                        <p className="text-slate-600 dark:text-slate-400 font-medium text-sm">
                                            Esta consulta no contiene documento adjunto.
                                        </p>
                                    </div>
                                )}

                                {/* Datos Parseados (Abajo) */}
                                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-700">
                                    <h3 className="text-lg font-black text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                                        <span className="material-icons-round text-indigo-500">directions_car</span>
                                        Detalles del Récord
                                    </h3>
                                    <div className="flex flex-col gap-6">
                                        {generatedData.parsedRecord.map((group, gIndex) => (
                                            <div key={gIndex} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 p-4 shadow-sm">
                                                <h4 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-3 uppercase tracking-widest flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                                                    <span className="material-icons-round text-[16px]">{group.icon}</span>
                                                    {group.title}
                                                </h4>
                                                <div className="flex flex-col gap-0.5 mt-2">
                                                    {group.items.map((item, i) => (
                                                        <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800/60 last:border-0 gap-1 sm:gap-4">
                                                            <div className="flex items-center gap-2">
                                                                <span className="material-icons-round text-slate-400 dark:text-slate-500 text-[16px]">{item.icon}</span>
                                                                <span className="font-semibold text-slate-500 dark:text-slate-400 text-[11px] uppercase tracking-wider">{item.label}</span>
                                                            </div>
                                                            <span className="font-medium text-[14px] text-slate-800 dark:text-white sm:text-right">{item.value}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                    </motion.div>
                )}

            {/* INPUT MODAL (PORTAL) */}
            {createPortal(
                <AnimatePresence>
                    {showInputModal && selectedOption && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                            <motion.div 
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.9, opacity: 0 }}
                                className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-2xl max-w-sm w-full border border-slate-200 dark:border-slate-700 relative z-10"
                            >
                                <div className="flex items-center gap-3 mb-6">
                                    <div className={`w-10 h-10 rounded-lg ${selectedOption.color} flex items-center justify-center text-white shrink-0`}>
                                        <span className="material-icons-round">{selectedOption.icon}</span>
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-900 dark:text-white leading-tight">
                                            {selectedOption.title}
                                        </h3>
                                        <p className="text-xs text-slate-500">
                                            Ingrese {selectedOption.placeholder} a consultar
                                        </p>
                                    </div>
                                </div>

                                <input 
                                    inputMode="numeric"
                                    maxLength={8} 
                                    placeholder={selectedOption.placeholder} 
                                    className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border-none ring-1 ring-slate-200 dark:ring-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono text-lg text-center mb-6 text-slate-900 dark:text-white uppercase"
                                    type="text" 
                                    value={targetId}
                                    onChange={(e) => {
                                        const val = e.target.value.replace(/\D/g, '');
                                        setTargetId(val);
                                        if (/^\d{8}$/.test(val)) {
                                            handleGenerate(val);
                                        }
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            const isDni = /^\d{8}$/.test(targetId);
                                            if (isDni) handleGenerate();
                                        }
                                    }}
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
                                        disabled={!/^\d{8}$/.test(targetId)} 
                                        className={`flex-1 py-2.5 rounded-xl font-bold text-white transition-all shadow-lg flex items-center justify-center gap-2 ${
                                            !/^\d{8}$/.test(targetId)
                                            ? 'bg-slate-300 dark:bg-slate-700 cursor-not-allowed'
                                            : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/30'
                                        }`}
                                    >
                                        <span className="material-icons-round text-sm">search</span>Consultar
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>,
                document.body
            )}

            {/* Exit Confirmation Modal */}
            <AnimatePresence>
                {showExitModal && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowExitModal(false)}></div>
                        <motion.div 
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-2xl max-w-sm w-full border border-slate-200 dark:border-slate-700 z-10"
                        >
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                                    <span className="material-icons-round text-amber-600 dark:text-amber-400">warning</span>
                                </div>
                                <h3 className="font-bold text-slate-900 dark:text-white text-base">¿Salir sin descargar?</h3>
                            </div>
                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                                Hay PDFs de resultados sin descargar. Si sales, perderás los datos y <strong>no se reembolsarán los créditos</strong>.
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
            </AnimatePresence>

            <HelpModal 
                isOpen={helpModal.isOpen} 
                onClose={() => setHelpModal({ ...helpModal, isOpen: false })} 
                {...helpModal} 
            />
            
            <AlertModal 
                isOpen={alert.isOpen} 
                onClose={() => setAlert({ ...alert, isOpen: false })} 
                type={alert.type} 
                message={alert.message} 
            />
        </div>
    );
}
