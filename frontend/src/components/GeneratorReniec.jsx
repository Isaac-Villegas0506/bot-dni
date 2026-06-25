import { useSettings } from '../context/settingsContextValue';
import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import AlertModal from './AlertModal';
import HelpModal from './HelpModal';
import { useCreditCosts } from '../hooks/useCredits';
import { getApiUrl } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useLoading } from '../context/LoadingContext';
import PdfViewer from './PdfViewer';
import { OptionCard } from './ui/ConsultSurface';

const options = [
  {
    id: 'c4_azul',
    title: 'Ficha C4 Azul',
    icon: 'assignment',
    color: 'bg-indigo-600',
    desc: 'Datos completos de Reniec C4',
    helpDesc: 'Permite obtener la ficha C4 oficial emitida por RENIEC con datos actualizados del ciudadano.',
    helpDetails: ['Datos de identidad completos', 'Dirección de domicilio', 'Estado civil y fecha de nacimiento']
  },
  {
    id: 'inscripcion',
    title: 'Ficha de Inscripción',
    icon: 'how_to_reg',
    color: 'bg-emerald-600',
    desc: 'Certificado de Inscripción',
    helpDesc: 'Obtiene el certificado de inscripción oficial registrado en la base de datos nacional.',
    helpDetails: ['Certificado oficial de RENIEC', 'Datos de registro de inscripción', 'Útil para trámites administrativos']
  },
  {
    id: 'virtual_electronico',
    title: 'DNI Electrónico',
    icon: 'contact_page',
    color: 'bg-purple-600',
    desc: 'DNI Virtual Electrónico',
    helpDesc: 'Genera una vista virtual del DNI Electrónico (Anverso y Reverso) basada en los datos de RENIEC.',
    helpDetails: ['Imagen frontal del DNIe', 'Imagen posterior del DNIe', 'Versión electrónica oficial']
  },
  {
    id: 'virtual_azul',
    title: 'DNI Azul',
    icon: 'badge',
    color: 'bg-blue-600',
    desc: 'DNI Azul (Mayores de edad)',
    helpDesc: 'Genera una vista virtual del DNI Azul (Anverso y Reverso) basada en los datos de RENIEC.',
    helpDetails: ['Imagen frontal del DNI', 'Imagen posterior del DNI', 'Solo disponible para mayores de edad']
  },
  {
    id: 'amarillo',
    title: 'DNI Amarillo',
    icon: 'child_care',
    color: 'bg-amber-500',
    desc: 'DNI Amarillo (Menores de edad)',
    helpDesc: 'Genera una vista virtual del DNI Amarillo para menores de edad registrada en el sistema.',
    helpDetails: ['Imagen frontal del DNI Amarillo', 'Imagen posterior del DNI Amarillo', 'Solo disponible para menores de edad']
  },
];

export default function GeneratorReniec() {
  const { isFeatureEnabled } = useSettings();
  const { user, openLoginModal } = useAuth();
  const { loading, showLoading, hideLoading } = useLoading();
  const [view, setView] = useState(() => sessionStorage.getItem('reniec_view') || 'selection'); // 'selection' | 'result'
  const [selectedOption, setSelectedOption] = useState(null);
  const [showInputModal, setShowInputModal] = useState(false);
  const [dni, setDni] = useState('');
  const [generatedData, setGeneratedData] = useState(() => {
    const saved = sessionStorage.getItem('reniec_data');
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    sessionStorage.setItem('reniec_view', view);
  }, [view]);

  useEffect(() => {
    if (generatedData) {
      sessionStorage.setItem('reniec_data', JSON.stringify(generatedData));
    } else {
      sessionStorage.removeItem('reniec_data');
    }
  }, [generatedData]);
  const [alert, setAlert] = useState({ isOpen: false, type: 'info', message: '' });
  const [previewImage, setPreviewImage] = useState(null); // { url: string, label: string }
  const location = useLocation();
  const hasAutoTriggered = useRef(false);
  const autoSearchTriggered = useRef(false);

  // Dynamic credit costs from backend
  const { getCost, canAfford } = useCreditCosts();

  const [helpModal, setHelpModal] = useState({ isOpen: false, title: '', description: '', details: [] });

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
    setDni(''); // Reset DNI
    setShowInputModal(true);
  };

  const [hasDownloaded, setHasDownloaded] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [exitCountDown, setExitCountDown] = useState(5);

  const handleGenerate = useCallback(async () => {
    if (!user) {
      openLoginModal();
      return;
    }
    if (!dni || dni.length !== 8) return;

    // ─ Frontend credit guard (UX) ─
    const optId = selectedOption?.id;
    const cost = getCost(optId);
    const userCredits = user?.credits ?? 0;
    const isPremium = user?.is_premium ?? false;
    if (!canAfford(optId, userCredits, isPremium)) {
      setAlert({
        isOpen: true,
        type: 'warning',
        message: `❌ No tienes suficientes créditos. Esta opción cuesta ${cost} crédito(s) y tienes ${userCredits} disponible(s).`,
      });
      setShowInputModal(false);
      return;
    }

    setShowInputModal(false);

    // Custom loading for Arbol (50s countdown)
    if (selectedOption.id === 'arbol') {
      showLoading("Generando Árbol Genealógico... (Aprox. 50s)");
    } else {
      showLoading();
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setAlert({ isOpen: true, type: 'warning', message: "Debes iniciar sesión para usar esta función Premium" });
        hideLoading();
        return;
      }

      let endpoint = '';
      if (selectedOption.id === 'c4_azul') {
        endpoint = '/api/reniec/c4-blue';
      } else if (selectedOption.id === 'inscripcion') {
        endpoint = '/api/reniec/c4-inscripcion';
      } else if (selectedOption.id === 'virtual_azul') {
        endpoint = '/api/reniec/dni-azul';
      } else if (selectedOption.id === 'virtual_electronico') {
        endpoint = '/api/reniec/dnie';
      } else if (selectedOption.id === 'amarillo') {
        endpoint = '/api/reniec/dni-amarillo';
      } else if (selectedOption.id === 'arbol') {
        endpoint = '/api/reniec/arbol';
      } else {
        setAlert({ isOpen: true, type: 'info', message: "Función en desarrollo." });
        hideLoading();
        return;
      }

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
        let errMsg = "Error al generar documento";
        if (data.detail) {
          if (data.detail?.code === 'INSUFFICIENT_CREDITS') {
            errMsg = `\u274c ${data.detail.message}`;
          } else if (typeof data.detail === 'string') {
            errMsg = data.detail;
          } else if (Array.isArray(data.detail)) {
            errMsg = data.detail.map(e => e.msg || JSON.stringify(e)).join(', ');
          } else {
            errMsg = JSON.stringify(data.detail);
          }
        }
        throw new Error(errMsg);
      }

      // Success - Support both old and new (nested data) response formats
      const resultData = data.data || data;

      setGeneratedData({
        dni: dni,
        type: selectedOption,
        timestamp: new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' }),
        file_path: resultData.file_path || null,
        frontal: resultData.frontal || null,
        reverso: resultData.reverso || null,
        image_paths: resultData.image_paths || [],
        data: resultData
      });
      setView('result');
      setHasDownloaded(false);

    } catch (err) {
      console.error(err);
      setAlert({ isOpen: true, type: 'error', message: err.message });
    } finally {
      hideLoading();
    }
  }, [dni, selectedOption, user, getCost, canAfford, showLoading, hideLoading, openLoginModal]);

  // Auto-trigger from state (e.g. from Premium Result Card).
  // 'options' is module-level (not a valid dep). hasAutoTriggered ref guards loops.
  useEffect(() => {
    if (location.state?.autoDni && location.state?.autoOption && !hasAutoTriggered.current) {
      const opt = options.find(o => o.id === location.state.autoOption);
      if (opt) {
        hasAutoTriggered.current = true;
        setSelectedOption(opt);
        setDni(location.state.autoDni);
      }
    }
  }, [location.state]);

  // Separate effect to trigger generate once option and dni are set.
  // Declared AFTER handleGenerate to avoid TDZ on the dep array.
  useEffect(() => {
    if (hasAutoTriggered.current && selectedOption && dni && dni.length === 8 && view === 'selection') {
      handleGenerate();
      hasAutoTriggered.current = false;
    }
  }, [selectedOption, dni, view, handleGenerate]);

  // Effect for exit countdown
  useEffect(() => {
    let timer;
    if (showExitModal && exitCountDown > 0) {
      timer = setTimeout(() => setExitCountDown(prev => prev - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [showExitModal, exitCountDown]);

  // Auto-search when DNI reaches 8 digits in the input modal.
  // autoSearchTriggered ref guards re-fires when handleGenerate identity changes.
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
    if (!hasDownloaded) {
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
    sessionStorage.removeItem('reniec_view');
    sessionStorage.removeItem('reniec_data');
    setSelectedOption(null);
    setDni('');
    setHasDownloaded(false);
  };

  // Force-download any file (PDF or image) without opening it in the browser
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
      // Delay revoke so the browser finishes reading the blob before it's freed
      setTimeout(() => URL.revokeObjectURL(blobUrl), 200);
    } catch (e) {
      console.error('Download failed:', e);
    }
  };

  // Download PDF (C4 Azul / Ficha de Inscripción)
  const downloadPdf = async () => {
    if (!generatedData?.file_path) return;
    setHasDownloaded(true);
    const filename = generatedData.file_path.split('/').pop();
    await forceDownload(getApiUrl(generatedData.file_path), filename);
  };

  // Download both DNI Azul images consecutively
  const downloadImages = async () => {
    const paths = generatedData?.image_paths || [];
    if (paths.length === 0) return;
    setHasDownloaded(true);
    for (const imgPath of paths) {
      await forceDownload(
        getApiUrl(imgPath),
        imgPath.split('/').pop()
      );
      await new Promise(r => setTimeout(r, 600));
    }
  };

  // Helper to parse raw text
  const getParsedData = () => {
    const resObj = generatedData?.data || generatedData;
    const text = resObj?.raw_text;

    console.log("DEBUG - generatedData:", generatedData);
    console.log("DEBUG - raw_text:", text);

    if (!text) return [];

    const extract = (key) => {
      const lines = text.split('\n');
      const targetLine = lines.find(l => {
        const upperLine = l.toUpperCase();
        return upperLine.includes(key.toUpperCase());
      });

      if (!targetLine) return '—';

      // Split by common bot symbols: ➜, ➟, ➺, :, ➣, ➾, >, •
      const parts = targetLine.split(/[➜➟➺:➣➾>•]|(\s{2,})/);
      if (parts.length < 2) return '—';

      let val = parts[parts.length - 1];
      val = val.replace(/[*#]/g, '').trim();
      return val || '—';
    };

    const titular = extract('TITULAR');
    const nombreSimple = extract('NOMBRE'); // Caso: '• Nombre ➟ ...'
    const nombres = extract('NOMBRES');
    const paterno = extract('PATERNO');
    const materno = extract('MATERNO');
    const ubicacion = extract('UBICACIÓN') || extract('UBICACION');

    let finalNombres = nombres !== '—' ? nombres : (nombreSimple !== '—' ? nombreSimple : (titular !== '—' ? titular : '—'));
    let finalApellidos = (paterno === '—' && materno === '—')
      ? extract('APELLIDOS')
      : `${paterno} ${materno}`.replace('—', '').trim();

    // Si tenemos un nombre completo con coma (ej: VILLEGAS DIAZ, YERFESON) y apellidos/nombres están vacíos
    if (finalNombres.includes(',') && (finalApellidos === '—' || !finalApellidos)) {
      const parts = finalNombres.split(',');
      finalApellidos = parts[0].trim();
      finalNombres = parts[1].trim();
    }

    return [
      { label: 'DNI', value: extract('DNI') },
      { label: 'NOMBRES', value: finalNombres },
      { label: 'APELLIDOS', value: finalApellidos || '—' },
      { label: 'UBICACIÓN', value: ubicacion },
      { label: 'EDAD', value: extract('EDAD') },
      { label: 'SEXO', value: extract('SEXO') || extract('GÉNERO') },
    ];
  };

  const parsedData = view === 'result' ? getParsedData() : [];

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
              creditsLabel={`${getCost(opt.id)} Credito${getCost(opt.id) !== 1 ? 's' : ''}`}
              actionLabel="Generar"
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

            <h3 className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mb-6 tracking-wide">
              {generatedData.type?.id === 'inscripcion'
                ? 'FICHA DE INSCRIPCIÓN GENERADA CON ÉXITO'
                : generatedData.type?.id === 'virtual_azul'
                  ? 'DNI AZUL VIRTUAL GENERADO CON ÉXITO'
                  : generatedData.type?.id === 'amarillo'
                    ? 'DNI AMARILLO VIRTUAL GENERADO CON ÉXITO'
                    : generatedData.type?.id === 'virtual_electronico'
                      ? 'DNI ELECTRÓNICO GENERADO CON ÉXITO'
                      : 'FICHA C4 GENERADA CON ÉXITO'}
            </h3>

            {/* Display Data Table for ALL types (C4, Inscripcion, DNI Virtual) */}
            <div className="w-full bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 mb-6 border border-slate-100 dark:border-slate-700">
              <div className="grid grid-cols-1 gap-2">
                {parsedData.map((item, idx) => (
                  <div key={idx} className="flex items-start text-sm">
                    <span className="font-bold text-slate-500 dark:text-slate-400 w-24 shrink-0">{item.label}</span>
                    <span className="text-slate-400 mx-2">:</span>
                    <span className="font-bold text-slate-800 dark:text-white truncate">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* DNI VIRTUAL (Azul o Amarillo): Image view */}
            {(generatedData.type?.id === 'virtual_azul' || generatedData.type?.id === 'amarillo' || generatedData.type?.id === 'virtual_electronico') ? (
              <div className="w-full flex flex-col gap-4 mb-8">
                {generatedData.frontal && (
                  <div
                    onClick={() => setPreviewImage({ url: getApiUrl(`/api/images/${generatedData.frontal.split('/').pop()}`), label: 'Anverso' })}
                    className="w-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-md cursor-zoom-in hover:opacity-90 transition-opacity active:scale-[0.98]"
                  >
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest px-3 pt-3 pb-1">Anverso</p>
                    <img
                      src={getApiUrl(`/api/images/${generatedData.frontal.split('/').pop()}`)}
                      alt="DNI Anverso"
                      className="w-full object-contain"
                    />
                  </div>
                )}
                {generatedData.reverso && (
                  <div
                    onClick={() => setPreviewImage({ url: getApiUrl(`/api/images/${generatedData.reverso.split('/').pop()}`), label: 'Reverso' })}
                    className="w-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-md cursor-zoom-in hover:opacity-90 transition-opacity active:scale-[0.98]"
                  >
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest px-3 pt-3 pb-1">Reverso</p>
                    <img
                      src={getApiUrl(`/api/images/${generatedData.reverso.split('/').pop()}`)}
                      alt="DNI Reverso"
                      className="w-full object-contain"
                    />
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* Document Preview — funciona en desktop y móvil */}
                {generatedData.file_path && (
                  generatedData.file_path.endsWith('.jpg') || generatedData.file_path.endsWith('.png') ? (
                    <div className="w-full flex justify-center mt-4 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
                      <img src={getApiUrl(`/api/static/${generatedData.file_path}`)} alt="Documento Generado" className="max-w-full h-auto" />
                    </div>
                  ) : (
                    <PdfViewer
                      url={getApiUrl(`/api/static/${generatedData.file_path}`)}
                      height="420px"
                      className="w-full mt-4 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm bg-white dark:bg-slate-800"
                    />
                  )
                )}
              </>
            )}

            {/* 3. Buttons */}
            <div className="flex flex-col w-full gap-3">
              {(generatedData.type?.id === 'virtual_azul' || generatedData.type?.id === 'amarillo' || generatedData.type?.id === 'virtual_electronico') ? (
                <button
                  onClick={downloadImages}
                  className="w-full py-4 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 text-lg"
                >
                  <span className="material-icons-round">download</span>
                  Descargar Imágenes
                </button>
              ) : (
                <button
                  onClick={downloadPdf}
                  className="w-full py-4 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 text-lg"
                >
                  <span className="material-icons-round">download</span>
                  {generatedData.type?.id === 'inscripcion' ? 'Descargar Ficha' : (generatedData.type?.id === 'arbol' ? 'Descargar Árbol' : 'Descargar C4')}
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
                    <p className="text-xs text-slate-500">Ingrese DNI para generar</p>
                  </div>
                </div>

                <input
                  type="text"
                  value={dni}
                  onChange={(e) => setDni(e.target.value.replace(/\D/g, '').slice(0, 8))}
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

      {/* IMAGE PREVIEW MODAL */}
      {createPortal(
        <AnimatePresence>
          {previewImage && (
            <div
              onClick={() => setPreviewImage(null)}
              className="fixed inset-0 z-[200] flex items-center justify-center px-[max(1rem,var(--safe-left))] pr-[max(1rem,var(--safe-right))] py-[max(1rem,var(--safe-top))] pb-[max(1rem,var(--safe-bottom))] bg-black/90 backdrop-blur-md cursor-pointer"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                onClick={(e) => e.stopPropagation()}
                className="relative w-full max-w-4xl flex flex-col items-center cursor-default"
              >
                <div className="w-full bg-white dark:bg-slate-900 rounded-2xl overflow-hidden shadow-2xl">
                  <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                    <h4 className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest text-xs">
                      DNI - {previewImage.label}
                    </h4>
                    <span className="text-[10px] font-black text-blue-500 bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 rounded-full uppercase">Vista HD</span>
                  </div>
                  <div className="p-2 flex items-center justify-center bg-slate-200 dark:bg-black/40 ">
                    <img
                      src={previewImage.url}
                      alt="Preview"
                      className="max-w-full h-auto rounded-lg shadow-inner"
                    />
                  </div>
                  <div className="p-4 flex gap-3 justify-center">
                    <button
                      onClick={() => forceDownload(previewImage.url, `DNI_${previewImage.label}_${generatedData.dni}.png`)}
                      className="px-6 py-2 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-all flex items-center gap-2 text-sm"
                    >
                      <span className="material-icons-round text-sm">download</span>
                      Descargar esta cara
                    </button>
                    <button
                      onClick={() => setPreviewImage(null)}
                      className="px-6 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all text-sm"
                    >
                      Cerrar
                    </button>
                  </div>
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
