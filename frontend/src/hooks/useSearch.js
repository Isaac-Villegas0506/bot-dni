import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLoading } from '../context/LoadingContext';
import { getApiUrl, queryFetch, QUERY_TIMEOUTS } from '../utils/api';
import {
    ERRORES_CONSULTA,
    ERRORES_RED,
    mensajeDeExcepcion,
    mensajeDeRespuesta,
} from '../utils/mensajes';

export function useSearch({ notify } = {}) {
    const { token, openWelcomeModal, refreshUser } = useAuth();
    const { loading, showLoading, hideLoading, registerAbort, showDonation, openDonation, closeDonation } = useLoading();

    const [searchMode, setSearchMode] = useState(() => sessionStorage.getItem('searchMode') || 'dni');
    const [searchType, setSearchType] = useState(() => sessionStorage.getItem('searchType') || 'basic');
    const [dni, setDni] = useState(() => sessionStorage.getItem('dni') || '');
    const [nombres, setNombres] = useState(() => sessionStorage.getItem('nombres') || '');
    const [result, setResult] = useState(() => {
        const saved = sessionStorage.getItem('result');
        return saved ? JSON.parse(saved) : null;
    });
    const [nameResults, setNameResults] = useState(() => {
        const saved = sessionStorage.getItem('nameResults');
        return saved ? JSON.parse(saved) : null;
    });
    const [downloadUrl, setDownloadUrl] = useState(null);
    const [totalResults, setTotalResults] = useState(0);
    const [alertMessage, setAlertMessage] = useState(null);

    /**
     * Publica un aviso para el modal.
     *
     * Si Home pasa `notify` (alert del hook de modales), se usa esa vía para
     * que el mensaje llegue al modal con su tipo y título. Sin `notify` se cae
     * al estado local: así el hook sigue funcionando aislado en tests.
     */
    const avisar = (message, type = 'info', title = null) => {
        if (notify) notify(message, type, title);
        else setAlertMessage(message);
    };

    useEffect(() => { sessionStorage.setItem('searchMode', searchMode); }, [searchMode]);
    useEffect(() => { sessionStorage.setItem('searchType', searchType); }, [searchType]);
    useEffect(() => { sessionStorage.setItem('dni', dni); }, [dni]);
    useEffect(() => { sessionStorage.setItem('nombres', nombres); }, [nombres]);
    useEffect(() => { 
        if (result) sessionStorage.setItem('result', JSON.stringify(result));
        else sessionStorage.removeItem('result');
    }, [result]);
    useEffect(() => { 
        if (nameResults) sessionStorage.setItem('nameResults', JSON.stringify(nameResults));
        else sessionStorage.removeItem('nameResults');
    }, [nameResults]);

    const searchDirectDni = async (dniVal, type = 'basic', captchaToken = null) => {
        showLoading(null, 'reniec');
        try {
            const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
            if (captchaToken) headers['X-Turnstile-Token'] = captchaToken;
            const url = type === 'premium'
                ? getApiUrl(`/api/dni/${dniVal}?type=premium`)
                : getApiUrl(`/api/dni/${dniVal}`);
            const res = await queryFetch(url, { headers }, { timeoutMs: QUERY_TIMEOUTS.reniec, registerAbort });

            let data = {};
            try { data = await res.json(); } catch { /* respuesta no-JSON */ }

            if (!res.ok) {
                const { type, title, message } = mensajeDeRespuesta(res.status, data.detail, 'dni', dniVal);
                avisar(message, type, title);
                return;
            }

            const isEmpty =
                (!data.nombres || data.nombres === 'N/A') &&
                (!data.apellidos || data.apellidos === 'N/A N/A' || data.apellidos === 'N/A') &&
                (!data.genero || data.genero === 'NO ESPECIFICADO');
            if (isEmpty) {
                avisar(ERRORES_CONSULTA.dniSinDatos(dniVal), 'warning', 'Sin resultados');
                return;
            }
            setResult(data);
            if (token) refreshUser();
        } catch (e) {
            if (e?.name === 'TimeoutError') {
                avisar(ERRORES_RED.timeout, 'warning', 'La consulta tardó demasiado');
            } else {
                avisar(mensajeDeExcepcion(e), 'error', 'No se pudo completar la consulta');
                if (e?.message?.includes('Regístrate')) openWelcomeModal();
            }
        } finally {
            hideLoading();
        }
    };

    const searchByName = async (n, apP, apM, captchaToken = null) => {
        showLoading(null, 'reniec');
        setSearchMode('name');
        setTotalResults(0);
        try {
            const p = new URLSearchParams();
            p.append('nombres', n);
            if (apP) p.append('ap_paterno', apP);
            if (apM) p.append('ap_materno', apM);
            const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
            if (captchaToken) headers['X-Turnstile-Token'] = captchaToken;
            const res = await queryFetch(getApiUrl(`/api/search/name?${p.toString()}`), { headers }, { timeoutMs: QUERY_TIMEOUTS.reniec, registerAbort });

            let data = {};
            try { data = await res.json(); } catch { /* respuesta no-JSON */ }

            if (!res.ok) {
                const { type, title, message } = mensajeDeRespuesta(res.status, data.detail, 'name');
                avisar(message, type, title);
                return;
            }

            const lista = Array.isArray(data) ? data : (data.resultados || []);
            if (lista.length === 0) {
                avisar(ERRORES_CONSULTA.nombreSinDatos, 'warning', 'Sin resultados');
                return;
            }

            setNameResults(lista);
            setDownloadUrl(data.archivo_url || null);
            setTotalResults(data.total_count || lista.length);
        } catch (e) {
            if (e?.name === 'TimeoutError') {
                avisar(ERRORES_RED.timeout, 'warning', 'La búsqueda tardó demasiado');
            } else {
                avisar(mensajeDeExcepcion(e), 'error', 'No se pudo completar la búsqueda');
            }
        } finally {
            hideLoading();
        }
    };

    const resetSearch = () => {
        setResult(null);
        setNameResults(null);
        setDownloadUrl(null);
        setTotalResults(0);
        setDni('');
        setNombres('');
    };

    // Limpia solo el resultado manteniendo nameResults (para volver a la lista desde Flujo A)
    const clearResult = () => {
        setResult(null);
    };

    return {
        // State
        searchMode, setSearchMode,
        searchType, setSearchType,
        dni, setDni,
        nombres, setNombres,
        result,
        nameResults,
        downloadUrl,
        totalResults,
        loading,
        showDonation, openDonation, closeDonation,
        alertMessage, setAlertMessage,
        // Actions
        searchDirectDni,
        searchByName,
        resetSearch,
        clearResult,
    };
}
