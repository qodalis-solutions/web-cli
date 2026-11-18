import { ICliExecutionContext } from '@qodalis/cli-core';
import {
    packageDisplayName,
    writePackageList,
} from '../lib/processors/system/packages/package-list';

describe('pkg package listing', () => {
    let lines: string[];

    const contextWithCols = (cols: number) =>
        ({
            terminal: { cols },
            writer: {
                writeln: (text = '') => lines.push(text),
                wrapInColor: (text: string) => text,
            },
        }) as unknown as ICliExecutionContext;

    const rows = [
        {
            name: 'guid',
            version: 'v2.6.0',
            detail: '[jsdelivr]',
            status: '✅ installed',
            description: 'Generate and validate GUIDs',
        },
        {
            name: 'server-logs',
            version: 'v2.6.0',
            detail: '[unpkg]',
            status: '📥 not installed',
        },
    ];

    beforeEach(() => {
        lines = [];
    });

    it('shortens the names of the CLI packages only', () => {
        expect(packageDisplayName('@qodalis/cli-guid', '@qodalis/cli-')).toBe(
            'guid',
        );
        expect(packageDisplayName('left-pad', '@qodalis/cli-')).toBe(
            'left-pad',
        );
    });

    it('aligns name, version and source in columns on a wide terminal', () => {
        writePackageList(contextWithCols(100), rows);

        expect(lines).toEqual([
            '  guid         v2.6.0  [jsdelivr]  ✅ installed',
            '    Generate and validate GUIDs',
            '  server-logs  v2.6.0  [unpkg]     📥 not installed',
        ]);
    });

    it('writes one block per package on a phone', () => {
        writePackageList(contextWithCols(40), rows);

        expect(lines).toEqual([
            '  guid  ✅ installed',
            '    v2.6.0  [jsdelivr]',
            '    Generate and validate GUIDs',
            '',
            '  server-logs  📥 not installed',
            '    v2.6.0  [unpkg]',
        ]);
    });

    it('puts the version next to the name when there is no status', () => {
        writePackageList(contextWithCols(40), [
            { name: 'guid', version: '2.6.0' },
            { name: 'qr', version: '2.6.0' },
        ]);

        expect(lines).toEqual(['  guid  2.6.0', '  qr  2.6.0']);
    });

    it('wraps long descriptions at word boundaries', () => {
        writePackageList(contextWithCols(30), [
            {
                name: 'guid',
                description:
                    'Generate, validate and format GUIDs in several styles',
            },
        ]);

        expect(lines.slice(1).every((l) => l.length <= 29)).toBeTrue();
        expect(lines.slice(1).join(' ').replace(/\s+/g, ' ').trim()).toBe(
            'Generate, validate and format GUIDs in several styles',
        );
    });
});
