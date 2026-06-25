import { useNavigate } from 'react-router-dom';
import Modal from './ui/Modal';
import { ModalButton, ModalCloseButton, ModalHeader, ModalSection } from './ui/ModalElements';
import { Z_INDEX } from '../lib/zIndex';

export default function PromoModal({ onClose }) {
    const navigate = useNavigate();

    const handleGoToShop = () => {
        onClose();
        navigate('/tienda');
    };

    return (
        <Modal isOpen onClose={onClose} size="lg" panelClassName="overflow-hidden" zIndex={Z_INDEX.modalAbove}>
            <ModalCloseButton onClick={onClose} />

            <div className="grid gap-0 md:grid-cols-[0.9fr_1.1fr]">
                <div className="border-b border-slate-200 p-5 pt-6 dark:border-slate-700 md:border-b-0 md:border-r">
                    <ModalHeader
                        title="Oferta especial"
                        description="Obtén tu paquete de bienvenida exclusivo, válido una vez por cuenta, y realiza tus consultas de inmediato."
                        icon="card_giftcard"
                        tone="info"
                    />
                </div>

                <div className="space-y-5 p-5 pt-16 md:p-6 md:pt-16">
                    <ModalSection className="space-y-4">
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                    Paquete de bienvenida
                                </p>
                                <p className="mt-1 flex items-baseline gap-2 text-slate-900 dark:text-white">
                                    <span className="text-4xl font-bold leading-none">15</span>
                                    <span className="text-sm font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
                                        créditos
                                    </span>
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                    Por solo
                                </p>
                                <p className="mt-1 text-3xl font-bold leading-none text-slate-900 dark:text-white">
                                    S/ 1.00
                                </p>
                            </div>
                        </div>
                    </ModalSection>

                    <ModalButton onClick={handleGoToShop} variant="info" className="w-full">
                        <span>Reclamar oferta</span>
                        <span className="material-icons-round text-[18px]" aria-hidden="true">arrow_forward</span>
                    </ModalButton>

                    <p className="flex items-center justify-center gap-2 text-center text-xs font-medium text-slate-500 dark:text-slate-400">
                        <span className="material-icons-round text-[16px]" aria-hidden="true">verified</span>
                        Oferta válida por única vez
                    </p>
                </div>
            </div>
        </Modal>
    );
}
