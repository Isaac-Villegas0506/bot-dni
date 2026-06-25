import { useSettings } from '../context/settingsContextValue';
import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import html2canvas from 'html2canvas';
import HelpModal from './HelpModal';
import { useCreditCosts } from '../hooks/useCredits';
import { useAuth } from '../context/AuthContext';
import { useLoading } from '../context/LoadingContext';
import AlertModal from './AlertModal';
import { getApiUrl } from '../utils/api';
import PdfViewer from './PdfViewer';
import { OptionCard } from './ui/ConsultSurface';

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
  const certificateRef = useRef(null);

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
  }, [dni, selectedOption, user, openLoginModal, showLoading, hideLoading]);

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

  const downloadResult = async () => {
    if (generatedData?.file_path) {
      setHasDownloaded(true);
      const filename = generatedData.file_path.split('/').pop();
      await forceDownload(getApiUrl(generatedData.file_path), filename);
    } else if (certificateRef.current) {
      setHasDownloaded(true);
      try {
        const canvas = await html2canvas(certificateRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
        const imgData = canvas.toDataURL('image/jpeg', 1.0);
        const link = document.createElement('a');
        link.download = `${generatedData.type.id}_${generatedData.dni}.jpg`;
        link.href = imgData;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (err) {
        console.error(err);
        setAlert({ isOpen: true, type: 'error', message: 'Error al generar la imagen' });
      }
    }
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

  const parseAntecedentesText = (text) => {
    if (!text) return {};
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    const data = {};
    lines.forEach(line => {
      if (line.includes(':')) {
        const [k, ...v] = line.split(':');
        const key = k.trim().toUpperCase();
        if (!['USUARIO', 'CRÉDITOS', 'USUARIO :'].includes(key) && !key.startsWith('TOTAL')) {
          data[key] = v.join(':').trim();
        }
      }
    });
    return data;
  };

  const parsedData = view === 'result' ? getParsedData() : [];
  const textData = generatedData?.data?.raw_text ? parseAntecedentesText(generatedData.data.raw_text) : {};

  return (
    <div className="w-full max-w-5xl mx-auto p-4 flex flex-col items-center ">

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
            <OptionCard
              key={opt.id}
              option={opt}
              onSelect={handleOptionClick}
              onHelp={openHelp}
              creditsLabel={`${opt.credits} Creditos`}
            />
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
              className="absolute top-6 left-6 flex min-h-[44px] min-w-[44px] items-center justify-center shrink-0 rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:hover:text-white"
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
            {generatedData.file_path ? (
              <PdfViewer
                url={getApiUrl(`/api/static/${generatedData.file_path}`)}
                height="420px"
                className="mb-8"
              />
            ) : generatedData.data?.raw_text && (
              <div className="w-full mb-8 overflow-x-auto custom-scrollbar flex justify-center bg-slate-100 dark:bg-slate-800 p-4 rounded-xl">
                <div ref={certificateRef} className="w-full min-w-[340px] max-w-[500px] bg-white p-6 sm:p-8 border-4 border-double border-slate-300 relative overflow-hidden text-slate-900 shadow-sm" style={{ fontFamily: 'monospace' }}>
                  {/* Background watermark icon */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none">
                     <span className="material-icons-round text-[250px]">{generatedData.type.icon}</span>
                  </div>
                  
                  <div className="text-center mb-6 relative z-10 border-b-2 border-slate-200 pb-4">
                    <h2 className="text-xl sm:text-2xl font-black tracking-widest text-slate-800 uppercase">{generatedData.type.title}</h2>
                    <p className="text-slate-500 font-mono text-sm mt-2 font-bold tracking-widest">DNI: {generatedData.dni}</p>
                  </div>

                  <div className="space-y-3 relative z-10 font-mono text-xs sm:text-sm">
                    {Object.entries(textData).map(([k, v]) => (
                      k !== 'DNI' && (
                        <div key={k} className="flex border-b border-dashed border-slate-200 pb-1">
                          <span className="w-28 sm:w-32 font-bold text-slate-600 truncate mr-2">{k}</span>
                          <span className="flex-1 font-semibold text-slate-800 uppercase break-words">{v}</span>
                        </div>
                      )
                    ))}
                  </div>
                  
                  <div className="mt-8 pt-4 border-t border-slate-200 flex justify-between items-end relative z-10">
                     <div className="text-[10px] sm:text-xs text-slate-400 font-mono">
                       Fecha de emisión:<br/>
                       <span className="font-bold text-slate-600">{generatedData.timestamp}</span>
                     </div>
                     <div className="text-right">
                       <div className="w-24 sm:w-32 h-12 border-b border-slate-400 mb-2 mx-auto"></div>
                       <p className="text-[10px] sm:text-xs text-slate-500 font-bold uppercase">FIRMA AUTORIZADA</p>
                     </div>
                  </div>
                </div>
              </div>
            )}

            {/* Buttons */}
            <div className="flex flex-row w-full gap-3">
              <button
                onClick={downloadResult}
                className="flex-1 py-4 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 text-sm sm:text-lg"
              >
                <span className="material-icons-round">download</span>
                {generatedData.file_path ? 'Descargar Certificado' : 'Descargar Imagen'}
              </button>

              <button
                onClick={handleBackClick}
                className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm"
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
            <div className="fixed inset-0 z-[100] flex items-center justify-center px-[max(1rem,var(--safe-left))] pr-[max(1rem,var(--safe-right))] py-[max(1rem,var(--safe-top))] pb-[max(1rem,var(--safe-bottom))] bg-black/50 backdrop-blur-sm">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white dark:bg-slate-900 p-5 rounded-lg shadow-xl max-w-sm w-full border border-slate-200 dark:border-slate-700"
              >
                <div className="flex items-center gap-3 mb-6">
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
                  className="w-full px-4 py-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all font-mono text-lg text-center mb-6 text-slate-900 dark:text-white"
                  autoFocus
                />

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowInputModal(false)}
                    className="flex-1 min-h-[44px] rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 font-medium transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleGenerate}
                    disabled={!dni || dni.length !== 8}
                    className={`flex-1 min-h-[44px] rounded-lg font-bold text-white transition-colors ${!dni || dni.length !== 8 ? 'bg-slate-300 dark:bg-slate-700 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
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
            <div className="fixed inset-0 z-[150] flex items-center justify-center px-[max(1rem,var(--safe-left))] pr-[max(1rem,var(--safe-right))] py-[max(1rem,var(--safe-top))] pb-[max(1rem,var(--safe-bottom))] bg-black/60 backdrop-blur-md">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white dark:bg-slate-900 p-5 rounded-lg shadow-xl max-w-sm w-full border border-slate-200 dark:border-slate-700"
              >
                <div className="flex items-center gap-3 mb-4">
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">¿Salir sin descargar?</h3>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                  No has descargado el resultado todavía. Si sales, perderás el resultado generado y <strong>no se reembolsarán los créditos</strong>.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowExitModal(false)}
                    className="flex-1 min-h-[44px] rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm"
                  >
                    Quedarse
                  </button>
                  <button
                    onClick={confirmExit}
                    disabled={exitCountDown > 0}
                    className={`flex-1 min-h-[44px] rounded-lg font-bold text-white text-sm transition-colors flex items-center justify-center gap-2 ${exitCountDown > 0 ? 'bg-slate-400 cursor-not-allowed' : 'bg-red-500 hover:bg-red-600'}`}
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
