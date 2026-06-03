import { motion } from 'framer-motion';
import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Modal from './ui/Modal';
import { Z_INDEX } from '../lib/zIndex';

export default function AlertModal({
    isOpen,
    onClose,
    title,
    message,
    type = 'info', // success, error, warning, info, insufficient_credits
    autoClose = true,
    duration = 10000  // 10 seconds default
}) {
    const navigate = useNavigate();
    const { user } = useAuth();
    const show = isOpen !== undefined ? isOpen : !!message;
    const [timeLeft, setTimeLeft] = useState(duration);
    const prevShowRef = useRef(show);

    // Detect insufficient credits from message or type
    const isInsufficientCredits = type === 'insufficient_credits' ||
                                 message?.toLowerCase().includes('créditos insuficientes') ||
                                 message?.toLowerCase().includes('sin créditos') ||
                                 message?.toLowerCase().includes('no tienes créditos') ||
                                 message?.toLowerCase().includes('necesitas más créditos');

    // Reset countdown when modal opens
    useEffect(() => {
        if (show && !prevShowRef.current) {
            setTimeLeft(duration);
        }
        prevShowRef.current = show;
    }, [show, duration]);

    // Countdown tick
    useEffect(() => {
        if (!show || !autoClose) return;
        if (timeLeft <= 0) {
            onClose();
            return;
        }
        const tick = setTimeout(() => setTimeLeft(t => t - 100), 100);
        return () => clearTimeout(tick);
    }, [show, autoClose, timeLeft, onClose]);

    const colors = {
        success: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400',
        error: 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400',
        warning: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400',
        info: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400',
        insufficient_credits: 'text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400',
    };

    const icons = {
        success: 'check_circle',
        error: 'error',
        warning: 'warning',
        info: 'info',
        insufficient_credits: 'toll'
    };

    const defaultTitles = {
        success: '¡Éxito!',
        error: 'Error',
        warning: 'Advertencia',
        info: 'Información',
        insufficient_credits: 'Saldo Insuficiente'
    };

    const displayTitle = title || defaultTitles[isInsufficientCredits ? 'insufficient_credits' : type] || 'Aviso';
    const progress = autoClose ? (timeLeft / duration) * 100 : 100;
    const secondsLeft = Math.ceil(timeLeft / 1000);

    const handleAction = () => {
        if (isInsufficientCredits) {
            navigate('/tienda');
        }
        onClose();
    };

    return (
        <Modal isOpen={show} onClose={onClose} size="sm" panelClassName="overflow-hidden" zIndex={Z_INDEX.modalAbove}>
            {/* Decorative header gradient line */}
            <div
                className={`absolute top-0 left-0 w-full h-1 ${isInsufficientCredits ? 'bg-gradient-to-r from-blue-500 to-violet-500' : 'bg-slate-200 dark:bg-slate-700'}`}
                aria-hidden="true"
            />

            <div className="p-5">
                {/* Close button */}
                <button
                    onClick={onClose}
                    aria-label="Cerrar"
                    className="absolute top-3 right-3 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors z-10"
                >
                    <span className="material-icons-round text-lg" aria-hidden="true">close</span>
                </button>

                {/* Header */}
                <div className="flex items-center gap-3 mb-4 pr-8">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${colors[isInsufficientCredits ? 'insufficient_credits' : type]}`} aria-hidden="true">
                        <span className="material-icons-round text-xl">
                            {icons[isInsufficientCredits ? 'insufficient_credits' : type]}
                        </span>
                    </div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-lg tracking-tight leading-tight">
                        {displayTitle}
                    </h3>
                </div>

                {/* Message */}
                <div className="space-y-4">
                    <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
                        {message}
                    </p>

                    {isInsufficientCredits && user && (
                        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-100 dark:border-slate-700/50">
                            <p className="text-xs uppercase tracking-widest font-black text-slate-400 mb-1">Tu Saldo</p>
                            <div className="flex items-center justify-between">
                                <p className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                                    <span className="material-icons-round text-amber-500 text-xl" aria-hidden="true">toll</span>
                                    {user.credits} créditos
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Action Button */}
                <button
                    onClick={handleAction}
                    className={`mt-5 w-full min-h-[44px] rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 active:scale-[0.98] ${
                        isInsufficientCredits
                        ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20'
                        : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                    }`}
                >
                    {isInsufficientCredits && <span className="material-icons-round text-lg" aria-hidden="true">shopping_cart</span>}
                    <span>{isInsufficientCredits ? 'Comprar Créditos' : 'Entendido'}</span>
                    {autoClose && (
                        <span className="text-[10px] opacity-60 font-medium ml-1">
                            ({secondsLeft}s)
                        </span>
                    )}
                </button>
            </div>

            {/* Progress bar at bottom */}
            {autoClose && (
                <div className="absolute bottom-0 left-0 w-full h-0.5 bg-slate-100 dark:bg-slate-800/30" aria-hidden="true">
                    <motion.div
                        className={`h-full ${isInsufficientCredits ? 'bg-blue-500' : 'bg-slate-500'}`}
                        initial={{ width: '100%' }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.1, ease: 'linear' }}
                    />
                </div>
            )}
        </Modal>
    );
}
