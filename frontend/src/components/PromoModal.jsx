import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

export default function PromoModal({ onClose }) {
    const navigate = useNavigate();

    const handleGoToShop = () => {
        onClose();
        navigate('/tienda');
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-[#0b101e] rounded-[2rem] shadow-2xl w-full max-w-[420px] md:max-w-[760px] border border-slate-800 relative overflow-hidden flex flex-col"
            >
                {/* Close Button */}
                <button 
                    onClick={onClose} 
                    className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-slate-800/80 text-slate-300 flex items-center justify-center hover:bg-slate-700 transition-colors"
                >
                    <span className="material-icons-round text-[18px]">close</span>
                </button>

                {/* Inner Flex Container (Col on Mobile, Row on PC) */}
                <div className="flex flex-col md:flex-row relative z-10">
                    
                    {/* Left Column: Presentation */}
                    <div className="p-6 pb-2 md:p-8 md:pb-8 md:w-[45%] flex flex-col justify-center items-center md:items-start text-center md:text-left relative border-b md:border-b-0 md:border-r border-slate-800/50">
                        {/* Background Glow for Left Column */}
                        <div className="absolute inset-0 bg-indigo-500/5 blur-[80px] pointer-events-none"></div>
                        
                        {/* Top Icon */}
                        <div className="relative w-20 h-20 md:w-24 md:h-24 mb-4 md:mb-6 mx-auto md:mx-0 shrink-0">
                            {/* Particles/Confetti */}
                            <div className="absolute inset-0 pointer-events-none">
                                <span className="absolute top-0 left-2 w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse"></span>
                                <span className="absolute top-4 right-2 w-2 h-2 bg-purple-400 rotate-45"></span>
                                <span className="absolute bottom-4 left-0 w-1.5 h-1.5 bg-blue-400 rounded-full"></span>
                                <span className="absolute top-2 right-8 w-1 h-1 bg-white rounded-full"></span>
                                <span className="absolute bottom-2 right-4 w-1.5 h-1.5 bg-indigo-300 rotate-12"></span>
                                <span className="absolute top-8 -left-2 material-icons-round text-purple-500 text-[10px] rotate-45">star</span>
                                <span className="absolute top-10 -right-4 material-icons-round text-indigo-400 text-[12px] -rotate-12">star</span>
                            </div>
                            
                            {/* Center Box */}
                            <div className="w-16 h-16 md:w-20 md:h-20 mx-auto md:mx-0 rounded-2xl md:rounded-3xl bg-gradient-to-b from-[#8a6eff] to-[#5b3df6] flex items-center justify-center text-white shadow-[0_0_30px_rgba(91,61,246,0.5)]">
                                <span className="material-icons-round text-3xl md:text-4xl">card_giftcard</span>
                            </div>
                        </div>

                        <h2 className="text-[24px] md:text-[32px] font-black text-white mb-2 tracking-tight">
                            ¡Oferta Especial!
                        </h2>
                        
                        <p className="text-slate-400 font-medium text-[12px] md:text-[14px] leading-relaxed max-w-[300px] mx-auto md:mx-0">
                            Obtén tu paquete de bienvenida exclusivo (válido 1 vez por cuenta) y realiza tus consultas de inmediato.
                        </p>
                    </div>

                    {/* Right Column: Offer Details */}
                    <div className="p-6 pt-4 md:p-8 md:pt-8 md:w-[55%] flex flex-col justify-center">
                        
                        {/* Main Offer Box */}
                        <div className="bg-[#121929] border border-slate-800 rounded-xl md:rounded-2xl p-3 md:p-4 mb-4 md:mb-5 flex flex-row items-center justify-between gap-2">
                            {/* Left Side */}
                            <div className="flex flex-col items-start justify-center pl-1 md:pl-2 shrink-0">
                                <div className="flex items-center gap-2 md:gap-3 mb-1">
                                    <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-[#202046] flex items-center justify-center text-[#9f85ff] shrink-0">
                                        <span className="material-icons-round text-[14px] md:text-[18px]">star</span>
                                    </div>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-[28px] md:text-[36px] font-black text-white leading-none">15</span>
                                        <span className="text-[11px] md:text-[13px] font-bold text-[#9f85ff] uppercase tracking-wider">créditos</span>
                                    </div>
                                </div>
                                <div className="bg-[#202046] text-[#9f85ff] text-[8px] md:text-[9px] font-bold px-2 md:px-3 py-1 rounded-full uppercase tracking-widest mt-1 ml-[32px] md:ml-[44px]">
                                    Paquete de Bienvenida
                                </div>
                            </div>

                            {/* Divider (Horizontal) */}
                            <div className="w-px h-12 md:h-16 bg-slate-800 mx-1 md:mx-2 shrink-0"></div>

                            {/* Right Side */}
                            <div className="flex flex-col items-center justify-center pr-1 md:pr-2 shrink-0">
                                <span className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">por solo</span>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-[14px] md:text-[18px] font-black text-[#9f85ff]">S/</span>
                                    <span className="text-[24px] md:text-[32px] font-black text-white leading-none">1.00</span>
                                </div>
                            </div>
                        </div>

                        {/* CTA Button */}
                        <button
                            onClick={handleGoToShop}
                            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#8a6eff] to-[#6b47ff] hover:from-[#7c5dff] hover:to-[#5a36ff] text-white font-bold text-[14px] md:text-[15px] transition-all shadow-[0_0_20px_rgba(107,71,255,0.3)] active:scale-95 flex justify-center items-center gap-2 mb-4 md:mb-5"
                        >
                            Reclamar Oferta
                            <span className="material-icons-round text-lg">arrow_forward</span>
                        </button>
                        
                        {/* Footer */}
                        <div className="flex items-center justify-center gap-2">
                            <div className="h-px bg-slate-800 flex-1"></div>
                            <div className="flex items-center gap-1.5 px-2 text-slate-500">
                                <span className="material-icons-round text-[11px] md:text-[13px]">verified</span>
                                <span className="text-[9px] md:text-[11px] font-medium">Oferta válida por única vez</span>
                            </div>
                            <div className="h-px bg-slate-800 flex-1"></div>
                        </div>

                    </div>
                </div>
            </motion.div>
        </div>
    );
}
