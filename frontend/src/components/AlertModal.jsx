import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Modal from './ui/Modal';
import { ModalButton, ModalCloseButton, ModalHeader, ModalSection } from './ui/ModalElements';
import { Z_INDEX } from '../lib/zIndex';

const TYPE_CONFIG = {
    success: { tone: 'success', icon: 'check_circle', title: '¡Éxito!', progress: 'bg-emerald-600' },
    error: { tone: 'danger', icon: 'error', title: 'Error', progress: 'bg-red-600' },
    warning: { tone: 'warning', icon: 'warning', title: 'Advertencia', progress: 'bg-amber-600' },
    info: { tone: 'info', icon: 'info', title: 'Información', progress: 'bg-blue-600' },
    insufficient_credits: { tone: 'info', icon: 'toll', title: 'Saldo insuficiente', progress: 'bg-blue-600' },
};

export default function AlertModal({
    isOpen,
    onClose,
    title,
    message,
    type = 'info',
    autoClose = true,
    duration = 10000
}) {
    const navigate = useNavigate();
    const { user } = useAuth();
    const show = isOpen !== undefined ? isOpen : !!message;
    const [timeLeft, setTimeLeft] = useState(duration);
    const prevShowRef = useRef(show);

    const normalizedMessage = message?.toLowerCase() || '';
    const isInsufficientCredits = type === 'insufficient_credits' ||
        normalizedMessage.includes('créditos insuficientes') ||
        normalizedMessage.includes('sin créditos') ||
        normalizedMessage.includes('no tienes créditos') ||
        normalizedMessage.includes('necesitas más créditos');

    const isBotError = normalizedMessage.includes('no se encontró') || 
                       normalizedMessage.includes('sin resultados') || 
                       normalizedMessage.includes('no hay resultados') || 
                       normalizedMessage.includes('no existe') || 
                       normalizedMessage.includes('❰❌❱') || 
                       normalizedMessage.includes('❰⚠️❱') ||
                       normalizedMessage.includes('error en el reconocimiento facial');

    let resolvedType = type;
    if (isInsufficientCredits) resolvedType = 'insufficient_credits';
    else if (isBotError) resolvedType = 'warning';

    const config = TYPE_CONFIG[resolvedType] || TYPE_CONFIG.info;
    const displayTitle = title || (isBotError ? 'Búsqueda sin resultados' : config.title);
    const progress = autoClose ? Math.max(0, Math.min(100, (timeLeft / duration) * 100)) : 100;
    const secondsLeft = Math.ceil(timeLeft / 1000);

    useEffect(() => {
        let syncTimer;
        if (show && !prevShowRef.current) {
            syncTimer = setTimeout(() => setTimeLeft(duration), 0);
        }
        prevShowRef.current = show;
        return () => clearTimeout(syncTimer);
    }, [show, duration]);

    useEffect(() => {
        if (!show || !autoClose) return;
        if (timeLeft <= 0) {
            onClose();
            return;
        }
        const tick = setTimeout(() => setTimeLeft(t => t - 100), 100);
        return () => clearTimeout(tick);
    }, [show, autoClose, timeLeft, onClose]);

    const handleAction = () => {
        if (isInsufficientCredits) {
            navigate('/tienda');
        }
        onClose();
    };

    return (
        <Modal isOpen={show} onClose={onClose} size="sm" panelClassName="overflow-hidden" zIndex={Z_INDEX.modalAbove}>
            <ModalCloseButton onClick={onClose} />

            <div className="space-y-5 p-5 pt-6">
                <ModalHeader
                    title={displayTitle}
                    description={message}
                    icon={config.icon}
                    tone={config.tone}
                />

                {isInsufficientCredits && user && (
                    <ModalSection>
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            Tu saldo
                        </p>
                        <p className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
                            <span className="material-icons-round text-amber-500" aria-hidden="true">toll</span>
                            {user.credits} créditos
                        </p>
                    </ModalSection>
                )}

                <ModalButton
                    onClick={handleAction}
                    variant={isInsufficientCredits ? 'info' : 'primary'}
                    className="w-full"
                >
                    {isInsufficientCredits && <span className="material-icons-round text-[18px]" aria-hidden="true">shopping_cart</span>}
                    <span>{isInsufficientCredits ? 'Comprar créditos' : 'Entendido'}</span>
                    {autoClose && (
                        <span className="text-xs font-medium opacity-70">
                            ({secondsLeft}s)
                        </span>
                    )}
                </ModalButton>
            </div>

            {autoClose && (
                <div className="h-1 w-full bg-slate-100 dark:bg-slate-800" aria-hidden="true">
                    <motion.div
                        className={`h-full ${config.progress}`}
                        initial={{ width: '100%' }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.1, ease: 'linear' }}
                    />
                </div>
            )}
        </Modal>
    );
}
