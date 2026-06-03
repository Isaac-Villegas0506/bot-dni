import { useState, useEffect } from 'react';
import axios from 'axios';
import { getApiUrl } from '../utils/api';

export function useAnnouncements() {
    const [announcements, setAnnouncements] = useState([]);

    useEffect(() => {
        let mounted = true;
        axios.get(getApiUrl('/api/announcements/active')).then(res => {
            console.log("API active announcements:", res.data);
            if (!mounted) return;
            if (res.data && res.data.length > 0) {
                // Check all active announcements
                const toShow = res.data.filter(ann => {
                    const lastSeen = localStorage.getItem(`last_seen_announcement_${ann.id}`);
                    const freqMinutes = ann.frequency_minutes || 60; // Default 1 hour
                    console.log(`Announcement ${ann.id}: lastSeen=${lastSeen}, freq=${freqMinutes}`);
                    if (!lastSeen) return true;
                    const diffMs = Date.now() - parseInt(lastSeen, 10);
                    const shouldShow = diffMs >= (freqMinutes * 60 * 1000);
                    console.log(`Announcement ${ann.id}: diffMs=${diffMs}, shouldShow=${shouldShow}`);
                    return shouldShow;
                });
                
                console.log("Announcements to show:", toShow);
                if (toShow.length > 0) {
                    setAnnouncements(toShow);
                }
            }
        }).catch((err) => { console.error("Error fetching announcements:", err); });

        return () => { mounted = false; };
    }, []);

    const dismissAnnouncement = (id) => {
        localStorage.setItem(`last_seen_announcement_${id}`, Date.now().toString());
        setAnnouncements(prev => prev.filter(a => a.id !== id));
    };

    return { announcements, dismissAnnouncement };
}
