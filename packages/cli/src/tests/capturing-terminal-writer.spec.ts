import {
    ICliTerminalWriter,
    CliForegroundColor,
    CliBackgroundColor,
} from '@qodalis/cli-core';
import { CapturingTerminalWriter } from '../lib/services/capturing-terminal-writer';

/**
 * Minimal stub implementing ICliTerminalWriter for testing.
 */
function createStubWriter(): ICliTerminalWriter & { written: string[] } {
    const written: string[] = [];
    return {
        written,
        write(text: string) {
            written.push(text);
        },
        writeln(text?: string) {
            written.push(text ?? '');
        },
        writeSuccess(msg: string) {
            written.push(`[success] ${msg}`);
        },
        writeInfo(msg: string) {
            written.push(`[info] ${msg}`);
        },
        writeWarning(msg: string) {
            written.push(`[warn] ${msg}`);
        },
        writeError(msg: string) {
            written.push(`[error] ${msg}`);
        },
        wrapInColor(text: string, _color: CliForegroundColor) {
            return text;
        },
        wrapInBackgroundColor(text: string, _color: CliBackgroundColor) {
            return text;
        },
        writeJson(json: any) {
            written.push(JSON.stringify(json));
        },
        writeToFile(_fn: string, _content: string) {},
        writeObjectsAsTable(objects: any[]) {
            written.push(JSON.stringify(objects));
        },
        writeTable(_h: string[], _r: string[][]) {},
        writeDivider() {},
        writeList(_items: string[], _options?: any) {},
        writeKeyValue(_entries: any, _options?: any) {},
        writeColumns(_items: string[], _options?: any) {},
    };
}

// ---------------------------------------------------------------------------
// CapturingTerminalWriter
// ---------------------------------------------------------------------------
describe('CapturingTerminalWriter', () => {
    it('should delegate write() to inner writer', () => {
        const inner = createStubWriter();
        const cw = new CapturingTerminalWriter(inner);
        cw.write('hello');
        expect(inner.written).toContain('hello');
    });

    it('should delegate writeln() to inner writer', () => {
        const inner = createStubWriter();
        const cw = new CapturingTerminalWriter(inner);
        cw.writeln('line');
        expect(inner.written).toContain('line');
    });

    it('should capture text from write()', () => {
        const inner = createStubWriter();
        const cw = new CapturingTerminalWriter(inner);
        cw.write('hello');
        expect(cw.hasOutput()).toBeTrue();
        expect(cw.getCapturedData()).toBe('hello');
    });

    it('should capture text from writeln()', () => {
        const inner = createStubWriter();
        const cw = new CapturingTerminalWriter(inner);
        cw.writeln('line1');
        cw.writeln('line2');
        expect(cw.getCapturedData()).toBe('line1\nline2');
    });

    it('should strip ANSI escape codes from captured text', () => {
        const inner = createStubWriter();
        const cw = new CapturingTerminalWriter(inner);
        cw.writeln('\x1b[32mgreen text\x1b[0m');
        expect(cw.getCapturedData()).toBe('green text');
    });

    it('should NOT capture writeError output', () => {
        const inner = createStubWriter();
        const cw = new CapturingTerminalWriter(inner);
        cw.writeError('bad thing');
        expect(cw.hasOutput()).toBeFalse();
    });

    it('should NOT capture writeWarning output', () => {
        const inner = createStubWriter();
        const cw = new CapturingTerminalWriter(inner);
        cw.writeWarning('watch out');
        expect(cw.hasOutput()).toBeFalse();
    });

    it('should NOT capture writeInfo output', () => {
        const inner = createStubWriter();
        const cw = new CapturingTerminalWriter(inner);
        cw.writeInfo('some info');
        expect(cw.hasOutput()).toBeFalse();
    });

    it('should NOT capture writeSuccess output', () => {
        const inner = createStubWriter();
        const cw = new CapturingTerminalWriter(inner);
        cw.writeSuccess('done');
        expect(cw.hasOutput()).toBeFalse();
    });

    it('should capture structured data from writeJson()', () => {
        const inner = createStubWriter();
        const cw = new CapturingTerminalWriter(inner);
        cw.writeJson({ key: 'value' });
        expect(cw.getCapturedData()).toEqual({ key: 'value' });
    });

    it('should prefer JSON data over text when both present', () => {
        const inner = createStubWriter();
        const cw = new CapturingTerminalWriter(inner);
        cw.writeln('some text');
        cw.writeJson({ key: 'value' });
        // JSON takes priority
        expect(cw.getCapturedData()).toEqual({ key: 'value' });
    });

    it('should capture array from writeObjectsAsTable()', () => {
        const inner = createStubWriter();
        const cw = new CapturingTerminalWriter(inner);
        const objects = [{ a: 1 }, { a: 2 }];
        cw.writeObjectsAsTable(objects);
        expect(cw.getCapturedData()).toEqual(objects);
    });

    it('should return undefined when nothing captured', () => {
        const inner = createStubWriter();
        const cw = new CapturingTerminalWriter(inner);
        expect(cw.hasOutput()).toBeFalse();
        expect(cw.getCapturedData()).toBeUndefined();
    });

    it('should handle writeln with empty string (no capture)', () => {
        const inner = createStubWriter();
        const cw = new CapturingTerminalWriter(inner);
        cw.writeln('');
        // Empty text should not produce output
        expect(cw.hasOutput()).toBeFalse();
    });

    it('should handle writeln with undefined (no capture)', () => {
        const inner = createStubWriter();
        const cw = new CapturingTerminalWriter(inner);
        cw.writeln(undefined);
        expect(cw.hasOutput()).toBeFalse();
    });

    it('should trim captured text output', () => {
        const inner = createStubWriter();
        const cw = new CapturingTerminalWriter(inner);
        cw.writeln('  hello  ');
        expect(cw.getCapturedData()).toBe('hello');
    });

    it('should normalize \\r\\n to \\n in captured text', () => {
        const inner = createStubWriter();
        const cw = new CapturingTerminalWriter(inner);
        cw.write('line1\r\nline2');
        expect(cw.getCapturedData()).toBe('line1\nline2');
    });

    it('should return array of JSON when multiple writeJson calls', () => {
        const inner = createStubWriter();
        const cw = new CapturingTerminalWriter(inner);
        cw.writeJson({ a: 1 });
        cw.writeJson({ b: 2 });
        expect(cw.getCapturedData()).toEqual([{ a: 1 }, { b: 2 }]);
    });

    it('should delegate wrapInColor to inner', () => {
        const inner = createStubWriter();
        const cw = new CapturingTerminalWriter(inner);
        const result = cw.wrapInColor('text', CliForegroundColor.Red);
        expect(result).toBe('text'); // stub just returns text
    });

    it('should delegate writeToFile to inner', () => {
        const inner = createStubWriter();
        const cw = new CapturingTerminalWriter(inner);
        // Should not throw
        cw.writeToFile('file.txt', 'content');
    });

    it('should delegate writeDivider to inner', () => {
        const inner = createStubWriter();
        const cw = new CapturingTerminalWriter(inner);
        // Should not throw
        cw.writeDivider();
    });
});
