import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Modal from './ui/Modal';
import { ModalButton, ModalCloseButton } from './ui/ModalElements';
import { Z_INDEX } from '../lib/zIndex';

const slides = [
    {
        id: 1,
        image: '/guidelines/primera-imagen-incorrecta.png',
        title: 'Incorrecto',
        description: 'No subas fotos donde se vea todo tu cuerpo o estés muy lejos de la cámara.',
        icon: 'cancel',
        tone: 'danger',
        isCorrect: false
    },
    {
        id: 2,
        image: '/guidelines/segunda-imagen-incorrecta.png',
        title: 'Incorrecto',
        description: 'No subas fotos borrosas, movidas o capturas de baja calidad.',
        icon: 'cancel',
        tone: 'danger',
        isCorrect: false
    },
    {
        id: 3,
        image: '/guidelines/tercera-imagen-correcta.png',
        title: 'Correcto',
        description: 'Sube una foto clara, de frente, con tu rostro centrado y completamente visible.',
        icon: 'check_circle',
        tone: 'success',
        isCorrect: true
    }
];

export default function UploadGuidelinesModal({ isOpen, onComplete }) {
    const [currentSlide, setCurrentSlide] = useState(0);
    const [timeLeft, setTimeLeft] = useState(3);
    const hasCalledComplete = useRef(false);

    const completeOnce = useCallback(() => {
        if (hasCalledComplete.current) return;
        hasCalledComplete.current = true;
        onComplete();
    }, [onComplete]);

    useEffect(() => {
        let syncTimer;
        if (!isOpen) {
            syncTimer = setTimeout(() => {
                setCurrentSlide(0);
                setTimeLeft(3);
            }, 0);
            hasCalledComplete.current = false;
            return () => clearTimeout(syncTimer);
        }

        const slideInterval = setInterval(() => {
            setCurrentSlide(prev => (prev + 1) % slides.length);
        }, 1000);

        const countdownInterval = setInterval(() => {
            setTimeLeft(prev => (prev <= 1 ? 0 : prev - 1));
        }, 1000);

        return () => {
            clearInterval(slideInterval);
            clearInterval(countdownInterval);
            clearTimeout(syncTimer);
        };
    }, [isOpen]);

    useEffect(() => {
        if (isOpen && timeLeft === 0) {
            completeOnce();
        }
    }, [completeOnce, isOpen, timeLeft]);

    const slide = slides[currentSlide];

    return (
        <Modal
            isOpen={isOpen}
            onClose={completeOnce}
            size="sm"
            closeOnOverlay={false}
            panelClassName="overflow-hidden"
            zIndex={Z_INDEX.modalAbove}
        >
            <ModalCloseButton onClick={completeOnce} label="Cerrar guía" />

            <div className="relative aspect-square bg-slate-100 p-6 dark:bg-slate-800">
                <AnimatePresence mode="wait">
                    <motion.img
                        key={slide.id}
                        src={slide.image}
                        alt={`${slide.title}: ${slide.description}`}
                        initial={{ opacity: 0, scale: 0.97 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.03 }}
                        transition={{ duration: 0.2 }}
                        className="h-full w-full rounded-lg object-contain"
                    />
                </AnimatePresence>
            </div>

            <div className="space-y-5 p-5 text-center">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={slide.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-2"
                    >
                        <div className={`flex items-center justify-center gap-2 text-lg font-bold ${
                            slide.isCorrect ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'
                        }`}>
                            <span className="material-icons-round" aria-hidden="true">{slide.icon}</span>
                            {slide.title}
                        </div>
                        <p className="min-h-[44px] text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                            {slide.description}
                        </p>
                    </motion.div>
                </AnimatePresence>

                <div className="flex justify-center gap-2" aria-label="Progreso de la guía">
                    {slides.map((item, idx) => (
                        <span
                            key={item.id}
                            className={`h-2 rounded-full transition-all duration-200 ${
                                idx === currentSlide ? 'w-6 bg-slate-900 dark:bg-white' : 'w-2 bg-slate-300 dark:bg-slate-700'
                            }`}
                        />
                    ))}
                </div>

                <ModalButton onClick={completeOnce} className="w-full">
                    Continuar
                    <span className="text-xs font-medium opacity-70">
                        ({timeLeft}s)
                    </span>
                </ModalButton>
            </div>
        </Modal>
    );
}
