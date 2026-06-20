import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { useLoading } from '../context/LoadingContext';
import { useCreditCosts } from '../hooks/useCredits';
import AlertModal from './AlertModal';
import HelpModal from './HelpModal';
import { toast } from 'sonner';

// ─── Option definitions ───────────────────────────────────────────────────────
const TELEFONO_OPTIONS = [
    {
        id: 'numeros_dni',
        title: 'Ver Números de un DNI',
        icon: 'phone_in_talk',
        badge: 'PREMIUM',
        badgeColor: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
        iconBg: 'bg-blue-600',
        credits: 2,
        inputLabel: 'Ingresa el DNI a consultar',
        inputPlaceholder: 'Ej: 72345678',
        inputMaxLen: 8,
        actionLabel: 'Consultar',
        desc: 'Obtén todos los números asociados a un DNI.',
        helpDesc: 'Esta opción permite listar todos los números de teléfono móvil que están registrados bajo la titularidad de un número de DNI específico.',
        helpDetails: [
            'Todos los números asociados',
            'Operadora de cada línea',
            'Plan y período de activación',
        ],
    },
    {
        id: 'titular_numero',
        title: 'Consulta Titular del Número',
        icon: 'contact_phone',
        badge: 'PREMIUM',
        badgeColor: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300',
        iconBg: 'bg-violet-600',
        credits: 2,
        inputLabel: 'Ingresa el número de celular',
        inputPlaceholder: 'Ej: 987654321',
        inputMaxLen: 9,
        actionLabel: 'Consultar',
        desc: 'Identifica al titular legal de cualquier número.',
        helpDesc: 'Permite identificar el nombre completo y número de DNI del propietario legal de un número de teléfono móvil en Perú.',
        helpDetails: [
            'Nombre completo del titular',
            'DNI asociado',
            'Datos de registro y vigencia',
        ],
    },
    {
        id: 'verificador_op',
        title: 'Verificador de Operadora',
        icon: 'cell_tower',
        badge: 'GRATIS',
        badgeColor: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
        iconBg: 'bg-amber-500',
        credits: 0,
        inputLabel: 'Ingresa el número de celular',
        inputPlaceholder: 'Ej: 987654321',
        inputMaxLen: 9,
        actionLabel: 'Verificar',
        desc: 'Verifica la operadora actual de un número.',
        helpDesc: 'Consulta rápida para saber a qué empresa operadora (Movistar, Claro, Entel, Bitel) pertenece actualmente un número de celular.',
        helpDetails: [
            'Movistar, Claro, Entel, Bitel',
            'Resultado inmediato',
            'Sin costo alguno de créditos',
        ],
    },
];

// ─── Operator colors ──────────────────────────────────────────────────────────
const OPERATOR_STYLES = {
    ENTEL: { bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800', title: 'text-blue-700 dark:text-blue-300', dot: 'bg-blue-500' },
    CLARO: { bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800', title: 'text-red-700 dark:text-red-300', dot: 'bg-red-500' },
    MOVISTAR: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-800', title: 'text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500' },
    BITEL: { bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800', title: 'text-amber-700 dark:text-amber-300', dot: 'bg-amber-500' },
    DEFAULT: { bg: 'bg-slate-50 dark:bg-slate-800', border: 'border-slate-200 dark:border-slate-700', title: 'text-slate-700 dark:text-slate-300', dot: 'bg-slate-400' },
};

function getOperatorStyle(op) {
    if (!op) return OPERATOR_STYLES.DEFAULT;
    const u = op.toUpperCase();
    for (const key of Object.keys(OPERATOR_STYLES)) {
        if (u.includes(key)) return OPERATOR_STYLES[key];
    }
    return OPERATOR_STYLES.DEFAULT;
}

// ─── Strip Telegram markdown formatting from a string ────────────────────────
function stripMd(s) {
    return s
        .replace(/\*\*/g, '')           // **bold**
        .replace(/__/g, '')             // __underline__
        .replace(/`/g, '')             // `code`
        .replace(/~~/g, '')            // ~~strikethrough~~
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // [text](url) → text
}

// ─── Parse raw bot text into line entries ─────────────────────────────────────
// Bot format (may contain Telegram markdown formatting):
//   ❰ KING DATA ❱ ➣ **TELÉFONOS - DNI 1/1** 「PREMIUM」
//   **- LÍNEA 1**
//   • **TELÉFONO** ➣ `968500799`
//   • **OPERADOR** ➣ TELEFÓNICA DEL PERU SAA (MOVISTAR)
//   • **PLAN** ➣ PREPAGO
//   • **PERIODO** ➣ 01/06/2023 00:00
//   • **CORREO** ➣ —
function parseTelpUnified(rawText) {
    if (!rawText) return [];
    const entries = [];
    let current = null;

    let globalTitular = '';
    let globalDni = '';
    let globalOperador = '';

    const lines = rawText.split('\n').map(l => stripMd(l).trim()).filter(Boolean);

    const extract = (line, keyword = '') => {
        const m = line.match(/[➔▶➣➺]\s*(.+)$/);
        if (m) return m[1].trim();
        const m2 = line.match(/:\s*(.+)$/);
        if (m2) return m2[1].trim();
        if (keyword) {
            const regex = new RegExp(`^${keyword}\\s+(.*)$`, 'i');
            const m3 = line.match(regex);
            if (m3) return m3[1].trim();
        }
        return '';
    };

    const norm = (l) => l.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    const isEmpty = (v) => !v || v === '?' || v === '-' || v === '—';

    for (const line of lines) {
        const n = norm(line);

        if (n.includes('KING DATA') || n.includes('DATTATOMMY') || n.includes('TELEFONOS PREMIUM') || n.includes('SHIELDGRAM DB') || n.includes('REGISTROS:') || n.includes('ENCONTRADOS:') || n.includes('SITEX DATA') || n.includes('OSIPTEL') || n.includes('DETALLE DE LINEAS') || n.includes('SALDO:') || n.includes('CONSULTOR:') || n.includes('=================================') || n.includes('LINEAS ENCONTRADAS') || n.includes('RESULTADOS') || n.includes('CUENTA:') || n.includes('USUARIO:') || n.includes('TELEFONIA')) continue;

        // Catch global operator if it's on its own line (🟢 ENTEL, 🔵 MOVISTAR, etc)
        if ((n.includes('ENTEL') || n.includes('MOVISTAR') || n.includes('CLARO') || n.includes('BITEL') || n.includes('WIN')) && !line.includes('|') && !line.includes('│')) {
            if (!n.includes('OPERADOR')) {
                globalOperador = line.replace(/[^a-zA-Z\s]/g, '').trim();
                if (current) current.operador = globalOperador;
                continue;
            }
        }

        // Globals for new OSIPTEL/SERUM formats
        if (n.includes('TITULAR')) {
            const v = extract(line);
            if (!isEmpty(v)) globalTitular = v;
            if (current) current.titular = isEmpty(v) ? '' : v;
            continue;
        } else if (n.includes('DNI') || n.includes('DOC')) {
            const v = extract(line);
            if (!isEmpty(v)) globalDni = v;
            if (current) current.dni = v;
            continue;
        }

        // Start a new entry when we see TELÉFONO or NÚMERO (Old Format)
        if ((n.includes('TELEFONO') || n.includes('NUMERO')) && (n.includes('➣') || n.includes('➺') || n.includes(':'))) {
            if (current) entries.push(current);
            const val = extract(line);
            current = { numero: val, telefono: val, titular: globalTitular, dni: globalDni, operador: globalOperador };
            continue;
        }

        // Start a new entry for OSIPTEL or SERUM format (➟ 968500799 | MOVISTAR) or (❌ 928669585 │ S/N │ 202601)
        if ((n.includes('TELEFONO') || n.includes('NUMERO')) && (n.includes('➔') || n.includes('▶') || n.includes(':'))) {
            if (current) entries.push(current);
            const val = extract(line, n.includes('TELEFONO') ? 'TELEFONO' : 'NUMERO');
            current = { numero: val, telefono: val, titular: globalTitular, dni: globalDni, operador: globalOperador };
            continue;
        }

        if (!current && (n.includes('TELEFONO') || n.includes('NUMERO')) && n.match(/\d{9}/)) {
            if (current) entries.push(current);
            const val = extract(line, n.includes('TELEFONO') ? 'TELEFONO' : 'NUMERO') || line.match(/\d{9}/)[0];
            current = { numero: val, telefono: val, titular: globalTitular, dni: globalDni, operador: globalOperador };
            continue;
        }

        if (line.includes('|') || line.includes('│')) {
            if (current) entries.push(current);
            const parts = line.replace(/[➟➠➡•❌]/g, '').split(/\||│/).map(x => x.trim());
            const num = parts[0] || '';
            let op = parts.length > 1 ? parts[1] : '';
            let plan = '';
            let periodo = '';

            if (globalOperador && parts.length >= 3) {
                op = globalOperador;
                plan = parts[1];
                periodo = parts[2];
            } else if (!op && globalOperador) {
                op = globalOperador;
            }

            entries.push({ numero: num, telefono: num, operador: op, plan: plan, periodo: periodo, titular: globalTitular, dni: globalDni });
            current = null;
            continue;
        }

        if (!current) continue;

        if (n.includes('OPERADOR') || n.includes('OPERADORA')) {
            current.operador = extract(line, n.includes('OPERADORA') ? 'OPERADORA' : 'OPERADOR');
        } else if (n.includes('PLAN')) {
            const v = extract(line, 'PLAN / TIPO') || extract(line, 'PLAN');
            current.plan = isEmpty(v) ? '' : v;
        } else if (n.includes('PERIODO') || n.includes('PERIDO') || n.includes('PERÍODO')) {
            current.periodo = extract(line, n.includes('PERÍODO') ? 'PERÍODO' : 'PERIODO');
        } else if (n.includes('CORREO') || n.includes('EMAIL')) {
            const v = extract(line, n.includes('CORREO') ? 'CORREO' : 'EMAIL');
            current.correo = isEmpty(v) ? '' : v;
        } else if (n.includes('VIGENCIA') || n.includes('F.')) {
            const v = extract(line, 'VIGENCIA');
            current.vigencia = isEmpty(v) ? '' : v;
        } else if (n.includes('ESTADO')) {
            const v = extract(line);
            current.estado = isEmpty(v) ? '' : v;
        }
    }

    if (current) entries.push(current);
    return entries;
}

function parseTelxResponse(rawText) {
    return parseTelpUnified(rawText);
}

// ─── Group entries by operator ────────────────────────────────────────────────
function groupByOperator(entries) {
    const groups = {};
    for (const e of entries) {
        const op = (e.operador || 'OTROS').toUpperCase();
        let key = 'OTROS';
        for (const k of ['ENTEL', 'CLARO', 'MOVISTAR', 'BITEL']) {
            if (op.includes(k)) { key = k; break; }
        }
        if (!groups[key]) groups[key] = [];
        groups[key].push(e);
    }
    // Ordered output: known operators first
    const order = ['ENTEL', 'CLARO', 'MOVISTAR', 'BITEL', 'OTROS'];
    return order.filter(k => groups[k]).map(k => ({ operator: k, entries: groups[k] }));
}

// ─── TXT content builder ──────────────────────────────────────────────────────
function buildTxt(dni, groups) {
    const SEP = '='.repeat(50);
    const lines = [`TELÉFONOS - DNI ${dni}`, SEP, ''];
    for (const g of groups) {
        lines.push(g.operator + ':', '-'.repeat(30));
        for (const e of g.entries) {
            if (e.telefono) lines.push(`TELÉFONO: ${e.telefono}`);
            if (e.operador) lines.push(`OPERADOR: ${e.operador}`);
            if (e.plan) lines.push(`PLAN: ${e.plan}`);
            if (e.periodo) lines.push(`PERIODO: ${e.periodo}`);
            if (e.correo) lines.push(`CORREO: ${e.correo || '—'}`);
            lines.push('');
        }
    }
    lines.push('', SEP, '');
    return lines.join('\n');
}

function downloadTxt(dni, groups) {
    const content = buildTxt(dni, groups);
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `telefonos_${dni}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ─── Parse raw bot text for /telp responses ────────────────────────────────
// Bot format per block:
//   CONSULTA: 928158960
//   • NÚMERO ➣ 928158960
//   • TITULAR ➣ IRVIN ANDRES ZEÑA BOCANEGRA
//   • DNI ➣ 73336073
//   • OPERADOR ➣ MOVISTAR
//   • PLAN ➣ —
//   • PERIODO ➣ 202304
//   • CORREO ➣ —
function parseTelpResponse(rawText) {
    if (!rawText) return [];
    const entries = [];
    // Split on CONSULTA: lines to get individual blocks
    const blocks = rawText.split(/(?=CONSULTA:)/i).filter(b => b.trim());

    const extract = (line) => {
        const m = line.match(/➣\s*(.+)$/);
        if (m) return m[1].trim();
        const m2 = line.match(/:\s*(.+)$/);
        return m2 ? m2[1].trim() : '';
    };

    const norm = (l) => l.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

    const isEmpty = (v) => !v || v === '—' || v === '-';

    for (const block of blocks) {
        const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
        const entry = {};
        for (const line of lines) {
            const n = norm(line);
            if (n.startsWith('CONSULTA')) continue; // header
            if (n.includes('KING DATA') || n.includes('TELEFONIA') || n.includes('「PREMIUM」')) continue;
            if ((n.includes('NUMERO') || n.includes('NÚMERO')) && !n.includes('CONSULTA')) {
                entry.numero = extract(line);
            } else if (n.includes('TITULAR')) {
                const v = extract(line);
                entry.titular = isEmpty(v) ? '' : v;
            } else if (n.includes('DNI') && !n.includes('TITULAR')) {
                entry.dni = extract(line);
            } else if (n.includes('OPERADOR') || n.includes('OPERADORA')) {
                entry.operador = extract(line);
            } else if (n.includes('PLAN')) {
                const v = extract(line);
                entry.plan = isEmpty(v) ? '' : v;
            } else if (n.includes('PERIODO') || n.includes('PERIDO')) {
                entry.periodo = extract(line);
            } else if (n.includes('CORREO') || n.includes('EMAIL')) {
                const v = extract(line);
                entry.correo = isEmpty(v) ? '' : v;
            }
        }
        if (entry.numero || entry.dni) entries.push(entry);
    }
    return entries;
}

function buildTxtTelp(phone, groups) {
    const SEP = '='.repeat(50);
    const lines = [`INFORMACIÓN DE LÍNEA: ${phone}`, SEP, ''];
    for (const g of groups) {
        lines.push(g.operator + ':', '-'.repeat(30));
        for (const e of g.entries) {
            if (e.numero) lines.push(`NÚMERO: ${e.numero}`);
            if (e.titular) lines.push(`TITULAR: ${e.titular}`);
            if (e.dni) lines.push(`DNI: ${e.dni}`);
            if (e.operador) lines.push(`OPERADOR: ${e.operador}`);
            if (e.plan) lines.push(`PLAN: ${e.plan}`);
            if (e.periodo) lines.push(`PERIODO: ${e.periodo}`);
            if (e.correo) lines.push(`CORREO: ${e.correo}`);
            lines.push('');
        }
    }
    lines.push('', SEP, '');
    return lines.join('\n');
}

function downloadTxtTelp(phone, groups) {
    const content = buildTxtTelp(phone, groups);
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `telp_${phone}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ─── Parse raw bot text for /cel responses (Consulta Titular) ────────────────
// Bot format:
//   ❰ #𝑲𝑰𝑵𝑮 𝑫𝑨𝑻𝑨 ❱ ➣ CONSULTA TITULAR - NUMERO 「STANDARD」
//   • CONSULTA ➣ 910041336
//   🔎 RESULTADOS: 1
//   • OPERADORA ➣ MOVISTAR
//   • TITULAR ➣ CARLOS MAURICIO ROJAS GONZALES
//   • DNI ➣ 74397603
//   • TELÉFONO ➣ 910041336
//   • PLAN/TIPO ➣ CONTROL / RV PLAN ADICIONAL S/39.9 II
//   • F. VIGENCIA ➣ 31/05/2024 00:00:00
//   • CORREO ➣ —
function parseCelResponse(rawText) {
    return parseTelpUnified(rawText);
}

function buildTxtTitular(phone, entries) {
    const SEP = '='.repeat(50);
    const lines = [`CONSULTA TITULAR: ${phone}`, SEP, ''];
    for (const e of entries) {
        if (e.operador) lines.push(`OPERADORA: ${e.operador}`);
        if (e.titular) lines.push(`TITULAR: ${e.titular}`);
        if (e.dni) lines.push(`DNI: ${e.dni}`);
        if (e.telefono) lines.push(`TELÉFONO: ${e.telefono}`);
        if (e.plan) lines.push(`PLAN: ${e.plan}`);
        if (e.periodo) lines.push(`PERÍODO: ${e.periodo}`);
        if (e.correo) lines.push(`CORREO: ${e.correo}`);
        lines.push('');
    }
    lines.push('', SEP, '');
    return lines.join('\n');
}

function downloadTxtTitular(phone, entries) {
    const content = buildTxtTitular(phone, entries);
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `titular_${phone}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ErrorModal removed in favor of standardized AlertModal

// ─── Input modal (per option) ─────────────────────────────────────────────────
function TelefonoModal({ option, onClose, onSubmit, loading }) {
    const [inputValue, setInputValue] = useState('');
    const isValid = inputValue.length === option.inputMaxLen;
    const autoSearchTriggered = useRef(false);

    const handleInputChange = (e) => {
        const val = e.target.value.replace(/\D/g, '');
        if (val.length <= option.inputMaxLen) setInputValue(val);
    };

    // Auto-search when input reaches required length
    useEffect(() => {
        if (isValid && !loading && !autoSearchTriggered.current) {
            autoSearchTriggered.current = true;
            onSubmit(inputValue);
        }
        if (!isValid) {
            autoSearchTriggered.current = false;
        }
    }, [inputValue, isValid, loading, onSubmit]);

    return createPortal(
        <AnimatePresence>
            <motion.div
                key="backdrop"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
                onClick={(e) => { if (e.target === e.currentTarget && !loading) onClose(); }}
            >
                <motion.div
                    key="modal"
                    initial={{ opacity: 0, scale: 0.95, y: 16 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 16 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-2xl max-w-sm w-full border border-slate-200 dark:border-slate-700"
                >
                    <div className="flex items-center gap-3 mb-5">
                        <div className={`w-10 h-10 rounded-xl ${option.iconBg} flex items-center justify-center text-white shrink-0`}>
                            <span className="material-icons-round">{option.icon}</span>
                        </div>
                        <div>
                            <p className="font-bold text-slate-900 dark:text-white text-sm leading-tight">{option.title}</p>
                        </div>
                    </div>

                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                        {option.inputLabel}
                    </label>
                    <input
                        type="text"
                        inputMode="numeric"
                        maxLength={option.inputMaxLen}
                        placeholder={option.inputPlaceholder}
                        value={inputValue}
                        onChange={handleInputChange}
                        disabled={loading}
                        autoFocus
                        onKeyDown={(e) => { if (e.key === 'Enter' && isValid) onSubmit(inputValue); }}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-violet-500 mb-4 disabled:opacity-50"
                    />

                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            disabled={loading}
                            className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm disabled:opacity-50"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={() => onSubmit(inputValue)}
                            disabled={!isValid || loading}
                            className={`flex-1 py-3 rounded-xl font-bold text-white text-sm transition-all shadow-lg flex items-center justify-center gap-2 ${!isValid || loading
                                ? 'bg-slate-300 dark:bg-slate-700 cursor-not-allowed'
                                : `${option.iconBg} hover:brightness-110 active:scale-95`
                                }`}
                        >
                            {loading ? (
                                <>
                                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                    </svg>
                                    Consultando...
                                </>
                            ) : (
                                <>
                                    <span className="material-icons-round text-sm">search</span>
                                    {option.actionLabel}
                                </>
                            )}
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>,
        document.body
    );
}

// ─── Result view: números de un DNI (mismo diseño que Familiares Texto) ────────
function NumerosResult({ dni, rawText, onBack }) {
    const entries = parseTelxResponse(rawText);
    const groups = groupByOperator(entries);
    const total = entries.length;
    const [hasDownloaded, setHasDownloaded] = useState(false);
    const [showExitModal, setShowExitModal] = useState(false);
    const [exitCountDown, setExitCountDown] = useState(5);

    useEffect(() => {
        let timer;
        if (showExitModal && exitCountDown > 0) {
            timer = setTimeout(() => setExitCountDown(c => c - 1), 1000);
        }
        return () => clearTimeout(timer);
    }, [showExitModal, exitCountDown]);

    const handleBackClick = () => {
        if (!hasDownloaded) {
            setShowExitModal(true);
            setExitCountDown(5);
        } else {
            onBack();
        }
    };

    const handleDownload = () => {
        downloadTxt(dni, groups);
        setHasDownloaded(true);
    };

    const handleCopy = (text) => {
        if (!text) return;
        navigator.clipboard.writeText(text)
            .then(() => toast.success("Copiado al portapapeles"))
            .catch(() => toast.error("Error al copiar"));
    };

    return (
        <div className="w-full max-w-5xl mx-auto p-4 flex flex-col items-center max-h-[85dvh]">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl shadow-xl overflow-hidden border border-slate-200 dark:border-slate-800">
                <div className="p-6 sm:p-8 flex flex-col items-center relative">
                    {/* Back button (Arrow) */}
                    <button
                        onClick={handleBackClick}
                        className="absolute top-6 left-6 w-10 h-10 flex items-center justify-center shrink-0 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all hover:scale-110 active:scale-95"
                        title="Volver"
                    >
                        <span className="material-icons-round">arrow_back</span>
                    </button>

                    {/* Success icon + title */}
                    <div className="w-16 h-16 rounded-full bg-blue-500 flex items-center justify-center text-white mb-4 shadow-lg shadow-blue-500/30">
                        <span className="material-icons-round text-4xl">phone_in_talk</span>
                    </div>
                    <h3 className="text-xl font-bold text-blue-600 dark:text-blue-400 mb-1 tracking-wide">
                        Números del DNI {dni}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                        {total} número{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}
                    </p>

                    {/* Data rows (scrollable) */}
                    <div className="w-full mb-6">
                        {groups.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-600 p-8 flex flex-col items-center gap-2">
                                <span className="material-icons-round text-slate-300 dark:text-slate-600 text-4xl">phone_disabled</span>
                                <p className="text-sm font-semibold text-slate-400">No se encontraron números para este DNI</p>
                            </div>
                        ) : (
                            <div className="space-y-5 max-h-[85dvh] overflow-y-auto pr-1">
                                {groups.map((g) => {
                                    const style = getOperatorStyle(g.operator);
                                    return (
                                        <div key={g.operator}>
                                            {/* Operator section label */}
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                                                <span className={`text-xs font-extrabold uppercase tracking-widest px-2 flex items-center gap-1.5 ${style.title}`}>
                                                    <span className={`w-2 h-2 rounded-full inline-block ${style.dot}`} />
                                                    {g.operator}
                                                    <span className="text-slate-400 font-normal">({g.entries.length})</span>
                                                </span>
                                                <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                                            </div>
                                            {/* Entry cards */}
                                            <div className="space-y-2.5">
                                                {g.entries.map((e, idx) => (
                                                    <div key={idx} className={`rounded-xl border p-4 ${style.bg} ${style.border}`}>
                                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 text-sm">
                                                            {e.telefono && <div><span className="text-slate-400 text-xs">Teléfono</span><div className="flex items-center gap-1.5"><p className="font-bold text-slate-800 dark:text-white font-mono">{e.telefono}</p><button onClick={() => handleCopy(e.telefono)} className="text-slate-400 hover:text-blue-500 transition-colors active:scale-90" title="Copiar"><span className="material-icons-round text-xs">content_copy</span></button></div></div>}
                                                            {e.operador && <div><span className="text-slate-400 text-xs">Operador</span><p className="font-bold text-slate-800 dark:text-white">{e.operador}</p></div>}
                                                            {e.plan && <div><span className="text-slate-400 text-xs">Plan</span><p className="font-bold text-slate-800 dark:text-white">{e.plan}</p></div>}
                                                            {e.periodo && <div><span className="text-slate-400 text-xs">Periodo</span><p className="font-bold text-slate-800 dark:text-white">{e.periodo}</p></div>}
                                                            {e.correo && <div><span className="text-slate-400 text-xs">Correo</span><p className="font-bold text-slate-800 dark:text-white truncate">{e.correo}</p></div>}
                                                            {e.dni && <div><span className="text-slate-400 text-xs">DNI</span><div className="flex items-center gap-1.5"><p className="font-bold text-slate-800 dark:text-white font-mono">{e.dni}</p><button onClick={() => handleCopy(e.dni)} className="text-slate-400 hover:text-blue-500 transition-colors active:scale-90" title="Copiar"><span className="material-icons-round text-xs">content_copy</span></button></div></div>}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* TXT download — full width, same style as Familiares */}
                        <button
                            onClick={handleDownload}
                            className="mt-4 w-full py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 hover:scale-[1.02]"
                        >
                            <span className="material-icons-round">download</span>
                            Descargar telefonos_{dni}.txt
                        </button>
                    </div>

                    {/* Back button */}
                    <button
                        onClick={handleBackClick}
                        className="w-full py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
                    >
                        <span className="material-icons-round">arrow_back</span>
                        Volver
                    </button>
                </div>
            </motion.div>

            {/* Exit Modal (5s countdown — same as Familiares) */}
            {showExitModal && createPortal(
                <AnimatePresence>
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-2xl max-w-sm w-full border border-slate-200 dark:border-slate-700"
                        >
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                                    <span className="material-icons-round text-amber-600 dark:text-amber-400">warning</span>
                                </div>
                                <h3 className="font-bold text-slate-900 dark:text-white text-base">¿Salir sin descargar?</h3>
                            </div>
                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                                No has descargado el resultado todavía. Si sales, perderás los datos y <strong>no se reembolsarán los créditos</strong>.
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowExitModal(false)}
                                    className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm"
                                >
                                    Quedarse
                                </button>
                                <button
                                    disabled={exitCountDown > 0}
                                    onClick={onBack}
                                    className={`flex-1 py-3 rounded-xl font-bold text-white text-sm transition-all flex items-center justify-center gap-2 ${exitCountDown > 0 ? 'bg-slate-400 cursor-not-allowed' : 'bg-red-500 hover:bg-red-600'}`}
                                >
                                    {exitCountDown > 0 ? (
                                        <><span className="material-icons-round text-base animate-spin">sync</span>Salir ({exitCountDown}s)</>
                                    ) : (
                                        <><span className="material-icons-round text-base">exit_to_app</span>Sí, salir</>
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                </AnimatePresence>,
                document.body
            )}
        </div>
    );
}

function Field({ label, value, icon }) {
    if (!value) return null;
    return (
        <div className="flex flex-col gap-0.5">
            <span className="text-xs text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <span className="material-icons-round text-xs">{icon}</span>{label}
            </span>
            <span className="font-semibold text-slate-800 dark:text-white text-sm truncate">{value}</span>
        </div>
    );
}

// ─── InfoLineaResult — same design as NumerosResult ────────────────────────
function InfoLineaResult({ phone, rawText, onBack }) {
    const entries = parseTelpResponse(rawText);
    // Reuse groupByOperator (groups by .operador field)
    const groupEntries = entries.map(e => ({ ...e, telefono: e.numero })); // alias for groupByOperator
    const groups = groupByOperator(groupEntries).map(g => ({
        ...g,
        entries: g.entries.map(e => ({ ...e, numero: e.telefono })), // restore campo
    }));
    const total = entries.length;
    const [hasDownloaded, setHasDownloaded] = useState(false);
    const [showExitModal, setShowExitModal] = useState(false);
    const [exitCountDown, setExitCountDown] = useState(5);

    useEffect(() => {
        let timer;
        if (showExitModal && exitCountDown > 0) {
            timer = setTimeout(() => setExitCountDown(c => c - 1), 1000);
        }
        return () => clearTimeout(timer);
    }, [showExitModal, exitCountDown]);

    const handleBackClick = () => {
        if (!hasDownloaded) {
            setShowExitModal(true);
            setExitCountDown(5);
        } else {
            onBack();
        }
    };

    const handleDownload = () => {
        downloadTxtTelp(phone, groups);
        setHasDownloaded(true);
    };

    const handleCopy = (text, type) => {
        if (!text) return;
        navigator.clipboard.writeText(text)
            .then(() => toast.success(`${type} copiado con éxito`))
            .catch(() => toast.error("Error al copiar"));
    };

    return (
        <div className="w-full max-w-5xl mx-auto p-4 flex flex-col items-center max-h-[85dvh]">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: "easeOut" }}
                className="w-full max-w-4xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl rounded-[2rem] shadow-2xl overflow-hidden border border-white/20 dark:border-slate-700/50 relative">

                {/* Decorative background glow */}
                <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[80%] h-60 bg-emerald-500/20 dark:bg-emerald-500/10 blur-[80px] rounded-full pointer-events-none"></div>

                <div className="p-5 sm:p-8 flex flex-col items-center relative z-10">
                    {/* Back button (Arrow) */}
                    <button
                        onClick={handleBackClick}
                        className="absolute top-4 left-4 sm:top-6 sm:left-6 w-10 h-10 flex items-center justify-center shrink-0 rounded-full bg-slate-100/80 dark:bg-slate-800/80 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all hover:scale-105 active:scale-95 backdrop-blur-md"
                        title="Volver"
                    >
                        <span className="material-icons-round text-[20px]">arrow_back</span>
                    </button>

                    {/* Icon + title */}
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white mb-4 shadow-lg shadow-emerald-500/40 ring-4 ring-white dark:ring-slate-900 relative mt-2 sm:mt-0">
                        <div className="absolute inset-0 bg-white/20 rounded-full blur-sm"></div>
                        <span className="material-icons-round text-2xl sm:text-3xl relative z-10">sim_card</span>
                    </div>

                    <h3 className="text-xl sm:text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-400 dark:from-emerald-400 dark:to-teal-300 mb-1 tracking-tight text-center">
                        Línea {phone}
                    </h3>
                    <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 mb-6 bg-slate-100 dark:bg-slate-800/50 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-700/50">
                        {total} registro{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}
                    </p>

                    {/* Data rows */}
                    <div className="w-full mb-2">
                        {groups.length === 0 ? (
                            <div className="rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/20 p-12 flex flex-col items-center gap-4">
                                <div className="w-16 h-16 rounded-2xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
                                    <span className="material-icons-round text-slate-400 dark:text-slate-500 text-4xl">sim_card_alert</span>
                                </div>
                                <p className="text-base font-semibold text-slate-500 dark:text-slate-400">No se encontraron datos para este número</p>
                            </div>
                        ) : (
                            <div className="space-y-6 max-h-[85dvh] overflow-y-auto pr-1 sm:pr-2 custom-scrollbar">
                                {groups.map((g) => {
                                    const style = getOperatorStyle(g.operator);
                                    return (
                                        <div key={g.operator}>
                                            {/* Operator section label */}
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="h-px flex-1 bg-gradient-to-r from-transparent to-slate-200 dark:to-slate-700/50" />
                                                <span className={`text-[10px] sm:text-xs font-black uppercase tracking-[0.15em] px-3 py-1 rounded-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50 flex items-center gap-1.5 ${style.title} shadow-sm backdrop-blur-md`}>
                                                    <span className={`w-2 h-2 rounded-full inline-block ${style.dot} shadow-sm`} />
                                                    {g.operator}
                                                    <span className="text-slate-400 font-semibold tracking-normal ml-0.5">({g.entries.length})</span>
                                                </span>
                                                <div className="h-px flex-1 bg-gradient-to-l from-transparent to-slate-200 dark:to-slate-700/50" />
                                            </div>

                                            {/* Entry cards */}
                                            <div className="space-y-3">
                                                {g.entries.map((e, idx) => (
                                                    <div key={idx} className={`relative rounded-2xl border p-4 sm:p-5 ${style.bg} ${style.border} shadow-sm hover:shadow-md transition-all group overflow-hidden`}>
                                                        <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                                                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 relative z-10">
                                                            {e.titular && (
                                                                <div className="col-span-2 lg:col-span-4 mb-1">
                                                                    <div className="flex items-center gap-1.5 mb-0.5">
                                                                        <span className="material-icons-round text-slate-400 text-[14px]">person</span>
                                                                        <span className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-widest">Titular de la línea</span>
                                                                    </div>
                                                                    <p className="font-extrabold text-slate-900 dark:text-white text-base sm:text-lg leading-tight">{e.titular}</p>
                                                                </div>
                                                            )}

                                                            {e.numero && (
                                                                <div
                                                                    onClick={() => handleCopy(e.numero, 'Número')}
                                                                    className="bg-white/60 dark:bg-slate-900/40 p-2.5 sm:p-3 rounded-xl border border-white/40 dark:border-slate-700/30 group/copy hover:border-emerald-300 dark:hover:border-emerald-700/50 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/20 transition-all cursor-pointer active:scale-95"
                                                                    title="Copiar número"
                                                                >
                                                                    <div className="flex justify-between items-start mb-0.5">
                                                                        <span className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Número</span>
                                                                        <span className="material-icons-round text-[14px] text-slate-300 dark:text-slate-600 opacity-0 group-hover/copy:opacity-100 group-hover/copy:text-emerald-500 transition-all">content_copy</span>
                                                                    </div>
                                                                    <p className="font-bold text-slate-800 dark:text-white text-sm sm:text-base font-mono tracking-tight">{e.numero}</p>
                                                                </div>
                                                            )}

                                                            {e.dni && (
                                                                <div
                                                                    onClick={() => handleCopy(e.dni, 'DNI')}
                                                                    className="bg-white/60 dark:bg-slate-900/40 p-2.5 sm:p-3 rounded-xl border border-white/40 dark:border-slate-700/30 group/copy hover:border-emerald-300 dark:hover:border-emerald-700/50 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/20 transition-all cursor-pointer active:scale-95"
                                                                    title="Copiar DNI"
                                                                >
                                                                    <div className="flex justify-between items-start mb-0.5">
                                                                        <span className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Documento</span>
                                                                        <span className="material-icons-round text-[14px] text-slate-300 dark:text-slate-600 opacity-0 group-hover/copy:opacity-100 group-hover/copy:text-emerald-500 transition-all">content_copy</span>
                                                                    </div>
                                                                    <p className="font-bold text-slate-800 dark:text-white text-sm sm:text-base font-mono tracking-tight">{e.dni}</p>
                                                                </div>
                                                            )}

                                                            {e.plan && (
                                                                <div className="bg-white/60 dark:bg-slate-900/40 p-2.5 sm:p-3 rounded-xl border border-white/40 dark:border-slate-700/30">
                                                                    <span className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider block mb-0.5">Plan / Tipo</span>
                                                                    <p className="font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm truncate">{e.plan}</p>
                                                                </div>
                                                            )}

                                                            {e.periodo && (
                                                                <div className="bg-white/60 dark:bg-slate-900/40 p-2.5 sm:p-3 rounded-xl border border-white/40 dark:border-slate-700/30">
                                                                    <span className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider block mb-0.5">Período</span>
                                                                    <p className="font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">{e.periodo}</p>
                                                                </div>
                                                            )}

                                                            {e.correo && e.correo !== 'NO REGISTRA' && (
                                                                <div className="col-span-2 lg:col-span-4 bg-white/60 dark:bg-slate-900/40 p-2.5 sm:p-3 rounded-xl border border-white/40 dark:border-slate-700/30 flex items-center gap-2">
                                                                    <span className="material-icons-round text-slate-400 text-[16px]">email</span>
                                                                    <div className="overflow-hidden">
                                                                        <span className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider block leading-none mb-0.5">Correo Electrónico</span>
                                                                        <p className="font-medium text-slate-700 dark:text-slate-200 text-xs sm:text-sm truncate">{e.correo}</p>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        <div className="flex flex-col sm:flex-row gap-3 mt-6">
                            {/* Back button */}
                            <button
                                onClick={handleBackClick}
                                className="flex-1 py-3 sm:py-4 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-700/50 bg-white/50 dark:bg-slate-800/30 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-all flex items-center justify-center gap-2 backdrop-blur-sm text-sm sm:text-base"
                            >
                                <span className="material-icons-round text-[18px] sm:text-[20px]">arrow_back</span>
                                Volver a buscar
                            </button>

                            {/* TXT download */}
                            <button
                                onClick={handleDownload}
                                className="flex-1 py-3 sm:py-4 rounded-xl sm:rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 text-sm sm:text-base"
                            >
                                <span className="material-icons-round text-[18px] sm:text-[20px]">download</span>
                                Descargar resultados
                            </button>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Exit Modal (5s countdown) */}
            {showExitModal && createPortal(
                <AnimatePresence>
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-2xl max-w-sm w-full border border-slate-200 dark:border-slate-700"
                        >
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                                    <span className="material-icons-round text-amber-600 dark:text-amber-400">warning</span>
                                </div>
                                <h3 className="font-bold text-slate-900 dark:text-white text-base">¿Salir sin descargar?</h3>
                            </div>
                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                                No has descargado el resultado todavía. Si sales, perderás los datos y <strong>no se reembolsarán los créditos</strong>.
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowExitModal(false)}
                                    className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm"
                                >
                                    Quedarse
                                </button>
                                <button
                                    disabled={exitCountDown > 0}
                                    onClick={onBack}
                                    className={`flex-1 py-3 rounded-xl font-bold text-white text-sm transition-all flex items-center justify-center gap-2 ${exitCountDown > 0 ? 'bg-slate-400 cursor-not-allowed' : 'bg-red-500 hover:bg-red-600'}`}
                                >
                                    {exitCountDown > 0 ? (
                                        <><span className="material-icons-round text-base animate-spin">sync</span>Salir ({exitCountDown}s)</>
                                    ) : (
                                        <><span className="material-icons-round text-base">exit_to_app</span>Sí, salir</>
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                </AnimatePresence>,
                document.body
            )}
        </div>
    );
}

// ─── AuthRequiredModal — shown when user is not logged in ─────────────────────
function AuthRequiredModal({ onClose }) {
    return createPortal(
        <AnimatePresence>
            <motion.div
                key="auth-backdrop"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
                onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
            >
                <motion.div
                    key="auth-modal"
                    initial={{ scale: 0.9, opacity: 0, y: 16 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-2xl max-w-sm w-full border border-slate-200 dark:border-slate-700 text-center"
                >
                    <div className="w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto mb-4">
                        <span className="material-icons-round text-blue-500 text-3xl">lock</span>
                    </div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-base mb-2">
                        Debes iniciar sesión
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
                        Inicia sesión o crea una cuenta para acceder a esta función.
                    </p>
                    <button
                        onClick={onClose}
                        className="w-full py-3 rounded-xl font-bold text-white bg-blue-500 hover:bg-blue-600 transition-colors"
                    >
                        Cerrar
                    </button>
                </motion.div>
            </motion.div>
        </AnimatePresence>,
        document.body
    );
}

// ─── Operator logo mapping from /logos folder ────────────────────────────────
const OPERATOR_LOGOS = {
    CLARO: '/logos/Claro.png',
    MOVISTAR: '/logos/Movistar.png',
    ENTEL: '/logos/Entel.png',
    BITEL: '/logos/bitel.png',
};

function getOperatorLogo(operador) {
    if (!operador) return null;
    const u = operador.toUpperCase();
    for (const [key, path] of Object.entries(OPERATOR_LOGOS)) {
        if (u.includes(key)) return path;
    }
    return null;
}

function buildTxtVerificador(data) {
    const SEP = '='.repeat(50);
    const lines = [`VERIFICADOR DE OPERADORA`, SEP, ''];
    if (data.telefono) lines.push(`TELÉFONO: ${data.telefono}`);
    if (data.operador) lines.push(`OPERADOR: ${data.operador}`);
    if (data.empresa) lines.push(`EMPRESA: ${data.empresa}`);
    if (data.ruc) lines.push(`RUC: ${data.ruc}`);
    if (data.fecha) lines.push(`FECHA: ${data.fecha}`);
    lines.push('', SEP, '');
    return lines.join('\n');
}

function downloadTxtVerificador(data) {
    const content = buildTxtVerificador(data);
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `operadora_${data.telefono}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ─── VerificadorResult component ──────────────────────────────────────────────
function VerificadorResult({ data, onBack }) {
    const style = getOperatorStyle(data.operador);
    const logoSrc = getOperatorLogo(data.operador);
    const [hasDownloaded, setHasDownloaded] = useState(false);
    const [showExitModal, setShowExitModal] = useState(false);
    const [exitCountDown, setExitCountDown] = useState(5);

    useEffect(() => {
        let timer;
        if (showExitModal && exitCountDown > 0) {
            timer = setTimeout(() => setExitCountDown(c => c - 1), 1000);
        }
        return () => clearTimeout(timer);
    }, [showExitModal, exitCountDown]);

    const handleBackClick = () => {
        if (!hasDownloaded) {
            setShowExitModal(true);
            setExitCountDown(5);
        } else {
            onBack();
        }
    };

    const handleDownload = () => {
        downloadTxtVerificador(data);
        setHasDownloaded(true);
    };

    return (
        <div className="w-full max-w-5xl mx-auto p-4 flex flex-col items-center max-h-[85dvh]">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-xl overflow-hidden border border-slate-200 dark:border-slate-800"
            >
                <div className="p-6 sm:p-8 flex flex-col items-center">

                    {/* Operator Logo or fallback icon */}
                    <div className="mb-4 flex items-center justify-center">
                        {logoSrc ? (
                            <img
                                src={logoSrc}
                                alt={data.operador}
                                className="h-20 object-contain drop-shadow-md"
                                onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                            />
                        ) : null}
                        <div
                            className={`w-20 h-20 rounded-full ${style.bg} border-2 ${style.border} flex items-center justify-center ${logoSrc ? 'hidden' : 'flex'}`}
                            style={logoSrc ? { display: 'none' } : {}}
                        >
                            <span className="material-icons-round text-4xl text-slate-500">cell_tower</span>
                        </div>
                    </div>

                    {/* Data card */}
                    <div className={`w-full rounded-2xl border p-5 mb-6 ${style.bg} ${style.border}`}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6">
                            {data.telefono && (
                                <div>
                                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-0.5">Teléfono</p>
                                    <p className="font-bold text-slate-800 dark:text-white font-mono text-lg">{data.telefono}</p>
                                </div>
                            )}
                            {data.operador && (
                                <div>
                                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-0.5">Operador</p>
                                    <p className={`font-bold text-lg ${style.title}`}>{data.operador}</p>
                                </div>
                            )}
                            {data.empresa && (
                                <div className="sm:col-span-2">
                                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-0.5">Empresa</p>
                                    <p className="font-semibold text-slate-800 dark:text-white text-sm">{data.empresa}</p>
                                </div>
                            )}
                            {data.ruc && (
                                <div>
                                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-0.5">RUC</p>
                                    <p className="font-semibold text-slate-800 dark:text-white font-mono">{data.ruc}</p>
                                </div>
                            )}
                            {data.fecha && (
                                <div>
                                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-0.5">Fecha</p>
                                    <p className="font-semibold text-slate-800 dark:text-white">{data.fecha}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Download button */}
                    <button
                        onClick={handleDownload}
                        className="w-full py-3 rounded-xl bg-amber-500 text-white font-bold hover:bg-amber-600 transition-all shadow-lg shadow-amber-500/30 flex items-center justify-center gap-2 hover:scale-[1.02] mb-3"
                    >
                        <span className="material-icons-round">download</span>
                        Descargar operadora_{data.telefono}.txt
                    </button>

                    {/* Back button */}
                    <button
                        onClick={handleBackClick}
                        className="w-full py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
                    >
                        <span className="material-icons-round">arrow_back</span>
                        Volver
                    </button>
                </div>
            </motion.div>

            {/* Exit Modal */}
            {showExitModal && createPortal(
                <AnimatePresence>
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-2xl max-w-sm w-full border border-slate-200 dark:border-slate-700"
                        >
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                                    <span className="material-icons-round text-amber-600">warning</span>
                                </div>
                                <h3 className="font-bold text-slate-900 dark:text-white text-base">¿Salir sin descargar?</h3>
                            </div>
                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                                No has descargado el resultado. Si sales perderás los datos.
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowExitModal(false)}
                                    className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm"
                                >
                                    Quedarse
                                </button>
                                <button
                                    disabled={exitCountDown > 0}
                                    onClick={onBack}
                                    className={`flex-1 py-3 rounded-xl font-bold text-white text-sm transition-all flex items-center justify-center gap-2 ${exitCountDown > 0 ? 'bg-slate-400 cursor-not-allowed' : 'bg-red-500 hover:bg-red-600'}`}
                                >
                                    {exitCountDown > 0 ? (
                                        <><span className="material-icons-round text-base animate-spin">sync</span>Salir ({exitCountDown}s)</>
                                    ) : (
                                        <><span className="material-icons-round text-base">exit_to_app</span>Sí, salir</>
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                </AnimatePresence>,
                document.body
            )}
        </div>
    );
}

// ─── TitularResult — same design as InfoLineaResult (violet theme) ────────────
function TitularResult({ phone, rawText, onBack }) {
    const entries = parseCelResponse(rawText);
    const total = entries.length;
    const [hasDownloaded, setHasDownloaded] = useState(false);
    const [showExitModal, setShowExitModal] = useState(false);
    const [exitCountDown, setExitCountDown] = useState(5);

    useEffect(() => {
        let timer;
        if (showExitModal && exitCountDown > 0) {
            timer = setTimeout(() => setExitCountDown(c => c - 1), 1000);
        }
        return () => clearTimeout(timer);
    }, [showExitModal, exitCountDown]);

    const handleBackClick = () => {
        if (!hasDownloaded) {
            setShowExitModal(true);
            setExitCountDown(5);
        } else {
            onBack();
        }
    };

    const handleDownload = () => {
        downloadTxtTitular(phone, entries);
        setHasDownloaded(true);
    };

    const handleCopy = (text, type) => {
        if (!text) return;
        navigator.clipboard.writeText(text)
            .then(() => toast.success(`${type} copiado con éxito`))
            .catch(() => toast.error("Error al copiar"));
    };

    return (
        <div className="w-full max-w-5xl mx-auto p-4 flex flex-col items-center max-h-[85dvh]">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: "easeOut" }}
                className="w-full max-w-4xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl rounded-[2rem] shadow-2xl overflow-hidden border border-white/20 dark:border-slate-700/50 relative">

                {/* Decorative background glow */}
                <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[80%] h-60 bg-violet-500/20 dark:bg-violet-500/10 blur-[80px] rounded-full pointer-events-none"></div>

                <div className="p-5 sm:p-8 flex flex-col items-center relative z-10">
                    {/* Back button (Arrow) */}
                    <button
                        onClick={handleBackClick}
                        className="absolute top-4 left-4 sm:top-6 sm:left-6 w-10 h-10 flex items-center justify-center shrink-0 rounded-full bg-slate-100/80 dark:bg-slate-800/80 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all hover:scale-105 active:scale-95 backdrop-blur-md"
                        title="Volver"
                    >
                        <span className="material-icons-round text-[20px]">arrow_back</span>
                    </button>

                    {/* Icon + title */}
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-tr from-violet-600 to-fuchsia-500 flex items-center justify-center text-white mb-4 shadow-lg shadow-violet-500/40 ring-4 ring-white dark:ring-slate-900 relative mt-2 sm:mt-0">
                        <div className="absolute inset-0 bg-white/20 rounded-full blur-sm"></div>
                        <span className="material-icons-round text-2xl sm:text-3xl relative z-10">contact_phone</span>
                    </div>

                    <h3 className="text-xl sm:text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-fuchsia-500 dark:from-violet-400 dark:to-fuchsia-300 mb-1 tracking-tight text-center">
                        Titular del {phone}
                    </h3>
                    <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 mb-6 bg-slate-100 dark:bg-slate-800/50 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-700/50">
                        {total} registro{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}
                    </p>

                    {/* Data rows */}
                    <div className="w-full mb-2">
                        {entries.length === 0 ? (
                            <div className="rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/20 p-12 flex flex-col items-center gap-4">
                                <div className="w-16 h-16 rounded-2xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
                                    <span className="material-icons-round text-slate-400 dark:text-slate-500 text-4xl">person_off</span>
                                </div>
                                <p className="text-base font-semibold text-slate-500 dark:text-slate-400">No se encontraron datos para este número</p>
                            </div>
                        ) : (
                            <div className="space-y-4 max-h-[85dvh] overflow-y-auto pr-1 sm:pr-2 custom-scrollbar">
                                {entries.map((e, idx) => {
                                    const style = getOperatorStyle(e.operador);
                                    return (
                                        <div key={idx} className={`relative rounded-2xl border p-4 sm:p-5 ${style.bg} ${style.border} shadow-sm hover:shadow-md transition-all group overflow-hidden`}>
                                            <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 relative z-10">
                                                {e.titular && (
                                                    <div className="col-span-2 lg:col-span-4 mb-1">
                                                        <div className="flex items-center gap-1.5 mb-0.5">
                                                            <span className="material-icons-round text-slate-400 text-[14px]">person</span>
                                                            <span className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-widest">Titular de la línea</span>
                                                        </div>
                                                        <p className="font-extrabold text-slate-900 dark:text-white text-base sm:text-lg leading-tight">{e.titular}</p>
                                                    </div>
                                                )}

                                                {e.dni && (
                                                    <div
                                                        onClick={() => handleCopy(e.dni, 'DNI')}
                                                        className="bg-white/60 dark:bg-slate-900/40 p-2.5 sm:p-3 rounded-xl border border-white/40 dark:border-slate-700/30 group/copy hover:border-violet-300 dark:hover:border-violet-700/50 hover:bg-violet-50/50 dark:hover:bg-violet-900/20 transition-all cursor-pointer active:scale-95"
                                                        title="Copiar DNI"
                                                    >
                                                        <div className="flex justify-between items-start mb-0.5">
                                                            <span className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Documento</span>
                                                            <span className="material-icons-round text-[14px] text-slate-300 dark:text-slate-600 opacity-0 group-hover/copy:opacity-100 group-hover/copy:text-violet-500 transition-all">content_copy</span>
                                                        </div>
                                                        <p className="font-bold text-slate-800 dark:text-white text-sm sm:text-base font-mono tracking-tight">{e.dni}</p>
                                                    </div>
                                                )}

                                                {e.telefono && (
                                                    <div
                                                        onClick={() => handleCopy(e.telefono, 'Teléfono')}
                                                        className="bg-white/60 dark:bg-slate-900/40 p-2.5 sm:p-3 rounded-xl border border-white/40 dark:border-slate-700/30 group/copy hover:border-violet-300 dark:hover:border-violet-700/50 hover:bg-violet-50/50 dark:hover:bg-violet-900/20 transition-all cursor-pointer active:scale-95"
                                                        title="Copiar Teléfono"
                                                    >
                                                        <div className="flex justify-between items-start mb-0.5">
                                                            <span className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Teléfono</span>
                                                            <span className="material-icons-round text-[14px] text-slate-300 dark:text-slate-600 opacity-0 group-hover/copy:opacity-100 group-hover/copy:text-violet-500 transition-all">content_copy</span>
                                                        </div>
                                                        <p className="font-bold text-slate-800 dark:text-white text-sm sm:text-base font-mono tracking-tight">{e.telefono}</p>
                                                    </div>
                                                )}

                                                {e.operador && (
                                                    <div className="bg-white/60 dark:bg-slate-900/40 p-2.5 sm:p-3 rounded-xl border border-white/40 dark:border-slate-700/30 flex flex-col justify-center">
                                                        <span className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider block mb-0.5">Operadora</span>
                                                        <div className="flex items-center gap-1.5">
                                                            <span className={`w-2 h-2 rounded-full ${style.dot} shadow-sm`}></span>
                                                            <p className={`font-black uppercase tracking-wide ${style.title} text-xs sm:text-sm leading-none`}>{e.operador}</p>
                                                        </div>
                                                    </div>
                                                )}

                                                {e.plan && (
                                                    <div className="bg-white/60 dark:bg-slate-900/40 p-2.5 sm:p-3 rounded-xl border border-white/40 dark:border-slate-700/30">
                                                        <span className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider block mb-0.5">Plan / Tipo</span>
                                                        <p className="font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm truncate">{e.plan}</p>
                                                    </div>
                                                )}

                                                {e.periodo && (
                                                    <div className="bg-white/60 dark:bg-slate-900/40 p-2.5 sm:p-3 rounded-xl border border-white/40 dark:border-slate-700/30">
                                                        <span className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider block mb-0.5">Período</span>
                                                        <p className="font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">{e.periodo}</p>
                                                    </div>
                                                )}

                                                {e.correo && e.correo !== 'NO REGISTRA' && (
                                                    <div className="col-span-2 lg:col-span-4 bg-white/60 dark:bg-slate-900/40 p-2.5 sm:p-3 rounded-xl border border-white/40 dark:border-slate-700/30 flex items-center gap-2">
                                                        <span className="material-icons-round text-slate-400 text-[16px]">email</span>
                                                        <div className="overflow-hidden">
                                                            <span className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider block leading-none mb-0.5">Correo Electrónico</span>
                                                            <p className="font-medium text-slate-700 dark:text-slate-200 text-xs sm:text-sm truncate">{e.correo}</p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        <div className="flex flex-col sm:flex-row gap-3 mt-6">
                            {/* Back button */}
                            <button
                                onClick={handleBackClick}
                                className="flex-1 py-3 sm:py-4 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-700/50 bg-white/50 dark:bg-slate-800/30 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-all flex items-center justify-center gap-2 backdrop-blur-sm text-sm sm:text-base"
                            >
                                <span className="material-icons-round text-[18px] sm:text-[20px]">arrow_back</span>
                                Volver a buscar
                            </button>

                            {/* TXT download */}
                            <button
                                onClick={handleDownload}
                                className="flex-1 py-3 sm:py-4 rounded-xl sm:rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-bold transition-all shadow-lg shadow-violet-500/20 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 text-sm sm:text-base"
                            >
                                <span className="material-icons-round text-[18px] sm:text-[20px]">download</span>
                                Descargar resultados
                            </button>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Exit Modal (5s countdown) */}
            {showExitModal && createPortal(
                <AnimatePresence>
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-2xl max-w-sm w-full border border-slate-200 dark:border-slate-700"
                        >
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                                    <span className="material-icons-round text-amber-600 dark:text-amber-400">warning</span>
                                </div>
                                <h3 className="font-bold text-slate-900 dark:text-white text-base">¿Salir sin descargar?</h3>
                            </div>
                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                                No has descargado el resultado todavía. Si sales, perderás los datos y <strong>no se reembolsarán los créditos</strong>.
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowExitModal(false)}
                                    className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm"
                                >
                                    Quedarse
                                </button>
                                <button
                                    disabled={exitCountDown > 0}
                                    onClick={onBack}
                                    className={`flex-1 py-3 rounded-xl font-bold text-white text-sm transition-all flex items-center justify-center gap-2 ${exitCountDown > 0 ? 'bg-slate-400 cursor-not-allowed' : 'bg-red-500 hover:bg-red-600'}`}
                                >
                                    {exitCountDown > 0 ? (
                                        <><span className="material-icons-round text-base animate-spin">sync</span>Salir ({exitCountDown}s)</>
                                    ) : (
                                        <><span className="material-icons-round text-base">exit_to_app</span>Sí, salir</>
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                </AnimatePresence>,
                document.body
            )}
        </div>
    );
}

// ─── Placeholder modal for other non-implemented options ──────────────────────
function PlaceholderModal({ option, onClose }) {
    const [inputValue, setInputValue] = useState('');
    const [loading, setLoading] = useState(false);
    const [done, setDone] = useState(false);
    const isValid = inputValue.length === option.inputMaxLen;

    const handleInputChange = (e) => {
        const val = e.target.value.replace(/\D/g, '');
        if (val.length <= option.inputMaxLen) setInputValue(val);
    };

    return createPortal(
        <AnimatePresence>
            <motion.div
                key="ph-backdrop"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
                onClick={(e) => { if (e.target === e.currentTarget && !loading) onClose(); }}
            >
                <motion.div
                    key="ph-modal"
                    initial={{ opacity: 0, scale: 0.95, y: 16 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-2xl max-w-sm w-full border border-slate-200 dark:border-slate-700"
                >
                    <div className="flex items-center gap-3 mb-5">
                        <div className={`w-10 h-10 rounded-xl ${option.iconBg} flex items-center justify-center text-white shrink-0`}>
                            <span className="material-icons-round">{option.icon}</span>
                        </div>
                        <div>
                            <p className="font-bold text-slate-900 dark:text-white text-sm leading-tight">{option.title}</p>
                        </div>
                    </div>

                    {!done ? (
                        <>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                {option.inputLabel}
                            </label>
                            <input
                                type="text"
                                inputMode="numeric"
                                maxLength={option.inputMaxLen}
                                placeholder={option.inputPlaceholder}
                                value={inputValue}
                                onChange={handleInputChange}
                                disabled={loading}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-violet-500 mb-4"
                            />
                            <div className="flex gap-3">
                                <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm">
                                    Cancelar
                                </button>
                                <button
                                    disabled={!isValid || loading}
                                    onClick={() => { setLoading(true); setTimeout(() => { setLoading(false); setDone(true); }, 1800); }}
                                    className={`flex-1 py-3 rounded-xl font-bold text-white text-sm transition-all shadow-lg flex items-center justify-center gap-2 ${!isValid || loading ? 'bg-slate-300 dark:bg-slate-700 cursor-not-allowed' : `${option.iconBg} hover:brightness-110 active:scale-95`}`}
                                >
                                    {loading ? <><svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>Consultando...</> : <><span className="material-icons-round text-sm">search</span>{option.actionLabel}</>}
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="text-center space-y-4">
                            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-600">
                                <span className="material-icons-round text-slate-300 dark:text-slate-600 text-4xl">construction</span>
                                <p className="text-sm font-semibold text-slate-500 mt-2">Vista previa — Datos de ejemplo</p>
                                <p className="text-xs text-slate-400">Integración backend próximamente</p>
                            </div>
                            <button onClick={onClose} className="w-full py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                Cerrar
                            </button>
                        </div>
                    )}
                </motion.div>
            </motion.div>
        </AnimatePresence>,
        document.body
    );
}



// ─── Main component ───────────────────────────────────────────────────────────
export default function TelefonoDNI() {
    const { user, openLoginModal } = useAuth();
    const { loading, showLoading, hideLoading } = useLoading();
    const { getCost } = useCreditCosts();
    const [activeModal, setActiveModal] = useState(null);
    
    // session storage initialized states
    const [result, setResult] = useState(() => {
        const saved = sessionStorage.getItem('telefono_result');
        return saved ? JSON.parse(saved) : null;
    });
    const [infoLineaResult, setInfoLineaResult] = useState(() => {
        const saved = sessionStorage.getItem('telefono_infolinea');
        return saved ? JSON.parse(saved) : null;
    });
    const [operadoraResult, setOperadoraResult] = useState(() => {
        const saved = sessionStorage.getItem('telefono_operadora');
        return saved ? JSON.parse(saved) : null;
    });
    const [titularResult, setTitularResult] = useState(() => {
        const saved = sessionStorage.getItem('telefono_titular');
        return saved ? JSON.parse(saved) : null;
    });
    
    const [alert, setAlert] = useState({ isOpen: false, type: 'info', message: '' });

    const location = useLocation();
    const hasAutoTriggered = useRef(false);

    useEffect(() => {
        if (result) sessionStorage.setItem('telefono_result', JSON.stringify(result));
        else sessionStorage.removeItem('telefono_result');
    }, [result]);

    useEffect(() => {
        if (infoLineaResult) sessionStorage.setItem('telefono_infolinea', JSON.stringify(infoLineaResult));
        else sessionStorage.removeItem('telefono_infolinea');
    }, [infoLineaResult]);

    useEffect(() => {
        if (operadoraResult) sessionStorage.setItem('telefono_operadora', JSON.stringify(operadoraResult));
        else sessionStorage.removeItem('telefono_operadora');
    }, [operadoraResult]);

    useEffect(() => {
        if (titularResult) sessionStorage.setItem('telefono_titular', JSON.stringify(titularResult));
        else sessionStorage.removeItem('telefono_titular');
    }, [titularResult]);



    const selectedOption = TELEFONO_OPTIONS.find(o => o.id === activeModal);
    const isNumerosDni = activeModal === 'numeros_dni';
    const isInfoLinea = activeModal === 'info_linea';
    const isVerificadorOp = activeModal === 'verificador_op';
    const isTitularNumero = activeModal === 'titular_numero';

    const handleSubmitNumerosDNI = async (dni) => {
        if (!user) { openLoginModal(); return; }
        setActiveModal(null);
        showLoading();
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                setAlert({ isOpen: true, type: 'warning', message: 'Debes iniciar sesión para usar esta función.' });
                hideLoading();
                return;
            }
            const res = await fetch('/api/telefono/numeros-dni', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ dni }),
            });
            const data = await res.json();

            if (!res.ok) {
                if (res.status === 402) {
                    const detail = data.detail || {};
                    setAlert({ isOpen: true, type: 'insufficient_credits', message: detail.message || 'No tienes suficientes créditos para esta consulta.' });
                } else if (res.status === 404) {
                    setAlert({ isOpen: true, type: 'warning', message: typeof data.detail === 'string' ? data.detail : '「❌️」Sin Resultados. Verifique los datos e intente nuevamente.' });
                } else if (res.status === 429) {
                    setAlert({ isOpen: true, type: 'error', message: data.detail || 'Demasiadas solicitudes. Espere un momento.' });
                } else {
                    setAlert({ isOpen: true, type: 'error', message: data.detail || 'Error al consultar. Intente nuevamente.' });
                }
                hideLoading();
                return;
            }

            setResult({ dni: data.dni, rawText: data.raw_text });
        } catch {
            setAlert({ isOpen: true, type: 'error', message: 'Error de conexión. Verifique su internet e intente nuevamente.' });
        } finally {
            hideLoading();
        }
    };

    const handleSubmitInfoLinea = async (phone) => {
        if (!user) { openLoginModal(); return; }
        setActiveModal(null);
        showLoading();
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                setAlert({ isOpen: true, type: 'warning', message: 'Debes iniciar sesión para usar esta función.' });
                hideLoading();
                return;
            }
            const res = await fetch('/api/telefono/info-linea', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ phone }),
            });
            const data = await res.json();

            if (!res.ok) {
                if (res.status === 404) {
                    setAlert({ isOpen: true, type: 'warning', message: 'No se encontraron resultados para este número. Verifique el número e intente nuevamente.' });
                } else if (res.status === 422) {
                    setAlert({ isOpen: true, type: 'warning', message: 'No se encontraron datos. Intente nuevamente en 10 segundos.' });
                } else if (res.status === 402) {
                    const detail = data.detail || {};
                    setAlert({ isOpen: true, type: 'warning', message: detail.message || 'Créditos insuficientes.' });
                } else if (res.status === 429) {
                    setAlert({ isOpen: true, type: 'error', message: data.detail || 'Demasiadas solicitudes. Espere un momento.' });
                } else {
                    setAlert({ isOpen: true, type: 'error', message: data.detail || 'Error al consultar. Intente nuevamente.' });
                }
                hideLoading();
                return;
            }

            setInfoLineaResult({ phone: data.phone, rawText: data.raw_text });
        } catch {
            setAlert({ isOpen: true, type: 'error', message: 'Error de conexión. Verifique su internet e intente nuevamente.' });
        } finally {
            hideLoading();
        }
    };

    const handleSubmitVerificador = async (phone) => {
        if (!user) { openLoginModal(); return; }
        setActiveModal(null);
        showLoading();
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                setAlert({ isOpen: true, type: 'warning', message: 'Debes iniciar sesión para usar esta función.' });
                hideLoading();
                return;
            }
            const res = await fetch('/api/telefono/verificador-operadora', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ phone })
            });
            const data = await res.json();
            if (!res.ok) {
                setAlert({ isOpen: true, type: 'warning', message: data.detail || 'No se pudo verificar la operadora.' });
                hideLoading();
                return;
            }
            setOperadoraResult(data);
        } catch {
            setAlert({ isOpen: true, type: 'error', message: 'Error de conexión.' });
        } finally {
            hideLoading();
        }
    };

    const handleSubmitTitular = async (phone) => {
        if (!user) { openLoginModal(); return; }
        setActiveModal(null);
        showLoading();
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                setAlert({ isOpen: true, type: 'warning', message: 'Debes iniciar sesión para usar esta función.' });
                hideLoading();
                return;
            }
            const [res] = await Promise.all([
                fetch('/api/telefono/titular', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                    },
                    body: JSON.stringify({ phone }),
                }),
                new Promise(resolve => setTimeout(resolve, 3000)),
            ]);
            const data = await res.json();

            if (!res.ok) {
                if (res.status === 404) {
                    setAlert({ isOpen: true, type: 'warning', message: 'No se encontraron datos para este número. Verifique el número e intente nuevamente.' });
                } else if (res.status === 422) {
                    setAlert({ isOpen: true, type: 'warning', message: 'No se encontraron datos. Verifique el número e intente nuevamente en 10 o 15 segundos.' });
                } else if (res.status === 402) {
                    const detail = data.detail || {};
                    setAlert({ isOpen: true, type: 'warning', message: detail.message || 'Créditos insuficientes.' });
                } else if (res.status === 429) {
                    setAlert({ isOpen: true, type: 'error', message: data.detail || 'Demasiadas solicitudes. Espere un momento.' });
                } else {
                    setAlert({ isOpen: true, type: 'error', message: data.detail || 'Error al consultar. Intente nuevamente.' });
                }
                hideLoading();
                return;
            }

            setTitularResult({ phone: data.phone, rawText: data.raw_text });
        } catch {
            setAlert({ isOpen: true, type: 'error', message: 'Error de conexión. Verifique su internet e intente nuevamente.' });
        } finally {
            hideLoading();
        }
    };

    const [helpModal, setHelpModal] = useState({ isOpen: false, title: '', description: '', details: [] });

    // Auto-trigger from state (e.g. from UserHistory)
    useEffect(() => {
        if (location.state?.autoDni && location.state?.autoOption && !hasAutoTriggered.current) {
            const opt = TELEFONO_OPTIONS.find(o => o.id === location.state.autoOption);
            if (opt) {
                hasAutoTriggered.current = true;
                const value = location.state.autoDni;
                if (opt.id === 'numeros_dni') {
                    handleSubmitNumerosDNI(value);
                } else if (opt.id === 'info_linea') {
                    handleSubmitInfoLinea(value);
                } else if (opt.id === 'verificador_op') {
                    handleSubmitVerificador(value);
                } else if (opt.id === 'titular_numero') {
                    handleSubmitTitular(value);
                }
                
                // Clear state so it doesn't re-trigger on refresh
                window.history.replaceState({}, document.title);
            }
        }
    }, [location.state]);

    const openHelp = (e, opt) => {
        e.stopPropagation();
        setHelpModal({
            isOpen: true,
            title: opt.title,
            description: opt.helpDesc,
            details: opt.helpDetails
        });
    };

    const handleBack = () => {
        setResult(null);
        setInfoLineaResult(null);
        setOperadoraResult(null);
        setTitularResult(null);
        sessionStorage.removeItem('telefono_result');
        sessionStorage.removeItem('telefono_infolinea');
        sessionStorage.removeItem('telefono_operadora');
        sessionStorage.removeItem('telefono_titular');
    };

    // Show result views
    if (result) {
        return <NumerosResult dni={result.dni} rawText={result.rawText} onBack={handleBack} />;
    }
    if (infoLineaResult) {
        return <InfoLineaResult phone={infoLineaResult.phone} rawText={infoLineaResult.rawText} onBack={handleBack} />;
    }
    if (operadoraResult) {
        return <VerificadorResult data={operadoraResult} onBack={handleBack} />;
    }
    if (titularResult) {
        return <TitularResult phone={titularResult.phone} rawText={titularResult.rawText} onBack={handleBack} />;
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-5xl mx-auto"
        >
            <HelpModal
                isOpen={helpModal.isOpen}
                onClose={() => setHelpModal({ ...helpModal, isOpen: false })}
                title={helpModal.title}
                description={helpModal.description}
                details={helpModal.details}
            />

            {/* Options grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {TELEFONO_OPTIONS.map((opt) => (
                    <div
                        key={opt.id}
                        onClick={() => {
                            setActiveModal(opt.id);
                        }}
                        className="group relative bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 hover:shadow-xl hover:border-violet-400 dark:hover:border-violet-500 transition-all text-left flex flex-col gap-3 hover:-translate-y-1 min-h-[140px] cursor-pointer"
                    >
                        <button
                            onClick={(e) => openHelp(e, opt)}
                            className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center transition-colors z-20 border border-slate-100 dark:border-slate-700"
                            aria-label="¿Qué hace esta opción?"
                        >
                            <span className="material-icons-round text-slate-400 dark:text-slate-500 text-base">help_outline</span>
                        </button>

                        <div className="flex items-start justify-between">
                            <div className={`w-12 h-12 rounded-xl ${opt.iconBg} flex items-center justify-center text-white shadow-lg shrink-0 group-hover:scale-110 transition-transform`}>
                                <span className="material-icons-round text-2xl">{opt.icon}</span>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-0.5">{opt.title}</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2">{opt.desc}</p>
                        </div>

                        <div className="mt-auto pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-bold text-xs">
                                <span className="material-icons-round text-sm">toll</span>
                                {opt.credits === 0
                                    ? 'Gratis'
                                    : `${getCost(opt.id) ?? opt.credits} crédito${(getCost(opt.id) ?? opt.credits) !== 1 ? 's' : ''}`}
                            </div>
                            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-slate-400 group-hover:text-violet-500 dark:group-hover:text-violet-400 transition-colors font-black">
                                Consultar
                                <span className="material-icons-round text-xs">arrow_forward</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Input modal */}
            {activeModal && selectedOption && (
                isNumerosDni ? (
                    <TelefonoModal
                        option={selectedOption}
                        onClose={() => setActiveModal(null)}
                        onSubmit={handleSubmitNumerosDNI}
                        loading={loading}
                    />
                ) : isInfoLinea ? (
                    <TelefonoModal
                        option={selectedOption}
                        onClose={() => setActiveModal(null)}
                        onSubmit={handleSubmitInfoLinea}
                        loading={loading}
                    />
                ) : isVerificadorOp ? (
                    <TelefonoModal
                        option={selectedOption}
                        onClose={() => setActiveModal(null)}
                        onSubmit={handleSubmitVerificador}
                        loading={loading}
                    />
                ) : isTitularNumero ? (
                    <TelefonoModal
                        option={selectedOption}
                        onClose={() => setActiveModal(null)}
                        onSubmit={handleSubmitTitular}
                        loading={loading}
                    />
                ) : (
                    <PlaceholderModal
                        option={selectedOption}
                        onClose={() => setActiveModal(null)}
                    />
                )
            )}



            {/* Shared modals */}
            <AlertModal
                isOpen={alert.isOpen}
                type={alert.type}
                message={alert.message}
                onClose={() => setAlert({ ...alert, isOpen: false })}
            />
        </motion.div>
    );
}
