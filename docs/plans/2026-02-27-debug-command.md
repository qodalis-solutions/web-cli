# Debug Command Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a built-in `debug` system command that exposes CLI internals (processors, modules, services, state, environment, history, health) hidden from the `help` listing.

**Architecture:** A root `CliDebugCommandProcessor` with child subcommand processors, registered in `systemProcessors`. Uses existing service tokens to access registry, state store manager, command history, and module registry. Requires small additions to core metadata type, service container, and state store manager for introspection.

**Tech Stack:** TypeScript, Angular CLI monorepo patterns, xterm.js terminal writer API

---

### Task 1: Add `hidden` property to `CliProcessorMetadata`

**Files:**
- Modify: `projects/core/src/lib/models/index.ts:326-358`

**Step 1: Add the property**

In `CliProcessorMetadata` type (line ~326), add after the `requiredCliVersion` field:

```typescript
    /**
     * If true, the processor is hidden from the help command listing.
     * The command still works when typed directly and `help <command>` still shows its details.
     */
    hidden?: boolean;
```

**Step 2: Commit**

```bash
git add projects/core/src/lib/models/index.ts
git commit -m "feat(core): add hidden property to CliProcessorMetadata"
```

---

### Task 2: Filter hidden processors in help command

**Files:**
- Modify: `projects/cli/src/lib/processors/system/cli-help-command-processor.ts:56-78`

**Step 1: Add filter to the help listing**

In `processCommand`, at line 56 where `groupBy` is called on `registry.processors`, filter out hidden processors:

Change:
```typescript
            const groupedCommands = groupBy<ICliCommandProcessor, string>(
                registry.processors,
                (x) => x.metadata?.module || 'uncategorized',
            );
```

To:
```typescript
            const groupedCommands = groupBy<ICliCommandProcessor, string>(
                registry.processors.filter((p) => !p.metadata?.hidden),
                (x) => x.metadata?.module || 'uncategorized',
            );
```

Note: `help debug` still works because the explicit processor lookup path (line 90-101) does NOT filter by hidden.

**Step 2: Commit**

```bash
git add projects/cli/src/lib/processors/system/cli-help-command-processor.ts
git commit -m "feat(cli): filter hidden processors from help listing"
```

---

### Task 3: Add introspection to `CliServiceContainer`

**Files:**
- Modify: `projects/cli/src/lib/services/cli-service-container.ts`

**Step 1: Add `getRegisteredTokens()` method**

Add this method to the `CliServiceContainer` class, after the `set` method:

```typescript
    /**
     * Returns all registered service tokens (single + multi providers).
     */
    getRegisteredTokens(): string[] {
        const tokens: string[] = [];
        for (const key of this.services.keys()) {
            tokens.push(typeof key === 'string' ? key : (typeof key === 'function' ? key.name : String(key)));
        }
        for (const key of this.multiServices.keys()) {
            const name = typeof key === 'string' ? key : (typeof key === 'function' ? key.name : String(key));
            tokens.push(`${name} (multi)`);
        }
        return tokens;
    }
```

**Step 2: Commit**

```bash
git add projects/cli/src/lib/services/cli-service-container.ts
git commit -m "feat(cli): add getRegisteredTokens() to CliServiceContainer"
```

---

### Task 4: Add introspection to `CliStateStoreManager`

**Files:**
- Modify: `projects/cli/src/lib/state/cli-state-store-manager.ts`

**Step 1: Add `getStoreEntries()` method**

Add this method to the `CliStateStoreManager` class:

```typescript
    /**
     * Returns all store names and their current state values.
     */
    getStoreEntries(): { name: string; state: Record<string, any> }[] {
        const entries: { name: string; state: Record<string, any> }[] = [];
        this.stores.forEach((store, name) => {
            entries.push({ name, state: store.getState() });
        });
        return entries;
    }
```

**Step 2: Commit**

```bash
git add projects/cli/src/lib/state/cli-state-store-manager.ts
git commit -m "feat(cli): add getStoreEntries() to CliStateStoreManager"
```

---

### Task 5: Register `CliModuleRegistry` in the service container

**Files:**
- Modify: `projects/cli/src/lib/tokens.ts`
- Modify: `projects/cli/src/lib/engine/cli-engine.ts:134-136`

**Step 1: Add token**

In `projects/cli/src/lib/tokens.ts`, add:

```typescript
/**
 * Framework-agnostic token for the CLI module registry.
 * Used as a key in the service provider to retrieve the module registry.
 */
export const CliModuleRegistry_TOKEN = 'cli-module-registry';
```

**Step 2: Register module registry in service container**

In `projects/cli/src/lib/engine/cli-engine.ts`, after line 135 where `bootService` is created, add the module registry to the service container. Change:

```typescript
        // 4. Create boot service with registry and services
        this.bootService = new CliBoot(this.registry, services);
```

To:

```typescript
        // 4. Create boot service with registry and services
        this.bootService = new CliBoot(this.registry, services);

        // Register the module registry so debug/introspection commands can access it
        services.set([
            { provide: CliModuleRegistry_TOKEN, useValue: this.bootService.getModuleRegistry() },
        ]);
```

Import `CliModuleRegistry_TOKEN` at the top of the file (add to the existing import from `../tokens`).

**Step 3: Commit**

```bash
git add projects/cli/src/lib/tokens.ts projects/cli/src/lib/engine/cli-engine.ts
git commit -m "feat(cli): register CliModuleRegistry in service container"
```

---

### Task 6: Create the debug command processor

**Files:**
- Create: `projects/cli/src/lib/processors/system/cli-debug-command-processor.ts`

**Step 1: Create the processor file**

```typescript
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
            processCommand: async (_: CliProcessCommand, context: ICliExecutionContext) => {
                const { writer } = context;
                const registry = context.services.get<ICliCommandProcessorRegistry>(CliProcessorsRegistry_TOKEN);

                writer.writeln(writer.wrapInColor('Registered Processors:', CliForegroundColor.Yellow));
                writer.writeln();

                const rows: string[][] = [];
                for (const p of registry.processors) {
                    const childCount = this.countProcessors(p.processors || []);
                    rows.push([
                        p.command,
                        p.aliases?.join(', ') || '-',
                        p.version || '-',
                        p.metadata?.module || 'uncategorized',
                        p.metadata?.sealed ? 'yes' : 'no',
                        p.metadata?.hidden ? 'yes' : 'no',
                        String(childCount),
                        p.author?.name || '-',
                    ]);
                }

                writer.writeTable(
                    ['Command', 'Aliases', 'Version', 'Module', 'Sealed', 'Hidden', 'Children', 'Author'],
                    rows,
                );

                writer.writeln();
                writer.writeln(`Total: ${writer.wrapInColor(String(registry.processors.length), CliForegroundColor.Cyan)} root processors`);
            },
        } as ICliCommandProcessor,
        {
            command: 'modules',
            description: 'List all loaded CLI modules',
            metadata: { icon: CliIcon.Module, module: 'system' },
            processCommand: async (_: CliProcessCommand, context: ICliExecutionContext) => {
                const { writer } = context;

                let moduleRegistry: CliModuleRegistry;
                try {
                    moduleRegistry = context.services.get<CliModuleRegistry>(CliModuleRegistry_TOKEN);
                } catch {
                    writer.writeError('Module registry not available.');
                    return;
                }

                const modules = moduleRegistry.getAll();

                writer.writeln(writer.wrapInColor('Loaded Modules:', CliForegroundColor.Yellow));
                writer.writeln();

                const rows: string[][] = modules.map((m: ICliModule) => [
                    m.name,
                    m.version || '-',
                    m.description || '-',
                    String(m.processors?.length || 0),
                    m.dependencies?.join(', ') || '-',
                ]);

                writer.writeTable(
                    ['Name', 'Version', 'Description', 'Processors', 'Dependencies'],
                    rows,
                );

                writer.writeln();
                writer.writeln(`Total: ${writer.wrapInColor(String(modules.length), CliForegroundColor.Cyan)} modules`);
            },
        } as ICliCommandProcessor,
        {
            command: 'state',
            description: 'Inspect all state stores and their values',
            metadata: { icon: CliIcon.Database, module: 'system' },
            processCommand: async (_: CliProcessCommand, context: ICliExecutionContext) => {
                const { writer } = context;
                const storeManager = context.services.get<CliStateStoreManager>(CliStateStoreManager_TOKEN);

                const entries = storeManager.getStoreEntries();

                writer.writeln(writer.wrapInColor('State Stores:', CliForegroundColor.Yellow));
                writer.writeln();

                if (entries.length === 0) {
                    writer.writeln('  No state stores initialized yet.');
                } else {
                    for (const entry of entries) {
                        writer.writeln(`  ${writer.wrapInColor(entry.name, CliForegroundColor.Cyan)}:`);
                        writer.writeJson(entry.state);
                        writer.writeln();
                    }
                }

                writer.writeln(`Total: ${writer.wrapInColor(String(entries.length), CliForegroundColor.Cyan)} stores`);
            },
        } as ICliCommandProcessor,
        {
            command: 'services',
            description: 'List all registered services in the DI container',
            metadata: { icon: CliIcon.Gear, module: 'system' },
            processCommand: async (_: CliProcessCommand, context: ICliExecutionContext) => {
                const { writer } = context;

                const container = context.services as CliServiceContainer;
                if (!container.getRegisteredTokens) {
                    writer.writeError('Service introspection not available.');
                    return;
                }

                const tokens = container.getRegisteredTokens();

                writer.writeln(writer.wrapInColor('Registered Services:', CliForegroundColor.Yellow));
                writer.writeln();

                for (const token of tokens) {
                    writer.writeln(`  ${writer.wrapInColor(CliIcon.Dot, CliForegroundColor.Green)} ${token}`);
                }

                writer.writeln();
                writer.writeln(`Total: ${writer.wrapInColor(String(tokens.length), CliForegroundColor.Cyan)} services`);
            },
        } as ICliCommandProcessor,
        {
            command: 'environment',
            description: 'Show browser, terminal, and framework information',
            metadata: { icon: CliIcon.Network, module: 'system' },
            processCommand: async (_: CliProcessCommand, context: ICliExecutionContext) => {
                const { writer } = context;

                writer.writeln(writer.wrapInColor('Environment:', CliForegroundColor.Yellow));
                writer.writeln();

                // CLI versions
                writer.writeln(`  ${writer.wrapInColor('Core Version:', CliForegroundColor.Cyan)} ${CORE_VERSION}`);
                writer.writeln(`  ${writer.wrapInColor('CLI Version:', CliForegroundColor.Cyan)} ${CLI_VERSION}`);

                // Framework
                let framework = 'vanilla';
                try {
                    framework = context.services.get<string>('cli-framework');
                } catch {
                    // standalone usage
                }
                writer.writeln(`  ${writer.wrapInColor('Framework:', CliForegroundColor.Cyan)} ${framework}`);

                // Terminal
                writer.writeln(`  ${writer.wrapInColor('Terminal Cols:', CliForegroundColor.Cyan)} ${context.terminal.cols}`);
                writer.writeln(`  ${writer.wrapInColor('Terminal Rows:', CliForegroundColor.Cyan)} ${context.terminal.rows}`);

                // Log level
                writer.writeln(`  ${writer.wrapInColor('Log Level:', CliForegroundColor.Cyan)} ${context.options?.logLevel ?? 'default'}`);

                // Browser
                writer.writeln();
                if (typeof navigator !== 'undefined') {
                    writer.writeln(`  ${writer.wrapInColor('User Agent:', CliForegroundColor.Cyan)} ${navigator.userAgent}`);
                    writer.writeln(`  ${writer.wrapInColor('Language:', CliForegroundColor.Cyan)} ${navigator.language}`);
                    writer.writeln(`  ${writer.wrapInColor('Platform:', CliForegroundColor.Cyan)} ${navigator.platform}`);
                    writer.writeln(`  ${writer.wrapInColor('Online:', CliForegroundColor.Cyan)} ${navigator.onLine}`);
                    writer.writeln(`  ${writer.wrapInColor('Cookies Enabled:', CliForegroundColor.Cyan)} ${navigator.cookieEnabled}`);
                } else {
                    writer.writeln('  Browser information not available.');
                }
            },
        } as ICliCommandProcessor,
        {
            command: 'history',
            description: 'Show command history statistics',
            metadata: { icon: CliIcon.Logs, module: 'system' },
            processCommand: async (_: CliProcessCommand, context: ICliExecutionContext) => {
                const { writer } = context;
                const history = context.services.get<CliCommandHistory>(CliCommandHistory_TOKEN);

                const commands = history.getHistory();
                const total = commands.length;

                writer.writeln(writer.wrapInColor('Command History Stats:', CliForegroundColor.Yellow));
                writer.writeln();
                writer.writeln(`  ${writer.wrapInColor('Total Commands:', CliForegroundColor.Cyan)} ${total}`);

                if (total > 0) {
                    // Unique commands
                    const unique = new Set(commands.map(c => c.split(' ')[0]));
                    writer.writeln(`  ${writer.wrapInColor('Unique Commands:', CliForegroundColor.Cyan)} ${unique.size}`);

                    // Frequency
                    const freq = new Map<string, number>();
                    for (const cmd of commands) {
                        const root = cmd.split(' ')[0];
                        freq.set(root, (freq.get(root) || 0) + 1);
                    }
                    const sorted = Array.from(freq.entries()).sort((a, b) => b[1] - a[1]);
                    const top = sorted.slice(0, 10);

                    writer.writeln();
                    writer.writeln(writer.wrapInColor('  Most Used:', CliForegroundColor.Yellow));
                    writer.writeTable(
                        ['Command', 'Count'],
                        top.map(([cmd, count]) => [cmd, String(count)]),
                    );

                    // Last 10 commands
                    writer.writeln();
                    writer.writeln(writer.wrapInColor('  Recent Commands:', CliForegroundColor.Yellow));
                    const recent = commands.slice(-10);
                    for (let i = recent.length - 1; i >= 0; i--) {
                        writer.writeln(`    ${writer.wrapInColor(String(commands.length - (recent.length - 1 - i)), CliForegroundColor.Green)} ${recent[i]}`);
                    }
                }
            },
        } as ICliCommandProcessor,
        {
            command: 'health',
            description: 'Check system health: storage, connectivity, processor status',
            metadata: { icon: CliIcon.Heart, module: 'system' },
            processCommand: async (_: CliProcessCommand, context: ICliExecutionContext) => {
                const { writer } = context;

                writer.writeln(writer.wrapInColor('Health Check:', CliForegroundColor.Yellow));
                writer.writeln();

                // IndexedDB
                const indexedDBAvailable = typeof indexedDB !== 'undefined';
                writer.writeln(`  ${indexedDBAvailable ? CliIcon.CheckIcon : CliIcon.CrossIcon} IndexedDB: ${indexedDBAvailable ? 'available' : 'unavailable'}`);

                // localStorage
                let localStorageAvailable = false;
                try {
                    localStorage.setItem('__cli_health_test', '1');
                    localStorage.removeItem('__cli_health_test');
                    localStorageAvailable = true;
                } catch {
                    // not available
                }
                writer.writeln(`  ${localStorageAvailable ? CliIcon.CheckIcon : CliIcon.CrossIcon} localStorage: ${localStorageAvailable ? 'available' : 'unavailable'}`);

                // Online status
                const online = typeof navigator !== 'undefined' ? navigator.onLine : false;
                writer.writeln(`  ${online ? CliIcon.CheckIcon : CliIcon.CrossIcon} Network: ${online ? 'online' : 'offline'}`);

                // Processor count
                const registry = context.services.get<ICliCommandProcessorRegistry>(CliProcessorsRegistry_TOKEN);
                writer.writeln(`  ${CliIcon.CheckIcon} Processors: ${registry.processors.length} loaded`);

                // Module count
                try {
                    const moduleRegistry = context.services.get<CliModuleRegistry>(CliModuleRegistry_TOKEN);
                    const modules = moduleRegistry.getAll();
                    writer.writeln(`  ${CliIcon.CheckIcon} Modules: ${modules.length} loaded`);
                } catch {
                    writer.writeln(`  ${CliIcon.WarningIcon} Modules: registry not available`);
                }

                // History
                const history = context.services.get<CliCommandHistory>(CliCommandHistory_TOKEN);
                writer.writeln(`  ${CliIcon.CheckIcon} History: ${history.getHistory().length} commands stored`);
            },
        } as ICliCommandProcessor,
        {
            command: 'export',
            description: 'Export all debug info as JSON',
            metadata: { icon: CliIcon.Save, module: 'system' },
            processCommand: async (_: CliProcessCommand, context: ICliExecutionContext) => {
                const { writer } = context;
                const registry = context.services.get<ICliCommandProcessorRegistry>(CliProcessorsRegistry_TOKEN);
                const history = context.services.get<CliCommandHistory>(CliCommandHistory_TOKEN);
                const storeManager = context.services.get<CliStateStoreManager>(CliStateStoreManager_TOKEN);

                const report: Record<string, any> = {
                    versions: {
                        core: CORE_VERSION,
                        cli: CLI_VERSION,
                    },
                    environment: {
                        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A',
                        language: typeof navigator !== 'undefined' ? navigator.language : 'N/A',
                        platform: typeof navigator !== 'undefined' ? navigator.platform : 'N/A',
                        online: typeof navigator !== 'undefined' ? navigator.onLine : false,
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
                        children: (p.processors || []).length,
                    })),
                    history: {
                        total: history.getHistory().length,
                    },
                    state: storeManager.getStoreEntries(),
                };

                // Modules
                try {
                    const moduleRegistry = context.services.get<CliModuleRegistry>(CliModuleRegistry_TOKEN);
                    report.modules = moduleRegistry.getAll().map((m: ICliModule) => ({
                        name: m.name,
                        version: m.version || null,
                        description: m.description || null,
                        processors: m.processors?.length || 0,
                        dependencies: m.dependencies || [],
                    }));
                } catch {
                    report.modules = 'registry not available';
                }

                // Services
                const container = context.services as CliServiceContainer;
                if (container.getRegisteredTokens) {
                    report.services = container.getRegisteredTokens();
                }

                writer.writeJson(report);
            },
        } as ICliCommandProcessor,
    ];

    async processCommand(
        _: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const { writer } = context;
        const registry = context.services.get<ICliCommandProcessorRegistry>(CliProcessorsRegistry_TOKEN);

        // Summary view
        writer.writeln(writer.wrapInColor(`${CliIcon.Bug}  CLI Debug Info`, CliForegroundColor.Yellow));
        writer.writeDivider({ char: '=' });

        writer.writeln(`  ${writer.wrapInColor('Core Version:', CliForegroundColor.Cyan)} ${CORE_VERSION}`);
        writer.writeln(`  ${writer.wrapInColor('CLI Version:', CliForegroundColor.Cyan)} ${CLI_VERSION}`);

        let framework = 'vanilla';
        try {
            framework = context.services.get<string>('cli-framework');
        } catch {
            // standalone
        }
        writer.writeln(`  ${writer.wrapInColor('Framework:', CliForegroundColor.Cyan)} ${framework}`);
        writer.writeln(`  ${writer.wrapInColor('Terminal:', CliForegroundColor.Cyan)} ${context.terminal.cols}x${context.terminal.rows}`);
        writer.writeln(`  ${writer.wrapInColor('Processors:', CliForegroundColor.Cyan)} ${registry.processors.length}`);

        try {
            const moduleRegistry = context.services.get<CliModuleRegistry>(CliModuleRegistry_TOKEN);
            writer.writeln(`  ${writer.wrapInColor('Modules:', CliForegroundColor.Cyan)} ${moduleRegistry.getAll().length}`);
        } catch {
            // skip
        }

        const history = context.services.get<CliCommandHistory>(CliCommandHistory_TOKEN);
        writer.writeln(`  ${writer.wrapInColor('History:', CliForegroundColor.Cyan)} ${history.getHistory().length} commands`);

        writer.writeDivider({ char: '=' });
        writer.writeln();
        writer.writeln(`${CliIcon.Light} Subcommands:`);
        for (const sub of this.processors || []) {
            writer.writeln(`  ${writer.wrapInColor(`debug ${sub.command}`, CliForegroundColor.Cyan)}  ${sub.description}`);
        }
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer } = context;
        writer.writeln('Displays detailed system diagnostics and CLI internals.');
        writer.writeln('This command is hidden from the help listing but accessible directly.');
        writer.writeln();
        writer.writeln('📋 Usage:');
        writer.writeln(`  ${writer.wrapInColor('debug', CliForegroundColor.Cyan)}                  System summary`);
        writer.writeln(`  ${writer.wrapInColor('debug processors', CliForegroundColor.Cyan)}       All registered processors`);
        writer.writeln(`  ${writer.wrapInColor('debug modules', CliForegroundColor.Cyan)}          All loaded modules`);
        writer.writeln(`  ${writer.wrapInColor('debug state', CliForegroundColor.Cyan)}            Inspect state stores`);
        writer.writeln(`  ${writer.wrapInColor('debug services', CliForegroundColor.Cyan)}         List DI services`);
        writer.writeln(`  ${writer.wrapInColor('debug environment', CliForegroundColor.Cyan)}      Browser/terminal info`);
        writer.writeln(`  ${writer.wrapInColor('debug history', CliForegroundColor.Cyan)}          Command history stats`);
        writer.writeln(`  ${writer.wrapInColor('debug health', CliForegroundColor.Cyan)}           System health check`);
        writer.writeln(`  ${writer.wrapInColor('debug export', CliForegroundColor.Cyan)}           Export all as JSON`);
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
```

**Step 2: Commit**

```bash
git add projects/cli/src/lib/processors/system/cli-debug-command-processor.ts
git commit -m "feat(cli): add debug command processor with all subcommands"
```

---

### Task 7: Register the debug processor in `systemProcessors`

**Files:**
- Modify: `projects/cli/src/lib/processors/system/index.ts`

**Step 1: Import and add to array**

Add import at the top:

```typescript
import { CliDebugCommandProcessor } from './cli-debug-command-processor';
```

Add export:

```typescript
export { CliDebugCommandProcessor } from './cli-debug-command-processor';
```

Add to `systemProcessors` array:

```typescript
export const systemProcessors: ICliCommandProcessor[] = [
    new CliHelpCommandProcessor(),
    new CliVersionCommandProcessor(),
    new CliFeedbackCommandProcessor(),
    new CliHistoryCommandProcessor(),
    new CliPackagesCommandProcessor(),
    new CliHotKeysCommandProcessor(),
    new CliDebugCommandProcessor(),
];
```

**Step 2: Commit**

```bash
git add projects/cli/src/lib/processors/system/index.ts
git commit -m "feat(cli): register debug processor in systemProcessors"
```

---

### Task 8: Build and verify

**Step 1: Build core library**

```bash
npm run "build core"
```

Expected: Build succeeds with no errors.

**Step 2: Build CLI library**

```bash
npm run "build cli"
```

Expected: Build succeeds with no errors.

**Step 3: Build all**

```bash
npm run "build all"
```

Expected: All libraries build successfully.

**Step 4: Commit build artifacts if any version files changed**

No commit needed — build artifacts are in `dist/` which is gitignored.

---

### Task 9: Manual verification with demo app

**Step 1: Start the demo app**

```bash
npm run "start demo"
```

**Step 2: Verify in terminal**

- Type `help` — verify `debug` does NOT appear in the listing
- Type `debug` — verify it shows system summary with subcommand list
- Type `debug processors` — verify it shows table of all processors
- Type `debug modules` — verify it shows loaded modules
- Type `debug services` — verify it lists DI tokens
- Type `debug environment` — verify browser/terminal info
- Type `debug history` — verify history stats
- Type `debug health` — verify health checks
- Type `debug export` — verify JSON output
- Type `help debug` — verify it shows the command's help page

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat(cli): add debug command for system diagnostics

Adds a hidden 'debug' system command that exposes CLI internals:
- processors: lists all registered command processors
- modules: lists all loaded CLI modules
- state: inspects state stores and values
- services: lists DI container registrations
- environment: browser, terminal, and framework info
- history: command usage statistics
- health: storage, connectivity, and system checks
- export: full JSON dump for bug reports

Hidden from help listing via new 'hidden' metadata property."
```
