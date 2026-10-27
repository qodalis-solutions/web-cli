import { ICliCommandProcessor } from '@qodalis/cli-core';
import { CliStopwatchCommandProcessor } from '../lib/processors/cli-stopwatch-command-processor';

describe('stopwatch controls', () => {
    const processor = new CliStopwatchCommandProcessor();
    const withControls: ICliCommandProcessor[] = [
        processor,
        ...(processor.processors ?? []).filter((p) => p.command === 'timer'),
    ];

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

    it('the timer has its own controls', () => {
        const timer = new CliStopwatchCommandProcessor().processors?.find(
            (p) => p.command === 'timer',
        );
        expect(timer?.controls?.keys.map((k) => k.label)).toEqual([
            'PAUSE',
            'R',
            'Q',
        ]);
    });
});
