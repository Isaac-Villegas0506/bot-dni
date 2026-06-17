import { motion } from 'framer-motion';

const TYPE_STYLES = {
    warning: { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-600 dark:text-amber-400', icon: 'error_outline' },
    danger:  { bg: 'bg-red-50 dark:bg-red-900/20',    text: 'text-red-600 dark:text-red-400',     icon: 'warning' },
    info:    { bg: 'bg-blue-50 dark:bg-blue-900/20',   text: 'text-blue-600 dark:text-blue-400',   icon: 'info' },
};

export default function ConfirmationModal({ isOpen, onClose, onConfirm, title, message, type = 'warning' }) {
    if (!isOpen) return null;
    const { bg, text, icon } = TYPE_STYLES[type] || TYPE_STYLES.info;

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl max-w-sm w-full p-4 sm:p-5 border-2 border-slate-200 dark:border-slate-700 -[] overflow-y-auto"
            >
                <div className="flex items-start gap-4 mb-5">
                    <div className={`p-2.5 rounded-xl shrink-0 ${bg}`}>
                        <span className={`material-icons-round text-2xl ${text}`}>{icon}</span>
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">{title}</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">{message}</p>
                    </div>
                </div>
                <div className="flex gap-2.5 justify-end">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 rounded-2xl border-2 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-black text-[11px] uppercase tracking-widest transition-all active:scale-95 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={() => { onConfirm(); onClose(); }}
                        className={`px-8 py-3 text-white font-black uppercase tracking-widest rounded-2xl text-[11px] shadow-lg transition-all active:scale-95 disabled:opacity-50 ${type === 'danger' ? 'bg-red-600 hover:bg-red-700 shadow-red-500/20' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'}`}
                    >
                        Confirmar
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
