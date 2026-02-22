import { Injectable } from '@angular/core';
import {
    CliForegroundColor,
    CliProcessCommand,
    CliProcessorMetadata,
    CliStateConfiguration,
    ICliCommandAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';

import { DefaultLibraryAuthor } from '@qodalis/cli-core';
import { ITheme } from '@xterm/xterm';
import { themes, ThemeState } from './types';

@Injectable({
    providedIn: 'root',
})
export class CliThemeCommandProcessor implements ICliCommandProcessor {
    command = 'theme';

    aliases = ['themes'];

    description = 'Interact with the theme';

    author?: ICliCommandAuthor | undefined = DefaultLibraryAuthor;

    version?: string | undefined = '1.0.1';

    processors?: ICliCommandProcessor[] | undefined = [];

    metadata?: CliProcessorMetadata | undefined = {
        sealed: true,
        icon: '🎨',
        module: 'system',
    };

    stateConfiguration?: CliStateConfiguration | undefined = {
        initialState: {
            selectedTheme: 'default',
            customOptions: null,
        },
    };

    private themeOptions: string[] = Object.keys(themeOptions);

    private defaultTheme!: ITheme;

    constructor() {
        this.processors = [
            {
                command: 'list',
                description: 'List available themes',
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    context.writer.writeln('Available themes:');
                    Object.keys(themes).forEach((theme) => {
                        context.writer.writeln(
                            context.writer.wrapInColor(
                                theme,
                                CliForegroundColor.Cyan,
                            ),
                        );
                    });
                },
            },
            {
                command: 'current',
                description: 'Show the current theme',
                processCommand: async (
                    _: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const state = context.state.getState<ThemeState>();
                    const theme = state.selectedTheme || 'custom';

                    context.writer.writeln(`Current theme: ${theme}`);
                    context.writer.writeln('Theme options:');
                    Object.keys(context.terminal.options.theme!).forEach(
                        (key) => {
                            context.writer.writeln(
                                `${key}: ${(context.terminal.options.theme as any)[key]}`,
                            );
                        },
                    );
                },
            },
            {
                command: 'apply',
                description: 'Apply a theme',
                valueRequired: true,
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const theme = command.value!;

                    if (!themes[theme]) {
                        context.writer.writeError(`Theme ${theme} not found`);
                        return;
                    }

                    context.terminal.options.theme = themes[theme];

                    context.state.updateState({
                        selectedTheme: theme,
                        customOptions: null,
                    });

                    await context.state.persist();

                    this.applyStyles(context);

                    context.writer.writeSuccess(`Theme ${theme} applied`);
                },
            },
            {
                command: 'set',
                allowUnlistedCommands: true,
                description: 'Set a theme variable',
                parameters: [
                    {
                        name: 'save',
                        description: 'Save the theme settings',
                        type: 'boolean',
                        required: false,
                    },
                ],
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const [key, value] = command.command.split(' ').slice(2);

                    if (!this.themeOptions.includes(key)) {
                        context.writer.writeError(
                            `Unsupported key: ${key}, supported keys: ${this.themeOptions.join(', ')}`,
                        );
                        return;
                    }

                    context.terminal.options.theme = {
                        ...context.terminal.options.theme,
                        [key]: value,
                    };

                    context.state.updateState({
                        selectedTheme: null,
                        customOptions: context.terminal.options.theme,
                    });

                    context.writer.writeSuccess(`Set ${key} to ${value}`);

                    this.applyStyles(context);

                    if (command.args['save']) {
                        await this.saveTheme(context);
                    }
                },
            },
            {
                command: 'save',
                description: 'Save the current theme settings',
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    context.terminal.options.theme = {};
                    context.state.updateState({
                        selectedTheme: null,
                        customOptions: context.terminal.options.theme,
                    });

                    await this.saveTheme(context);
                },
            },
            {
                command: 'reset',
                description: 'Reset the theme to the default',
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    context.terminal.options.theme = { ...this.defaultTheme };
                    context.state.reset();
                    await context.state.persist();
                    context.writer.writeSuccess('Theme reset to default');
                },
            },
        ];
    }

    async initialize(context: ICliExecutionContext): Promise<void> {
        this.defaultTheme = context.terminal.options.theme!;
        const state = context.state.getState<ThemeState>();

        if (state.selectedTheme && state.selectedTheme !== 'default') {
            context.terminal.options.theme = themes[state.selectedTheme];
        } else if (state.customOptions) {
            context.terminal.options.theme = state.customOptions;
        }

        this.applyStyles(context);
    }

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        context.executor.showHelp(command, context);
    }

    private applyStyles(context: ICliExecutionContext) {
        const parents = document.getElementsByClassName('terminal-container');

        for (const parent of Array.from(parents)) {
            (parent as HTMLElement).style.background =
                context.terminal.options.theme?.background ||
                this.defaultTheme.background!;
        }
    }

    private async saveTheme(context: ICliExecutionContext): Promise<void> {
        await context.state.persist();

        context.writer.writeSuccess('Theme saved');
    }

    writeDescription?(context: ICliExecutionContext): void {
        const { writer } = context;
        writer.writeln('Customize the terminal appearance with themes and colors');
        writer.writeln();
        writer.writeln('📋 Usage:');
        writer.writeln(`  ${writer.wrapInColor('theme list', CliForegroundColor.Cyan)}                     🎨 List available themes`);
        writer.writeln(`  ${writer.wrapInColor('theme apply <name>', CliForegroundColor.Cyan)}               Apply a theme`);
        writer.writeln(`  ${writer.wrapInColor('theme current', CliForegroundColor.Cyan)}                    Show active theme`);
        writer.writeln(`  ${writer.wrapInColor('theme set <key> <value>', CliForegroundColor.Cyan)}          Set a theme variable`);
        writer.writeln(`  ${writer.wrapInColor('theme save', CliForegroundColor.Cyan)}                       💾 Save current settings`);
        writer.writeln(`  ${writer.wrapInColor('theme reset', CliForegroundColor.Cyan)}                      🔄 Reset to default`);
        writer.writeln();
        writer.writeln('📝 Examples:');
        writer.writeln(`  theme apply dracula              ${writer.wrapInColor('# Apply the Dracula theme', CliForegroundColor.Green)}`);
        writer.writeln(`  theme set background #1a1a2e     ${writer.wrapInColor('# Change background color', CliForegroundColor.Green)}`);
        writer.writeln(`  theme set foreground #e0e0e0     ${writer.wrapInColor('# Change text color', CliForegroundColor.Green)}`);
        writer.writeln();
        writer.writeln(`⚙️  Available options: ${writer.wrapInColor(this.themeOptions.join(', ') ?? '', CliForegroundColor.Blue)}`);
    }
}

const themeOptions: ITheme = {
    background: '',
    foreground: '',
    black: '',
    blue: '',
    brightBlack: '',
    brightBlue: '',
    brightCyan: '',
    brightGreen: '',
    brightMagenta: '',
    brightRed: '',
    brightWhite: '',
    brightYellow: '',
    cyan: '',
    green: '',
    magenta: '',
    red: '',
    white: '',
    yellow: '',
    cursor: '',
    cursorAccent: '',
    selectionBackground: '',
    selectionForeground: '',
    selectionInactiveBackground: '',
};
