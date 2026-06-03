import { motion, AnimatePresence } from 'framer-motion';

export default function UserNotificationModal({ notification, onClose }) {
    if (!notification) return null;

    return (
        <AnimatePresence>
            <motion.div
                key={`user-notification-${notification.id}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.15 } }}
                className="fixed inset-0 bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-md z-[99999] flex items-center justify-center p-4 sm:p-6"
            >
                <motion.div
                    initial={{ scale: 0.95, y: 15, opacity: 0 }}
                    animate={{ scale: 1, y: 0, opacity: 1 }}
                    exit={{ scale: 0.95, y: 10, opacity: 0, transition: { duration: 0.15 } }}
                    transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
                    className="bg-white dark:bg-slate-900 rounded-[28px] shadow-2xl shadow-slate-900/10 dark:shadow-black/50 w-full max-w-md overflow-hidden relative border border-emerald-200/60 dark:border-emerald-800/50"
                >
                    {/* Subtle top gradient detail */}
                    <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-emerald-500/10 to-transparent dark:from-emerald-500/5 pointer-events-none" />

                    <button
                        onClick={() => onClose(notification.id)}
                        className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors z-10"
                        aria-label="Cerrar notificación"
                    >
                        <span className="material-icons-round text-[20px]">close</span>
                    </button>
                    
                    <div className="pt-8 px-6 pb-2 text-center relative z-0">
                        <div className="mx-auto w-16 h-16 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-5 rotate-3 hover:rotate-0 transition-transform duration-300 border border-emerald-100 dark:border-emerald-500/20 shadow-sm shadow-emerald-500/10">
                            <span className="material-icons-round text-emerald-600 dark:text-emerald-400 text-3xl">task_alt</span>
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight mb-2">
                            {notification.title}
                        </h2>
                    </div>
                    
                    <div className="px-6 pb-8 text-center relative z-0">
                        <p className="text-slate-600 dark:text-slate-300 text-[15px] leading-relaxed mb-8 whitespace-pre-wrap">
                            {notification.message}
                        </p>
                        <button
                            onClick={() => onClose(notification.id)}
                            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold transition-all shadow-md hover:shadow-lg active:scale-[0.98] flex items-center justify-center gap-2"
                        >
                            <span>¡Entendido!</span>
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
