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
    ICliTranslationService,
    ICliTranslationService_TOKEN,
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
        description: 'Controls how much logging the CLI outputs',
        type: 'select',
        defaultValue: 'ERROR',
        options: [
            { label: 'None', value: 'None' },
            { label: 'Debug', value: 'Debug' },
            { label: 'Log', value: 'Log' },
            { label: 'Info', value: 'Info' },
            { label: 'Warn', value: 'Warn' },
            { label: 'Error', value: 'Error' },
        ],
    },
    {
        key: 'welcomeMessage',
        label: 'Welcome Message',
        description: 'When to display the welcome message on startup',
        type: 'select',
        defaultValue: 'always',
        options: [
            { label: 'Always', value: 'always' },
            { label: 'Once', value: 'once' },
            { label: 'Daily', value: 'daily' },
            { label: 'Never', value: 'never' },
        ],
    },
    {
        key: 'language',
        label: 'Language',
        description: 'Display language for the CLI interface',
        type: 'select',
        defaultValue: 'en',
        options: [
            { label: 'English', value: 'en' },
        ],
    },
];

/** Map of string labels to CliLogLevel enum values. */
const LOG_LEVEL_MAP: Record<string, CliLogLevel> = {
    None: CliLogLevel.None,
    Debug: CliLogLevel.DEBUG,
    Log: CliLogLevel.LOG,
    Info: CliLogLevel.INFO,
    Warn: CliLogLevel.WARN,
    Error: CliLogLevel.ERROR,
};

export class CliConfigureCommandProcessor implements ICliCommandProcessor {
    command = 'configure';

    description = 'Manage system and plugin configuration';

    author?: ICliCommandAuthor | undefined = DefaultLibraryAuthor;

    version?: string | undefined = '1.0.0';

    processors?: ICliCommandProcessor[] | undefined = [];

    metadata?: CliProcessorMetadata | undefined = {
        sealed: true,
        icon: '⚙',
        module: 'system',
    };

    stateConfiguration?: CliStateConfiguration | undefined = {
        initialState: {
            system: CliConfigureCommandProcessor.buildDefaults(SYSTEM_OPTIONS),
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

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const registry = context.services.get<ICliCommandProcessorRegistry>(
            CliProcessorsRegistry_TOKEN,
        );
        const pluginCategories = resolveConfigurationCategories(registry);
        await this.showMainMenu(context, pluginCategories);
    }

    async initialize(context: ICliExecutionContext): Promise<void> {
        const state = context.state.getState<ConfigureState>();

        if (state?.system) {
            this.applySystemSettings(state.system, context);
        }
    }

    writeDescription?(context: ICliExecutionContext): void {
        const { writer } = context;

        writer.writeln(
            'Manage system and plugin configuration interactively or via subcommands',
        );
        writer.writeln();
        writer.writeln('Usage:');
        writer.writeln(
            `  ${writer.wrapInColor('configure', CliForegroundColor.Cyan)}                          Open interactive configuration menu`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('configure list', CliForegroundColor.Cyan)}                     List all configuration options`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('configure get <category.key>', CliForegroundColor.Cyan)}       Get a configuration value`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('configure set <category.key> <value>', CliForegroundColor.Cyan)}  Set a configuration value`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('configure reset [category]', CliForegroundColor.Cyan)}         Reset configuration to defaults`,
        );
        writer.writeln();
        writer.writeln('Examples:');
        writer.writeln(
            `  configure get system.logLevel            ${writer.wrapInColor('# Get the current log level', CliForegroundColor.Green)}`,
        );
        writer.writeln(
            `  configure set system.logLevel Debug      ${writer.wrapInColor('# Set log level to Debug', CliForegroundColor.Green)}`,
        );
        writer.writeln(
            `  configure set system.welcomeMessage never ${writer.wrapInColor('# Disable welcome message', CliForegroundColor.Green)}`,
        );
        writer.writeln(
            `  configure reset system                   ${writer.wrapInColor('# Reset system config to defaults', CliForegroundColor.Green)}`,
        );
        writer.writeln(
            `  configure reset                          ${writer.wrapInColor('# Reset all configuration', CliForegroundColor.Green)}`,
        );
    }

    // ── Interactive menus ───────────────────────────────────────────────

    private async showMainMenu(
        context: ICliExecutionContext,
        pluginCategories: Map<
            string,
            { processorCommand: string; options: ICliConfigurationOption[] }
        >,
    ): Promise<void> {
        while (true) {
            const menuOptions: { label: string; value: string }[] = [
                { label: 'System', value: 'system' },
            ];

            for (const [category] of pluginCategories) {
                menuOptions.push({
                    label: category.charAt(0).toUpperCase() + category.slice(1),
                    value: category,
                });
            }

            menuOptions.push({ label: 'Exit', value: '__exit__' });

            const selected = await context.reader.readSelect(
                'Configuration categories:',
                menuOptions,
            );

            if (selected === null || selected === '__exit__') {
                return;
            }

            if (selected === 'system') {
                await this.showCategoryMenu(
                    context,
                    'System',
                    'system',
                    SYSTEM_OPTIONS,
                );
            } else {
                const cat = pluginCategories.get(selected);
                if (cat) {
                    await this.showCategoryMenu(
                        context,
                        selected,
                        selected,
                        cat.options,
                    );
                }
            }
        }
    }

    private async showCategoryMenu(
        context: ICliExecutionContext,
        label: string,
        stateKey: string,
        options: ICliConfigurationOption[],
    ): Promise<void> {
        // Dynamically populate language options from available locales
        if (stateKey === 'system') {
            const langOption = options.find(o => o.key === 'language');
            if (langOption) {
                try {
                    const translator = context.services.get<ICliTranslationService>(
                        ICliTranslationService_TOKEN,
                    );
                    const locales = translator.getAvailableLocales();
                    if (locales.length > 0) {
                        langOption.options = locales.map(l => ({
                            label: this.getLanguageLabel(l),
                            value: l,
                        }));
                    }
                } catch {
                    // ignore
                }
            }
        }

        while (true) {
            const menuOptions: { label: string; value: string }[] = [];

            for (const opt of options) {
                const currentValue = this.getConfigValue(
                    context,
                    stateKey,
                    opt.key,
                    opt.defaultValue,
                );
                const display = `${opt.label.padEnd(25)} [${currentValue}]`;
                menuOptions.push({ label: display, value: opt.key });
            }

            menuOptions.push({ label: 'Back', value: '__back__' });

            const selected = await context.reader.readSelect(
                `${label} settings:`,
                menuOptions,
            );

            if (selected === null || selected === '__back__') {
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
        const currentValue = this.getConfigValue(
            context,
            stateKey,
            option.key,
            option.defaultValue,
        );

        context.writer.writeln();
        context.writer.writeln(
            `${context.writer.wrapInColor(option.label, CliForegroundColor.Cyan)}: ${option.description}`,
        );
        context.writer.writeln(
            `  Current value: ${context.writer.wrapInColor(String(currentValue), CliForegroundColor.Yellow)}`,
        );
        context.writer.writeln();

        let newValue: any = null;

        switch (option.type) {
            case 'select': {
                if (!option.options) break;
                const selectOptions = option.options.map((o) => ({
                    label:
                        o.value === currentValue
                            ? `${o.label} (current)`
                            : o.label,
                    value: o.value,
                }));
                newValue = await context.reader.readSelect(
                    'Select a value:',
                    selectOptions,
                );
                break;
            }
            case 'boolean': {
                newValue = await context.reader.readConfirm(
                    `${option.label}?`,
                    currentValue === true,
                );
                break;
            }
            case 'number': {
                newValue = await context.reader.readNumber(
                    `${option.label}: `,
                    {
                        default:
                            typeof currentValue === 'number'
                                ? currentValue
                                : undefined,
                    },
                );
                break;
            }
            case 'string': {
                newValue = await context.reader.readLine(
                    `${option.label} [${currentValue}]: `,
                );
                if (newValue === '') {
                    newValue = currentValue;
                }
                break;
            }
        }

        if (newValue === null) {
            return;
        }

        // Validate if validator is defined
        if (option.validator) {
            const result = option.validator(newValue);
            if (!result.valid) {
                context.writer.writeError(result.message || 'Invalid value');
                return;
            }
        }

        this.setConfigValue(context, stateKey, option.key, newValue);
        await context.state.persist();

        context.writer.writeSuccess(
            `Set ${option.label} to ${context.writer.wrapInColor(String(newValue), CliForegroundColor.Cyan)}`,
        );
    }

    // ── State helpers ───────────────────────────────────────────────────

    private setConfigValue(
        context: ICliExecutionContext,
        stateKey: string,
        key: string,
        value: any,
    ): void {
        const state = context.state.getState<ConfigureState>();

        if (stateKey === 'system') {
            state.system = { ...state.system, [key]: value };
            context.state.updateState({ system: state.system });
            this.applySystemSettings(state.system, context);
        } else {
            const pluginState = state.plugins[stateKey] || {};
            state.plugins = {
                ...state.plugins,
                [stateKey]: { ...pluginState, [key]: value },
            };
            context.state.updateState({ plugins: state.plugins });
        }
    }

    private getConfigValue(
        context: ICliExecutionContext,
        stateKey: string,
        key: string,
        defaultValue: any,
    ): any {
        const state = context.state.getState<ConfigureState>();

        if (stateKey === 'system') {
            return state?.system?.[key] ?? defaultValue;
        }

        return state?.plugins?.[stateKey]?.[key] ?? defaultValue;
    }

    private getAllOptions(
        registry: ICliCommandProcessorRegistry,
    ): { stateKey: string; option: ICliConfigurationOption }[] {
        const result: { stateKey: string; option: ICliConfigurationOption }[] =
            [];

        // System options first
        for (const option of SYSTEM_OPTIONS) {
            result.push({ stateKey: 'system', option });
        }

        // Plugin options
        const categories = resolveConfigurationCategories(registry);
        for (const [category, { options }] of categories) {
            for (const option of options) {
                result.push({ stateKey: category, option });
            }
        }

        return result;
    }

    private applySystemSettings(
        settings: Record<string, any>,
        context: ICliExecutionContext,
    ): void {
        // Apply log level
        if (settings['logLevel']) {
            const level = LOG_LEVEL_MAP[settings['logLevel']];
            if (level !== undefined) {
                context.logger.setCliLogLevel(level);
            }
        }

        // Apply language
        if (settings['language']) {
            try {
                const translator = context.services.get<ICliTranslationService>(
                    ICliTranslationService_TOKEN,
                );
                translator.setLocale(settings['language']);
            } catch {
                // Translation service not available yet during early boot
            }
        }

        // Welcome message setting is persisted in state and read
        // directly by the welcome module on next boot — no runtime
        // mutation needed here.
    }

    // ── Child processor builders ────────────────────────────────────────

    private buildListProcessor(): ICliCommandProcessor {
        return {
            command: 'list',
            aliases: ['ls'],
            description:
                'List all configuration options and their current values',
            processCommand: async (
                _: CliProcessCommand,
                context: ICliExecutionContext,
            ) => {
                const registry =
                    context.services.get<ICliCommandProcessorRegistry>(
                        CliProcessorsRegistry_TOKEN,
                    );
                const allOptions = this.getAllOptions(registry);

                let currentCategory = '';
                const output: Record<string, Record<string, any>> = {};

                for (const { stateKey, option } of allOptions) {
                    const value = this.getConfigValue(
                        context,
                        stateKey,
                        option.key,
                        option.defaultValue,
                    );

                    if (stateKey !== currentCategory) {
                        currentCategory = stateKey;
                        const header =
                            stateKey === 'system' ? 'System' : stateKey;
                        context.writer.writeln();
                        context.writer.writeln(
                            context.writer.wrapInColor(
                                `  ${header}`,
                                CliForegroundColor.Cyan,
                            ),
                        );
                        context.writer.writeln(
                            context.writer.wrapInColor(
                                `  ${'─'.repeat(40)}`,
                                CliForegroundColor.Cyan,
                            ),
                        );
                    }

                    const keyDisplay = `${stateKey}.${option.key}`.padEnd(30);
                    const valueDisplay = context.writer.wrapInColor(
                        String(value),
                        CliForegroundColor.Yellow,
                    );
                    context.writer.writeln(`    ${keyDisplay} ${valueDisplay}`);

                    if (!output[stateKey]) {
                        output[stateKey] = {};
                    }
                    output[stateKey][option.key] = value;
                }

                context.writer.writeln();
                context.process.output(output);
            },
        };
    }

    private buildGetProcessor(): ICliCommandProcessor {
        return {
            command: 'get',
            description:
                'Get a configuration value (e.g. configure get system.logLevel)',
            valueRequired: true,
            processCommand: async (
                command: CliProcessCommand,
                context: ICliExecutionContext,
            ) => {
                const path = command.value!;
                const dotIndex = path.indexOf('.');

                if (dotIndex === -1) {
                    context.writer.writeError(
                        'Invalid format. Use: configure get <category.key>',
                    );
                    return;
                }

                const category = path.substring(0, dotIndex);
                const key = path.substring(dotIndex + 1);

                const registry =
                    context.services.get<ICliCommandProcessorRegistry>(
                        CliProcessorsRegistry_TOKEN,
                    );
                const allOptions = this.getAllOptions(registry);
                const match = allOptions.find(
                    (o) => o.stateKey === category && o.option.key === key,
                );

                if (!match) {
                    context.writer.writeError(
                        `Unknown configuration key: ${path}`,
                    );
                    return;
                }

                const value = this.getConfigValue(
                    context,
                    category,
                    key,
                    match.option.defaultValue,
                );

                context.writer.writeln(
                    `${context.writer.wrapInColor(path, CliForegroundColor.Cyan)} = ${context.writer.wrapInColor(String(value), CliForegroundColor.Yellow)}`,
                );
                context.process.output(value);
            },
        };
    }

    private buildSetProcessor(): ICliCommandProcessor {
        return {
            command: 'set',
            description:
                'Set a configuration value (e.g. configure set system.logLevel Debug)',
            valueRequired: true,
            processCommand: async (
                command: CliProcessCommand,
                context: ICliExecutionContext,
            ) => {
                const raw = command.value!;
                const spaceIndex = raw.indexOf(' ');

                if (spaceIndex === -1) {
                    context.writer.writeError(
                        'Invalid format. Use: configure set <category.key> <value>',
                    );
                    return;
                }

                const path = raw.substring(0, spaceIndex);
                const rawValue = raw.substring(spaceIndex + 1).trim();
                const dotIndex = path.indexOf('.');

                if (dotIndex === -1) {
                    context.writer.writeError(
                        'Invalid format. Use: configure set <category.key> <value>',
                    );
                    return;
                }

                const category = path.substring(0, dotIndex);
                const key = path.substring(dotIndex + 1);

                const registry =
                    context.services.get<ICliCommandProcessorRegistry>(
                        CliProcessorsRegistry_TOKEN,
                    );
                const allOptions = this.getAllOptions(registry);
                const match = allOptions.find(
                    (o) => o.stateKey === category && o.option.key === key,
                );

                if (!match) {
                    context.writer.writeError(
                        `Unknown configuration key: ${path}`,
                    );
                    return;
                }

                // Coerce value based on type
                const coerceResult = this.coerceValue(rawValue, match.option);
                if (coerceResult.error) {
                    context.writer.writeError(coerceResult.error);
                    return;
                }
                const coerced = coerceResult.value;

                // Validate if validator is defined
                if (match.option.validator) {
                    const result = match.option.validator(coerced);
                    if (!result.valid) {
                        context.writer.writeError(
                            result.message || `Invalid value for ${path}`,
                        );
                        return;
                    }
                }

                this.setConfigValue(context, category, key, coerced);
                await context.state.persist();

                context.writer.writeSuccess(
                    `Set ${context.writer.wrapInColor(path, CliForegroundColor.Cyan)} to ${context.writer.wrapInColor(String(coerced), CliForegroundColor.Yellow)}`,
                );
            },
        };
    }

    private buildResetProcessor(): ICliCommandProcessor {
        return {
            command: 'reset',
            description:
                'Reset configuration to defaults (optionally for a specific category)',
            acceptsRawInput: true,
            processCommand: async (
                command: CliProcessCommand,
                context: ICliExecutionContext,
            ) => {
                const category = command.value?.trim();

                if (category) {
                    // Reset a specific category
                    if (category === 'system') {
                        const defaults =
                            CliConfigureCommandProcessor.buildDefaults(
                                SYSTEM_OPTIONS,
                            );
                        const state = context.state.getState<ConfigureState>();
                        context.state.updateState({
                            system: defaults,
                            plugins: state.plugins,
                        });
                        this.applySystemSettings(defaults, context);
                        await context.state.persist();
                        context.writer.writeSuccess(
                            'System configuration reset to defaults',
                        );
                    } else {
                        const registry =
                            context.services.get<ICliCommandProcessorRegistry>(
                                CliProcessorsRegistry_TOKEN,
                            );
                        const categories =
                            resolveConfigurationCategories(registry);
                        const cat = categories.get(category);

                        if (!cat) {
                            context.writer.writeError(
                                `Unknown category: ${category}`,
                            );
                            return;
                        }

                        const defaults =
                            CliConfigureCommandProcessor.buildDefaults(
                                cat.options,
                            );

                        const state = context.state.getState<ConfigureState>();
                        const updatedPlugins = {
                            ...state.plugins,
                            [category]: defaults,
                        };
                        context.state.updateState({
                            system: state.system,
                            plugins: updatedPlugins,
                        });
                        await context.state.persist();
                        context.writer.writeSuccess(
                            `Configuration for "${category}" reset to defaults`,
                        );
                    }
                } else {
                    // Reset all
                    const confirmed = await context.reader.readConfirm(
                        'Reset all configuration to defaults?',
                        false,
                    );

                    if (!confirmed) {
                        context.writer.writeInfo('Reset cancelled');
                        return;
                    }

                    context.state.reset();
                    await context.state.persist();

                    // Re-apply system defaults
                    const defaults =
                        CliConfigureCommandProcessor.buildDefaults(
                            SYSTEM_OPTIONS,
                        );
                    this.applySystemSettings(defaults, context);

                    context.writer.writeSuccess(
                        'All configuration reset to defaults',
                    );
                }
            },
        };
    }

    // ── Helpers ─────────────────────────────────────────────────────────

    private coerceValue(
        rawValue: string,
        option: ICliConfigurationOption,
    ): { value: any; error?: string } {
        switch (option.type) {
            case 'number': {
                const num = Number(rawValue);
                if (isNaN(num)) {
                    return {
                        value: null,
                        error: `Invalid number: ${rawValue}`,
                    };
                }
                return { value: num };
            }
            case 'boolean':
                return {
                    value: ['true', '1', 'yes'].includes(
                        rawValue.toLowerCase(),
                    ),
                };
            case 'select':
                if (option.options) {
                    const match = option.options.find(
                        (o) =>
                            String(o.value).toLowerCase() ===
                            rawValue.toLowerCase(),
                    );
                    if (!match) {
                        return {
                            value: null,
                            error: `Invalid value. Valid options: ${option.options.map((o) => o.value).join(', ')}`,
                        };
                    }
                    return { value: match.value };
                }
                return { value: rawValue };
            default:
                return { value: rawValue };
        }
    }

    private getLanguageLabel(locale: string): string {
        const labels: Record<string, string> = {
            en: 'English',
            es: 'Español',
            fr: 'Français',
            de: 'Deutsch',
            pt: 'Português',
            it: 'Italiano',
            ja: '日本語',
            ko: '한국어',
            zh: '中文',
            ru: 'Русский',
            ar: 'العربية',
            ro: 'Română',
        };
        return labels[locale] || locale;
    }

    private static buildDefaults(
        options: ICliConfigurationOption[],
    ): Record<string, any> {
        return options.reduce(
            (acc, opt) => {
                acc[opt.key] = opt.defaultValue;
                return acc;
            },
            {} as Record<string, any>,
        );
    }
}
