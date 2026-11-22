import { TestBed } from '@angular/core/testing';
import { THEME_STORAGE_KEY, ThemeService } from './theme.service';

describe('ThemeService', () => {
    const systemScheme = (): 'light' | 'dark' =>
        window.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark'
            : 'light';

    beforeEach(() => {
        localStorage.removeItem(THEME_STORAGE_KEY);
        TestBed.resetTestingModule();
    });

    afterEach(() => localStorage.removeItem(THEME_STORAGE_KEY));

    it('follows the system setting by default', () => {
        const theme = TestBed.inject(ThemeService);
        expect(theme.mode()).toBe('system');
        expect(theme.scheme()).toBe(systemScheme());
        expect(document.documentElement.dataset['theme']).toBe(systemScheme());
    });

    it('cycles system, light, dark and back', () => {
        const theme = TestBed.inject(ThemeService);
        theme.cycle();
        expect(theme.mode()).toBe('light');
        theme.cycle();
        expect(theme.mode()).toBe('dark');
        theme.cycle();
        expect(theme.mode()).toBe('system');
    });

    it('applies and stores a fixed scheme', () => {
        const theme = TestBed.inject(ThemeService);
        theme.setMode('light');
        expect(theme.scheme()).toBe('light');
        expect(document.documentElement.dataset['theme']).toBe('light');
        expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');

        theme.setMode('dark');
        expect(document.documentElement.dataset['theme']).toBe('dark');
        expect(document.documentElement.style.colorScheme).toBe('dark');
    });

    it('restores the stored choice and ignores unknown values', () => {
        localStorage.setItem(THEME_STORAGE_KEY, 'dark');
        expect(TestBed.inject(ThemeService).mode()).toBe('dark');

        TestBed.resetTestingModule();
        localStorage.setItem(THEME_STORAGE_KEY, 'sepia');
        expect(TestBed.inject(ThemeService).mode()).toBe('system');
    });
});
