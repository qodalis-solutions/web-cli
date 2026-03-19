import { JsFallbackAccelerator } from '../lib/wasm';
import { SyntaxHighlighterRegistry } from '../lib/editor/syntax/registry';
import { SyntaxHighlightEngine } from '../lib/editor/syntax/engine';
import { defaultSyntaxTheme } from '../lib/editor/syntax/theme';
import { truncateAnsi, parseTokens } from '../lib/editor/syntax/utils';
import { JsonHighlighter } from '../lib/editor/syntax/highlighters/json-highlighter';
import { HtmlHighlighter } from '../lib/editor/syntax/highlighters/html-highlighter';
import { MarkdownHighlighter } from '../lib/editor/syntax/highlighters/markdown-highlighter';
import { YamlHighlighter } from '../lib/editor/syntax/highlighters/yaml-highlighter';
import { ISyntaxHighlighter, ISyntaxHighlightRule, LineState } from '@qodalis/cli-core';

// ── Utils ─────────────────────────────────────────────────────────────

describe('truncateAnsi', () => {
    it('should truncate plain text to maxCols', () => {
        expect(truncateAnsi('hello world', 5)).toBe('hello');
    });

    it('should return full text when under limit', () => {
        expect(truncateAnsi('hi', 10)).toBe('hi');
    });

    it('should preserve ANSI escape sequences without counting them', () => {
        const colored = '\x1b[32mhello\x1b[0m world';
        const result = truncateAnsi(colored, 5);
        expect(result).toBe('\x1b[32mhello\x1b[0m');
    });

    it('should append reset when truncated mid-color', () => {
        const colored = '\x1b[32mhello world\x1b[0m';
        const result = truncateAnsi(colored, 5);
        expect(result).toBe('\x1b[32mhello\x1b[0m');
    });

    it('should not double-reset when already reset at boundary', () => {
        const colored = '\x1b[32mhi\x1b[0m there';
        // "hi there" = 8 visible chars, exactly at limit — no truncation
        const result = truncateAnsi(colored, 8);
        expect(result).toBe('\x1b[32mhi\x1b[0m there');
    });

    it('should handle empty string', () => {
        expect(truncateAnsi('', 10)).toBe('');
    });

    it('should handle maxCols of 0', () => {
        expect(truncateAnsi('hello', 0)).toBe('');
    });

    it('should handle multiple ANSI sequences', () => {
        const multi = '\x1b[31mred\x1b[0m \x1b[32mgreen\x1b[0m';
        // visible: "red green" = 9 chars, truncate to 6: "red gr"
        const result = truncateAnsi(multi, 6);
        expect(result).toBe('\x1b[31mred\x1b[0m \x1b[32mgr\x1b[0m');
    });
});

describe('parseTokens', () => {
    it('should parse comma-separated token entries', () => {
        const raw = '0,5,keyword\n6,11,string';
        expect(parseTokens(raw)).toEqual([
            { start: 0, end: 5, tokenType: 'keyword' },
            { start: 6, end: 11, tokenType: 'string' },
        ]);
    });

    it('should return empty array for empty string', () => {
        expect(parseTokens('')).toEqual([]);
    });

    it('should handle single token', () => {
        expect(parseTokens('2,8,comment')).toEqual([
            { start: 2, end: 8, tokenType: 'comment' },
        ]);
    });

    it('should handle tokenType with commas (future-safe)', () => {
        expect(parseTokens('0,5,token,extra')).toEqual([
            { start: 0, end: 5, tokenType: 'token,extra' },
        ]);
    });
});

// ── Registry ──────────────────────────────────────────────────────────

describe('SyntaxHighlighterRegistry', () => {
    let registry: SyntaxHighlighterRegistry;

    beforeEach(() => {
        registry = new SyntaxHighlighterRegistry();
    });

    it('should register and retrieve by extension', () => {
        const h = new JsonHighlighter();
        registry.register(h);
        expect(registry.getByExtension('.json')).toBe(h);
        expect(registry.getByExtension('.jsonc')).toBe(h);
    });

    it('should return null for unknown extension', () => {
        expect(registry.getByExtension('.unknown')).toBeNull();
    });

    it('should list registered languages', () => {
        registry.register(new JsonHighlighter());
        registry.register(new HtmlHighlighter());
        expect(registry.getRegisteredLanguages().sort()).toEqual(['html', 'json']);
    });

    it('should unregister and remove extensions', () => {
        registry.register(new JsonHighlighter());
        registry.unregister('json');
        expect(registry.getByExtension('.json')).toBeNull();
        expect(registry.getRegisteredLanguages()).toEqual([]);
    });

    it('should handle unregister of non-existent id', () => {
        expect(() => registry.unregister('nonexistent')).not.toThrow();
    });

    it('should allow overwriting existing registration', () => {
        const h1 = new JsonHighlighter();
        const h2 = new JsonHighlighter();
        registry.register(h1);
        registry.register(h2);
        expect(registry.getByExtension('.json')).toBe(h2);
    });
});

// ── Highlighter rules ─────────────────────────────────────────────────

describe('JsonHighlighter', () => {
    const highlighter = new JsonHighlighter();

    it('should have correct id and extensions', () => {
        expect(highlighter.id).toBe('json');
        expect(highlighter.extensions).toContain('.json');
        expect(highlighter.extensions).toContain('.jsonc');
    });

    it('should return normal rules for state 0', () => {
        const rules = highlighter.getRules(0);
        const types = rules.map(r => r.tokenType);
        expect(types).toContain('comment');
        expect(types).toContain('string');
        expect(types).toContain('number');
        expect(types).toContain('keyword');
        expect(types).toContain('punctuation');
    });

    it('should return comment rules for state 1', () => {
        const rules = highlighter.getRules(1);
        expect(rules.every(r => r.tokenType === 'comment')).toBeTrue();
    });

    it('should transition to state 1 when block comment opens', () => {
        expect(highlighter.getNextLineState('/* start comment', 0)).toBe(1);
    });

    it('should stay in state 1 while comment open', () => {
        expect(highlighter.getNextLineState('still in comment', 1)).toBe(1);
    });

    it('should transition back to 0 when comment closes', () => {
        expect(highlighter.getNextLineState('end comment */', 1)).toBe(0);
    });

    it('should remain in state 0 for normal lines', () => {
        expect(highlighter.getNextLineState('"key": "value"', 0)).toBe(0);
    });

    it('should not treat /* inside strings as block comment', () => {
        expect(highlighter.getNextLineState('"has /* slash star"', 0)).toBe(0);
    });
});

describe('HtmlHighlighter', () => {
    const highlighter = new HtmlHighlighter();

    it('should have correct extensions', () => {
        expect(highlighter.extensions).toContain('.html');
        expect(highlighter.extensions).toContain('.xml');
        expect(highlighter.extensions).toContain('.svg');
    });

    it('should use captureGroup for tag names', () => {
        const rules = highlighter.getRules(0);
        const tagRule = rules.find(r => r.tokenType === 'tag');
        expect(tagRule?.captureGroup).toBe(2);
    });

    it('should use captureGroup for attribute names', () => {
        const rules = highlighter.getRules(0);
        const attrRule = rules.find(r => r.tokenType === 'attribute');
        expect(attrRule?.captureGroup).toBe(1);
    });

    it('should transition to state 1 for unclosed comment', () => {
        expect(highlighter.getNextLineState('<!-- open', 0)).toBe(1);
    });

    it('should stay in state 0 for closed comment', () => {
        expect(highlighter.getNextLineState('<!-- closed -->', 0)).toBe(0);
    });

    it('should exit comment state on close', () => {
        expect(highlighter.getNextLineState('end -->', 1)).toBe(0);
    });
});

describe('MarkdownHighlighter', () => {
    const highlighter = new MarkdownHighlighter();

    it('should have correct extensions', () => {
        expect(highlighter.extensions).toContain('.md');
        expect(highlighter.extensions).toContain('.mdx');
    });

    it('should enter code block state on opening fence', () => {
        expect(highlighter.getNextLineState('```javascript', 0)).toBe(1);
    });

    it('should exit code block state on closing fence', () => {
        expect(highlighter.getNextLineState('```', 1)).toBe(0);
    });

    it('should keep code block state inside block', () => {
        expect(highlighter.getNextLineState('const x = 1;', 1)).toBe(1);
    });

    it('should have bold rules before italic', () => {
        const rules = highlighter.getRules(0);
        const types = rules.map(r => r.tokenType);
        const boldIdx = types.indexOf('bold');
        const italicIdx = types.indexOf('italic');
        expect(boldIdx).toBeLessThan(italicIdx);
    });
});

describe('YamlHighlighter', () => {
    const highlighter = new YamlHighlighter();

    it('should have correct extensions', () => {
        expect(highlighter.extensions).toContain('.yaml');
        expect(highlighter.extensions).toContain('.yml');
    });

    it('should use captureGroup for key names', () => {
        const rules = highlighter.getRules();
        const keyRule = rules.find(r => r.tokenType === 'tag' && r.captureGroup === 1);
        expect(keyRule).toBeDefined();
    });

    it('should always return state 0', () => {
        expect(highlighter.getNextLineState()).toBe(0);
    });
});

// ── Tokenizer (JS Fallback) ──────────────────────────────────────────

describe('JsFallbackAccelerator tokenizer', () => {
    let accel: JsFallbackAccelerator;

    beforeEach(() => {
        accel = new JsFallbackAccelerator();
    });

    it('should register and tokenize using rules', () => {
        const rules = '\\d+\tnumber\t0\n[a-z]+\tkeyword\t0';
        accel.registerRuleSet('test:0', rules);
        const result = accel.tokenizeLine('hello 42 world', 'test:0');
        const tokens = parseTokens(result);
        expect(tokens.length).toBeGreaterThanOrEqual(2);
        expect(tokens.some(t => t.tokenType === 'number')).toBeTrue();
        expect(tokens.some(t => t.tokenType === 'keyword')).toBeTrue();
    });

    it('should return empty string for unknown rule set', () => {
        expect(accel.tokenizeLine('hello', 'unknown:0')).toBe('');
    });

    it('should return empty string for empty line', () => {
        accel.registerRuleSet('test:0', '\\d+\tnumber\t0');
        expect(accel.tokenizeLine('', 'test:0')).toBe('');
    });

    it('should handle captureGroup', () => {
        // Pattern matches (key)(:) but only highlights group 1
        const rules = '([a-z]+)(:)\ttag\t1';
        accel.registerRuleSet('test:0', rules);
        const result = accel.tokenizeLine('name:', 'test:0');
        const tokens = parseTokens(result);
        expect(tokens.length).toBe(1);
        expect(tokens[0]).toEqual({ start: 0, end: 4, tokenType: 'tag' });
    });

    it('should skip invalid regex gracefully', () => {
        const rules = '[invalid\tbad\t0\n\\d+\tnumber\t0';
        accel.registerRuleSet('test:0', rules);
        const result = accel.tokenizeLine('42', 'test:0');
        const tokens = parseTokens(result);
        expect(tokens.length).toBe(1);
        expect(tokens[0].tokenType).toBe('number');
    });

    it('should tokenize JSON-like content', () => {
        const jsonHighlighter = new JsonHighlighter();
        const rules = jsonHighlighter.getRules(0);
        const serialized = rules.map(r =>
            `${r.pattern.source}\t${r.tokenType}\t${r.captureGroup ?? 0}`
        ).join('\n');
        accel.registerRuleSet('json:0', serialized);

        const result = accel.tokenizeLine('{"key": "value", "num": 42}', 'json:0');
        const tokens = parseTokens(result);

        const tokenTypes = tokens.map(t => t.tokenType);
        expect(tokenTypes).toContain('punctuation');
        expect(tokenTypes).toContain('string');
        expect(tokenTypes).toContain('number');
    });

    it('should tokenize HTML-like content with captureGroups', () => {
        const htmlHighlighter = new HtmlHighlighter();
        const rules = htmlHighlighter.getRules(0);
        const serialized = rules.map(r =>
            `${r.pattern.source}\t${r.tokenType}\t${r.captureGroup ?? 0}`
        ).join('\n');
        accel.registerRuleSet('html:0', serialized);

        const result = accel.tokenizeLine('<div class="foo">', 'html:0');
        const tokens = parseTokens(result);

        expect(tokens.some(t => t.tokenType === 'tag')).toBeTrue();
        expect(tokens.some(t => t.tokenType === 'value')).toBeTrue();
    });
});

// ── SyntaxHighlightEngine ─────────────────────────────────────────────

describe('SyntaxHighlightEngine', () => {
    let engine: SyntaxHighlightEngine;
    let accel: JsFallbackAccelerator;

    beforeEach(() => {
        accel = new JsFallbackAccelerator();
        engine = new SyntaxHighlightEngine(
            new JsonHighlighter(),
            defaultSyntaxTheme,
            accel,
        );
    });

    it('should render a JSON line with ANSI colors', () => {
        const result = engine.renderLine(0, '{"key": true}', 80);
        // Should contain ANSI escape codes
        expect(result).toContain('\x1b[');
        // Should contain the visible text
        expect(result.replace(/\x1b\[[^m]*m/g, '')).toContain('"key"');
    });

    it('should return plain text on error', () => {
        const badAccel = {
            registerRuleSet() { throw new Error('boom'); },
            tokenizeLine() { return ''; },
            textSearch() { return [0, 0] as [number, number]; },
            textReplaceAll() { return { count: 0, text: '' }; },
            prefixMatch() { return []; },
            commonPrefix() { return ''; },
        };
        const badEngine = new SyntaxHighlightEngine(
            new JsonHighlighter(),
            defaultSyntaxTheme,
            badAccel,
        );
        expect(badEngine.renderLine(0, 'hello', 80)).toBe('hello');
    });

    it('should use cache on second call with same content', () => {
        const line = '"hello"';
        const result1 = engine.renderLine(0, line, 80);
        const result2 = engine.renderLine(0, line, 80);
        expect(result1).toBe(result2);
    });

    it('should invalidate cache and re-render', () => {
        engine.renderLine(0, '"hello"', 80);
        engine.renderLine(1, '"world"', 80);
        engine.invalidate(1);
        // Line 0 should still be cached (not invalidated)
        // Line 1 will be re-computed
        const result = engine.renderLine(1, '"changed"', 80);
        expect(result).toContain('\x1b[');
    });

    it('should handle multi-line block comments with state transitions', () => {
        const line0 = '/* start';
        const line1 = 'middle';
        const line2 = 'end */';

        engine.renderLine(0, line0, 80);
        const result1 = engine.renderLine(1, line1, 80);
        engine.renderLine(2, line2, 80);

        // Line 1 should be fully rendered as comment (state 1)
        const strippedResult1 = result1.replace(/\x1b\[[^m]*m/g, '');
        expect(strippedResult1).toContain('middle');
    });

    it('should truncate long lines', () => {
        const longJson = '{"key": "a very long value string that exceeds column limit"}';
        const result = engine.renderLine(0, longJson, 20);
        // Strip ANSI to count visible chars
        const visible = result.replace(/\x1b\[[^m]*m/g, '');
        expect(visible.length).toBeLessThanOrEqual(20);
    });

    it('should render with Markdown highlighter', () => {
        const mdEngine = new SyntaxHighlightEngine(
            new MarkdownHighlighter(),
            defaultSyntaxTheme,
            accel,
        );
        const result = mdEngine.renderLine(0, '# Hello World', 80);
        expect(result).toContain('\x1b[');
    });

    it('should render with YAML highlighter', () => {
        const yamlEngine = new SyntaxHighlightEngine(
            new YamlHighlighter(),
            defaultSyntaxTheme,
            accel,
        );
        const result = yamlEngine.renderLine(0, 'name: value', 80);
        expect(result).toContain('\x1b[');
    });

    it('should render with HTML highlighter', () => {
        const htmlEngine = new SyntaxHighlightEngine(
            new HtmlHighlighter(),
            defaultSyntaxTheme,
            accel,
        );
        const result = htmlEngine.renderLine(0, '<div class="test">', 80);
        expect(result).toContain('\x1b[');
    });
});
