import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function BannersManagement() {
    const [banners, setBanners] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    
    // Form state
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [title, setTitle] = useState('');
    const [targetUrl, setTargetUrl] = useState('');
    const [imageDesktop, setImageDesktop] = useState(null);
    const [imageMobile, setImageMobile] = useState(null);
    const [showForm, setShowForm] = useState(false);

    useEffect(() => {
        fetchBanners();
    }, []);

    const fetchBanners = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/admin/banners', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Error cargando banners');
            setBanners(await res.json());
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleFileChange = (e, type) => {
        const file = e.target.files[0];
        if (file) {
            if (type === 'desktop') setImageDesktop(file);
            else setImageMobile(file);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!imageDesktop || !imageMobile) {
            alert('Debes subir ambas imágenes (PC y Celular)');
            return;
        }
        
        setIsSubmitting(true);
        const token = localStorage.getItem('token');
        const formData = new FormData();
        formData.append('title', title);
        formData.append('target_url', targetUrl);
        formData.append('image_desktop', imageDesktop);
        formData.append('image_mobile', imageMobile);

        try {
            const res = await fetch('/api/admin/banners', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            
            if (!res.ok) throw new Error('Error al subir el banner');
            
            await fetchBanners();
            setShowForm(false);
            setTitle('');
            setTargetUrl('');
            setImageDesktop(null);
            setImageMobile(null);
        } catch (err) {
            alert(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const toggleActive = async (id, currentStatus) => {
        const token = localStorage.getItem('token');
        try {
            await fetch(`/api/admin/banners/${id}`, {
                method: 'PUT',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ is_active: !currentStatus })
            });
            setBanners(prev => prev.map(b => b.id === id ? { ...b, is_active: !currentStatus } : b));
        } catch (err) {
            console.error(err);
        }
    };

    const deleteBanner = async (id) => {
        if (!confirm('¿Estás seguro de eliminar este banner?')) return;
        const token = localStorage.getItem('token');
        try {
            await fetch(`/api/admin/banners/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setBanners(prev => prev.filter(b => b.id !== id));
        } catch (err) {
            console.error(err);
        }
    };

    if (loading) {
        return <div className="p-6 text-slate-500">Cargando banners...</div>;
    }

    return (
        <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto pb-24">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Banners / Carrusel</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Gestiona las imágenes que aparecen en el carrusel de inicio.</p>
                </div>
                <button 
                    onClick={() => setShowForm(!showForm)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold uppercase tracking-wider rounded-xl transition-colors"
                >
                    <span className="material-icons-round text-[20px]">{showForm ? 'close' : 'add'}</span>
                    {showForm ? 'Cancelar' : 'Nuevo Banner'}
                </button>
            </div>

            {error && (
                <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100">
                    {error}
                </div>
            )}

            <AnimatePresence>
                {showForm && (
                    <motion.form 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4 overflow-hidden"
                        onSubmit={handleSubmit}
                    >
                        <h2 className="font-bold text-lg text-slate-900 dark:text-white mb-4">Agregar Nuevo Banner</h2>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Título (Opcional)</label>
                                <input 
                                    type="text" 
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm"
                                    placeholder="Ej: Promo Fiestas Patrias"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Ruta Destino</label>
                                <select 
                                    value={targetUrl}
                                    onChange={e => setTargetUrl(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm cursor-pointer"
                                    required
                                >
                                    <option value="" disabled>Selecciona a dónde dirigirá el banner</option>
                                    <option value="/tienda">🛒 Tienda (Comprar Créditos)</option>
                                    <option value="/">🏠 Inicio (Búsquedas)</option>
                                    <option value="/historial">🕒 Historial de Búsquedas</option>
                                    <option value="/soporte">📞 Soporte (Telegram)</option>
                                    <option value="/perfil">👤 Mi Perfil</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                            <div className="space-y-2">
                                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">Imagen PC (Desktop)</label>
                                <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-4 text-center hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors relative">
                                    <input type="file" accept="image/*" onChange={e => handleFileChange(e, 'desktop')} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" required />
                                    <span className="material-icons-round text-3xl text-slate-400">desktop_windows</span>
                                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
                                        {imageDesktop ? imageDesktop.name : 'Haz clic o arrastra una imagen'}
                                    </p>
                                </div>
                            </div>
                            
                            <div className="space-y-2">
                                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">Imagen Celular (Mobile)</label>
                                <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-4 text-center hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors relative">
                                    <input type="file" accept="image/*" onChange={e => handleFileChange(e, 'mobile')} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" required />
                                    <span className="material-icons-round text-3xl text-slate-400">smartphone</span>
                                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
                                        {imageMobile ? imageMobile.name : 'Haz clic o arrastra una imagen'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 flex justify-end">
                            <button 
                                type="submit" 
                                disabled={isSubmitting}
                                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold uppercase tracking-wider rounded-xl transition-colors"
                            >
                                {isSubmitting ? 'Subiendo...' : 'Guardar Banner'}
                            </button>
                        </div>
                    </motion.form>
                )}
            </AnimatePresence>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {banners.length === 0 ? (
                    <div className="col-span-full py-12 text-center text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                        <span className="material-icons-round text-4xl opacity-20 mb-2">image_not_supported</span>
                        <p>No hay banners configurados.</p>
                    </div>
                ) : (
                    banners.map(banner => (
                        <div key={banner.id} className={`bg-white dark:bg-slate-800 rounded-2xl border ${banner.is_active ? 'border-blue-200 dark:border-blue-900/50 ring-1 ring-blue-500/20' : 'border-slate-200 dark:border-slate-700 opacity-75'} overflow-hidden flex flex-col`}>
                            <div className="relative aspect-video bg-slate-100 dark:bg-slate-900">
                                <img src={banner.image_url_desktop} alt={banner.title} className="w-full h-full object-cover" />
                                <div className="absolute top-2 right-2 flex gap-1">
                                    <span className="bg-slate-900/80 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded-lg uppercase tracking-wider">
                                        PC
                                    </span>
                                </div>
                                <div className="absolute bottom-2 right-2 w-16 h-24 border-2 border-white/20 rounded-lg overflow-hidden bg-slate-800 shadow-xl">
                                    <img src={banner.image_url_mobile} alt="mobile" className="w-full h-full object-cover" />
                                </div>
                            </div>
                            
                            <div className="p-4 flex flex-col flex-1">
                                <h3 className="font-bold text-slate-900 dark:text-white truncate" title={banner.title || 'Sin título'}>
                                    {banner.title || 'Banner sin título'}
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">
                                    Destino: <span className="text-blue-500 font-mono">{banner.target_url || '/'}</span>
                                </p>
                                
                                <div className="mt-auto pt-4 flex items-center justify-between gap-2">
                                    <button 
                                        onClick={() => toggleActive(banner.id, banner.is_active)}
                                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${banner.is_active ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 hover:bg-amber-200' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 hover:bg-emerald-200'}`}
                                    >
                                        {banner.is_active ? 'Ocultar' : 'Mostrar'}
                                    </button>
                                    <button 
                                        onClick={() => deleteBanner(banner.id)}
                                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-400 hover:bg-red-200 transition-colors"
                                    >
                                        <span className="material-icons-round text-[18px]">delete</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
