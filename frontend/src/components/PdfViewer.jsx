/**
 * PdfViewer — Renderiza PDFs como canvas usando react-pdf (PDF.js).
 * Funciona en desktop Y móvil (Android/iOS) sin depender de plugins del navegador.
 *
 * Props:
 *   url       {string}  — URL pública o blob:// del PDF a renderizar
 *   height    {string}  — Altura del visor (default: '500px')
 *   className {string}  — Clases adicionales para el contenedor
 */

import { useState, useCallback, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Importar el worker localmente usando Vite asset URL en lugar de CDN externo para mayor velocidad
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

export default function PdfViewer({ url, height = '500px', className = '' }) {
    const [numPages, setNumPages] = useState(null);
    const [pageNumber, setPageNumber] = useState(1);
    const [scale, setScale] = useState(1);
    const [error, setError] = useState(false);
    const [loading, setLoading] = useState(true);
    const [containerWidth, setContainerWidth] = useState(window.innerWidth);

    useEffect(() => {
        const handleResize = () => setContainerWidth(window.innerWidth);
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

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
                className="w-full overflow-auto relative"
                style={{ height }}
            >
                {loading && !error && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100/50 dark:bg-slate-900/50 z-10 backdrop-blur-sm">
                        <div className="flex flex-col items-center gap-3 text-slate-500 dark:text-slate-400">
                            <div className="w-8 h-8 border-4 border-slate-300 dark:border-slate-600 border-t-violet-500 rounded-full animate-spin" />
                            <span className="text-sm font-medium animate-pulse">Cargando documento...</span>
                        </div>
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
                            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-sm transition-all active:scale-95 shadow-lg shadow-emerald-500/20"
                        >
                            <span className="material-icons-round text-base">open_in_new</span>
                            Abrir PDF
                        </a>
                    </div>
                ) : (
                    <div className="min-w-max flex justify-center w-full">
                        <Document
                            file={url}
                            onLoadSuccess={onLoadSuccess}
                            onLoadError={onLoadError}
                            loading={null}
                            className="flex flex-col items-center gap-4 py-4 px-2"
                        >
                            {/* Renderizar la página actual */}
                            <div className="rounded-lg shadow-md overflow-hidden bg-white shrink-0">
                                <Page
                                    pageNumber={pageNumber}
                                    width={Math.min(containerWidth - 32, 800)}
                                    scale={scale}
                                    renderTextLayer={false}
                                    renderAnnotationLayer={false}
                                />
                            </div>
                        </Document>
                    </div>
                )}
            </div>

            {/* Barra de navegación y Zoom */}
            <div className="w-full flex items-center justify-between px-4 py-2 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shrink-0 flex-wrap gap-2">
                
                {/* Paginación */}
                <div className="flex items-center gap-1">
                    {numPages && numPages > 1 ? (
                        <>
                            <button
                                onClick={() => setPageNumber(p => Math.max(1, p - 1))}
                                disabled={pageNumber <= 1}
                                className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-30 hover:bg-slate-200 dark:hover:bg-slate-600 transition-all active:scale-90"
                            >
                                <span className="material-icons-round text-xl">chevron_left</span>
                            </button>
                            <span className="text-sm font-bold text-slate-600 dark:text-slate-400 min-w-[3rem] text-center">
                                {pageNumber} / {numPages}
                            </span>
                            <button
                                onClick={() => setPageNumber(p => Math.min(numPages, p + 1))}
                                disabled={pageNumber >= numPages}
                                className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-30 hover:bg-slate-200 dark:hover:bg-slate-600 transition-all active:scale-90"
                            >
                                <span className="material-icons-round text-xl">chevron_right</span>
                            </button>
                        </>
                    ) : (
                        <div className="w-9 h-9"></div> /* Espaciador si solo hay 1 pág */
                    )}
                </div>

                {/* Controles de Zoom */}
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setScale(s => Math.max(0.5, s - 0.25))}
                        disabled={scale <= 0.5}
                        className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-30 hover:bg-slate-200 dark:hover:bg-slate-600 transition-all active:scale-90"
                    >
                        <span className="material-icons-round text-lg">zoom_out</span>
                    </button>
                    <span className="text-sm font-bold text-slate-600 dark:text-slate-400 min-w-[3.5rem] text-center">
                        {Math.round(scale * 100)}%
                    </span>
                    <button
                        onClick={() => setScale(s => Math.min(3, s + 0.25))}
                        disabled={scale >= 3}
                        className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-30 hover:bg-slate-200 dark:hover:bg-slate-600 transition-all active:scale-90"
                    >
                        <span className="material-icons-round text-lg">zoom_in</span>
                    </button>
                </div>

            </div>
        </div>
    );
}
