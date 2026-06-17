import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import Modal from './ui/Modal';
import { Z_INDEX } from '../lib/zIndex';

export default function ModalLoading({ loading, showDonation, onClose, customMessage = null }) {
    const [showQRViewer, setShowQRViewer] = useState(false);
    const [timeLeft, setTimeLeft] = useState(0);

    // Countdown logic
    useEffect(() => {
        let timer;
        let syncTimer;
        if (loading && customMessage) {
            let total = 0;
            if (customMessage.includes("120s")) total = 120;
            else if (customMessage.includes("50s")) total = 50;

            if (total > 0) {
                syncTimer = setTimeout(() => setTimeLeft(total), 0);
                timer = setInterval(() => {
                    setTimeLeft(prev => (prev > 0 ? prev - 1 : 0));
                }, 1000);
            }
        } else {
            syncTimer = setTimeout(() => setTimeLeft(0), 0);
        }
        return () => {
            clearInterval(timer);
            clearTimeout(syncTimer);
        };
    }, [loading, customMessage]);

    return (
        <>
            {/* Main modal: loading or donation state */}
            <Modal
                isOpen={loading || showDonation}
                onClose={onClose}
                size="sm"
                panelClassName="overflow-hidden md:max-w-3xl"
                closeOnOverlay={false}
            >
                {/* Decorative gradient header */}
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" aria-hidden="true" />

                <div className="p-5 md:p-8 text-center relative">
                    {loading ? (
                        // LOADING STATE - Spinner + Donation QR
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 items-center">

                            {/* Left Column: Spinner & Text */}
                            <div className="flex flex-col items-center justify-center space-y-4 md:border-r md:border-slate-200 dark:md:border-slate-700 md:pr-4">
                                <div className="relative">
                                    <div className="w-16 h-16 md:w-20 md:h-20 border-4 border-blue-100 dark:border-slate-700 rounded-full" aria-hidden="true" />
                                    <div className="absolute top-0 left-0 w-16 h-16 md:w-20 md:h-20 border-4 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin" aria-hidden="true" />
                                    {timeLeft > 0 && (
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <span className="text-xl font-black text-blue-600 dark:text-blue-400">{timeLeft}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="w-full">
                                    <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white mb-1">
                                        {customMessage ? customMessage : "Buscando datos..."}
                                    </h2>
                                    <p className="text-sm md:text-base text-slate-600 dark:text-slate-400">
                                        {timeLeft > 0 ? "Procesando documentos pesados..." : "Consultando bases de datos"}
                                    </p>

                                    {timeLeft > 0 && (
                                        <div className="mt-4 w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-200 dark:border-slate-700">
                                            <motion.div
                                                className="h-full bg-blue-600"
                                                initial={{ width: "0%" }}
                                                animate={{
                                                    width: `${((customMessage.includes("120s") ? 120 : 50) - timeLeft) / (customMessage.includes("120s") ? 120 : 50) * 100}%`
                                                }}
                                                transition={{ duration: 1, ease: "linear" }}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Divider (Mobile Only) */}
                            <div className="w-full border-t border-slate-200 dark:border-slate-700 md:hidden" aria-hidden="true" />

                            <div className="w-full flex flex-col items-center justify-center space-y-3">
                                <motion.div
                                    initial={{ scale: 1 }}
                                    animate={{ scale: [1, 1.05, 1] }}
                                    transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                                    onClick={() => setShowQRViewer(true)}
                                    className="bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 p-1 rounded-2xl shadow-lg cursor-pointer hover:shadow-xl transition-shadow"
                                    aria-label="Ver QR de donación ampliado"
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => e.key === 'Enter' && setShowQRViewer(true)}
                                >
                                    <div className="bg-white p-2 rounded-xl">
                                        <img src="/yape-qr.png" alt="Yape QR código de donación" className="w-36 h-36 md:w-40 md:h-40 object-contain mx-auto" />
                                    </div>
                                </motion.div>

                                <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-4 rounded-2xl border border-purple-200 dark:border-purple-800 w-full">
                                    <div className="flex items-center justify-center gap-2 mb-1.5">
                                        <span className="material-icons-round text-purple-600 dark:text-purple-400 text-xl" aria-hidden="true">volunteer_activism</span>
                                        <h3 className="text-base font-bold text-slate-900 dark:text-white">¿Nos apoyas?</h3>
                                    </div>
                                    <p className="text-xs text-slate-700 dark:text-slate-300 mb-2 leading-relaxed">
                                        Tu apoyo mantiene este servicio <span className="font-bold text-purple-600 dark:text-purple-400">gratuito</span>
                                    </p>
                                    <div className="bg-white dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                                        <p className="font-bold text-slate-900 dark:text-white text-sm">YER** VIL.</p>
                                        <div className="flex items-center justify-between mt-1">
                                            <p className="text-xs font-mono text-slate-500 dark:text-slate-400 font-bold">928 *** 585</p>
                                            <span className="text-xs bg-purple-600 text-white px-2 py-0.5 rounded-full font-bold uppercase">Yape</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        // DONATION ONLY STATE
                        <div className="flex flex-col">
                            <div className="overflow-y-auto md:overflow-visible px-1 -[] md:max-h-none">
                                <div className="flex flex-col md:flex-row items-center gap-4 md:gap-12 pb-2 md:pb-6">

                                    {/* Content Section (Mobile: Top, Desktop: Right) */}
                                    <div className="flex flex-col items-center md:items-start text-center md:text-left md:w-1/2 space-y-4 md:space-y-6 order-1 md:order-2">
                                        <div className="space-y-2 md:space-y-4">
                                            <div className="inline-flex items-center gap-2 bg-purple-100 dark:bg-purple-900/30 p-2 md:p-3 rounded-2xl w-fit">
                                                <span className="material-icons-round text-purple-600 dark:text-purple-400 text-2xl md:text-3xl" aria-hidden="true">volunteer_activism</span>
                                                <h2 className="hidden md:block text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                                                    Apoya el Proyecto
                                                </h2>
                                            </div>

                                            <h2 className="md:hidden text-xl font-bold text-slate-900 dark:text-white">
                                                Apoya el Proyecto
                                            </h2>

                                            <p className="text-xs md:text-lg text-slate-600 dark:text-slate-300 leading-relaxed max-w-xs md:max-w-none">
                                                Tu apoyo es vital para mantener este servicio <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-500">gratuito</span> para todos.
                                            </p>
                                        </div>

                                        {/* Info Box */}
                                        <div className="w-full bg-slate-50 dark:bg-slate-800/80 p-3 md:p-5 rounded-3xl border-2 border-slate-100 dark:border-slate-700/50 shadow-inner group">
                                            <div className="space-y-2 md:space-y-4">
                                                <div className="flex justify-between items-end">
                                                    <div>
                                                        <p className="text-xs uppercase tracking-[0.2em] font-black text-slate-400 mb-0.5">Titular</p>
                                                        <p className="font-bold text-slate-900 dark:text-white text-sm md:text-lg group-hover:text-purple-600 transition-colors">YER** VIL.</p>
                                                    </div>
                                                    <div className="bg-purple-600 text-white px-2.5 py-1 rounded-full text-xs font-black shadow-lg shadow-purple-500/30 uppercase">
                                                        Yape
                                                    </div>
                                                </div>
                                                <div>
                                                    <p className="text-xs uppercase tracking-[0.2em] font-black text-slate-400 mb-0.5">Número</p>
                                                    <p className="text-sm md:text-lg font-mono text-slate-700 dark:text-slate-200 font-bold tracking-wider">928 *** 585</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* QR Section (Mobile: Middle, Desktop: Left) */}
                                    <div className="flex flex-col items-center space-y-2 md:space-y-4 md:w-1/2 order-2 md:order-1">
                                        <motion.div
                                            initial={{ scale: 0.9, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            transition={{ delay: 0.2 }}
                                            className="relative group"
                                        >
                                            <div className="absolute inset-0 bg-gradient-to-tr from-purple-500 to-orange-400 blur-2xl opacity-20 group-hover:opacity-40 transition-opacity" aria-hidden="true" />

                                            <motion.div
                                                animate={{ y: [0, -5, 0], rotate: [0, 0.5, -0.5, 0] }}
                                                transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                                                onClick={() => setShowQRViewer(true)}
                                                role="button"
                                                tabIndex={0}
                                                aria-label="Ver QR de donación ampliado"
                                                onKeyDown={(e) => e.key === 'Enter' && setShowQRViewer(true)}
                                                className="relative bg-gradient-to-br from-purple-600 via-pink-500 to-orange-500 p-1.5 rounded-[2rem] shadow-2xl cursor-pointer transform-gpu transition-transform hover:scale-105 active:scale-95"
                                            >
                                                <div className="bg-white p-2 md:p-5 rounded-[1.7rem]">
                                                    <img src="/yape-qr.png" alt="Yape QR código de donación" className="w-32 h-32 md:w-64 md:h-64 object-contain mx-auto" />
                                                </div>
                                            </motion.div>
                                        </motion.div>

                                        <p className="text-slate-400 text-xs md:text-sm font-medium animate-pulse">
                                            {window.innerWidth < 768 ? 'Toca para ampliar' : 'Haz clic para ampliar'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Action */}
                            <div className="pt-3 md:pt-6 border-t border-slate-100 dark:border-slate-800">
                                <motion.button
                                    whileHover={{ scale: 1.02, opacity: 0.9 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={onClose}
                                    className="w-full min-h-[44px] py-3.5 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black text-sm md:text-base shadow-xl active:shadow-inner"
                                >
                                    Cerrar y Continuar
                                </motion.button>
                            </div>
                        </div>
                    )}
                </div>
            </Modal>

            {/* QR Image Viewer — nested Modal above the main one */}
            <Modal
                isOpen={showQRViewer}
                onClose={() => setShowQRViewer(false)}
                size="sm"
                zIndex={Z_INDEX.modalAbove}
                panelClassName="overflow-hidden"
            >
                <button
                    onClick={() => setShowQRViewer(false)}
                    aria-label="Cerrar visor de QR"
                    className="absolute top-3 right-3 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shadow-lg z-10"
                >
                    <span className="material-icons-round text-xl" aria-hidden="true">close</span>
                </button>

                <div className="p-6 pt-14">
                    <img src="/yape-qr.png" alt="Código QR Yape" className="w-full h-auto object-contain" />
                    <p className="text-center text-sm text-slate-600 dark:text-slate-400 mt-4 font-medium">
                        Escanea el código QR con Yape
                    </p>
                </div>
            </Modal>
        </>
    );
}
