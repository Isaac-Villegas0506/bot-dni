/**
 * PdfViewer — Renderiza PDFs de forma nativa usando <iframe>/<object>
 * Esto permite interactuar con el PDF (scroll, zoom, imprimir) usando el visor nativo.
 *
 * Props:
 *   url       {string}  — URL pública o blob:// del PDF a renderizar
 *   height    {string}  — Altura del visor (default: '700px')
 *   className {string}  — Clases adicionales para el contenedor
 */

import { useState } from 'react';

export default function PdfViewer({ url, height = '700px', className = '' }) {
    const [loading, setLoading] = useState(true);

    if (!url) return null;

    return (
        <div 
            className={`relative w-full rounded-xl sm:rounded-2xl overflow-hidden shadow-lg border border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-900 ${className}`}
            style={{ height }}
        >
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
                        className="flex flex-col items-center gap-4 py-4 px-2"
                    >
                        {/* Renderizar todas las páginas iterando numPages */}
                        {numPages && Array.from(new Array(numPages), (el, index) => (
                            <div key={`page_${index + 1}`} className="rounded-lg shadow-md overflow-hidden bg-white shrink-0">
                                <Page
                                    pageNumber={index + 1}
                                    width={containerWidth ? Math.min(containerWidth - 32, 800) : 600}
                                    renderTextLayer={false}
                                    renderAnnotationLayer={false}
                                />
                            </div>
                        ))}
                    </Document>
                )}
            </div>
        </div>
    );
}

