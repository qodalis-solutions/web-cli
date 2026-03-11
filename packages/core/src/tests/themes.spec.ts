import { DefaultThemes, DefaultThemeInfos } from '../lib/themes';

describe('DefaultThemes', () => {
    it('should have at least 25 themes', () => {
        const names = Object.keys(DefaultThemes);
        expect(names.length).toBeGreaterThanOrEqual(25);
    });

    it('should have complete palettes for all themes', () => {
        const requiredKeys = [
            'background',
            'foreground',
            'black',
            'red',
            'green',
            'yellow',
            'blue',
            'magenta',
            'cyan',
            'white',
            'brightBlack',
            'brightRed',
            'brightGreen',
            'brightYellow',
            'brightBlue',
            'brightMagenta',
            'brightCyan',
            'brightWhite',
        ];

        for (const [name, theme] of Object.entries(DefaultThemes)) {
            for (const key of requiredKeys) {
                expect((theme as any)[key]).toBeTruthy(
                    `Theme "${name}" is missing "${key}"`,
                );
            }
        }
    });

    it('should have yellow as alias for highContrastLight', () => {
        expect(DefaultThemes.yellow).toBe(
            DefaultThemes.highContrastLight,
        );
    });

    it('should have valid hex color values', () => {
        const hexPattern = /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/;
        for (const [name, theme] of Object.entries(DefaultThemes)) {
            if (theme.background) {
                expect(hexPattern.test(theme.background as string)).toBe(
                    true,
                    `Theme "${name}" background "${theme.background}" is not valid hex`,
                );
            }
            if (theme.foreground) {
                expect(hexPattern.test(theme.foreground as string)).toBe(
                    true,
                    `Theme "${name}" foreground "${theme.foreground}" is not valid hex`,
                );
            }
        }
    });
});

describe('DefaultThemeInfos', () => {
    it('should have info for every theme except yellow alias', () => {
        const themeNames = Object.keys(DefaultThemes).filter(
            (n) => n !== 'yellow',
        );
        for (const name of themeNames) {
            expect(DefaultThemeInfos[name]).toBeTruthy(
                `Missing theme info for "${name}"`,
            );
        }
    });

    it('should have valid categories', () => {
        for (const [name, info] of Object.entries(
            DefaultThemeInfos,
        )) {
            expect(['dark', 'light']).toContain(info.category);
            expect(info.description.length).toBeGreaterThan(0);
            expect(info.tags.length).toBeGreaterThan(0);
            expect(info.theme).toBeTruthy(
                `Theme info "${name}" has no theme reference`,
            );
        }
    });

    it('should correctly categorize light themes', () => {
        const lightThemes = [
            'solarizedLight',
            'gruvboxLight',
            'highContrastLight',
            'catppuccinLatte',
            'rosePineDawn',
            'everforestLight',
            'githubLight',
        ];
        for (const name of lightThemes) {
            expect(DefaultThemeInfos[name]?.category).toBe(
                'light',
                `${name} should be categorized as light`,
            );
        }
    });

    it('should not include yellow alias in theme infos', () => {
        expect(DefaultThemeInfos['yellow']).toBeUndefined();
    });

    it('should reference the same theme objects as DefaultThemes', () => {
        for (const [name, info] of Object.entries(
            DefaultThemeInfos,
        )) {
            expect(info.theme).toBe(
                DefaultThemes[name],
                `Theme info "${name}" references a different object than DefaultThemes`,
            );
        }
    });
});
