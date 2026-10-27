import { CliTestHarness } from '../lib/testing';
import {
    CliProcessCommand,
    DefaultLibraryAuthor,
    ICliCommandParameterDescriptor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';

// ---------------------------------------------------------------------------
// `--flag value` (space form) on commands and sub-commands
// ---------------------------------------------------------------------------

const param = (
    name: string,
    type: ICliCommandParameterDescriptor['type'],
    aliases?: string[],
): ICliCommandParameterDescriptor => ({
    name,
    type,
    aliases,
    description: name,
    required: false,
});

type Call = { command: string; args: Record<string, any>; value?: string };

function processor(
    command: string,
    calls: Call[],
    options: Partial<ICliCommandProcessor> = {},
): ICliCommandProcessor {
    return {
        command,
        description: command,
        author: DefaultLibraryAuthor,
        ...options,
        async processCommand(cmd: CliProcessCommand, context: ICliExecutionContext) {
            calls.push({ command, args: cmd.args, value: cmd.value });
            const text = `${command} ${JSON.stringify(cmd.args)}`;
            context.writer.writeln(text);
            context.process.output(text);
        },
    };
}

class UpperProcessor implements ICliCommandProcessor {
    command = 'upper';
    description = 'Uppercase piped input';
    author = DefaultLibraryAuthor;
    acceptsRawInput = true;

    async processCommand(command: CliProcessCommand, context: ICliExecutionContext) {
        const result = String(command.data ?? command.value ?? '').toUpperCase();
        context.writer.writeln(result);
        context.process.output(result);
    }
}

describe('space-separated flag values', () => {
    let harness: CliTestHarness;
    let calls: Call[];

    beforeEach(() => {
        calls = [];
        harness = new CliTestHarness();
        harness.registerProcessors([
            processor('flip', calls, {
                parameters: [param('times', 'number', ['t'])],
            }),
            processor('dice', calls, {
                parameters: [param('seed', 'number')],
                processors: [
                    processor('roll', calls, {
                        parameters: [
                            param('sides', 'number', ['s']),
                            param('label', 'string'),
                            param('verbose', 'boolean', ['v']),
                        ],
                    }),
                    processor('show', calls, {
                        acceptsRawInput: true,
                        parameters: [param('verbose', 'boolean', ['v'])],
                    }),
                    processor('cat', calls, {
                        valueRequired: true,
                        parameters: [param('lines', 'number', ['n'])],
                    }),
                ],
            }),
            new UpperProcessor(),
        ]);
    });

    const last = () => calls[calls.length - 1];

    it('top-level command: --flag value', async () => {
        const result = await harness.execute('flip --times 3');
        expect(result.exitCode).toBe(0);
        expect(last().command).toBe('flip');
        expect(last().args['times']).toBe(3);
    });

    it('top-level command with sub-commands: its own --flag value', async () => {
        const result = await harness.execute('dice --seed 42');
        expect(result.exitCode).toBe(0);
        expect(last().command).toBe('dice');
        expect(last().args['seed']).toBe(42);
    });

    it('sub-command: number --flag value', async () => {
        const result = await harness.execute('dice roll --sides 6');
        expect(result.stderr.join('\n')).not.toContain('Command not found');
        expect(result.exitCode).toBe(0);
        expect(last().command).toBe('roll');
        expect(last().args['sides']).toBe(6);
    });

    it('sub-command: --flag=value still works', async () => {
        await harness.execute('dice roll --sides=6');
        expect(last().command).toBe('roll');
        expect(last().args['sides']).toBe(6);
    });

    it('sub-command: string --flag value', async () => {
        const result = await harness.execute('dice roll --label "big one"');
        expect(result.exitCode).toBe(0);
        expect(last().command).toBe('roll');
        expect(last().args['label']).toBe('big one');
    });

    it('sub-command: several space-form flags', async () => {
        await harness.execute('dice roll --sides 20 --label d20 --verbose');
        expect(last().command).toBe('roll');
        expect(last().args['sides']).toBe(20);
        expect(last().args['label']).toBe('d20');
        expect(last().args['verbose']).toBe(true);
    });

    it('sub-command: parameter alias with a space-separated value', async () => {
        await harness.execute('dice roll -s 8');
        expect(last().command).toBe('roll');
        expect(last().args['sides']).toBe(8);
        expect(last().args['s']).toBe(8);
    });

    it('boolean flag does not swallow the positional value', async () => {
        const result = await harness.execute('dice show --verbose foo');
        expect(result.exitCode).toBe(0);
        expect(last().command).toBe('show');
        expect(last().args['verbose']).toBe(true);
        expect(last().value).toBe('foo');
    });

    it('boolean flag before a sub-command word does not swallow it', async () => {
        await harness.execute('dice show -v foo bar');
        expect(last().command).toBe('show');
        expect(last().args['v']).toBe(true);
        expect(last().value).toBe('foo bar');
    });

    it('parent parameter before the sub-command', async () => {
        const result = await harness.execute('dice --seed 5 roll --sides 6');
        expect(result.exitCode).toBe(0);
        expect(last().command).toBe('roll');
        expect(last().args['seed']).toBe(5);
        expect(last().args['sides']).toBe(6);
    });

    it('parent parameter after the sub-command', async () => {
        const result = await harness.execute('dice roll --seed 5');
        expect(result.exitCode).toBe(0);
        expect(last().command).toBe('roll');
        expect(last().args['seed']).toBe(5);
    });

    it('child parameter is not a parent parameter', async () => {
        // `sides` belongs to `roll`, so on `dice` the 6 is not its value
        const result = await harness.execute('dice --sides 6');
        expect(result.stderr.join('\n')).toContain('Command not found');
    });

    it('value-accepting sub-command: flag before the value', async () => {
        await harness.execute('dice cat --lines 3 notes.txt');
        expect(last().command).toBe('cat');
        expect(last().args['lines']).toBe(3);
        expect(last().value).toBe('notes.txt');
    });

    it('value-accepting sub-command: flag after the value', async () => {
        await harness.execute('dice cat notes.txt -n 3');
        expect(last().command).toBe('cat');
        expect(last().args['lines']).toBe(3);
        expect(last().value).toBe('notes.txt');
    });

    it('piped: dice roll --sides 6 | upper', async () => {
        const result = await harness.execute('dice roll --sides 6 | upper');
        expect(result.exitCode).toBe(0);
        expect(result.output).toContain('ROLL {"SIDES":6,"S":6}');
    });

    it('chained with &&', async () => {
        const result = await harness.execute('dice roll --sides 6 && dice roll -s 12 --label x');
        expect(result.exitCode).toBe(0);
        expect(calls.map((c) => c.args['sides'])).toEqual([6, 12]);
        expect(last().args['label']).toBe('x');
    });

    it('unknown sub-command word is still not found', async () => {
        const result = await harness.execute('dice jump --sides 6');
        expect(result.stderr.join('\n')).toContain('Command not found');
    });
});
