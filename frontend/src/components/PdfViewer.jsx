/**
 * PdfViewer — Renderiza PDFs como canvas usando react-pdf (PDF.js).
 * Funciona en desktop Y móvil (Android/iOS) sin depender de plugins del navegador.
 *
 * Props:
 *   url       {string}  — URL pública o blob:// del PDF a renderizar
 *   height    {string}  — Altura del visor (default: '500px')
 *   className {string}  — Clases adicionales para el contenedor
 */

import { useState, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configurar el worker de PDF.js desde CDN (evita copiar el worker al build)
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function PdfViewer({ url, height = '500px', className = '' }) {
    const [numPages, setNumPages] = useState(null);
    const [pageNumber, setPageNumber] = useState(1);
    const [error, setError] = useState(false);
    const [loading, setLoading] = useState(true);

    const onLoadSuccess = useCallback(({ numPages }) => {
        setNumPages(numPages);
        setLoading(false);
    }, []);

    const onLoadError = useCallback((err) => {
        console.error('PdfViewer error:', err);
        setError(true);
        setLoading(false);
    }, []);

    if (!url) return null;

    return (
        <div className={`w-full flex flex-col items-center rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 ${className}`}>

            {/* Visor principal */}
            <div
                className="w-full overflow-y-auto overflow-x-hidden"
                style={{ height }}
            >
                {loading && !error && (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
                        <div className="w-8 h-8 border-4 border-slate-300 border-t-violet-500 rounded-full animate-spin" />
                        <span className="text-sm font-medium">Cargando PDF...</span>
                    </div>
                )}

                {error ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400 px-4 text-center">
                        <span className="material-icons-round text-5xl text-slate-300">broken_image</span>
                        <p className="text-sm font-medium">No se pudo cargar la vista previa.</p>
                        <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-sm transition-all active:scale-95"
                        >
                            <span className="material-icons-round text-base">open_in_new</span>
                            Abrir PDF
                        </a>
                    </div>
                ) : (
                    <Document
                        file={url}
                        onLoadSuccess={onLoadSuccess}
                        onLoadError={onLoadError}
                        loading={null}
                        className="flex flex-col items-center gap-2 p-2"
                    >
                        {/* Renderizar la página actual */}
                        <Page
                            pageNumber={pageNumber}
                            width={Math.min(window.innerWidth - 48, 700)}
                            renderTextLayer={false}
                            renderAnnotationLayer={false}
                            className="rounded-lg shadow-sm"
                        />
                    </Document>
                )}
            </div>

            {/* Barra de navegación por páginas */}
            {numPages && numPages > 1 && (
                <div className="w-full flex items-center justify-between px-4 py-2 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                    <button
                        onClick={() => setPageNumber(p => Math.max(1, p - 1))}
                        disabled={pageNumber <= 1}
                        className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-30 hover:bg-slate-200 dark:hover:bg-slate-600 transition-all active:scale-90"
                    >
                        <span className="material-icons-round text-lg">chevron_left</span>
                    </button>

                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                        Página {pageNumber} de {numPages}
                    </span>

                    <button
                        onClick={() => setPageNumber(p => Math.min(numPages, p + 1))}
                        disabled={pageNumber >= numPages}
                        className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-30 hover:bg-slate-200 dark:hover:bg-slate-600 transition-all active:scale-90"
                    >
                        <span className="material-icons-round text-lg">chevron_right</span>
                    </button>
                </div>
            )}
        </div>
    );
}
