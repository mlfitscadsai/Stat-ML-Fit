export const THEME_STORAGE_KEY = 'isDark';
export const THEME_CHANGED_EVENT = 'mlfit-theme-changed';

const LIGHT_TOKENS = {
    bg: '#ffffff',
    surface: '#ffffff',
    surface2: '#f6fbf9',
    border: '#d5e8e1',
    text: '#0f2a24',
    textMuted: '#4f6d64',
    accent: '#0e8d73',
    inputBg: '#ffffff',
    grid: '#d0e1f2',
    plotBg: '#ffffff',
    paperBg: 'rgba(0,0,0,0)',
};

const DARK_TOKENS = {
    bg: '#090d16',
    surface: '#111b2d',
    surface2: '#1a263d',
    border: '#28374e',
    text: '#f8fafc',
    textMuted: '#94a3b8',
    accent: '#38bdf8',
    inputBg: '#152238',
    grid: '#28374e',
    plotBg: '#111b2d',
    paperBg: 'rgba(0,0,0,0)',
};

export function getStoredTheme() {
    try {
        return typeof localStorage?.getItem === 'function' && localStorage.getItem(THEME_STORAGE_KEY) === 'true';
    } catch {
        return false;
    }
}

export function setStoredTheme(isDark) {
    try {
        if (typeof localStorage?.setItem === 'function') {
            localStorage.setItem(THEME_STORAGE_KEY, isDark ? 'true' : 'false');
        }
    } catch {
        // Storage may be unavailable in tests or private browsing.
    }
}

export function getThemeTokens(isDark = false) {
    return isDark ? { ...DARK_TOKENS } : { ...LIGHT_TOKENS };
}

export function applyTheme(isDark = false) {
    const root = typeof document !== 'undefined' ? document.documentElement : null;
    if (!root) return;

    root.classList.add('theme-transition');
    root.classList.toggle('dark', isDark);
    root.dataset.theme = isDark ? 'dark' : 'light';
    root.style.colorScheme = isDark ? 'dark' : 'light';

    if (typeof window !== 'undefined') {
        const transitionMs = resolveThemeTransitionMs(root);
        window.setTimeout(() => root.classList.remove('theme-transition'), transitionMs);
        window.dispatchEvent(new CustomEvent(THEME_CHANGED_EVENT, {
            detail: { isDark, tokens: getThemeTokens(isDark) },
        }));
    }

    retypesetMathJax();
}

export function initTheme() {
    const isDark = getStoredTheme();
    applyTheme(isDark);
    return isDark;
}

export function retypesetMathJax() {
    if (typeof window === 'undefined' || !window.MathJax?.typesetPromise) return;
    const targets = document.querySelectorAll('.docs-content, .content');
    if (!targets.length) return;
    window.MathJax.typesetPromise(Array.from(targets)).catch(() => {});
}

function resolveThemeTransitionMs(root) {
    const DEFAULT_MS = 320;
    try {
        const styles = window.getComputedStyle(root);
        const token = styles.getPropertyValue('--theme-transition-duration-ms');
        const parsed = Number.parseInt(String(token).trim(), 10);
        if (Number.isFinite(parsed) && parsed > 0) {
            // Keep transition class alive slightly longer to avoid cutoff on slow frames.
            return parsed + 80;
        }
    } catch {
        // Fallback below.
    }
    return DEFAULT_MS;
}
