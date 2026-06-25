import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

export default function ReferidosPage() {
    useAuth();
    const [referralCode, setReferralCode] = useState('');
    const [loading, setLoading] = useState(true);
    
    // Promo form state
    const [tiktokUrl, setTiktokUrl] = useState('');
    const [tiktokUsername, setTiktokUsername] = useState('');
    const [submittingPromo, setSubmittingPromo] = useState(false);
    
    // History & Alerts
    const [promoHistory, setPromoHistory] = useState([]);
    const [referralsHistory, setReferralsHistory] = useState([]);
    const [alertModal, setAlertModal] = useState({ isOpen: false, data: null });

    useEffect(() => {
        const fetchReferralAndHistory = async () => {
            try {
                const token = localStorage.getItem('token');
                
                // Fetch referral code
                const refRes = await fetch('/api/user/referral', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (refRes.ok) {
                    const refData = await refRes.json();
                    setReferralCode(refData.referral_code);
                }

                // Fetch promo history
                const histRes = await fetch('/api/promos/history', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                // Fetch referrals history
                const refsHistRes = await fetch('/api/user/referrals/history', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (refsHistRes.ok) {
                    const refsData = await refsHistRes.json();
                    setReferralsHistory(refsData.referred_users || []);
                }
                if (histRes.ok) {
                    const history = await histRes.json();
                    setPromoHistory(history);
                    
                    // Check for unnotified alerts
                    const unnotified = history.find(req => !req.user_notified && req.status !== 'pending');
                    if (unnotified) {
                        setAlertModal({ isOpen: true, data: unnotified });
                    }
                }
            } catch (err) {
                console.error("Error fetching data:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchReferralAndHistory();
    }, []);

    const referralLink = `${window.location.origin}/?ref=${referralCode}`;

    const handleCopy = () => {
        navigator.clipboard.writeText(referralLink);
        toast.success('¡Enlace copiado al portapapeles!');
    };

    const handlePromoSubmit = async (e) => {
        e.preventDefault();
        if (!tiktokUrl || !tiktokUsername) return toast.error('Completa ambos campos');
        
        setSubmittingPromo(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/promos/request', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ tiktok_username: tiktokUsername, video_url: tiktokUrl })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'Error al enviar');
            toast.success(data.message || 'Solicitud enviada. ¡Será revisada pronto!');
            setTiktokUrl('');
            setTiktokUsername('');
            
            // Refresh history
            const histRes = await fetch('/api/promos/history', { headers: { 'Authorization': `Bearer ${token}` } });
            if (histRes.ok) setPromoHistory(await histRes.json());

        } catch (err) {
            toast.error(err.message);
        } finally {
            setSubmittingPromo(false);
        }
    };

    const handleAcknowledgeAlert = async () => {
        if (!alertModal.data) return;
        const reqId = alertModal.data.id;
        setAlertModal({ isOpen: false, data: null });
        
        try {
            const token = localStorage.getItem('token');
            await fetch(`/api/promos/${reqId}/acknowledge`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            // Update local state to hide "NEW" badge if any
            setPromoHistory(prev => prev.map(p => p.id === reqId ? { ...p, user_notified: true } : p));
        } catch (err) {
            console.error("Failed to acknowledge promo", err);
        }
    };

    return (
        <div className="w-full max-w-4xl mx-auto space-y-8 animate-fade-in pb-12 px-4 sm:px-6">
            
            {/* Header / Intro */}
            <div className="text-center space-y-4 mb-10 pt-4">
                <h1 className="text-4xl md:text-5xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent tracking-tight">
                    Ganar Créditos
                </h1>
            </div>

            {/* Referral Card */}
            <motion.div 
                whileHover={{ y: -2 }}
                className="bg-white dark:bg-slate-900 rounded-3xl sm:rounded-[2rem] p-5 sm:p-8 md:p-10 shadow-xl border border-slate-100 dark:border-slate-800 relative overflow-hidden group"
            >
                <div className="relative z-10 space-y-6">
                    <div className="flex items-center gap-4">
                        <div>
                            <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white">Programa de Referidos</h2>
                            <p className="text-slate-500 dark:text-slate-400 font-medium text-sm md:text-base">Gana 15 créditos por cada amigo que invites</p>
                        </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800/50 p-5 md:p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
                        <p className="text-sm md:text-base text-slate-600 dark:text-slate-300 mb-4">
                            Comparte tu enlace único. Cuando un amigo se registre usando este enlace, tú recibirás <strong>15 créditos</strong> y tu amigo recibirá <strong>10 créditos adicionales</strong> de bienvenida.
                        </p>

                        {loading ? (
                            <div className="h-12 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse w-full"></div>
                        ) : referralCode ? (
                            <div className="flex flex-col sm:flex-row gap-3">
                                <div className="flex-1 relative">
                                    <input 
                                        type="text" 
                                        readOnly 
                                        value={referralLink}
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl pl-4 pr-10 py-3 text-slate-700 dark:text-slate-200 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-ellipsis overflow-hidden whitespace-nowrap"
                                    />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[10px] pointer-events-none">
                                        LINK
                                    </div>
                                </div>
                                <button 
                                    onClick={handleCopy}
                                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-md hover:shadow-lg active:scale-95 flex items-center justify-center gap-2 whitespace-nowrap w-full sm:w-auto focus-ring"
                                >
                                    Copiar
                                </button>
                            </div>
                        ) : (
                            <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/10 p-3 rounded-xl border border-red-200 dark:border-red-800">
                                Ocurrió un error al cargar tu código de referido.
                            </div>
                        )}
                    </div>
                </div>
            </motion.div>

            {/* Referrals List Card */}
            <div className="space-y-4">
                <div className="px-1">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Amigos Referidos</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Usuarios que se registraron con tu enlace</p>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
                    {loading ? (
                        <div className="text-center py-10 text-slate-400">Cargando...</div>
                    ) : referralsHistory.length === 0 ? (
                        <div className="flex flex-col items-center justify-center text-center py-10 text-slate-500 dark:text-slate-400">
                            <p className="text-sm font-semibold">Aún no has invitado a ningún amigo.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100 dark:divide-slate-800/60 max-h-[350px] overflow-y-auto custom-scrollbar">
                            {referralsHistory.map(refUser => {
                                const emailParts = refUser.email?.split('@') || [];
                                const maskedEmail = emailParts.length === 2 
                                    ? `${emailParts[0].charAt(0)}${'*'.repeat(8)}@${emailParts[1]}` 
                                    : refUser.email;
                                
                                return (
                                    <div key={refUser.id} className="p-4 sm:px-6 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-full flex items-center justify-center shrink-0 uppercase text-lg">
                                                {refUser.full_name ? refUser.full_name.charAt(0) : refUser.email.charAt(0)}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-semibold text-slate-900 dark:text-white text-sm truncate">
                                                    {refUser.full_name || 'Usuario'}
                                                </p>
                                                <p className="text-[11px] text-slate-400 truncate mt-0.5">
                                                    {maskedEmail}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0 ml-3">
                                            <div className="text-xs font-bold text-emerald-500 dark:text-emerald-400 mb-0.5">
                                                +15 Créditos
                                            </div>
                                            <p className="text-[10px] text-slate-400 font-medium block">
                                                {refUser.created_at ? new Date(refUser.created_at).toLocaleDateString('es-PE', { timeZone: 'America/Lima' }) : ''}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* TikTok Promo Card */}
                <motion.div 
                    whileHover={{ y: -2 }}
                    className="bg-white dark:bg-slate-900 rounded-3xl sm:rounded-[2rem] p-5 sm:p-6 md:p-8 shadow-xl border border-slate-100 dark:border-slate-800 relative overflow-hidden group h-full"
                >
                    <div className="relative z-10 space-y-6 flex flex-col h-full">
                        <div className="flex items-center gap-4">
                            <div>
                                <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white">Promoción Comunidad</h2>
                                <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">Sube un video a TikTok y gana</p>
                            </div>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-800/50 p-5 md:p-6 rounded-2xl border border-slate-200 dark:border-slate-700 flex-1 flex flex-col">
                            <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">
                                Muestra cómo funciona nuestra plataforma en TikTok. Si tu video es válido, ganarás <strong>5 días de acceso ilimitado</strong>.
                            </p>

                            <form onSubmit={handlePromoSubmit} className="space-y-4 mt-auto">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                        Tu usuario en TikTok (@usuario)
                                    </label>
                                    <input 
                                        type="text" 
                                        required
                                        value={tiktokUsername}
                                        onChange={(e) => setTiktokUsername(e.target.value)}
                                        placeholder="@ejemplo"
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-4 py-3 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-shadow text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                        Enlace del video publicado
                                    </label>
                                    <input 
                                        type="url" 
                                        required
                                        value={tiktokUrl}
                                        onChange={(e) => setTiktokUrl(e.target.value)}
                                        placeholder="https://www.tiktok.com/@ej/video/123"
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-4 py-3 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-shadow text-sm"
                                    />
                                </div>
                                
                                <button 
                                    type="submit"
                                    disabled={submittingPromo}
                                    className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-md hover:shadow-lg active:scale-95 flex items-center justify-center gap-2 focus-ring"
                                >
                                    {submittingPromo ? 'Enviando...' : 'Enviar Solicitud'}
                                </button>
                            </form>
                        </div>
                    </div>
                </motion.div>

                {/* History Card */}
                <motion.div 
                    whileHover={{ y: -2 }}
                    className="bg-white dark:bg-slate-900 rounded-3xl sm:rounded-[2rem] p-5 sm:p-6 md:p-8 shadow-xl border border-slate-100 dark:border-slate-800 flex flex-col h-full"
                >
                    <div className="flex items-center gap-3 mb-6">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Historial de Solicitudes</h2>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3 max-h-[400px]">
                        {loading ? (
                            <div className="text-center py-10 text-slate-400">Cargando...</div>
                        ) : promoHistory.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-center py-10 text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
                                <p className="text-sm font-semibold">Aún no has enviado solicitudes de promoción.</p>
                            </div>
                        ) : (
                            promoHistory.map(req => (
                                <div key={req.id} className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col gap-2">
                                    <div className="flex items-center justify-between">
                                        <span className="font-bold text-slate-700 dark:text-slate-200 text-sm truncate max-w-[150px] sm:max-w-[200px]" title={req.tiktok_username}>
                                            {req.tiktok_username}
                                        </span>
                                        <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase ${
                                            req.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                                            req.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                                            'bg-red-100 text-red-700'
                                        }`}>
                                            {req.status === 'pending' ? 'En revisión' : req.status === 'approved' ? 'Aprobada' : 'Rechazada'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center mt-1">
                                        <span className="text-xs text-slate-500 font-medium">{req.created_at.split(' ')[0]}</span>
                                        <a href={req.video_url} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline flex items-center gap-1 font-medium">
                                            Ver Link
                                        </a>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </motion.div>
            </div>

            {/* Alert Modal for Updates */}
            <AnimatePresence>
                {alertModal.isOpen && alertModal.data && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center px-[max(1rem,var(--safe-left))] pr-[max(1rem,var(--safe-right))] py-[max(1rem,var(--safe-top))] pb-[max(1rem,var(--safe-bottom))] bg-slate-950/55 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="bg-white dark:bg-slate-900 rounded-lg shadow-xl p-5 md:p-6 max-w-md w-full border border-slate-200 dark:border-slate-800 text-center relative overflow-hidden"
                        >
                            <div className="mb-5 relative z-10">
                                <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">
                                    {alertModal.data.status === 'approved' ? '¡Promoción Aprobada!' : 'Promoción Rechazada'}
                                </h3>
                                <p className="text-slate-600 dark:text-slate-300">
                                    Tu solicitud para el usuario <strong className="text-slate-900 dark:text-white">{alertModal.data.tiktok_username}</strong> fue revisada.
                                </p>
                            </div>
                            
                            <div className={`p-4 rounded-lg mb-5 text-sm font-medium border ${
                                alertModal.data.status === 'approved' 
                                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50' 
                                : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800/50'
                            }`}>
                                {alertModal.data.status === 'approved' 
                                ? '🎉 Se han añadido 5 días de acceso ilimitado a tu cuenta. ¡Disfrútalo!' 
                                : 'El video no cumplió con los requisitos o no se pudo verificar. Puedes intentar subir uno nuevo.'}
                            </div>

                            <button
                                onClick={handleAcknowledgeAlert}
                                className={`w-full min-h-[44px] rounded-lg font-bold text-white transition-colors text-base ${
                                    alertModal.data.status === 'approved' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600'
                                }`}
                            >
                                Entendido
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

        </div>
    );
}
