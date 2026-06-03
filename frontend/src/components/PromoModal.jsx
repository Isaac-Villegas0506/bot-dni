import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

export default function PromoModal() {
    const [isOpen, setIsOpen] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        // Mostrar el modal si no se ha mostrado en las últimas 24 horas
        const lastSeen = localStorage.getItem('promoModalLastSeen');
        const now = new Date().getTime();
        
        if (!lastSeen || now - parseInt(lastSeen) > 24 * 60 * 60 * 1000) {
            const timer = setTimeout(() => {
                setIsOpen(true);
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, []);

    const handleClose = () => {
        setIsOpen(false);
        localStorage.setItem('promoModalLastSeen', new Date().getTime().toString());
    };

    const handleAction = () => {
        handleClose();
        navigate('/creditos');
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    key="promo-modal"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, transition: { duration: 0.2 } }}
                    className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-md z-[99999] flex flex-col items-center justify-end sm:justify-center p-4 sm:p-6"
                >
                    <motion.div
                        initial={{ scale: 0.95, y: 100, opacity: 0 }}
                        animate={{ scale: 1, y: 0, opacity: 1 }}
                        exit={{ scale: 0.95, y: 40, opacity: 0, transition: { duration: 0.2, ease: "easeIn" } }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="bg-white/80 dark:bg-[#1c1c1e]/80 backdrop-blur-2xl rounded-[38px] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] w-full max-w-[380px] overflow-hidden relative border border-white/50 dark:border-white/10"
                    >
                        {/* Botón de cerrar superior */}
                        <div className="absolute top-4 right-4 z-20">
                            <button
                                onClick={handleClose}
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200/50 dark:bg-black/20 hover:bg-slate-300/50 dark:hover:bg-black/40 text-slate-500 dark:text-slate-400 transition-colors"
                            >
                                <span className="material-icons-round text-[18px]">close</span>
                            </button>
                        </div>
                        
                        <div className="pt-10 px-6 pb-6 text-center relative z-10">
                            {/* Icono central estilo iOS (App Icon) */}
                            <div className="relative mx-auto w-[84px] h-[84px] mb-6 shadow-xl rounded-[22px] overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center p-0.5">
                                <div className="absolute inset-0 bg-white/20 blur-md pointer-events-none" />
                                <span className="material-icons-round text-white text-[42px] drop-shadow-md z-10">
                                    stars
                                </span>
                            </div>
                            
                            <h2 className="text-[24px] font-semibold text-slate-900 dark:text-white tracking-tight mb-2 leading-tight">
                                Gana Créditos<br />Ilimitados
                            </h2>
                            
                            <p className="text-slate-500 dark:text-[#ebebf5]/60 text-[15px] leading-relaxed mb-6 px-2">
                                Invita a tus amigos con tu enlace de referido o sube un video a TikTok para desbloquear beneficios exclusivos.
                            </p>
                            
                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={handleAction}
                                    className="w-full py-3.5 px-6 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white rounded-[18px] font-semibold text-[16px] transition-all active:scale-[0.97] flex items-center justify-center gap-2"
                                >
                                    <span className="material-icons-round text-[20px]">play_circle</span>
                                    <span>Comenzar ahora</span>
                                </button>
                                
                                <button
                                    onClick={handleClose}
                                    className="w-full py-3 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-[16px] font-medium transition-colors rounded-[18px] active:bg-blue-50/50 dark:active:bg-blue-900/20"
                                >
                                    Recordarme luego
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
