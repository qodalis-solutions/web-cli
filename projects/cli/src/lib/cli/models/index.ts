import {
    ITerminalInitOnlyOptions,
    ITerminalOptions,
    Terminal,
} from '@xterm/xterm';
import { CliCommandExecutorService } from '../services/cli-command-executor.service';
import { Observable, Subject } from 'rxjs';

export interface ICliCommandAuthor {
    /**
     * The name of the author
     */
    name: string;

    /**
     * The email of the author
     */
    email: string;
}

/**
 * Represents a command processor
 */
export interface ICliCommandProcessor {
    /**
     * The command that this processor handles
     */
    command: string;

    /**
     * A description of the command
     */
    description?: string;

    /**
     * The author of the command
     */
    author?: ICliCommandAuthor;

    /**
     * If true, the processor can handle unlisted commands
     */
    allowUnlistedCommands?: boolean;

    /**
     * The version of the command processor
     * @default '1.0.0'
     */
    version?: string;

    /**
     * Process the command
     * @param command The command to process
     * @param context The context in which the command is executed
     */
    processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void>;

    /**
     * Processors that are nested under this processor
     */
    processors?: ICliCommandProcessor[];

    /**
     * Parameters that the command accepts
     */
    parameters?: ICliCommandParameterDescriptor[];

    /**
     * Write the description of the command
     * @param context The context in which the command is executed
     */
    writeDescription?(context: ICliExecutionContext): void;

    /**
     * Initialize the command processor
     * @param context The context in which the command is executed
     */
    initialize?(context: ICliExecutionContext): Promise<void>;
}

/**
 * Represents a command parameter
 */
export interface ICliCommandParameterDescriptor {
    /**
     * The name of the parameter
     */
    name: string;

    /**
     * Aliases for the parameter
     */
    aliases?: string[];

    /**
     * A description of the parameter
     */
    description: string;

    /**
     * If true, the parameter is required
     */
    required: boolean;

    /**
     * The type of the parameter
     */
    type: string;

    /**
     * The default value of the parameter
     */
    defaultValue?: any;

    /**
     * A validator function that validates the value of the parameter
     * @param value The value to validate
     * @returns An object with a valid property that indicates if the value is valid and an optional message property that contains a message to display if the value is not valid
     */
    validator?: (value: any) => {
        /**
         * Indicates if the value is valid
         */
        valid: boolean;

        /**
         * An optional message to display if the value is not valid
         */
        message?: string;
    };
}

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

export interface ICliTerminalWriter {
    /**
     * Write text to the terminal
     * @param text The text to write
     */
    write(text: string): void;

    /**
     * Write text to the terminal followed by a newline
     * @param text The text to write
     */
    writeln(text: string): void;

    /**
     * Write a success message to the terminal
     * @param messag The message to write
     * @returns void
     */
    writeSuccess: (message: string) => void;

    /**
     * Write an info message to the terminal
     * @param messag The message to write
     * @returns void
     */
    writeInfo: (message: string) => void;

    /**
     * Write an error message to the terminal
     * @param message The message to write
     * @returns void
     */
    writeError: (message: string) => void;

    /**
     * Write a warning message to the terminal
     * @param message The message to write
     * @returns void
     */
    writeWarning: (message: string) => void;

    /**
     * Write a message to the terminal with the specified color
     * @param message The message to write
     * @param color The color to use
     * @returns void
     */
    wrapInColor: (text: string, color: CliForegroundColor) => string;

    /**
     * Write a message to the terminal with the specified background color
     * @param message The message to write
     * @param color The background color to use
     * @returns void
     */
    wrapInBackgroundColor: (text: string, color: CliBackgroundColor) => string;

    /**
     * Write a JSON object to the terminal
     * @param json The JSON object to write
     * @returns void
     */
    writeJson: (json: any) => void;

    /**
     * Write content to a file
     * @param fileName The name of the file to write to
     * @param content The content to write to the file
     * @returns void
     */
    writeToFileFile: (fileName: string, content: string) => void;
}

export interface ICliUser extends Record<string, any> {
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
}

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

export interface ICliProgressBar {
    /**
     * Indicates if the progress bar is running
     */
    isRunning: boolean;

    /**
     * Show the progress bar
     */
    show: () => void;

    /**
     * Hide the progress bar
     */
    hide: () => void;
}

/**
 * Represents a spinner for the CLI
 */
export interface ICliSpinner extends ICliProgressBar {}

/**
 * Represents a progress bar for the CLI
 */
export interface ICliPercentageProgressBar extends ICliProgressBar {
    /**
     * Update the progress of the progress bar
     * @param progress The progress to update to
     * @returns void
     */
    update: (progress: number) => void;

    /**
     * Complete the progress bar
     * @returns void
     */
    complete: () => void;
}

/**
 * Represents the context in which a command is executed
 */
export interface ICliExecutionContext {
    /**
     * The current user session
     */
    userSession?: ICliUserSession;

    /**
     * The spinner to use for showing/hiding the loader
     */
    spinner?: ICliSpinner;

    /**
     * The progress bar to use for showing progress
     */
    progressBar: ICliPercentageProgressBar;

    /**
     * A subject that emits when the command is aborted
     */
    onAbort: Subject<void>;

    /**
     * The terminal to use for writing
     */
    terminal: Terminal;

    /**
     * The writer to use for writing to the terminal
     */
    writer: ICliTerminalWriter;

    /**
     * The command executor to use for executing commands
     */
    executor: CliCommandExecutorService;

    /**
     * The data store to use for storing data
     */
    dataStore: ICliCommandDataStore;

    /**
     * The options for the CLI
     */
    options?: CliOptions;

    /**
     * The prompt to use for prompting the user for input
     */
    showPrompt: () => void;
}

/**
 * Represents a data store for storing data associated with commands
 */
export interface ICliCommandDataStore {
    /**
     * The data store
     */
    data: Record<string, Record<string, any>>;

    /**
     * Append data to the data store
     * @param command
     * @param key
     * @param data
     */
    appendData(command: string, key: string, data: any): void;

    /**
     * Get data from the data store
     * @param command
     * @param key
     */
    getData<T = any>(command: string, key: string): T;
}

/**
 * Options for the CLI
 */
export type CliOptions = {
    /**
     * The welcome message to display when the CLI starts
     */
    welcomeMessage?: string;

    /**
     * Hide the prompt to display when the CLI is ready to accept input
     */
    hideUserName?: boolean;

    /**
     * Custom terminal options
     */
    terminalOptions?: ITerminalOptions & ITerminalInitOnlyOptions;
};

/**
 * Represents a service that manages user sessions in the CLI
 */
export interface ICliUserSessionService {
    /**
     * Gets the current user session
     * @returns An observable that emits the current user session
     */
    getUserSession(): Observable<ICliUserSession | undefined>;

    /**
     * Sets the current user session
     * @param session The session to set
     */
    setUserSession(session: ICliUserSession): Promise<void>;
}

/**
 * Represents a service that manages users in the CLI
 */
export interface ICliUsersStoreService {
    /**
     * Gets the current users
     * @returns An observable that emits the current users
     */
    getUsers(): Observable<ICliUser[]>;

    /**
     * Sets the current users
     * @param users The users to set
     */
    setUsers(users: ICliUser[]): Promise<void>;

    /**
     * Gets a user by id
     * @param id The id of the user to get
     * @returns An observable that emits the user with the specified id
     */
    getUser(id: string): Observable<ICliUser | undefined>;
}

/**
 * Represents a service that pings the server
 */
export interface ICliPingServerService {
    /**
     * Pings the server
     */
    ping(): Promise<void>;
}
