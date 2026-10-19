import {
    compareSemver,
    isNewerVersion,
    KNOWN_PLUGIN_SHORT_NAMES,
    parsePackageSpec,
    splitPackageArgs,
    toFullPackageName,
} from '../lib/processors/system/packages/package-utils';

describe('pkg package-utils', () => {
    describe('splitPackageArgs', () => {
        it('ignores repeated and surrounding whitespace', () => {
            expect(splitPackageArgs('  guid   qr ')).toEqual(['guid', 'qr']);
        });

        it('returns an empty list for empty input', () => {
            expect(splitPackageArgs(undefined)).toEqual([]);
            expect(splitPackageArgs('   ')).toEqual([]);
        });
    });

    describe('parsePackageSpec', () => {
        it('parses short and scoped names without a version', () => {
            expect(parsePackageSpec('guid')).toEqual({ name: 'guid' });
            expect(parsePackageSpec('@qodalis/cli-guid')).toEqual({
                name: '@qodalis/cli-guid',
            });
        });

        it('parses versions on short and scoped names', () => {
            expect(parsePackageSpec('guid@1.0.2')).toEqual({
                name: 'guid',
                version: '1.0.2',
            });
            expect(parsePackageSpec('@qodalis/cli-guid@2.0.0-beta.18')).toEqual({
                name: '@qodalis/cli-guid',
                version: '2.0.0-beta.18',
            });
        });

        it('ignores a trailing @ with no version', () => {
            expect(parsePackageSpec('guid@')).toEqual({ name: 'guid' });
        });
    });

    describe('toFullPackageName', () => {
        it('prefixes short names only', () => {
            const prefix = '@qodalis/cli-';
            expect(toFullPackageName('guid', prefix)).toBe('@qodalis/cli-guid');
            expect(toFullPackageName('@qodalis/cli-guid', prefix)).toBe(
                '@qodalis/cli-guid',
            );
        });
    });

    describe('compareSemver', () => {
        it('orders prerelease numbers numerically', () => {
            expect(compareSemver('2.0.0-beta.9', '2.0.0-beta.18')).toBe(-1);
            expect(compareSemver('2.0.0-beta.18', '2.0.0-beta.17')).toBe(1);
        });

        it('ranks a release above its prereleases', () => {
            expect(compareSemver('2.0.0', '2.0.0-beta.18')).toBe(1);
            expect(compareSemver('2.0.0-rc.1', '2.0.0')).toBe(-1);
        });

        it('compares core versions', () => {
            expect(compareSemver('1.10.0', '1.9.9')).toBe(1);
            expect(compareSemver('1.0.0', '1.0.0')).toBe(0);
        });

        it('returns null for non-semver input', () => {
            expect(compareSemver('latest', '1.0.0')).toBeNull();
        });
    });

    describe('isNewerVersion', () => {
        it('only reports strictly newer versions', () => {
            expect(isNewerVersion('2.0.0-beta.18', '2.0.0-beta.17')).toBeTrue();
            expect(isNewerVersion('2.0.0-beta.17', '2.0.0-beta.18')).toBeFalse();
            expect(isNewerVersion('1.0.0', '1.0.0')).toBeFalse();
            expect(isNewerVersion(undefined, '1.0.0')).toBeFalse();
        });

        it('treats a different non-semver version as an update', () => {
            expect(isNewerVersion('1.0.0', 'latest')).toBeTrue();
        });
    });

    it('lists every official plugin once', () => {
        expect(new Set(KNOWN_PLUGIN_SHORT_NAMES).size).toBe(
            KNOWN_PLUGIN_SHORT_NAMES.length,
        );
        expect(KNOWN_PLUGIN_SHORT_NAMES).toContain('encode');
        expect(KNOWN_PLUGIN_SHORT_NAMES).toContain('data-explorer');
    });
});
