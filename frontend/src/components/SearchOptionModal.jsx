import { useState } from 'react';
import Modal from './ui/Modal';
import { ModalButton, ModalCloseButton, ModalHeader } from './ui/ModalElements';

export default function SearchOptionModal({ isOpen, onClose, onConfirm, user, targetUser }) {
    const [searchType, setSearchType] = useState('basic');

    const handleConfirm = () => {
        onConfirm(searchType);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="md" panelClassName="overflow-hidden">
            <ModalCloseButton onClick={onClose} />

            <div className="space-y-5 p-5 pt-6">
                <ModalHeader
                    title="Selecciona el tipo de consulta"
                    description={`Para: ${targetUser?.nombre_completo || 'Usuario'}`}
                    align="center"
                />

                <div className="space-y-3">
                    <Choice
                        checked={searchType === 'basic'}
                        onChange={() => setSearchType('basic')}
                        value="basic"
                        title="Datos basicos"
                        badge="Gratis"
                        description="Consulta estandar ilimitada."
                        tone="blue"
                    />

                    <Choice
                        checked={searchType === 'premium'}
                        onChange={() => setSearchType('premium')}
                        value="premium"
                        title="Datos premium"
                        description="Incluye fotos de rostro, firma y huellas."
                        note={!user ? 'Requiere registro/login.' : (!user.is_premium ? '5 creditos cada 24h (gratis).' : '')}
                        tone="amber"
                    />
                </div>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 p-4 sm:flex-row sm:justify-end dark:border-slate-700 dark:bg-slate-800/50">
                <ModalButton onClick={onClose} variant="secondary">
                    Cancelar
                </ModalButton>
                <ModalButton onClick={handleConfirm}>
                    Consultar
                </ModalButton>
            </div>
        </Modal>
    );
}

function Choice({ checked, onChange, value, title, badge, description, note, tone }) {
    const activeClass = tone === 'amber'
        ? 'border-amber-500 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/25'
        : 'border-blue-500 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/25';
    const inactiveClass = tone === 'amber'
        ? 'border-slate-200 hover:border-amber-300 dark:border-slate-700 dark:hover:border-amber-700'
        : 'border-slate-200 hover:border-blue-300 dark:border-slate-700 dark:hover:border-blue-700';
    const dotClass = tone === 'amber' ? 'bg-amber-500' : 'bg-blue-600';

    return (
        <label className={`flex cursor-pointer items-start gap-4 rounded-lg border p-4 transition-colors ${checked ? activeClass : inactiveClass}`}>
            <div className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${checked ? 'border-current' : 'border-slate-400'}`}>
                {checked && <div className={`h-2.5 w-2.5 rounded-full ${dotClass}`} />}
            </div>
            <input
                type="radio"
                name="modalSearchType"
                value={value}
                checked={checked}
                onChange={onChange}
                className="sr-only"
            />
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-slate-900 dark:text-white">{title}</span>
                    {badge && (
                        <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                            {badge}
                        </span>
                    )}
                </div>
                <p className="mt-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{description}</p>
                {note && <p className="mt-1 text-xs font-semibold text-amber-700 dark:text-amber-300">{note}</p>}
            </div>
        </label>
    );
}
