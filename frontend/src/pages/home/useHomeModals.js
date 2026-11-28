import { useState, useRef } from 'react';

/**
 * Estado y lógica de los modales de Home: selector de tipo de consulta,
 * captcha y alertas.
 *
 * Vivían dentro de cada vista de Home (lista de nombres, resultado, buscador),
 * así que al cambiar de vista se desmontaban a mitad de flujo: elegir un
 * nombre de la lista abría el captcha, se lanzaba la búsqueda y el modal
 * desaparecía sin que el usuario viera nada. Al centralizarlos aquí se
 * mantienen montados durante todo el proceso.
 *
 * Uso:  const modals = useHomeModals({ user, onSearch, onSearchByName, onPremiumBlocked });
 */
export function useHomeModals({ user, onSearch, onSearchByName, onPremiumBlocked, alertState, alertMeta }) {
    const [optionModal, setOptionModal] = useState({ isOpen: false, targetUser: null });

    // Alertas: Home es dueño del estado y lo comparte con useSearch para que
    // exista una SOLA fuente. Antes estaba duplicado y los errores de búsqueda
    // se escribían en un estado que ningún modal leía (fallaban en silencio).
    const [localAlert, setLocalAlert] = useState(null);
    const [alertMessage, setAlertMessage] = alertState || [localAlert, setLocalAlert];
    const [localType, setLocalType] = useState('info');
    const [localTitle, setLocalTitle] = useState(null);
    const alertType = alertMeta?.type ?? localType;
    const alertTitle = alertMeta?.title ?? localTitle;

    const [showCaptcha, setShowCaptcha] = useState(false);
    const [captchaToken, setCaptchaToken] = useState(null);
    // Cloudflare emite un token por instancia: una key nueva por apertura
    // evita reutilizar el widget ya resuelto (que no vuelve a llamar a
    // onSuccess y deja el modal en blanco).
    const [captchaKey, setCaptchaKey] = useState(0);
    const pendingRef = useRef(null);

    /**
     * Muestra una alerta con su tipo y título.
     *
     * `type`: success | error | warning | info | insufficient_credits.
     * Cada caso tiene su icono, color y título en AlertModal.
     */
    const alert = (message, type = 'info', title = null) => {
        (alertMeta?.setType || setLocalType)(type);
        (alertMeta?.setTitle || setLocalTitle)(title);
        setAlertMessage(message);
    };

    const clearAlert = () => {
        setAlertMessage(null);
        (alertMeta?.setTitle || setLocalTitle)(null);
        (alertMeta?.setType || setLocalType)('info');
    };

    const openCaptcha = (pendiente) => {
        pendingRef.current = pendiente;
        setCaptchaToken(null);
        setCaptchaKey((k) => k + 1);
        setShowCaptcha(true);
    };

    const closeCaptcha = () => {
        setShowCaptcha(false);
        pendingRef.current = null;
    };

    /**
     * Éxito del captcha: ejecuta la búsqueda que quedó pendiente.
     *
     * La búsqueda pendiente puede ser por DNI ({value, searchType}) o por
     * nombre ({type:'name', n, apP, apM}); antes se llamaba siempre a onSearch
     * con `value`, así que la búsqueda por nombre recibía undefined y no
     * llegaba a ejecutarse.
     */
    const handleCaptchaSuccess = (token) => {
        setCaptchaToken(token);
        setShowCaptcha(false);
        const pendiente = pendingRef.current;
        pendingRef.current = null;
        if (!pendiente) {
            // Resolvió sin búsqueda pendiente: queda disponible para el próximo
            // envío.
            return;
        }
        if (pendiente.type === 'name') {
            onSearchByName(pendiente.n, pendiente.apP, pendiente.apM, token);
        } else {
            onSearch(pendiente.value, pendiente.searchType, token);
        }
        // Turnstile es de un solo uso: se descarta para que la siguiente
        // consulta pida uno nuevo.
        setCaptchaToken(null);
    };

    /** Abre el selector de tipo para un usuario encontrado por nombre. */
    const openOptions = (targetUser) => setOptionModal({ isOpen: true, targetUser });

    const closeOptions = () => setOptionModal((m) => ({ ...m, isOpen: false }));

    /**
     * Confirma el tipo de consulta elegido en el selector.
     *
     * Cierra el selector primero: si queda debajo, su overlay bloquea los
     * clicks del modal que se abra encima.
     */
    const confirmOption = (selectedType) => {
        const target = optionModal.targetUser;
        if (!target) return;
        const targetDni = target.documento || target.dni;
        closeOptions();

        if (selectedType === 'premium' && !user) {
            // Solo el modal de registro: mostrar además una alerta dejaba dos
            // modales encima y ninguno se podía cerrar.
            clearAlert();
            onPremiumBlocked(targetDni);
            return;
        }

        if (!user && !captchaToken) {
            openCaptcha({ value: targetDni, searchType: selectedType });
            return;
        }
        onSearch(targetDni, selectedType, captchaToken);
        setCaptchaToken(null);
    };

    return {
        optionModal, openOptions, closeOptions, confirmOption,
        alertMessage, alertType, alertTitle, alert, clearAlert,
        showCaptcha, openCaptcha, closeCaptcha,
        captchaKey, handleCaptchaSuccess, captchaToken, setCaptchaToken,
    };
}

export default useHomeModals;
