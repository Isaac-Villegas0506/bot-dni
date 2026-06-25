import Modal from './ui/Modal';
import { ModalButton, ModalCloseButton, ModalHeader, ModalSection } from './ui/ModalElements';

export default function HelpModal({ isOpen, onClose, title, description, details = [] }) {
    return (
        <Modal isOpen={isOpen} onClose={onClose} size="sm" panelClassName="overflow-hidden">
            <ModalCloseButton onClick={onClose} />

            <div className="space-y-5 p-5 pt-6">
                <ModalHeader
                    title={title}
                    description={description}
                    icon="help_outline"
                    tone="info"
                />

                {details.length > 0 && (
                    <ModalSection>
                        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            Características
                        </p>
                        <ul className="space-y-2">
                            {details.map((item, idx) => (
                                <li key={idx} className="flex items-start gap-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                                    <span className="material-icons-round mt-0.5 text-[16px] text-blue-600 dark:text-blue-300" aria-hidden="true">check_circle</span>
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </ModalSection>
                )}

                <ModalButton onClick={onClose} className="w-full">
                    Entendido
                </ModalButton>
            </div>
        </Modal>
    );
}
