import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
    applyTheme,
    getStoredTheme,
    getThemeTokens,
    initTheme,
    setStoredTheme,
    THEME_STORAGE_KEY,
} from '../../src/services/theme/theme-service.js';

function createStorage() {
    const store = new Map();
    return {
        getItem: vi.fn((key) => (store.has(key) ? store.get(key) : null)),
        setItem: vi.fn((key, value) => { store.set(key, String(value)); }),
        removeItem: vi.fn((key) => { store.delete(key); }),
        clear: vi.fn(() => { store.clear(); }),
    };
}

describe('theme service', () => {
    let storage;

    beforeEach(() => {
        storage = createStorage();
        vi.stubGlobal('localStorage', storage);
        document.documentElement.classList.remove('dark');
        delete document.documentElement.dataset.theme;
        document.documentElement.style.colorScheme = '';
    });

    afterEach(() => {
        document.documentElement.classList.remove('dark');
        delete document.documentElement.dataset.theme;
        document.documentElement.style.colorScheme = '';
    });

    it('defaults to light theme when storage is empty', () => {
        expect(getStoredTheme()).toBe(false);
    });

    it('persists and restores dark theme', () => {
        setStoredTheme(true);
        expect(getStoredTheme()).toBe(true);
        expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('true');
    });

    it('applies dark class and color-scheme to document root', () => {
        applyTheme(true);
        expect(document.documentElement.classList.contains('dark')).toBe(true);
        expect(document.documentElement.dataset.theme).toBe('dark');
        expect(document.documentElement.style.colorScheme).toBe('dark');
    });

    it('applies light theme attributes when disabled', () => {
        applyTheme(true);
        applyTheme(false);
        expect(document.documentElement.classList.contains('dark')).toBe(false);
        expect(document.documentElement.dataset.theme).toBe('light');
        expect(document.documentElement.style.colorScheme).toBe('light');
    });

    it('initializes theme from storage', () => {
        setStoredTheme(true);
        const isDark = initTheme();
        expect(isDark).toBe(true);
        expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('returns chart-friendly tokens for each mode', () => {
        expect(getThemeTokens(false).plotBg).toBe('#ffffff');
        expect(getThemeTokens(true).plotBg).toBe('#111b2d');
    });

    it('dispatches theme changed event', () => {
        const handler = vi.fn();
        window.addEventListener('mlfit-theme-changed', handler);
        applyTheme(true);
        expect(handler).toHaveBeenCalled();
        window.removeEventListener('mlfit-theme-changed', handler);
    });
});
