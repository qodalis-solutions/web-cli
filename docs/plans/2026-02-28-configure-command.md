# Configure Command Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a unified `configure` command with interactive category-based menu and non-interactive get/set/list/reset subcommands. Plugins opt in by declaring `configurationOptions` on their processor.

**Architecture:** New `ICliConfigurationOption` interface in core, `getConfigValue` utility in core, `CliConfigureCommandProcessor` as a built-in processor in cli. The configure command discovers plugin options by scanning the registry for processors with `configurationOptions`. Storage uses a dedicated IndexedDB store via `stateConfiguration`.

**Tech Stack:** Angular, TypeScript, xterm.js, IndexedDB (via existing CliStateStore)

---

### Task 1: Add ICliConfigurationOption Interface to Core

**Files:**
- Modify: `projects/core/src/lib/interfaces/command-processor.ts`

**Step 1: Add the ICliConfigurationOption interface**

Add after the `ICliCommandParameterDescriptor` interface (after line 71), before `ICliCommandProcessor`:

```typescript
/**
 * Represents a configuration option that a command processor exposes
 * for management via the `configure` command.
 */
export interface ICliConfigurationOption {
    /**
     * The key used to store and retrieve this option, e.g. 'maxItems'
     */
    key: string;

    /**
     * Human-readable label shown in the interactive menu
     */
    label: string;

    /**
     * Description of what this option controls
     */
    description: string;

    /**
     * The data type of the option
     */
    type: 'string' | 'number' | 'boolean' | 'select';

    /**
     * The default value when no configuration has been set
     */
    defaultValue: any;

    /**
     * Available choices for 'select' type options
     */
    options?: { label: string; value: any }[];

    /**
     * Optional validator function
     */
    validator?: (value: any) => { valid: boolean; message?: string };

    /**
     * Override the category grouping (defaults to the processor command name)
     */
    category?: string;
}
```

**Step 2: Add configurationOptions to ICliCommandProcessor**

Add to the `ICliCommandProcessor` interface, after the `stateConfiguration` property (after line 143):

```typescript
    /**
     * Configuration options exposed by this processor for the `configure` command.
     * When defined, these options appear in the interactive configuration menu
     * and can be managed via `configure get/set` subcommands.
     */
    configurationOptions?: ICliConfigurationOption[];
```

**Step 3: Verify core builds**

Run: `cd /Users/nicolaelupei/Documents/Personal/angular-web-cli && npm run "build core"`
Expected: BUILD SUCCESS

**Step 4: Commit**

```bash
git add projects/core/src/lib/interfaces/command-processor.ts
git commit -m "feat(core): add ICliConfigurationOption interface and configurationOptions to ICliCommandProcessor"
```

---

### Task 2: Add getConfigValue Utility to Core

**Files:**
- Create: `projects/core/src/lib/utils/config-utils.ts`
- Modify: `projects/core/src/lib/utils/index.ts`

**Step 1: Create config-utils.ts**

```typescript
import { ICliExecutionContext } from '../interfaces/execution-context';
import { ICliCommandProcessorRegistry } from '../interfaces';

/**
 * Token for the configure command's state store.
 */
export const CLI_CONFIGURE_STORE_NAME = 'configure';

/**
 * Retrieves a configuration value for a given processor and key.
 * Reads from the configure command's persisted state store.
 *
 * @param context The execution context
 * @param category The category (processor command name or 'system')
 * @param key The configuration key
 * @param defaultValue Fallback value if not configured
 * @returns The configured value or the default
 */
export function getConfigValue<T = any>(
    context: ICliExecutionContext,
    category: string,
    key: string,
    defaultValue: T,
): T {
    try {
        const state = context.state.getState<Record<string, any>>();
        const bucket = category === 'system' ? state?.system : state?.plugins?.[category];
        if (bucket && key in bucket) {
            return bucket[key] as T;
        }
    } catch {
        // State not initialized or not available — fall back
    }
    return defaultValue;
}

/**
 * Resolves all configuration options from registered processors,
 * grouped by category.
 */
export function resolveConfigurationCategories(
    registry: ICliCommandProcessorRegistry,
): Map<string, { processorCommand: string; options: import('../interfaces/command-processor').ICliConfigurationOption[] }> {
    const categories = new Map<string, { processorCommand: string; options: import('../interfaces/command-processor').ICliConfigurationOption[] }>();

    for (const processor of registry.processors) {
        if (processor.configurationOptions && processor.configurationOptions.length > 0) {
            for (const option of processor.configurationOptions) {
                const cat = option.category || processor.command;
                if (!categories.has(cat)) {
                    categories.set(cat, {
                        processorCommand: processor.command,
                        options: [],
                    });
                }
                categories.get(cat)!.options.push(option);
            }
        }
    }

    return categories;
}
```

**Step 2: Export from utils/index.ts**

Add to `projects/core/src/lib/utils/index.ts` after line 103 (`export * from './version-utils';`):

```typescript
export * from './config-utils';
```

Also add to the `utils` object at line 106:

```typescript
import { getConfigValue, resolveConfigurationCategories, CLI_CONFIGURE_STORE_NAME } from './config-utils';
```

And add to the exported object:
```typescript
    getConfigValue,
    resolveConfigurationCategories,
    CLI_CONFIGURE_STORE_NAME,
```

**Step 3: Verify core builds**

Run: `cd /Users/nicolaelupei/Documents/Personal/angular-web-cli && npm run "build core"`
Expected: BUILD SUCCESS

**Step 4: Commit**

```bash
git add projects/core/src/lib/utils/config-utils.ts projects/core/src/lib/utils/index.ts
git commit -m "feat(core): add getConfigValue utility and resolveConfigurationCategories helper"
```

---

### Task 3: Create CliConfigureCommandProcessor — Scaffold and State

**Files:**
- Create: `projects/cli/src/lib/processors/configure/cli-configure-command-processor.ts`
- Create: `projects/cli/src/lib/processors/configure/types.ts`

**Step 1: Create types.ts**

```typescript
export interface ConfigureState {
    system: Record<string, any>;
    plugins: Record<string, Record<string, any>>;
}
```

**Step 2: Create the processor scaffold**

Create `projects/cli/src/lib/processors/configure/cli-configure-command-processor.ts`:

```typescript
import {
    CliForegroundColor,
    CliProcessCommand,
    CliProcessorMetadata,
    CliStateConfiguration,
    ICliCommandAuthor,
    ICliCommandProcessor,
    ICliCommandProcessorRegistry,
    ICliConfigurationOption,
    ICliExecutionContext,
    CliLogLevel,
    DefaultLibraryAuthor,
    resolveConfigurationCategories,
} from '@qodalis/cli-core';

import { CliProcessorsRegistry_TOKEN } from '../../tokens';
import { ConfigureState } from './types';

/** Built-in system configuration options. */
const SYSTEM_OPTIONS: ICliConfigurationOption[] = [
    {
        key: 'logLevel',
        label: 'Log Level',
        description: 'Minimum log level to display',
        type: 'select',
        defaultValue: 'ERROR',
        options: [
            { label: 'None', value: 'None' },
            { label: 'Debug', value: 'DEBUG' },
            { label: 'Log', value: 'LOG' },
            { label: 'Info', value: 'INFO' },
            { label: 'Warn', value: 'WARN' },
            { label: 'Error', value: 'ERROR' },
        ],
    },
    {
        key: 'welcomeMessage',
        label: 'Welcome Message',
        description: 'When to show the welcome message',
        type: 'select',
        defaultValue: 'always',
        options: [
            { label: 'Always', value: 'always' },
            { label: 'Once', value: 'once' },
            { label: 'Daily', value: 'daily' },
            { label: 'Never', value: 'never' },
        ],
    },
];

export class CliConfigureCommandProcessor implements ICliCommandProcessor {
    command = 'configure';
    description = 'Manage system and plugin configuration';
    author?: ICliCommandAuthor = DefaultLibraryAuthor;
    version = '1.0.0';
    processors?: ICliCommandProcessor[] = [];

    metadata?: CliProcessorMetadata = {
        sealed: true,
        icon: '\u2699',
        module: 'system',
    };

    stateConfiguration?: CliStateConfiguration = {
        initialState: {
            system: SYSTEM_OPTIONS.reduce((acc, opt) => {
                acc[opt.key] = opt.defaultValue;
                return acc;
            }, {} as Record<string, any>),
            plugins: {},
        },
        storeName: 'configure',
    };

    constructor() {
        this.processors = [
            this.buildListProcessor(),
            this.buildGetProcessor(),
            this.buildSetProcessor(),
            this.buildResetProcessor(),
        ];
    }

    // -----------------------------------------------------------------------
    // Interactive menu (no subcommand)
    // -----------------------------------------------------------------------
    async processCommand(
        _command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const registry = context.services.get<ICliCommandProcessorRegistry>(
            CliProcessorsRegistry_TOKEN,
        );
        const pluginCategories = resolveConfigurationCategories(registry);

        await this.showMainMenu(context, pluginCategories);
    }

    async initialize(context: ICliExecutionContext): Promise<void> {
        // Apply persisted system settings on boot
        const state = context.state.getState<ConfigureState>();
        if (state.system) {
            this.applySystemSettings(state.system, context);
        }
    }

    // -----------------------------------------------------------------------
    // Main interactive menu
    // -----------------------------------------------------------------------
    private async showMainMenu(
        context: ICliExecutionContext,
        pluginCategories: Map<string, { processorCommand: string; options: ICliConfigurationOption[] }>,
    ): Promise<void> {
        while (true) {
            const categories: { label: string; value: string }[] = [
                { label: 'System', value: '__system__' },
            ];

            for (const [name] of pluginCategories) {
                categories.push({ label: name, value: name });
            }

            categories.push({ label: '\u2190 Exit', value: '__exit__' });

            context.writer.writeln();
            context.writer.writeln(
                `${context.writer.wrapInColor('\u2699 Configuration', CliForegroundColor.Cyan)}`,
            );
            context.writer.writeln();

            const selected = await context.reader.readSelect(
                'Select a category:',
                categories,
            );

            if (!selected || selected === '__exit__') {
                return;
            }

            if (selected === '__system__') {
                await this.showCategoryMenu(context, 'System', 'system', SYSTEM_OPTIONS);
            } else {
                const cat = pluginCategories.get(selected)!;
                await this.showCategoryMenu(context, selected, selected, cat.options);
            }
        }
    }

    private async showCategoryMenu(
        context: ICliExecutionContext,
        categoryLabel: string,
        stateKey: string,
        options: ICliConfigurationOption[],
    ): Promise<void> {
        while (true) {
            const state = context.state.getState<ConfigureState>();
            const bucket = stateKey === 'system' ? state.system : (state.plugins[stateKey] || {});

            const menuItems = options.map((opt) => {
                const currentValue = bucket[opt.key] ?? opt.defaultValue;
                return {
                    label: `${opt.label.padEnd(25)} [${currentValue}]`,
                    value: opt.key,
                };
            });

            menuItems.push({ label: '\u2190 Back', value: '__back__' });

            context.writer.writeln();
            context.writer.writeln(
                context.writer.wrapInColor(`${categoryLabel} Configuration`, CliForegroundColor.Cyan),
            );
            context.writer.writeln();

            const selected = await context.reader.readSelect(
                'Select an option:',
                menuItems,
            );

            if (!selected || selected === '__back__') {
                return;
            }

            const option = options.find((o) => o.key === selected);
            if (option) {
                await this.editOption(context, stateKey, option);
            }
        }
    }

    private async editOption(
        context: ICliExecutionContext,
        stateKey: string,
        option: ICliConfigurationOption,
    ): Promise<void> {
        const state = context.state.getState<ConfigureState>();
        const bucket = stateKey === 'system' ? state.system : (state.plugins[stateKey] || {});
        const currentValue = bucket[option.key] ?? option.defaultValue;

        let newValue: any = null;

        context.writer.writeln();
        context.writer.writeInfo(option.description);
        context.writer.writeln();

        switch (option.type) {
            case 'select': {
                const items = (option.options || []).map((o) => ({
                    label: `${o.label}${o.value === currentValue ? '  \u2190 current' : ''}`,
                    value: String(o.value),
                }));
                const selected = await context.reader.readSelect(
                    `${option.label}:`,
                    items,
                );
                if (selected === null) return;
                newValue = selected;
                break;
            }
            case 'boolean': {
                const result = await context.reader.readConfirm(
                    `${option.label}?`,
                    currentValue === true,
                );
                if (result === null) return;
                newValue = result;
                break;
            }
            case 'number': {
                const result = await context.reader.readNumber(
                    `${option.label}:`,
                    { defaultValue: currentValue },
                );
                if (result === null) return;
                newValue = result;
                break;
            }
            case 'string':
            default: {
                const result = await context.reader.readLine(
                    `${option.label} [${currentValue}]: `,
                );
                if (result === null) return;
                newValue = result || currentValue;
                break;
            }
        }

        // Validate
        if (option.validator) {
            const validation = option.validator(newValue);
            if (!validation.valid) {
                context.writer.writeError(validation.message || `Invalid value: ${newValue}`);
                return;
            }
        }

        // Persist
        this.setConfigValue(context, stateKey, option.key, newValue);
        await context.state.persist();

        context.writer.writeSuccess(`Set ${option.label} to ${newValue}`);
    }

    // -----------------------------------------------------------------------
    // State helpers
    // -----------------------------------------------------------------------
    private setConfigValue(
        context: ICliExecutionContext,
        stateKey: string,
        key: string,
        value: any,
    ): void {
        const state = context.state.getState<ConfigureState>();

        if (stateKey === 'system') {
            context.state.updateState({
                system: { ...state.system, [key]: value },
            });
            this.applySystemSettings({ [key]: value }, context);
        } else {
            const plugins = { ...state.plugins };
            plugins[stateKey] = { ...(plugins[stateKey] || {}), [key]: value };
            context.state.updateState({ plugins });
        }
    }

    private getConfigValue(
        context: ICliExecutionContext,
        stateKey: string,
        key: string,
        defaultValue: any,
    ): any {
        const state = context.state.getState<ConfigureState>();
        const bucket = stateKey === 'system' ? state.system : (state.plugins?.[stateKey] || {});
        return bucket?.[key] ?? defaultValue;
    }

    private getAllOptions(
        registry: ICliCommandProcessorRegistry,
    ): { stateKey: string; option: ICliConfigurationOption }[] {
        const result: { stateKey: string; option: ICliConfigurationOption }[] = [];

        for (const opt of SYSTEM_OPTIONS) {
            result.push({ stateKey: 'system', option: opt });
        }

        const pluginCategories = resolveConfigurationCategories(registry);
        for (const [name, cat] of pluginCategories) {
            for (const opt of cat.options) {
                result.push({ stateKey: name, option: opt });
            }
        }

        return result;
    }

    private applySystemSettings(
        settings: Record<string, any>,
        context: ICliExecutionContext,
    ): void {
        if (settings.logLevel !== undefined) {
            const level = CliLogLevel[settings.logLevel as keyof typeof CliLogLevel];
            if (level !== undefined) {
                context.logger.setCliLogLevel(level);
            }
        }

        if (settings.welcomeMessage !== undefined && context.options) {
            if (!context.options.welcomeMessage) {
                context.options.welcomeMessage = {};
            }
            context.options.welcomeMessage.show = settings.welcomeMessage;
        }
    }

    // -----------------------------------------------------------------------
    // Subcommand builders
    // -----------------------------------------------------------------------
    private buildListProcessor(): ICliCommandProcessor {
        return {
            command: 'list',
            aliases: ['ls'],
            description: 'List all configuration options with current values',
            processCommand: async (
                _command: CliProcessCommand,
                context: ICliExecutionContext,
            ) => {
                const registry = context.services.get<ICliCommandProcessorRegistry>(
                    CliProcessorsRegistry_TOKEN,
                );
                const allOptions = this.getAllOptions(registry);

                let currentCategory = '';
                const output: Record<string, Record<string, any>> = {};

                for (const { stateKey, option } of allOptions) {
                    if (stateKey !== currentCategory) {
                        currentCategory = stateKey;
                        context.writer.writeln();
                        context.writer.writeln(
                            context.writer.wrapInColor(
                                stateKey === 'system' ? 'System' : stateKey,
                                CliForegroundColor.Cyan,
                            ),
                        );
                    }

                    const value = this.getConfigValue(context, stateKey, option.key, option.defaultValue);
                    context.writer.writeln(
                        `  ${option.key.padEnd(25)} ${value}`,
                    );

                    if (!output[stateKey]) output[stateKey] = {};
                    output[stateKey][option.key] = value;
                }

                context.writer.writeln();
                context.process.output(output);
            },
        } as ICliCommandProcessor;
    }

    private buildGetProcessor(): ICliCommandProcessor {
        return {
            command: 'get',
            description: 'Get a configuration value (e.g. configure get system.logLevel)',
            valueRequired: true,
            processCommand: async (
                command: CliProcessCommand,
                context: ICliExecutionContext,
            ) => {
                const keyPath = command.value!.trim();
                const dotIndex = keyPath.indexOf('.');
                if (dotIndex === -1) {
                    context.writer.writeError(
                        'Usage: configure get <category>.<key> (e.g. configure get system.logLevel)',
                    );
                    return;
                }

                const stateKey = keyPath.substring(0, dotIndex);
                const key = keyPath.substring(dotIndex + 1);

                const registry = context.services.get<ICliCommandProcessorRegistry>(
                    CliProcessorsRegistry_TOKEN,
                );
                const allOptions = this.getAllOptions(registry);
                const match = allOptions.find(
                    (o) => o.stateKey === stateKey && o.option.key === key,
                );

                if (!match) {
                    context.writer.writeError(`Unknown configuration key: ${keyPath}`);
                    return;
                }

                const value = this.getConfigValue(context, stateKey, key, match.option.defaultValue);
                context.writer.writeln(String(value));
                context.process.output(value);
            },
        } as ICliCommandProcessor;
    }

    private buildSetProcessor(): ICliCommandProcessor {
        return {
            command: 'set',
            description: 'Set a configuration value (e.g. configure set system.logLevel WARN)',
            valueRequired: true,
            processCommand: async (
                command: CliProcessCommand,
                context: ICliExecutionContext,
            ) => {
                const parts = command.value!.trim().split(/\s+/);
                if (parts.length < 2) {
                    context.writer.writeError(
                        'Usage: configure set <category>.<key> <value>',
                    );
                    return;
                }

                const keyPath = parts[0];
                const rawValue = parts.slice(1).join(' ');
                const dotIndex = keyPath.indexOf('.');
                if (dotIndex === -1) {
                    context.writer.writeError(
                        'Usage: configure set <category>.<key> <value> (e.g. configure set system.logLevel WARN)',
                    );
                    return;
                }

                const stateKey = keyPath.substring(0, dotIndex);
                const key = keyPath.substring(dotIndex + 1);

                const registry = context.services.get<ICliCommandProcessorRegistry>(
                    CliProcessorsRegistry_TOKEN,
                );
                const allOptions = this.getAllOptions(registry);
                const match = allOptions.find(
                    (o) => o.stateKey === stateKey && o.option.key === key,
                );

                if (!match) {
                    context.writer.writeError(`Unknown configuration key: ${keyPath}`);
                    return;
                }

                // Coerce value based on type
                let value: any = rawValue;
                switch (match.option.type) {
                    case 'number':
                        value = Number(rawValue);
                        if (isNaN(value)) {
                            context.writer.writeError(`Invalid number: ${rawValue}`);
                            return;
                        }
                        break;
                    case 'boolean':
                        value = rawValue === 'true' || rawValue === '1' || rawValue === 'yes';
                        break;
                    case 'select':
                        if (match.option.options) {
                            const validValues = match.option.options.map((o) => o.value);
                            if (!validValues.includes(rawValue)) {
                                context.writer.writeError(
                                    `Invalid value. Valid options: ${validValues.join(', ')}`,
                                );
                                return;
                            }
                        }
                        break;
                }

                // Validate
                if (match.option.validator) {
                    const validation = match.option.validator(value);
                    if (!validation.valid) {
                        context.writer.writeError(validation.message || `Invalid value: ${value}`);
                        return;
                    }
                }

                this.setConfigValue(context, stateKey, key, value);
                await context.state.persist();

                context.writer.writeSuccess(`Set ${keyPath} to ${value}`);
            },
        } as ICliCommandProcessor;
    }

    private buildResetProcessor(): ICliCommandProcessor {
        return {
            command: 'reset',
            description: 'Reset configuration to defaults (optionally for a single category)',
            acceptsRawInput: true,
            processCommand: async (
                command: CliProcessCommand,
                context: ICliExecutionContext,
            ) => {
                const category = command.value?.trim();
                const registry = context.services.get<ICliCommandProcessorRegistry>(
                    CliProcessorsRegistry_TOKEN,
                );

                if (category) {
                    // Reset specific category
                    if (category === 'system') {
                        const defaults = SYSTEM_OPTIONS.reduce((acc, opt) => {
                            acc[opt.key] = opt.defaultValue;
                            return acc;
                        }, {} as Record<string, any>);
                        context.state.updateState({ system: defaults });
                        this.applySystemSettings(defaults, context);
                    } else {
                        const pluginCategories = resolveConfigurationCategories(registry);
                        const cat = pluginCategories.get(category);
                        if (!cat) {
                            context.writer.writeError(`Unknown category: ${category}`);
                            return;
                        }
                        const defaults = cat.options.reduce((acc, opt) => {
                            acc[opt.key] = opt.defaultValue;
                            return acc;
                        }, {} as Record<string, any>);
                        const state = context.state.getState<ConfigureState>();
                        const plugins = { ...state.plugins, [category]: defaults };
                        context.state.updateState({ plugins });
                    }
                    await context.state.persist();
                    context.writer.writeSuccess(`Reset ${category} configuration to defaults`);
                } else {
                    // Reset all — confirm first
                    const confirmed = await context.reader.readConfirm(
                        'Reset ALL configuration to defaults?',
                        false,
                    );
                    if (!confirmed) {
                        context.writer.writeInfo('Reset cancelled');
                        return;
                    }
                    context.state.reset();
                    await context.state.persist();
                    this.applySystemSettings(
                        SYSTEM_OPTIONS.reduce((acc, opt) => {
                            acc[opt.key] = opt.defaultValue;
                            return acc;
                        }, {} as Record<string, any>),
                        context,
                    );
                    context.writer.writeSuccess('All configuration reset to defaults');
                }
            },
        } as ICliCommandProcessor;
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer } = context;
        writer.writeln('Manage system and plugin configuration interactively or via commands');
        writer.writeln();
        writer.writeln('Usage:');
        writer.writeln(`  ${writer.wrapInColor('configure', CliForegroundColor.Cyan)}                                Open interactive configuration menu`);
        writer.writeln(`  ${writer.wrapInColor('configure list', CliForegroundColor.Cyan)}                           List all options with current values`);
        writer.writeln(`  ${writer.wrapInColor('configure get <key>', CliForegroundColor.Cyan)}                      Get a value (e.g. system.logLevel)`);
        writer.writeln(`  ${writer.wrapInColor('configure set <key> <value>', CliForegroundColor.Cyan)}              Set a value`);
        writer.writeln(`  ${writer.wrapInColor('configure reset', CliForegroundColor.Cyan)}                          Reset all to defaults`);
        writer.writeln(`  ${writer.wrapInColor('configure reset <category>', CliForegroundColor.Cyan)}               Reset a category to defaults`);
        writer.writeln();
        writer.writeln('Examples:');
        writer.writeln(`  configure set system.logLevel WARN     ${writer.wrapInColor('# Set log level', CliForegroundColor.Green)}`);
        writer.writeln(`  configure get system.welcomeMessage    ${writer.wrapInColor('# Get welcome message setting', CliForegroundColor.Green)}`);
        writer.writeln(`  configure reset system                 ${writer.wrapInColor('# Reset system settings', CliForegroundColor.Green)}`);
    }
}
```

**Step 3: Commit**

```bash
git add projects/cli/src/lib/processors/configure/
git commit -m "feat(cli): add CliConfigureCommandProcessor with interactive menu and subcommands"
```

---

### Task 4: Register the Configure Processor

**Files:**
- Modify: `projects/cli/src/lib/processors/index.ts`

**Step 1: Add import and export**

Add to the imports at the top of the file (after line 26):

```typescript
import { CliConfigureCommandProcessor } from './configure/cli-configure-command-processor';
```

Add to the re-exports (after line 57):

```typescript
export * from './configure/cli-configure-command-processor';
export * from './configure/types';
```

**Step 2: Add to builtinProcessors**

In the `builtinProcessors` array (line 94-99), add the configure processor:

```typescript
export const builtinProcessors: ICliCommandProcessor[] = [
    ...miscProcessors,
    ...systemProcessors,
    new CliThemeCommandProcessor(),
    new CliConfigureCommandProcessor(),
    new CliPingCommandProcessor(),
];
```

**Step 3: Verify cli builds**

Run: `cd /Users/nicolaelupei/Documents/Personal/angular-web-cli && npm run "build all"`
Expected: BUILD SUCCESS

**Step 4: Commit**

```bash
git add projects/cli/src/lib/processors/index.ts
git commit -m "feat(cli): register CliConfigureCommandProcessor in builtinProcessors"
```

---

### Task 5: Write Tests for Configure Command

**Files:**
- Create: `projects/cli/src/tests/configure-command-processor.spec.ts`

**Step 1: Create test file**

```typescript
import { Subject } from 'rxjs';
import {
    ICliCommandProcessor,
    ICliExecutionContext,
    ICliTerminalWriter,
    ICliServiceProvider,
    ICliStateStore,
    ICliCommandProcessorRegistry,
    CliProcessCommand,
    CliForegroundColor,
    CliBackgroundColor,
    CliProvider,
    ICliConfigurationOption,
} from '@qodalis/cli-core';
import { CliCommandProcessorRegistry } from '../lib/registry';
import { CliExecutionProcess } from '../lib/context/cli-execution-process';
import { CliProcessorsRegistry_TOKEN, CliStateStoreManager_TOKEN } from '../lib/tokens';
import { CliConfigureCommandProcessor } from '../lib/processors/configure/cli-configure-command-processor';

// ---------------------------------------------------------------------------
// Test Fixtures
// ---------------------------------------------------------------------------

function createStubWriter(): ICliTerminalWriter & { written: string[] } {
    const written: string[] = [];
    return {
        written,
        write(text: string) { written.push(text); },
        writeln(text?: string) { written.push(text ?? ''); },
        writeSuccess(msg: string) { written.push(`[success] ${msg}`); },
        writeInfo(msg: string) { written.push(`[info] ${msg}`); },
        writeWarning(msg: string) { written.push(`[warn] ${msg}`); },
        writeError(msg: string) { written.push(`[error] ${msg}`); },
        wrapInColor(text: string, _color: CliForegroundColor) { return text; },
        wrapInBackgroundColor(text: string, _color: CliBackgroundColor) { return text; },
        writeJson(json: any) { written.push(JSON.stringify(json)); },
        writeToFile(_fn: string, _content: string) {},
        writeObjectsAsTable(objects: any[]) { written.push(JSON.stringify(objects)); },
        writeTable(_h: string[], _r: string[][]) {},
        writeDivider() {},
        writeList(_items: string[], _options?: any) {},
        writeKeyValue(_entries: any, _options?: any) {},
        writeColumns(_items: string[], _options?: any) {},
    };
}

function createStubStateStore(initialState?: Record<string, any>): ICliStateStore {
    const state: Record<string, any> = initialState || {
        system: { logLevel: 'ERROR', welcomeMessage: 'always' },
        plugins: {},
    };
    return {
        getState: () => ({ ...state }) as any,
        updateState: (partial: any) => Object.assign(state, partial),
        select: () => new Subject<any>().asObservable(),
        subscribe: () => ({ unsubscribe() {} } as any),
        reset: () => {
            state.system = { logLevel: 'ERROR', welcomeMessage: 'always' };
            state.plugins = {};
        },
        persist: async () => {},
        initialize: async () => {},
    } as ICliStateStore;
}

function createMockContext(
    writer: ICliTerminalWriter,
    registry: ICliCommandProcessorRegistry,
    stateStore?: ICliStateStore,
): ICliExecutionContext {
    const state = stateStore || createStubStateStore();
    const services: ICliServiceProvider = {
        get<T>(token: any): T {
            if (token === CliProcessorsRegistry_TOKEN) return registry as any;
            if (token === CliStateStoreManager_TOKEN) {
                return {
                    getProcessorStateStore: () => state,
                    getStateStore: () => state,
                    getStoreEntries: () => [],
                } as any;
            }
            return undefined as any;
        },
        set(_def: CliProvider | CliProvider[]): void {},
    };

    const ctx: any = {
        writer,
        process: null as any,
        services,
        state,
        spinner: { show: () => {}, hide: () => {} },
        progressBar: { show: () => {}, update: () => {}, hide: () => {} },
        onAbort: new Subject<void>(),
        terminal: {} as any,
        reader: {
            readLine: jasmine.createSpy('readLine').and.returnValue(Promise.resolve(null)),
            readPassword: jasmine.createSpy('readPassword').and.returnValue(Promise.resolve(null)),
            readConfirm: jasmine.createSpy('readConfirm').and.returnValue(Promise.resolve(null)),
            readSelect: jasmine.createSpy('readSelect').and.returnValue(Promise.resolve(null)),
            readSelectInline: jasmine.createSpy('readSelectInline').and.returnValue(Promise.resolve(null)),
            readMultiSelect: jasmine.createSpy('readMultiSelect').and.returnValue(Promise.resolve(null)),
            readNumber: jasmine.createSpy('readNumber').and.returnValue(Promise.resolve(null)),
        },
        executor: {
            showHelp: jasmine.createSpy('showHelp'),
            executeCommand: jasmine.createSpy('executeCommand'),
        },
        clipboard: {} as any,
        options: {},
        promptLength: 0,
        currentLine: '',
        cursorPosition: 0,
        logger: { log() {}, info() {}, warn() {}, error() {}, debug() {}, setCliLogLevel: jasmine.createSpy('setCliLogLevel') },
        setContextProcessor: jasmine.createSpy('setContextProcessor'),
        showPrompt: jasmine.createSpy('showPrompt'),
        setCurrentLine: jasmine.createSpy('setCurrentLine'),
        clearLine: jasmine.createSpy('clearLine'),
        clearCurrentLine: jasmine.createSpy('clearCurrentLine'),
        refreshCurrentLine: jasmine.createSpy('refreshCurrentLine'),
        enterFullScreenMode: jasmine.createSpy('enterFullScreenMode'),
        exitFullScreenMode: jasmine.createSpy('exitFullScreenMode'),
    };
    ctx.process = new CliExecutionProcess(ctx as ICliExecutionContext);
    return ctx as ICliExecutionContext;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CliConfigureCommandProcessor', () => {
    let processor: CliConfigureCommandProcessor;
    let registry: CliCommandProcessorRegistry;
    let writer: ICliTerminalWriter & { written: string[] };
    let context: ICliExecutionContext;

    beforeEach(() => {
        processor = new CliConfigureCommandProcessor();
        registry = new CliCommandProcessorRegistry();
        writer = createStubWriter();
        context = createMockContext(writer, registry);
    });

    describe('list subcommand', () => {
        it('should list system configuration options', async () => {
            const listProcessor = processor.processors!.find(p => p.command === 'list')!;
            await listProcessor.processCommand(
                { command: 'list', chainCommands: [], rawCommand: 'configure list', args: {} },
                context,
            );

            expect(writer.written.some(w => w.includes('logLevel'))).toBeTrue();
            expect(writer.written.some(w => w.includes('welcomeMessage'))).toBeTrue();
        });

        it('should include plugin configuration when available', async () => {
            const pluginProcessor: ICliCommandProcessor = {
                command: 'myplugin',
                description: 'Test plugin',
                configurationOptions: [
                    {
                        key: 'maxItems',
                        label: 'Max Items',
                        description: 'Maximum items',
                        type: 'number',
                        defaultValue: 50,
                    },
                ],
                async processCommand() {},
            };
            registry.registerProcessor(pluginProcessor);

            const listProcessor = processor.processors!.find(p => p.command === 'list')!;
            await listProcessor.processCommand(
                { command: 'list', chainCommands: [], rawCommand: 'configure list', args: {} },
                context,
            );

            expect(writer.written.some(w => w.includes('myplugin'))).toBeTrue();
            expect(writer.written.some(w => w.includes('maxItems'))).toBeTrue();
        });
    });

    describe('get subcommand', () => {
        it('should return a system config value', async () => {
            const getProcessor = processor.processors!.find(p => p.command === 'get')!;
            await getProcessor.processCommand(
                { command: 'get', chainCommands: [], rawCommand: 'configure get system.logLevel', value: 'system.logLevel', args: {} },
                context,
            );

            expect(writer.written.some(w => w.includes('ERROR'))).toBeTrue();
        });

        it('should error on unknown key', async () => {
            const getProcessor = processor.processors!.find(p => p.command === 'get')!;
            await getProcessor.processCommand(
                { command: 'get', chainCommands: [], rawCommand: 'configure get system.nonexistent', value: 'system.nonexistent', args: {} },
                context,
            );

            expect(writer.written.some(w => w.includes('Unknown configuration key'))).toBeTrue();
        });

        it('should error on missing dot notation', async () => {
            const getProcessor = processor.processors!.find(p => p.command === 'get')!;
            await getProcessor.processCommand(
                { command: 'get', chainCommands: [], rawCommand: 'configure get logLevel', value: 'logLevel', args: {} },
                context,
            );

            expect(writer.written.some(w => w.includes('Usage'))).toBeTrue();
        });
    });

    describe('set subcommand', () => {
        it('should set a system config value', async () => {
            const setProcessor = processor.processors!.find(p => p.command === 'set')!;
            await setProcessor.processCommand(
                { command: 'set', chainCommands: [], rawCommand: 'configure set system.logLevel WARN', value: 'system.logLevel WARN', args: {} },
                context,
            );

            expect(writer.written.some(w => w.includes('Set system.logLevel to WARN'))).toBeTrue();
        });

        it('should reject invalid select value', async () => {
            const setProcessor = processor.processors!.find(p => p.command === 'set')!;
            await setProcessor.processCommand(
                { command: 'set', chainCommands: [], rawCommand: 'configure set system.logLevel INVALID', value: 'system.logLevel INVALID', args: {} },
                context,
            );

            expect(writer.written.some(w => w.includes('Invalid value'))).toBeTrue();
        });

        it('should error on missing value', async () => {
            const setProcessor = processor.processors!.find(p => p.command === 'set')!;
            await setProcessor.processCommand(
                { command: 'set', chainCommands: [], rawCommand: 'configure set system.logLevel', value: 'system.logLevel', args: {} },
                context,
            );

            expect(writer.written.some(w => w.includes('Usage'))).toBeTrue();
        });
    });

    describe('reset subcommand', () => {
        it('should reset a specific category', async () => {
            // First set a non-default value
            const state = context.state.getState<any>();
            context.state.updateState({ system: { ...state.system, logLevel: 'DEBUG' } });

            const resetProcessor = processor.processors!.find(p => p.command === 'reset')!;
            await resetProcessor.processCommand(
                { command: 'reset', chainCommands: [], rawCommand: 'configure reset system', value: 'system', args: {} },
                context,
            );

            expect(writer.written.some(w => w.includes('Reset system configuration to defaults'))).toBeTrue();
        });

        it('should error on unknown category', async () => {
            const resetProcessor = processor.processors!.find(p => p.command === 'reset')!;
            await resetProcessor.processCommand(
                { command: 'reset', chainCommands: [], rawCommand: 'configure reset nonexistent', value: 'nonexistent', args: {} },
                context,
            );

            expect(writer.written.some(w => w.includes('Unknown category'))).toBeTrue();
        });

        it('should prompt for confirmation when resetting all', async () => {
            (context.reader.readConfirm as jasmine.Spy).and.returnValue(Promise.resolve(false));

            const resetProcessor = processor.processors!.find(p => p.command === 'reset')!;
            await resetProcessor.processCommand(
                { command: 'reset', chainCommands: [], rawCommand: 'configure reset', args: {} },
                context,
            );

            expect(context.reader.readConfirm).toHaveBeenCalled();
            expect(writer.written.some(w => w.includes('Reset cancelled'))).toBeTrue();
        });
    });

    describe('initialize', () => {
        it('should apply persisted system settings on boot', async () => {
            const stateStore = createStubStateStore({
                system: { logLevel: 'WARN', welcomeMessage: 'never' },
                plugins: {},
            });
            const ctx = createMockContext(writer, registry, stateStore);

            await processor.initialize!(ctx);

            expect(ctx.logger.setCliLogLevel).toHaveBeenCalled();
        });
    });
});
```

**Step 2: Run tests**

Run: `cd /Users/nicolaelupei/Documents/Personal/angular-web-cli && npm test`
Expected: All tests pass

**Step 3: Commit**

```bash
git add projects/cli/src/tests/configure-command-processor.spec.ts
git commit -m "test(cli): add tests for CliConfigureCommandProcessor"
```

---

### Task 6: Manual Smoke Test

**Step 1: Build everything**

Run: `cd /Users/nicolaelupei/Documents/Personal/angular-web-cli && npm run "build all"`
Expected: BUILD SUCCESS

**Step 2: Start the demo app**

Run: `cd /Users/nicolaelupei/Documents/Personal/angular-web-cli && npm run "start demo"`

**Step 3: Verify in browser**

Open localhost:4300 and test:
1. Type `configure` — should show interactive category menu with "System" and "Exit"
2. Select "System" — should show logLevel and welcomeMessage with current values
3. Select logLevel — should show select menu with options
4. Press Escape to go back through menus
5. Type `configure list` — should show all settings
6. Type `configure get system.logLevel` — should output current value
7. Type `configure set system.logLevel WARN` — should update
8. Type `configure get system.logLevel` — should show WARN
9. Type `configure reset system` — should reset
10. Type `help` — should show configure in the command list

**Step 4: Commit any fixes**

---

### Task 7: Final Commit and Cleanup

**Step 1: Run linting**

Run: `cd /Users/nicolaelupei/Documents/Personal/angular-web-cli && npm run lint`

**Step 2: Fix any lint issues**

Run: `cd /Users/nicolaelupei/Documents/Personal/angular-web-cli && npm run "lint fix"`

**Step 3: Final commit**

```bash
git add -A
git commit -m "chore: lint fixes for configure command"
```
