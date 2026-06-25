import Modal from './ui/Modal';
import { ModalButton, ModalCloseButton, ModalHeader } from './ui/ModalElements';
import { Z_INDEX } from '../lib/zIndex';

export default function AnnouncementModal({ announcement, onClose }) {
    if (!announcement) return null;

    return (
        <Modal isOpen={!!announcement} onClose={onClose} size="sm" panelClassName="overflow-hidden" zIndex={Z_INDEX.modalAbove}>
            <ModalCloseButton onClick={onClose} label="Cerrar anuncio" />

            <div className="space-y-5 p-5 pt-6">
                <ModalHeader
                    title={announcement.title}
                    description={announcement.message}
                    icon="campaign"
                    tone="info"
                    align="center"
                />

                <ModalButton onClick={onClose} className="w-full">
                    Entendido
                </ModalButton>
            </div>
        </Modal>
    );
}
