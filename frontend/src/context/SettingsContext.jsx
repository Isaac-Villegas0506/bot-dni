import { useState, useEffect } from 'react';
import { getApiUrl } from '../utils/api';
import { SettingsContext } from './settingsContextValue';

export function SettingsProvider({ children }) {
    const [settings, setSettings] = useState({});
    const [loading, setLoading] = useState(true);

    const fetchSettings = async () => {
        try {
            const res = await fetch(getApiUrl('/api/settings'));
            if (res.ok) {
                const data = await res.json();
                setSettings(data);
            }
        } catch (error) {
            console.error("Failed to fetch settings:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSettings();
    }, []);

    const refreshSettings = () => {
        return fetchSettings();
    };

    // Helper to check if a feature is enabled
    // Default to true if not found, to avoid breaking features if DB is missing
    const isFeatureEnabled = (featureKey) => {
        if (!settings[featureKey]) return true;
        return settings[featureKey].value;
    };

    return (
        <SettingsContext.Provider value={{ settings, loading, refreshSettings, isFeatureEnabled }}>
            {children}
        </SettingsContext.Provider>
    );
}

