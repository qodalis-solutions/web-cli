import { CliCommandProcessorRegistry } from '../lib/registry';
import { ICliCommandProcessor } from '@qodalis/cli-core';

const createProcessor = (
    command: string,
    aliases?: string[],
): ICliCommandProcessor => ({
    command,
    aliases,
    description: `Test ${command}`,
    async processCommand() {},
});

describe('CliCommandProcessorRegistry', () => {
    let registry: CliCommandProcessorRegistry;

    beforeEach(() => {
        registry = new CliCommandProcessorRegistry();
    });

    it('should register and find a processor', () => {
        const proc = createProcessor('test');
        registry.registerProcessor(proc);
        expect(registry.findProcessor('test', [])).toBe(proc);
    });

    it('should find processor by alias', () => {
        const proc = createProcessor('test', ['t']);
        registry.registerProcessor(proc);
        expect(registry.findProcessor('t', [])).toBe(proc);
    });

    it('should return undefined for unknown command', () => {
        expect(registry.findProcessor('unknown', [])).toBeUndefined();
    });

    it('should unregister a processor', () => {
        const proc = createProcessor('test');
        registry.registerProcessor(proc);
        registry.unregisterProcessor(proc);
        expect(registry.findProcessor('test', [])).toBeUndefined();
    });

    it('should not unregister a sealed processor', () => {
        const proc = createProcessor('test');
        proc.metadata = { sealed: true };
        registry.registerProcessor(proc);
        registry.unregisterProcessor(proc);
        expect(registry.findProcessor('test', [])).toBe(proc);
    });

    it('should replace an existing processor', () => {
        const proc1 = createProcessor('test');
        const proc2 = createProcessor('test');
        proc2.description = 'Replaced';
        registry.registerProcessor(proc1);
        registry.registerProcessor(proc2);
        expect(registry.findProcessor('test', [])?.description).toBe(
            'Replaced',
        );
    });

    it('should accept initial processors', () => {
        const proc = createProcessor('init');
        registry = new CliCommandProcessorRegistry([proc]);
        expect(registry.findProcessor('init', [])).toBe(proc);
    });

    it('should find nested processors via chain commands', () => {
        const child: ICliCommandProcessor = {
            command: 'sub',
            description: 'Sub command',
            async processCommand() {},
        };
        const parent = createProcessor('parent');
        parent.processors = [child];
        registry.registerProcessor(parent);
        expect(
            registry.findProcessorInCollection(
                'parent',
                ['sub'],
                registry.processors,
            ),
        ).toBe(child);
    });

    describe('Extension / Merging', () => {
        it('should merge sub-processors into the existing processor', () => {
            const original = createProcessor('server');
            original.processors = [
                { command: 'list', description: 'List', async processCommand() {} },
            ];
            const extension = createProcessor('server');
            extension.extendsProcessor = true;
            extension.processors = [
                { command: 'logs', description: 'Logs', async processCommand() {} },
            ];

            registry.registerProcessor(original);
            registry.registerProcessor(extension);

            const found = registry.findProcessor('server', []);
            expect(found).toBe(original);
            expect(found?.processors?.length).toBe(2);
            expect(found?.processors?.find(p => p.command === 'list')).toBeDefined();
            expect(found?.processors?.find(p => p.command === 'logs')).toBeDefined();
        });

        it('should not duplicate sub-processors on repeated registration', () => {
            const original = createProcessor('server');
            original.processors = [
                { command: 'list', description: 'List', async processCommand() {} },
            ];
            const extension = createProcessor('server');
            extension.extendsProcessor = true;
            extension.processors = [
                { command: 'logs', description: 'Logs', async processCommand() {} },
            ];

            registry.registerProcessor(original);
            registry.registerProcessor(extension);
            registry.registerProcessor(extension); // re-register

            const found = registry.findProcessor('server', []);
            expect(found?.processors?.length).toBe(2);
        });

        it('should not replace existing sub-processor with same command', () => {
            const original = createProcessor('server');
            const originalList = { command: 'list', description: 'Original List', async processCommand() {} };
            original.processors = [originalList];
            const extension = createProcessor('server');
            extension.extendsProcessor = true;
            extension.processors = [
                { command: 'list', description: 'Extension List', async processCommand() {} },
            ];

            registry.registerProcessor(original);
            registry.registerProcessor(extension);

            const found = registry.findProcessor('server', []);
            const listProc = found?.processors?.find(p => p.command === 'list');
            expect(listProc).toBe(originalList);
        });

        it('should allow extending sealed processors', () => {
            const sealed = createProcessor('help');
            sealed.metadata = { sealed: true };
            sealed.processors = [];
            const extension = createProcessor('help');
            extension.extendsProcessor = true;
            extension.processors = [
                { command: 'extra', description: 'Extra', async processCommand() {} },
            ];

            registry.registerProcessor(sealed);
            registry.registerProcessor(extension);

            const found = registry.findProcessor('help', []);
            expect(found).toBe(sealed);
            expect(found?.processors?.find(p => p.command === 'extra')).toBeDefined();
        });

        it('should register normally when no existing command to extend', () => {
            const extension = createProcessor('newcmd');
            extension.extendsProcessor = true;

            registry.registerProcessor(extension);

            const found = registry.findProcessor('newcmd', []);
            expect(found).toBe(extension);
        });

        it('should initialize processors array on existing if undefined', () => {
            const original = createProcessor('server');
            // no processors array
            const extension = createProcessor('server');
            extension.extendsProcessor = true;
            extension.processors = [
                { command: 'logs', description: 'Logs', async processCommand() {} },
            ];

            registry.registerProcessor(original);
            registry.registerProcessor(extension);

            const found = registry.findProcessor('server', []);
            expect(found).toBe(original);
            expect(found?.processors?.length).toBe(1);
            expect(found?.processors?.[0].command).toBe('logs');
        });

        it('should find merged sub-processor via chain commands', () => {
            const original = createProcessor('server');
            original.processors = [
                { command: 'list', description: 'List', async processCommand() {} },
            ];
            const logsProc = { command: 'logs', description: 'Logs', async processCommand() {} };
            const extension = createProcessor('server');
            extension.extendsProcessor = true;
            extension.processors = [logsProc];

            registry.registerProcessor(original);
            registry.registerProcessor(extension);

            expect(registry.findProcessor('server', ['logs'])).toBe(logsProc);
            expect(registry.findProcessor('server', ['list'])).toBe(original.processors![0]);
        });

        it('should keep original processCommand when extending', async () => {
            const calls: string[] = [];
            const original = createProcessor('server');
            original.processCommand = async () => { calls.push('original'); };
            original.processors = [];

            const extension = createProcessor('server');
            extension.extendsProcessor = true;
            extension.processors = [
                { command: 'logs', description: 'Logs', async processCommand() { calls.push('logs'); } },
            ];

            registry.registerProcessor(original);
            registry.registerProcessor(extension);

            const found = registry.findProcessor('server', [])!;
            await found.processCommand(
                { command: 'server', rawCommand: 'server', chainCommands: [], args: {} },
                {} as any,
            );

            expect(calls).toEqual(['original']);
        });
    });
});
