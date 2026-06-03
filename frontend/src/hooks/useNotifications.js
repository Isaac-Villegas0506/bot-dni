import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { getApiUrl } from '../utils/api';
import { useAuth } from '../context/AuthContext';

export function useNotifications() {
    const { isLoggedIn } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetchNotifications = useCallback(async () => {
        if (!isLoggedIn) {
            setNotifications([]);
            return;
        }
        
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            if (!token) return;
            
            const res = await axios.get(getApiUrl('/api/user/notifications'), {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (res.data && Array.isArray(res.data)) {
                setNotifications(res.data);
            }
        } catch (err) {
            console.error("Error fetching notifications:", err);
        } finally {
            setLoading(false);
        }
    }, [isLoggedIn]);

    useEffect(() => {
        // Fetch initially
        fetchNotifications();
        
        // Polling every 30 seconds
        const interval = setInterval(fetchNotifications, 30000);
        return () => clearInterval(interval);
    }, [fetchNotifications]);

    const markAsRead = async (id) => {
        // Optimistic UI update
        setNotifications(prev => prev.filter(n => n.id !== id));
        
        try {
            const token = localStorage.getItem('token');
            if (!token) return;
            
            await axios.put(getApiUrl(`/api/user/notifications/${id}/read`), {}, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
        } catch (err) {
            console.error(`Error marking notification ${id} as read:`, err);
            // On error, we could fetch again to restore it
            fetchNotifications();
        }
    };

    return { notifications, markAsRead, loading, refresh: fetchNotifications };
}
