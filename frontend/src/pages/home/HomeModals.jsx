import { motion, AnimatePresence } from 'framer-motion';
import { Turnstile } from '@marsidev/react-turnstile';
import SearchOptionModal from '../../components/SearchOptionModal';
import AlertModal from '../../components/AlertModal';

/**
 * Modales de Home: selector de tipo de consulta, captcha y alertas.
 *
 * Se montan una sola vez en la raíz de Home (no dentro de cada vista) para que
 * no se desmonten a mitad de flujo cuando cambia la pantalla.
 */
export default function HomeModals({ modals, user, darkMode, onLoginClick }) {
    return (
        <>
            <SearchOptionModal
                isOpen={modals.optionModal.isOpen}
                onClose={modals.closeOptions}
                onConfirm={modals.confirmOption}
                user={user}
                targetUser={modals.optionModal.targetUser}
            />

            <AlertModal
                message={modals.alertMessage}
                onClose={() => modals.setAlertMessage(null)}
            />

            <AnimatePresence>
                {modals.showCaptcha && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/55 backdrop-blur-sm px-[max(1rem,var(--safe-left))] pr-[max(1rem,var(--safe-right))] py-[max(1rem,var(--safe-top))] pb-[max(1rem,var(--safe-bottom))]"
                    >
                        <motion.div
                            initial={{ scale: 0.98, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.98, opacity: 0 }}
                            className="relative flex w-[92%] max-w-[360px] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900"
                        >
                            <div className="flex w-full items-center justify-between border-b border-slate-100 bg-slate-50/50 px-5 py-4 dark:border-slate-800/60 dark:bg-slate-800/20">
                                <h3 className="text-base font-bold tracking-tight text-slate-900 dark:text-white">Verificación</h3>
                                <button
                                    onClick={modals.closeCaptcha}
                                    aria-label="Cerrar verificación"
                                    className="flex h-9 w-9 items-center justify-center rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
                                >
                                    <span className="material-icons-round text-[20px]">close</span>
                                </button>
                            </div>

                            <div className="flex flex-col items-center p-5">
                                <div className="mb-5 flex w-full justify-center">
                                    <Turnstile
                                        key={modals.captchaKey}
                                        siteKey="0x4AAAAAADImuetK3dfQj-A1"
                                        onSuccess={modals.handleCaptchaSuccess}
                                        onError={() => modals.setCaptchaToken(null)}
                                        onExpire={() => modals.setCaptchaToken(null)}
                                        options={{ theme: darkMode ? 'dark' : 'light' }}
                                    />
                                </div>

                                <div className="flex w-full flex-row items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-slate-700/50 dark:bg-slate-800/50 sm:p-4">
                                    <div className="flex flex-col">
                                        <p className="text-[12px] font-bold text-slate-800 dark:text-slate-200 sm:text-[13px]">¿Usuario frecuente?</p>
                                        <p className="mt-0.5 text-[10px] leading-tight text-slate-500 dark:text-slate-400 sm:text-[11px]">Omite esta validación</p>
                                    </div>
                                    <button
                                        onClick={() => { modals.closeCaptcha(); onLoginClick(); }}
                                        className="min-h-[44px] shrink-0 rounded-lg bg-slate-900 px-4 text-[11px] font-bold text-white transition-colors hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 sm:px-5 sm:text-[12px]"
                                    >
                                        Inicia sesión
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
