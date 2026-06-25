const iconTone = {
    blue: 'bg-blue-600 text-white',
    indigo: 'bg-indigo-600 text-white',
    emerald: 'bg-emerald-600 text-white',
    rose: 'bg-rose-600 text-white',
    violet: 'bg-violet-600 text-white',
    amber: 'bg-amber-500 text-white',
    slate: 'bg-slate-700 text-white',
    red: 'bg-red-700 text-white',
};

export function OptionCard({
    option,
    onSelect,
    onHelp,
    creditsLabel,
    actionLabel = 'Consultar',
    accent = 'blue',
    badge,
}) {
    const iconClass = option.color || option.iconBg || iconTone[accent] || iconTone.blue;
    const focusAccent = accent === 'violet' ? 'focus-visible:ring-violet-500' : 'focus-visible:ring-blue-500';
    const hoverAccent = accent === 'violet'
        ? 'hover:border-violet-400 dark:hover:border-violet-500'
        : 'hover:border-blue-400 dark:hover:border-blue-500';

    const handleKeyDown = (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onSelect(option);
        }
    };

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={() => onSelect(option)}
            onKeyDown={handleKeyDown}
            className={`group relative min-h-[150px] cursor-pointer rounded-lg border border-slate-200 bg-white p-5 pr-14 text-left transition-colors duration-150 ${hoverAccent} hover:bg-slate-50/60 focus-visible:outline-none focus-visible:ring-2 ${focusAccent} focus-visible:ring-offset-2 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800/40 dark:focus-visible:ring-offset-slate-950`}
        >
            {onHelp && (
                <button
                    type="button"
                    onClick={(event) => onHelp(event, option)}
                    className="absolute right-2 top-2 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                    aria-label={`Informacion sobre ${option.title}`}
                >
                    <span className="material-icons-round text-[20px]">help_outline</span>
                </button>
            )}

            <div className="flex min-h-full flex-col gap-3">
                <div className="relative w-fit">
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${iconClass}`}>
                        <span className="material-icons-round text-2xl" aria-hidden="true">{option.icon}</span>
                    </div>
                    {(badge || option.isNew) && (
                        <span className="absolute -right-3 -top-2 rounded-full border border-amber-200 bg-amber-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                            {badge || 'Nuevo'}
                        </span>
                    )}
                </div>

                <div className="min-w-0">
                    <h3 className="text-base font-bold leading-snug text-slate-900 break-words dark:text-white">{option.title}</h3>
                    {option.desc && (
                        <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-slate-500 break-words dark:text-slate-400">{option.desc}</p>
                    )}
                </div>

                <div className="mt-auto flex items-center justify-between gap-3 border-t border-slate-100 pt-3 text-sm dark:border-slate-800">
                    <div className="min-w-0 font-bold text-amber-600 dark:text-amber-400">
                        <span className="truncate">{creditsLabel}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1 text-[11px] font-black uppercase text-slate-400 transition-colors group-hover:text-slate-700 dark:text-slate-500 dark:group-hover:text-slate-300">
                        <span>{actionLabel}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export function ResultPanel({ children, className = '' }) {
    return (
        <div className={`rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className}`}>
            {children}
        </div>
    );
}

export function BackButton({ onClick, label = 'Regresar', className = '' }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700 ${className}`}
        >
            <span className="material-icons-round text-[18px] text-slate-400" aria-hidden="true">arrow_back</span>
            {label && <span>{label}</span>}
        </button>
    );
}

export function ResultActionButton({ children, onClick, disabled = false, variant = 'primary', className = '' }) {
    const variants = {
        primary: 'bg-blue-600 text-white hover:bg-blue-700',
        dark: 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200',
        secondary: 'border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800',
        danger: 'bg-red-500 text-white hover:bg-red-600',
    };

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={`flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant] || variants.primary} ${className}`}
        >
            {children}
        </button>
    );
}

export function FieldList({ items, onCopy }) {
    return (
        <div className="w-full rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
            <div className="grid grid-cols-1 gap-2">
                {items.map((item, idx) => (
                    <div key={`${item.label}-${idx}`} className="grid grid-cols-[minmax(6rem,9rem)_1fr] gap-3 text-sm">
                        <span className="font-bold text-slate-500 break-words dark:text-slate-400">{item.label}</span>
                        <span className="flex min-w-0 items-start gap-2 font-semibold text-slate-900 break-words dark:text-white">
                            <span className="min-w-0 break-words">{item.value || '-'}</span>
                            {onCopy && item.copyValue && (
                                <button
                                    type="button"
                                    onClick={() => onCopy(item.copyValue)}
                                    className="flex min-h-[32px] min-w-[32px] shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-200 hover:text-blue-600 dark:hover:bg-slate-700"
                                    aria-label={`Copiar ${item.label}`}
                                >
                                    <span className="material-icons-round text-base">content_copy</span>
                                </button>
                            )}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
