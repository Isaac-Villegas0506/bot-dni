import { useState } from 'react';

export default function PdfViewer({ url, height = '700px', className = '' }) {
  const [error, setError] = useState(false);

  if (!url) return null;

  return (
    <div
      className={`relative w-full rounded-xl sm:rounded-2xl overflow-hidden shadow-lg border border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-900 ${className}`}
      style={{ height }}
    >
      {error ? (
        <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400 px-4 text-center">
          <span className="material-icons-round text-5xl text-slate-300">
            broken_image
          </span>

          <p className="text-sm font-medium">
            No se pudo cargar la vista previa.
          </p>

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
        <iframe
          src={url}
          title="Vista previa PDF"
          className="w-full h-full border-0 bg-white"
          onError={() => setError(true)}
        />
      )}
    </div>
  );
}
