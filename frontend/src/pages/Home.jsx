import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useSearch } from '../hooks/useSearch';
import { useAnnouncements } from '../hooks/useAnnouncements';
import { getApiUrl } from '../utils/api';
import SearchBar from '../components/SearchBar';
import ResultCard from '../components/ResultCard';
import SearchOptionModal from '../components/SearchOptionModal';
import AnnouncementModal from '../components/AnnouncementModal';
import HomeModals from './home/HomeModals';
import { useHomeModals } from './home/useHomeModals';

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
        setAlertMessage,
        searchDirectDni,
        searchByName,
        resetSearch,
        clearResult,
    } = useSearch();

    // DNI cuya consulta premium quedó pendiente de registro.
    const [pendingPremiumDni, setPendingPremiumDni] = useState(null);

    /**
     * Lanza una consulta por DNI limpiando la vista previa.
     *
     * Si había un resultado en pantalla, Home renderiza la vista de resultados
     * y con el mismo DNI React no re-renderiza nada ("no pasa nada"). Se limpia
     * el resultado anterior para volver al buscador y mostrar los datos nuevos.
     */
    const ejecutarBusquedaDni = useCallback((value, type, tokenCaptcha) => {
        clearResult();
        setAlertMessage(null);
        setSearchMode('dni');
        setSearchType(type);
        setDni(value);
        searchDirectDni(value, type, tokenCaptcha);
    }, [clearResult, searchDirectDni, setAlertMessage, setDni, setSearchMode, setSearchType]);

    // Modales centralizados: viven fuera de las vistas para que no se
    // desmonten a mitad de flujo (elegir un nombre -> captcha -> búsqueda).
    const modals = useHomeModals({
        user,
        onSearch: ejecutarBusquedaDni,
        onSearchByName: (n, apP, apM, token) => searchByName(n, apP, apM, token),
        onPremiumBlocked: (targetDni) => {
            setPendingPremiumDni(targetDni);
            openWelcomeModal();
        },
    });

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
                setTimeout(() => searchByName(autoSearch), 100);
            }
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location.state, location.pathname, navigate, searchByName, setDni, setNombres, setSearchMode, setSearchType]);

    // Retoma la consulta premium que quedó pendiente de registro.
    const premiumRef = useRef(null);
    useEffect(() => {
        if (!user || !pendingPremiumDni || premiumRef.current === pendingPremiumDni) return;
        premiumRef.current = pendingPremiumDni;
        const dniPendiente = pendingPremiumDni;
        const id = setTimeout(() => {
            setPendingPremiumDni(null);
            ejecutarBusquedaDni(dniPendiente, 'premium');
        }, 0);
        return () => clearTimeout(id);
    }, [user, pendingPremiumDni, ejecutarBusquedaDni]);

    const handleBack = () => {
        resetSearch();
        navigate('/');
    };

    // ─── Submit handlers ──────────────────────────────────────────────────────
    const handleDniSubmit = async (e) => {
        if (e) e.preventDefault();
        if (!dni || dni.length !== 8) { setAlertMessage('Ingresa un DNI válido de 8 dígitos'); return; }
        if (searchType === 'premium' && !user) {
            setAlertMessage(null);
            setPendingPremiumDni(dni);
            openWelcomeModal();
            return;
        }
        if (!user && !modals.captchaToken) {
            modals.openCaptcha({ value: dni, searchType });
            return;
        }
        await ejecutarBusquedaDni(dni, searchType, modals.captchaToken);
        modals.setCaptchaToken(null);
    };

    const handleNameSubmit = async (e) => {
        if (e) e.preventDefault();
        if (!nombres) { setAlertMessage('Ingresa nombres para buscar'); return; }
        const parts = nombres.trim().split(/\s+/);
        let n = nombres, apP = '', apM = '';
        if (parts.length >= 3) { apM = parts.pop(); apP = parts.pop(); n = parts.join(' '); }
        else if (parts.length === 2) { apP = parts.pop(); n = parts[0]; }

        if (!user && !modals.captchaToken) {
            modals.openCaptcha({ type: 'name', n, apP, apM });
            return;
        }
        setAlertMessage(null);
        await searchByName(n, apP, apM, modals.captchaToken);
        modals.setCaptchaToken(null);
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
                <HomeModals modals={modals} user={user} darkMode={darkMode} onLoginClick={openWelcomeModal} />
            </>
        );
    }

    if (nameResults) {
        return (
            <>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                        <h2 className="text-2xl font-bold">Resultados ({totalResults})</h2>
                        <div className="flex flex-col md:flex-row gap-3">
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
                                onClick={() => modals.openOptions(item)}
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
                </motion.div>
                <HomeModals modals={modals} user={user} darkMode={darkMode} onLoginClick={openWelcomeModal} />
            </>
        );
    }

    // ─── Default: Search View ─────────────────────────────────────────────────
    return (
        <>
            <motion.div key="search" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full flex flex-col items-center">
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
                />

                <div className="mt-8 flex flex-col gap-3 w-full max-w-md sm:flex-row sm:justify-center">
                    <button
                        onClick={() => navigate('/creditos')}
                        className="btn-primary-minimal w-full px-8 py-4 sm:w-auto"
                    >
                        <span className="material-icons-round text-xl">stars</span>
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
            </motion.div>
            <HomeModals modals={modals} user={user} darkMode={darkMode} onLoginClick={openWelcomeModal} />
        </>
    );
}
