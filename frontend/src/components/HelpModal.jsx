import Modal from './ui/Modal';

export default function HelpModal({ isOpen, onClose, title, description, details = [] }) {
    return (
        <Modal isOpen={isOpen} onClose={onClose} size="sm" panelClassName="overflow-hidden">
            {/* Decorative header gradient */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-violet-500" aria-hidden="true" />

            {/* Close button */}
            <button
                onClick={onClose}
                aria-label="Cerrar"
                className="absolute top-3 right-3 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors z-10"
            >
                <span className="material-icons-round text-lg" aria-hidden="true">close</span>
            </button>

            <div className="p-5">
                {/* Header */}
                <div className="flex items-center gap-3 mb-4 pr-8">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0" aria-hidden="true">
                        <span className="material-icons-round text-xl">help_outline</span>
                    </div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-lg tracking-tight leading-tight">
                        {title}
                    </h3>
                </div>

                {/* Content */}
                <div className="space-y-3">
                    <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
                        {description}
                    </p>

                    {details && details.length > 0 && (
                        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-100 dark:border-slate-700/50">
                            <p className="text-xs uppercase tracking-widest font-black text-slate-400 mb-2">Características</p>
                            <ul className="space-y-2">
                                {details.map((item, idx) => (
                                    <li key={idx} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
                                        <span className="material-icons-round text-blue-500 text-[14px] mt-0.5 shrink-0" aria-hidden="true">check_circle</span>
                                        <span className="font-medium leading-tight">{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                {/* Action */}
                <button
                    onClick={onClose}
                    className="mt-5 w-full min-h-[44px] rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-sm transition-all hover:opacity-90 active:scale-[0.98]"
                >
                    Entendido
                </button>
            </div>
        </Modal>
    );
}
