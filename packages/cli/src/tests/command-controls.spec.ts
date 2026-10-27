import { ICliCommandProcessor } from '@qodalis/cli-core';
import { CliNanoCommandProcessor } from '../lib/processors/system/cli-nano-command-processor';
import { CliHtopCommandProcessor } from '../lib/processors/system/cli-htop-command-processor';
import { CliSshCommandProcessor } from '../lib/server/cli-ssh-command-processor';

describe('built-in command controls', () => {
    const commands: [string, () => ICliCommandProcessor][] = [
        ['nano', () => new CliNanoCommandProcessor()],
        ['htop', () => new CliHtopCommandProcessor()],
        ['ssh', () => new CliSshCommandProcessor()],
    ];

    for (const [name, create] of commands) {
        it(`${name} declares well-formed keys`, () => {
            const keys = create().controls?.keys ?? [];
            expect(keys.length).toBeGreaterThan(0);
            for (const key of keys) {
                expect(key.label).toBeTruthy();
                expect(key.data).toBeTruthy();
            }
            expect(new Set(keys.map((k) => k.label)).size).toBe(keys.length);
        });
    }

    it('nano keeps the keyboard and lists its shortcuts', () => {
        const controls = new CliNanoCommandProcessor().controls!;
        expect(controls.textInput).toBeTrue();
        const byLabel = Object.fromEntries(
            controls.keys.map((k) => [k.label, k.data]),
        );
        expect(byLabel['Save']).toBe('\x13');
        expect(byLabel['Exit']).toBe('\x18');
        expect(byLabel['Cut']).toBe('\x0b');
        expect(byLabel['Paste']).toBe('\x15');
    });
});
