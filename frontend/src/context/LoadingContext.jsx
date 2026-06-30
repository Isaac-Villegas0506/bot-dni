import { createContext, useContext, useState } from 'react';

const LoadingContext = createContext();

export function LoadingProvider({ children }) {
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);
    const [showDonation, setShowDonation] = useState(false);
    const [loadingType, setLoadingType] = useState('default');

    const showLoading = (msg = null, type = 'default') => {
        setMessage(msg);
        setLoadingType(type);
        setLoading(true);
    };

    const hideLoading = () => {
        setLoading(false);
        setMessage(null);
        setLoadingType('default');
    };

    const openDonation = () => setShowDonation(true);
    const closeDonation = () => setShowDonation(false);

    return (
        <LoadingContext.Provider value={{ 
            loading, message, loadingType, showLoading, hideLoading,
            showDonation, openDonation, closeDonation 
        }}>
            {children}
        </LoadingContext.Provider>
    );
}

export function useLoading() {
    const context = useContext(LoadingContext);
    if (!context) {
        throw new Error('useLoading must be used within a LoadingProvider');
    }
    return context;
}
