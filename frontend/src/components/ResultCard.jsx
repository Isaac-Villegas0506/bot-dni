import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import AlertModal from './AlertModal';
import { getApiUrl } from '../utils/api';

export default function ResultCard({ result: incomingResult, searchType, onOpenDonation, onBack }) {
    const [previewData, setPreviewData] = useState(null);
    const [c4Loading, setC4Loading] = useState(false);
    const [alertModal, setAlertModal] = useState({ isOpen: false, type: 'info', title: '', message: '' });
    const cardRef = useRef(null);
    const navigate = useNavigate();

    const baseResult = incomingResult.data || incomingResult || {};
    const result = incomingResult.file_path
        ? { ...baseResult, file_path: incomingResult.file_path }
        : baseResult;

    const initials = `${result.nombres?.charAt(0) || ''}${result.apellidos?.charAt(0) || ''}`;

    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape') setPreviewData(null);
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, []);

    const handleDownloadPDF = async () => {
        if (searchType === 'premium') {
            return await generatePremiumC4PDF();
        }
        try {
            const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
            pdf.save(`dni_${result.documento}.pdf`);
        } catch (e) {
            console.error('Error generating PDF:', e);
        }
    };

    const generatePremiumC4PDF = async () => {
        try {
            setC4Loading(true);
            const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            
            const COLOR_HEADER = [0, 75, 135];
            const COLOR_BODY = [0, 91, 140];
            const COLOR_YELLOW = [255, 191, 0];
            
            const [foto, firma, huellaIzq, huellaDer, logoReniec, qrSecurity] = await Promise.all([
                result.imagen_url ? loadImgDataUrl(getApiUrl(result.imagen_url)) : Promise.resolve(null),
                result.firma_imagen ? loadImgDataUrl(getApiUrl(result.firma_imagen)) : Promise.resolve(null),
                result.huella_izquierda ? loadImgDataUrl(getApiUrl(result.huella_izquierda)) : Promise.resolve(null),
                result.huella_derecha ? loadImgDataUrl(getApiUrl(result.huella_derecha)) : Promise.resolve(null),
                loadImgDataUrl(window.location.origin + '/c4busPremiun/Reniec.png'),
                loadImgDataUrl(window.location.origin + '/c4busPremiun/qr-idperu.png')
            ]);

            pdf.setFillColor(COLOR_BODY[0], COLOR_BODY[1], COLOR_BODY[2]);
            pdf.rect(0, 0, pageWidth, pageHeight, 'F');

            pdf.setFillColor(COLOR_HEADER[0], COLOR_HEADER[1], COLOR_HEADER[2]);
            pdf.rect(0, 0, pageWidth, 100, 'F');
            if (logoReniec) {
                try {
                    pdf.addImage(logoReniec, 'PNG', 40, 15, 145, 75);
                } catch (e) { console.warn("Logo error", e); }
            }
            
            pdf.setTextColor(255, 255, 255);
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(11);
            pdf.text('REGISTRO NACIONAL DE IDENTIFICACIÓN', 200, 35);
            pdf.text('Y ESTADO CIVIL', 200, 50);
            pdf.setFontSize(10);
            pdf.text('SERVICIO DE CONSULTA EN LÍNEA', 200, 75);
            
            pdf.setDrawColor(255, 255, 255);
            pdf.setLineWidth(1.5);
            pdf.line(40, 88, pageWidth - 40, 88);

            const marginX = 50;
            let currentY = 125;
            const rowStep = 17;
            const valueX = 200;

            const fields = [
                ['DNI:', `${result.documento} - ${result.digito_verificador || '0'}`],
                ['Apellido Paterno:', result.apellidos?.split(' ')[0] || '-'],
                ['Apellido Materno:', result.apellidos?.split(' ')[1] || '-'],
                ['Nombres:', result.nombres],
                ['Fecha de Nacimiento:', result.fecha_nacimiento],
                ['Departamento:', result.nacimiento_departamento],
                ['Provincia:', result.nacimiento_provincia],
                ['Distrito:', result.nacimiento_distrito],
                ['Nombre del Padre:', result.padre?.split(' ')[0] || '-'],
                ['Nombre de la Madre:', result.madre?.split(' ')[0] || '-'],
                ['Fecha de Emisión:', result.fecha_emision],
                ['Fecha de Inscripción:', result.fecha_inscripcion],
                ['Fecha de Caducidad:', result.fecha_caducidad],
                ['Estado Civil:', result.estado_civil],
                ['Edad:', `${result.edad || '-'} AÑOS`],
                ['Sexo:', result.genero],
                ['Grado de Instrucción:', result.grado_instruccion],
                ['Dirección:', result.direccion],
                ['Ubigeo Reniec:', result.ubigeo_reniec || 'N/A'],
                ['Ubigeo Inei:', result.ubigeo_inei || 'N/A'],
                ['Restricción:', result.restricciones || 'NINGUNA']
            ];

            fields.forEach(([label, value]) => {
                pdf.setFontSize(9);
                pdf.setFont('helvetica', 'bold');
                pdf.setTextColor(255, 255, 255);
                pdf.text(label, marginX, currentY);
                
                pdf.setTextColor(COLOR_YELLOW[0], COLOR_YELLOW[1], COLOR_YELLOW[2]);
                let valStr = String(value || '-').toUpperCase();
                if (valStr.length > 45) valStr = valStr.substring(0, 42) + '...';
                pdf.text(valStr, valueX, currentY);
                
                currentY += rowStep;
            });

            const rightX = pageWidth - 150;
            let imgY = 110;

            if (foto) {
                pdf.setDrawColor(200, 200, 200);
                pdf.rect(rightX, imgY, 110, 130);
                pdf.addImage(foto, 'JPEG', rightX + 2, imgY + 2, 106, 126);
            }
            imgY += 140;

            if (huellaIzq) {
                pdf.setDrawColor(200, 200, 200);
                pdf.rect(rightX, imgY, 110, 120);
                pdf.addImage(huellaIzq, 'JPEG', rightX + 2, imgY + 2, 106, 116);
            }
            imgY += 130;

            if (huellaDer) {
                pdf.setDrawColor(200, 200, 200);
                pdf.rect(rightX, imgY, 110, 120);
                pdf.addImage(huellaDer, 'JPEG', rightX + 2, imgY + 2, 106, 116);
            }
            imgY += 130;

            const signW = 160;
            const signH = 70;
            const signX = rightX - 25;
            pdf.setFillColor(255, 255, 255);
            pdf.rect(signX, imgY, signW, signH, 'F');
            pdf.setDrawColor(0, 0, 0);
            pdf.setLineWidth(1.5);
            pdf.rect(signX, imgY, signW, signH, 'D');
            
            if (firma) {
                pdf.addImage(firma, 'JPEG', signX + 5, imgY + 5, signW - 10, signH - 10);
            } else {
                pdf.setTextColor(0, 0, 0);
                pdf.setFontSize(20);
                pdf.text('x', signX + 10, imgY + 25);
                pdf.setFontSize(10);
                pdf.text('SIN FIRMA', signX + 50, imgY + 30);
                pdf.text('DISPONIBLE', signX + 50, imgY + 45);
            }

            const footerY = pageHeight - 160;
            pdf.setTextColor(255, 255, 255);
            pdf.setFontSize(9);
            pdf.text('Puedes verificar la información en línea:', 40, footerY);

            if (qrSecurity) {
                try {
                    pdf.setFillColor(255, 255, 255);
                    pdf.rect(60, footerY + 10, 75, 75, 'F');
                    pdf.addImage(qrSecurity, 'PNG', 62.5, footerY + 12.5, 70, 70);
                    pdf.setTextColor(255, 255, 255);
                    pdf.setFontSize(8);
                    pdf.text('Escanear QR', 68, footerY + 95);
                } catch (e) { console.warn("QR error", e); }
            }

            pdf.setFillColor(COLOR_HEADER[0], COLOR_HEADER[1], COLOR_HEADER[2]);
            pdf.rect(0, pageHeight - 30, pageWidth, 30, 'F');
            pdf.setTextColor(255, 255, 255);
            pdf.setFontSize(8);
            const now = new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' });
            pdf.text(`Registro Nacional de Identificación y Estado Civil - RENIEC© 2016 ${now}`, pageWidth/2, pageHeight - 12, { align: 'center' });

            pdf.save(`C4_PREMIUM_${result.documento}.pdf`);
            setC4Loading(false);
        } catch (error) {
            console.error('Error premium PDF:', error);
            alert('Error al generar el C4 Premium');
            setC4Loading(false);
        }
    };

    const handleDownloadImage = async (url, filename) => {
        try {
            const res = await fetch(getApiUrl(url));
            const blob = await res.blob();
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = filename;
            a.click();
            URL.revokeObjectURL(a.href);
        } catch (e) {
            console.error('Error downloading image', e);
        }
    };

    const loadImgDataUrl = (url) => new Promise((resolve) => {
        if (!url) return resolve(null);
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                resolve(canvas.toDataURL('image/png'));
            } catch (e) {
                console.error("Canvas error", e);
                resolve(null);
            }
        };
        img.onerror = (e) => {
            console.error("Image load error", url, e);
            resolve(null);
        };
        const finalUrl = (url.startsWith('/') && !url.startsWith('/api')) 
            ? window.location.origin + url 
            : url;
        img.src = finalUrl;
    });

    const handleDownloadC4 = () => {
        if (searchType === 'premium') {
            generatePremiumC4PDF();
            return;
        }
        navigate('/generador', { 
            state: { 
                autoDni: result.documento, 
                autoOption: 'c4_azul' 
            } 
        });
    };

    const handleShare = async () => {
        const shareData = {
            title: `Ficha Reniec: ${result.documento}`,
            text: `📄 *Ficha Reniec*\n👤 ${result.nombres} ${result.apellidos}\n🆔 DNI: ${result.documento}\n🎂 Edad: ${result.edad || '-'} Años\n📍 ${result.distrito || '-'}, ${result.provincia || '-'}`
        };

        try {
            if (result.imagen_url && navigator.canShare && navigator.canShare({ files: [new File([], 'test.jpg')] })) {
                try {
                    const response = await fetch(getApiUrl(result.imagen_url));
                    const blob = await response.blob();
                    const file = new File([blob], `dni_${result.documento}.jpg`, { type: 'image/jpeg' });
                    await navigator.share({ ...shareData, files: [file] });
                    return;
                } catch (e) {
                    console.warn('Could not share image, falling back to text', e);
                }
            }
            if (navigator.share) {
                await navigator.share(shareData);
            } else {
                await navigator.clipboard.writeText(shareData.text);
                toast.success('Datos copiados al portapapeles');
            }
        } catch (error) {
            console.error('Error sharing:', error);
        }
    };

    const handleCopyDNI = (dni) => {
        if (!dni) return;
        navigator.clipboard.writeText(dni).then(() => toast.success('DNI copiado con éxito')).catch(() => toast.error('Error al copiar'));
    };

    if (!result) return null;

    return (
        <>
            <motion.main
                ref={cardRef}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                className="w-full max-w-md md:max-w-6xl space-y-6 pb-20 mx-auto"
            >
                <div className="w-full mb-3 px-1 flex items-center justify-between gap-2 no-print">
                    <div className="flex items-center gap-2">
                        {onBack && (
                            <button
                                onClick={onBack}
                                className="bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-95 text-slate-700 dark:text-white font-semibold h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 transition-all duration-150 flex items-center justify-center gap-2 text-sm focus-ring min-w-[44px]"
                            >
                                <span className="material-icons-round text-slate-400 text-[18px]">arrow_back</span>
                                <span>Regresar</span>
                            </button>
                        )}

                        {searchType === 'premium' && (
                            <button
                                onClick={handleDownloadC4}
                                disabled={c4Loading}
                                className="relative overflow-hidden group font-bold h-10 px-3 md:px-5 rounded-xl transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg min-w-[44px]"
                                style={{
                                    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
                                    boxShadow: '0 0 0 1.5px #c9a227, 0 8px 24px rgba(201,162,39,0.25)',
                                    color: '#f5d87e'
                                }}
                            >
                                <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                                    style={{ background: 'linear-gradient(105deg, transparent 40%, rgba(255,215,0,0.15) 50%, transparent 60%)' }}
                                />
                                {c4Loading ? (
                                    <>
                                        <span className="material-icons-round animate-spin text-base" style={{ color: '#f5d87e' }}>refresh</span>
                                        <span className="hidden md:inline">Generando...</span>
                                    </>
                                ) : (
                                    <>
                                        <span className="material-icons-round text-base group-hover:scale-110 transition-transform" style={{ color: '#f5d87e' }}>workspace_premium</span>
                                        <span className="hidden md:inline">Descargar C4</span>
                                        <span className="hidden md:inline text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-1"
                                            style={{ background: 'rgba(201,162,39,0.2)', color: '#f5d87e', border: '1px solid rgba(201,162,39,0.4)' }}>
                                            PDF
                                        </span>
                                    </>
                                )}
                            </button>
                        )}

                        {result.file_path && (
                            <button
                                onClick={async () => {
                                    try {
                                        const res = await fetch(getApiUrl(`/api/static/${result.file_path}`));
                                        const blob = await res.blob();
                                        const url = URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = result.file_path.split('/').pop() || 'resultado.pdf';
                                        document.body.appendChild(a); 
                                        a.click(); 
                                        document.body.removeChild(a);
                                        URL.revokeObjectURL(url);
                                    } catch (err) {
                                        console.error('Error al descargar archivo:', err);
                                    }
                                }}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10 px-3 md:px-5 rounded-xl shadow-lg shadow-emerald-500/30 transition-all flex items-center justify-center gap-2 group text-sm min-w-[44px]"
                            >
                                <span className="material-icons-round group-hover:animate-bounce">file_download</span>
                                <span className="hidden md:inline">Descargar Archivo</span>
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <button onClick={handleDownloadPDF} className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-semibold h-10 px-3 md:px-5 rounded-xl shadow-md shadow-blue-500/20 transition-all duration-150 flex items-center justify-center gap-2 group text-sm focus-ring min-w-[44px]">
                            <span className="material-icons-round group-hover:-translate-y-0.5 transition-transform duration-150">download</span>
                            <span className="hidden md:inline">Descargar PDF</span>
                        </button>

                        <button onClick={handleShare} className="bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-95 text-slate-700 dark:text-white font-semibold h-10 px-3 md:px-5 rounded-xl border border-slate-200 dark:border-slate-700 transition-all duration-150 flex items-center justify-center gap-2 text-sm focus-ring min-w-[44px]">
                            <span className="material-icons-round text-slate-400">share</span>
                            <span className="hidden md:inline">Compartir</span>
                        </button>

                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 md:p-8 shadow-md border border-slate-200 dark:border-slate-800 relative overflow-hidden transition-colors duration-300">
                    <div className="absolute top-0 right-0 w-32 h-32 md:w-64 md:h-64 bg-blue-500/8 dark:bg-blue-500/5 rounded-full -mr-10 -mt-10 md:-mr-20 md:-mt-20 blur-3xl pointer-events-none" />

                    <div className="flex flex-col md:flex-row md:items-start md:gap-8 relative z-10">
                        <div className="flex justify-center md:justify-start mb-6 md:mb-0">
                        <div
                                onClick={() => result.imagen_url && setPreviewData({ url: result.imagen_url, filename: `foto_${result.documento}.jpg` })}
                                onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && result.imagen_url) setPreviewData({ url: result.imagen_url, filename: `foto_${result.documento}.jpg` }); }}
                                role={result.imagen_url ? 'button' : undefined}
                                tabIndex={result.imagen_url ? 0 : undefined}
                                aria-label={result.imagen_url ? 'Ver foto ampliada' : undefined}
                                className={`relative group rounded-2xl overflow-hidden shadow-md border-2 border-slate-100 dark:border-slate-700/60 h-32 w-32 md:h-48 md:w-48 shrink-0 bg-slate-100 dark:bg-slate-800 ${result.imagen_url ? 'cursor-pointer hover:shadow-xl hover:border-blue-200 dark:hover:border-blue-700 transition-all duration-300' : ''}`}
                            >
                                {result.imagen_url ? (
                                    <>
                                        <img
                                            src={getApiUrl(result.imagen_url)}
                                            alt="Foto"
                                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                        />
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-zoom-in">
                                            <span className="material-icons-round text-white text-4xl drop-shadow-md">zoom_in</span>
                                        </div>
                                        <div className="absolute bottom-2 right-2 w-10 h-10 flex items-center justify-center shrink-0 bg-blue-600 text-white rounded-full shadow-lg transition-all duration-200 group-hover:scale-105">
                                            <span className="material-icons-round text-base">search</span>
                                        </div>
                                    </>
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-blue-700 text-white text-5xl font-bold">
                                        {initials}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex-1 text-center md:text-left pt-2">
                            <h2 className="text-2xl md:text-4xl font-bold text-slate-900 dark:text-white leading-tight mb-2 tracking-tight uppercase">
                                {result.nombres}
                            </h2>
                            <p className="text-lg md:text-2xl font-semibold text-slate-600 dark:text-slate-300 mb-6 uppercase">
                                {result.apellidos}
                            </p>

                            <div className="grid grid-cols-2 gap-4 max-w-md mx-auto md:mx-0">
                                <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                                    <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-widest font-bold mb-1">DNI</p>
                                    <div className="flex items-center justify-center md:justify-start gap-2">
                                        <p className="font-mono font-bold text-blue-700 dark:text-blue-400 text-lg md:text-xl">{result.documento}</p>
                                        <button
                                            onClick={() => handleCopyDNI(result.documento)}
                                            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-blue-600 transition-all active:scale-90 rounded-lg"
                                            aria-label="Copiar DNI"
                                            title="Copiar DNI"
                                        >
                                            <span className="material-icons-round text-[18px]">content_copy</span>
                                        </button>
                                    </div>
                                </div>
                                <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                                    <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-widest font-bold mb-1">Género</p>
                                    <div className="flex items-center justify-center md:justify-start space-x-2">
                                        <span className="material-icons-round text-lg text-blue-600 dark:text-blue-400">male</span>
                                        <p className="font-bold text-slate-900 dark:text-white text-sm md:text-base">{result.genero}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {searchType === 'premium' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white dark:bg-slate-900 rounded-2xl p-5 md:p-6 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full -mr-16 -mt-16 blur-2xl pointer-events-none" />
                        <div className="md:col-span-2 flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/30">
                                    <span className="material-icons-round text-amber-600 dark:text-amber-400 text-2xl">fingerprint</span>
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900 dark:text-white text-lg">Biometría y Firmas</h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Registros biométricos oficiales de RENIEC</p>
                                </div>
                            </div>
                            <span className="bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400 text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-widest border border-amber-200 dark:border-amber-700/50">Premium</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 md:gap-4 md:col-span-2">
                            <BioImageCard 
                                label="Firma" 
                                url={result.firma_imagen} 
                                onDownload={() => handleDownloadImage(result.firma_imagen, `firma_${result.documento}.jpg`)}
                                onPreview={() => setPreviewData({ url: result.firma_imagen, filename: `firma_${result.documento}.jpg` })}
                            />
                            <BioImageCard 
                                label="Huella Izquierda" 
                                url={result.huella_izquierda} 
                                onDownload={() => handleDownloadImage(result.huella_izquierda, `huella_izq_${result.documento}.jpg`)}
                                onPreview={() => setPreviewData({ url: result.huella_izquierda, filename: `huella_izq_${result.documento}.jpg` })}
                            />
                            <BioImageCard 
                                label="Huella Derecha" 
                                url={result.huella_derecha} 
                                onDownload={() => handleDownloadImage(result.huella_derecha, `huella_der_${result.documento}.jpg`)}
                                onPreview={() => setPreviewData({ url: result.huella_derecha, filename: `huella_der_${result.documento}.jpg` })}
                            />
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 md:p-6 shadow-sm border border-gray-200 dark:border-gray-800 transition-colors duration-300 h-full">
                        <div className="flex items-center space-x-3 mb-6 border-b border-gray-100 dark:border-gray-800 pb-3">
                            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/30">
                                <span className="material-icons-round text-blue-600 dark:text-blue-400 text-2xl">face</span>
                            </div>
                            <h3 className="font-bold text-slate-900 dark:text-white text-lg">Datos Personales</h3>
                        </div>
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-widest font-bold">Nacimiento</p>
                                    <div className="flex items-center gap-2">
                                        <span className="material-icons-round text-slate-400 text-base">calendar_today</span>
                                        <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm md:text-base">{result.fecha_nacimiento || '-'}</p>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-widest font-bold">Edad</p>
                                    <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm md:text-base">{result.edad ? `${result.edad} Años` : '-'}</p>
                                </div>
                            </div>
                            {searchType === 'premium' && (
                                <div className="grid grid-cols-2 gap-6 pt-2">
                                    <div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-widest font-bold">Estado Civil</p>
                                        <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm md:text-base">{result.estado_civil || '-'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-widest font-bold">Género</p>
                                        <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm md:text-base">{result.genero || '-'}</p>
                                    </div>
                                </div>
                            )}
                            {(result.padre || result.madre) && (
                                <div className="mt-4">
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 uppercase tracking-widest font-bold">Filiación</p>
                                    <div className="grid grid-cols-1 gap-3">
                                        <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-widest font-bold">Padre</p>
                                            <p className="font-bold text-slate-800 dark:text-slate-200 text-sm md:text-base uppercase tracking-wide">{result.padre || 'No registrada'}</p>
                                        </div>
                                        <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-widest font-bold">Madre</p>
                                            <p className="font-bold text-slate-800 dark:text-slate-200 text-sm md:text-base uppercase tracking-wide">{result.madre || 'No registrada'}</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 md:p-6 shadow-sm border border-gray-200 dark:border-gray-800 transition-colors duration-300 h-full flex flex-col">
                        <div className="flex items-center space-x-3 mb-6 border-b border-gray-100 dark:border-gray-800 pb-3">
                            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/30">
                                <span className="material-icons-round text-blue-600 dark:text-blue-400 text-2xl">home</span>
                            </div>
                            <h3 className="font-bold text-slate-900 dark:text-white text-lg">Domicilio</h3>
                        </div>
                        <div className="space-y-6 flex-1">
                            <div className="grid grid-cols-3 gap-2 text-center">
                                <LocationBox label="Dpto" value={result.departamento} />
                                <LocationBox label="Prov" value={result.provincia} />
                                <LocationBox label="Dist" value={result.distrito} />
                            </div>
                            <div className="pt-2 flex-1 flex flex-col justify-center">
                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-widest font-bold">Dirección Completa</p>
                                <div className="flex items-start space-x-3 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-700/50 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors">
                                    <span className="material-icons-round text-red-500 mt-0.5">place</span>
                                    <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm md:text-base leading-relaxed">
                                        {result.direccion || 'No registrada'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {searchType === 'premium' && (
                        <div className="md:col-span-2 bg-white dark:bg-slate-900 rounded-2xl p-5 md:p-6 shadow-sm border border-gray-200 dark:border-gray-800 transition-colors duration-300">
                            <div className="flex items-center space-x-3 mb-6 border-b border-gray-100 dark:border-gray-800 pb-3">
                                <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/30">
                                    <span className="material-icons-round text-indigo-600 dark:text-indigo-400 text-2xl">description</span>
                                </div>
                                <h3 className="font-bold text-slate-900 dark:text-white text-lg">Información de Registro</h3>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                <div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-widest font-bold">Emisión</p>
                                    <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm md:text-base">{result.fecha_emision || '-'}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-widest font-bold">Inscripción</p>
                                    <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm md:text-base">{result.fecha_inscripcion || '-'}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-widest font-bold">Caducidad</p>
                                    <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm md:text-base text-red-500 dark:text-red-400">{result.fecha_caducidad || '-'}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-widest font-bold">Restricción</p>
                                    <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm md:text-base">{result.restriccion || 'NINGUNA'}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {(result.ubigeo_reniec || result.ubigeo_sunat || result.ubigeo_inei) && (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-800 transition-colors duration-300">
                        <div className="flex items-center space-x-3 mb-6 border-b border-gray-100 dark:border-gray-800 pb-3">
                            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/30">
                                <span className="material-icons-round text-emerald-600 dark:text-emerald-400 text-2xl">map</span>
                            </div>
                            <h3 className="font-bold text-slate-900 dark:text-white text-lg">Ubigeos</h3>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                            <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold mb-1">RENIEC</p>
                                <p className="font-mono font-bold text-slate-800 dark:text-slate-200">{result.ubigeo_reniec || '-'}</p>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold mb-1">SUNAT</p>
                                <p className="font-mono font-bold text-slate-800 dark:text-slate-200">{result.ubigeo_sunat || '-'}</p>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold mb-1">INEI</p>
                                <p className="font-mono font-bold text-slate-800 dark:text-slate-200">{result.ubigeo_inei || '-'}</p>
                            </div>
                            {searchType === 'premium' && (
                                <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                                    <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold mb-1">C. POSTAL</p>
                                    <p className="font-mono font-bold text-slate-800 dark:text-slate-200">{result.codigo_postal || '-'}</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div className="flex justify-center w-full py-4 no-print">
                    <button
                        type="button"
                        onClick={onOpenDonation}
                        className="group flex items-center gap-2 px-5 py-2.5 min-h-[44px] rounded-full transition-all duration-200 bg-white dark:bg-slate-800 hover:bg-pink-50 dark:hover:bg-slate-700 shadow-sm hover:shadow-md"
                        style={{ border: '1.5px solid transparent', backgroundClip: 'padding-box', boxShadow: '0 0 0 1.5px #d946ef40, 0 2px 8px rgba(168,85,247,0.12)' }}
                    >
                        <span className="material-icons-round text-purple-500 text-lg group-hover:scale-110 transition-transform" aria-hidden="true">favorite</span>
                        <span className="text-sm font-bold text-slate-600 dark:text-slate-300">Apoya el proyecto con Yape</span>
                    </button>
                </div>

            </motion.main>

            <AlertModal
                isOpen={alertModal.isOpen}
                onClose={() => setAlertModal({ ...alertModal, isOpen: false })}
                title={alertModal.title}
                message={alertModal.message}
                type={alertModal.type}
            />

            {createPortal(
                <AnimatePresence>
                    {previewData && (
                        <motion.div
                            key="image-preview-modal"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 no-print"
                            onClick={() => setPreviewData(null)}
                        >
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.9, opacity: 0 }}
                                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                                className="relative max-w-5xl max-h-full w-auto h-auto flex flex-col items-center justify-center"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="absolute -top-12 right-0 flex items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDownloadImage(previewData.url, previewData.filename);
                                        }}
                                        className="min-w-[44px] min-h-[44px] bg-white/20 hover:bg-blue-600 text-white rounded-full transition-all backdrop-blur-md border border-white/20 active:scale-90 shadow-lg flex items-center justify-center"
                                        aria-label="Descargar imagen"
                                        title="Descargar Imagen"
                                    >
                                        <span className="material-icons-round text-2xl">download</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setPreviewData(null);
                                        }}
                                        className="min-w-[44px] min-h-[44px] bg-white/20 hover:bg-red-500 text-white rounded-full transition-all backdrop-blur-md border border-white/20 active:scale-90 shadow-lg flex items-center justify-center"
                                        aria-label="Cerrar vista previa"
                                        title="Cerrar"
                                    >
                                        <span className="material-icons-round text-2xl">close</span>
                                    </button>
                                </div>
                                <img
                                    src={getApiUrl(previewData.url)}
                                    alt="Vista Previa"
                                    className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl border border-white/10"
                                />
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </>
    );
}

function LocationBox({ label, value }) {
    return (
        <div className="bg-slate-50 dark:bg-slate-800/60 rounded-lg p-3 border border-slate-200 dark:border-slate-700/50 hover:border-blue-300 dark:hover:border-blue-500 transition-colors">
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-widest font-bold mb-1">{label}</p>
            <p className="text-xs md:text-sm font-bold text-slate-900 dark:text-white truncate" title={value}>{value || '-'}</p>
        </div>
    );
}

function BioImageCard({ label, url, onDownload, onPreview }) {
    return (
        <div className="flex flex-col gap-1.5">
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-widest font-black text-center">{label}</p>
            <div 
                className={`group relative h-20 md:h-32 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 overflow-hidden shadow-sm transition-all hover:shadow-md hover:border-amber-200 dark:hover:border-amber-700/50 ${url ? 'cursor-pointer' : ''}`}
            >
                {url ? (
                    <>
                        <img 
                            src={getApiUrl(url)} 
                            alt={label} 
                            className="w-full h-full object-contain p-1.5 transition-transform duration-500 group-hover:scale-110" 
                        />
                        <button 
                            type="button"
                            onClick={onPreview}
                            className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-zoom-in z-0 w-full h-full border-none outline-none"
                        >
                            <span className="material-icons-round text-white text-3xl drop-shadow-md">zoom_in</span>
                        </button>
                        <button 
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                onDownload();
                            }}
                            className="absolute bottom-1.5 right-1.5 min-w-[44px] min-h-[44px] rounded-full bg-white dark:bg-slate-900 shadow-lg flex items-center justify-center text-slate-600 dark:text-slate-300 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all hover:bg-amber-500 hover:text-white z-10"
                            aria-label={`Descargar ${label}`}
                            title="Descargar"
                        >
                            <span className="material-icons-round text-lg">download</span>
                        </button>
                    </>
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-1 opacity-20">
                        <span className="material-icons-round text-2xl">image_not_supported</span>
                        <span className="text-[8px] font-bold">N/A</span>
                    </div>
                )}
            </div>
        </div>
    );
}
