// ─── Timezone helpers (Lima/Peru) ────────────────────────────────────────────
const LIMA_DATE_OPTS = {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
};
const LIMA_TIME_OPTS = {
    timeZone: 'America/Lima',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
};

export function formatLimaDate(dateStr) {
    if (!dateStr) return '-';
    try {
        return new Date(dateStr).toLocaleDateString('es-PE', LIMA_DATE_OPTS);
    } catch { return '-'; }
}

export function formatLimaTime(dateStr) {
    if (!dateStr) return '-';
    try {
        return new Date(dateStr).toLocaleTimeString('es-PE', LIMA_TIME_OPTS);
    } catch { return '-'; }
}

// ─── Auth header helper ───────────────────────────────────────────────────────
export function authHeaders() {
    const token = localStorage.getItem('token');
    return { 'Authorization': `Bearer ${token}` };
}

export function authJsonHeaders() {
    return { ...authHeaders(), 'Content-Type': 'application/json' };
}
