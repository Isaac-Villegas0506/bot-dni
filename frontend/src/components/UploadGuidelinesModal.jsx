import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const slides = [
    {
        id: 1,
        image: '/guidelines/primera-imagen-incorrecta.png',
        title: 'Incorrecto',
        description: 'No subas fotos donde se vea todo tu cuerpo o estés muy lejos de la cámara.',
        isCorrect: false
    },
    {
        id: 2,
        image: '/guidelines/segunda-imagen-incorrecta.png',
        title: 'Incorrecto',
        description: 'No subas fotos borrosas, movidas o capturas de baja calidad.',
        isCorrect: false
    },
    {
        id: 3,
        image: '/guidelines/tercera-imagen-correcta.png',
        title: 'Correcto',
        description: 'Sube una foto clara, de frente, con tu rostro centrado y completamente visible.',
        isCorrect: true
    }
];

export default function UploadGuidelinesModal({ isOpen, onComplete }) {
    const [currentSlide, setCurrentSlide] = useState(0);
    const [timeLeft, setTimeLeft] = useState(3);
    const hasCalledComplete = React.useRef(false);

    useEffect(() => {
        if (!isOpen) {
            setCurrentSlide(0);
            setTimeLeft(3);
            hasCalledComplete.current = false;
            return;
        }

        // Carousel timer
        const slideInterval = setInterval(() => {
            setCurrentSlide(prev => (prev + 1) % slides.length);
        }, 1000);

        // Countdown timer
        const countdownInterval = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => {
            clearInterval(slideInterval);
            clearInterval(countdownInterval);
        };
    }, [isOpen]);

    // Trigger onComplete when timeLeft reaches 0
    useEffect(() => {
        if (isOpen && timeLeft === 0 && !hasCalledComplete.current) {
            hasCalledComplete.current = true;
            onComplete();
        }
    }, [isOpen, timeLeft, onComplete]);

    if (!isOpen) return null;

    const slide = slides[currentSlide];

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
            >
                <motion.div
                    initial={{ scale: 0.95, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.95, y: 20 }}
                    className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden flex flex-col"
                >
                    {/* Image Area */}
                    <div className="relative w-full aspect-square bg-slate-100 dark:bg-slate-800 p-6 flex items-center justify-center">
                        <AnimatePresence mode="wait">
                            <motion.img
                                key={slide.id}
                                src={slide.image}
                                alt={slide.title}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 1.05 }}
                                transition={{ duration: 0.3 }}
                                className="w-full h-full object-contain rounded-xl drop-shadow-md"
                            />
                        </AnimatePresence>
                    </div>

                    {/* Content Area */}
                    <div className="p-6 flex flex-col items-center text-center">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={slide.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.3 }}
                                className="flex flex-col items-center"
                            >
                                <div className={`flex items-center gap-2 mb-2 font-bold text-lg ${slide.isCorrect ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                    <span className="material-icons-round">
                                        {slide.isCorrect ? 'check_circle' : 'cancel'}
                                    </span>
                                    {slide.title}
                                </div>
                                <p className="text-slate-600 dark:text-slate-300 text-sm h-12 flex items-center justify-center">
                                    {slide.description}
                                </p>
                            </motion.div>
                        </AnimatePresence>

                        {/* Indicators */}
                        <div className="flex gap-2 mt-6 mb-4">
                            {slides.map((_, idx) => (
                                <div
                                    key={idx}
                                    className={`w-2 h-2 rounded-full transition-all duration-300 ${
                                        idx === currentSlide ? 'bg-slate-800 dark:bg-white w-4' : 'bg-slate-300 dark:bg-slate-700'
                                    }`}
                                />
                            ))}
                        </div>

                        {/* Countdown */}
                        <div className="text-xs font-semibold text-slate-400 dark:text-slate-500 animate-pulse">
                            Esta ventana se cerrará en {timeLeft} segundo{timeLeft !== 1 ? 's' : ''}...
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
