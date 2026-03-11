import {
    CliForegroundColor,
    CliIcon,
    CliProcessCommand,
    CliProcessorMetadata,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliCommandProcessorRegistry,
    ICliExecutionContext,
    ICliModule,
    CliModuleRegistry,
    LIBRARY_VERSION as CORE_VERSION,
} from '@qodalis/cli-core';
import { LIBRARY_VERSION as CLI_VERSION } from '../../version';
import {
    CliCommandHistory_TOKEN,
    CliModuleRegistry_TOKEN,
    CliProcessorsRegistry_TOKEN,
    CliStateStoreManager_TOKEN,
} from '../../tokens';
import { CliCommandHistory } from '../../services/cli-command-history';
import { CliStateStoreManager } from '../../state/cli-state-store-manager';
import { CliServiceContainer } from '../../services/cli-service-container';
import {
    CliServerManager,
    CliServerManager_TOKEN,
} from '../../server/cli-server-manager';
import { isWasmAccelerated } from '../../wasm';

export class CliDebugCommandProcessor implements ICliCommandProcessor {
    command = 'debug';

    description = 'Displays detailed system diagnostics and CLI internals';

    author = DefaultLibraryAuthor;

    metadata?: CliProcessorMetadata = {
        sealed: true,
        icon: CliIcon.Bug,
        module: 'system',
        hidden: true,
    };

    processors?: ICliCommandProcessor[] = [
        {
            command: 'processors',
            description: 'List all registered command processors',
            metadata: { icon: CliIcon.Extension, module: 'system' },
            processCommand: async (
                _: CliProcessCommand,
                context: ICliExecutionContext,
            ) => {
                const { writer } = context;
                const registry =
                    context.services.get<ICliCommandProcessorRegistry>(
                        CliProcessorsRegistry_TOKEN,
                    );

                writer.writeln(
                    writer.wrapInColor(
                        'Registered Processors:',
                        CliForegroundColor.Yellow,
                    ),
                );
                writer.writeln();

                const rows: string[][] = [];
                for (const p of registry.processors) {
                    // Arrow function captures `this` from class instance for countProcessors()
                    const childCount = this.countProcessors(p.processors || []);
                    rows.push([
                        p.command,
                        p.aliases?.join(', ') || '-',
                        p.version || '-',
                        p.metadata?.module || 'uncategorized',
                        p.metadata?.sealed ? 'yes' : 'no',
                        p.metadata?.hidden ? 'yes' : 'no',
                        String(childCount),
                        p.originalProcessor?.metadata?.module || '-',
                        p.author?.name || '-',
                    ]);
                }

                writer.writeTable(
                    [
                        'Command',
                        'Aliases',
                        'Version',
                        'Module',
                        'Sealed',
                        'Hidden',
                        'Children',
                        'Extends',
                        'Author',
                    ],
                    rows,
                );

                writer.writeln();
                writer.writeln(
                    `Total: ${writer.wrapInColor(String(registry.processors.length), CliForegroundColor.Cyan)} root processors`,
                );
            },
        } as ICliCommandProcessor,
        {
            command: 'modules',
            description: 'List all loaded CLI modules',
            metadata: { icon: CliIcon.Module, module: 'system' },
            processCommand: async (
                _: CliProcessCommand,
                context: ICliExecutionContext,
            ) => {
                const { writer } = context;

                let moduleRegistry: CliModuleRegistry;
                try {
                    moduleRegistry = context.services.get<CliModuleRegistry>(
                        CliModuleRegistry_TOKEN,
                    );
                } catch {
                    writer.writeError('Module registry not available.');
                    return;
                }

                const modules = moduleRegistry.getAll();

                writer.writeln(
                    writer.wrapInColor(
                        'Loaded Modules:',
                        CliForegroundColor.Yellow,
                    ),
                );
                writer.writeln();

                const rows: string[][] = modules.map((m: ICliModule) => [
                    m.name,
                    m.version || '-',
                    m.description || '-',
                    String(m.processors?.length || 0),
                    m.dependencies?.join(', ') || '-',
                ]);

                writer.writeTable(
                    [
                        'Name',
                        'Version',
                        'Description',
                        'Processors',
                        'Dependencies',
                    ],
                    rows,
                );

                writer.writeln();
                writer.writeln(
                    `Total: ${writer.wrapInColor(String(modules.length), CliForegroundColor.Cyan)} modules`,
                );
            },
        } as ICliCommandProcessor,
        {
            command: 'state',
            description: 'Inspect all state stores and their values',
            metadata: { icon: CliIcon.Database, module: 'system' },
            processCommand: async (
                _: CliProcessCommand,
                context: ICliExecutionContext,
            ) => {
                const { writer } = context;
                const storeManager = context.services.get<CliStateStoreManager>(
                    CliStateStoreManager_TOKEN,
                );

                const entries = storeManager.getStoreEntries();

                writer.writeln(
                    writer.wrapInColor(
                        'State Stores:',
                        CliForegroundColor.Yellow,
                    ),
                );
                writer.writeln();

                if (entries.length === 0) {
                    writer.writeln('  No state stores initialized yet.');
                } else {
                    for (const entry of entries) {
                        writer.writeln(
                            `  ${writer.wrapInColor(entry.name, CliForegroundColor.Cyan)}:`,
                        );
                        writer.writeJson(entry.state);
                        writer.writeln();
                    }
                }

                writer.writeln(
                    `Total: ${writer.wrapInColor(String(entries.length), CliForegroundColor.Cyan)} stores`,
                );
            },
        } as ICliCommandProcessor,
        {
            command: 'services',
            description: 'List all registered services in the DI container',
            metadata: { icon: CliIcon.Gear, module: 'system' },
            processCommand: async (
                _: CliProcessCommand,
                context: ICliExecutionContext,
            ) => {
                const { writer } = context;

                const container = context.services as CliServiceContainer;
                if (!container.getRegisteredServiceDetails) {
                    writer.writeError('Service introspection not available.');
                    return;
                }

                const details = container.getRegisteredServiceDetails();

                writer.writeln(
                    writer.wrapInColor(
                        'Registered Services:',
                        CliForegroundColor.Yellow,
                    ),
                );
                writer.writeln();

                writer.writeTable(
                    ['Token', 'Type', 'Multi'],
                    details.map((d) => [
                        d.token,
                        d.type,
                        d.multi ? 'yes' : 'no',
                    ]),
                );

                writer.writeln();
                writer.writeln(
                    `Total: ${writer.wrapInColor(String(details.length), CliForegroundColor.Cyan)} services`,
                );
            },
        } as ICliCommandProcessor,
        {
            command: 'environment',
            description: 'Show browser, terminal, and framework information',
            metadata: { icon: CliIcon.Network, module: 'system' },
            processCommand: async (
                _: CliProcessCommand,
                context: ICliExecutionContext,
            ) => {
                const { writer } = context;

                writer.writeln(
                    writer.wrapInColor(
                        'Environment:',
                        CliForegroundColor.Yellow,
                    ),
                );
                writer.writeln();

                writer.writeln(
                    `  ${writer.wrapInColor('Core Version:', CliForegroundColor.Cyan)} ${CORE_VERSION}`,
                );
                writer.writeln(
                    `  ${writer.wrapInColor('CLI Version:', CliForegroundColor.Cyan)} ${CLI_VERSION}`,
                );

                let framework = 'vanilla';
                try {
                    framework = context.services.get<string>('cli-framework');
                } catch {
                    // standalone usage
                }
                writer.writeln(
                    `  ${writer.wrapInColor('Framework:', CliForegroundColor.Cyan)} ${framework}`,
                );

                writer.writeln(
                    `  ${writer.wrapInColor('Terminal Cols:', CliForegroundColor.Cyan)} ${context.terminal.cols}`,
                );
                writer.writeln(
                    `  ${writer.wrapInColor('Terminal Rows:', CliForegroundColor.Cyan)} ${context.terminal.rows}`,
                );

                writer.writeln(
                    `  ${writer.wrapInColor('Log Level:', CliForegroundColor.Cyan)} ${context.options?.logLevel ?? 'default'}`,
                );

                writer.writeln();
                if (typeof navigator !== 'undefined') {
                    writer.writeln(
                        `  ${writer.wrapInColor('User Agent:', CliForegroundColor.Cyan)} ${navigator.userAgent}`,
                    );
                    writer.writeln(
                        `  ${writer.wrapInColor('Language:', CliForegroundColor.Cyan)} ${navigator.language}`,
                    );
                    writer.writeln(
                        `  ${writer.wrapInColor('Platform:', CliForegroundColor.Cyan)} ${navigator.platform}`,
                    );
                    writer.writeln(
                        `  ${writer.wrapInColor('Online:', CliForegroundColor.Cyan)} ${navigator.onLine}`,
                    );
                    writer.writeln(
                        `  ${writer.wrapInColor('Cookies Enabled:', CliForegroundColor.Cyan)} ${navigator.cookieEnabled}`,
                    );
                } else {
                    writer.writeln('  Browser information not available.');
                }
            },
        } as ICliCommandProcessor,
        {
            command: 'history',
            description: 'Show command history statistics',
            metadata: { icon: CliIcon.Logs, module: 'system' },
            processCommand: async (
                _: CliProcessCommand,
                context: ICliExecutionContext,
            ) => {
                const { writer } = context;
                const history = context.services.get<CliCommandHistory>(
                    CliCommandHistory_TOKEN,
                );

                const commands = history.getHistory();
                const total = commands.length;

                writer.writeln(
                    writer.wrapInColor(
                        'Command History Stats:',
                        CliForegroundColor.Yellow,
                    ),
                );
                writer.writeln();
                writer.writeln(
                    `  ${writer.wrapInColor('Total Commands:', CliForegroundColor.Cyan)} ${total}`,
                );

                if (total > 0) {
                    const unique = new Set(
                        commands.map((c) => c.split(' ')[0]),
                    );
                    writer.writeln(
                        `  ${writer.wrapInColor('Unique Commands:', CliForegroundColor.Cyan)} ${unique.size}`,
                    );

                    const freq = new Map<string, number>();
                    for (const cmd of commands) {
                        const root = cmd.split(' ')[0];
                        freq.set(root, (freq.get(root) || 0) + 1);
                    }
                    const sorted = Array.from(freq.entries()).sort(
                        (a, b) => b[1] - a[1],
                    );
                    const top = sorted.slice(0, 10);

                    writer.writeln();
                    writer.writeln(
                        writer.wrapInColor(
                            '  Most Used:',
                            CliForegroundColor.Yellow,
                        ),
                    );
                    writer.writeTable(
                        ['Command', 'Count'],
                        top.map(([cmd, count]) => [cmd, String(count)]),
                    );

                    writer.writeln();
                    writer.writeln(
                        writer.wrapInColor(
                            '  Recent Commands:',
                            CliForegroundColor.Yellow,
                        ),
                    );
                    const recent = commands.slice(-10);
                    for (let i = recent.length - 1; i >= 0; i--) {
                        writer.writeln(
                            `    ${writer.wrapInColor(String(commands.length - (recent.length - 1 - i)), CliForegroundColor.Green)} ${recent[i]}`,
                        );
                    }
                }
            },
        } as ICliCommandProcessor,
        {
            command: 'health',
            description:
                'Check system health: storage, connectivity, processor status',
            metadata: { icon: CliIcon.Heart, module: 'system' },
            processCommand: async (
                _: CliProcessCommand,
                context: ICliExecutionContext,
            ) => {
                const { writer } = context;

                writer.writeln(
                    writer.wrapInColor(
                        'Health Check:',
                        CliForegroundColor.Yellow,
                    ),
                );
                writer.writeln();

                const indexedDBAvailable = typeof indexedDB !== 'undefined';
                writer.writeln(
                    `  ${indexedDBAvailable ? CliIcon.CheckIcon : CliIcon.CrossIcon} IndexedDB: ${indexedDBAvailable ? 'available' : 'unavailable'}`,
                );

                let localStorageAvailable = false;
                try {
                    localStorage.setItem('__cli_health_test', '1');
                    localStorage.removeItem('__cli_health_test');
                    localStorageAvailable = true;
                } catch {
                    // not available
                }
                writer.writeln(
                    `  ${localStorageAvailable ? CliIcon.CheckIcon : CliIcon.CrossIcon} localStorage: ${localStorageAvailable ? 'available' : 'unavailable'}`,
                );

                const online =
                    typeof navigator !== 'undefined' ? navigator.onLine : false;
                writer.writeln(
                    `  ${online ? CliIcon.CheckIcon : CliIcon.CrossIcon} Network: ${online ? 'online' : 'offline'}`,
                );

                const registry =
                    context.services.get<ICliCommandProcessorRegistry>(
                        CliProcessorsRegistry_TOKEN,
                    );
                writer.writeln(
                    `  ${CliIcon.CheckIcon} Processors: ${registry.processors.length} loaded`,
                );

                try {
                    const moduleRegistry =
                        context.services.get<CliModuleRegistry>(
                            CliModuleRegistry_TOKEN,
                        );
                    const modules = moduleRegistry.getAll();
                    writer.writeln(
                        `  ${CliIcon.CheckIcon} Modules: ${modules.length} loaded`,
                    );
                } catch {
                    writer.writeln(
                        `  ${CliIcon.WarningIcon} Modules: registry not available`,
                    );
                }

                const wasmActive = isWasmAccelerated();
                writer.writeln(
                    `  ${wasmActive ? CliIcon.CheckIcon : CliIcon.WarningIcon} WASM Accelerator: ${wasmActive ? 'loaded' : 'using JS fallback'}`,
                );

                const historyService = context.services.get<CliCommandHistory>(
                    CliCommandHistory_TOKEN,
                );
                writer.writeln(
                    `  ${CliIcon.CheckIcon} History: ${historyService.getHistory().length} commands stored`,
                );
            },
        } as ICliCommandProcessor,
        {
            command: 'export',
            description: 'Export all debug info as JSON',
            metadata: { icon: CliIcon.Save, module: 'system' },
            processCommand: async (
                _: CliProcessCommand,
                context: ICliExecutionContext,
            ) => {
                const { writer } = context;
                const registry =
                    context.services.get<ICliCommandProcessorRegistry>(
                        CliProcessorsRegistry_TOKEN,
                    );
                const history = context.services.get<CliCommandHistory>(
                    CliCommandHistory_TOKEN,
                );
                const storeManager = context.services.get<CliStateStoreManager>(
                    CliStateStoreManager_TOKEN,
                );

                const report: Record<string, any> = {
                    versions: {
                        core: CORE_VERSION,
                        cli: CLI_VERSION,
                    },
                    wasmAccelerated: isWasmAccelerated(),
                    environment: {
                        userAgent:
                            typeof navigator !== 'undefined'
                                ? navigator.userAgent
                                : 'N/A',
                        language:
                            typeof navigator !== 'undefined'
                                ? navigator.language
                                : 'N/A',
                        platform:
                            typeof navigator !== 'undefined'
                                ? navigator.platform
                                : 'N/A',
                        online:
                            typeof navigator !== 'undefined'
                                ? navigator.onLine
                                : false,
                        terminalCols: context.terminal.cols,
                        terminalRows: context.terminal.rows,
                    },
                    processors: registry.processors.map((p) => ({
                        command: p.command,
                        aliases: p.aliases || [],
                        version: p.version || null,
                        module: p.metadata?.module || 'uncategorized',
                        sealed: p.metadata?.sealed || false,
                        hidden: p.metadata?.hidden || false,
                        children: this.countProcessors(p.processors || []),
                        extends: p.originalProcessor?.metadata?.module || null,
                    })),
                    history: {
                        total: history.getHistory().length,
                    },
                    state: storeManager.getStoreEntries(),
                };

                try {
                    const moduleRegistry =
                        context.services.get<CliModuleRegistry>(
                            CliModuleRegistry_TOKEN,
                        );
                    report['modules'] = moduleRegistry
                        .getAll()
                        .map((m: ICliModule) => ({
                            name: m.name,
                            version: m.version || null,
                            description: m.description || null,
                            processors: m.processors?.length || 0,
                            dependencies: m.dependencies || [],
                        }));
                } catch {
                    report['modules'] = 'registry not available';
                }

                const container = context.services as CliServiceContainer;
                if (container.getRegisteredTokens) {
                    report['services'] = container.getRegisteredTokens();
                }

                try {
                    const serverManager =
                        context.services.get<CliServerManager>(
                            CliServerManager_TOKEN,
                        );
                    if (serverManager && serverManager.connections.size > 0) {
                        report['servers'] = Array.from(
                            serverManager.connections.entries(),
                        ).map(([name, conn]) => ({
                            name,
                            url: conn.config.url,
                            connected: conn.connected,
                            commands: conn.connected ? conn.commands.length : 0,
                        }));
                    }
                } catch {
                    // skip
                }

                writer.writeJson(report);
            },
        } as ICliCommandProcessor,
        {
            command: 'servers',
            description: 'List configured servers and their connection status',
            metadata: { icon: CliIcon.Server, module: 'system' },
            processCommand: async (
                _: CliProcessCommand,
                context: ICliExecutionContext,
            ) => {
                const { writer } = context;

                let manager: CliServerManager | undefined;
                try {
                    manager = context.services.get<CliServerManager>(
                        CliServerManager_TOKEN,
                    );
                } catch {
                    // not available
                }

                if (!manager || manager.connections.size === 0) {
                    writer.writeInfo('No servers configured.');
                    return;
                }

                writer.writeln(
                    writer.wrapInColor(
                        'Configured Servers:',
                        CliForegroundColor.Yellow,
                    ),
                );
                writer.writeln();

                const rows: string[][] = [];
                for (const [name, connection] of manager.connections) {
                    rows.push([
                        name,
                        connection.config.url,
                        connection.connected ? 'Connected' : 'Disconnected',
                        connection.connected
                            ? String(connection.commands.length)
                            : '-',
                        connection.config.timeout
                            ? `${connection.config.timeout}ms`
                            : 'default',
                    ]);
                }

                writer.writeTable(
                    ['Name', 'URL', 'Status', 'Commands', 'Timeout'],
                    rows,
                );

                writer.writeln();

                const connected = Array.from(
                    manager.connections.values(),
                ).filter((c) => c.connected).length;
                const total = manager.connections.size;
                writer.writeln(
                    `Total: ${writer.wrapInColor(String(total), CliForegroundColor.Cyan)} servers (${writer.wrapInColor(String(connected), CliForegroundColor.Green)} connected)`,
                );
            },
        } as ICliCommandProcessor,
    ];

    async processCommand(
        _: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const { writer } = context;
        const registry = context.services.get<ICliCommandProcessorRegistry>(
            CliProcessorsRegistry_TOKEN,
        );

        writer.writeln(
            writer.wrapInColor(
                `${CliIcon.Bug}  CLI Debug Info`,
                CliForegroundColor.Yellow,
            ),
        );
        writer.writeDivider({ char: '=' });

        writer.writeln(
            `  ${writer.wrapInColor('Core Version:', CliForegroundColor.Cyan)} ${CORE_VERSION}`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('CLI Version:', CliForegroundColor.Cyan)} ${CLI_VERSION}`,
        );

        let framework = 'vanilla';
        try {
            framework = context.services.get<string>('cli-framework');
        } catch {
            // standalone
        }
        writer.writeln(
            `  ${writer.wrapInColor('Framework:', CliForegroundColor.Cyan)} ${framework}`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('Terminal:', CliForegroundColor.Cyan)} ${context.terminal.cols}x${context.terminal.rows}`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('Processors:', CliForegroundColor.Cyan)} ${registry.processors.length}`,
        );

        try {
            const moduleRegistry = context.services.get<CliModuleRegistry>(
                CliModuleRegistry_TOKEN,
            );
            writer.writeln(
                `  ${writer.wrapInColor('Modules:', CliForegroundColor.Cyan)} ${moduleRegistry.getAll().length}`,
            );
        } catch {
            // skip
        }

        try {
            const serverManager = context.services.get<CliServerManager>(
                CliServerManager_TOKEN,
            );
            if (serverManager && serverManager.connections.size > 0) {
                const connected = Array.from(
                    serverManager.connections.values(),
                ).filter((c) => c.connected).length;
                writer.writeln(
                    `  ${writer.wrapInColor('Servers:', CliForegroundColor.Cyan)} ${connected}/${serverManager.connections.size} connected`,
                );
            }
        } catch {
            // skip
        }

        const history = context.services.get<CliCommandHistory>(
            CliCommandHistory_TOKEN,
        );
        writer.writeln(
            `  ${writer.wrapInColor('History:', CliForegroundColor.Cyan)} ${history.getHistory().length} commands`,
        );

        const wasmStatus = isWasmAccelerated() ? 'active' : 'inactive (JS fallback)';
        writer.writeln(
            `  ${writer.wrapInColor('WASM Accelerator:', CliForegroundColor.Cyan)} ${wasmStatus}`,
        );

        writer.writeDivider({ char: '=' });
        writer.writeln();
        writer.writeln(`${CliIcon.Light} Subcommands:`);
        for (const sub of this.processors || []) {
            writer.writeln(
                `  ${writer.wrapInColor(`debug ${sub.command}`, CliForegroundColor.Cyan)}  ${sub.description}`,
            );
        }
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer, translator: t } = context;
        writer.writeln(
            t.t('cli.debug.long_description', 'Displays detailed system diagnostics and CLI internals.'),
        );
        writer.writeln(
            t.t('cli.debug.hidden_note', 'This command is hidden from the help listing but accessible directly.'),
        );
        writer.writeln();
        writer.writeln(t.t('cli.common.usage', 'Usage:'));
        writer.writeln(
            `  ${writer.wrapInColor('debug', CliForegroundColor.Cyan)}                  ${t.t('cli.debug.summary', 'System summary')}`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('debug processors', CliForegroundColor.Cyan)}       ${t.t('cli.debug.processors', 'All registered processors')}`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('debug modules', CliForegroundColor.Cyan)}          ${t.t('cli.debug.modules', 'All loaded modules')}`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('debug state', CliForegroundColor.Cyan)}            ${t.t('cli.debug.state', 'Inspect state stores')}`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('debug services', CliForegroundColor.Cyan)}         List DI services`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('debug environment', CliForegroundColor.Cyan)}      Browser/terminal info`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('debug history', CliForegroundColor.Cyan)}          Command history stats`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('debug health', CliForegroundColor.Cyan)}           System health check`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('debug export', CliForegroundColor.Cyan)}           Export all as JSON`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('debug servers', CliForegroundColor.Cyan)}          Server connections`,
        );
    }

    private countProcessors(processors: ICliCommandProcessor[]): number {
        let count = processors.length;
        for (const p of processors) {
            if (p.processors) {
                count += this.countProcessors(p.processors);
            }
        }
        return count;
    }
}
