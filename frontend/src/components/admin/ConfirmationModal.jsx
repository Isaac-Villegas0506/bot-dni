import Modal from '../ui/Modal';
import { ModalButton, ModalCloseButton, ModalHeader } from '../ui/ModalElements';
import { Z_INDEX } from '../../lib/zIndex';

const TYPE_STYLES = {
    warning: { tone: 'warning', icon: 'error_outline', confirmVariant: 'info' },
    danger: { tone: 'danger', icon: 'warning', confirmVariant: 'danger' },
    info: { tone: 'info', icon: 'info', confirmVariant: 'info' },
};

export default function ConfirmationModal({ isOpen, onClose, onConfirm, title, message, type = 'warning' }) {
    const config = TYPE_STYLES[type] || TYPE_STYLES.info;

    const handleConfirm = () => {
        onConfirm();
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="sm" panelClassName="overflow-hidden" zIndex={Z_INDEX.modalAbove}>
            <ModalCloseButton onClick={onClose} />

            <div className="space-y-5 p-5 pt-6">
                <ModalHeader
                    title={title}
                    description={message}
                    icon={config.icon}
                    tone={config.tone}
                />

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <ModalButton onClick={onClose} variant="secondary" className="w-full">
                        Cancelar
                    </ModalButton>
                    <ModalButton onClick={handleConfirm} variant={config.confirmVariant} className="w-full">
                        Confirmar
                    </ModalButton>
                </div>
            </div>
        </Modal>
    );
}
