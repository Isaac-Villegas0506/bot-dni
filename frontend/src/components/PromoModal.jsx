import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApiUrl } from '../utils/api';
import { motion, AnimatePresence } from 'framer-motion';
import { Z_INDEX } from '../lib/zIndex';

export default function PromoModal({ isOpen, onClose }) {
    const navigate = useNavigate();
    const [banners, setBanners] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isOpen) {
            fetchBanners();
        } else {
            // Reset state when closed
            setCurrentIndex(0);
        }
    }, [isOpen]);

    const fetchBanners = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/banners');
            if (res.ok) {
                const data = await res.json();
                setBanners(data);
                
                // Si no hay banners, cerramos automáticamente
                if (data.length === 0) {
                    onClose();
                }
            }
        } catch (error) {
            console.error("Error fetching banners:", error);
            onClose(); // Cerrar si falla para no bloquear
        } finally {
            setLoading(false);
        }
    };

    // Auto slide every 5 seconds
    useEffect(() => {
        if (!isOpen || banners.length <= 1) return;
        
        const timer = setInterval(() => {
            setCurrentIndex(prev => (prev + 1) % banners.length);
        }, 5000);
        
        return () => clearInterval(timer);
    }, [isOpen, banners.length]);

    if (!isOpen || banners.length === 0) return null;

    const currentBanner = banners[currentIndex];

    const handleBannerClick = () => {
        onClose();
        if (currentBanner.target_url) {
            // Check if it's an external link or internal route
            if (currentBanner.target_url.startsWith('http')) {
                window.open(currentBanner.target_url, '_blank');
            } else {
                navigate(currentBanner.target_url);
            }
        }
    };

    const nextSlide = (e) => {
        e.stopPropagation();
        setCurrentIndex(prev => (prev + 1) % banners.length);
    };

    const prevSlide = (e) => {
        e.stopPropagation();
        setCurrentIndex(prev => (prev - 1 + banners.length) % banners.length);
    };

    return (
        <div 
            className="fixed inset-0 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
            style={{ zIndex: Z_INDEX.modalAbove }}
            onClick={onClose}
        >
            <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                onClick={(e) => e.stopPropagation()}
                className="relative bg-transparent rounded-2xl md:rounded-3xl shadow-2xl overflow-hidden flex items-center justify-center max-w-4xl w-full max-h-[90vh]"
            >
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-3 right-3 z-50 w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur-md transition-colors"
                >
                    <span className="material-icons-round text-lg md:text-xl">close</span>
                </button>

                {loading ? (
                    <div className="w-full aspect-[4/5] md:aspect-[16/9] bg-slate-800 animate-pulse rounded-2xl flex items-center justify-center">
                        <span className="material-icons-round animate-spin text-white text-4xl">refresh</span>
                    </div>
                ) : (
                    <div 
                        className="relative w-full cursor-pointer group rounded-2xl md:rounded-3xl overflow-hidden aspect-[4/5] md:aspect-[21/9]"
                        onClick={handleBannerClick}
                    >
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={currentIndex}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.3 }}
                                className="w-full h-full"
                            >
                                <picture className="w-full h-full block">
                                    <source media="(max-width: 767px)" srcSet={getApiUrl(currentBanner.image_url_mobile)} />
                                    <source media="(min-width: 768px)" srcSet={getApiUrl(currentBanner.image_url_desktop)} />
                                    <img 
                                        src={getApiUrl(currentBanner.image_url_desktop)} 
                                        alt={currentBanner.title || 'Promoción'} 
                                        className="w-full h-full object-cover"
                                    />
                                </picture>
                            </motion.div>
                        </AnimatePresence>

                        {/* Navigation Arrows (only if multiple banners) */}
                        {banners.length > 1 && (
                            <>
                                <button 
                                    onClick={prevSlide}
                                    className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 w-8 h-8 md:w-10 md:h-10 rounded-full bg-black/20 hover:bg-black/50 text-white backdrop-blur flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <span className="material-icons-round">chevron_left</span>
                                </button>
                                <button 
                                    onClick={nextSlide}
                                    className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 w-8 h-8 md:w-10 md:h-10 rounded-full bg-black/20 hover:bg-black/50 text-white backdrop-blur flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <span className="material-icons-round">chevron_right</span>
                                </button>

                                {/* Dots */}
                                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-40 bg-black/20 px-3 py-1.5 rounded-full backdrop-blur">
                                    {banners.map((_, idx) => (
                                        <button
                                            key={idx}
                                            onClick={(e) => { e.stopPropagation(); setCurrentIndex(idx); }}
                                            className={`transition-all duration-300 rounded-full ${
                                                idx === currentIndex 
                                                ? 'w-4 h-1.5 bg-white' 
                                                : 'w-1.5 h-1.5 bg-white/50 hover:bg-white/80'
                                            }`}
                                            aria-label={`Ir a banner ${idx + 1}`}
                                        />
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                )}
            </motion.div>
        </div>
    );
}
