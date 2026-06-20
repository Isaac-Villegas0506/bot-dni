import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLoading } from '../context/LoadingContext';
import { getApiUrl } from '../utils/api';

export function useSearch() {
    const { token, setShowWelcomeModal, refreshUser } = useAuth();
    const { loading, showLoading, hideLoading, showDonation, openDonation, closeDonation } = useLoading();

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
        showLoading();
        try {
            const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
            if (captchaToken) headers['X-Turnstile-Token'] = captchaToken;
            const url = type === 'premium'
                ? getApiUrl(`/api/dni/${dniVal}?type=premium`)
                : getApiUrl(`/api/dni/${dniVal}`);
            const res = await fetch(url, { headers });
            const data = await res.json();
            if (!res.ok) {
                if (res.status === 403 && data.detail?.includes('crédito')) throw new Error(data.detail);
                throw new Error(data.detail || 'Error');
            }
            const isEmpty =
                (!data.nombres || data.nombres === 'N/A') &&
                (!data.apellidos || data.apellidos === 'N/A N/A' || data.apellidos === 'N/A') &&
                (!data.genero || data.genero === 'NO ESPECIFICADO');
            if (isEmpty) {
                setAlertMessage(`No se encontraron datos para el DNI ${dniVal}. Verifica el número e intenta nuevamente.`);
                return;
            }
            setResult(data);
            if (token) refreshUser();
        } catch (e) {
            setAlertMessage(e.message || 'Error en la búsqueda');
            if (e.message?.includes('Regístrate')) setShowWelcomeModal(true);
        } finally {
            hideLoading();
        }
    };

    const searchByName = async (n, apP, apM, captchaToken = null) => {
        showLoading();
        setSearchMode('name');
        setTotalResults(0);
        try {
            const p = new URLSearchParams();
            p.append('nombres', n);
            if (apP) p.append('ap_paterno', apP);
            if (apM) p.append('ap_materno', apM);
            const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
            if (captchaToken) headers['X-Turnstile-Token'] = captchaToken;
            const res = await fetch(getApiUrl(`/api/search/name?${p.toString()}`), { headers });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'Error');
            if (Array.isArray(data)) {
                setNameResults(data);
                setTotalResults(data.length);
            } else if (data.resultados) {
                setNameResults(data.resultados);
                setDownloadUrl(data.archivo_url);
                setTotalResults(data.total_count || data.resultados.length);
            }
        } catch (e) {
            setAlertMessage(e.message || 'Error en la búsqueda');
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
