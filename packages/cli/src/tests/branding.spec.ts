import {
    DEFAULT_CLI_NAME,
    getCliNameArt,
    resolveCliBranding,
} from '../lib/constants';
import { PANEL_LABELS, panelBranding } from '../lib/panel/panel-view';

describe('resolveCliBranding', () => {
    it('keeps the Qodalis defaults without branding', () => {
        const branding = resolveCliBranding();

        expect(branding.name).toBe(DEFAULT_CLI_NAME);
        expect(branding.custom).toBe(false);
        expect(branding.icon).toBeUndefined();
        expect(branding.art(80)).toBe(getCliNameArt(80));
    });

    it("uses the host's name instead of the Qodalis art", () => {
        const branding = resolveCliBranding({
            name: 'RateBell CLI',
            icon: '/favicon.svg',
        });

        expect(branding.name).toBe('RateBell CLI');
        expect(branding.custom).toBe(true);
        expect(branding.icon).toBe('/favicon.svg');
        expect(branding.art(80)).toContain('RateBell CLI');
        expect(branding.art(80)).not.toBe(getCliNameArt(80));
    });

    it('treats blank values as unset', () => {
        const branding = resolveCliBranding({ name: '  ', icon: ' ' });

        expect(branding.name).toBe(DEFAULT_CLI_NAME);
        expect(branding.custom).toBe(false);
        expect(branding.icon).toBeUndefined();
    });
});

describe('panelBranding', () => {
    it('is "CLI" with the terminal glyph by default', () => {
        expect(panelBranding()).toEqual({
            title: PANEL_LABELS.title,
            iconUrl: undefined,
        });
    });

    it("takes the host's name and icon", () => {
        expect(
            panelBranding({
                branding: { name: 'RateBell CLI', icon: '/favicon.svg' },
            }),
        ).toEqual({
            title: 'RateBell CLI',
            iconUrl: '/favicon.svg',
        });
    });
});
