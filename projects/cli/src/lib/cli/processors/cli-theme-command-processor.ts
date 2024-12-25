import { Injectable } from '@angular/core';
import {
    CliForegroundColor,
    CliProcessCommand,
    ICliCommandAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '../models';

import { DefaultLibraryAuthor } from '../../constants';
import { ITheme } from '@xterm/xterm';

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

@Injectable({
    providedIn: 'root',
})
export class CliThemeCommandProcessor implements ICliCommandProcessor {
    command = 'theme';

    description = 'Interact with the theme';

    author?: ICliCommandAuthor | undefined = DefaultLibraryAuthor;

    version?: string | undefined = '1.0.1';

    processors?: ICliCommandProcessor[] | undefined = [];

    private themeOptions: string[] = Object.keys(themeOptions);

    private defaultTheme: ITheme = themeOptions;

    constructor() {
        this.processors = [
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

                    context.writer.writeSuccess(`Set ${key} to ${value}`);

                    if (command.args['save']) {
                        this.saveTheme(context);
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
                    this.saveTheme(context);
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
                    localStorage.removeItem('cli-theme');
                    context.writer.writeSuccess('Theme reset to default');
                },
            },
        ];
    }

    async initialize(context: ICliExecutionContext): Promise<void> {
        this.defaultTheme = context.terminal.options.theme!;
        const savedTheme = localStorage.getItem('cli-theme');

        if (savedTheme) {
            context.terminal.options.theme = JSON.parse(savedTheme);
        }
    }

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        context.writer.writeError('Choose a sub-command');
    }

    private saveTheme(context: ICliExecutionContext): void {
        localStorage.setItem(
            'cli-theme',
            JSON.stringify(context.terminal.options.theme),
        );

        context.writer.writeSuccess('Theme saved');
    }

    writeDescription?(context: ICliExecutionContext): void {
        context.writer.writeln('Interact with the theme');
        context.writer.write('Available theme options: ');
        context.writer.writeln(
            context.writer.wrapInColor(
                this.themeOptions.join(', ') ?? '',
                CliForegroundColor.Blue,
            ),
        );

        context.writer.writeln('Examples:');
        context.writer.writeln(
            context.writer.wrapInColor(
                'theme set background red',
                CliForegroundColor.Magenta,
            ),
        );
        context.writer.writeln(
            context.writer.wrapInColor(
                'theme set foreground red',
                CliForegroundColor.Magenta,
            ),
        );
    }
}
