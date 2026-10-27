import { ICliCommandProcessor } from '@qodalis/cli-core';
import { CliWordleCommandProcessor } from '../lib/processors/cli-wordle-command-processor';

describe('wordle controls', () => {
    const processor = new CliWordleCommandProcessor();
    const withControls: ICliCommandProcessor[] = [processor];

    it('declare the keys it reads, for on-screen key rows', () => {
        for (const p of withControls) {
            const keys = p.controls?.keys ?? [];
            expect(keys.length).withContext(p.command).toBeGreaterThan(0);
            for (const key of keys) {
                expect(key.label).withContext(p.command).toBeTruthy();
                expect(key.data)
                    .withContext(`${p.command} ${key.label}`)
                    .toBeTruthy();
            }
            expect(new Set(keys.map((k) => k.label)).size)
                .withContext(p.command)
                .toBe(keys.length);
        }
    });

    it('a tap sends one of its keys', () => {
        for (const p of withControls) {
            const tap = p.controls?.tap;
            if (tap !== undefined) {
                expect(p.controls!.keys.some((k) => k.data === tap))
                    .withContext(p.command)
                    .toBeTrue();
            }
        }
    });
});
