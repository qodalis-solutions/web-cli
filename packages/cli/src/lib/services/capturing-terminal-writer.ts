import {
    CliBackgroundColor,
    CliForegroundColor,
    ICliTerminalWriter,
    stripAnsi,
} from '@qodalis/cli-core';

/**
 * A terminal writer wrapper that captures "stdout-equivalent" output
 * (`write`, `writeln`, `writeJson`, `writeObjectsAsTable`, `writeTable`)
 * while passing everything through to the underlying writer unchanged.
 *
 * Diagnostic methods (`writeError`, `writeWarning`, `writeInfo`, `writeSuccess`)
 * are NOT captured — they are the equivalent of stderr.
 *
 * After a command finishes, the executor can retrieve the captured data to use
 * as implicit pipeline output when the command did not call `process.output()`.
 *
 * `muted` (output going into a pipe or a file) captures stdout-equivalent
 * output without showing it; diagnostics are still shown.
 */
export class CapturingTerminalWriter implements ICliTerminalWriter {
    /** Raw text lines captured from write/writeln calls. */
    private _lines: string[] = [];

    /** Structured data captured from writeJson calls. */
    private _jsonValues: any[] = [];

    /** Structured data captured from writeObjectsAsTable calls. */
    private _tableObjects: any[][] = [];

    /** Raw text lines captured from writeError/writeWarning calls. */
    private _stderrLines: string[] = [];

    /** Number of writeError calls (warnings excluded). */
    private _errorCount = 0;

    private readonly muted: boolean;

    constructor(
        private readonly inner: ICliTerminalWriter,
        options: { muted?: boolean } = {},
    ) {
        this.muted = options.muted ?? false;
    }

    /** Show stdout-equivalent output unless muted. */
    private show(render: () => void): void {
        if (!this.muted) render();
    }

    private captureText(lines: string[]): void {
        lines.forEach((l) => this._lines.push(stripAnsi(l)));
    }

    // -- stdout-equivalent methods (captured) --------------------------------

    write(text: string): void {
        this._lines.push(stripAnsi(text));
        this.show(() => this.inner.write(text));
    }

    writeln(text?: string): void {
        if (text !== undefined && text !== '') {
            this._lines.push(stripAnsi(text));
        }
        this.show(() => this.inner.writeln(text));
    }

    writeJson(json: any): void {
        this._jsonValues.push(json);
        this.show(() => this.inner.writeJson(json));
    }

    writeObjectsAsTable(objects: any[]): void {
        this._tableObjects.push(objects);
        this.show(() => this.inner.writeObjectsAsTable(objects));
    }

    writeTable(headers: string[], rows: string[][]): void {
        // Captured as text lines (so `| grep` works); commands that want
        // structured pipeline output should call process.output() explicitly.
        this.captureText([headers, ...rows].map((r) => r.join('  ')));
        this.show(() => this.inner.writeTable(headers, rows));
    }

    // -- stderr-equivalent methods (NOT captured) ----------------------------

    writeSuccess(message: string): void {
        this.inner.writeSuccess(message);
    }

    writeInfo(message: string): void {
        this.inner.writeInfo(message);
    }

    writeWarning(message: string): void {
        this._stderrLines.push(stripAnsi(message));
        this.inner.writeWarning(message);
    }

    writeError(message: string): void {
        this._stderrLines.push(stripAnsi(message));
        this._errorCount++;
        this.inner.writeError(message);
    }

    // -- pass-through methods ------------------------------------------------

    wrapInColor(text: string, color: CliForegroundColor): string {
        return this.inner.wrapInColor(text, color);
    }

    wrapInBackgroundColor(text: string, color: CliBackgroundColor): string {
        return this.inner.wrapInBackgroundColor(text, color);
    }

    writeToFile(fileName: string, content: string): void {
        this.inner.writeToFile(fileName, content);
    }

    writeDivider(options?: {
        color?: CliForegroundColor;
        length?: number;
        char?: string;
    }): void {
        this.show(() => this.inner.writeDivider(options));
    }

    writeList(
        items: string[],
        options?: {
            ordered?: boolean;
            prefix?: string;
            color?: CliForegroundColor;
        },
    ): void {
        this.captureText(items);
        this.show(() => this.inner.writeList(items, options));
    }

    writeKeyValue(
        entries: Record<string, string> | [string, string][],
        options?: { separator?: string; keyColor?: CliForegroundColor },
    ): void {
        const pairs = Array.isArray(entries) ? entries : Object.entries(entries);
        this.captureText(pairs.map(([k, v]) => `${k}: ${v}`));
        this.show(() => this.inner.writeKeyValue(entries, options));
    }

    writeColumns(
        items: string[],
        options?: { columns?: number; padding?: number },
    ): void {
        this.captureText(items);
        this.show(() => this.inner.writeColumns(items, options));
    }

    writeLink(text: string, url: string): void {
        this._lines.push(stripAnsi(text));
        this.show(() => this.inner.writeLink(text, url));
    }

    writeBox(
        content: string | string[],
        options?: {
            title?: string;
            borderColor?: CliForegroundColor;
            padding?: number;
        },
    ): void {
        const lines = Array.isArray(content) ? content : [content];
        lines.forEach((l) => this._lines.push(stripAnsi(l)));
        this.show(() => this.inner.writeBox(content, options));
    }

    writeIndented(text: string, level?: number): void {
        this._lines.push(stripAnsi(text));
        this.show(() => this.inner.writeIndented(text, level));
    }

    // -- captured data accessors ---------------------------------------------

    /**
     * Returns true if any stdout-equivalent output was captured.
     */
    hasOutput(): boolean {
        return (
            this._lines.length > 0 ||
            this._jsonValues.length > 0 ||
            this._tableObjects.length > 0
        );
    }

    /**
     * Returns the captured data in the most useful form:
     *
     * 1. If structured JSON was written (via `writeJson`), return the last
     *    JSON value (preserving its original type — object, array, etc.).
     * 2. If objects were written as a table, return the last array of objects.
     * 3. Otherwise return the captured text lines joined with newlines,
     *    with ANSI codes stripped and whitespace trimmed.
     * 4. Returns `undefined` if nothing was captured.
     */
    getCapturedData(): any | undefined {
        // Prefer structured data over raw text
        if (this._jsonValues.length > 0) {
            return this._jsonValues.length === 1
                ? this._jsonValues[0]
                : this._jsonValues;
        }

        if (this._tableObjects.length > 0) {
            return this._tableObjects.length === 1
                ? this._tableObjects[0]
                : this._tableObjects.flat();
        }

        if (this._lines.length > 0) {
            const text = this._lines.join('\n').replace(/\r\n/g, '\n').trim();
            return text || undefined;
        }

        return undefined;
    }

    /** Whether the command wrote an error message itself. */
    hasErrors(): boolean {
        return this._errorCount > 0;
    }

    /**
     * Returns true if any stderr-equivalent output was captured.
     */
    hasStderr(): boolean {
        return this._stderrLines.length > 0;
    }

    /**
     * Returns captured stderr text joined with newlines, or undefined if empty.
     */
    getCapturedStderr(): string | undefined {
        if (this._stderrLines.length === 0) return undefined;
        return this._stderrLines.join('\n').trim() || undefined;
    }
}
