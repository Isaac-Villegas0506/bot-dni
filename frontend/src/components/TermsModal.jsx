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
            <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 flex flex-col items-center">
                
                {/* Top Icon & Title */}
                <div className="w-full flex flex-col items-center mb-5 sm:mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-3 shadow-sm border border-blue-100 dark:border-blue-500/20">
                        <span className="material-icons-round text-2xl">gavel</span>
                    </div>
                    <h2 className="text-xl sm:text-[22px] font-extrabold text-slate-800 dark:text-white text-center">
                        Términos de Uso
                    </h2>
                </div>

                {/* Checkbox Section */}
                <div className="w-full flex items-start gap-3 mb-6 sm:mb-8 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                    <div className="relative flex items-center mt-0.5 shrink-0">
                        <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => setChecked(e.target.checked)}
                            className="peer h-5 w-5 sm:h-[22px] sm:w-[22px] cursor-pointer appearance-none rounded-md border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 transition-all checked:bg-blue-600 checked:border-blue-600 focus:outline-none"
                        />
                        <span className="material-icons-round absolute text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none text-base sm:text-lg left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" aria-hidden="true">
                            check
                        </span>
                    </div>
                    <span className="text-[13px] sm:text-sm text-slate-600 dark:text-slate-300 leading-snug">
                        He leído y acepto los{' '}
                        <Link to="/terminos" onClick={() => setIsOpen(false)} className="font-semibold text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 underline underline-offset-2 decoration-blue-500/30 hover:decoration-blue-500 transition-all">
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
                        w-full py-3 sm:py-3.5 rounded-2xl font-black text-sm uppercase tracking-widest transition-all duration-300
                        ${checked && !accepted
                            ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/30 active:scale-[0.98]'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'}
                    `}
                >
                    {accepted ? 'Aceptado' : 'Continuar'}
                </button>
                
                {/* Footer brand text */}
                <div className="mt-4 sm:mt-5 flex items-center gap-2">
                    <span className="material-icons-round text-slate-300 dark:text-slate-600 text-[14px]">shield</span>
                    <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 tracking-wider uppercase">
                        Bot DNI Seguro
                    </span>
                </div>
            </div>
        </Modal>
    );
}
