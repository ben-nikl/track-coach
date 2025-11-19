// theme.ts
// Centralized theme file for global styles and colors with light/dark mode support
import {ColorSchemeName} from 'react-native';

export type ThemeMode = 'light' | 'dark';
export type ColorSet = typeof COLORS.light;

export const COLORS = {
    light: {
        background: '#F3F5F7',
        primary: '#E53935',
        accent: '#0366d6',
        text: '#111',
        secondaryText: '#6B6E72',
        white: '#fff',
        inputText: '#222',
        placeholder: '#A0A4A8',
        fabShadow: '#000',
        border: '#E0E3E6',
        surface: '#FFFFFF',
        danger: '#ff1a16',
        success: '#2E7D32',
        warning: '#ffa601',
        doveGray: '#737373',
        mineShaft: '#3a3a3a',
        mineShaft20: '#3a3a3a10',
    },
    dark: {
        background: '#191C25',
        primary: '#E53935',
        accent: '#4C8EDA',
        text: '#fff',
        secondaryText: '#A0A4A8',
        white: '#23242A',
        inputText: '#fff',
        placeholder: '#6B6E72',
        fabShadow: '#000',
        border: '#2A2D36',
        surface: '#23242A',
        danger: '#ff1a16',
        success: '#4CAF50',
        warning: '#ffa601',
        doveGray: '#737373',
        mineShaft: '#3a3a3a',
        mineShaft20: '#3a3a3a10',
    },
};

export function getThemeColors(scheme: ColorSchemeName) {
    return scheme === 'dark' ? COLORS.dark : COLORS.light;
}
