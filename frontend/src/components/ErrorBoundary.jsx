import React from 'react';

const isDev = import.meta.env.DEV;

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[100dvh] flex items-center justify-center bg-background-light dark:bg-background-dark p-4">
          <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 text-center border border-slate-200 dark:border-slate-700">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">¡Ups! Algo salió mal</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              Ha ocurrido un error inesperado en la aplicación. Por favor, recarga la página.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors shadow-lg shadow-blue-500/30"
            >
              Recargar página
            </button>
            {isDev && (
              <div className="mt-6 text-left bg-slate-100 dark:bg-slate-900 p-4 rounded-lg overflow-auto text-xs text-slate-500 dark:text-slate-400 max-h-40">
                <code>{this.state.error?.toString()}</code>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
