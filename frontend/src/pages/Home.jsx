import { useState, useRef, useEffect } from 'react';
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
import ModalLoading from '../components/ModalLoading';
import SearchOptionModal from '../components/SearchOptionModal';
import AnnouncementModal from '../components/AnnouncementModal';

export default function Home({ darkMode }) {
    const navigate = useNavigate();
    const { user, setShowWelcomeModal } = useAuth();
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
    const [pendingSearch, setPendingSearch] = useState(null);

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
    }, [location.state, navigate]);

    // Other UI state
    const [optionModal, setOptionModal] = useState({ isOpen: false, targetUser: null });

    const handleBack = () => {
        resetSearch();
        navigate('/');
    };

    // ─── Submit handlers ──────────────────────────────────────────────────────
    const handleDniSubmit = async (e) => {
        if (e) e.preventDefault();
        if (!dni || dni.length !== 8) { setAlertMessage('Ingresa un DNI válido de 8 dígitos'); return; }
        if (searchType === 'premium' && !user) {
            setAlertMessage('Regístrate o inicia sesión para recibir 5 créditos premium cada 24 horas.');
            setShowWelcomeModal(true);
            return;
        }
        if (!user && !captchaToken) {
            setPendingSearch({ type: 'dni', value: dni, searchType });
            setShowCaptcha(true);
            return;
        }
        setAlertMessage(null);
        await searchDirectDni(dni, searchType, captchaToken);
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
            setPendingSearch({ type: 'name', n, apP, apM });
            setShowCaptcha(true);
            return;
        }
        setAlertMessage(null);
        await searchByName(n, apP, apM, captchaToken);
        setCaptchaToken(null);
    };

    const handleCaptchaSuccess = (turnstileToken) => {
        setCaptchaToken(turnstileToken);
        setShowCaptcha(false);
        if (!pendingSearch) return;
        if (pendingSearch.type === 'dni') {
            searchDirectDni(pendingSearch.value, pendingSearch.searchType, turnstileToken);
        } else if (pendingSearch.type === 'name') {
            searchByName(pendingSearch.n, pendingSearch.apP, pendingSearch.apM, turnstileToken);
        }
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
                    <h2 className="text-2xl font-bold">Resultados ({totalResults})</h2>
                    <div className="flex flex-col md:flex-row gap-3">
                        <button onClick={handleBack} className="order-1 md:order-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 text-slate-700 dark:text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-150 w-full md:w-auto focus-ring">
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
                                className="order-2 md:order-1 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors shadow-lg shadow-emerald-500/20 w-full md:w-auto"
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
                            className="bg-white dark:bg-slate-900 p-5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 cursor-pointer hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-md transition-all duration-200 flex justify-between items-center group"
                        >
                            <div>
                                <p className="font-semibold text-slate-900 dark:text-white">{item.nombre_completo}</p>
                                <p className="text-sm text-slate-500 dark:text-slate-400 font-mono mt-0.5">{item.documento}{item.edad ? ` · ${item.edad} años` : ''}</p>
                            </div>
                            <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded-full group-hover:bg-blue-100 dark:group-hover:bg-blue-900/40 transition-colors duration-150 shrink-0">
                                <span className="material-icons-round text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-150 text-xl">chevron_right</span>
                            </div>
                        </div>
                    ))}
                </div>

                <SearchOptionModal
                    isOpen={optionModal.isOpen}
                    onClose={() => setOptionModal({ ...optionModal, isOpen: false })}
                    onConfirm={(selectedType) => {
                        if (!optionModal.targetUser) return;
                        if (selectedType === 'premium' && !user) {
                            setAlertMessage('Regístrate o inicia sesión para recibir 1 crédito premium cada 24 horas.');
                            setShowWelcomeModal(true);
                            return;
                        }
                        const targetDni = optionModal.targetUser.documento || optionModal.targetUser.dni;
                        setDni(targetDni);
                        setSearchMode('dni');
                        setSearchType(selectedType);
                        searchDirectDni(targetDni, selectedType);
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
                    className="w-full sm:w-auto flex items-center justify-center gap-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-8 py-4 rounded-2xl shadow-lg hover:shadow-xl active:scale-95 transition-all duration-200 focus-ring"
                >
                    <span className="material-icons-round text-xl">redeem</span>
                    <span className="font-bold text-sm sm:text-base tracking-wide">Ganar Créditos Gratis</span>
                </button>

                <button
                    onClick={openDonation}
                    className="w-full sm:w-auto flex items-center justify-center gap-3 bg-white dark:bg-card-dark border-2 border-slate-200 dark:border-slate-800 px-8 py-4 rounded-2xl shadow-sm hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 active:scale-95 transition-all duration-200 focus-ring"
                >
                    <span className="text-xl">💜</span>
                    <span className="font-bold text-sm sm:text-base text-slate-700 dark:text-slate-300">Apoyar con Yape</span>
                </button>
            </div>

            {/* Modals */}
            <AlertModal message={alertMessage} onClose={() => setAlertMessage(null)} />

            <SearchOptionModal
                isOpen={optionModal.isOpen}
                onClose={() => setOptionModal({ ...optionModal, isOpen: false })}
                onConfirm={(selectedType) => {
                    if (!optionModal.targetUser) return;
                    if (selectedType === 'premium' && !user) {
                        setAlertMessage('Regístrate o inicia sesión para recibir 1 crédito premium cada 24 horas.');
                        setShowWelcomeModal(true);
                        return;
                    }
                    const targetDni = optionModal.targetUser.documento || optionModal.targetUser.dni;
                    setDni(targetDni);
                    setSearchMode('dni');
                    setSearchType(selectedType);
                    searchDirectDni(targetDni, selectedType);
                }}
                user={user}
                targetUser={optionModal.targetUser}
            />

            {/* Captcha Modal */}
            <AnimatePresence>
                {showCaptcha && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
                        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl flex flex-col relative border border-slate-200 dark:border-slate-800 w-[92%] max-w-[360px] overflow-hidden">
                            {/* Header */}
                            <div className="w-full flex justify-between items-center px-5 py-4 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-800/20">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                                        <span className="material-icons-round text-lg">security</span>
                                    </div>
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
                                        siteKey="0x4AAAAAADImuetK3dfQj-A1"
                                        onSuccess={handleCaptchaSuccess}
                                        options={{ theme: darkMode ? 'dark' : 'light' }}
                                    />
                                </div>

                                {/* Compact Horizontal CTA */}
                                <div className="w-full bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-3 sm:p-4 flex flex-row items-center justify-between gap-3 border border-slate-100 dark:border-slate-700/50">
                                    <div className="flex flex-col">
                                        <p className="text-[12px] sm:text-[13px] font-bold text-slate-800 dark:text-slate-200">¿Usuario frecuente?</p>
                                        <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">Omite esta validación</p>
                                    </div>
                                    <button onClick={() => { setShowCaptcha(false); setShowWelcomeModal(true); }} className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold text-[11px] sm:text-[12px] transition-all active:scale-95 shrink-0 shadow-sm">
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
