/**
 * Banner de error de carga para el panel admin.
 *
 * Las secciones del panel hacían `catch (e) { console.error(e) }`: si fallaba
 * la red, el admin veía la pantalla vacía sin saber qué había pasado. Este
 * banner muestra el motivo y ofrece reintentar.
 */
export default function ErrorBanner({ mensaje, onReintentar }) {
    if (!mensaje) return null;
    return (
        <div
            role="alert"
            className="mb-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800/50 dark:bg-red-950/20"
        >
            <span className="material-icons-round shrink-0 text-red-600 dark:text-red-400" aria-hidden="true">
                error
            </span>
            <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-red-900 dark:text-red-200">
                    No se pudo cargar la información
                </p>
                <p className="mt-0.5 text-sm leading-relaxed text-red-800 dark:text-red-300">
                    {mensaje}
                </p>
            </div>
            {onReintentar && (
                <button
                    type="button"
                    onClick={onReintentar}
                    className="shrink-0 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-red-700 focus-ring"
                >
                    Reintentar
                </button>
            )}
        </div>
    );
}
