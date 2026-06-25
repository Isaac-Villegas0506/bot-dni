import { Dialog, DialogPanel } from '@headlessui/react';
import { Z_INDEX } from '../../lib/zIndex';

const SIZE_MAP = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-7xl',
};

/**
 * Modal accesible compartido (Headless UI Dialog + Tailwind).
 *
 * Garantiza:
 *  - role="dialog" + aria-modal="true" + focus trap + ESC + click-outside
 *  - Render en portal (no queda atrapado por overflow:hidden de padres)
 *  - Scroll-lock del body mientras está abierto
 *  - Animaciones via data-[closed] / data-[enter] (Tailwind v4 + Headless UI v2)
 *
 * Props:
 *   isOpen          boolean
 *   onClose         function (también dispara con ESC y backdrop click)
 *   size            'sm' | 'md' | 'lg' | 'xl' | 'full' (default 'md')
 *   variant         'centered' (default) | 'sheet' (bottom-sheet en móvil)
 *   closeOnOverlay  boolean (default true)
 *   zIndex          number (default Z_INDEX.modal)
 *   panelClassName  clases extra para el panel
 *   children        contenido. Para a11y completa, dentro coloca un elemento
 *                   con `id` y referencialo desde aria-labelledby (Headless UI
 *                   ya pone aria-labelledby automáticamente si usas DialogTitle).
 */
export default function Modal({
    isOpen,
    onClose,
    size = 'md',
    variant = 'centered',
    closeOnOverlay = true,
    zIndex = Z_INDEX.modal,
    panelClassName = '',
    children,
}) {
    const sizeCls = SIZE_MAP[size] || SIZE_MAP.md;
    const isSheet = variant === 'sheet';

    return (
        <Dialog
            open={isOpen}
            onClose={closeOnOverlay ? onClose : () => {}}
            transition
            className="relative transition duration-200 ease-out data-[closed]:opacity-0"
            style={{ zIndex }}
        >
            <div
                className="fixed inset-0 min-h-[100dvh] bg-slate-950/55 backdrop-blur-sm"
                aria-hidden="true"
            />

            <div
                className={`fixed inset-0 min-h-[100dvh] overflow-y-auto overscroll-contain flex justify-center ${
                    isSheet
                        ? 'items-end sm:items-center px-[var(--safe-left)] pr-[var(--safe-right)] pt-[var(--safe-top)] pb-[var(--safe-bottom)] sm:p-4'
                        : 'items-center px-[max(1rem,var(--safe-left))] pr-[max(1rem,var(--safe-right))] py-[max(1rem,var(--safe-top))] pb-[max(1rem,var(--safe-bottom))]'
                }`}
            >
                <DialogPanel
                    transition
                    className={`relative w-full ${sizeCls} bg-white dark:bg-slate-900 shadow-xl border border-slate-200 dark:border-slate-700
                        max-h-[calc(100dvh-var(--safe-top)-var(--safe-bottom)-2rem)] overflow-y-auto outline-none
                        transition duration-200 ease-out
                        data-[closed]:opacity-0 data-[closed]:scale-95 data-[closed]:translate-y-4
                        ${isSheet
                            ? 'rounded-t-lg sm:rounded-lg max-h-[calc(100dvh-var(--safe-top)-var(--safe-bottom))]'
                            : 'rounded-lg my-4 sm:my-0'
                        }
                        ${panelClassName}`}
                >
                    {children}
                </DialogPanel>
            </div>
        </Dialog>
    );
}
