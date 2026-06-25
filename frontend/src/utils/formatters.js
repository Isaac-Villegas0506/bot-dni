/**
 * Centralized formatting utilities
 */

/**
 * Formats a date string or Date object to America/Lima timezone
 * @param {string|Date} dateInput 
 * @param {boolean} includeTime 
 * @returns {string} Formatted date
 */
export function formatDateLima(dateInput, includeTime = true) {
    if (!dateInput) return '';
    try {
        const date = new Date(dateInput);
        if (isNaN(date.getTime())) return String(dateInput);

        const options = {
            timeZone: 'America/Lima',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        };

        if (includeTime) {
            options.hour = '2-digit';
            options.minute = '2-digit';
            options.hour12 = false;
        }

        const formatter = new Intl.DateTimeFormat('es-PE', options);
        // es-PE formats like dd/mm/yyyy
        return formatter.format(date);
    } catch {
        return String(dateInput);
    }
}
