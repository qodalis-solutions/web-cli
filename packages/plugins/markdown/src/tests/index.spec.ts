import { CliTestHarness, miscProcessors } from '@qodalis/cli';
import {
    CliMarkdownCommandProcessor,
    interpretEscapes,
    resolveMarkdownInput,
    splitWords,
} from '../lib/processors/cli-markdown-command-processor';

const H1 = '\x1b[1m\x1b[4m\x1b[97m';

describe('CliMarkdownCommandProcessor', () => {
    let harness: CliTestHarness;

    beforeEach(() => {
        harness = new CliTestHarness();
        const echo = miscProcessors.find((p) => p.command === 'echo');
        if (echo) {
            harness.registerProcessor(echo);
        }
        harness.registerProcessor(new CliMarkdownCommandProcessor());
    });

    it('processor instance should be created', () => {
        const processor = new CliMarkdownCommandProcessor();
        expect(processor).toBeDefined();
    });

    it('should have correct command name', () => {
        const processor = new CliMarkdownCommandProcessor();
        expect(processor.command).toBe('md');
        expect(processor.aliases).toContain('markdown');
    });

    it('renders a quoted heading without the quotes', async () => {
        const result = await harness.execute('md "# x"');
        expect(result.stderr).toEqual([]);
        expect(result.stdout[0]).toBe(`${H1}x\x1b[0m`);
        expect(result.output).not.toContain('"');
    });

    it('renders single-quoted text', async () => {
        const result = await harness.execute("md '## Title'");
        expect(result.stdout[0]).toContain('Title');
        expect(result.output).not.toContain("'");
        expect(result.output).toContain('─');
    });

    it('renders unquoted inline text', async () => {
        const result = await harness.execute('md # Hello world');
        expect(result.stdout[0]).toBe(`${H1}Hello world\x1b[0m`);
    });

    it('works through the markdown alias', async () => {
        const result = await harness.execute('markdown "**bold**"');
        expect(result.stdout[0]).toBe('\x1b[1mbold\x1b[0m');
    });

    it('accepts the render, preview and view verbs', async () => {
        for (const verb of ['render', 'preview', 'view']) {
            const result = await harness.execute(`md ${verb} "# x"`);
            expect(result.stderr).toEqual([]);
            expect(result.stdout[0]).toBe(`${H1}x\x1b[0m`);
        }
    });

    it('renders a quoted verb as text', async () => {
        const result = await harness.execute('md "render"');
        expect(result.stdout[0]).toBe('render');
    });

    it('turns \\n into new lines', async () => {
        const result = await harness.execute('md "# Title\\n- one\\n- two"');
        expect(result.stdout[0]).toContain('Title');
        expect(result.stdout.filter((l) => l.includes('•')).length).toBe(2);
    });

    it('renders piped input', async () => {
        const result = await harness.execute('echo "# Piped" | md');
        expect(result.stdout.some((l) => l === `${H1}Piped\x1b[0m`)).toBeTrue();
    });

    it('renders piped input with the render verb', async () => {
        const result = await harness.execute('echo "- item" | md render');
        expect(result.stdout.some((l) => l.includes('• item'))).toBeTrue();
    });

    it('reports an error with no input', async () => {
        const result = await harness.execute('md');
        expect(result.stderr.length).toBe(1);
        expect(result.exitCode).toBe(1);
    });
});

describe('markdown input helpers', () => {
    it('splitWords removes quotes and keeps quoted spaces', () => {
        expect(splitWords('"# a  b" c').map((w) => w.word)).toEqual(['# a  b', 'c']);
        expect(splitWords('"say \\"hi\\""')[0].word).toBe('say "hi"');
        expect(splitWords("'it''s'")[0].word).toBe('its');
    });

    it('interpretEscapes handles \\n, \\t and \\\\', () => {
        expect(interpretEscapes('a\\nb\\tc\\\\n')).toBe('a\nb\tc\\n');
    });

    it('resolveMarkdownInput prefers the value, then piped data', () => {
        expect(resolveMarkdownInput('"# x"', 'ignored')).toBe('# x');
        expect(resolveMarkdownInput('', '# piped')).toBe('# piped');
        expect(resolveMarkdownInput('render', ['a', 'b'])).toBe('a\nb');
        expect(resolveMarkdownInput(undefined, { a: 1 })).toContain('```json');
        expect(resolveMarkdownInput(undefined, undefined)).toBe('');
    });
});
