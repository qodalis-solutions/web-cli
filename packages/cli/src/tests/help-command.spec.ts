import { ICliCommandProcessor } from '@qodalis/cli-core';
import { CliHelpCommandProcessor } from '../lib/processors/system/cli-help-command-processor';
import { CliProcessorsRegistry_TOKEN } from '../lib/tokens';

function helpContext(cols: number, processor: ICliCommandProcessor) {
    const lines: string[] = [];
    const registry = { processors: [processor], findProcessor: () => processor };
    const context: any = {
        terminal: { cols },
        executor: {
            getGlobalParameters: () => [
                { name: 'help', aliases: ['h'], type: 'boolean', required: false, description: 'Displays help for the command' },
            ],
        },
        services: { getRequired: (t: any) => (t === CliProcessorsRegistry_TOKEN ? registry : undefined) },
        translator: { t: (_: string, fallback: string) => fallback },
        writer: {
            writeln: (t = '') => lines.push(t),
            write: (t: string) => lines.push(t),
            writeError: (t: string) => lines.push(t),
            writeBox: () => {},
            wrapInColor: (t: string) => t,
        },
    };
    return { context, lines };
}

const plain = (l: string) => l.replace(/\x1b\[[0-9;]*m/g, '');

describe('help on a narrow terminal', () => {
    const tool: ICliCommandProcessor = {
        command: 'tool',
        description: 'A tool',
        processCommand: async () => {},
        parameters: [
            {
                name: 'mode',
                type: 'string',
                required: false,
                description: 'Choose how the tool runs when several servers provide it',
            },
        ],
        processors: [
            {
                command: 'status',
                description: 'Check that servers are reachable (all, or one in detail)',
                processCommand: async () => {},
            },
        ],
    };

    it('wraps descriptions at word boundaries within the width', async () => {
        const { context, lines } = helpContext(36, tool);
        await new CliHelpCommandProcessor().processCommand(
            { command: 'help tool', args: {}, chainCommands: [], rawCommand: 'help tool' } as any,
            context,
        );
        const text = lines.map(plain);
        expect(text.every((l) => l.length <= 36)).toBeTrue();
        expect(text).toContain('      Check that servers are');
        expect(text.join(' ')).toContain('reachable (all, or one in');
        expect(text).toContain('      Choose how the tool runs when');
    });
});
