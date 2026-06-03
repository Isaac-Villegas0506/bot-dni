import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getApiUrl } from '../../utils/api';
import { toast } from 'sonner';
import { useSettings } from '../../context/SettingsContext';

export default function SettingsManagement() {
    const [settingsList, setSettingsList] = useState({});
    const [loading, setLoading] = useState(true);
    const { refreshSettings } = useSettings();

    const fetchSettings = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(getApiUrl('/api/admin/settings'), {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setSettingsList(data);
            }
        } catch (error) {
            console.error("Failed to fetch admin settings", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSettings();
    }, []);

    const handleToggle = async (key, currentValue) => {
        const newValue = !currentValue;
        // Optimistic update
        setSettingsList(prev => ({
            ...prev,
            [key]: { ...prev[key], value: newValue }
        }));

        try {
            const token = localStorage.getItem('token');
            const res = await fetch(getApiUrl(`/api/admin/settings/${key}`), {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ value: newValue })
            });

            if (!res.ok) throw new Error("Error updating setting");
            toast.success(`Configuración actualizada`);
            refreshSettings(); // Actualiza el contexto global
        } catch (err) {
            // Revert on failure
            setSettingsList(prev => ({
                ...prev,
                [key]: { ...prev[key], value: currentValue }
            }));
            toast.error("Error al guardar la configuración");
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
                <div className="w-8 h-8 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="w-full max-w-3xl mx-auto space-y-6">
            <div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Configuración del Sistema</h2>
                <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">Activa o desactiva módulos funcionales de la plataforma.</p>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-3xl border-2 border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden divide-y divide-slate-100 dark:divide-slate-700">
                {Object.entries(settingsList).map(([key, setting]) => (
                    <div key={key} className="flex items-center justify-between p-5 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                        <div>
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">{setting.label}</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono">{key}</p>
                        </div>
                        <button
                            onClick={() => handleToggle(key, setting.value)}
                            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-300 focus:outline-none ${setting.value ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}
                        >
                            <span
                                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-300 ${setting.value ? 'translate-x-6' : 'translate-x-1'}`}
                            />
                        </button>
                    </div>
                ))}
                {Object.keys(settingsList).length === 0 && (
                    <div className="p-8 text-center text-slate-500">
                        No hay configuraciones disponibles.
                    </div>
                )}
            </div>
        </div>
    );
}
