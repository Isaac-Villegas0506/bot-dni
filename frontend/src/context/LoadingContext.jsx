import { createContext, useContext, useRef, useState } from 'react';

const LoadingContext = createContext();

export function LoadingProvider({ children }) {
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);
    const [showDonation, setShowDonation] = useState(false);
    const [loadingType, setLoadingType] = useState('default');
    const [startedAt, setStartedAt] = useState(0);
    const abortRef = useRef(null);

    const showLoading = (msg = null, type = 'default') => {
        abortRef.current = null;
        setMessage(msg);
        setLoadingType(type);
        setStartedAt(Date.now());
        setLoading(true);
    };

    const hideLoading = () => {
        abortRef.current = null;
        setLoading(false);
        setMessage(null);
        setLoadingType('default');
    };

    const registerAbort = (controller) => {
        abortRef.current = controller;
    };

    const cancelLoading = () => {
        abortRef.current?.abort();
        hideLoading();
    };

    const openDonation = () => setShowDonation(true);
    const closeDonation = () => setShowDonation(false);

    return (
        <LoadingContext.Provider value={{
            loading, message, loadingType, startedAt, showLoading, hideLoading,
            registerAbort, cancelLoading,
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
