import { Injectable, signal, computed } from '@angular/core';

/** What the reader picked: a fixed scheme, or follow the system setting. */
export type ThemeMode = 'light' | 'dark' | 'system';
export type ColorScheme = 'light' | 'dark';

/** Read by the inline script in index.html too, so keep both in step. */
export const THEME_STORAGE_KEY = 'qcli-docs-theme';

const MODES: ThemeMode[] = ['system', 'light', 'dark'];

/**
 * The site's light/dark scheme. It sets `data-theme` on <html> (the CSS
 * tokens in styles.sass switch on it) and exposes the resolved scheme so the
 * CLI panel and the playground editor follow the site.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
    private readonly media = window.matchMedia('(prefers-color-scheme: dark)');
    private readonly systemScheme = signal<ColorScheme>(
        this.media.matches ? 'dark' : 'light',
    );

    readonly mode = signal<ThemeMode>(this.readStoredMode());
    readonly scheme = computed<ColorScheme>(() =>
        this.mode() === 'system'
            ? this.systemScheme()
            : (this.mode() as ColorScheme),
    );

    constructor() {
        this.media.addEventListener('change', (e) => {
            this.systemScheme.set(e.matches ? 'dark' : 'light');
            this.apply();
        });
        this.apply();
    }

    setMode(mode: ThemeMode): void {
        this.mode.set(mode);
        try {
            localStorage.setItem(THEME_STORAGE_KEY, mode);
        } catch {
            // Storage blocked (private mode): the choice lasts for this visit
        }
        this.apply();
    }

    /** System → light → dark → system. */
    cycle(): void {
        this.setMode(MODES[(MODES.indexOf(this.mode()) + 1) % MODES.length]);
    }

    private apply(): void {
        const root = document.documentElement;
        root.dataset['theme'] = this.scheme();
        root.style.colorScheme = this.scheme();
    }

    private readStoredMode(): ThemeMode {
        try {
            const stored = localStorage.getItem(
                THEME_STORAGE_KEY,
            ) as ThemeMode | null;
            if (stored && MODES.includes(stored)) return stored;
        } catch {
            // Storage blocked: fall back to the system setting
        }
        return 'system';
    }
}
