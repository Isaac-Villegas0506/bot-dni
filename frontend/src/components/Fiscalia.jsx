import { useSettings } from '../context/SettingsContext';
import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import HelpModal from './HelpModal';
import { useCreditCosts } from '../hooks/useCredits';
import { useAuth } from '../context/AuthContext';
import { useLoading } from '../context/LoadingContext';
import AlertModal from './AlertModal';
import { getApiUrl } from '../utils/api';
import PdfViewer from './PdfViewer';

function parseFiscalia(rawText) {
    if (!rawText) return [];
    
    const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
    const data = [];
    
    for (const line of lines) {
        const cleanLine = line.replace(/[*_`]/g, '').trim();
        
        if (cleanLine.includes('INFOR DATA') || cleanLine.includes('FISCALIA - PDF') || cleanLine.includes('FISCALÍA RUC') || cleanLine.includes('FISCALÍA NOMBRES') || cleanLine.includes('FISCALÍA CASO')) continue;
        if (cleanLine.includes('CUENTA:') || cleanLine.includes('USUARIO:')) continue;
        
        let parts = cleanLine.split('➣');
        if (parts.length < 2) parts = cleanLine.split(':');
        
        if (parts.length >= 2) {
            let label = parts[0].replace(/^[•\d.\s]+/, '').trim();
            let value = parts.slice(1).join('➣').trim();
            
            data.push({ label, value });
        }
    }
    return [data];
}

export default function Fiscalia() {
    const { isFeatureEnabled } = useSettings();
    const { user, openLoginModal } = useAuth();
    const { loading, showLoading, hideLoading } = useLoading();
    const [view, setView] = useState(() => sessionStorage.getItem('fiscalia_view') || 'selection'); // 'selection' | 'result'
    const [selectedOption, setSelectedOption] = useState(null);
    const [showInputModal, setShowInputModal] = useState(false);
    const [targetId, setTargetId] = useState('');
    const [helpModal, setHelpModal] = useState({ isOpen: false, title: '', description: '', details: [] });
    const [generatedData, setGeneratedData] = useState(() => {
        const saved = sessionStorage.getItem('fiscalia_data');
        return saved ? JSON.parse(saved) : null;
    });
    const [alert, setAlert] = useState({ isOpen: false, type: 'info', message: '' });

    useEffect(() => {
        sessionStorage.setItem('fiscalia_view', view);
    }, [view]);

    useEffect(() => {
        if (generatedData) {
            sessionStorage.setItem('fiscalia_data', JSON.stringify(generatedData));
        } else {
            sessionStorage.removeItem('fiscalia_data');
        }
    }, [generatedData]);
    const [hasDownloaded, setHasDownloaded] = useState(false);
    const [showExitModal, setShowExitModal] = useState(false);
    const [exitCountDown, setExitCountDown] = useState(5);

    const { getCost } = useCreditCosts();

    const options = [
        {
            id: 'fiscalia_dni',
            title: 'Casos fiscales de un DNI',
            icon: 'badge',
            color: 'bg-blue-800',
            desc: 'Historial de casos fiscales vinculados a un DNI',
            credits: getCost('fiscalia_dni', 2),
            placeholder: 'Ej: 72345678',
            helpDesc: 'Reporte completo de casos fiscales vinculados a un Documento Nacional de Identidad.',
            helpDetails: [
                'Historial de casos',
                'Estado de los casos',
                'Documentos relacionados'
            ]
        },
        {
            id: 'fiscalia_nombre',
            title: 'Casos fiscales por nombre',
            icon: 'person_search',
            color: 'bg-indigo-700',
            desc: 'Historial de casos fiscales buscando por nombre',
            credits: getCost('fiscalia_nombre', 2),
            placeholder: 'Ej: JUAN PEREZ',
            helpDesc: 'Reporte completo de casos fiscales vinculados a un nombre y apellidos.',
            helpDetails: [
                'Búsqueda por nombres',
                'Coincidencias encontradas',
                'Detalle de los casos'
            ]
        },
        {
            id: 'fiscalia_ruc',
            title: 'Casos fiscales de un RUC',
            icon: 'domain',
            color: 'bg-emerald-800',
            desc: 'Historial de casos fiscales vinculados a un RUC',
            credits: getCost('fiscalia_ruc', 2),
            placeholder: 'Ej: 10723456781',
            helpDesc: 'Reporte completo de casos fiscales vinculados a un Registro Único de Contribuyente.',
            helpDetails: [
                'Historial de casos de empresa',
                'Estado de los casos',
                'Documentos relacionados'
            ]
        },
        {
            id: 'caso_fiscal',
            title: 'Información de Caso fiscal',
            icon: 'gavel',
            color: 'bg-amber-800',
            desc: 'Consulta directa de un caso fiscal específico',
            credits: getCost('caso_fiscal', 2),
            placeholder: 'Ej: 123456789',
            helpDesc: 'Búsqueda de detalles de un caso fiscal utilizando su número de expediente.',
            helpDetails: [
                'Detalle exhaustivo',
                'Fechas y resoluciones',
                'Partes involucradas'
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

        const isDniValid = selectedOption.id === 'fiscalia_dni' && finalTargetId.length === 8;
        const isRucValid = selectedOption.id === 'fiscalia_ruc' && finalTargetId.length === 11;
        
        if (selectedOption.id === 'fiscalia_dni' && !isDniValid) {
            setAlert({ isOpen: true, type: 'error', message: 'El DNI debe tener 8 dígitos' });
            return;
        }
        if (selectedOption.id === 'fiscalia_ruc' && !isRucValid) {
            setAlert({ isOpen: true, type: 'error', message: 'El RUC debe tener 11 dígitos' });
            return;
        }


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
            const res = await fetch('/api/fiscalia/search', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ target: finalTargetId, type: selectedOption.id })
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.detail || 'Error al generar la búsqueda');
            }

            setGeneratedData({
                ...data.data,
                archivos: data.data.archivo ? [data.data.archivo] : (data.data.archivos || []),
                parsedDenuncias: parseFiscalia(data.data.raw_text),
                queryTarget: finalTargetId,
                queryType: selectedOption.id
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

    const downloadPdf = async (filePath, index) => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(getApiUrl(`/api/static/${filePath}`), {
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
            a.download = `DENUNCIA_${index + 1}_${generatedData.queryTarget}.pdf`;
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
        if (!hasDownloaded && generatedData?.archivos?.length > 0) {
            setShowExitModal(true);
        } else {
            setView('selection');
            setGeneratedData(null);
            sessionStorage.removeItem('fiscalia_view');
            sessionStorage.removeItem('fiscalia_data');
        }
    };

    const confirmExit = () => {
        if (exitCountDown > 0) return;
        setShowExitModal(false);
        setView('selection');
        setGeneratedData(null);
        sessionStorage.removeItem('fiscalia_view');
        sessionStorage.removeItem('fiscalia_data');
    };

    return (
        <div className="w-full max-w-5xl mx-auto p-4 flex flex-col items-center -[]">
            {view === 'selection' && (
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

                                <div className="relative">
                                    <div className={`w-12 h-12 rounded-xl ${opt.color} flex items-center justify-center text-white shadow-lg shrink-0 group-hover:scale-110 transition-transform`}>
                                        <span className="material-icons-round text-2xl">{opt.icon}</span>
                                    </div>
                                    {opt.isNew && (
                                        <div className="absolute -top-2 -right-3 z-20">
                                            <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-yellow-300 text-yellow-900 font-black shadow-sm border border-yellow-400 animate-pulse">
                                                NUEVO
                                            </span>
                                        </div>
                                    )}
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
                        className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-3xl shadow-xl overflow-hidden border border-slate-200 dark:border-slate-800"
                    >
                        {(true) ? (
                            <div className="p-8 flex flex-col items-center relative">
                                {/* Back button (Arrow) */}
                                <button
                                    onClick={handleBackClick}
                                    className="absolute top-6 left-6 w-10 h-10 flex items-center justify-center shrink-0 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all hover:scale-110 active:scale-95 shadow-md shadow-black/10 dark:shadow-black/30"
                                    title="Volver"
                                >
                                    <span className="material-icons-round">arrow_back</span>
                                </button>

                                {/* Success Icon */}
                                <div className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center text-white mb-4 shadow-lg shadow-emerald-500/30">
                                    <span className="material-icons-round text-4xl">check</span>
                                </div>

                                <h3 className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mb-6 tracking-wide text-center">
                                    ANTECEDENTES GENERADOS CON ÉXITO
                                </h3>

                                {/* Display Data Table */}
                                <div className="w-full bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 mb-6 border border-slate-100 dark:border-slate-700">
                                    <div className="grid grid-cols-1 gap-2">
                                        {generatedData.parsedDenuncias && generatedData.parsedDenuncias[0] && generatedData.parsedDenuncias[0].map((item, idx) => (
                                            <div key={idx} className="flex items-start text-sm">
                                                <span className="font-bold text-slate-500 dark:text-slate-400 w-24 shrink-0">{item.label}</span>
                                                <span className="text-slate-400 mx-2">:</span>
                                                <span className="font-bold text-slate-800 dark:text-white truncate">{item.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Document Preview */}
                                {generatedData.archivos && generatedData.archivos.length > 0 && (
                                    <PdfViewer
                                        url={getApiUrl(`/api/static/${generatedData.archivos[0]}`)}
                                        height="420px"
                                        className="mb-8 w-full"
                                    />
                                )}

                                {/* Buttons */}
                                <div className="flex flex-col w-full gap-3">
                                    {generatedData.archivos && generatedData.archivos.length > 0 && (
                                        <button
                                            onClick={() => downloadPdf(generatedData.archivos[0], 0)}
                                            className="w-full py-4 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 text-lg hover:scale-[1.02]"
                                        >
                                            <span className="material-icons-round">download</span>
                                            Descargar Antecedentes
                                        </button>
                                    )}
                                    <button
                                        onClick={handleBackClick}
                                        className="w-full py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm"
                                    >
                                        Volver
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
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

                                {/* List of PDFs */}
                                <div className="mb-8">
                                    <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-4 uppercase tracking-widest">
                                        Archivos de Denuncias Generados
                                    </h3>
                                    {generatedData.archivos && generatedData.archivos.length > 0 ? (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                            {generatedData.archivos.map((filePath, idx) => (
                                                <div key={idx} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm flex flex-col">
                                                    <div className="flex items-center gap-3 mb-3">
                                                        <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                                                            <span className="material-icons-round text-red-600 dark:text-red-400">picture_as_pdf</span>
                                                        </div>
                                                        <div className="flex-1 truncate">
                                                            <span className="text-sm font-bold text-slate-800 dark:text-white block truncate">
                                                                DENUNCIA_{idx + 1}-{generatedData.queryTarget}.pdf
                                                            </span>
                                                        </div>
                                                    </div>
                                                    {/* Preview PDF */}
                                                    <PdfViewer
                                                        url={getApiUrl(`/api/static/${filePath}`)}
                                                        height="300px"
                                                        className="mb-3"
                                                    />
                                                    
                                                    {/* Texto parseado */}
                                                    {generatedData.parsedDenuncias && generatedData.parsedDenuncias[idx] && (
                                                        <div className="mb-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-100 dark:border-slate-700 flex-1 overflow-y-auto">
                                                            <div className="flex flex-col gap-2.5">
                                                                {generatedData.parsedDenuncias[idx].map((item, i) => (
                                                                    <div key={i} className="flex items-start gap-2">
                                                                        <span className="material-icons-round text-blue-500 dark:text-blue-400 text-[18px] mt-0.5 shrink-0">{item.icon}</span>
                                                                        <div className="flex flex-col w-full min-w-0">
                                                                            <span className="font-bold text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-wider leading-tight">{item.label}</span>
                                                                            <span className="font-semibold text-sm text-slate-800 dark:text-white break-words leading-snug">{item.value}</span>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    <button
                                                        onClick={() => downloadPdf(filePath, idx)}
                                                        className="mt-auto w-full py-3 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-900 font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-sm shadow-md"
                                                    >
                                                        <span className="material-icons-round text-base">download</span>
                                                        Descargar PDF
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 text-center">
                                            <span className="material-icons-round text-slate-400 text-3xl mb-2">description</span>
                                            <p className="text-slate-600 dark:text-slate-400 font-medium text-sm">
                                                Esta consulta no contiene archivos adjuntos.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
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
                                            Ingrese el dato a consultar
                                        </p>
                                    </div>
                                </div>

                                <input 
                                    inputMode={['fiscalia_dni', 'fiscalia_ruc'].includes(selectedOption.id) ? 'numeric' : 'text'}
                                    maxLength={selectedOption.id === 'fiscalia_dni' ? 8 : (selectedOption.id === 'fiscalia_ruc' ? 11 : 50)} 
                                    placeholder={selectedOption.placeholder} 
                                    className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border-none ring-1 ring-slate-200 dark:ring-slate-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all font-mono text-lg text-center mb-6 text-slate-900 dark:text-white"
                                    type="text" 
                                    value={targetId}
                                    onChange={(e) => {
                                        const val = e.target.value.toUpperCase();
                                        setTargetId(val);
                                        const isDniValid = selectedOption.id === 'fiscalia_dni' && val.length === 8;
                                        const isRucValid = selectedOption.id === 'fiscalia_ruc' && val.length === 11;
                                        if (isDniValid || isRucValid) {
                                            handleGenerate(val);
                                        }
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            const isValid = 
                                                (selectedOption.id === 'fiscalia_dni' && targetId.length === 8) || 
                                                (selectedOption.id === 'fiscalia_ruc' && targetId.length === 11) || 
                                                (!['fiscalia_dni', 'fiscalia_ruc'].includes(selectedOption.id) && targetId.length > 0);
                                            if (isValid) handleGenerate();
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
                                        disabled={!targetId || (selectedOption.id === 'fiscalia_dni' && targetId.length !== 8) || (selectedOption.id === 'fiscalia_ruc' && targetId.length !== 11)} 
                                        className={`flex-1 py-2.5 rounded-xl font-bold text-white transition-all shadow-lg flex items-center justify-center gap-2 ${
                                            !targetId || (selectedOption.id === 'fiscalia_dni' && targetId.length !== 8) || (selectedOption.id === 'fiscalia_ruc' && targetId.length !== 11)
                                            ? 'bg-slate-300 dark:bg-slate-700 cursor-not-allowed'
                                            : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/30'
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
