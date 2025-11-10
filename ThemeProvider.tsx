import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, ThemeMode, ColorSet } from './theme';

// Stored value can be 'system' | 'light' | 'dark'
export type ThemePreference = 'system' | ThemeMode;
interface ThemeContextValue {
  preference: ThemePreference; // user preference (may be system)
  mode: ThemeMode; // effective resolved mode
  colors: ColorSet;
  setPreference: (pref: ThemePreference) => Promise<void>;
  resetPreference: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);
const STORAGE_KEY = 'themeOverride';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemScheme = useColorScheme();
  const [preference, setPreference] = useState<ThemePreference>('system');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored === 'light' || stored === 'dark') {
          setPreference(stored);
        } else {
          setPreference('system');
        }
      } catch {
        // ignore
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const mode: ThemeMode = preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;
  const colors = COLORS[mode];

  const setPref = useCallback(async (pref: ThemePreference) => {
    setPreference(pref);
    try {
      if (pref === 'system') {
        await AsyncStorage.removeItem(STORAGE_KEY);
      } else {
        await AsyncStorage.setItem(STORAGE_KEY, pref);
      }
    } catch {
      // ignore persistence errors
    }
  }, []);

  const resetPreference = useCallback(async () => setPref('system'), [setPref]);

  const value = useMemo<ThemeContextValue>(() => ({ preference, mode, colors, setPreference: setPref, resetPreference }), [preference, mode, colors, setPref, resetPreference]);

  // While loading stored preference, just render children with system colors to avoid blank screen.
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};

