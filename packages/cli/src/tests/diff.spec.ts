import { computeDiff, formatDiff } from '../lib/processors/diff-utils';
import { CliTestHarness } from '../lib/testing';
import { CliDiffCommandProcessor } from '../lib/processors';

// ---------------------------------------------------------------------------
// Pure-function tests
// ---------------------------------------------------------------------------

describe('computeDiff', () => {
    it('should return all same lines for identical inputs', () => {
        const result = computeDiff('foo\nbar\nbaz', 'foo\nbar\nbaz');
        expect(result.every((l) => l.type === 'same')).toBe(true);
        expect(result.length).toBe(3);
    });

    it('should detect an added line', () => {
        const result = computeDiff('foo\nbar', 'foo\nnew\nbar');
        expect(result.some((l) => l.type === 'add' && l.text === 'new')).toBe(true);
    });

    it('should detect a removed line', () => {
        const result = computeDiff('foo\nold\nbar', 'foo\nbar');
        expect(result.some((l) => l.type === 'remove' && l.text === 'old')).toBe(true);
    });

    it('should treat empty left as all adds', () => {
        const result = computeDiff('', 'a\nb\nc');
        expect(result.every((l) => l.type === 'add')).toBe(true);
        expect(result.length).toBe(3);
    });

    it('should treat empty right as all removes', () => {
        const result = computeDiff('a\nb\nc', '');
        expect(result.every((l) => l.type === 'remove')).toBe(true);
        expect(result.length).toBe(3);
    });

    it('should handle completely different texts', () => {
        const result = computeDiff('aaa\nbbb', 'xxx\nyyy');
        expect(result.some((l) => l.type === 'add')).toBe(true);
        expect(result.some((l) => l.type === 'remove')).toBe(true);
    });

    it('should return empty result for both empty inputs', () => {
        const result = computeDiff('', '');
        expect(result.length).toBe(0);
    });
});

describe('formatDiff', () => {
    it('should prefix added lines with +', () => {
        const lines = computeDiff('foo', 'foo\nbar');
        const formatted = formatDiff(lines, 3);
        expect(formatted.some((l) => l.includes('+ bar'))).toBe(true);
    });

    it('should prefix removed lines with -', () => {
        const lines = computeDiff('foo\nbar', 'foo');
        const formatted = formatDiff(lines, 3);
        expect(formatted.some((l) => l.includes('- bar'))).toBe(true);
    });

    it('should emit ... separator for skipped same-line sections', () => {
        // Build two texts with 20 same lines and two changes far apart
        const a = Array.from({ length: 20 }, (_, i) => `line${i}`).join('\n');
        // Change line0 and line19 so they are > 2*contextLines apart
        const b = a.replace('line0', 'changed0').replace('line19', 'changed19');
        const lines = computeDiff(a, b);
        const formatted = formatDiff(lines, 1); // tight context: only 1 line each side
        expect(formatted.some((l) => l.includes('...'))).toBe(true);
    });

    it('should return empty array for identical inputs', () => {
        const lines = computeDiff('same\ntext', 'same\ntext');
        const formatted = formatDiff(lines, 3);
        expect(formatted.length).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// CliTestHarness integration tests
// ---------------------------------------------------------------------------

describe('CliDiffCommandProcessor (harness)', () => {
    let harness: CliTestHarness;

    beforeEach(() => {
        harness = new CliTestHarness();
        harness.registerProcessor(new CliDiffCommandProcessor());
    });

    it('should write error when --b is missing', async () => {
        const result = await harness.execute('diff');
        expect(result.stderr.length).toBeGreaterThan(0);
        expect(result.stderr.some((l) => l.includes('Usage'))).toBe(true);
    });

    it('should report no differences for identical texts', async () => {
        const result = await harness.execute('diff --a=hello --b=hello');
        expect(result.stdout.some((l) => l.includes('No differences found'))).toBe(true);
    });

    it('should show + and - markers for different texts', async () => {
        const result = await harness.execute('diff --a=hello --b=world');
        const allOutput = result.stdout.join('\n');
        expect(allOutput).toContain('+');
        expect(allOutput).toContain('-');
    });
});
