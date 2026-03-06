import {
    ICliCommandProcessor,
    ICliCommandProcessorRegistry,
    ICliCommandChildProcessor,
    ICliCommandExecutorService,
} from '@qodalis/cli-core';
import { CliCommandCompletionProvider } from '../lib/completion/cli-command-completion-provider';
import { CliParameterCompletionProvider } from '../lib/completion/cli-parameter-completion-provider';
import { CliCompletionEngine } from '../lib/completion/cli-completion-engine';
import { CliCommandProcessorRegistry } from '../lib/registry';

/** Minimal mock executor that returns no global parameters */
const createMockExecutor = (): ICliCommandExecutorService => ({
    showHelp: () => Promise.resolve(),
    executeCommand: () => Promise.resolve(),
    registerGlobalParameter: () => {},
    getGlobalParameters: () => [],
});

const createProcessor = (
    command: string,
    opts?: {
        aliases?: string[];
        parameters?: any[];
        processors?: ICliCommandProcessor[];
    },
): ICliCommandProcessor => ({
    command,
    aliases: opts?.aliases,
    description: `Test ${command}`,
    parameters: opts?.parameters,
    processors: opts?.processors,
    async processCommand() {},
});

// ---------------------------------------------------------------------------
// CliCommandCompletionProvider
// ---------------------------------------------------------------------------
describe('CliCommandCompletionProvider', () => {
    let registry: CliCommandProcessorRegistry;
    let provider: CliCommandCompletionProvider;

    beforeEach(() => {
        registry = new CliCommandProcessorRegistry();
        registry.registerProcessor(createProcessor('echo'));
        registry.registerProcessor(createProcessor('eval'));
        registry.registerProcessor(
            createProcessor('help', { aliases: ['man'] }),
        );
        registry.registerProcessor(createProcessor('hash'));
        provider = new CliCommandCompletionProvider(registry);
    });

    it('should complete top-level commands by prefix', () => {
        const result = provider.getCompletions({
            input: 'e',
            cursor: 1,
            token: 'e',
            tokenStart: 0,
            tokenIndex: 0,
            tokens: ['e'],
        });
        expect(result).toEqual(['echo', 'eval']);
    });

    it('should complete top-level commands with empty prefix', () => {
        const result = provider.getCompletions({
            input: '',
            cursor: 0,
            token: '',
            tokenStart: 0,
            tokenIndex: 0,
            tokens: [],
        });
        expect(result.length).toBe(5); // echo, eval, help, man, hash
    });

    it('should include aliases in completions', () => {
        const result = provider.getCompletions({
            input: 'm',
            cursor: 1,
            token: 'm',
            tokenStart: 0,
            tokenIndex: 0,
            tokens: ['m'],
        });
        expect(result).toContain('man');
    });

    it('should be case-insensitive', () => {
        const result = provider.getCompletions({
            input: 'H',
            cursor: 1,
            token: 'H',
            tokenStart: 0,
            tokenIndex: 0,
            tokens: ['H'],
        });
        expect(result).toContain('help');
        expect(result).toContain('hash');
    });

    it('should complete sub-commands', () => {
        const sub1 = createProcessor('apply');
        const sub2 = createProcessor('list');
        const parent = createProcessor('theme', { processors: [sub1, sub2] });
        registry.registerProcessor(parent);

        const result = provider.getCompletions({
            input: 'theme a',
            cursor: 7,
            token: 'a',
            tokenStart: 6,
            tokenIndex: 1,
            tokens: ['theme', 'a'],
        });
        expect(result).toEqual(['apply']);
    });

    it('should return empty for non-existing sub-commands', () => {
        const result = provider.getCompletions({
            input: 'echo sub',
            cursor: 8,
            token: 'sub',
            tokenStart: 5,
            tokenIndex: 1,
            tokens: ['echo', 'sub'],
        });
        expect(result).toEqual([]);
    });

    it('should return sorted results', () => {
        const result = provider.getCompletions({
            input: '',
            cursor: 0,
            token: '',
            tokenStart: 0,
            tokenIndex: 0,
            tokens: [],
        });
        const sorted = [...result].sort();
        expect(result).toEqual(sorted);
    });
});

// ---------------------------------------------------------------------------
// CliParameterCompletionProvider
// ---------------------------------------------------------------------------
describe('CliParameterCompletionProvider', () => {
    let registry: CliCommandProcessorRegistry;
    let provider: CliParameterCompletionProvider;

    beforeEach(() => {
        registry = new CliCommandProcessorRegistry();
        registry.registerProcessor(
            createProcessor('curl', {
                parameters: [
                    {
                        name: 'method',
                        aliases: ['X'],
                        description: 'HTTP method',
                        type: 'string',
                        required: false,
                    },
                    {
                        name: 'header',
                        aliases: ['H'],
                        description: 'HTTP header',
                        type: 'string',
                        required: false,
                    },
                    {
                        name: 'output',
                        description: 'Output file',
                        type: 'string',
                        required: false,
                    },
                ],
            }),
        );
        provider = new CliParameterCompletionProvider(registry, createMockExecutor());
    });

    it('should complete long parameter names with --', () => {
        const result = provider.getCompletions({
            input: 'curl --m',
            cursor: 8,
            token: '--m',
            tokenStart: 5,
            tokenIndex: 1,
            tokens: ['curl', '--m'],
        });
        expect(result).toContain('--method');
    });

    it('should complete short aliases with -', () => {
        const result = provider.getCompletions({
            input: 'curl -X',
            cursor: 7,
            token: '-X',
            tokenStart: 5,
            tokenIndex: 1,
            tokens: ['curl', '-X'],
        });
        expect(result).toContain('-X');
    });

    it('should return all matching parameters for empty prefix', () => {
        const result = provider.getCompletions({
            input: 'curl --',
            cursor: 7,
            token: '--',
            tokenStart: 5,
            tokenIndex: 1,
            tokens: ['curl', '--'],
        });
        expect(result).toContain('--method');
        expect(result).toContain('--header');
        expect(result).toContain('--output');
    });

    it('should not complete tokens that do not start with -', () => {
        const result = provider.getCompletions({
            input: 'curl hello',
            cursor: 10,
            token: 'hello',
            tokenStart: 5,
            tokenIndex: 1,
            tokens: ['curl', 'hello'],
        });
        expect(result).toEqual([]);
    });

    it('should return empty for unknown command', () => {
        const result = provider.getCompletions({
            input: 'unknown --f',
            cursor: 11,
            token: '--f',
            tokenStart: 8,
            tokenIndex: 1,
            tokens: ['unknown', '--f'],
        });
        expect(result).toEqual([]);
    });

    it('should return empty when no tokens', () => {
        const result = provider.getCompletions({
            input: '',
            cursor: 0,
            token: '-',
            tokenStart: 0,
            tokenIndex: 0,
            tokens: [],
        });
        expect(result).toEqual([]);
    });

    it('should be case-insensitive', () => {
        const result = provider.getCompletions({
            input: 'curl --M',
            cursor: 8,
            token: '--M',
            tokenStart: 5,
            tokenIndex: 1,
            tokens: ['curl', '--M'],
        });
        expect(result).toContain('--method');
    });

    it('should return sorted results', () => {
        const result = provider.getCompletions({
            input: 'curl --',
            cursor: 7,
            token: '--',
            tokenStart: 5,
            tokenIndex: 1,
            tokens: ['curl', '--'],
        });
        const sorted = [...result].sort();
        expect(result).toEqual(sorted);
    });
});

// ---------------------------------------------------------------------------
// CliCompletionEngine
// ---------------------------------------------------------------------------
describe('CliCompletionEngine', () => {
    let engine: CliCompletionEngine;
    let registry: CliCommandProcessorRegistry;

    beforeEach(() => {
        engine = new CliCompletionEngine();
        registry = new CliCommandProcessorRegistry();
        registry.registerProcessor(createProcessor('echo'));
        registry.registerProcessor(createProcessor('eval'));
        registry.registerProcessor(
            createProcessor('help', { aliases: ['man'] }),
        );

        const cmdProvider = new CliCommandCompletionProvider(registry);
        const paramProvider = new CliParameterCompletionProvider(registry, createMockExecutor());
        engine.setProviders([paramProvider, cmdProvider]); // Different order to test sorting
    });

    it('should complete single match fully', async () => {
        const result = await engine.complete('hel', 3);
        expect(result.action).toBe('complete');
        expect(result.replacement).toBe('help');
    });

    it('should complete common prefix for multiple matches', async () => {
        const result = await engine.complete('e', 1);
        // echo and eval share prefix "e" but common prefix beyond "e" is "e" (echo vs eval)
        // Since common prefix length equals token length, action is 'none' on first tab
        expect(result.action).toBe('none');
    });

    it('should show candidates on second tab', async () => {
        await engine.complete('e', 1); // First tab
        const result = await engine.complete('e', 1); // Second tab
        expect(result.action).toBe('show-candidates');
        expect(result.candidates).toContain('echo');
        expect(result.candidates).toContain('eval');
    });

    it('should return none when no matches', async () => {
        const result = await engine.complete('xyz', 3);
        expect(result.action).toBe('none');
    });

    it('should reset state on resetState()', async () => {
        await engine.complete('e', 1); // First tab
        engine.resetState();
        // After reset, next call is first tab again, not second
        const result = await engine.complete('e', 1);
        // First tab with multiple matches and no extendable prefix -> none
        expect(result.action).toBe('none');
    });

    it('should reset tab count when input changes', async () => {
        await engine.complete('e', 1); // First tab on 'e'
        const result = await engine.complete('h', 1); // Different input
        // 'h' matches 'help' — single match
        expect(result.action).toBe('complete');
        expect(result.replacement).toBe('help');
    });

    it('should add provider dynamically', async () => {
        const customProvider = {
            priority: 50,
            getCompletions: () => ['custom-completion'],
        };
        engine.addProvider(customProvider);

        const result = await engine.complete('anything', 8);
        expect(result.action).toBe('complete');
        expect(result.replacement).toBe('custom-completion');
    });

    it('should query providers in priority order', async () => {
        const highPriority = {
            priority: 1,
            getCompletions: () => ['high'],
        };
        const lowPriority = {
            priority: 999,
            getCompletions: () => ['low'],
        };
        engine.setProviders([lowPriority, highPriority]);

        const result = await engine.complete('x', 1);
        expect(result.replacement).toBe('high');
    });
});

import { CliThemeNameCompletionProvider } from '../lib/completion/cli-theme-name-completion-provider';

// ---------------------------------------------------------------------------
// CliThemeNameCompletionProvider
// ---------------------------------------------------------------------------
describe('CliThemeNameCompletionProvider', () => {
    let provider: CliThemeNameCompletionProvider;

    beforeEach(() => {
        provider = new CliThemeNameCompletionProvider();
    });

    it('should complete theme names for "theme apply"', () => {
        const result = provider.getCompletions({
            input: 'theme apply d',
            cursor: 13,
            token: 'd',
            tokenStart: 12,
            tokenIndex: 2,
            tokens: ['theme', 'apply', 'd'],
        });
        expect(result).toContain('dracula');
    });

    it('should complete theme names for "theme preview"', () => {
        const result = provider.getCompletions({
            input: 'theme preview n',
            cursor: 15,
            token: 'n',
            tokenStart: 14,
            tokenIndex: 2,
            tokens: ['theme', 'preview', 'n'],
        });
        expect(result).toContain('nord');
    });

    it('should complete dark/light for "theme random"', () => {
        const result = provider.getCompletions({
            input: 'theme random d',
            cursor: 14,
            token: 'd',
            tokenStart: 13,
            tokenIndex: 2,
            tokens: ['theme', 'random', 'd'],
        });
        expect(result).toEqual(['dark']);
    });

    it('should complete tags for "theme search"', () => {
        const result = provider.getCompletions({
            input: 'theme search r',
            cursor: 14,
            token: 'r',
            tokenStart: 13,
            tokenIndex: 2,
            tokens: ['theme', 'search', 'r'],
        });
        expect(result).toContain('retro');
    });

    it('should return empty for non-theme commands', () => {
        const result = provider.getCompletions({
            input: 'echo test d',
            cursor: 11,
            token: 'd',
            tokenStart: 10,
            tokenIndex: 2,
            tokens: ['echo', 'test', 'd'],
        });
        expect(result).toEqual([]);
    });

    it('should include new themes like tokyoNight', () => {
        const result = provider.getCompletions({
            input: 'theme apply tokyo',
            cursor: 17,
            token: 'tokyo',
            tokenStart: 12,
            tokenIndex: 2,
            tokens: ['theme', 'apply', 'tokyo'],
        });
        expect(result).toContain('tokyoNight');
    });

    it('should work with "themes" alias', () => {
        const result = provider.getCompletions({
            input: 'themes apply d',
            cursor: 14,
            token: 'd',
            tokenStart: 13,
            tokenIndex: 2,
            tokens: ['themes', 'apply', 'd'],
        });
        expect(result).toContain('dracula');
    });

    it('should return empty for wrong token index', () => {
        const result = provider.getCompletions({
            input: 'theme',
            cursor: 5,
            token: 'theme',
            tokenStart: 0,
            tokenIndex: 0,
            tokens: ['theme'],
        });
        expect(result).toEqual([]);
    });
});
