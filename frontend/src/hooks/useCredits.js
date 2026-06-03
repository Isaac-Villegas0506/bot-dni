import { useState, useEffect } from 'react';

// Module-level cache so we only fetch once per page load
let _cachedCosts = null;
let _fetchPromise = null;

async function fetchCosts() {
    if (_cachedCosts) return _cachedCosts;
    if (_fetchPromise) return _fetchPromise;
    _fetchPromise = fetch('/api/credits/costs')
        .then(r => r.json())
        .then(data => {
            _cachedCosts = data.costs || {};
            _fetchPromise = null;
            return _cachedCosts;
        })
        .catch(() => {
            _fetchPromise = null;
            return {};
        });
    return _fetchPromise;
}

/**
 * Returns { costs, getCost, canAfford, loading }
 *
 * costs        — { [option_id]: { cost, label } }
 * getCost(id)  — integer cost (falls back to fallbackCost)
 * canAfford(optionId, userCredits, isPremium) — boolean
 */
export function useCreditCosts() {
    const [costs, setCosts] = useState(_cachedCosts || {});
    const [loading, setLoading] = useState(!_cachedCosts);

    useEffect(() => {
        if (_cachedCosts) {
            const syncTimer = setTimeout(() => {
                setCosts(_cachedCosts);
                setLoading(false);
            }, 0);
            return () => clearTimeout(syncTimer);
        }
        fetchCosts().then(c => {
            setCosts(c);
            setLoading(false);
        });
    }, []);

    const getCost = (optionId, fallback = 1) =>
        costs[optionId]?.cost ?? fallback;

    const canAfford = (optionId, userCredits, isPremium) => {
        if (isPremium) return true;
        const cost = getCost(optionId, 1);
        return (userCredits ?? 0) >= cost;
    };

    return { costs, getCost, canAfford, loading };
}

/** One-shot invalidation so next mount re-fetches (e.g. after admin update) */
export function invalidateCreditCosts() {
    _cachedCosts = null;
}
