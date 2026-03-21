import {
    CliForegroundColor,
    CliProcessCommand,
    CliProcessorMetadata,
    CliServerConfig,
    DefaultLibraryAuthor,
    ICliCommandAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { LIBRARY_VERSION } from '../version';
import {
    DataExplorerLanguage,
    DataExplorerOutputFormat,
    DataExplorerResult,
    DataExplorerSchemaResult,
    DataExplorerSourceInfo,
} from '../models/data-explorer-types';
import { getFormatter } from '../formatters';
import { highlightLine } from '../syntax/highlighter';

const ESC = '\x1b';
const CSI = `${ESC}[`;

const MAX_HISTORY = 50;

export class CliDataExplorerCommandProcessor implements ICliCommandProcessor {
    command = 'data-explorer';

    description = 'Interactive query console for data sources';

    author: ICliCommandAuthor = DefaultLibraryAuthor;

    version = LIBRARY_VERSION;

    processors?: ICliCommandProcessor[] | undefined = [];

    metadata?: CliProcessorMetadata = {
        icon: '\uD83D\uDD0D',
        module: 'data-explorer',
        requireServer: true,
    };

    // ── REPL state ──────────────────────────────────────────────────

    private context: ICliExecutionContext | null = null;
    private serverUrl = '';
    private serverHeaders: Record<string, string> = {};
    private source: DataExplorerSourceInfo | null = null;
    private outputFormat: DataExplorerOutputFormat = DataExplorerOutputFormat.Table;

    /** All lines of the current query being composed. Always has at least one entry. */
    private lines: string[] = [''];
    /** Which line the cursor is on (index into `lines`). */
    private lineIndex = 0;
    /** Cursor column within `lines[lineIndex]`. */
    private cursorPos = 0;

    private history: string[] = [];
    private historyIndex = -1;
    private executing = false;

    // ── Convenience accessors ────────────────────────────────────────

    private get currentLine(): string {
        return this.lines[this.lineIndex];
    }

    private set currentLine(value: string) {
        this.lines[this.lineIndex] = value;
    }

    private get isMultiLine(): boolean {
        return this.lines.length > 1 || this.lines[0].length > 0;
    }

    // ── ICliCommandProcessor ────────────────────────────────────────

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        // Resolve server
        const server = this.resolveServer(command, context);
        if (!server) return;

        this.serverUrl = server.url.replace(/\/+$/, '');
        this.serverHeaders = server.headers ?? {};

        // Fetch sources
        const sources = await this.fetchSources(context);
        if (!sources || sources.length === 0) {
            context.writer.writeError(
                'No data sources available on the server.',
            );
            return;
        }

        // Select source
        let selectedSource: DataExplorerSourceInfo;

        if (sources.length === 1) {
            selectedSource = sources[0];
        } else {
            const choice = await context.reader.readSelect(
                'Select a data source:',
                sources.map((s) => ({
                    label: s.name,
                    value: s.name,
                    description: s.description,
                })),
            );
            if (!choice) return;
            selectedSource = sources.find((s) => s.name === choice)!;
        }

        this.source = selectedSource;
        this.outputFormat = selectedSource.defaultOutputFormat;
        this.resetInput();
        this.history = [];
        this.historyIndex = -1;
        this.executing = false;
        this.context = context;

        // Enter full-screen REPL
        context.enterFullScreenMode(this, { showCursor: true });
        this.drawHeader(context);
        this.drawPrompt(context);
    }

    async onData(data: string, context: ICliExecutionContext): Promise<void> {
        if (this.executing) return;

        // Escape key — quit
        if (data === ESC) {
            this.quit(context);
            return;
        }

        // Up arrow
        if (data === `${ESC}[A`) {
            if (this.lineIndex > 0) {
                // Move to previous line
                this.moveToLine(this.lineIndex - 1, context);
            } else {
                // Navigate history (only when on line 0)
                this.navigateHistory(-1, context);
            }
            return;
        }

        // Down arrow
        if (data === `${ESC}[B`) {
            if (this.lineIndex < this.lines.length - 1) {
                // Move to next line
                this.moveToLine(this.lineIndex + 1, context);
            } else if (this.historyIndex >= 0) {
                // Navigate history forward
                this.navigateHistory(1, context);
            }
            return;
        }

        // Left arrow — move cursor left
        if (data === `${ESC}[D`) {
            if (this.cursorPos > 0) {
                this.cursorPos--;
                context.terminal.write(`${CSI}D`);
            }
            return;
        }

        // Right arrow — move cursor right
        if (data === `${ESC}[C`) {
            if (this.cursorPos < this.currentLine.length) {
                this.cursorPos++;
                context.terminal.write(`${CSI}C`);
            }
            return;
        }

        // Home — move to start of input
        if (data === `${ESC}[H` || data === '\x01') {
            if (this.cursorPos > 0) {
                context.terminal.write(`${CSI}${this.cursorPos}D`);
                this.cursorPos = 0;
            }
            return;
        }

        // End — move to end of input
        if (data === `${ESC}[F` || data === '\x05') {
            const diff = this.currentLine.length - this.cursorPos;
            if (diff > 0) {
                context.terminal.write(`${CSI}${diff}C`);
                this.cursorPos = this.currentLine.length;
            }
            return;
        }

        // Backspace
        if (data === '\x7f' || data === '\b') {
            if (this.cursorPos > 0) {
                // Delete char before cursor on current line
                const before = this.currentLine.slice(0, this.cursorPos - 1);
                const after = this.currentLine.slice(this.cursorPos);
                this.currentLine = before + after;
                this.cursorPos--;
                this.redrawLineContent(context);
            } else if (this.lineIndex > 0) {
                // At start of line: merge with previous line
                const prevLine = this.lines[this.lineIndex - 1];
                const thisLine = this.currentLine;
                const newCursorPos = prevLine.length;

                // Remove current line
                this.lines.splice(this.lineIndex, 1);
                this.lineIndex--;
                this.currentLine = prevLine + thisLine;
                this.cursorPos = newCursorPos;

                // Redraw from current line down
                this.redrawFromLine(this.lineIndex, context);
            }
            return;
        }

        // Delete key
        if (data === `${ESC}[3~`) {
            if (this.cursorPos < this.currentLine.length) {
                const before = this.currentLine.slice(0, this.cursorPos);
                const after = this.currentLine.slice(this.cursorPos + 1);
                this.currentLine = before + after;
                this.redrawLineContent(context);
            } else if (this.lineIndex < this.lines.length - 1) {
                // At end of line: merge with next line
                const nextLine = this.lines[this.lineIndex + 1];
                this.currentLine = this.currentLine + nextLine;
                this.lines.splice(this.lineIndex + 1, 1);
                // Redraw from current line down
                this.redrawFromLine(this.lineIndex, context);
            }
            return;
        }

        // Ctrl+L — clear screen
        if (data === '\x0c') {
            context.terminal.write(`${CSI}2J${CSI}H`);
            this.drawHeader(context);
            this.redrawAllLines(context);
            return;
        }

        // Ctrl+C — cancel or quit
        if (data === '\x03') {
            if (this.isMultiLine) {
                context.terminal.write('\r\n');
                this.resetInput();
                this.drawPrompt(context);
            } else {
                this.quit(context);
            }
            return;
        }

        // Enter
        if (data === '\r' || data === '\n') {
            // Backslash or slash commands (only single-line, empty query)
            if (
                this.lines.length === 1 &&
                (this.currentLine.trim().startsWith('\\') ||
                    this.currentLine.trim().startsWith('/'))
            ) {
                const trimmed = this.currentLine.trim();
                const normalized = trimmed.startsWith('/')
                    ? '\\' + trimmed.slice(1)
                    : trimmed;
                context.terminal.write('\r\n');
                this.resetInput();
                await this.handleBackslashCommand(normalized, context);
                this.drawPrompt(context);
                return;
            }

            // Check if query is complete with current content
            const fullQuery = this.lines.join('\n').trim();
            if (fullQuery && this.isQueryComplete(fullQuery)) {
                context.terminal.write('\r\n');
                this.resetInput();
                await this.executeQuery(fullQuery, context);
                this.drawPrompt(context);
                return;
            }

            // Not complete — add new line after current position
            const afterCursor = this.currentLine.slice(this.cursorPos);
            this.currentLine = this.currentLine.slice(0, this.cursorPos);
            this.lineIndex++;
            this.lines.splice(this.lineIndex, 0, afterCursor);
            this.cursorPos = 0;

            // Redraw from the truncated line so highlighting updates
            this.redrawFromLine(this.lineIndex - 1, context);
            return;
        }

        // Printable character
        if (data.length === 1 && data >= ' ') {
            const before = this.currentLine.slice(0, this.cursorPos);
            const after = this.currentLine.slice(this.cursorPos);
            this.currentLine = before + data + after;
            this.cursorPos++;
            this.redrawLineContent(context);
        }
    }

    onDispose(): void {
        this.context = null;
        this.source = null;
        this.resetInput();
        this.history = [];
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer } = context;
        writer.writeln(this.description!);
        writer.writeln();
        writer.writeln(
            `  ${writer.wrapInColor('data-explorer', CliForegroundColor.Cyan)}    Open interactive query console`,
        );
        writer.writeln();
        writer.writeln('Requires a configured server with the data-explorer plugin.');
    }

    // ── Private helpers ─────────────────────────────────────────────

    private resetInput(): void {
        this.lines = [''];
        this.lineIndex = 0;
        this.cursorPos = 0;
    }

    private resolveServer(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): CliServerConfig | null {
        const servers = context.options?.servers;
        if (!servers || servers.length === 0) {
            context.writer.writeError(
                'No servers configured. Add servers to CLI options.',
            );
            return null;
        }

        const serverArg = command.args['server'] as string | undefined;
        if (serverArg) {
            if (
                serverArg.startsWith('http://') ||
                serverArg.startsWith('https://')
            ) {
                return { name: 'custom', url: serverArg };
            }
            const match = servers.find(
                (s) => s.name.toLowerCase() === serverArg.toLowerCase(),
            );
            if (!match) {
                context.writer.writeError(`Unknown server: ${serverArg}`);
                context.writer.writeInfo(
                    'Available: ' + servers.map((s) => s.name).join(', '),
                );
                return null;
            }
            return match;
        }

        return servers[0];
    }

    private async fetchSources(
        context: ICliExecutionContext,
    ): Promise<DataExplorerSourceInfo[] | null> {
        try {
            const response = await fetch(
                `${this.serverUrl}/api/qcli/data-explorer/sources`,
                { headers: this.serverHeaders },
            );
            if (!response.ok) {
                context.writer.writeError(
                    `Failed to fetch sources: ${response.status} ${response.statusText}`,
                );
                return null;
            }
            return (await response.json()) as DataExplorerSourceInfo[];
        } catch (err: unknown) {
            const message =
                err instanceof Error ? err.message : String(err);
            context.writer.writeError(
                `Failed to connect to server: ${message}`,
            );
            return null;
        }
    }

    private async executeQuery(
        query: string,
        context: ICliExecutionContext,
    ): Promise<void> {
        // Add to history
        if (
            this.history.length === 0 ||
            this.history[this.history.length - 1] !== query
        ) {
            this.history.push(query);
            if (this.history.length > MAX_HISTORY) {
                this.history.shift();
            }
        }
        this.historyIndex = -1;

        this.executing = true;
        context.spinner?.show('Executing...');

        try {
            const response = await fetch(
                `${this.serverUrl}/api/qcli/data-explorer/execute`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...this.serverHeaders,
                    },
                    body: JSON.stringify({
                        source: this.source!.name,
                        query,
                        parameters: {},
                    }),
                },
            );

            context.spinner?.hide();

            if (!response.ok) {
                context.writer.writeError(
                    `Server error: ${response.status} ${response.statusText}`,
                );
                this.executing = false;
                return;
            }

            const result = (await response.json()) as DataExplorerResult;

            if (!result.success) {
                context.writer.writeError(result.error ?? 'Query failed');
                this.executing = false;
                return;
            }

            const formatter = getFormatter(this.outputFormat);
            const output = formatter(result);
            context.writer.writeln(output);
        } catch (err: unknown) {
            context.spinner?.hide();
            const message =
                err instanceof Error ? err.message : String(err);
            context.writer.writeError(`Request failed: ${message}`);
        }

        this.executing = false;
    }

    private async handleBackslashCommand(
        input: string,
        context: ICliExecutionContext,
    ): Promise<void> {
        const parts = input.split(/\s+/);
        const cmd = parts[0].toLowerCase();
        const arg = parts.slice(1).join(' ');

        switch (cmd) {
            case '\\format': {
                const fmt = arg.toLowerCase() as DataExplorerOutputFormat;
                const valid = Object.values(DataExplorerOutputFormat);
                if (!valid.includes(fmt)) {
                    context.writer.writeError(
                        `Invalid format. Available: ${valid.join(', ')}`,
                    );
                    return;
                }
                this.outputFormat = fmt;
                context.writer.writeInfo(`Output format set to: ${fmt}`);
                return;
            }

            case '\\templates': {
                const templates = this.source?.templates ?? [];
                if (templates.length === 0) {
                    context.writer.writeInfo('No templates available.');
                    return;
                }
                context.writer.writeln('');
                context.writer.writeln(
                    context.writer.wrapInColor(
                        'Available templates:',
                        CliForegroundColor.Cyan,
                    ),
                );
                for (const t of templates) {
                    context.writer.writeln(
                        `  ${context.writer.wrapInColor(t.name, CliForegroundColor.Yellow)} - ${t.description ?? ''}`,
                    );
                }
                return;
            }

            case '\\use': {
                if (!arg) {
                    context.writer.writeError(
                        'Usage: \\use <template-name>',
                    );
                    return;
                }
                const template = this.source?.templates?.find(
                    (t) => t.name.toLowerCase() === arg.toLowerCase(),
                );
                if (!template) {
                    context.writer.writeError(
                        `Template "${arg}" not found.`,
                    );
                    return;
                }
                context.writer.writeln('');
                context.writer.writeln(
                    context.writer.wrapInColor(
                        `Template: ${template.name}`,
                        CliForegroundColor.Cyan,
                    ),
                );
                if (template.description) {
                    context.writer.writeln(`  ${template.description}`);
                }
                context.writer.writeln('');
                context.writer.writeln(template.query);
                return;
            }

            case '\\history': {
                if (this.history.length === 0) {
                    context.writer.writeInfo('No query history.');
                    return;
                }
                context.writer.writeln('');
                context.writer.writeln(
                    context.writer.wrapInColor(
                        'Query history:',
                        CliForegroundColor.Cyan,
                    ),
                );
                this.history.forEach((q, i) => {
                    context.writer.writeln(
                        `  ${context.writer.wrapInColor(String(i + 1), CliForegroundColor.Yellow)}. ${q}`,
                    );
                });
                return;
            }

            case '\\schema': {
                await this.fetchAndDisplaySchema(arg || undefined, context);
                return;
            }

            case '\\clear': {
                context.terminal.write(`${CSI}2J${CSI}H`);
                this.drawHeader(context);
                return;
            }

            case '\\help': {
                context.writer.writeln('');
                context.writer.writeln(
                    context.writer.wrapInColor(
                        'Available commands:',
                        CliForegroundColor.Cyan,
                    ),
                );
                context.writer.writeln(
                    `  ${context.writer.wrapInColor('\\format <table|json|csv|raw>', CliForegroundColor.Yellow)}  Switch output format`,
                );
                context.writer.writeln(
                    `  ${context.writer.wrapInColor('\\templates', CliForegroundColor.Yellow)}                      List available templates`,
                );
                context.writer.writeln(
                    `  ${context.writer.wrapInColor('\\use <name>', CliForegroundColor.Yellow)}                     Show template query`,
                );
                context.writer.writeln(
                    `  ${context.writer.wrapInColor('\\history', CliForegroundColor.Yellow)}                        Show query history`,
                );
                context.writer.writeln(
                    `  ${context.writer.wrapInColor('\\schema [table]', CliForegroundColor.Yellow)}                  Show database schema`,
                );
                context.writer.writeln(
                    `  ${context.writer.wrapInColor('\\clear', CliForegroundColor.Yellow)} / ${context.writer.wrapInColor('Ctrl+L', CliForegroundColor.Yellow)}                  Clear screen`,
                );
                context.writer.writeln(
                    `  ${context.writer.wrapInColor('\\help', CliForegroundColor.Yellow)}                           Show this help`,
                );
                context.writer.writeln(
                    `  ${context.writer.wrapInColor('\\quit', CliForegroundColor.Yellow)}                           Exit data explorer`,
                );
                context.writer.writeln('');
                context.writer.writeln(
                    context.writer.wrapInColor(
                        'Multi-line: SQL queries execute on ";". Other queries execute when brackets are balanced.',
                        CliForegroundColor.White,
                    ),
                );
                context.writer.writeln(
                    context.writer.wrapInColor(
                        'Use Up/Down arrows to navigate between lines. Ctrl+C to cancel.',
                        CliForegroundColor.White,
                    ),
                );
                return;
            }

            case '\\quit':
            case '\\q': {
                this.quit(context);
                return;
            }

            default:
                context.writer.writeError(
                    `Unknown command: ${cmd}. Type \\help for available commands.`,
                );
        }
    }

    private async fetchAndDisplaySchema(
        tableName: string | undefined,
        context: ICliExecutionContext,
    ): Promise<void> {
        this.executing = true;
        context.spinner?.show('Fetching schema...');

        try {
            const response = await fetch(
                `${this.serverUrl}/api/qcli/data-explorer/schema?source=${encodeURIComponent(this.source!.name)}`,
                { headers: this.serverHeaders },
            );

            context.spinner?.hide();

            if (!response.ok) {
                const body = await response.json().catch(() => null);
                context.writer.writeError(
                    body?.error ?? body?.detail ?? `Server error: ${response.status}`,
                );
                this.executing = false;
                return;
            }

            const schema = (await response.json()) as DataExplorerSchemaResult;
            let tables = schema.tables;

            if (tableName) {
                tables = tables.filter(
                    (t) => t.name.toLowerCase() === tableName.toLowerCase(),
                );
                if (tables.length === 0) {
                    context.writer.writeError(
                        `Table or collection "${tableName}" not found.`,
                    );
                    this.executing = false;
                    return;
                }
            }

            context.writer.writeln('');

            if (!tableName) {
                // Overview: list all tables
                context.writer.writeln(
                    context.writer.wrapInColor(
                        `Schema for ${schema.source}:`,
                        CliForegroundColor.Cyan,
                    ),
                );
                context.writer.writeln('');
                for (const table of tables) {
                    const colCount = table.columns.length;
                    context.writer.writeln(
                        `  ${context.writer.wrapInColor(table.name, CliForegroundColor.Yellow)} (${table.type}, ${colCount} column${colCount !== 1 ? 's' : ''})`,
                    );
                }
                context.writer.writeln('');
                context.writer.writeln(
                    context.writer.wrapInColor(
                        `${tables.length} table${tables.length !== 1 ? 's' : ''} found. Use \\schema <name> for details.`,
                        CliForegroundColor.White,
                    ),
                );
            } else {
                // Detail: show columns for specific table
                for (const table of tables) {
                    context.writer.writeln(
                        context.writer.wrapInColor(
                            `${table.name} (${table.type}):`,
                            CliForegroundColor.Cyan,
                        ),
                    );
                    context.writer.writeln('');

                    // Column header
                    const nameW = Math.max(6, ...table.columns.map((c) => c.name.length));
                    const typeW = Math.max(4, ...table.columns.map((c) => c.type.length));
                    context.writer.writeln(
                        `  ${context.writer.wrapInColor(
                            'Column'.padEnd(nameW),
                            CliForegroundColor.Yellow,
                        )}  ${context.writer.wrapInColor(
                            'Type'.padEnd(typeW),
                            CliForegroundColor.Yellow,
                        )}  ${context.writer.wrapInColor('Nullable', CliForegroundColor.Yellow)}  ${context.writer.wrapInColor('PK', CliForegroundColor.Yellow)}`,
                    );
                    context.writer.writeln(
                        `  ${'─'.repeat(nameW)}  ${'─'.repeat(typeW)}  ${'─'.repeat(8)}  ${'─'.repeat(2)}`,
                    );

                    for (const col of table.columns) {
                        const nullable = col.nullable ? 'YES' : 'NO';
                        const pk = col.primaryKey ? '*' : '';
                        context.writer.writeln(
                            `  ${col.name.padEnd(nameW)}  ${col.type.padEnd(typeW)}  ${nullable.padEnd(8)}  ${pk}`,
                        );
                    }
                }
            }
        } catch (err: unknown) {
            context.spinner?.hide();
            const message =
                err instanceof Error ? err.message : String(err);
            context.writer.writeError(`Failed to fetch schema: ${message}`);
        }

        this.executing = false;
    }

    // ── Line navigation ─────────────────────────────────────────────

    /**
     * Move cursor to a different line. Handles terminal cursor movement
     * and updates lineIndex/cursorPos.
     */
    private moveToLine(
        targetLine: number,
        context: ICliExecutionContext,
    ): void {
        const delta = targetLine - this.lineIndex;
        if (delta === 0) return;

        // Move terminal cursor up or down by |delta| lines
        if (delta < 0) {
            context.terminal.write(`${CSI}${-delta}A`);
        } else {
            context.terminal.write(`${CSI}${delta}B`);
        }

        this.lineIndex = targetLine;
        const targetLineText = this.currentLine;
        // Clamp cursor to new line length
        this.cursorPos = Math.min(this.cursorPos, targetLineText.length);

        // Position cursor at correct column (after the prompt)
        const promptLen = this.getPromptLength(targetLine);
        context.terminal.write(`\r${CSI}${promptLen + this.cursorPos}C`);
    }

    private navigateHistory(
        direction: number,
        context: ICliExecutionContext,
    ): void {
        if (this.history.length === 0) return;

        if (direction < 0) {
            // Up
            if (this.historyIndex === -1) {
                this.historyIndex = this.history.length - 1;
            } else if (this.historyIndex > 0) {
                this.historyIndex--;
            } else {
                return; // Already at oldest
            }
        } else {
            // Down
            if (this.historyIndex === -1) return;
            if (this.historyIndex < this.history.length - 1) {
                this.historyIndex++;
            } else {
                this.historyIndex = -1;
                this.clearDisplayedInput(context);
                this.resetInput();
                this.drawPrompt(context);
                return;
            }
        }

        this.clearDisplayedInput(context);

        const entry = this.history[this.historyIndex];
        this.lines = entry.split('\n');
        this.lineIndex = this.lines.length - 1;
        this.cursorPos = this.currentLine.length;

        this.redrawAllLines(context);
    }

    // ── Syntax highlighting ─────────────────────────────────────────

    private highlightText(text: string): string {
        if (!this.source) return text;
        return highlightLine(text, this.source.language);
    }

    /**
     * Redraw the content of the current line in-place with syntax highlighting.
     * Preserves cursor position. Used after single-character edits.
     */
    private redrawLineContent(context: ICliExecutionContext): void {
        const promptLen = this.getPromptLength(this.lineIndex);
        const highlighted = this.highlightText(this.currentLine);
        // Move to start of content (after prompt), clear to end of line, write highlighted
        context.terminal.write(`\r${CSI}${promptLen}C${CSI}K${highlighted}`);
        // Move cursor back to correct position
        const tailLen = this.currentLine.length - this.cursorPos;
        if (tailLen > 0) {
            context.terminal.write(`${CSI}${tailLen}D`);
        }
    }

    // ── Terminal drawing helpers ─────────────────────────────────────

    /**
     * Clear all currently displayed input lines from the terminal.
     * After this call the cursor is at the beginning of where line 0's prompt was.
     */
    private clearDisplayedInput(context: ICliExecutionContext): void {
        // Move from current lineIndex up to line 0
        if (this.lineIndex > 0) {
            context.terminal.write(`${CSI}${this.lineIndex}A`);
        }
        // Clear from line 0 down
        context.terminal.write(`\r${CSI}J`);
    }

    /**
     * Redraw all lines with prompts and position cursor on the current line.
     */
    private redrawAllLines(context: ICliExecutionContext): void {
        for (let i = 0; i < this.lines.length; i++) {
            this.drawLinePrompt(i, context);
            context.terminal.write(this.highlightText(this.lines[i]));
            if (i < this.lines.length - 1) {
                context.terminal.write('\r\n');
            }
        }
        // If cursor is not on the last line, move up
        const linesBelow = this.lines.length - 1 - this.lineIndex;
        if (linesBelow > 0) {
            context.terminal.write(`${CSI}${linesBelow}A`);
        }
        // Position cursor at correct column
        const promptLen = this.getPromptLength(this.lineIndex);
        context.terminal.write(`\r${CSI}${promptLen + this.cursorPos}C`);
    }

    /**
     * Redraw from a specific line index to the end.
     * Cursor ends on `this.lineIndex` at `this.cursorPos`.
     */
    private redrawFromLine(
        fromLine: number,
        context: ICliExecutionContext,
    ): void {
        // Move to the target line if needed
        const currentScreenLine = this.lineIndex;
        const moveUp = currentScreenLine - fromLine;

        // We're already positioned — just need to handle the redraw
        // First, go to start of fromLine
        if (moveUp > 0) {
            context.terminal.write(`${CSI}${moveUp}A`);
        } else if (moveUp < 0) {
            context.terminal.write(`${CSI}${-moveUp}B`);
        }

        // Clear from here to end of screen
        context.terminal.write(`\r${CSI}J`);

        // Redraw from fromLine to end
        for (let i = fromLine; i < this.lines.length; i++) {
            this.drawLinePrompt(i, context);
            context.terminal.write(this.highlightText(this.lines[i]));
            if (i < this.lines.length - 1) {
                context.terminal.write('\r\n');
            }
        }

        // Move cursor back to current editing line
        const linesBelow = this.lines.length - 1 - this.lineIndex;
        if (linesBelow > 0) {
            context.terminal.write(`${CSI}${linesBelow}A`);
        }
        // Position cursor
        const promptLen = this.getPromptLength(this.lineIndex);
        context.terminal.write(`\r${CSI}${promptLen + this.cursorPos}C`);
    }

    private drawHeader(context: ICliExecutionContext): void {
        if (!this.source) return;
        const { writer } = context;

        writer.writeln('');
        writer.writeln(
            writer.wrapInColor(
                `[${this.source.name}]`,
                CliForegroundColor.Cyan,
            ) +
                ` (${this.source.language}) | format: ${this.outputFormat} | \\help for commands`,
        );
        writer.writeln('');
    }

    private drawPrompt(context: ICliExecutionContext): void {
        if (!this.source) return;
        context.terminal.write(
            `${CSI}36m${this.source.name}> ${CSI}0m`,
        );
    }

    private drawContinuationPrompt(context: ICliExecutionContext): void {
        if (!this.source) return;
        const pad = ' '.repeat(Math.max(0, this.source.name.length - 3));
        context.terminal.write(
            `${CSI}36m${pad}...> ${CSI}0m`,
        );
    }

    /** Draw the appropriate prompt for a given line index. */
    private drawLinePrompt(
        lineIdx: number,
        context: ICliExecutionContext,
    ): void {
        if (lineIdx === 0) {
            this.drawPrompt(context);
        } else {
            this.drawContinuationPrompt(context);
        }
    }

    /** Get the visible character length of the prompt for a given line. */
    private getPromptLength(lineIdx: number): number {
        if (!this.source) return 0;
        // "name> " or "   ...> "
        return this.source.name.length + 2; // both prompts have equal visible width
    }

    private isQueryComplete(query: string): boolean {
        if (!query) return false;

        // SQL: must end with semicolon
        if (this.source?.language === DataExplorerLanguage.Sql) {
            return query.endsWith(';');
        }

        // MongoDB / other: check balanced brackets and parens
        let depth = 0;
        let inString = false;
        let stringChar = '';
        for (let i = 0; i < query.length; i++) {
            const c = query[i];
            if (inString) {
                if (c === '\\') {
                    i++; // skip escaped char
                } else if (c === stringChar) {
                    inString = false;
                }
            } else {
                if (c === '"' || c === "'") {
                    inString = true;
                    stringChar = c;
                } else if (c === '(' || c === '[' || c === '{') {
                    depth++;
                } else if (c === ')' || c === ']' || c === '}') {
                    depth--;
                }
            }
        }

        // Complete when all brackets are balanced and there's actual content
        return depth <= 0;
    }

    private quit(context: ICliExecutionContext): void {
        context.exitFullScreenMode();
        this.context = null;
    }
}
