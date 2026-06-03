import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useLoading } from '../context/LoadingContext';
import { getApiUrl } from '../utils/api';
import { useCreditCosts } from '../hooks/useCredits';
import PdfViewer from '../components/PdfViewer';
import UploadGuidelinesModal from '../components/UploadGuidelinesModal';
import { toast } from 'sonner';
import { createPortal } from 'react-dom';

export default function Facial() {
    const { user, token, refreshUser, openLoginModal } = useAuth();
    const { showLoading, hideLoading } = useLoading();
    const { getCost, loading: costsLoading } = useCreditCosts();
    const cost = getCost('busqueda_facial', 3);
    
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [resultData, setResultData] = useState(null);
    const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
    
    // Exit Logic States
    const [hasDownloaded, setHasDownloaded] = useState(false);
    const [showExitModal, setShowExitModal] = useState(false);
    const [exitCountDown, setExitCountDown] = useState(0);

    // Guidelines Modal States
    const [showGuidelines, setShowGuidelines] = useState(false);
    const [hasSeenGuidelines, setHasSeenGuidelines] = useState(false);

    useEffect(() => {
        let timer;
        if (showExitModal && exitCountDown > 0) {
            timer = setInterval(() => {
                setExitCountDown(prev => prev - 1);
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [showExitModal, exitCountDown]);

    useEffect(() => {
        if (resultData && resultData.file_path) {
            const fetchPdf = async () => {
                try {
                    const res = await fetch(getApiUrl(`/${resultData.file_path}`));
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    setPdfBlobUrl(url);
                } catch (err) {
                    console.error('Error fetching PDF blob:', err);
                }
            };
            fetchPdf();
        }
    }, [resultData]);

    useEffect(() => {
        return () => {
            if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
        };
    }, [pdfBlobUrl]);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const extension = file.name.split('.').pop().toLowerCase();
        const validExtensions = ['jpg', 'jpeg', 'png'];

        if ((file.type !== 'image/jpeg' && file.type !== 'image/png') || !validExtensions.includes(extension)) {
            toast.error("Por favor selecciona un archivo de imagen válido (solo JPG o PNG).");
            return;
        }

        setSelectedFile(file);
        const reader = new FileReader();
        reader.onloadend = () => {
            setPreviewUrl(reader.result);
        };
        reader.readAsDataURL(file);
        setResultData(null);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const file = e.dataTransfer.files[0];
            const extension = file.name.split('.').pop().toLowerCase();
            const validExtensions = ['jpg', 'jpeg', 'png'];

            if ((file.type !== 'image/jpeg' && file.type !== 'image/png') || !validExtensions.includes(extension)) {
                toast.error("Por favor selecciona un archivo de imagen válido (solo JPG o PNG).");
                return;
            }
            setSelectedFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreviewUrl(reader.result);
            };
            reader.readAsDataURL(file);
            setResultData(null);
        }
    };

    const clearFile = () => {
        setSelectedFile(null);
        setPreviewUrl(null);
        setResultData(null);
        setPdfBlobUrl(null);
        setHasDownloaded(false);
    };

    const handleBackClick = () => {
        if (resultData && pdfBlobUrl && !hasDownloaded) {
            setExitCountDown(5);
            setShowExitModal(true);
        } else {
            clearFile();
        }
    };

    const confirmExit = () => {
        setShowExitModal(false);
        clearFile();
    };

    const downloadPdf = () => {
        setHasDownloaded(true);
        const a = document.createElement('a');
        a.href = pdfBlobUrl;
        a.download = resultData.file_path.split('/').pop() || 'resultado_facial.pdf';
        document.body.appendChild(a); 
        a.click(); 
        document.body.removeChild(a);
    };

    const handleSearch = async () => {
        if (!user) {
            openLoginModal();
            return;
        }
        if (!selectedFile) {
            toast.error("Sube una foto para buscar.");
            return;
        }

        try {
            showLoading();

            const formData = new FormData();
            formData.append('image', selectedFile);

            const res = await fetch(getApiUrl('/api/facial/search'), {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            const data = await res.json();
            if (!res.ok) {
                if (res.status === 402) {
                    throw new Error("Créditos insuficientes. Recarga en la tienda.");
                }
                throw new Error(data.detail || "Error al buscar el rostro");
            }

            setResultData(data.data);
            refreshUser(); // Actualizar créditos
            toast.success("Búsqueda completada con éxito.");

        } catch (error) {
            console.error(error);
            toast.error(error.message);
        } finally {
            hideLoading();
        }
    };

    const parseResults = (rawText) => {
        if (!rawText) return [];
        const lines = rawText.split('\n');
        const matches = [];
        let currentMatch = null;

        lines.forEach(line => {
            const trimmed = line.trim();
            // Match example: • 1 ➣ 22482972 「38.2%」
            const titleMatch = trimmed.match(/•\s*\d+\s*[➣➤>]\s*(\d+)\s*「([\d.]+%?)」/);
            if (titleMatch) {
                if (currentMatch) matches.push(currentMatch);
                currentMatch = {
                    dni: titleMatch[1],
                    percentage: titleMatch[2],
                    nombres: '',
                    apellidos: '',
                    edad: ''
                };
            } else if (currentMatch) {
                if (trimmed.includes('NOMBRES')) {
                    currentMatch.nombres = trimmed.split(/[➣➤>]/)[1]?.trim() || '';
                } else if (trimmed.includes('APELLIDOS')) {
                    currentMatch.apellidos = trimmed.split(/[➣➤>]/)[1]?.trim() || '';
                } else if (trimmed.includes('EDAD')) {
                    currentMatch.edad = trimmed.split(/[➣➤>]/)[1]?.trim() || '';
                }
            }
        });
        if (currentMatch) matches.push(currentMatch);
        return matches;
    };

    const parsedMatches = parseResults(resultData?.raw_text);

    return (
        <div className="w-full max-w-4xl mx-auto flex flex-col items-center">
            
            {/* Header / Title */}
            <div className="text-center mb-8 relative">
                <div className="inline-block relative">
                    <div className="absolute -inset-1 bg-gradient-to-r from-yellow-400 to-amber-600 rounded-full blur opacity-30 animate-pulse"></div>
                    <div className="relative bg-white dark:bg-slate-900 border border-yellow-200 dark:border-yellow-700/30 px-6 py-2 rounded-full flex items-center justify-center gap-3">
                        <span className="material-icons-round text-yellow-500 text-xl animate-bounce">face</span>
                        <span className="font-black text-sm uppercase tracking-widest bg-gradient-to-r from-yellow-600 to-amber-600 dark:from-yellow-400 dark:to-amber-500 bg-clip-text text-transparent">Búsqueda Facial RENIEC</span>
                    </div>
                </div>
                <h1 className="mt-6 text-3xl sm:text-4xl font-black text-slate-800 dark:text-white tracking-tight">
                    Búsqueda en Base de Datos Nacional
                </h1>
                <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm font-semibold flex items-center justify-center gap-1.5">
                    <span className="material-icons-round text-yellow-500 text-base">toll</span>
                    Costo por consulta:&nbsp;
                    {costsLoading
                        ? <span className="w-12 h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse inline-block" />
                        : <span className="font-black text-slate-700 dark:text-slate-200">{cost} crédito{cost !== 1 ? 's' : ''}</span>
                    }
                </p>
            </div>

            {/* Main Interface */}
            <div className="w-full bg-white dark:bg-slate-900 rounded-[2rem] shadow-xl border border-slate-200/60 dark:border-slate-800/60 overflow-hidden relative p-6 sm:p-8">
                
                {/* Upload Zone */}
                {!resultData && (
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex flex-col items-center"
                    >
                        {!previewUrl ? (
                            <div 
                                className="w-full max-w-md border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-3xl p-10 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-yellow-500 dark:hover:border-yellow-500 transition-all group"
                                onDragOver={handleDragOver}
                                onDrop={handleDrop}
                                onClick={() => {
                                    if (!hasSeenGuidelines) {
                                        setShowGuidelines(true);
                                    } else {
                                        document.getElementById('file-upload').click();
                                    }
                                }}
                            >
                                <input 
                                    id="file-upload" 
                                    type="file" 
                                    accept="image/jpeg, image/png" 
                                    className="hidden" 
                                    onChange={handleFileChange}
                                    onClick={(e) => e.stopPropagation()}
                                />
                                <div className="w-16 h-16 rounded-2xl bg-yellow-100 dark:bg-yellow-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                    <span className="material-icons-round text-3xl text-yellow-600 dark:text-yellow-500">add_photo_alternate</span>
                                </div>
                                <h3 className="font-bold text-slate-700 dark:text-slate-200 text-lg mb-1">Subir fotografía</h3>
                                <p className="text-slate-500 dark:text-slate-400 text-sm text-center">
                                    Arrastra una imagen o haz clic para explorar. Formatos soportados: JPG, PNG.
                                </p>
                            </div>
                        ) : (
                            <div className="w-full max-w-md flex flex-col items-center">
                                <div className="relative w-48 h-48 sm:w-64 sm:h-64 rounded-3xl overflow-hidden shadow-lg border border-slate-200 dark:border-slate-700 mb-6">
                                    <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                                    <button 
                                        onClick={clearFile}
                                        className="absolute top-2 right-2 w-8 h-8 bg-black/50 hover:bg-red-500 text-white rounded-full flex items-center justify-center backdrop-blur-sm transition-colors"
                                    >
                                        <span className="material-icons-round text-sm">close</span>
                                    </button>
                                </div>
                                
                                <button
                                    onClick={handleSearch}
                                    className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700 text-white font-black text-sm uppercase tracking-widest rounded-2xl shadow-lg shadow-yellow-500/30 transition-all flex items-center justify-center gap-2"
                                >
                                    <span className="material-icons-round">manage_search</span>
                                    INICIAR BÚSQUEDA{costsLoading ? '' : ` (${cost} crédito${cost !== 1 ? 's' : ''})`}
                                </button>
                            </div>
                        )}
                    </motion.div>
                )}

                {/* Results Section */}
                <AnimatePresence>
                    {resultData && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="w-full flex flex-col items-center"
                        >
                            <div className="w-full flex items-center justify-between mb-6 pb-6 border-b border-slate-100 dark:border-slate-800">
                                <div className="flex items-center gap-3">
                                    <button 
                                        onClick={handleBackClick}
                                        className="bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-95 text-slate-700 dark:text-white font-semibold h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 transition-all duration-150 flex items-center justify-center gap-2 text-sm shadow-sm min-w-[44px]"
                                    >
                                        <span className="material-icons-round text-slate-400 text-[18px]">arrow_back</span>
                                        <span>Regresar</span>
                                    </button>
                                    <h2 className="hidden sm:flex text-xl font-black text-slate-800 dark:text-white items-center gap-2">
                                        <span className="material-icons-round text-green-500">check_circle</span>
                                        Resultados de Búsqueda
                                    </h2>
                                </div>
                            </div>

                            <div className="w-full flex flex-col gap-8 max-w-3xl mx-auto">
                                {/* Target Image */}
                                <div className="flex flex-col items-center">
                                    <div className="w-48 h-48 sm:w-56 sm:h-56 rounded-3xl overflow-hidden shadow-lg border border-yellow-500/30 mb-4">
                                        <img src={previewUrl} alt="Target" className="w-full h-full object-cover" />
                                    </div>
                                    <div className="bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-700/50 px-4 py-2 rounded-xl text-yellow-800 dark:text-yellow-400 text-xs font-bold flex items-center gap-2">
                                        <span className="material-icons-round text-sm">person_search</span>
                                        IMAGEN ANALIZADA
                                    </div>
                                </div>

                                {/* PDF Preview — funciona en desktop y móvil */}
                                {pdfBlobUrl && (
                                    <div className="w-full flex flex-col items-center">
                                        <h3 className="text-xs font-bold text-slate-500 mb-3 uppercase tracking-wider">Vista Previa del Informe</h3>
                                        <PdfViewer
                                            url={pdfBlobUrl}
                                            height="500px"
                                            className="w-full"
                                        />
                                    </div>
                                )}

                                {/* Matches */}
                                <div className="flex flex-col gap-4 w-full">
                                    {parsedMatches.length > 0 ? (
                                        parsedMatches.map((match, idx) => (
                                            <div key={idx} className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 flex items-center justify-between">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-bold text-slate-400 mb-1">COINCIDENCIA #{idx + 1}</span>
                                                    <span className="font-black text-lg text-slate-800 dark:text-white">{match.nombres} {match.apellidos}</span>
                                                    <div className="flex items-center gap-3 mt-1">
                                                        <span className="text-sm font-medium text-slate-600 dark:text-slate-300">DNI: <span className="font-bold">{match.dni}</span></span>
                                                        <span className="text-sm font-medium text-slate-600 dark:text-slate-300">EDAD: <span className="font-bold">{match.edad}</span></span>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-center justify-center shrink-0 ml-4">
                                                    <div className="w-12 h-12 rounded-full border-4 border-green-500 flex items-center justify-center text-xs font-black text-green-600 dark:text-green-400 bg-white dark:bg-slate-900 shadow-sm">
                                                        {match.percentage}
                                                    </div>
                                                    <span className="text-[10px] font-bold text-slate-400 mt-1 uppercase">Similitud</span>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 flex flex-col items-center justify-center text-center h-full">
                                            <span className="material-icons-round text-4xl text-slate-300 dark:text-slate-600 mb-2">person_off</span>
                                            <span className="font-bold text-slate-500 dark:text-slate-400">No se encontraron coincidencias claras en la base de datos.</span>
                                        </div>
                                    )}
                                </div>

                                {/* Action Buttons */}
                                <div className="flex justify-center mt-2 w-full">
                                    {pdfBlobUrl && (
                                        <button
                                            onClick={downloadPdf}
                                            className="w-full sm:w-2/3 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black text-sm uppercase tracking-widest rounded-xl hover:bg-slate-800 dark:hover:bg-slate-100 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-slate-900/20"
                                        >
                                            <span className="material-icons-round text-red-500">picture_as_pdf</span>
                                            DESCARGAR INFORME PDF
                                        </button>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Exit Warning Modal */}
            {createPortal(
                <AnimatePresence>
                    {showExitModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                            <motion.div 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                                onClick={() => exitCountDown === 0 && setShowExitModal(false)}
                            />
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
                                    No has descargado el resultado todavía. Si sales, perderás los datos y <strong>no se reembolsarán los créditos</strong>.
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

            {/* Upload Guidelines Modal */}
            {createPortal(
                <UploadGuidelinesModal 
                    isOpen={showGuidelines} 
                    onComplete={() => {
                        setShowGuidelines(false);
                        setHasSeenGuidelines(true);
                        // Using setTimeout to ensure modal unmounts completely before file dialog opens
                        setTimeout(() => {
                            document.getElementById('file-upload')?.click();
                        }, 50);
                    }} 
                />,
                document.body
            )}
        </div>
    );
}
