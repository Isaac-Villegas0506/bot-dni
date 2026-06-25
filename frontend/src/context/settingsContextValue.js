import { createContext, useContext } from 'react';

export const SettingsContext = createContext({});

export function useSettings() {
    return useContext(SettingsContext);
}
