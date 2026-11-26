/**
 * Skeleton — placeholders de carga compartidos del panel admin.
 *
 * Antes cada sección repetía sus propios bloques `animate-pulse` con alturas
 * distintas, y tres de ellas (Precios, Promos, Banners) no tenían ninguno: al
 * cambiar de pestaña la pantalla quedaba en blanco hasta que llegaba el fetch.
 *
 * Todos usan el mismo pulso para que la espera se sienta consistente.
 */

const PULSE = 'animate-pulse bg-slate-200 dark:bg-slate-700/60';

/** Bloque base. */
export function SkeletonBlock({ className = '' }) {
    return <div className={`${PULSE} rounded-xl ${className}`} aria-hidden="true" />;
}

/** Lista de filas (tablas y listados). */
export function SkeletonRows({ rows = 5, height = 'h-14' }) {
    return (
        <div className="space-y-3" role="status" aria-label="Cargando">
            {Array.from({ length: rows }, (_, i) => (
                <SkeletonBlock key={i} className={`${height} w-full`} />
            ))}
            <span className="sr-only">Cargando contenido…</span>
        </div>
    );
}

/** Rejilla de tarjetas (precios, banners, bots). */
export function SkeletonCards({ count = 3, height = 'h-32' }) {
    return (
        <div
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
            role="status"
            aria-label="Cargando"
        >
            {Array.from({ length: count }, (_, i) => (
                <SkeletonBlock key={i} className={`${height} w-full`} />
            ))}
            <span className="sr-only">Cargando contenido…</span>
        </div>
    );
}

/** Cabecera + filas, para una sección entera. */
export function SkeletonSection({ rows = 5 }) {
    return (
        <div className="space-y-6" role="status" aria-label="Cargando sección">
            <div className="space-y-2">
                <SkeletonBlock className="h-8 w-56" />
                <SkeletonBlock className="h-4 w-80 max-w-full" />
            </div>
            <SkeletonRows rows={rows} />
        </div>
    );
}

export default SkeletonSection;
