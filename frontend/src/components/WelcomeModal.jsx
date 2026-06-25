import Modal from './ui/Modal';
import { ModalButton, ModalHeader, ModalSection } from './ui/ModalElements';

export default function WelcomeModal({ isOpen, onClose, onLogin, onRegister }) {
    return (
        <Modal isOpen={isOpen} onClose={onClose} size="lg" panelClassName="overflow-hidden">
            <div className="grid gap-0 lg:grid-cols-[0.95fr_1.05fr]">
                <div className="border-b border-slate-200 p-5 dark:border-slate-800 lg:border-b-0 lg:border-r lg:p-6">
                    <ModalHeader
                        title="Mejora tu experiencia"
                        description="Crea una cuenta gratuita para guardar consultas, acceder al historial y usar funciones adicionales."
                        align="left"
                        reserveCloseSpace={false}
                    />

                    <div className="mt-6 space-y-2">
                        <ModalButton onClick={onLogin} variant="info" className="w-full">
                            Iniciar sesion
                        </ModalButton>
                        <ModalButton onClick={onRegister} variant="secondary" className="w-full">
                            Crear cuenta gratis
                        </ModalButton>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="mt-4 min-h-[44px] w-full rounded-lg px-3 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white dark:focus:ring-offset-slate-900"
                    >
                        Continuar como invitado
                    </button>
                </div>

                <div className="p-5 lg:p-6">
                    <ModalSection className="space-y-4">
                        <Benefit title="Consultas mas rapidas" text="Menos pasos repetidos al usar la plataforma." />
                        <Benefit title="Historial disponible" text="Revisa y reutiliza tus consultas anteriores." />
                        <Benefit title="Acceso sin interrupciones" text="Mejor flujo para funciones protegidas." />
                    </ModalSection>
                </div>
            </div>
        </Modal>
    );
}

function Benefit({ title, text }) {
    return (
        <div className="border-b border-slate-200 pb-4 last:border-b-0 last:pb-0 dark:border-slate-700">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{text}</p>
        </div>
    );
}
