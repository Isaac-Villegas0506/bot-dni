import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import Modal from './ui/Modal';
import { ModalButton, ModalCloseButton, ModalHeader, ModalSection } from './ui/ModalElements';
import { Z_INDEX } from '../lib/zIndex';

const getExpectedSeconds = (message) => {
    if (!message) return 0;
    if (message.includes('120s')) return 120;
    if (message.includes('50s')) return 50;
    return 0;
};

export default function ModalLoading({ loading, showDonation, onClose, customMessage = null }) {
    const [showQRViewer, setShowQRViewer] = useState(false);
    const [timeLeft, setTimeLeft] = useState(0);
    const totalSeconds = getExpectedSeconds(customMessage);

    useEffect(() => {
        let syncTimer;
        if (!loading && !showDonation) {
            syncTimer = setTimeout(() => setShowQRViewer(false), 0);
        }
        return () => clearTimeout(syncTimer);
    }, [loading, showDonation]);

    useEffect(() => {
        let timer;
        let syncTimer;

        if (loading && totalSeconds > 0) {
            syncTimer = setTimeout(() => setTimeLeft(totalSeconds), 0);
            timer = setInterval(() => {
                setTimeLeft(prev => (prev > 0 ? prev - 1 : 0));
            }, 1000);
        } else {
            syncTimer = setTimeout(() => setTimeLeft(0), 0);
        }

        return () => {
            clearInterval(timer);
            clearTimeout(syncTimer);
        };
    }, [loading, totalSeconds]);

    const openQRViewer = () => setShowQRViewer(true);
    const handleQRKeyDown = (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openQRViewer();
        }
    };

    const progress = totalSeconds > 0 ? ((totalSeconds - timeLeft) / totalSeconds) * 100 : 0;

    return (
        <>
            <Modal
                isOpen={loading || showDonation}
                onClose={onClose}
                size="sm"
                panelClassName="overflow-hidden md:max-w-3xl"
                closeOnOverlay={false}
            >
                {showDonation && !loading && <ModalCloseButton onClick={onClose} />}

                <div className="p-5 md:p-8">
                    {loading ? (
                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
                            <div className="flex flex-col items-center justify-center space-y-5 text-center md:border-r md:border-slate-200 md:pr-6 dark:md:border-slate-700">
                                <div className="relative">
                                    <div className="h-20 w-20 rounded-full border-4 border-slate-200 dark:border-slate-700" aria-hidden="true" />
                                    <div className="absolute inset-0 h-20 w-20 animate-spin rounded-full border-4 border-transparent border-t-blue-600 dark:border-t-blue-300" aria-hidden="true" />
                                    {timeLeft > 0 && (
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <span className="text-xl font-bold text-blue-700 dark:text-blue-300">{timeLeft}</span>
                                        </div>
                                    )}
                                </div>

                                <ModalHeader
                                    title={customMessage || 'Buscando datos...'}
                                    description={timeLeft > 0 ? 'Procesando documentos pesados.' : 'Consultando bases de datos.'}
                                    tone="info"
                                    align="center"
                                    reserveCloseSpace={false}
                                />

                                {timeLeft > 0 && (
                                    <div className="h-2 w-full overflow-hidden rounded-full border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800" aria-hidden="true">
                                        <motion.div
                                            className="h-full bg-blue-600"
                                            initial={{ width: '0%' }}
                                            animate={{ width: `${progress}%` }}
                                            transition={{ duration: 1, ease: 'linear' }}
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col items-center justify-center space-y-4 text-center">
                                <button
                                    type="button"
                                    onClick={openQRViewer}
                                    onKeyDown={handleQRKeyDown}
                                    aria-label="Ver QR de donación ampliado"
                                    className="rounded-lg border border-slate-200 bg-white p-2 shadow-sm transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:focus:ring-offset-slate-900"
                                >
                                    <img src="/yape-qr.png" alt="Código QR de donación por Yape" className="mx-auto h-40 w-40 object-contain" />
                                </button>

                                <ModalSection className="w-full text-center">
                                    <div className="mb-2 flex items-center justify-center gap-2">
                                        <h3 className="font-bold text-slate-900 dark:text-white">¿Nos apoyas?</h3>
                                    </div>
                                    <p className="mb-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                                        Tu apoyo mantiene este servicio gratuito.
                                    </p>
                                    <div className="rounded-lg border border-slate-200 bg-white p-3 text-left dark:border-slate-700 dark:bg-slate-900">
                                        <p className="text-sm font-bold text-slate-900 dark:text-white">YER** VIL.</p>
                                        <span className="mt-2 inline-flex rounded-md bg-blue-600 px-2 py-0.5 text-xs font-bold uppercase text-white">Yape</span>
                                    </div>
                                </ModalSection>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <ModalHeader
                                title="Apoya el proyecto"
                                description="Tu apoyo es vital para mantener este servicio gratuito para todos."
                                tone="info"
                                align="center"
                            />

                            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:items-center">
                                <button
                                    type="button"
                                    onClick={openQRViewer}
                                    onKeyDown={handleQRKeyDown}
                                    aria-label="Ver QR de donación ampliado"
                                    className="mx-auto rounded-lg border border-slate-200 bg-white p-2 shadow-sm transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:focus:ring-offset-slate-900"
                                >
                                    <img src="/yape-qr.png" alt="Código QR de donación por Yape" className="h-48 w-48 object-contain md:h-64 md:w-64" />
                                </button>

                                <ModalSection className="space-y-4">
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Titular</p>
                                        <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">YER** VIL.</p>
                                    </div>
                                    <span className="inline-flex rounded-md bg-blue-600 px-2.5 py-1 text-xs font-bold uppercase text-white">
                                        Yape
                                    </span>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                        Toca el QR para ampliarlo.
                                    </p>
                                </ModalSection>
                            </div>

                            <ModalButton onClick={onClose} className="w-full">
                                Cerrar y continuar
                            </ModalButton>
                        </div>
                    )}
                </div>
            </Modal>

            <Modal
                isOpen={showQRViewer}
                onClose={() => setShowQRViewer(false)}
                size="sm"
                zIndex={Z_INDEX.modalAbove}
                panelClassName="overflow-hidden"
            >
                <ModalCloseButton onClick={() => setShowQRViewer(false)} label="Cerrar visor de QR" />

                <div className="space-y-4 p-6 pt-14 text-center">
                    <ModalHeader
                        title="Código QR Yape"
                        description="Escanea el código QR con Yape."
                        tone="info"
                        align="center"
                        reserveCloseSpace={false}
                    />
                    <img src="/yape-qr.png" alt="Código QR Yape" className="h-auto w-full object-contain" />
                </div>
            </Modal>
        </>
    );
}
