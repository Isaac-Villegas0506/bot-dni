import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import Modal from './ui/Modal';

export default function TermsModal() {
    const { isLoggedIn } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [accepted, setAccepted] = useState(false);
    const [checked, setChecked] = useState(false);

    useEffect(() => {
        if (isLoggedIn) {
            const hasAccepted = localStorage.getItem('terms_accepted');
            if (!hasAccepted) {
                const openTimer = setTimeout(() => setIsOpen(true), 0);
                return () => clearTimeout(openTimer);
            }
        }
    }, [isLoggedIn]);

    const handleAccept = () => {
        if (checked) {
            localStorage.setItem('terms_accepted', 'true');
            setAccepted(true);
            setTimeout(() => setIsOpen(false), 500);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={() => {}} closeOnOverlay={false} size="md" panelClassName="flex flex-col overflow-hidden max-w-md mx-auto rounded-3xl border border-slate-200 dark:border-slate-700/50">
            {/* Content Container */}
            <div className="bg-white dark:bg-slate-900 p-8 flex flex-col items-center">
                
                {/* Title */}
                <div className="w-full text-left mb-6">
                    <h2 className="text-[22px] font-extrabold text-slate-800 dark:text-white">
                        Términos de Uso
                    </h2>
                </div>

                {/* Checkbox Section */}
                <div className="w-full flex items-start gap-3 mb-8">
                    <div className="relative flex items-center mt-0.5 shrink-0">
                        <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => setChecked(e.target.checked)}
                            className="peer h-[22px] w-[22px] cursor-pointer appearance-none rounded-md border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 transition-all checked:bg-blue-600 checked:border-blue-600 focus:outline-none"
                        />
                        <span className="material-icons-round absolute text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none text-lg left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" aria-hidden="true">
                            check
                        </span>
                    </div>
                    <span className="text-sm text-slate-600 dark:text-slate-300 leading-tight pt-1">
                        He leído y acepto los{' '}
                        <Link to="/terminos" onClick={() => setIsOpen(false)} className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 underline underline-offset-2 decoration-blue-500/30 hover:decoration-blue-500 transition-all">
                            Términos y Condiciones
                        </Link>
                        .
                    </span>
                </div>

                {/* Continue Button */}
                <button
                    onClick={handleAccept}
                    disabled={!checked || accepted}
                    className={`
                        w-full py-3.5 rounded-full font-black text-sm uppercase tracking-widest transition-all duration-200
                        ${checked && !accepted
                            ? 'bg-slate-800 dark:bg-slate-200 hover:bg-slate-900 dark:hover:bg-white text-white dark:text-slate-900 shadow-lg active:scale-95'
                            : 'bg-slate-200 dark:bg-slate-800 text-white dark:text-slate-500 cursor-not-allowed'}
                    `}
                >
                    {accepted ? 'Aceptado' : 'Continuar'}
                </button>
                
                {/* Footer brand text (similar to "TermsFeed" in the example) */}
                <div className="mt-6 text-xs font-semibold text-slate-400 dark:text-slate-500 tracking-wider">
                    Bot DNI
                </div>
            </div>
        </Modal>
    );
}
