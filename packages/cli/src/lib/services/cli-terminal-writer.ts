import { Terminal } from '@xterm/xterm';
import {
    CliBackgroundColor,
    CliForegroundColor,
    CliIcon,
    CliTableOptions,
    formatJson,
    ICliTerminalWriter,
    stripAnsi,
    visibleLength,
} from '@qodalis/cli-core';

export class CliTerminalWriter implements ICliTerminalWriter {
    constructor(public readonly terminal: Terminal) {}

    write(text: string): void {
        this.terminal.write(text);
    }
    writeln(text?: string): void {
        this.terminal.writeln(text || '');
    }

    public writeSuccess(message: string) {
        this.writeLog(message, CliForegroundColor.Green, CliIcon.CheckIcon);
    }

    public writeInfo(message: string) {
        this.writeLog(message, CliForegroundColor.Cyan, CliIcon.InfoIcon);
    }

    public writeWarning(message: string) {
        this.writeLog(message, CliForegroundColor.Yellow, CliIcon.WarningIcon);
    }

    public writeError(message: string) {
        this.writeLog(message, CliForegroundColor.Red, CliIcon.CrossIcon);
    }

    private writeLog(
        message: string,
        color: CliForegroundColor,
        icon?: CliIcon,
    ) {
        this.terminal.writeln(
            this.wrapInColor(icon ? icon + ' ' + message : message, color),
        );
    }

    public writeDivider(options?: {
        color?: CliForegroundColor;
        length?: number;
        char?: string;
    }) {
        const { color, length: oLength, char: oChar } = options || {};

        let length = oLength ?? 80;
        const char = oChar ?? '-';

        if (this.terminal.cols < length) {
            length = this.terminal.cols;
        }

        let text = char.repeat(length);

        if (color) {
            text = this.wrapInColor(text, color);
        }

        this.writeln(text);
    }

    public wrapInColor(text: string, color: CliForegroundColor): string {
        return color + text + CliForegroundColor.Reset;
    }

    public wrapInBackgroundColor(text: string, color: CliBackgroundColor) {
        return color + text + CliForegroundColor.Reset;
    }

    public writeJson(json: any) {
        this.terminal.writeln(formatJson(json));
    }

    public writeToFile(fileName: string, content: string): void {
        const blob = new Blob([content], { type: 'text/plain' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = fileName;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    public writeObjectsAsTable(objects: any[]): void {
        if (objects.length === 0) {
            this.writeInfo('No objects to display');
            return;
        }

        const headers = Object.keys(objects[0]);
        const rows = objects.map((object) =>
            headers.map((header) => object[header]),
        );

        this.writeTable(headers, rows);
    }

    public writeList(
        items: string[],
        options?: {
            ordered?: boolean;
            prefix?: string;
            color?: CliForegroundColor;
        },
    ): void {
        const { ordered, prefix, color } = options || {};
        items.forEach((item, i) => {
            const marker = prefix ?? (ordered ? `${i + 1}.` : '\u2022');
            const text = `  ${marker} ${item}`;
            this.writeln(color ? this.wrapInColor(text, color) : text);
        });
    }

    public writeKeyValue(
        entries: Record<string, string> | [string, string][],
        options?: { separator?: string; keyColor?: CliForegroundColor },
    ): void {
        const pairs = Array.isArray(entries)
            ? entries
            : Object.entries(entries);
        const maxKeyLen = Math.max(...pairs.map(([k]) => k.length));
        const sep = options?.separator ?? ':';
        const keyColor = options?.keyColor ?? CliForegroundColor.Yellow;
        for (const [key, value] of pairs) {
            const paddedKey = key.padEnd(maxKeyLen);
            this.writeln(
                `  ${this.wrapInColor(paddedKey, keyColor)} ${sep} ${value}`,
            );
        }
    }

    public writeColumns(
        items: string[],
        options?: { columns?: number; padding?: number },
    ): void {
        const cols = options?.columns ?? 3;
        const pad = options?.padding ?? 2;
        const colWidth = Math.max(...items.map((s) => s.length)) + pad;
        for (let i = 0; i < items.length; i += cols) {
            const row = items.slice(i, i + cols);
            this.writeln(row.map((item) => item.padEnd(colWidth)).join(''));
        }
    }

    public writeLink(text: string, url: string): void {
        // OSC 8 hyperlink: \x1b]8;;URL\x07TEXT\x1b]8;;\x07
        this.writeln(`\x1b]8;;${url}\x07${text}\x1b]8;;\x07`);
    }

    public writeBox(
        content: string | string[],
        options?: {
            title?: string;
            borderColor?: CliForegroundColor;
            padding?: number;
        },
    ): void {
        const lines = Array.isArray(content) ? content : [content];
        const pad = options?.padding ?? 1;
        const color = options?.borderColor;
        const wrap = (s: string) => (color ? this.wrapInColor(s, color) : s);

        const maxContentWidth = Math.max(
            ...lines.map((l) => visibleLength(l)),
            options?.title ? visibleLength(options.title) + 2 : 0,
        );
        const innerWidth = maxContentWidth + pad * 2;

        // Top border
        if (options?.title) {
            const title = ` ${options.title} `;
            const remaining = innerWidth - visibleLength(title);
            const left = Math.floor(remaining / 2);
            const right = remaining - left;
            this.writeln(wrap('┌' + '─'.repeat(left) + title + '─'.repeat(right) + '┐'));
        } else {
            this.writeln(wrap('┌' + '─'.repeat(innerWidth) + '┐'));
        }

        // Content lines with padding
        const padStr = ' '.repeat(pad);
        for (const line of lines) {
            const rightPad = innerWidth - pad * 2 - visibleLength(line);
            this.writeln(wrap('│') + padStr + line + ' '.repeat(Math.max(0, rightPad)) + padStr + wrap('│'));
        }

        // Bottom border
        this.writeln(wrap('└' + '─'.repeat(innerWidth) + '┘'));
    }

    public writeIndented(text: string, level: number = 1): void {
        const indent = '  '.repeat(level);
        this.writeln(`${indent}${text}`);
    }

    public writeTable(headers: string[], rows: string[][], options?: CliTableOptions): void {
        const cols = this.terminal.cols;

        // Calculate natural (unconstrained) column widths
        const naturalWidths = headers.map((header, colIndex) =>
            Math.max(
                visibleLength(header),
                ...rows.map((row) => visibleLength(row[colIndex] ?? '')),
            ),
        );

        // Separators take 3 chars each (" | "), total overhead
        const separatorWidth = (headers.length - 1) * 3;
        const available = cols - separatorWidth;
        const totalNatural = naturalWidths.reduce((s, w) => s + w, 0);

        // Constrain column widths to fit within terminal
        let colWidths: number[];
        if (totalNatural <= available || available < headers.length) {
            colWidths = [...naturalWidths];
            // Expand to fill terminal width when fullWidth is set
            if (options?.fullWidth && totalNatural < available) {
                const extra = available - totalNatural;
                // Distribute extra space proportionally
                let distributed = 0;
                colWidths = naturalWidths.map((w, i) => {
                    const share = i < colWidths.length - 1
                        ? Math.floor((w / totalNatural) * extra)
                        : extra - distributed;
                    distributed += share;
                    return w + share;
                });
            }
        } else {
            // Shrink columns proportionally, with a minimum of 4 chars
            const minCol = 4;
            colWidths = naturalWidths.map((w) =>
                Math.max(minCol, Math.floor((w / totalNatural) * available)),
            );
            // Distribute any remaining space to the widest columns
            let used = colWidths.reduce((s, w) => s + w, 0);
            for (let i = 0; used < available && i < colWidths.length; i++) {
                const idx = naturalWidths.indexOf(
                    Math.max(...naturalWidths.filter((_, j) => j >= i)),
                );
                colWidths[idx]++;
                used++;
            }
        }

        // Truncate text to fit column width, preserving ANSI codes
        const truncateText = (text: string, maxWidth: number): string => {
            const t = text ?? '';
            const vis = visibleLength(t);
            if (vis <= maxWidth) return t;
            // Walk through the string, tracking visible chars
            const raw = stripAnsi(t);
            const truncatedRaw = raw.slice(0, Math.max(0, maxWidth - 1)) + '…';
            return truncatedRaw;
        };

        // Pad text to a visible width, accounting for invisible ANSI sequences
        const fitText = (text: string, width: number) => {
            const truncated = truncateText(text, width);
            const visible = visibleLength(truncated);
            const padding = Math.max(0, width - visible);
            return truncated + ' '.repeat(padding);
        };

        // Write the header
        this.write(
            headers
                .map((header, i) =>
                    this.wrapInColor(
                        fitText(header, colWidths[i]),
                        CliForegroundColor.Yellow,
                    ),
                )
                .join(' | ') + '\r\n',
        );
        const dividerWidth = Math.min(
            cols,
            colWidths.reduce((sum, w) => sum + w + 3, -3),
        );
        this.write('-'.repeat(dividerWidth) + '\r\n');

        // Write the rows
        rows.forEach((row) => {
            this.write(
                row.map((cell, i) => fitText(cell, colWidths[i])).join(' | ') +
                    '\r\n',
            );
        });
    }
}
