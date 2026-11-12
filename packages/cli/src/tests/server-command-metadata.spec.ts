import { CliServerCommandDescriptor, ICliCommandProcessor } from '@qodalis/cli-core';
import { CliServerProxyProcessor } from '../lib/server/cli-server-proxy-processor';
import { CliServerMultiProxyProcessor } from '../lib/server/cli-server-multi-proxy-processor';
import { CliServerManager } from '../lib/server/cli-server-manager';
import { CliCommandProcessorRegistry } from '../lib/registry';
import { CliHelpCommandProcessor } from '../lib/processors/system/cli-help-command-processor';
import { CliProcessorsRegistry_TOKEN } from '../lib/tokens';
import { CliCompletionEngine } from '../lib/completion/cli-completion-engine';
import { CliCommandCompletionProvider } from '../lib/completion/cli-command-completion-provider';
import { CliParameterCompletionProvider } from '../lib/completion/cli-parameter-completion-provider';
import { CliParameterValueCompletionProvider } from '../lib/completion/cli-parameter-value-completion-provider';

const THINGS: CliServerCommandDescriptor = {
    command: 'things',
    description: 'Manages things',
    aliases: ['th'],
    module: 'inventory',
    icon: '📦',
    documentation: 'First paragraph.\n\nSecond paragraph.',
    examples: [{ command: 'things show 1', description: 'Shows thing 1' }, { command: 'things' }],
    parameters: [
        { name: 'format', aliases: ['f'], description: 'Output format', required: false, type: 'string', allowedValues: ['table', 'json'], examples: ['json'] },
        { name: 'verbose', description: 'More output', required: false, type: 'boolean' },
    ],
    processors: [{ command: 'show', description: 'Shows a thing', aliases: ['sh'] }],
};

const PLAIN: CliServerCommandDescriptor = { command: 'status', description: 'Server status' };

const connection = (commands: CliServerCommandDescriptor[]): any => ({
    connected: true,
    commands,
    connect: async () => undefined,
    stopHealthCheck: () => undefined,
    startHealthCheck: () => undefined,
});

const plain = (l: string) => l.replace(/\x1b\[[0-9;]*m/g, '');

function textContext(cols = 100) {
    const lines: string[] = [];
    const context: any = {
        terminal: { cols },
        translator: {
            t: (_: string, fallback: string, params?: Record<string, string>) =>
                fallback.replace(/\{(\w+)\}/g, (_m, k) => params?.[k] ?? `{${k}}`),
        },
        writer: {
            writeln: (t = '') => lines.push(t),
            write: (t: string) => lines.push(t),
            writeError: (t: string) => lines.push(t),
            writeBox: (box: string[]) => lines.push(...box),
            wrapInColor: (t: string) => t,
        },
    };
    return { context, lines };
}

describe('server command metadata on proxy processors', () => {
    it('maps module, icon, namespaced aliases and the server name', () => {
        const proxy = new CliServerProxyProcessor(connection([THINGS]), THINGS, 'node');
        expect(proxy.command).toBe('node:things');
        expect(proxy.aliases).toEqual(['node:th']);
        expect(proxy.metadata).toEqual(jasmine.objectContaining({ module: 'inventory', icon: '📦', requireServer: true, server: 'node' }));
        expect(proxy.processors![0].aliases).toEqual(['sh']);
    });

    it('falls back to the server module and the 🖥 icon for older servers', () => {
        const proxy = new CliServerProxyProcessor(connection([PLAIN]), PLAIN, 'node');
        expect(proxy.aliases).toBeUndefined();
        expect(proxy.metadata).toEqual(jasmine.objectContaining({ module: 'server:node', icon: '\u{1F5A5}' }));
        expect(proxy.writeDescription).toBeUndefined();
    });

    it('writes the documentation paragraphs and the examples', () => {
        const proxy = new CliServerProxyProcessor(connection([THINGS]), THINGS, 'node');
        const { context, lines } = textContext();
        proxy.writeDescription!(context);
        const text = lines.map(plain);
        expect(text).toContain('First paragraph.');
        expect(text).toContain('Second paragraph.');
        expect(text.some((l) => l.includes('things show 1') && l.includes('# Shows thing 1'))).toBeTrue();
        expect(text.some((l) => l.trim() === 'things')).toBeTrue();
    });

    it('refuses values outside the allowed ones, ignoring case', () => {
        const proxy = new CliServerProxyProcessor(connection([THINGS]), THINGS, 'node');
        const format = proxy.parameters!.find((p) => p.name === 'format')!;
        expect(format.allowedValues).toEqual(['table', 'json']);
        expect(format.validator!('JSON').valid).toBeTrue();
        expect(format.validator!('xml')).toEqual({ valid: false, message: '--format must be one of: table, json' });
        expect(proxy.parameters!.find((p) => p.name === 'verbose')!.validator).toBeUndefined();
        expect(format.examples).toEqual(['json']);
        expect(proxy.parameters!.find((p) => p.name === 'verbose')!.examples).toBeUndefined();
    });

    it('drops leading dashes from parameter aliases (servers declare "-a" or "a")', () => {
        const descriptor: CliServerCommandDescriptor = {
            command: 'hash',
            parameters: [{ name: 'algorithm', aliases: ['-a', '--alg'], description: 'Algorithm', required: false, type: 'string' }],
        };
        const proxy = new CliServerProxyProcessor(connection([descriptor]), descriptor, 'node');
        expect(proxy.parameters![0].aliases).toEqual(['a', 'alg']);
    });

    it('drops terminal escapes from everything the server sends for help', () => {
        const ESC = '\u001b';
        const descriptor: CliServerCommandDescriptor = {
            command: 'evil',
            description: `Desc${ESC}[2J`,
            aliases: [`ev${ESC}]0;x\u0007`, 'two words', ''],
            module: `mod${ESC}[31m`,
            icon: `${ESC}[5m!`,
            documentation: `Para ${ESC}]8;;https://x.io\u0007one\nline two.\n\nSecond.`,
            examples: [{ command: `evil ${ESC}[1A`, description: `Ex${ESC}c` }],
            parameters: [
                { name: 'mode', aliases: [`-m${ESC}[0m`], description: `Mode${ESC}[K`, required: false, type: 'string', allowedValues: [`a${ESC}[31m`, 'b'], examples: [`x${ESC}[2J`] },
            ],
        };
        const proxy = new CliServerProxyProcessor(connection([descriptor]), descriptor, 'node');
        const { context, lines } = textContext();
        proxy.writeDescription!(context);
        const printed = [
            proxy.description,
            ...(proxy.aliases ?? []),
            proxy.metadata!['module'],
            proxy.metadata!['icon'],
            ...lines,
            ...proxy.parameters!.flatMap((p) => [p.description, ...(p.aliases ?? []), ...(p.allowedValues ?? []), ...(p.examples ?? [])]),
        ].join('|');
        expect(printed).not.toMatch(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/);
        expect(proxy.description).toBe('Desc[2J');
        expect(proxy.aliases).toEqual(['node:ev]0;x']);
        expect(proxy.parameters![0].allowedValues).toEqual(['a[31m', 'b']);
        expect(proxy.parameters![0].examples).toEqual(['x[2J']);
        expect(proxy.parameters![0].aliases).toEqual(['m[0m']);
        expect(lines.map(plain)).toContain('Second.');
    });

    it('multi-server proxies take the metadata of the first server and keep sub-command aliases', () => {
        const entries = [
            { serverName: 'node', connection: connection([THINGS]), descriptor: THINGS },
            { serverName: 'python', connection: connection([THINGS]), descriptor: THINGS },
        ];
        const multi = new CliServerMultiProxyProcessor(entries, { defaultServer: null });
        expect(multi.metadata).toEqual(jasmine.objectContaining({ module: 'inventory', icon: '📦' }));
        expect(multi.aliases).toBeUndefined();
        expect(multi.processors![0].aliases).toEqual(['sh']);
        expect(multi.writeDescription).toBeDefined();
    });
});

describe('server command aliases in the registry', () => {
    it('registers the aliases of a bare alias, but never over a local command', async () => {
        const registry = new CliCommandProcessorRegistry();
        const local: any = { command: 'local-th', aliases: ['b64'], processCommand: async () => undefined };
        registry.registerProcessor(local);
        const b64: CliServerCommandDescriptor = { command: 'base64', description: 'Base64', aliases: ['b64', 'bsf'] };
        const manager = new CliServerManager(registry);
        manager.connections.set('node', connection([THINGS, b64]));
        await manager.reconnect('node');

        expect(registry.findProcessor('th', [])?.command).toBe('things');
        expect(registry.findProcessor('node:th', [])?.command).toBe('node:things');
        expect(registry.findProcessor('th', ['sh'])?.command).toBe('show');
        expect(registry.findProcessor('b64', [])).toBe(local);
        expect(registry.findProcessor('bsf', [])?.command).toBe('base64');
    });

    it('sends the canonical command path when run through an alias', async () => {
        const conn = connection([THINGS]);
        conn.capabilities = { streaming: false };
        conn.config = { timeout: 1000 };
        let sent: any;
        conn.execute = async (cmd: any) => {
            sent = cmd;
            return { exitCode: 0, outputs: [] };
        };
        const proxy = new CliServerProxyProcessor(conn, THINGS, 'node');
        const show = proxy.processors![0];
        await show.processCommand(
            { command: 'th', chainCommands: ['sh'], args: {}, rawCommand: 'th sh 1', value: '1' } as any,
            { notifier: { info: () => undefined }, spinner: undefined, writer: { writeln: () => undefined }, process: { exit: () => undefined } } as any,
        );
        expect(sent.command).toBe('things');
        expect(sent.chainCommands).toEqual(['show']);
    });
});

describe('help of a server command', () => {
    async function help(processor: ICliCommandProcessor, cols = 100) {
        const { context, lines } = textContext(cols);
        const registry = { processors: [processor], findProcessor: () => processor };
        context.executor = { getGlobalParameters: () => [] };
        context.services = {
            getRequired: (t: any) => (t === CliProcessorsRegistry_TOKEN ? registry : undefined),
            get: () => undefined,
        };
        await new CliHelpCommandProcessor().processCommand(
            { command: `help ${processor.command}`, args: {}, chainCommands: [], rawCommand: `help ${processor.command}` } as any,
            context,
        );
        return lines.map(plain);
    }

    it('shows the documentation, examples, allowed values, parameter examples and the server it runs on', async () => {
        const text = await help(new CliServerProxyProcessor(connection([THINGS]), THINGS, 'node'));
        expect(text).toContain('First paragraph.');
        expect(text.some((l) => l.includes('# Shows thing 1'))).toBeTrue();
        expect(text.some((l) => l.includes('one of: table, json'))).toBeTrue();
        expect(text.some((l) => l.includes('e.g. json'))).toBeTrue();
        expect(text.some((l) => l.includes('Runs on server node'))).toBeTrue();
    });

    it('lists allowed values and parameter examples on narrow terminals too', async () => {
        const text = await help(new CliServerProxyProcessor(connection([THINGS]), THINGS, 'node'), 40);
        expect(text.some((l) => l.includes('one of: table, json'))).toBeTrue();
        expect(text.some((l) => l.includes('e.g. json'))).toBeTrue();
    });
});

describe('completion of allowed values', () => {
    let engine: CliCompletionEngine;

    beforeEach(() => {
        const registry = new CliCommandProcessorRegistry();
        registry.registerProcessor(new CliServerProxyProcessor(connection([THINGS]), THINGS, 'node'));
        const executor: any = { getGlobalParameters: () => [] };
        engine = new CliCompletionEngine();
        engine.setProviders([
            new CliCommandCompletionProvider(registry),
            new CliParameterValueCompletionProvider(registry),
            new CliParameterCompletionProvider(registry, executor),
        ]);
    });

    const candidates = async (input: string): Promise<string[]> => {
        engine.resetState();
        const first = await engine.complete(input, input.length);
        if (first.action === 'complete') return [first.replacement!];
        const second = await engine.complete(input, input.length);
        return second.candidates ?? [];
    };

    it('offers the values after --name and -alias', async () => {
        expect(await candidates('node:things --format ')).toEqual(['json', 'table']);
        expect(await candidates('node:things -f j')).toEqual(['json']);
        expect(await candidates('node:things --format T')).toEqual(['table']);
    });

    it('completes --name=value inside the word', async () => {
        expect(await candidates('node:things --format=t')).toEqual(['--format=table']);
    });

    it('still completes flag names', async () => {
        expect(await candidates('node:things --fo')).toEqual(['--format']);
    });
});
