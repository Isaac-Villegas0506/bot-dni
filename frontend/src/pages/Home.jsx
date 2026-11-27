import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Turnstile } from '@marsidev/react-turnstile';
import { useAuth } from '../context/AuthContext';
import { useSearch } from '../hooks/useSearch';
import { useAnnouncements } from '../hooks/useAnnouncements';
import { getApiUrl } from '../utils/api';
import SearchBar from '../components/SearchBar';
import ResultCard from '../components/ResultCard';
import AlertModal from '../components/AlertModal';
import SearchOptionModal from '../components/SearchOptionModal';
import AnnouncementModal from '../components/AnnouncementModal';

export default function Home({ darkMode }) {
    const navigate = useNavigate();
    const { user, openWelcomeModal } = useAuth();
    const { announcements, dismissAnnouncement } = useAnnouncements();
    const location = useLocation();

    const {
        searchMode, setSearchMode,
        searchType, setSearchType,
        dni, setDni,
        nombres, setNombres,
        result,
        nameResults,
        downloadUrl,
        totalResults,
        loading,
        openDonation,
        alertMessage, setAlertMessage,
        searchDirectDni,
        searchByName,
        resetSearch,
        clearResult,
    } = useSearch();

    // Captcha state (UI-level, not in the hook)
    const [captchaToken, setCaptchaToken] = useState(null);
    const [showCaptcha, setShowCaptcha] = useState(false);
    // Fuerza un widget nuevo en cada apertura (Cloudflare emite un token por
    // instancia; reutilizar el widget ya resuelto dejaba el modal en blanco).
    const [captchaKey, setCaptchaKey] = useState(0);
    const [pendingSearch, setPendingSearch] = useState(null);
    // DNI cuya consulta premium quedó pendiente de registro.
    const [pendingPremiumDni, setPendingPremiumDni] = useState(null);

    /** Abre el captcha con un widget fresco y recuerda la búsqueda pendiente. */
    const abrirCaptcha = (pendiente) => {
        setCaptchaToken(null);
        setCaptchaKey((k) => k + 1);
        setPendingSearch(pendiente);
        setShowCaptcha(true);
    };

    // Auto-trigger from state (e.g. from UserHistory)
    const hasAutoTriggered = useRef(false);
    useEffect(() => {
        if (location.state?.autoSearch && !hasAutoTriggered.current) {
            hasAutoTriggered.current = true;
            const { autoSearch, type } = location.state;
            if (type === 'dni' || type === 'dni_premium') {
                setSearchMode('dni');
                setDni(autoSearch);
                setSearchType(type === 'dni_premium' ? 'premium' : 'basic');
            } else if (type === 'name') {
                setSearchMode('name');
                setNombres(autoSearch);
                // Trigger auto search for names immediately, since SearchBar only auto-triggers DNI
                setTimeout(() => searchByName(autoSearch), 100);
            }
            // Clear state so it doesn't re-trigger on refresh
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location.state, location.pathname, navigate, searchByName, setDni, setNombres, setSearchMode, setSearchType]);

    // Other UI state
    const [optionModal, setOptionModal] = useState({ isOpen: false, targetUser: null });

    /**
     * Lanza la consulta limpiando la vista previa.
     *
     * Si había un resultado en pantalla, Home renderiza la vista de resultados
     * y `searchDirectDni` actualiza el estado, pero al ser el mismo DNI React
     * no re-renderiza nada: el usuario veía que "no pasaba nada". Se limpia el
     * resultado anterior antes de buscar para que la vista vuelva al buscador
     * y luego muestre los datos nuevos.
     */
    const ejecutarBusquedaDni = useCallback((value, type, tokenCaptcha) => {
        clearResult();
        setAlertMessage(null);
        searchDirectDni(value, type, tokenCaptcha);
    }, [clearResult, searchDirectDni, setAlertMessage]);

    // Retoma la consulta premium que quedó pendiente de registro: el usuario
    // eligió premium desde la lista de nombres, se registró y seguía sin hacer
    // nada al cerrar los modales. Se lanza en un microtask para no encadenar
    // setState dentro del efecto.
    const premiumRef = useRef(null);
    useEffect(() => {
        if (!user || !pendingPremiumDni || premiumRef.current === pendingPremiumDni) return;
        premiumRef.current = pendingPremiumDni;
        const dniPendiente = pendingPremiumDni;
        const id = setTimeout(() => {
            setPendingPremiumDni(null);
            setDni(dniPendiente);
            setSearchMode('dni');
            setSearchType('premium');
            ejecutarBusquedaDni(dniPendiente, 'premium');
        }, 0);
        return () => clearTimeout(id);
    }, [user, pendingPremiumDni, ejecutarBusquedaDni, setDni, setSearchMode, setSearchType]);

    const handleBack = () => {
        resetSearch();
        navigate('/');
    };

    // ─── Submit handlers ──────────────────────────────────────────────────────
    const handleDniSubmit = async (e) => {
        if (e) e.preventDefault();
        if (!dni || dni.length !== 8) { setAlertMessage('Ingresa un DNI válido de 8 dígitos'); return; }
        if (searchType === 'premium' && !user) {
            // Solo el modal de registro: mostrar además una alerta dejaba dos
            // modales encima y ninguno se podía cerrar.
            setAlertMessage(null);
            setPendingPremiumDni(dni);
            openWelcomeModal();
            return;
        }
        if (!user && !captchaToken) {
            abrirCaptcha({ type: 'dni', value: dni, searchType });
            return;
        }
        setAlertMessage(null);
        await ejecutarBusquedaDni(dni, searchType, captchaToken);
        setCaptchaToken(null);
    };

    const handleNameSubmit = async (e) => {
        if (e) e.preventDefault();
        if (!nombres) { setAlertMessage('Ingresa nombres para buscar'); return; }
        const parts = nombres.trim().split(/\s+/);
        let n = nombres, apP = '', apM = '';
        if (parts.length >= 3) { apM = parts.pop(); apP = parts.pop(); n = parts.join(' '); }
        else if (parts.length === 2) { apP = parts.pop(); n = parts[0]; }
        if (!user && !captchaToken) {
            abrirCaptcha({ type: 'name', n, apP, apM });
            return;
        }
        setAlertMessage(null);
        await searchByName(n, apP, apM, captchaToken);
        setCaptchaToken(null);
    };

    const handleCaptchaSuccess = (turnstileToken) => {
        setCaptchaToken(turnstileToken);
        setShowCaptcha(false);
        if (!pendingSearch) {
            // El usuario resolvió el captcha sin búsqueda pendiente: el token
            // queda guardado para el próximo envío.
            return;
        }
        if (pendingSearch.type === 'dni') {
            ejecutarBusquedaDni(pendingSearch.value, pendingSearch.searchType, turnstileToken);
        } else if (pendingSearch.type === 'name') {
            searchByName(pendingSearch.n, pendingSearch.apP, pendingSearch.apM, turnstileToken);
        }
        // Un token de Turnstile es de un solo uso: se descarta para que la
        // siguiente consulta pida uno nuevo en lugar de fallar con 403.
        setCaptchaToken(null);
        setPendingSearch(null);
    };

    // ─── Result views ─────────────────────────────────────────────────────────
    if (result) {
        // Si venía de búsqueda por nombre, "Regresar" vuelve a la lista (Flujo A).
        // Si venía de búsqueda directa por DNI, "Regresar" vuelve al formulario (Flujo B).
        const handleBackFromResult = nameResults ? clearResult : resetSearch;
        return (
            <>
                <ResultCard
                    result={result}
                    searchType={searchType}
                    onOpenDonation={openDonation}
                    onBack={handleBackFromResult}
                />
            </>
        );
    }

    if (nameResults) {
        return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full space-y-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                    <h2 className="text-2xl font-bold">Resultados ({totalResults})</h2>                    <div className="flex flex-col md:flex-row gap-3">
                        <button onClick={handleBack} className="order-1 md:order-2 rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700 w-full md:w-auto focus-ring">
                            Nueva búsqueda
                        </button>
                        {downloadUrl && (
                            <button
                                onClick={async (e) => {
                                    e.preventDefault();
                                    try {
                                        const res = await fetch(getApiUrl(`/api/static/${downloadUrl}`));
                                        const blob = await res.blob();
                                        const url = URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = downloadUrl.split('/').pop() || 'nombres.txt';
                                        document.body.appendChild(a); a.click(); document.body.removeChild(a);
                                        URL.revokeObjectURL(url);
                                    } catch (err) { console.error('Error bajando TXT:', err); }
                                }}
                                className="order-2 md:order-1 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors w-full md:w-auto"
                            >
                                <span className="material-icons-round">description</span>
                                Descargar TXT
                            </button>
                        )}
                    </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {nameResults.map((item, i) => (
                        <div
                            key={i}
                            onClick={() => setOptionModal({ isOpen: true, targetUser: item })}
                            className="bg-white dark:bg-slate-900 p-5 rounded-lg border border-slate-200 dark:border-slate-800 cursor-pointer hover:border-primary dark:hover:border-primary-dark transition-colors duration-150 flex justify-between items-center group"
                        >
                            <div>
                                <p className="font-semibold text-slate-900 dark:text-white">{item.nombre_completo}</p>
                                <p className="text-sm text-slate-500 dark:text-slate-400 font-mono mt-0.5">{item.documento}{item.edad ? `, ${item.edad} años` : ''}</p>
                            </div>
                            <div className="flex h-11 w-7 shrink-0 items-center justify-end text-slate-400 transition-colors duration-150 group-hover:text-primary dark:text-slate-500 dark:group-hover:text-primary-dark">
                                <span className="material-icons-round text-xl">chevron_right</span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Aviso cuando el bot devuelve mas coincidencias de las que
                    trae el mensaje: el listado completo viene en el TXT. */}
                {totalResults > nameResults.length && (
                    <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/50 dark:bg-amber-950/20">
                        <span className="material-icons-round shrink-0 text-amber-600 dark:text-amber-400">info</span>
                        <p className="text-sm text-amber-900 dark:text-amber-200">
                            Se encontraron <strong>{totalResults}</strong> coincidencias y aquí se muestran{' '}
                            <strong>{nameResults.length}</strong>.
                            {downloadUrl
                                ? ' Descarga el archivo TXT para ver todas.'
                                : ' El listado completo lo envía el proveedor por separado.'}
                        </p>
                    </div>
                )}

                <SearchOptionModal
                    isOpen={optionModal.isOpen}
                    onClose={() => setOptionModal({ ...optionModal, isOpen: false })}
                    onConfirm={(selectedType) => {
                        if (!optionModal.targetUser) return;
                        const targetDni = optionModal.targetUser.documento || optionModal.targetUser.dni;
                        // Cierra SIEMPRE el selector antes de abrir otra cosa: si
                        // queda abierto debajo, su backdrop con z-index alto
                        // bloquea los clicks del modal de arriba.
                        setOptionModal({ ...optionModal, isOpen: false });

                        if (selectedType === 'premium' && !user) {
                            // Un único modal: el de registro. Antes también se
                            // mostraba un AlertModal encima, y los dos juntos no
                            // se podían cerrar.
                            setAlertMessage(null);
                            setPendingPremiumDni(targetDni);
                            openWelcomeModal();
                            return;
                        }

                        setDni(targetDni);
                        setSearchMode('dni');
                        setSearchType(selectedType);
                        // Sin sesión se necesita token de captcha: antes se
                        // llamaba sin él y el backend respondía 403 "captcha no
                        // válido" tras elegir un nombre de la lista.
                        if (!user && !captchaToken) {
                            abrirCaptcha({ type: 'dni', value: targetDni, searchType: selectedType });
                            return;
                        }
                        ejecutarBusquedaDni(targetDni, selectedType, captchaToken);
                        setCaptchaToken(null);
                    }}
                    user={user}
                    targetUser={optionModal.targetUser}
                />
                <AlertModal message={alertMessage} onClose={() => setAlertMessage(null)} />
            </motion.div>
        );
    }

    // ─── Default: Search View ─────────────────────────────────────────────────
    return (
        <motion.div key="search" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full flex flex-col items-center">

            {/* Announcement Modal */}
            {announcements.length > 0 && (
                <AnnouncementModal
                    announcement={announcements[0]}
                    onClose={() => dismissAnnouncement(announcements[0].id)}
                />
            )}


            <SearchBar
                searchMode={searchMode}
                setSearchMode={setSearchMode}
                loading={loading}
                searchDni={{ value: dni, onChange: (e) => setDni(e.target.value.replace(/\D/g, '')), handleSubmit: handleDniSubmit, searchType, setSearchType }}
                searchName={{ nombres, setNombres, handleSubmit: handleNameSubmit }}
                user={user}
                captchaToken={captchaToken}
                setCaptchaToken={setCaptchaToken}
            />

            {/* Secondary Actions (Yape & Referrals) */}
            <div className="w-full max-w-5xl flex flex-col sm:flex-row justify-center items-center gap-4 mt-10 lg:mt-14 px-4">
                <button
                    onClick={() => navigate('/creditos')}
                    className="btn-primary-minimal w-full px-8 py-4 sm:w-auto"
                >
                    <span className="material-icons-round text-xl">redeem</span>
                    <span className="font-bold text-sm sm:text-base">Ganar Créditos Gratis</span>
                </button>

                <button
                    onClick={openDonation}
                    className="btn-secondary-minimal w-full px-8 py-4 sm:w-auto"
                >
                    <span className="material-icons-round text-xl">favorite</span>
                    <span className="font-bold text-sm sm:text-base">Apoyar con Yape</span>
                </button>
            </div>

            {/* Modals */}
            <AlertModal message={alertMessage} onClose={() => setAlertMessage(null)} />

            <SearchOptionModal
                isOpen={optionModal.isOpen}
                onClose={() => setOptionModal({ ...optionModal, isOpen: false })}
                onConfirm={(selectedType) => {
                    if (!optionModal.targetUser) return;
                    const targetDni = optionModal.targetUser.documento || optionModal.targetUser.dni;
                    // Se cierra el selector antes de abrir cualquier otro modal:
                    // si queda abierto debajo, su overlay bloquea los clicks.
                    setOptionModal({ ...optionModal, isOpen: false });

                    if (selectedType === 'premium' && !user) {
                        // Solo el modal de registro, sin alerta encima.
                        setAlertMessage(null);
                        setPendingPremiumDni(targetDni);
                        openWelcomeModal();
                        return;
                    }

                    setDni(targetDni);
                    setSearchMode('dni');
                    setSearchType(selectedType);
                    if (!user && !captchaToken) {
                        abrirCaptcha({ type: 'dni', value: targetDni, searchType: selectedType });
                        return;
                    }
                    ejecutarBusquedaDni(targetDni, selectedType, captchaToken);
                    setCaptchaToken(null);
                }}
                user={user}
                targetUser={optionModal.targetUser}
            />

            {/* Captcha Modal */}
            <AnimatePresence>
                {showCaptcha && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-950/55 backdrop-blur-sm z-[9999] flex items-center justify-center px-[max(1rem,var(--safe-left))] pr-[max(1rem,var(--safe-right))] py-[max(1rem,var(--safe-top))] pb-[max(1rem,var(--safe-bottom))]">
                        <motion.div initial={{ scale: 0.98, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.98, opacity: 0 }} className="bg-white dark:bg-slate-900 rounded-lg shadow-xl flex flex-col relative border border-slate-200 dark:border-slate-800 w-[92%] max-w-[360px] overflow-hidden">
                            {/* Header */}
                            <div className="w-full flex justify-between items-center px-5 py-4 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-800/20">
                                <div className="flex items-center gap-2.5">
                                    <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">Verificación</h3>
                                </div>
                                <button onClick={() => { setShowCaptcha(false); setPendingSearch(null); }} className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
                                    <span className="material-icons-round text-[20px]">close</span>
                                </button>
                            </div>

                            {/* Body */}
                            <div className="p-5 flex flex-col items-center">
                                <div className="w-full flex justify-center mb-5">
                                    <Turnstile
                                        // key única por apertura: sin esto React
                                        // reutiliza el widget ya resuelto y
                                        // Cloudflare no vuelve a emitir token,
                                        // así que onSuccess nunca se disparaba y
                                        // la búsqueda salía con "captcha no válido".
                                        key={captchaKey}
                                        siteKey="0x4AAAAAADImuetK3dfQj-A1"
                                        onSuccess={handleCaptchaSuccess}
                                        onError={() => { setCaptchaToken(null); setCaptchaKey(k => k + 1); }}
                                        onExpire={() => { setCaptchaToken(null); setCaptchaKey(k => k + 1); }}
                                        options={{ theme: darkMode ? 'dark' : 'light' }}
                                    />
                                </div>

                                {/* Compact Horizontal CTA */}
                                <div className="w-full bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 sm:p-4 flex flex-row items-center justify-between gap-3 border border-slate-100 dark:border-slate-700/50">
                                    <div className="flex flex-col">
                                        <p className="text-[12px] sm:text-[13px] font-bold text-slate-800 dark:text-slate-200">¿Usuario frecuente?</p>
                                        <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">Omite esta validación</p>
                                    </div>
                                    <button onClick={() => { setShowCaptcha(false); openWelcomeModal(); }} className="min-h-[44px] px-4 sm:px-5 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold text-[11px] sm:text-[12px] transition-colors shrink-0">
                                        Inicia sesión
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
