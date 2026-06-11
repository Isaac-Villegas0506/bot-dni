import { useState, useEffect, useCallback } from 'react';
import AlertModal from '../AlertModal';
import { motion, AnimatePresence } from 'framer-motion';

export const PRICE_LABELS = {
    c4_azul:         { label: 'Ficha C4 Azul',           cat: 'RENIEC',    icon: 'article' },
    inscripcion:     { label: 'Ficha de Inscripción',     cat: 'RENIEC',    icon: 'assignment' },
    virtual_azul:    { label: 'DNI Azul Virtual',         cat: 'RENIEC',    icon: 'credit_card' },
    virtual_electronico: { label: 'DNI Electrónico Virtual', cat: 'RENIEC', icon: 'contact_page' },
    amarillo:        { label: 'DNI Amarillo Virtual',     cat: 'RENIEC',    icon: 'credit_card' },
    familiares_pdf:  { label: 'Familiares PDF + Fotos (Antiguo)',   cat: 'Familiares',icon: 'family_restroom' },
    familiares_arbol_visual: { label: 'Ver Familiares (PDF + Fotos)', cat: 'Familiares', icon: 'account_tree' },
    familiares_texto:{ label: 'Familiares Texto',         cat: 'Familiares',icon: 'family_restroom' },
    numeros_dni:     { label: 'Ver Números de un DNI',    cat: 'Teléfonos', icon: 'phone_in_talk' },
    info_linea:      { label: 'Información Completa Línea',cat:'Teléfonos', icon: 'sim_card' },
    verificador_op:  { label: 'Verificador de Operadora', cat: 'Teléfonos', icon: 'wifi_calling' },
    titular_numero:  { label: 'Consulta Titular del Número',cat:'Teléfonos',icon: 'contact_phone' },
    dni_premium:     { label: 'RENIEC Premium (C4 + Biometría)', cat: 'RENIEC', icon: 'verified' },
    busqueda_nombres:{ label: 'Búsqueda por Nombres', cat: 'RENIEC', icon: 'person_search' },
    dni_gratis:      { label: 'Búsqueda por DNI (Gratis)', cat: 'RENIEC', icon: 'badge' },
    fiscalia_dni:    { label: 'Fiscalía por DNI',      cat: 'Denuncias', icon: 'gavel' },
    fiscalia_nombre: { label: 'Fiscalía por Nombres',  cat: 'Denuncias', icon: 'gavel' },
    fiscalia_ruc:    { label: 'Fiscalía por RUC',      cat: 'Denuncias', icon: 'gavel' },
    fiscalia_caso:   { label: 'Información Caso Fiscal',cat: 'Denuncias', icon: 'gavel' },
    busqueda_facial: { label: 'Búsqueda Facial IA',      cat: 'Facial',    icon: 'face' },
    antecedentes_policiales: { label: 'Certificado de Antecedentes Policiales', cat: 'Certificados', icon: 'policy' },
    antecedentes_penales:    { label: 'Certificado de Antecedentes Penales',    cat: 'Certificados', icon: 'gavel' },
    antecedentes_judiciales: { label: 'Certificado de Antecedentes Judiciales', cat: 'Certificados', icon: 'account_balance' },
    dni:             { label: 'Denuncias por DNI',        cat: 'Denuncias', icon: 'badge' },
    antper:          { label: 'Antecedentes Global',      cat: 'Denuncias', icon: 'gavel' },
    placa:           { label: 'Denuncias por Placa',      cat: 'Vehículos', icon: 'directions_car' },
    record_vehicular:{ label: 'Récord Vehicular',         cat: 'Vehículos', icon: 'directions_car' },
    daily_reward:    { label: 'Créditos Gratuitos Diarios',cat: 'Sistema',   icon: 'card_giftcard' },
};

const CAT_COLORS = { 
    RENIEC: 'text-blue-600', 
    Familiares: 'text-emerald-600', 
    Teléfonos: 'text-indigo-600', 
    Denuncias: 'text-rose-600',
    Vehículos: 'text-sky-600',
    Facial: 'text-purple-600',
    Certificados: 'text-amber-600',
    Sistema: 'text-pink-600'
};
const CAT_BG = { 
    RENIEC: 'bg-blue-50 dark:bg-blue-900/20', 
    Familiares: 'bg-emerald-50 dark:bg-emerald-900/20', 
    Teléfonos: 'bg-indigo-50 dark:bg-indigo-900/20', 
    Denuncias: 'bg-rose-50 dark:bg-rose-900/20',
    Vehículos: 'bg-sky-50 dark:bg-sky-900/20',
    Facial: 'bg-purple-50 dark:bg-purple-900/20',
    Certificados: 'bg-amber-50 dark:bg-amber-900/20',
    Sistema: 'bg-pink-50 dark:bg-pink-900/20'
};
const CAT_ICONS  = { 
    RENIEC: 'badge', 
    Familiares: 'group', 
    Teléfonos: 'sensors', 
    Denuncias: 'local_police',
    Vehículos: 'directions_car',
    Facial: 'portrait',
    Certificados: 'description',
    Sistema: 'settings_applications'
};
const CATEGORIES = ['Sistema', 'RENIEC', 'Familiares', 'Teléfonos', 'Denuncias', 'Vehículos', 'Facial', 'Certificados'];

const PackageCard = ({ pkg, index, onChange, onSave }) => (
    <motion.div 
        initial={{ opacity: 0, y: 15 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ delay: index * 0.05 }}
        className={`bg-white dark:bg-slate-800 rounded-2xl md:rounded-3xl border-2 shadow-lg flex flex-col relative overflow-hidden transition-all duration-300 group
            ${pkg.is_active 
                ? 'border-violet-100 dark:border-violet-900/30 ring-2 md:ring-4 ring-violet-50/20 dark:ring-violet-900/5' 
                : 'border-slate-100 dark:border-slate-800 opacity-60 grayscale-[0.3]'}`}
    >
        {/* Decorative elements */}
        <div className={`absolute -top-16 -right-16 w-48 h-48 rounded-full blur-[60px] opacity-15 transition-all duration-500 group-hover:opacity-25 group-hover:scale-110
            ${pkg.is_premium ? 'bg-amber-400' : 'bg-violet-400'}`} />

        <div className="px-4 md:px-6 py-3 md:py-4 border-b border-slate-50 dark:border-slate-700/50 flex justify-between items-center relative z-10">
            <div className="flex items-center gap-2.5 md:gap-3.5 min-w-0 flex-1">
                <div className={`w-10 h-10 md:w-11 md:h-11 rounded-xl md:rounded-2xl flex items-center justify-center shadow-md transition-all duration-300 group-hover:scale-105 group-hover:rotate-3 shrink-0
                    ${pkg.is_premium 
                        ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-orange-500/20' 
                        : 'bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-violet-500/20'}`}>
                    <span className="material-icons-round text-xl md:text-2xl">{pkg.is_premium ? 'workspace_premium' : 'shopping_bag'}</span>
                </div>
                <div className="min-w-0 flex-1">
                    <h3 className="font-black text-[8px] md:text-[9px] text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] md:tracking-[0.25em] mb-0.5 leading-none truncate">{pkg.plan_key}</h3>
                    <p className="font-extrabold text-slate-900 dark:text-white text-sm md:text-base tracking-tight leading-tight truncate">{pkg.name}</p>
                </div>
            </div>
            
            <button onClick={() => { onChange(pkg.id, 'is_active', !pkg.is_active); onSave({...pkg, is_active: !pkg.is_active}); }} 
                className={`px-2.5 md:px-3.5 py-1.5 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 shadow-sm shrink-0
                    ${pkg.is_active 
                        ? 'bg-emerald-500 text-white shadow-emerald-500/20' 
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-400 shadow-none'}`}>
                <span className="hidden xs:inline">{pkg.is_active ? '● ACTIVO' : '○ PAUSADO'}</span>
                <span className="xs:hidden">{pkg.is_active ? '●' : '○'}</span>
            </button>
        </div>

        <div className="p-3 md:p-5 grid grid-cols-1 sm:grid-cols-2 gap-2.5 md:gap-4 relative z-10">
            <div className="space-y-1.5">
                <label className="text-[9px] md:text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider ml-0.5">Nombre Comercial</label>
                <input type="text" value={pkg.name} onChange={e => onChange(pkg.id, 'name', e.target.value)} onBlur={() => onSave(pkg)}
                    className="w-full px-3 md:px-4 py-2 bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-700/50 rounded-xl text-xs md:text-sm font-semibold focus:border-violet-500 focus:bg-white dark:focus:bg-slate-900 outline-none transition-all dark:text-white placeholder-slate-300" />
            </div>
            
            <div className="space-y-1.5">
                <label className="text-[9px] md:text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider ml-0.5">Precio Unitario</label>
                <div className="relative group/input">
                    <span className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 text-slate-400 font-extrabold text-[11px] md:text-xs transition-colors group-focus-within/input:text-violet-500">S/</span>
                    <input type="number" step="0.5" value={pkg.price_soles} onChange={e => onChange(pkg.id, 'price_soles', e.target.value)} onBlur={() => onSave(pkg)}
                        className="w-full pl-8 md:pl-9 pr-3 md:pr-4 py-2 bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-700/50 rounded-xl text-xs md:text-sm font-semibold focus:border-violet-500 focus:bg-white dark:focus:bg-slate-900 outline-none transition-all dark:text-white" />
                </div>
            </div>

            <div className="space-y-1.5">
                <label className="text-[9px] md:text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider ml-0.5">Bolsa de Créditos</label>
                <div className="relative group/input">
                    <span className="absolute right-3 md:right-4 top-1/2 -translate-y-1/2 material-icons-round text-slate-300 text-base md:text-lg transition-colors group-focus-within/input:text-violet-500">toll</span>
                    <input type="number" value={pkg.credits} onChange={e => onChange(pkg.id, 'credits', e.target.value)} onBlur={() => onSave(pkg)}
                        className="w-full pl-3 md:pl-4 pr-8 md:pr-9 py-2 bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-700/50 rounded-xl text-xs md:text-sm font-semibold focus:border-violet-500 focus:bg-white dark:focus:bg-slate-900 outline-none transition-all dark:text-white" />
                </div>
            </div>

            <div className="space-y-1.5">
                <label className="text-[9px] md:text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider ml-0.5">Días Ilimitados</label>
                <div className="relative group/input">
                    <span className="absolute right-3 md:right-4 top-1/2 -translate-y-1/2 material-icons-round text-slate-300 text-base md:text-lg transition-colors group-focus-within/input:text-violet-500">all_inclusive</span>
                    <input type="number" value={pkg.unlimited_days || ''} placeholder="0 días" onChange={e => onChange(pkg.id, 'unlimited_days', e.target.value)} onBlur={() => onSave(pkg)}
                        className="w-full pl-3 md:pl-4 pr-8 md:pr-9 py-2 bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-700/50 rounded-xl text-xs md:text-sm font-semibold focus:border-violet-500 focus:bg-white dark:focus:bg-slate-900 outline-none transition-all dark:text-white" />
                </div>
            </div>

            <button onClick={() => { onChange(pkg.id, 'is_premium', !pkg.is_premium); onSave({...pkg, is_premium: !pkg.is_premium}); }} 
                className={`col-span-full flex items-center justify-center gap-2 py-2 md:py-2.5 rounded-xl border border-dashed transition-all font-black text-[9px] md:text-[10px] uppercase tracking-wider active:scale-[0.98]
                    ${pkg.is_premium 
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-400 shadow-sm' 
                        : 'bg-slate-50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-700 text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'}`}>
                <span className="material-icons-round text-base md:text-lg">{pkg.is_premium ? 'star' : 'star_outline'}</span>
                <span className="hidden xs:inline">{pkg.is_premium ? 'PAQUETE DESTACADO' : 'MARCAR COMO DESTACADO'}</span>
                <span className="xs:hidden">{pkg.is_premium ? 'DESTACADO' : 'DESTACAR'}</span>
            </button>
        </div>

    </motion.div>
);

export default function PriceManagement() {
    const [costs, setCosts]               = useState({});
        
    const [savingCost, setSavingCost]     = useState({});
    const [packages, setPackages]         = useState([]);
    const [savingPackage, setSavingPackage] = useState({});
    const [, setLoading]                  = useState(true);
    const [alert, setAlert]               = useState({ isOpen: false, type: 'info', title: '', message: '' });

    const loadCosts = useCallback(async () => {
        try {
            const res = await fetch('/api/credits/costs');
            if (res.ok) { const d = await res.json(); setCosts(d.costs || {}); }
        } catch (e) { console.error(e); }
    }, []);

    const loadPackages = useCallback(async () => {
        const token = localStorage.getItem('token');
        try {
            const res = await fetch('/api/admin/credit-packages', { headers: { 'Authorization': `Bearer ${token}` } });
            if (res.ok) { const data = await res.json(); if (Array.isArray(data)) setPackages(data); }
        } catch (e) { console.error(e); }
    }, []);

    const loadData = useCallback(async () => {
        setLoading(true);
        await Promise.all([loadCosts(), loadPackages()]);
        setLoading(false);
    }, [loadCosts, loadPackages]);

    useEffect(() => { loadData(); }, [loadData]);

    const handleCostChange = (id, val) => setCosts(prev => ({ ...prev, [id]: { ...prev[id], cost: Number(val) } }));
    const handlePackageChange = (id, field, value) => setPackages(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));

    const handleSaveCost = async (optionId) => {
        setSavingCost(prev => ({ ...prev, [optionId]: true }));
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`/api/admin/credits/costs/${optionId}`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ cost: costs[optionId]?.cost ?? 1 })
            });
            if (res.ok) setAlert({ isOpen: true, type: 'success', title: 'Precio Actualizado', message: `El costo de "${PRICE_LABELS[optionId]?.label || optionId}" ahora es ${costs[optionId]?.cost} cr.` });
            else setAlert({ isOpen: true, type: 'error', title: 'Error', message: 'No se pudo actualizar.' });
        } catch (e) { console.error(e); } finally { setSavingCost(prev => ({ ...prev, [optionId]: false })); }
    };

    const handleSavePackage = async (pkg) => {
        setSavingPackage(prev => ({ ...prev, [pkg.id]: true }));
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`/api/admin/credit-packages/${pkg.id}`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: pkg.name, price_soles: Number(pkg.price_soles), credits: Number(pkg.credits), is_premium: Boolean(pkg.is_premium), is_active: Boolean(pkg.is_active), unlimited_days: pkg.unlimited_days ? Number(pkg.unlimited_days) : null })
            });
            if (res.ok) { setAlert({ isOpen: true, type: 'success', title: 'Paquete Guardado', message: `El plan "${pkg.name}" se actualizó correctamente.` }); loadPackages(); }
            else setAlert({ isOpen: true, type: 'error', title: 'Error', message: 'No se pudo actualizar el paquete.' });
        } catch (e) { console.error(e); } finally { setSavingPackage(prev => ({ ...prev, [pkg.id]: false })); }
    };

    return (
        <div className="space-y-6 md:space-y-10 w-full pb-10">
            <AlertModal isOpen={alert.isOpen} onClose={() => setAlert({ ...alert, isOpen: false })} title={alert.title} message={alert.message} type={alert.type} />

            {/* Credit Packages Section */}
            <section>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 md:gap-4 mb-4 md:mb-6">
                    <div>
                        <h2 className="text-lg md:text-2xl font-black bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent uppercase tracking-tight">Paquetes Comerciales</h2>
                        <p className="text-slate-500 dark:text-slate-400 mt-1 text-xs md:text-sm font-medium">Define los precios y beneficios de cada nivel de suscripción.</p>
                    </div>
                </div>

                <div className="space-y-6 md:space-y-8">
                    {/* Sección: Paquetes de Créditos */}
                    <div>
                        <div className="flex items-center gap-2 mb-3 md:mb-4">
                            <span className="material-icons-round text-violet-500 text-sm">monetization_on</span>
                            <h3 className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Paquetes de Créditos</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                            <AnimatePresence>
                                {packages.filter(p => !p.unlimited_days).map((pkg, i) => (
                                    <PackageCard key={pkg.id} pkg={pkg} index={i} 
                                        onChange={handlePackageChange} onSave={handleSavePackage} 
                                        isSaving={savingPackage[pkg.id]} />
                                ))}
                            </AnimatePresence>
                        </div>
                    </div>

                    {/* Sección: Planes Ilimitados */}
                    <div>
                        <div className="flex items-center gap-2 mb-3 md:mb-4">
                            <span className="material-icons-round text-amber-500 text-sm">all_inclusive</span>
                            <h3 className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Planes Ilimitados</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                            <AnimatePresence>
                                {packages.filter(p => p.unlimited_days > 0).map((pkg, i) => (
                                    <PackageCard key={pkg.id} pkg={pkg} index={i} 
                                        onChange={handlePackageChange} onSave={handleSavePackage} 
                                        isSaving={savingPackage[pkg.id]} />
                                ))}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>
            </section>

            <hr className="border-slate-100 dark:border-slate-800" />

            {/* Query Costs Section */}
            <section>
                <div className="mb-6 md:mb-8">
                    <h2 className="text-lg md:text-2xl font-black bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent uppercase tracking-tight">Tarifario de Consultas</h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-1 text-xs md:text-sm font-medium">Establece cuántos créditos consume cada herramienta del bot.</p>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6">
                    {CATEGORIES.map(cat => (
                        <div key={cat} className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-3xl border-2 border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
                            <div className={`px-4 md:px-6 py-3 md:py-4 flex items-center gap-2.5 md:gap-3 border-b border-slate-50 dark:border-slate-700/50 ${CAT_BG[cat]}`}>
                                <div className={`w-9 h-9 md:w-10 md:h-10 rounded-lg md:rounded-xl flex items-center justify-center ${CAT_BG[cat]} border-2 border-white dark:border-slate-800 shadow-sm`}>
                                    <span className={`material-icons-round text-lg md:text-xl ${CAT_COLORS[cat]}`}>{CAT_ICONS[cat]}</span>
                                </div>
                                <h3 className={`font-black text-xs md:text-sm uppercase tracking-widest ${CAT_COLORS[cat]}`}>{cat}</h3>
                            </div>
                            <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
                                {Object.entries(PRICE_LABELS).filter(([, v]) => v.cat === cat).map(([id, meta]) => (
                                    <div key={id} className="flex flex-row items-center justify-between px-3 md:px-6 py-3 md:py-4 gap-2 md:gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors group">
                                        <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0">
                                            <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-slate-50 dark:bg-slate-900 flex items-center justify-center shrink-0 border-2 border-transparent group-hover:border-slate-100 dark:group-hover:border-slate-700 transition-all">
                                                <span className={`material-icons-round text-base md:text-lg ${CAT_COLORS[cat]} opacity-70 group-hover:opacity-100`}>{meta.icon}</span>
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="font-bold text-slate-900 dark:text-white text-xs md:text-sm tracking-tight truncate">{meta.label}</p>
                                                <p className="text-[9px] md:text-[10px] text-slate-400 font-mono uppercase tracking-widest mt-0.5 truncate">{id}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1.5 md:gap-3 shrink-0">
                                            <div className="relative flex items-center bg-slate-50 dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-700 rounded-xl md:rounded-2xl px-3 md:px-4 py-1.5 md:py-2 focus-within:border-blue-500 transition-all">
                                                <input type="number" min="0" max="99" value={costs[id]?.cost ?? ''} onChange={e => handleCostChange(id, e.target.value)} onBlur={() => handleSaveCost(id)}
                                                    className="w-7 md:w-8 text-center font-black text-slate-900 dark:text-white bg-transparent outline-none text-xs md:text-sm" />
                                                <span className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase ml-1 tracking-tighter">CR.</span>
                                            </div>
                                            {savingCost[id] && (
                                                <div className="w-10 h-9 md:w-12 md:h-10 flex items-center justify-center">
                                                    <span className="material-icons-round animate-spin text-blue-500">refresh</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}
