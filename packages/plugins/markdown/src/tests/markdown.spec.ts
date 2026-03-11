import { renderMarkdown } from '../lib/markdown-renderer';

describe('renderMarkdown', () => {
    it('returns empty array for empty input', () => {
        expect(renderMarkdown('')).toEqual([]);
        expect(renderMarkdown('   ')).toEqual([]);
    });

    it('renders h1 with bold underline and ANSI codes', () => {
        const lines = renderMarkdown('# Hello World');
        expect(lines.some((l) => l.includes('Hello World'))).toBeTrue();
        expect(lines.some((l) => l.includes('\x1b['))).toBeTrue();
    });

    it('renders h2 differently from h1', () => {
        const h1 = renderMarkdown('# H1').join('');
        const h2 = renderMarkdown('## H2').join('');
        expect(h1).not.toBe(h2);
    });

    it('renders h3', () => {
        const lines = renderMarkdown('### Title');
        expect(lines[0]).toContain('Title');
        expect(lines[0]).toContain('\x1b[');
    });

    it('renders bold text with \\x1b[1m', () => {
        const lines = renderMarkdown('This is **bold** text');
        expect(lines[0]).toContain('\x1b[1m');
        expect(lines[0]).toContain('bold');
    });

    it('renders italic text with \\x1b[3m', () => {
        const lines = renderMarkdown('This is *italic* text');
        expect(lines[0]).toContain('\x1b[3m');
    });

    it('renders inline code', () => {
        const lines = renderMarkdown('Run `ls -la` now');
        expect(lines[0]).toContain('ls -la');
    });

    it('renders unordered list with bullet character', () => {
        const lines = renderMarkdown('- Item 1\n- Item 2');
        expect(lines.some((l) => l.includes('\u2022'))).toBeTrue();
    });

    it('renders ordered list', () => {
        const lines = renderMarkdown('1. First\n2. Second');
        expect(lines.some((l) => l.includes('1.'))).toBeTrue();
    });

    it('renders horizontal rule with \\u2500', () => {
        const lines = renderMarkdown('---');
        expect(lines.some((l) => l.includes('\u2500'))).toBeTrue();
    });

    it('renders code blocks', () => {
        const lines = renderMarkdown('```\necho hello\n```');
        expect(lines.some((l) => l.includes('echo hello'))).toBeTrue();
    });

    it('renders blockquotes', () => {
        const lines = renderMarkdown('> This is a quote');
        expect(lines.some((l) => l.includes('\u2502'))).toBeTrue();
    });

    it('renders links', () => {
        const lines = renderMarkdown('[click here](https://example.com)');
        expect(lines[0]).toContain('click here');
        expect(lines[0]).toContain('example.com');
    });

    it('renders empty lines as empty strings', () => {
        const lines = renderMarkdown('# Title\n\nParagraph');
        expect(lines.some((l) => l === '')).toBeTrue();
    });
});
