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
    private inputBuffer = '';
    private history: string[] = [];
    private historyIndex = -1;
    private executing = false;

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
        this.inputBuffer = '';
        this.history = [];
        this.historyIndex = -1;
        this.executing = false;
        this.context = context;

        // Enter full-screen REPL
        context.enterFullScreenMode(this);
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

        // Up arrow — history navigation
        if (data === `${ESC}[A`) {
            this.navigateHistory(-1, context);
            return;
        }

        // Down arrow — history navigation
        if (data === `${ESC}[B`) {
            this.navigateHistory(1, context);
            return;
        }

        // Backspace
        if (data === '\x7f' || data === '\b') {
            if (this.inputBuffer.length > 0) {
                this.inputBuffer = this.inputBuffer.slice(0, -1);
                context.terminal.write('\b \b');
            }
            return;
        }

        // Ctrl+C — clear line or quit
        if (data === '\x03') {
            if (this.inputBuffer.length > 0) {
                this.inputBuffer = '';
                context.terminal.write('\r\n');
                this.drawPrompt(context);
            } else {
                this.quit(context);
            }
            return;
        }

        // Enter
        if (data === '\r' || data === '\n') {
            context.terminal.write('\r\n');
            const line = this.inputBuffer.trim();
            this.inputBuffer = '';

            if (!line) {
                this.drawPrompt(context);
                return;
            }

            // Backslash or slash commands
            if (line.startsWith('\\') || line.startsWith('/')) {
                // Normalize to backslash prefix for the handler
                const normalized = line.startsWith('/')
                    ? '\\' + line.slice(1)
                    : line;
                await this.handleBackslashCommand(normalized, context);
                this.drawPrompt(context);
                return;
            }

            // For SQL, require semicolon terminator
            if (
                this.source?.language === DataExplorerLanguage.Sql &&
                !line.endsWith(';')
            ) {
                // Keep accumulating (multi-line not fully supported in raw mode,
                // but accept the line as-is if it ends with ;)
                // Re-submit with the current line
                this.inputBuffer = line;
                context.writer.writeln(
                    context.writer.wrapInColor(
                        '  (end query with ; to execute)',
                        CliForegroundColor.Yellow,
                    ),
                );
                this.drawPrompt(context);
                // Echo the buffer back
                context.terminal.write(this.inputBuffer);
                return;
            }

            // Execute query
            await this.executeQuery(line, context);
            this.drawPrompt(context);
            return;
        }

        // Printable character
        if (data.length === 1 && data >= ' ') {
            this.inputBuffer += data;
            context.terminal.write(data);
        }
    }

    onDispose(): void {
        this.context = null;
        this.source = null;
        this.inputBuffer = '';
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
        context.writer.writeln(
            context.writer.wrapInColor('Executing...', CliForegroundColor.Yellow),
        );

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
                    `  ${context.writer.wrapInColor('\\clear', CliForegroundColor.Yellow)}                          Clear screen`,
                );
                context.writer.writeln(
                    `  ${context.writer.wrapInColor('\\help', CliForegroundColor.Yellow)}                           Show this help`,
                );
                context.writer.writeln(
                    `  ${context.writer.wrapInColor('\\quit', CliForegroundColor.Yellow)}                           Exit data explorer`,
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
        context.writer.writeln(
            context.writer.wrapInColor('Fetching schema...', CliForegroundColor.Yellow),
        );

        try {
            const response = await fetch(
                `${this.serverUrl}/api/qcli/data-explorer/schema?source=${encodeURIComponent(this.source!.name)}`,
                { headers: this.serverHeaders },
            );

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
            const message =
                err instanceof Error ? err.message : String(err);
            context.writer.writeError(`Failed to fetch schema: ${message}`);
        }

        this.executing = false;
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
            }
        } else {
            // Down
            if (this.historyIndex === -1) return;
            if (this.historyIndex < this.history.length - 1) {
                this.historyIndex++;
            } else {
                this.historyIndex = -1;
                // Clear input
                this.clearInputLine(context);
                this.inputBuffer = '';
                return;
            }
        }

        this.clearInputLine(context);
        this.inputBuffer = this.history[this.historyIndex];
        context.terminal.write(this.inputBuffer);
    }

    private clearInputLine(context: ICliExecutionContext): void {
        // Move to start of input and clear
        if (this.inputBuffer.length > 0) {
            context.terminal.write(
                `${CSI}${this.inputBuffer.length}D${CSI}K`,
            );
        }
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

    private quit(context: ICliExecutionContext): void {
        context.exitFullScreenMode();
        this.context = null;
    }
}
