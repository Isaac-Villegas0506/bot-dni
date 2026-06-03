import { useSearchParams } from 'react-router-dom';
import { useCallback } from 'react';

/**
 * Estado de UI persistido en query params de la URL (drop-in para useState).
 *
 * Ventajas:
 *  - Compartible: copiar la URL preserva el estado
 *  - Sobrevive a recarga / navegación back-forward
 *  - No requiere localStorage ni versioning
 *
 * Usa `replace: true` para no llenar el history del browser en typeahead.
 *
 * @param {string} key — nombre del query param (mantenlo corto, "tab", "cat", "q")
 * @param {string} defaultValue — valor cuando el param no está presente
 * @returns {[string, (next: string) => void]}
 */
export function useSearchParamState(key, defaultValue = '') {
    const [params, setParams] = useSearchParams();
    const value = params.get(key) ?? defaultValue;

    const setValue = useCallback((next) => {
        const newParams = new URLSearchParams(params);
        const isDefault = next == null || next === '' || next === defaultValue;
        if (isDefault) {
            newParams.delete(key);
        } else {
            newParams.set(key, String(next));
        }
        setParams(newParams, { replace: true });
    }, [key, defaultValue, params, setParams]);

    return [value, setValue];
}
