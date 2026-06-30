import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import Modal from './ui/Modal';
import { ModalButton, ModalCloseButton, ModalHeader, ModalSection } from './ui/ModalElements';
import { Z_INDEX } from '../lib/zIndex';

const getExpectedSeconds = (type, message) => {
    if (type === 'reniec') return 20;
    if (type === 'fiscalia') return 30;
    if (type === 'policiales' || type === 'judiciales' || type === 'penales') return 25;
    if (type === 'vehiculos') return 15;
    if (type === 'telefonos') return 15;

    if (!message) return 0;
    if (message.includes('120s')) return 120;
    if (message.includes('50s')) return 50;
    return 15;
};

// 4 etapas de carga con ~5 variantes aleatorias cada una
const ALL_LOADING_PHRASES = {
    default: {
        stage1: [ // 0-3 segundos
            "Estableciendo conexión segura...",
            "Iniciando búsqueda en los registros...",
            "Preparando motores de búsqueda...",
            "Conectando con el servidor central...",
            "Analizando parámetros de entrada..."
        ],
        stage2: [ // 3-8 segundos
            "Consultando bases de datos gubernamentales...",
            "Cruzando información en tiempo real...",
            "Buscando coincidencias exactas...",
            "Verificando identidad en el sistema...",
            "Procesando grandes volúmenes de datos..."
        ],
        stage3: [ // 8-15 segundos
            "Aún buscando... esto puede tomar un momento...",
            "Recopilando antecedentes e historiales...",
            "Filtrando resultados encontrados...",
            "Validando la autenticidad de los datos...",
            "Consolidando el reporte de información..."
        ],
        stage4: [ // > 15 segundos
            "¡Casi listo! Dando formato al documento...",
            "Optimizando imágenes y certificados...",
            "Generando la vista final para ti...",
            "La búsqueda está tardando un poco, por favor espera...",
            "Ultimando detalles de tu consulta..."
        ]
    },
    reniec: {
        stage1: ["Conectando con RENIEC...", "Estableciendo conexión segura..."],
        stage2: ["Consultando padrón nacional...", "Verificando identidad..."],
        stage3: ["Cruzando datos biométricos...", "Recopilando información..."],
        stage4: ["Generando ficha RENIEC...", "Aún buscando... esto puede tomar un momento..."]
    },
    fiscalia: {
        stage1: ["Conectando con el Ministerio Público...", "Iniciando búsqueda de casos..."],
        stage2: ["Buscando antecedentes y denuncias...", "Consultando registros fiscales..."],
        stage3: ["Filtrando casos fiscales...", "Recopilando historiales..."],
        stage4: ["Consolidando reporte fiscal...", "Procesando documento..."]
    },
    policiales: {
        stage1: ["Conectando con la PNP...", "Estableciendo conexión..."],
        stage2: ["Consultando antecedentes policiales...", "Verificando base de datos PNP..."],
        stage3: ["Verificando requisitorias...", "Cruzando información..."],
        stage4: ["Generando certificado policial...", "Dando formato al documento..."]
    },
    judiciales: {
        stage1: ["Conectando con el Poder Judicial...", "Estableciendo conexión..."],
        stage2: ["Consultando antecedentes judiciales...", "Verificando registros..."],
        stage3: ["Verificando condenas...", "Cruzando información..."],
        stage4: ["Generando certificado judicial...", "Dando formato al documento..."]
    },
    penales: {
        stage1: ["Conectando con el INPE...", "Conectando con el Poder Judicial..."],
        stage2: ["Consultando antecedentes penales...", "Verificando registros..."],
        stage3: ["Verificando registros penitenciarios...", "Cruzando información..."],
        stage4: ["Generando certificado penal...", "Dando formato al documento..."]
    },
    vehiculos: {
        stage1: ["Conectando con SUNARP y MTC...", "Preparando consulta..."],
        stage2: ["Consultando registro vehicular...", "Buscando placa..."],
        stage3: ["Verificando papeletas y SOAT...", "Recopilando historial..."],
        stage4: ["Consolidando información del vehículo...", "Generando reporte..."]
    },
    telefonos: {
        stage1: ["Conectando con operadoras de telecomunicaciones...", "Iniciando consulta..."],
        stage2: ["Verificando titularidad de la línea...", "Consultando registros..."],
        stage3: ["Buscando líneas asociadas...", "Cruzando información..."],
        stage4: ["Generando reporte telefónico...", "Consolidando reporte..."]
    }
};

const getRandomPhrase = (stageArray) => stageArray[Math.floor(Math.random() * stageArray.length)];

export default function ModalLoading({ loading, showDonation, onClose, customMessage = null, loadingType = 'default' }) {
    const [showQRViewer, setShowQRViewer] = useState(false);
    const [timeLeft, setTimeLeft] = useState(0);
    const [elapsedTime, setElapsedTime] = useState(0);
    const phrases = ALL_LOADING_PHRASES[loadingType] || ALL_LOADING_PHRASES['default'];
    const [currentPhrase, setCurrentPhrase] = useState(phrases.stage1[0]);
    const totalSeconds = getExpectedSeconds(loadingType, customMessage);

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

    useEffect(() => {
        let timer;
        let phraseInterval;
        
        if (loading) {
            setElapsedTime(0);
            setCurrentPhrase(getRandomPhrase(phrases.stage1));
            
            // Incrementar elapsed time cada segundo
            timer = setInterval(() => {
                setElapsedTime(prev => prev + 1);
            }, 1000);

            // Cambiar de frase aleatoriamente cada 2-3 segundos dentro de la etapa correspondiente
            phraseInterval = setInterval(() => {
                setElapsedTime((currentElapsed) => {
                    let nextPhrase = '';
                    if (currentElapsed < 3) nextPhrase = getRandomPhrase(phrases.stage1);
                    else if (currentElapsed < 8) nextPhrase = getRandomPhrase(phrases.stage2);
                    else if (currentElapsed < 15) nextPhrase = getRandomPhrase(phrases.stage3);
                    else nextPhrase = getRandomPhrase(phrases.stage4);
                    
                    setCurrentPhrase(nextPhrase);
                    return currentElapsed; // Keep same value, just needed it for closure
                });
            }, 2500);
        } else {
            setElapsedTime(0);
            setCurrentPhrase(phrases.stage1[0]);
        }

        return () => {
            clearInterval(timer);
            clearInterval(phraseInterval);
        };
    }, [loading]);

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
                                            <span className="text-xl font-bold text-blue-700 dark:text-blue-300">{Math.round(progress)}%</span>
                                        </div>
                                    )}
                                </div>

                                <div className="min-h-[80px] w-full flex flex-col items-center justify-center">
                                    <AnimatePresence mode="wait">
                                        <motion.div
                                            key={currentPhrase}
                                            initial={{ opacity: 0, y: 5 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -5 }}
                                            transition={{ duration: 0.3 }}
                                            className="w-full"
                                        >
                                            <ModalHeader
                                                title={customMessage || 'Buscando datos...'}
                                                description={currentPhrase}
                                                tone="info"
                                                align="center"
                                                reserveCloseSpace={false}
                                            />
                                        </motion.div>
                                    </AnimatePresence>
                                </div>

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
