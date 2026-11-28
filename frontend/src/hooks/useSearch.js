import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLoading } from '../context/LoadingContext';
import { getApiUrl, queryFetch, getQueryErrorMessage, QUERY_TIMEOUTS } from '../utils/api';

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

    /**
     * Traduce la respuesta de error del backend a (tipo, título, mensaje).
     *
     * Cada caso tiene su modal: sin resultados no es lo mismo que captcha
     * vencido, créditos insuficientes o el servicio caído.
     */
    const clasificarError = (status, detail, contexto) => {
        const texto = typeof detail === 'string' ? detail : '';

        if (status === 404) {
            return [
                'warning',
                'Sin resultados',
                contexto === 'dni'
                    ? 'No se encontraron datos para ese DNI. Verifica que el número esté bien escrito e intenta de nuevo.'
                    : 'No se encontró ninguna persona con esos nombres. Prueba con menos apellidos o revisa la ortografía.',
            ];
        }
        if (status === 402) {
            return ['insufficient_credits', null, texto || 'No tienes créditos suficientes para esta consulta.'];
        }
        if (status === 429) {
            return [
                'warning',
                'Demasiadas solicitudes',
                texto || 'Hiciste varias consultas seguidas. Espera unos segundos y vuelve a intentarlo.',
            ];
        }
        if (status === 503) {
            return [
                'warning',
                'Servicio no disponible',
                texto || 'Este apartado está deshabilitado temporalmente. Intenta más tarde.',
            ];
        }
        if (status === 403) {
            if (/captcha|turnstile/i.test(texto)) {
                return [
                    'warning',
                    'Verificación vencida',
                    'La verificación de seguridad expiró o no se completó. Cierra este aviso y repite la consulta para que aparezca de nuevo.',
                ];
            }
            return ['warning', 'Acceso denegado', texto || 'No tienes permisos para realizar esta consulta.'];
        }
        if (status === 400) {
            return [
                'warning',
                'Revisa los datos',
                texto || 'El texto ingresado no es válido. Revisa los datos e intenta nuevamente.',
            ];
        }
        return ['error', 'No se pudo completar la consulta', texto || 'Ocurrió un problema al consultar. Intenta nuevamente.'];
    };

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
                const [tipo, titulo, texto] = clasificarError(res.status, data.detail, 'dni');
                // El detalle del backend suele ser genérico; el mensaje del DNI
                // concreto es más útil para el usuario.
                const mensaje = res.status === 404
                    ? `No se encontraron datos para el DNI ${dniVal}. Verifica que el número esté bien escrito e intenta de nuevo.`
                    : texto;
                avisar(mensaje, tipo, titulo);
                return;
            }

            const isEmpty =
                (!data.nombres || data.nombres === 'N/A') &&
                (!data.apellidos || data.apellidos === 'N/A N/A' || data.apellidos === 'N/A') &&
                (!data.genero || data.genero === 'NO ESPECIFICADO');
            if (isEmpty) {
                avisar(
                    `No se encontraron datos para el DNI ${dniVal}. Puede estar mal escrito o no estar registrado en RENIEC.`,
                    'warning',
                    'Sin resultados',
                );
                return;
            }
            setResult(data);
            if (token) refreshUser();
        } catch (e) {
            const msg = getQueryErrorMessage(e);
            if (e?.name === 'TimeoutError') {
                avisar(
                    'La consulta tardó demasiado en responder. El proveedor puede estar saturado; intenta de nuevo en un momento.',
                    'warning',
                    'La consulta expiró',
                );
            } else if (/captcha|turnstile/i.test(msg)) {
                avisar(
                    'La verificación de seguridad expiró. Repite la consulta para que aparezca de nuevo.',
                    'warning',
                    'Verificación vencida',
                );
            } else {
                avisar(msg, 'error', 'No se pudo completar la consulta');
                if (e.message?.includes('Regístrate')) openWelcomeModal();
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
                const [tipo, titulo, texto] = clasificarError(res.status, data.detail, 'name');
                avisar(texto, tipo, titulo);
                return;
            }

            const lista = Array.isArray(data) ? data : (data.resultados || []);
            if (lista.length === 0) {
                avisar(
                    'No se encontró ninguna persona con esos nombres. Prueba con menos apellidos o revisa la ortografía.',
                    'warning',
                    'Sin resultados',
                );
                return;
            }

            setNameResults(lista);
            setDownloadUrl(data.archivo_url || null);
            setTotalResults(data.total_count || lista.length);
        } catch (e) {
            const msg = getQueryErrorMessage(e);
            if (e?.name === 'TimeoutError') {
                avisar(
                    'La búsqueda por nombre tardó demasiado. Intenta de nuevo o prueba con menos apellidos.',
                    'warning',
                    'La búsqueda expiró',
                );
            } else {
                avisar(msg, 'error', 'No se pudo completar la búsqueda');
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
