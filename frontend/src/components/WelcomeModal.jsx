import Modal from './ui/Modal';

export default function WelcomeModal({ isOpen, onClose, onLogin, onRegister }) {
    return (
        <Modal isOpen={isOpen} onClose={onClose} size="sm" panelClassName="lg:max-w-3xl">
            {/* Background decorative blur blobs */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/5 blur-[80px] rounded-full -mr-24 -mt-24 pointer-events-none" aria-hidden="true" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/5 blur-[80px] rounded-full -ml-24 -mb-24 pointer-events-none" aria-hidden="true" />

            <div className="p-5 lg:p-10 flex flex-col lg:grid lg:grid-cols-2 gap-5 lg:gap-12 items-center text-center lg:text-left">

                {/* Left Column */}
                <div className="contents lg:flex lg:flex-col lg:items-start lg:relative lg:z-10">

                    <h2 className="order-1 text-2xl lg:text-5xl font-black text-slate-900 dark:text-white mb-2 lg:mb-5 tracking-tight relative z-10 leading-tight lg:leading-[1.15]">
                        Mejora tu <br className="hidden lg:block" />
                        <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">experiencia</span>
                    </h2>

                    <p className="hidden lg:block order-2 text-slate-500 dark:text-slate-400 text-lg mb-10 max-w-sm relative z-10 font-medium leading-relaxed">
                        Descubre el poder de nuestra plataforma con una cuenta gratuita y accede a funciones exclusivas.
                    </p>

                    <div className="order-4 w-full space-y-2 lg:space-y-4 relative z-10 mt-1 lg:mt-0 max-w-sm">
                        <button
                            onClick={onLogin}
                            className="w-full min-h-[44px] bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 lg:py-4 rounded-xl shadow-lg shadow-blue-500/20 transition-all active:scale-95 text-base lg:text-lg flex items-center justify-center gap-2"
                        >
                            <span className="material-icons-round text-lg lg:text-xl" aria-hidden="true">login</span>
                            Iniciar Sesión
                        </button>

                        <button
                            onClick={onRegister}
                            className="w-full min-h-[44px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold py-3 lg:py-4 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all text-base lg:text-lg"
                        >
                            Crear Cuenta Gratis
                        </button>
                    </div>

                    <button
                        onClick={onClose}
                        className="order-5 mt-4 lg:mt-8 text-slate-400 dark:text-slate-500 text-xs lg:text-sm font-bold hover:text-blue-600 dark:hover:text-blue-400 transition-colors relative z-10 flex items-center gap-1 mx-auto lg:mx-0"
                    >
                        Continuar como invitado
                        <span className="material-icons-round text-base" aria-hidden="true">chevron_right</span>
                    </button>
                </div>

                {/* Right Column: Benefits */}
                <div className="order-3 w-full relative z-10 lg:order-none bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-5 lg:p-8 border border-slate-100 dark:border-slate-800/50">
                    <div className="space-y-4 lg:space-y-8 text-left">

                        <div className="flex items-center gap-3 lg:gap-5">
                            <div className="w-10 h-10 lg:w-12 lg:h-12 bg-blue-100 dark:bg-blue-600/20 rounded-xl shrink-0 flex items-center justify-center" aria-hidden="true">
                                <span className="material-icons-round text-blue-600 dark:text-blue-400 text-xl lg:text-2xl">manage_search</span>
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-white text-sm lg:text-xl">Filtros Avanzados</h3>
                                <p className="text-xs lg:text-base text-slate-500 dark:text-slate-400 leading-tight">Búsquedas ultra precisas.</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 lg:gap-5">
                            <div className="w-10 h-10 lg:w-12 lg:h-12 bg-purple-100 dark:bg-purple-600/20 rounded-xl shrink-0 flex items-center justify-center" aria-hidden="true">
                                <span className="material-icons-round text-purple-600 dark:text-purple-400 text-xl lg:text-2xl">history</span>
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-white text-sm lg:text-xl">Historial Ilimitado</h3>
                                <p className="text-xs lg:text-base text-slate-500 dark:text-slate-400 leading-tight">Guarda tus consultas.</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 lg:gap-5">
                            <div className="w-10 h-10 lg:w-12 lg:h-12 bg-emerald-100 dark:bg-emerald-600/20 rounded-xl shrink-0 flex items-center justify-center" aria-hidden="true">
                                <span className="material-icons-round text-emerald-600 dark:text-emerald-400 text-xl lg:text-2xl">no_encryption</span>
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-white text-sm lg:text-xl">Sin Captchas</h3>
                                <p className="text-xs lg:text-base text-slate-500 dark:text-slate-400 leading-tight">Acceso sin verificaciones.</p>
                            </div>
                        </div>

                    </div>
                </div>

            </div>
        </Modal>
    );
}
