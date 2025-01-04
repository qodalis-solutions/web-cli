import { ITerminalInitOnlyOptions, ITerminalOptions } from '@xterm/xterm';

export type CliProcessCommand = {
    /**
     * The command that was entered
     */
    command: string;

    /**
     * The chain of commands that were entered
     */
    chainCommands: string[];

    /**
     * The raw command that was entered
     */
    rawCommand: string;

    /**
     * The value of the command
     */
    value?: string;

    /**
     * The arguments that were entered
     */
    args: Record<string, any>;
};

export enum CliForegroundColor {
    Black = '\x1b[30m',
    Red = '\x1b[31m',
    Green = '\x1b[32m',
    Yellow = '\x1b[33m',
    Blue = '\x1b[34m',
    Magenta = '\x1b[35m',
    Cyan = '\x1b[36m',
    White = '\x1b[37m',
    Reset = '\x1b[0m',
}

export enum CliBackgroundColor {
    Black = '\x1b[40m',
    Red = '\x1b[41m',
    Green = '\x1b[42m',
    Yellow = '\x1b[43m',
    Blue = '\x1b[44m',
    Magenta = '\x1b[45m',
    Cyan = '\x1b[46m',
    White = '\x1b[47m',
}

export enum CliIcon {
    CheckIcon = '✔',
    CrossIcon = '✘',
    InfoIcon = 'ℹ',
    WarningIcon = '⚠',
}

export type ICliUser = {
    /**
     * The id of the user
     */
    id: string;

    /**
     * The name of the user
     */
    name: string;

    /**
     * The email of the user
     */
    email: string;

    /**
     * The groups the user belongs to
     * @default []
     */
    groups?: string[];
};

export interface ICliUserSession {
    /**
     * The user associated with the session
     */
    user: ICliUser;

    /**
     * The data associated with the user session
     */
    data?: Record<string, any>;
}

/**
 * Options for the CLI
 */
export type CliOptions = Record<string, any> & {
    /**
     * The welcome message to display when the CLI starts
     */
    welcomeMessage?: string;

    /**
     * If true, the welcome message is hidden
     * @default false
     */
    hideWelcomeMessage?: boolean;

    /**
     * Users module options
     */
    usersModule?: {
        /**
         * If true, the users module is enabled
         */
        enabled: boolean;

        /**
         * Hide the prompt to display when the CLI is ready to accept input
         */
        hideUserName?: boolean;
    };

    /**
     * Custom terminal options
     */
    terminalOptions?: ITerminalOptions & ITerminalInitOnlyOptions;
};

/**
 * Represents a package that can be installed
 */
export interface Package {
    /**
     * The name of the package
     */
    name: string;

    /**
     * The global name used to access the package
     */
    globalName?: string;

    /**
     * The version of the package
     */
    version: string;

    /**
     * The unpkg url to the package
     */
    url: string;

    /**
     * The dependencies for the module
     */
    dependencies?: Package[];
}

/**
 * Represents command processor metadata
 */
export type CliProcessorMetadata = Record<string, any> & {
    /**
     * If true, the processor is sealed and cannot be extended
     */
    sealed?: boolean;

    /**
     * If true, the processor requires the server to be running
     */
    requireServer?: boolean;

    /**
     * The module the processor belongs to
     */
    module?: string;
};

export const enums = {
    CliForegroundColor,
    CliBackgroundColor,
    CliIcon,
};
