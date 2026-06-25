import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getApiUrl } from '../../utils/api';
import { toast } from 'sonner';
import { useSettings } from '../../context/settingsContextValue';
import ConfirmationModal from './ConfirmationModal';
import { PRICE_LABELS } from './priceLabels';
import Modal from '../ui/Modal';


export default function SettingsManagement() {
    const [settingsList, setSettingsList] = useState({});
    const [maintenance, setMaintenance] = useState(false);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState({ isOpen: false });
    const [showModulesModal, setShowModulesModal] = useState(false);
    const [modalTab, setModalTab] = useState('tabs');
    const [searchQuery, setSearchQuery] = useState('');

    const { refreshSettings } = useSettings();

    const fetchData = async () => {
        try {
            const token = localStorage.getItem('token');
            const [settingsRes, maintRes] = await Promise.all([
                fetch(getApiUrl('/api/admin/settings'), { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch(getApiUrl('/api/admin/maintenance'), { headers: { 'Authorization': `Bearer ${token}` } })
            ]);

            if (settingsRes.ok) setSettingsList(await settingsRes.json());
            if (maintRes.ok) {
                const mData = await maintRes.json();
                setMaintenance(mData.enabled);
            }
        } catch (error) {
            console.error("Failed to fetch admin settings", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const toggleMaintenance = async () => {
        const newState = !maintenance;
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(getApiUrl('/api/admin/maintenance'), {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: newState })
            });
            if (res.ok) {
                setMaintenance(newState);
                toast.success(newState ? 'Modo mantenimiento activado' : 'Sistema restaurado');
            } else {
                toast.error('Error al cambiar estado');
            }
        } catch {
            toast.error('Error de red al cambiar estado');
        } finally {
            setModal({ isOpen: false });
        }
    };

    const handleToggleSetting = async (key, currentValue) => {
        const newValue = !currentValue;
        // Optimistic update
        setSettingsList(prev => ({
            ...prev,
            [key]: { ...prev[key], value: newValue }
        }));

        try {
            const token = localStorage.getItem('token');
            const res = await fetch(getApiUrl(`/api/admin/settings/${key}`), {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ value: newValue })
            });

            if (!res.ok) throw new Error("Error updating setting");
            toast.success(`Configuración actualizada`);
            refreshSettings(); // Actualiza el contexto global
        } catch {
            // Revert on failure
            setSettingsList(prev => ({
                ...prev,
                [key]: { ...prev[key], value: currentValue }
            }));
            toast.error("Error al guardar la configuración");
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
                <div className="w-8 h-8 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="w-full max-w-4xl mx-auto space-y-8">

                                                <Modal isOpen={showModulesModal} onClose={() => setShowModulesModal(false)} title="Módulos y Opciones" size="xl">
                {/* Header Nav */}
                <div className="flex items-center gap-2 p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                    <button
                        onClick={() => { setModalTab('tabs'); setSearchQuery(''); }}
                        className={`flex-1 py-2.5 px-4 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${modalTab === 'tabs' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm border border-slate-200 dark:border-slate-700' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                        Pestañas Principales
                    </button>
                    <button
                        onClick={() => setModalTab('tools')}
                        className={`flex-1 py-2.5 px-4 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${modalTab === 'tools' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm border border-slate-200 dark:border-slate-700' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                        Herramientas ({Object.keys(PRICE_LABELS).length})
                    </button>
                </div>

                {modalTab === 'tools' && (
                    <div className="p-4 md:px-6 md:pt-6 pb-0 bg-white dark:bg-slate-900">
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                <span className="material-icons-round text-lg">search</span>
                            </div>
                            <input
                                type="text"
                                placeholder="Buscar herramientas por nombre, categoría o ID..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400"
                            />
                        </div>
                    </div>
                )}

                <div className="p-4 md:p-6 max-h-[85dvh] overflow-y-auto bg-white dark:bg-slate-900">
                    {modalTab === 'tabs' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {Object.entries(settingsList).filter(([k]) => k.startsWith('feature_') || k === 'promo_pack_active').map(([key, setting]) => (
                                <div key={key} className="flex flex-col p-5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-2xl hover:border-blue-400 dark:hover:border-blue-500 transition-colors group">
                                    <div className="flex items-start justify-between gap-3 mb-4">
                                        <div className="min-w-0">
                                            <h3 className="text-base font-black text-slate-900 dark:text-white leading-tight">{setting.label || key}</h3>
                                            <p className="text-[11px] text-slate-500 mt-1 font-mono">{key}</p>
                                        </div>
                                        <button
                                            onClick={() => handleToggleSetting(key, setting.value)}
                                            className={`shrink-0 relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 focus:outline-none shadow-inner border border-black/5 ${setting.value ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}
                                        >
                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform duration-300 ${setting.value ? 'translate-x-6' : 'translate-x-1'}`} />
                                        </button>
                                    </div>
                                    <div className="mt-auto flex items-center gap-2">
                                        <span className={`w-2 h-2 rounded-full ${setting.value ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-slate-400'}`} />
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{setting.value ? 'Visible' : 'Oculto'}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div>
                            {(() => {
                                const filteredTools = Object.entries(PRICE_LABELS).filter(([id, meta]) => 
                                    meta.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                    id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                    meta.cat.toLowerCase().includes(searchQuery.toLowerCase())
                                );

                                const groupedTools = filteredTools.reduce((acc, [id, meta]) => {
                                    if (!acc[meta.cat]) acc[meta.cat] = [];
                                    acc[meta.cat].push([id, meta]);
                                    return acc;
                                }, {});

                                if (filteredTools.length === 0) {
                                    return (
                                        <div className="py-12 text-center">
                                            <span className="material-icons-round text-4xl text-slate-300 dark:text-slate-600 mb-3">search_off</span>
                                            <p className="text-slate-500 dark:text-slate-400 font-medium">No se encontraron herramientas con ese nombre.</p>
                                        </div>
                                    );
                                }

                                return Object.entries(groupedTools).sort(([a], [b]) => a.localeCompare(b)).map(([cat, tools]) => (
                                    <div key={cat} className="mb-8 last:mb-0">
                                        <div className="flex items-center gap-3 mb-4 border-b border-slate-100 dark:border-slate-800 pb-2">
                                            <h4 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">{cat}</h4>
                                            <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-bold">
                                                {tools.length}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {tools.map(([id, meta]) => {
                                                const key = `option_${id}`;
                                                const isActive = settingsList[key] ? settingsList[key].value : true;
                                                return (
                                                    <div key={key} className={`flex flex-col p-5 border rounded-2xl transition-colors group ${isActive ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 shadow-sm' : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 opacity-75 grayscale-[0.5]'}`}>
                                                        <div className="flex items-start justify-between gap-4 mb-4">
                                                            <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 text-slate-600 dark:text-slate-300">
                                                                <span className="material-icons-round text-2xl">{meta.icon}</span>
                                                            </div>
                                                            <button
                                                                onClick={() => handleToggleSetting(key, isActive)}
                                                                className={`shrink-0 relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 focus:outline-none shadow-inner border border-black/5 ${isActive ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-700'}`}
                                                            >
                                                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform duration-300 ${isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                                                            </button>
                                                        </div>
                                                        <div>
                                                            <h3 className="text-[15px] font-bold text-slate-900 dark:text-white leading-snug mb-2 break-words" title={meta.label}>{meta.label}</h3>
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span className="text-[10px] text-slate-400 font-mono break-all bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">{id}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ));
                            })()}
                        </div>
                    )}
                </div>

                <div className="p-4 md:p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-b-[inherit] flex justify-end">
                    <button
                        onClick={() => setShowModulesModal(false)}
                        className="w-full md:w-auto px-8 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold active:scale-95 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                    >
                        <span className="material-icons-round text-xl">check_circle</span>
                        Cerrar Gestor
                    </button>
                </div>
            </Modal>

            <ConfirmationModal
                isOpen={modal.isOpen}
                onClose={() => setModal({ isOpen: false })}
                onConfirm={toggleMaintenance}
                title={maintenance ? 'Restaurar Sistema' : 'Modo Emergencia'}
                message={maintenance
                    ? '¿Estás seguro de reactivar el sistema? Los usuarios podrán realizar consultas nuevamente.'
                    : '⚠️ ¡ADVERTENCIA! Esto bloqueará TODAS las búsquedas para usuarios estándar de inmediato. ¿Proceder?'}
                type={maintenance ? 'info' : 'danger'}
            />

            <div>
                <h2 className="text-xl md:text-2xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent uppercase tracking-tight">Configuración Avanzada</h2>
                <p className="text-slate-500 dark:text-slate-400 mt-1 text-xs md:text-sm font-medium">Control maestro del sistema, caché y módulos de la plataforma.</p>
            </div>

            {/* Maintenance Mode Card */}
            <motion.div 
                layout
                className={`p-4 md:p-8 rounded-2xl md:rounded-[2rem] border-2 transition-all duration-500 relative overflow-hidden group
                    ${maintenance
                        ? 'bg-red-50 dark:bg-red-900/10 border-red-500 dark:border-red-900 shadow-2xl shadow-red-500/10'
                        : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 shadow-sm'}`}
            >
                {maintenance && (
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-red-500/10 via-transparent to-transparent pointer-events-none" />
                )}

                <div className="flex flex-row items-start gap-4 relative z-10">
                    <div className={`w-14 h-14 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl flex items-center justify-center shrink-0 transition-transform duration-500 group-hover:scale-110 shadow-lg
                        ${maintenance 
                            ? 'bg-red-600 text-white animate-pulse' 
                            : 'bg-slate-100 dark:bg-slate-900 text-slate-400'}`}>
                        <span className="material-icons-round text-2xl sm:text-4xl">{maintenance ? 'lock' : 'admin_panel_settings'}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="text-base sm:text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Modo Mantenimiento</h3>
                                    <AnimatePresence>
                                        {maintenance && (
                                            <motion.span 
                                                initial={{ opacity: 0, scale: 0.5 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.5 }}
                                                className="px-3 py-0.5 text-[9px] bg-red-600 text-white rounded-full font-black tracking-widest uppercase shadow-md"
                                            >
                                                Sistema Bloqueado
                                            </motion.span>
                                        )}
                                    </AnimatePresence>
                                </div>
                                <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm font-medium leading-relaxed mt-1 hidden sm:block">
                                    Bloquea inmediatamente todas las búsquedas para usuarios estándar. Solo administradores conservarán el acceso total.
                                </p>
                            </div>

                            <div className="shrink-0 pt-0.5">
                                <button
                                    onClick={() => setModal({ isOpen: true })}
                                    className={`w-14 h-7 sm:w-20 sm:h-10 rounded-full transition-colors duration-300 flex items-center p-0.5 sm:p-0.5 border-2 sm:border-4 
                                        ${maintenance 
                                            ? 'bg-red-600 border-red-500 shadow-inner justify-end' 
                                            : 'bg-slate-200 dark:bg-slate-700 border-transparent shadow-md justify-start'}`}
                                >
                                    <motion.div 
                                        layout
                                        transition={{ type: "spring", stiffness: 700, damping: 30 }}
                                        className={`w-5 h-5 sm:w-8 sm:h-8 rounded-full shadow-lg flex items-center justify-center 
                                            ${maintenance ? 'bg-white text-red-600' : 'bg-white text-slate-400'}`}
                                    >
                                        <span className="material-icons-round text-sm sm:text-lg">{maintenance ? 'lock' : 'lock_open'}</span>
                                    </motion.div>
                                </button>
                            </div>
                        </div>

                        <p className="text-slate-500 dark:text-slate-400 text-xs font-medium leading-relaxed mt-1 sm:hidden">
                            Bloquea las búsquedas para usuarios estándar.
                        </p>
                    </div>
                </div>
            </motion.div>

            {/* Extra Tools & Feature Toggles Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Feature Toggles Button */}
                <div className="space-y-4">
                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest px-1">Módulos del Sistema</h3>
                    <button
                        onClick={() => setShowModulesModal(true)}
                        className="w-full flex items-center justify-between p-5 md:p-6 bg-white dark:bg-slate-800 rounded-2xl md:rounded-3xl border-2 border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 shadow-sm hover:shadow-md transition-all duration-200 group"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 flex items-center justify-center shrink-0">
                                <span className="material-icons-round text-2xl">view_module</span>
                            </div>
                            <div className="text-left">
                                <h3 className="text-base md:text-lg font-bold text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors">Gestionar Módulos y Opciones</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">Activa o desactiva pestañas enteras y funciones específicas.</p>
                            </div>
                        </div>
                        <span className="material-icons-round text-slate-400 group-hover:text-blue-600 transition-colors">chevron_right</span>
                    </button>
                </div>
                {/* Maintenance Tools */}
                <div className="space-y-4">
                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest px-1">Herramientas de Mantenimiento</h3>
                    <div className="space-y-3">
                        <button 
                            onClick={async () => {
                                if (confirm("¿Estás seguro de eliminar TODOS los archivos (PDFs, Imágenes, TXTs) guardados temporalmente? Esta acción no se puede deshacer.")) {
                                    try {
                                        const token = localStorage.getItem('token');
                                        const res = await fetch(getApiUrl('/api/admin/clean-files'), {
                                            method: 'DELETE',
                                            headers: { 'Authorization': `Bearer ${token}` }
                                        });
                                        const data = await res.json();
                                        if (res.ok) toast.success(data.message);
                                        else toast.error(data.detail || "Error al limpiar archivos");
                                    } catch {
                                        toast.error("Error al conectar con el servidor.");
                                    }
                                }
                            }}
                            className="w-full p-4 md:p-5 rounded-2xl md:rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-md transition-all text-left group"
                        >
                            <div className="flex items-center gap-3 md:gap-4 mb-2">
                                <div className="w-10 h-10 rounded-xl md:rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-sm group-hover:scale-110 transition-transform">
                                    <span className="material-icons-round">delete_sweep</span>
                                </div>
                                <h4 className="font-black text-xs uppercase tracking-widest text-slate-800 dark:text-white">Limpiar Caché de Archivos</h4>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Fuerza el borrado de PDFs, imágenes y TXTs generados para liberar espacio.</p>
                        </button>

                        <div className="p-4 md:p-5 rounded-2xl md:rounded-3xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 opacity-60 cursor-not-allowed">
                            <div className="flex items-center gap-3 md:gap-4 mb-2">
                                <div className="w-10 h-10 rounded-xl md:rounded-2xl bg-white dark:bg-slate-800 flex items-center justify-center text-slate-400">
                                    <span className="material-icons-round">settings_backup_restore</span>
                                </div>
                                <h4 className="font-black text-xs uppercase tracking-widest text-slate-500">Reiniciar Sesiones</h4>
                            </div>
                            <p className="text-[11px] text-slate-400 font-medium">Cierra todas las sesiones activas en el sistema excepto la tuya. (Próximamente)</p>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
