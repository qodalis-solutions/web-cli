import { CliTerminalWriter } from '../lib/services/cli-terminal-writer';
import { CliForegroundColor } from '@qodalis/cli-core';

class MockTerminal {
    written: string[] = [];

    write(data: string): void {
        this.written.push(data);
    }

    writeln(data: string): void {
        this.written.push(data + '\n');
    }

    get cols(): number {
        return 80;
    }
}

describe('CliTerminalWriter', () => {
    let terminal: MockTerminal;
    let writer: CliTerminalWriter;

    beforeEach(() => {
        terminal = new MockTerminal();
        writer = new CliTerminalWriter(terminal as any);
    });

    describe('writeList', () => {
        it('should write bullet list with bullet prefix by default', () => {
            writer.writeList(['alpha', 'beta', 'gamma']);

            expect(terminal.written.length).toBe(3);
            expect(terminal.written[0]).toContain('\u2022');
            expect(terminal.written[0]).toContain('alpha');
            expect(terminal.written[1]).toContain('beta');
            expect(terminal.written[2]).toContain('gamma');
        });

        it('should write ordered list with numbers', () => {
            writer.writeList(['first', 'second', 'third'], { ordered: true });

            expect(terminal.written[0]).toContain('1.');
            expect(terminal.written[0]).toContain('first');
            expect(terminal.written[1]).toContain('2.');
            expect(terminal.written[2]).toContain('3.');
        });

        it('should write with custom prefix', () => {
            writer.writeList(['one', 'two'], { prefix: '->' });

            expect(terminal.written[0]).toContain('->');
            expect(terminal.written[0]).toContain('one');
        });

        it('should apply color when specified', () => {
            writer.writeList(['item'], { color: CliForegroundColor.Green });

            const text = terminal.written[0];
            expect(text).toContain(CliForegroundColor.Green);
            expect(text).toContain(CliForegroundColor.Reset);
        });
    });

    describe('writeKeyValue', () => {
        it('should write aligned key-value pairs from Record', () => {
            writer.writeKeyValue({ Name: 'Alice', Age: '30' });

            expect(terminal.written.length).toBe(2);
            const allText = terminal.written.join('');
            expect(allText).toContain('Name');
            expect(allText).toContain('Alice');
            expect(allText).toContain('Age');
            expect(allText).toContain('30');
        });

        it('should accept array-of-tuples input', () => {
            writer.writeKeyValue([
                ['Key1', 'Value1'],
                ['LongerKey', 'Value2'],
            ]);

            const allText = terminal.written.join('');
            expect(allText).toContain('Key1');
            expect(allText).toContain('Value1');
            expect(allText).toContain('LongerKey');
            expect(allText).toContain('Value2');
        });

        it('should use custom separator and key color', () => {
            writer.writeKeyValue(
                { Host: 'localhost' },
                { separator: '=', keyColor: CliForegroundColor.Cyan },
            );

            const text = terminal.written[0];
            expect(text).toContain('=');
            expect(text).toContain(CliForegroundColor.Cyan);
        });
    });

    describe('writeColumns', () => {
        it('should arrange items in specified number of columns', () => {
            writer.writeColumns(['a', 'b', 'c', 'd', 'e', 'f'], { columns: 3 });

            // Should produce 2 rows (6 items / 3 columns)
            expect(terminal.written.length).toBe(2);
        });

        it('should pad items to equal width', () => {
            writer.writeColumns(['short', 'muchlonger', 'mid'], { columns: 3 });

            // All items on a single line since 3 items and 3 columns
            expect(terminal.written.length).toBe(1);
            const line = terminal.written[0];
            // 'short' should be padded to at least the length of 'muchlonger'
            expect(line).toContain('short');
            expect(line).toContain('muchlonger');
            expect(line).toContain('mid');
        });

        it('should use default 3 columns', () => {
            writer.writeColumns(['a', 'b', 'c', 'd', 'e', 'f', 'g']);

            // 7 items / 3 columns = 3 rows (3+3+1)
            expect(terminal.written.length).toBe(3);
        });
    });
});
