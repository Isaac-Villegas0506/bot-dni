import { useSettings } from '../context/settingsContextValue';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useLoading } from '../context/LoadingContext';
import AlertModal from './AlertModal';
import HelpModal from './HelpModal';
import { useCreditCosts } from '../hooks/useCredits';
import { getApiUrl } from '../utils/api';
import PdfViewer from './PdfViewer';
import { OptionCard } from './ui/ConsultSurface';

// ─── option definitions (PDF first, Texto second) ───────────────────────────
const options = [
    {
        id: 'familiares_arbol_visual',
        title: 'Ver Familiares (PDF + Fotos)',
        icon: 'family_restroom',
        color: 'bg-rose-600',
        colorShadow: 'shadow-rose-500/30',
        credits: 3,
        badgeColor: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300',
        desc: 'Reporte detallado con árbol genealógico y fotos.',
        helpDesc: 'Genera un documento PDF exhaustivo que incluye el árbol genealógico completo y las fotografías de cada familiar encontrado.',
        helpDetails: [
            'Fotografías de cada familiar',
            'Árbol familiar completo',
            'Documento PDF descargable',
        ],
    },
    {
        id: 'familiares_texto',
        title: 'Ver Familiares (Texto)',
        icon: 'group',
        color: 'bg-violet-600',
        colorShadow: 'shadow-violet-500/30',
        credits: 1,
        badgeColor: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300',
        desc: 'Lista rápida de familiares en formato texto.',
        helpDesc: 'Muestra una lista simplificada en formato de texto con los nombres, apellidos y parentesco de los familiares.',
        helpDetails: [
            'Nombres y apellidos completos',
            'Relación familiar',
            'Datos básicos de cada familiar',
            'Descarga en formato TXT',
        ],
    },
];

// ─── parse raw_text from bot into labelled fields (used by PDF result view) ─────────────
// (kept for titular data display in PDF mode)
function parseRawText(raw) {
    if (!raw) return [];
    const normalize = str => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    const fieldMap = [
        { key: 'DNI', label: 'DNI', icon: 'badge' },
        { key: 'NOMBRES', label: 'Nombres', icon: 'person' },
        { key: 'APELLIDO PATERNO', label: 'Apellido Paterno', icon: 'person_outline' },
        { key: 'APELLIDO MATERNO', label: 'Apellido Materno', icon: 'person_outline' },
        { key: 'APELLIDOS', label: 'Apellidos', icon: 'person_outline' },
        { key: 'GENERO', label: 'Género', icon: 'wc' },
        { key: 'EDAD', label: 'Edad', icon: 'cake' },
        { key: 'PAGINAS', label: 'Páginas', icon: 'description' },
    ];
    const results = [];
    const lines = raw.split('\n');
    for (const { key, label, icon } of fieldMap) {
        for (const line of lines) {
            const norm = normalize(line);
            if (norm.includes(key)) {
                const m = line.match(/[➣:>➺]\s*(.+)$/);
                if (m) {
                    const val = m[1].trim();
                    results.push({ label, value: val || '—', icon });
                    break;
                }
            }
        }
    }
    return results;
}


// ─── Relation priority map (for hierarchical ordering) ───────────────────────
const RELATION_PRIORITY = [
    { label: 'Padres', priority: 1, match: ['MADRE', 'PADRE'] },
    { label: 'Hijos/as', priority: 2, match: ['HIJO', 'HIJA'] },
    { label: 'Cónyuges', priority: 3, match: ['CONYUGE', 'ESPOSO', 'ESPOSA'] },
    { label: 'Hermanos/as', priority: 4, match: ['HERMANO', 'HERMANA'] },
    { label: 'Abuelos/as', priority: 5, match: ['ABUELO', 'ABUELA'] },
    { label: 'Tíos/as', priority: 6, match: ['TIO', 'TIA', 'TÍO', 'TÍA'] },
    { label: 'Primos/as', priority: 7, match: ['PRIMO', 'PRIMA'] },
    { label: 'Sobrinos/as', priority: 8, match: ['SOBRINO', 'SOBRINA'] },
];

function getRelationGroup(relacion) {
    if (!relacion) return { label: 'Otros', priority: 8 };
    const n = relacion.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    for (const g of RELATION_PRIORITY) {
        if (g.match.some(k => n.includes(k))) return { label: g.label, priority: g.priority };
    }
    return { label: 'Otros', priority: 8 };
}

// ─── Parse full familiares texto into { titular, familiares[] } ───────────────
// KEY FIX: NOMBRES is used as the universal person-boundary, so familiar data
// can NEVER overwrite the titular (previous bug: !currentPerson guard failed
// because titular was already in currentPerson when familiares started).
function parsePersonas(raw) {
    if (!raw) return { titular: null, familiares: [] };

    const normKey = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[•➟*`ʙᴀʟᴀɴᴄᴇ]/g, '').toUpperCase().trim();
    // Fix regex to support multiple symbols like ➺, ➟, ➣, :, >, -, •, *, `
    const val = line => {
        const m = line.match(/[➣:>➺\-➟]\s*(.+)$/);
        const rawVal = m ? m[1] : line;
        return rawVal.replace(/[*`]/g, '').trim();
    };

    const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
    const all = [];       // all parsed persons in order
    let cur = null;
    let nextIsTitular = false;
    let foundTotal = 0;

    for (const line of lines) {
        const n = normKey(line);

        // Detect total found from header or footer
        const totalMatch = line.match(/hallado\s+(\d+)\s+registros/i);
        const halladosMatch = line.match(/(\d+)\s+HALLADOS/i);
        const newTotalMatch = line.match(/Total de familiares:\s+(\d+)/i);
        if (totalMatch) foundTotal = parseInt(totalMatch[1]);
        else if (halladosMatch) foundTotal = parseInt(halladosMatch[1]);
        else if (newTotalMatch) foundTotal = parseInt(newTotalMatch[1]);

        // Skip decorative and system headers
        if (n.includes('ARBOL GENEALOGICO') || n.includes('KING DATA') || n.includes('SITEX DATA') || n.includes('REPORTE COMPLETO') ||
            n.includes('BALANCE') || n.includes('CONSULTOR') || n.includes('CREDITOS') || n.includes('ILIMITADO') ||
            n.includes('ʙᴀʟᴀɴᴄᴇ') || n.includes('ɪᴠɪ') ||
            n.startsWith('#') || n.startsWith('❰') || n.startsWith('❱') || n.includes('────────') ||
            n.includes('«STANDARD»') || n.includes('«PREMIUM»') || n.includes('BY: @') || n.includes('HALLADOS')) continue;

        // Relationship header: [ PADRE ], [ MADRE ], etc.
        const bracketMatch = line.match(/\[\s*([^\]]+)\s*\]/);
        if (bracketMatch) {
            const relText = bracketMatch[1].replace(/[*`]/g, '').trim();
            // Final guard against Balance or other system info in brackets
            if (relText.toUpperCase().includes('BALANCE') || relText.includes('ʙᴀʟᴀɴᴄᴇ')) continue;

            if (cur) all.push(cur);
            cur = { relacion: relText, is_titular: false };
            continue;
        }

        // TITULAR marker line
        if (n.includes('TITULAR') && !n.includes('NOMBRE') && !n.includes('RELACI') && !n.includes('PARIENTE')) {
            nextIsTitular = true;
            continue;
        }

        // TOTAL: line — skip
        if (n.startsWith('TOTAL')) continue;

        // PARIENTE typically marks the start of a new person
        if (n.includes('PARIENTE') || n.includes('RELACION')) {
            if (cur) all.push(cur);
            cur = nextIsTitular ? { is_titular: true } : {};
            nextIsTitular = false;
            cur.relacion = val(line);
            continue;
        }

        // DNI starts a new person if we already have one (new format)
        if (n.includes('DNI') && !n.includes('APELLIDOS') && (line.includes('➟') || line.includes('➣') || line.includes('➺') || line.includes(':') || line.includes('>'))) {
            if (!cur || cur.dni) {
                if (cur) all.push(cur);
                cur = nextIsTitular ? { is_titular: true } : {};
                nextIsTitular = false;
            }
            cur.dni = val(line).replace(/[*#]/g, '').split('-')[0].trim();
            continue;
        }

        // NOMBRE / NOMBRES also starts a new person if not already in one (old format)
        if ((n.includes('NOMBRE') || n.includes('NOMBRES')) && (line.includes('➟') || line.includes('➣') || line.includes('➺') || line.includes(':') || line.includes('>'))) {
            if (!cur || cur.nombres) {
                if (cur) all.push(cur);
                cur = nextIsTitular ? { is_titular: true } : {};
                nextIsTitular = false;
            }
            cur.nombres = val(line);
            continue;
        }

        if (!cur) continue;

        if (n.includes('APELLIDO PATERNO')) {
            cur.paterno = val(line);
            cur.apellidos = `${cur.paterno || ''} ${cur.materno || ''}`.trim();
        }
        else if (n.includes('APELLIDO MATERNO')) {
            cur.materno = val(line);
            cur.apellidos = `${cur.paterno || ''} ${cur.materno || ''}`.trim();
        }
        else if (n.includes('APELLIDOS') && !n.includes('PATERNO') && !n.includes('MATERNO')) cur.apellidos = val(line);
        else if (n.includes('EDAD')) cur.edad = val(line).replace('AÑOS', '').replace('años', '').trim();
        else if (n.includes('GENERO') || n.includes('GÉNERO')) cur.genero = val(line);
        else if (n.includes('F. NAC') || n.includes('FECHA NAC')) cur.fnac = val(line);
        else if (n.includes('VERIFICACI')) cur.verificacion = val(line);
    }
    // Filter out entries that are basically empty or system junk
    if (cur && cur.nombres) all.push(cur);

    // Separate titular from familiares; sort familiares hierarchically
    const titular = all.find(p => p.is_titular) || null;
    const familiares = all
        .filter(p => !p.is_titular)
        .sort((a, b) => {
            const pa = getRelationGroup(a.relacion).priority;
            const pb = getRelationGroup(b.relacion).priority;
            return pa !== pb ? pa - pb : 0;
        });

    return { titular, familiares, foundTotal };
}

// ─── Group familiares into labelled sections ──────────────────────────────────
function groupFamiliares(familiares) {
    const groups = {};
    for (const p of familiares) {
        const g = getRelationGroup(p.relacion);
        if (!groups[g.priority]) groups[g.priority] = { label: g.label, priority: g.priority, persons: [] };
        groups[g.priority].persons.push(p);
    }
    return Object.values(groups).sort((a, b) => a.priority - b.priority);
}

// ─── Generate TXT content for download (hierarchical) ────────────────────────
function buildTxt(dni, { titular, familiares }) {
    const SEP = '='.repeat(50);
    const lines = ['ÁRBOL GENEALÓGICO', SEP, ''];

    const personBlock = (p, role) => {
        lines.push(`${role}:`);
        if (p.nombres) lines.push(`NOMBRES: ${p.nombres}`);
        if (p.apellidos) lines.push(`APELLIDOS: ${p.apellidos}`);
        if (p.dni) lines.push(`DNI: ${p.dni}`);
        if (p.edad) lines.push(`EDAD: ${p.edad}`);
        if (p.genero) lines.push(`GÉNERO: ${p.genero}`);
        if (p.fnac) lines.push(`FECHA NAC: ${p.fnac}`);
        if (p.verificacion) lines.push(`VERIFICACIÓN: ${p.verificacion}`);
        if (p.relacion && !p.is_titular) lines.push(`RELACIÓN: ${p.relacion}`);
        lines.push('');
    };

    if (titular) personBlock(titular, 'TITULAR');

    const groups = groupFamiliares(familiares);
    for (const g of groups) {
        lines.push(g.label.toUpperCase() + ':', '-'.repeat(30));
        for (const p of g.persons) personBlock(p, 'FAMILIAR');
    }
    return lines.join('\n');
}

function downloadTxtFile(dni, parsed) {
    const content = buildTxt(dni, parsed);
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `familiares_${dni}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 200);
}

// ─── force-download blob helper ───────────────────────────────────────────────
async function forceDownload(url, filename) {
    try {
        const res = await fetch(url);
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 200);
    } catch (e) {
        console.error('Download failed:', e);
    }
}

// removed LoginWallModal

// ─── Sub-component: DNI input modal (portal) ──────────────────────────────────
function SharedModals({ showInputModal, selectedOption, dni, setDni, onCancel, onGenerate }) {
    const autoSearchTriggered = useRef(false);

    // Auto-search when DNI reaches 8 digits
    useEffect(() => {
        if (showInputModal && dni.length === 8 && !autoSearchTriggered.current) {
            autoSearchTriggered.current = true;
            onGenerate();
        }
        if (dni.length !== 8) {
            autoSearchTriggered.current = false;
        }
    }, [dni, showInputModal, onGenerate]);

    if (!showInputModal || !selectedOption) return null;
    return createPortal(
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center px-[max(1rem,var(--safe-left))] pr-[max(1rem,var(--safe-right))] py-[max(1rem,var(--safe-top))] pb-[max(1rem,var(--safe-bottom))] bg-black/50 backdrop-blur-sm">
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                    className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-2xl max-w-sm w-full border border-slate-200 dark:border-slate-700"
                >
                    <div className="flex items-center gap-3 mb-5">
                        <div className={`w-10 h-10 rounded-xl ${selectedOption.color} flex items-center justify-center text-white shrink-0`}>
                            <span className="material-icons-round">{selectedOption.icon}</span>
                        </div>
                        <div>
                            <p className="font-bold text-slate-900 dark:text-white text-sm leading-tight">{selectedOption.title}</p>
                        </div>
                    </div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                        Ingresa el DNI a consultar
                    </label>
                    <input
                        type="text" inputMode="numeric" maxLength={8}
                        value={dni} onChange={e => setDni(e.target.value.replace(/\D/g, ''))}
                        onKeyDown={e => e.key === 'Enter' && onGenerate()}
                        placeholder="Ej: 72345678"
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-violet-500 mb-4"
                        autoFocus
                    />
                    <div className="flex gap-3">
                        <button onClick={onCancel}
                            className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm">
                            Cancelar
                        </button>
                        <button onClick={onGenerate} disabled={dni.length !== 8}
                            className={`flex-1 py-3 rounded-xl font-bold text-white text-sm transition-all shadow-lg flex items-center justify-center gap-2 ${dni.length === 8 ? `${selectedOption.color} hover:opacity-90 ${selectedOption.colorShadow}` : 'bg-slate-300 dark:bg-slate-700 cursor-not-allowed'}`}>
                            <span className="material-icons-round text-sm">search</span>
                            Consultar
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>,
        document.body
    );
}

export default function FamiliaresDNI() {
    const { isFeatureEnabled } = useSettings();
    const { user, openLoginModal } = useAuth();
    const { showLoading, hideLoading } = useLoading();
    const [view, setView] = useState(() => sessionStorage.getItem('familiares_view') || 'selection'); // 'selection' | 'result'
    const [alert, setAlert] = useState({ isOpen: false, type: 'info', message: '' });
    const [selectedOption, setSelectedOption] = useState(null);
    const [showInputModal, setShowInputModal] = useState(false);
    const [dni, setDni] = useState('');
    const [generatedData, setGeneratedData] = useState(() => {
        const saved = sessionStorage.getItem('familiares_data');
        return saved ? JSON.parse(saved) : null;
    });
    const [hasDownloaded, setHasDownloaded] = useState(false);

    useEffect(() => {
        sessionStorage.setItem('familiares_view', view);
    }, [view]);

    useEffect(() => {
        if (generatedData) {
            sessionStorage.setItem('familiares_data', JSON.stringify(generatedData));
        } else {
            sessionStorage.removeItem('familiares_data');
        }
    }, [generatedData]);
    
    const location = useLocation();
    const hasAutoTriggered = useRef(false);

    // Dynamic credit costs from backend
    const { getCost, canAfford } = useCreditCosts();

    // Exit modal state (with countdown)
    const [showExitModal, setShowExitModal] = useState(false);
    const [exitCountDown, setExitCountDown] = useState(5);

    useEffect(() => {
        let timer;
        if (showExitModal && exitCountDown > 0) {
            timer = setTimeout(() => setExitCountDown(c => c - 1), 1000);
        }
        return () => clearTimeout(timer);
    }, [showExitModal, exitCountDown]);

    const [helpModal, setHelpModal] = useState({ isOpen: false, title: '', description: '', details: [] });

    // Auto-trigger from state (e.g. from UserHistory)
    useEffect(() => {
        if (location.state?.autoDni && location.state?.autoOption && !hasAutoTriggered.current) {
            const opt = options.find(o => o.id === location.state.autoOption);
            if (opt) {
                hasAutoTriggered.current = true;
                setSelectedOption(opt);
                setDni(location.state.autoDni);
                setShowInputModal(true); // show modal, it will auto-trigger because DNI is 8 chars
                
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

    const handleOptionClick = (opt) => {
        setSelectedOption(opt);
        setDni('');
        setShowInputModal(true);
    };

    const handleGenerate = async () => {
        if (!user) {
            openLoginModal();
            return;
        }
        if (!dni || dni.length !== 8) return;

        // ─ Frontend credit guard (UX) ─
        const optId = selectedOption?.id; // e.g. 'familiares_pdf'
        const cost = getCost(optId);
        const userCredits = user?.credits ?? 0;
        const isPremium = user?.is_premium ?? false;
        if (!canAfford(optId, userCredits, isPremium)) {
            setAlert({
                isOpen: true,
                type: 'warning',
                message: `❌ No tienes suficientes créditos. Esta opción cuesta ${cost} crédito(s) y tienes ${userCredits} disponible(s).`,
            });
            setShowInputModal(false);
            return;
        }

        setShowInputModal(false);

        showLoading();

        try {
            const token = localStorage.getItem('token');
            if (!token) {
                setAlert({ isOpen: true, type: 'warning', message: 'Debes iniciar sesión para usar esta función Premium.' });
                hideLoading();
                return;
            }

            // Route to correct endpoint
            const isTxt = selectedOption?.id === 'familiares_texto';
            const endpoint = isTxt ? '/api/familiares/texto' : '/api/familiares/arbol_visual';

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ dni }),
            });

            const data = await res.json();

            if (!res.ok) {
                let errMsg = 'Error al generar el árbol familiar.';
                if (data.detail) {
                    if (data.detail?.code === 'INSUFFICIENT_CREDITS') {
                        errMsg = `\u274c ${data.detail.message}`;
                    } else {
                        errMsg = typeof data.detail === 'string'
                            ? data.detail
                            : Array.isArray(data.detail)
                                ? data.detail.map(e => e.msg || JSON.stringify(e)).join(', ')
                                : JSON.stringify(data.detail);
                    }
                }
                throw new Error(errMsg);
            }

            if (isTxt) {
                const parsed = parsePersonas(data.raw_text);
                setGeneratedData({
                    dni,
                    type: selectedOption,
                    resultType: 'texto',
                    raw_text: data.raw_text,
                    parsed,
                    file_path: data.file_path,
                });
            } else {
                setGeneratedData({
                    dni,
                    type: selectedOption,
                    resultType: 'pdf',
                    file_path: data.file_path,
                    raw_text: data.raw_text,
                    parsedFields: parseRawText(data.raw_text),
                });
            }
            setView('result');
            setHasDownloaded(false);
            hideLoading();

        } catch (err) {
            hideLoading();
            const isWarning = err.message.includes('\u274c') || err.message.includes('No se encontraron');
            setAlert({ isOpen: true, type: isWarning ? 'warning' : 'error', message: err.message });
        } finally {
            hideLoading();
        }
    };

    const handleBackClick = () => {
        if (!hasDownloaded) {
            setShowExitModal(true);
            setExitCountDown(5);
        } else {
            resetView();
        }
    };

    const resetView = () => {
        setView('selection');
        setGeneratedData(null);
        sessionStorage.removeItem('familiares_view');
        sessionStorage.removeItem('familiares_data');
        setSelectedOption(null);
        setDni('');
        setHasDownloaded(false);
        setShowExitModal(false);
    };

    const handleDownloadPdf = async () => {
        if (!generatedData?.file_path) return;
        setHasDownloaded(true);
        const filename = generatedData.file_path.split('/').pop();
        await forceDownload(getApiUrl(generatedData.file_path), filename);
    };

    // ── SELECTION VIEW ─────────────────────────────────────────────────────────
    if (view === 'selection') return (
        <div className="w-full max-w-5xl mx-auto p-4 flex flex-col items-center max-h-[85dvh]">

            <HelpModal
                isOpen={helpModal.isOpen}
                onClose={() => setHelpModal({ ...helpModal, isOpen: false })}
                title={helpModal.title}
                description={helpModal.description}
                details={helpModal.details}
            />

            {/* Cards — PDF first, Texto second */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
                className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl">
                {options.filter(opt => isFeatureEnabled('option_' + opt.id)).map((opt) => (
                    <div
                        key={opt.id}
                        onClick={() => handleOptionClick(opt)}
                        className="group relative bg-white dark:bg-slate-900 p-5 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-violet-400 dark:hover:border-violet-500 transition-colors text-left flex flex-col gap-3 min-h-[140px] cursor-pointer">

                        <button
                            onClick={(e) => openHelp(e, opt)}
                            className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center transition-colors z-20 border border-slate-100 dark:border-slate-700"
                            aria-label="¿Qué hace esta opción?"
                        >
                            <span className="material-icons-round text-slate-400 dark:text-slate-500 text-base">help_outline</span>
                        </button>

                        <div className="flex items-start justify-between">
                            <div className={`w-12 h-12 rounded-lg ${opt.color} flex items-center justify-center text-white shrink-0`}>
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
                                {getCost(opt.id)} crédito{getCost(opt.id) > 1 ? 's' : ''}
                            </div>
                            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-slate-400 group-hover:text-violet-500 dark:group-hover:text-violet-400 transition-colors font-black">
                                Consultar
                                <span className="material-icons-round text-xs">arrow_forward</span>
                            </div>
                        </div>
                    </div>
                ))}
            </motion.div>

            {/* Shared modals */}
            <SharedModals
                showInputModal={showInputModal} selectedOption={selectedOption}
                dni={dni} setDni={setDni}
                onCancel={() => setShowInputModal(false)}
                onGenerate={handleGenerate}
            />
            <AlertModal isOpen={alert.isOpen} type={alert.type} message={alert.message}
                onClose={() => setAlert(a => ({ ...a, isOpen: false }))} autoClose duration={10000} />

        </div>
    );

    // ── RESULT VIEW ───────────────────────────────────────────────────────────
    const isTextoResult = generatedData?.resultType === 'texto';
    return (
        <div className="w-full max-w-5xl mx-auto p-4 flex flex-col items-center">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl shadow-xl overflow-y-auto max-h-[85dvh] border border-slate-200 dark:border-slate-800">
                <div className="p-6 sm:p-8 flex flex-col items-center relative">
                    {/* Back button (Arrow) */}
                    <button
                        onClick={handleBackClick}
                        className="absolute top-6 left-6 flex min-h-[44px] min-w-[44px] items-center justify-center shrink-0 rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:hover:text-white"
                        title="Volver"
                    >
                        <span className="material-icons-round">arrow_back</span>
                    </button>

                    {/* Success icon + title */}
                    <div className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center text-white mb-4 shadow-lg shadow-emerald-500/30">
                        <span className="material-icons-round text-4xl">check</span>
                    </div>
                    <h3 className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mb-6 tracking-wide">
                        ÁRBOL FAMILIAR GENERADO CON ÉXITO
                    </h3>

                    {/* ── TEXTO RESULT VIEW ── */}
                    {isTextoResult && (() => {
                        const { titular, familiares, foundTotal } = generatedData.parsed ?? {};
                        const groups = groupFamiliares(familiares ?? []);
                        const displayTotal = foundTotal || familiares?.length || 0;

                        // PersonCard sub-component (inline)
                        const PersonCard = ({ p, isHeader }) => (
                            <div className={`rounded-xl border p-4 ${isHeader
                                ? 'bg-violet-50 dark:bg-violet-900/20 border-violet-300 dark:border-violet-700'
                                : 'bg-slate-50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-700/60'
                                }`}>
                                {isHeader && (
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="material-icons-round text-violet-600 dark:text-violet-400 text-base">person_pin</span>
                                        <span className="text-xs font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full bg-violet-200 dark:bg-violet-800 text-violet-800 dark:text-violet-200">
                                            TITULAR
                                        </span>
                                    </div>
                                )}
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 text-sm">
                                    {p.nombres && <div><span className="text-slate-400 text-xs">Nombres</span><p className="font-bold text-slate-800 dark:text-white truncate">{p.nombres}</p></div>}
                                    {p.apellidos && <div><span className="text-slate-400 text-xs">Apellidos</span><p className="font-bold text-slate-800 dark:text-white truncate">{p.apellidos}</p></div>}
                                    {p.dni && <div><span className="text-slate-400 text-xs">DNI</span><p className="font-bold text-slate-800 dark:text-white font-mono">{p.dni}</p></div>}
                                    {p.edad && <div><span className="text-slate-400 text-xs">Edad</span><p className="font-bold text-slate-800 dark:text-white">{p.edad}</p></div>}
                                    {p.genero && <div><span className="text-slate-400 text-xs">Género</span><p className="font-bold text-slate-800 dark:text-white">{p.genero}</p></div>}
                                    {p.fnac && <div><span className="text-slate-400 text-xs">F. Nac.</span><p className="font-bold text-slate-800 dark:text-white">{p.fnac}</p></div>}
                                    {p.verificacion && <div><span className="text-slate-400 text-xs">Verificación</span><p className={`font-bold text-xs uppercase ${p.verificacion === 'ALTA' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>{p.verificacion}</p></div>}
                                    {p.relacion && !isHeader && <div><span className="text-slate-400 text-xs">Relación</span><p className="font-bold text-slate-800 dark:text-white text-xs">{p.relacion}</p></div>}
                                </div>
                            </div>
                        );

                        return (
                            <div className="w-full mb-6">
                                {/* Titular header / "Familiares de:" */}
                                {titular && (
                                    <div className="mb-5">
                                        <div className="flex items-center gap-2 mb-2 px-1">
                                            <span className="material-icons-round text-violet-500 text-sm">family_restroom</span>
                                            <span className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                                                Familiares de:
                                            </span>
                                        </div>
                                        <PersonCard p={titular} isHeader={true} />
                                    </div>
                                )}

                                {/* Stats */}
                                <div className="flex items-center gap-2 px-1 mb-3">
                                    <span className="material-icons-round text-slate-400 text-sm">group</span>
                                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                        {displayTotal} familiar{displayTotal !== 1 ? 'es' : ''} encontrado{displayTotal !== 1 ? 's' : ''}
                                    </span>
                                </div>

                                {/* Grouped sections (scrollable) */}
                                <div className="space-y-5 max-h-[85dvh] overflow-y-auto pr-1">
                                    {groups.map(g => (
                                        <div key={g.priority}>
                                            {/* Section label */}
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                                                <span className="text-xs font-extrabold uppercase tracking-widest text-slate-500 dark:text-slate-400 px-2">{g.label}</span>
                                                <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                                            </div>
                                            <div className="space-y-2.5">
                                                {g.persons.map((p, idx) => (
                                                    <PersonCard key={idx} p={p} isHeader={false} />
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* TXT download with Premium Pulse animation */}
                                <div className="mt-6 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 flex flex-col items-center">
                                    <div className="w-full relative group">
                                        <motion.div
                                            initial={{ opacity: 0.5, scale: 1 }}
                                            animate={{
                                                opacity: [0.5, 0.8, 0.5],
                                                scale: [1, 1.05, 1]
                                            }}
                                            transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                                            className="absolute -inset-1 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-xl blur-lg opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"
                                        />
                                        <motion.button
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            onClick={async () => {
                                                if (generatedData.file_path) {
                                                    const filename = `Arbol_Completo_${generatedData.dni}.txt`;
                                                    await forceDownload(getApiUrl(generatedData.file_path), filename);
                                                } else {
                                                    downloadTxtFile(generatedData.dni, generatedData.parsed);
                                                }
                                                setHasDownloaded(true);
                                            }}
                                            className="relative w-full py-4 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-black shadow-2xl flex items-center justify-center gap-3 overflow-hidden"
                                        >
                                            {/* Shimmer effect */}
                                            <motion.div
                                                animate={{ x: ['-100%', '200%'] }}
                                                transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                                                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12"
                                            />

                                            <motion.span
                                                animate={{ y: [0, 3, 0] }}
                                                transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                                                className="material-icons-round text-2xl"
                                            >
                                                file_download
                                            </motion.span>
                                            <span className="tracking-wide uppercase text-sm">Descargar Árbol Completo (.txt)</span>
                                        </motion.button>
                                    </div>
                                    <p className="text-[11px] text-center text-slate-500 dark:text-slate-400 mt-3 font-medium flex items-center gap-1.5">
                                        <span className="material-icons-round text-sm text-violet-500">info</span>
                                        Recomendado: Obtenga los <span className="text-violet-600 dark:text-violet-400 font-bold">{displayTotal} registros</span> oficiales ahora.
                                    </p>
                                </div>
                            </div>
                        );
                    })()}

                    {/* ── PDF RESULT VIEW ── */}
                    {!isTextoResult && (
                        <>
                            {/* Parsed data fields */}
                            {generatedData?.parsedFields?.length > 0 && (
                                <div className="w-full bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 mb-6 border border-slate-100 dark:border-slate-700">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {generatedData.parsedFields.map((item, idx) => (
                                            <div key={idx} className="flex items-center text-sm gap-2">
                                                <span className="material-icons-round text-slate-400 text-base">{item.icon}</span>
                                                <span className="font-bold text-slate-500 dark:text-slate-400 w-20 shrink-0">{item.label}</span>
                                                <span className="text-slate-400 mx-1">:</span>
                                                <span className="font-bold text-slate-800 dark:text-white truncate">{item.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* PDF Preview — funciona en desktop y móvil */}
                            {generatedData?.file_path && (
                                <PdfViewer
                                    url={getApiUrl(generatedData.file_path)}
                                    height="420px"
                                    className="mb-6"
                                />
                            )}

                            <button
                                onClick={handleDownloadPdf}
                                className="w-full py-4 rounded-lg bg-rose-600 text-white font-bold hover:bg-rose-700 transition-colors flex items-center justify-center gap-2 text-lg mb-3"
                            >
                                <span className="material-icons-round">picture_as_pdf</span>
                                Descargar PDF
                            </button>
                        </>
                    )}

                    {/* Shared back button */}
                    <button
                        onClick={handleBackClick}
                        className="w-full py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
                    >
                        <span className="material-icons-round">arrow_back</span>
                        Volver
                    </button>

                </div>
            </motion.div>

            {/* Exit Modal (with 5s countdown) */}
            {createPortal(
                <AnimatePresence>
                    {showExitModal && (
                        <div className="fixed inset-0 z-[110] flex items-center justify-center px-[max(1rem,var(--safe-left))] pr-[max(1rem,var(--safe-right))] py-[max(1rem,var(--safe-top))] pb-[max(1rem,var(--safe-bottom))] bg-black/60 backdrop-blur-sm">
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
                                    No has descargado el resultado todavía. Si sales, perderás el resultado generado y <strong>no se reembolsarán los créditos</strong>.
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
                                        onClick={resetView}
                                        className={`flex-1 py-3 rounded-xl font-bold text-white text-sm transition-all flex items-center justify-center gap-2 ${exitCountDown > 0 ? 'bg-slate-400 cursor-not-allowed' : 'bg-red-500 hover:bg-red-600'}`}
                                    >
                                        {exitCountDown > 0 ? (
                                            <>
                                                <span className="material-icons-round text-base animate-spin">sync</span>
                                                Salir ({exitCountDown}s)
                                            </>
                                        ) : (
                                            <>
                                                <span className="material-icons-round text-base">exit_to_app</span>
                                                Sí, salir
                                            </>
                                        )}
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>,
                document.body
            )}

            <AlertModal isOpen={alert.isOpen} type={alert.type} message={alert.message}
                onClose={() => setAlert(a => ({ ...a, isOpen: false }))} autoClose duration={10000} />
        </div>
    );
}
