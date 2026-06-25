import { useSettings } from '../context/settingsContextValue';
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
import { OptionCard } from './ui/ConsultSurface';

function parseDenuncias(rawText) {
    if (!rawText) return [];

    const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
    const denuncias = [];
    let currentDenuncia = null;

    for (const line of lines) {
        // Remove emojis and formatting
        let cleanLine = line.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '');
        cleanLine = cleanLine.replace(/[*_`]/g, '').trim();

        if (cleanLine.includes('INFOR DATA') || cleanLine.includes('DENUNCIA POLICIAL')) continue;
        if (cleanLine.includes('CUENTA:') || cleanLine.includes('USUARIO:')) continue;
        if (cleanLine.includes('CRÉDITOS :') || cleanLine.includes('Usuario :') || cleanLine.includes('La consulta se hizo')) continue;
        if (cleanLine.startsWith('➤ #') || cleanLine.startsWith('#')) continue;

        if (/^\d+\.\s*(TIPO|PLACA)/.test(cleanLine) || cleanLine.match(/DENUNCIA #?\d+/) || cleanLine.includes('ANTECEDENTES PERSONALES -') || cleanLine.includes('SIDPLA SIDPOL')) {
            if (currentDenuncia) denuncias.push(currentDenuncia);
            currentDenuncia = [];

            // Extract number if possible from the header itself
            if (cleanLine.match(/DENUNCIA #?\d+\s*[-—]\s*(.+)/)) {
                const m = cleanLine.match(/DENUNCIA #?\d+\s*[-—]\s*(N°)?\s*(.+)/);
                if (m && m[2]) {
                    let val = m[2].trim();
                    if (val.match(/^\d+$/)) { // If it's just numbers, it's probably the DNI/Placa/Denuncia No.
                        currentDenuncia.push({ label: 'REF', value: val, icon: 'tag' });
                    }
                }
            }
        } else if (!currentDenuncia && cleanLine.includes('ANTECEDENTES - ONLINE')) {
            currentDenuncia = [];
        } else if (!currentDenuncia && (cleanLine.includes('➔') || cleanLine.includes(':'))) {
            currentDenuncia = [];
        }

        if (currentDenuncia) {
            let parts = cleanLine.split('➔');
            let usedColon = false;
            if (parts.length < 2) {
                parts = cleanLine.split(':');
                usedColon = true;
            }

            if (parts.length >= 2) {
                let label = parts[0].replace(/^[➔▶\d.\s]+/, '').trim();
                let value = parts.slice(1).join(usedColon ? ':' : '➔').trim();
                if (value.startsWith('—')) value = value.substring(1).trim();
                if (value.startsWith('-')) value = value.substring(1).trim();

                let icon = 'info';
                const labelUpper = label.toUpperCase();
                if (labelUpper.includes('TIPO')) icon = 'category';
                else if (labelUpper.includes('DNI') || labelUpper.includes('NOMBRE') || labelUpper.includes('PADRE') || labelUpper.includes('MADRE')) icon = 'badge';
                else if (labelUpper.includes('PLACA')) icon = 'directions_car';
                else if (labelUpper.includes('LUGAR')) icon = 'location_on';
                else if (labelUpper.includes('COMISARÍA') || labelUpper.includes('COMISARIA')) icon = 'local_police';
                else if (labelUpper.includes('HECHO') || labelUpper.includes('FECHA') || labelUpper.includes('NACIMIENTO')) icon = 'event';
                else if (labelUpper.includes('CLAVE')) icon = 'key';

                currentDenuncia.push({ label, value, icon });
            } else if (!cleanLine.match(/DENUNCIA #?\d+/) && cleanLine.length > 5 && !cleanLine.includes('➤ CONSULTADO POR')) {
                // Standalone value line like "INTERVENCION POLICIALES"
                if (currentDenuncia.length > 0 && currentDenuncia[0].label === 'REF') {
                    // Probably the description
                    currentDenuncia.push({ label: 'TIPO', value: cleanLine, icon: 'category' });
                }
            }
        }
    }
    if (currentDenuncia) denuncias.push(currentDenuncia);

    return denuncias;
}

export default function Delitos() {
    const { isFeatureEnabled } = useSettings();
    const { user, openLoginModal } = useAuth();
    const { loading, showLoading, hideLoading } = useLoading();
    const [view, setView] = useState(() => sessionStorage.getItem('delitos_view') || 'selection'); // 'selection' | 'result'
    const [selectedOption, setSelectedOption] = useState(null);
    const [showInputModal, setShowInputModal] = useState(false);
    const [targetId, setTargetId] = useState('');
    const [helpModal, setHelpModal] = useState({ isOpen: false, title: '', description: '', details: [] });
    const [generatedData, setGeneratedData] = useState(() => {
        const saved = sessionStorage.getItem('delitos_data');
        return saved ? JSON.parse(saved) : null;
    });
    const [alert, setAlert] = useState({ isOpen: false, type: 'info', message: '' });

    useEffect(() => {
        sessionStorage.setItem('delitos_view', view);
    }, [view]);

    useEffect(() => {
        if (generatedData) {
            sessionStorage.setItem('delitos_data', JSON.stringify(generatedData));
        } else {
            sessionStorage.removeItem('delitos_data');
        }
    }, [generatedData]);
    const [hasDownloaded, setHasDownloaded] = useState(false);
    const [showExitModal, setShowExitModal] = useState(false);
    const [exitCountDown, setExitCountDown] = useState(5);

    const { getCost } = useCreditCosts();

    const options = [
        {
            id: 'antper',
            title: 'Antecedentes Global',
            icon: 'gavel',
            color: 'bg-indigo-800',
            desc: 'Antecedentes totales de una persona',
            credits: getCost('antper', 1),
            placeholder: 'Ej: 10001088',
            helpDesc: 'Reporte completo de antecedentes de una persona a nivel nacional.',
            helpDetails: [
                'Historial de antecedentes',
                'Documento en formato PDF',
                'Detalle de tipo de registro'
            ]
        },
        {
            id: 'dni',
            title: 'Denuncias por DNI',
            icon: 'badge',
            color: 'bg-red-800',
            desc: 'Historial de denuncias registradas por DNI',
            credits: getCost('dni', 2),
            placeholder: 'Ej: 72345678',
            helpDesc: 'Reporte completo que detalla si la persona cuenta con denuncias en las comisarías del país.',
            helpDetails: [
                'Fecha y hora de los hechos',
                'Comisaría donde se registró',
                'Múltiples actas policiales (si existen)'
            ]
        },
        {
            id: 'placa',
            title: 'Denuncias por Placa',
            icon: 'directions_car',
            color: 'bg-orange-800',
            desc: 'Denuncias y reportes asociados al vehículo',
            credits: getCost('placa', 2),
            placeholder: 'Ej: ABC123',
            helpDesc: 'Reporte que detalla denuncias vehiculares como robo, choques u otros incidentes vinculados a una placa.',
            helpDetails: [
                'Historial de reportes del vehículo',
                'Fechas y jurisdicciones',
                'Formato de denuncias completas'
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
            const res = await fetch('/api/delitos/search', {
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
                parsedDenuncias: parseDenuncias(data.data.raw_text),
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
    }, [user, openLoginModal, targetId, selectedOption, loading, showLoading, hideLoading]);

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
            sessionStorage.removeItem('delitos_view');
            sessionStorage.removeItem('delitos_data');
        }
    };

    const confirmExit = () => {
        if (exitCountDown > 0) return;
        setShowExitModal(false);
        setView('selection');
        setGeneratedData(null);
        sessionStorage.removeItem('delitos_view');
        sessionStorage.removeItem('delitos_data');
    };

    return (
        <div className="w-full max-w-5xl mx-auto p-4 flex flex-col items-center max-h-[85dvh]">
            {view === 'selection' && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl"
                >
                    {options.filter(opt => isFeatureEnabled('option_' + opt.id)).map((opt) => (
                        <OptionCard
                            key={opt.id}
                            option={opt}
                            onSelect={handleOptionClick}
                            onHelp={openHelp}
                            creditsLabel={`${opt.credits} Creditos`}
                            badge={opt.isNew ? 'Nuevo' : undefined}
                        />
                    ))}
                </motion.div>
            )}

            {view === 'result' && generatedData && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={selectedOption?.id === 'antper' ? "w-full max-w-3xl bg-white dark:bg-slate-900 rounded-3xl shadow-xl overflow-hidden border border-slate-200 dark:border-slate-800" : "w-full max-w-5xl"}
                >
                    {selectedOption?.id === 'antper' ? (
                        <div className="p-8 flex flex-col items-center relative">
                            {/* Back button (Arrow) */}
                            <button
                                onClick={handleBackClick}
                                className="absolute top-6 left-6 flex min-h-[44px] min-w-[44px] items-center justify-center shrink-0 rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:hover:text-white"
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
                                        className="w-full py-4 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 text-lg"
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
                                    className="min-h-[44px] rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700 flex items-center justify-center gap-2"
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
                        <div className="fixed inset-0 z-[100] flex items-center justify-center px-[max(1rem,var(--safe-left))] pr-[max(1rem,var(--safe-right))] py-[max(1rem,var(--safe-top))] pb-[max(1rem,var(--safe-bottom))] bg-black/50 backdrop-blur-sm">
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
                                            Ingrese {selectedOption.id === 'placa' ? 'la Placa' : 'el DNI'} a consultar
                                        </p>
                                    </div>
                                </div>

                                <input
                                    inputMode={selectedOption.id === 'placa' ? 'text' : 'numeric'}
                                    maxLength={selectedOption.id === 'placa' ? 6 : 8}
                                    placeholder={selectedOption.placeholder}
                                    className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border-none ring-1 ring-slate-200 dark:ring-slate-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all font-mono text-lg text-center mb-6 text-slate-900 dark:text-white"
                                    type="text"
                                    value={targetId}
                                    onChange={(e) => {
                                        const val = e.target.value.toUpperCase();
                                        setTargetId(val);
                                        const isDniValid = (selectedOption.id === 'dni' || selectedOption.id === 'antper') && val.length === 8;
                                        const isPlacaValid = selectedOption.id === 'placa' && /^[A-Z0-9]{6}$/i.test(val);
                                        if (isDniValid || isPlacaValid) {
                                            handleGenerate(val);
                                        }
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            const isDniValid = selectedOption.id === 'dni' && targetId.length === 8;
                                            const isPlacaValid = selectedOption.id === 'placa' && /^[A-Z0-9]{6}$/i.test(targetId);
                                            if (isDniValid || isPlacaValid) handleGenerate();
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
                                        disabled={!targetId || (selectedOption.id === 'dni' && targetId.length !== 8) || (selectedOption.id === 'placa' && !/^[A-Z0-9]{6}$/i.test(targetId))}
                                        className={`flex-1 py-2.5 rounded-xl font-bold text-white transition-all shadow-lg flex items-center justify-center gap-2 ${!targetId || (selectedOption.id === 'dni' && targetId.length !== 8) || (selectedOption.id === 'placa' && !/^[A-Z0-9]{6}$/i.test(targetId))
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
                    <div className="fixed inset-0 z-[110] flex items-center justify-center px-[max(1rem,var(--safe-left))] pr-[max(1rem,var(--safe-right))] py-[max(1rem,var(--safe-top))] pb-[max(1rem,var(--safe-bottom))]">
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
