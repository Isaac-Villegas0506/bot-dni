import { useState, useEffect } from 'react';
import ConfirmationModal from './ConfirmationModal';
import { motion, AnimatePresence } from 'framer-motion';

export default function SpecialOptions({ onBackToHome }) {
    const [maintenance, setMaintenance] = useState(false);
    const [loading, setLoading]         = useState(true);
    const [modal, setModal]             = useState({ isOpen: false });

    useEffect(() => { checkStatus(); }, []);

    const checkStatus = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/admin/maintenance', { headers: { 'Authorization': `Bearer ${token}` } });
            if (res.ok) { const data = await res.json(); setMaintenance(data.enabled); }
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    const toggleMaintenance = async () => {
        const newState = !maintenance;
        const token = localStorage.getItem('token');
        try {
            await fetch('/api/admin/maintenance', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: newState })
            });
            setMaintenance(newState);
            setModal({ isOpen: false });
        } catch { alert('Error al cambiar estado'); }
    };

    return (
        <div className="space-y-8 w-full max-w-4xl mx-auto">
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

            {/* Header */}
            <div className="flex flex-col gap-3 md:gap-0 md:flex-row justify-between items-start md:items-center border-b border-slate-100 dark:border-slate-800 pb-4 md:pb-6">
                <div>
                    <h2 className="text-lg md:text-2xl font-black bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent uppercase tracking-tight">Zona de Control Maestro</h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-1 text-xs md:text-sm font-medium">Configuraciones globales que afectan la integridad del servicio.</p>
                </div>
                {onBackToHome && (
                    <button onClick={onBackToHome}
                        className="w-full md:w-auto flex items-center justify-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 md:px-5 py-2.5 rounded-xl md:rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg transition-all active:scale-95">
                        <span className="material-icons-round text-base md:text-lg">arrow_back</span>
                        Regresar
                    </button>
                )}
            </div>

            {/* Maintenance Mode Card */}
            <motion.div 
                layout
                className={`p-4 md:p-8 rounded-2xl md:rounded-[2rem] border-2 transition-all duration-500 relative overflow-hidden group
                    ${maintenance
                        ? 'bg-red-50 dark:bg-red-900/10 border-red-500 dark:border-red-900 shadow-2xl shadow-red-500/10'
                        : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 shadow-sm'}`}
            >
                {/* Visual Accent */}
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
                                    Cuando el modo mantenimiento está activo, ningún usuario estándar podrá realizar consultas en la plataforma. 
                                    Solo las cuentas de administrador conservarán acceso total.
                                </p>
                            </div>

                            {/* Toggle */}
                            <div className="shrink-0 pt-0.5">
                                <button
                                    onClick={() => setModal({ isOpen: true })}
                                    disabled={loading}
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
                            Bloquea todas las búsquedas para usuarios estándar.
                        </p>
                    </div>
                </div>
            </motion.div>

            {/* Extra Tools */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                <button 
                    onClick={async () => {
                        if (confirm("¿Estás seguro de eliminar TODOS los archivos (PDFs, Imágenes, TXTs) guardados temporalmente? Esta acción no se puede deshacer.")) {
                            try {
                                const token = localStorage.getItem('token');
                                const res = await fetch('/api/admin/clean-files', {
                                    method: 'DELETE',
                                    headers: { 'Authorization': `Bearer ${token}` }
                                });
                                const data = await res.json();
                                if (res.ok) alert(data.message);
                                else alert(data.detail || "Error al limpiar archivos");
                            } catch {
                                alert("Error al conectar con el servidor.");
                            }
                        }
                    }}
                    className="p-4 md:p-6 rounded-2xl md:rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-lg transition-all text-left"
                >
                    <div className="flex items-center gap-3 md:gap-4 mb-2">
                        <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl md:rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-sm">
                            <span className="material-icons-round text-lg md:text-xl">delete_sweep</span>
                        </div>
                        <h4 className="font-black text-[10px] md:text-xs uppercase tracking-widest text-slate-800 dark:text-white">Limpiar Archivos</h4>
                    </div>
                    <p className="text-[10px] md:text-[11px] text-slate-500 dark:text-slate-400 font-medium">Fuerza el borrado manual de todos los PDFs, imágenes y TXTs cacheados por el bot.</p>
                </button>

                <div className="p-4 md:p-6 rounded-2xl md:rounded-3xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 opacity-60 cursor-not-allowed">
                    <div className="flex items-center gap-3 md:gap-4 mb-2">
                        <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl md:rounded-2xl bg-white dark:bg-slate-800 flex items-center justify-center text-slate-400">
                            <span className="material-icons-round text-lg md:text-xl">settings_backup_restore</span>
                        </div>
                        <h4 className="font-black text-[10px] md:text-xs uppercase tracking-widest text-slate-500">Reiniciar Sesiones</h4>
                    </div>
                    <p className="text-[10px] md:text-[11px] text-slate-400 font-medium">Cierra todas las sesiones activas en el sistema excepto la tuya.</p>
                </div>
            </div>
        </div>
    );
}
