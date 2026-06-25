import Modal from './ui/Modal';
import { ModalButton, ModalCloseButton, ModalHeader } from './ui/ModalElements';
import { Z_INDEX } from '../lib/zIndex';

export default function UserNotificationModal({ notification, onClose }) {
    if (!notification) return null;

    const handleClose = () => onClose(notification.id);

    return (
        <Modal isOpen={!!notification} onClose={handleClose} size="sm" panelClassName="overflow-hidden" zIndex={Z_INDEX.modalAbove}>
            <ModalCloseButton onClick={handleClose} label="Cerrar notificación" />

            <div className="space-y-5 p-5 pt-6">
                <ModalHeader
                    title={notification.title}
                    description={notification.message}
                    icon="task_alt"
                    tone="success"
                    align="center"
                />

                <ModalButton onClick={handleClose} variant="success" className="w-full">
                    Entendido
                </ModalButton>
            </div>
        </Modal>
    );
}
