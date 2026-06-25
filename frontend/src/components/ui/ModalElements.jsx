import { DialogTitle } from '@headlessui/react';

const TONE_STYLES = {
    info: 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/60',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/60',
    warning: 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/60',
    danger: 'bg-red-50 text-red-700 border-red-100 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/60',
    neutral: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700',
};

const BUTTON_STYLES = {
    primary: 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200',
    info: 'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600',
    success: 'bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600',
    danger: 'bg-red-600 text-white hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600',
    secondary: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800',
    ghost: 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
};

export function ModalCloseButton({ onClick, label = 'Cerrar', className = '' }) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={label}
            className={`absolute right-4 top-4 z-10 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-transparent bg-white/90 text-slate-500 transition-colors hover:border-slate-200 hover:bg-slate-50 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-slate-900/90 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-white dark:focus:ring-offset-slate-900 ${className}`}
        >
            <span className="material-icons-round text-[20px]" aria-hidden="true">close</span>
        </button>
    );
}

export function ModalIcon({ icon, tone = 'info', className = '' }) {
    return (
        <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border ${TONE_STYLES[tone] || TONE_STYLES.info} ${className}`}
            aria-hidden="true"
        >
            <span className="material-icons-round text-[24px]">{icon}</span>
        </div>
    );
}

export function ModalHeader({ title, description, icon, tone = 'info', align = 'left', reserveCloseSpace = true, className = '' }) {
    const centered = align === 'center';
    const spacing = reserveCloseSpace ? (centered ? 'px-10' : 'pr-12') : '';

    return (
        <div className={`${centered ? 'items-center text-center' : 'items-start text-left'} flex flex-col gap-3 ${spacing} ${className}`}>
            {icon && <ModalIcon icon={icon} tone={tone} />}
            <div className="min-w-0 space-y-1">
                <DialogTitle className="text-lg font-bold leading-tight text-slate-900 dark:text-white">
                    {title}
                </DialogTitle>
                {description && (
                    <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                        {description}
                    </p>
                )}
            </div>
        </div>
    );
}

export function ModalButton({ children, variant = 'primary', className = '', type = 'button', ...props }) {
    return (
        <button
            type={type}
            className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus:ring-offset-slate-900 ${BUTTON_STYLES[variant] || BUTTON_STYLES.primary} ${className}`}
            {...props}
        >
            {children}
        </button>
    );
}

export function ModalSection({ children, className = '' }) {
    return (
        <div className={`rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60 ${className}`}>
            {children}
        </div>
    );
}
