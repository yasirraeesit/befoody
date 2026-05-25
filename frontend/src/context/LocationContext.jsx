import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'befoody_location_v1';

const LocationContext = createContext(null);

const defaultLocation = {
    country: 'Pakistan',
    province: '',
    city: ''
};

export const LocationProvider = ({ children }) => {
    const [location, setLocationState] = useState(defaultLocation);
    const [selectorOpen, setSelectorOpen] = useState(false);
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed?.country === 'Pakistan') {
                    setLocationState({
                        country: 'Pakistan',
                        province: parsed?.province || '',
                        city: parsed?.city || ''
                    });
                }
            }
        } catch {
            // ignore bad storage
        } finally {
            setHydrated(true);
        }
    }, []);

    useEffect(() => {
        if (!hydrated) return;
        const hasSelection = Boolean(location?.city) && Boolean(location?.province);
        if (!hasSelection) setSelectorOpen(true);
    }, [hydrated, location]);

    const setLocation = useCallback((nextLocation) => {
        const normalized = {
            country: 'Pakistan',
            province: nextLocation?.province || '',
            city: nextLocation?.city || ''
        };
        setLocationState(normalized);
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
        } catch {
            // ignore
        }
    }, []);

    const clearLocation = useCallback(() => {
        setLocationState(defaultLocation);
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch {
            // ignore
        }
        setSelectorOpen(true);
    }, []);

    const value = useMemo(() => ({
        location,
        setLocation,
        clearLocation,
        selectorOpen,
        setSelectorOpen,
        hydrated
    }), [location, setLocation, clearLocation, selectorOpen, hydrated]);

    return (
        <LocationContext.Provider value={value}>
            {children}
        </LocationContext.Provider>
    );
};

export const useLocationContext = () => {
    const ctx = useContext(LocationContext);
    if (!ctx) throw new Error('useLocationContext must be used within LocationProvider');
    return ctx;
};

