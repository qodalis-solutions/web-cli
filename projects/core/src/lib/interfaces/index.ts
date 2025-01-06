import { Terminal } from '@xterm/xterm';
import { Observable, Subject } from 'rxjs';
import {
    CliBackgroundColor,
    CliForegroundColor,
    CliLogLevel,
    CliOptions,
    CliProcessCommand,
    CliProcessorMetadata,
    ICliUser,
    ICliUserSession,
} from '../models';

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
     * @default false
     * @remarks If true, the processor can handle unlisted commands. If false, the processor will only handle commands that are explicitly listed in the processors property
     * @remarks Optional if valueRequired is true
     */
    allowUnlistedCommands?: boolean;

    /**
     * If true, the value is required
     */
    valueRequired?: boolean;

    /**
     * The version of the command processor
     * @default '1.0.0'
     */
    version?: string;

    /**
     * The metadata for the command processor
     */
    metadata?: CliProcessorMetadata;

    /**
     * Processors that are nested under this processor
     */
    processors?: ICliCommandProcessor[];

    /**
     * Parameters that the command accepts
     */
    parameters?: ICliCommandParameterDescriptor[];

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
     * Write the description of the command
     * @param context The context in which the command is executed
     */
    writeDescription?(context: ICliExecutionContext): void;

    /**
     * A function that validates the command before execution
     * @param value The value to validate
     * @returns An object with a valid property that indicates if the value is valid and an optional message property that contains a message to display if the value is not valid
     */
    validateBeforeExecution?: (
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ) => {
        valid: boolean;
        message?: string;
    };

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
    writeln(text?: string): void;

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
    writeToFile: (fileName: string, content: string) => void;

    /**
     * Write an object array as a table to the terminal
     * @param objects The objects to write to the table
     * @returns void
     */
    writeObjectsAsTable(objects: any[]): void;

    /**
     * Write a table to the terminal
     * @param headers The headers of the table
     * @param rows The rows of the table
     * @returns void
     */
    writeTable(headers: string[], rows: string[][]): void;
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
export interface ICliSpinner extends ICliProgressBar {
    /**
     * Set the text of the spinner
     * @param text The text to set
     */
    setText: (text: string) => void;
}

export type CliPercentageProgressBarUpdateValueOptions = {
    /**
     * The type of update to perform
     * @default 'replace'
     */
    type?: 'replace' | 'increment';
};

/**
 * Represents a progress bar for the CLI
 */
export interface ICliPercentageProgressBar extends ICliProgressBar {
    /**
     * Update the progress of the progress bar
     * @param progress The progress to update to
     * @returns void
     */
    update: (
        progress: number,
        options?: CliPercentageProgressBarUpdateValueOptions,
    ) => void;

    /**
     * Complete the progress bar
     * @returns void
     */
    complete: () => void;

    /**
     * Set the text of the spinner
     * @param text The text to set
     */
    setText: (text: string) => void;
}

/**
 * Represents a clipboard for the CLI
 */
export interface ICliClipboard {
    /**
     * Write text to the clipboard
     * @param text The text to write to the clipboard
     * @returns void
     */
    write: (text: string) => Promise<void>;

    /**
     * Read text from the clipboard
     * @returns The text read from the clipboard
     */
    read: () => Promise<string>;
}

/**
 * Represents a service that executes commands
 */
export interface ICliCommandExecutorService {
    /**
     *
     * @param command
     * @param context
     */
    showHelp(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void>;

    /**
     * Execute a command
     * @param command The command to execute
     * @param context The context in which the command is executed
     */
    executeCommand(
        command: string,
        context: ICliExecutionContext,
    ): Promise<void>;
}

/**
 * Represents a registry for command processors
 */
export interface ICliCommandProcessorRegistry {
    /**
     * Find a processor for a command
     * @param mainCommand
     * @param chainCommands
     */
    findProcessor(
        mainCommand: string,
        chainCommands: string[],
    ): ICliCommandProcessor | undefined;

    /**
     * Register a processor
     * @param processor
     */
    registerProcessor(processor: ICliCommandProcessor): void;

    /**
     * Unregister a processor
     * @param processor
     */
    unregisterProcessor(processor: ICliCommandProcessor): void;
}

export interface ICliExecutionProcess {
    /**
     * Indicates if the process has exited
     */
    exited?: boolean;

    /**
     * The exit code of the process
     */
    exitCode?: number;

    /**
     * Indicates if the process is running
     */
    running: boolean;

    /**
     * The data of the process
     */
    data: any | undefined;

    /**
     * Exit the process
     * @param code The exit code
     * @returns void
     */
    exit: (
        /**
         * The exit code
         */
        code?: number,

        /**
         * Options for exiting the process
         */
        options?: {
            /**
             * Indicates if the exit should be silent, i.e. not throw an error
             */
            silent?: boolean;
        },
    ) => void;

    /**
     * Output data from the process
     * @param data The data to output
     */
    output(data: any): void;
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
    executor: ICliCommandExecutorService;

    /**
     * The clipboard to use for copying/pasting
     */
    clipboard: ICliClipboard;

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

    /**
     * Set the current main processor
     * @param processor The processor to set
     */
    setMainProcessor(processor: ICliCommandProcessor): void;

    /**
     * The process to use for exiting the CLI
     */
    process: ICliExecutionProcess;

    /**
     * The logger to use for logging
     */
    logger: ICliLogger;
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
    getUsers(options?: {
        query?: string;
        skip?: number;
        take?: number;
    }): Observable<ICliUser[]>;

    /**
     * Creates a user
     * @param user The user to create
     */
    createUser(user: Omit<ICliUser, 'id'>): Promise<ICliUser>;

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

/**
 * Represents a module for the CLI
 */
export interface ICliUmdModule {
    /**
     * The name of the module
     */
    name: string;

    /**
     * The processors for the module
     */
    processors: ICliCommandProcessor[];
}

/**
 * Represents a logger for the CLI
 */
export interface ICliLogger {
    /**
     * Set the log level of the logger
     * @param level The log level to set
     * @returns void
     * @default CliLogLevel.INFO
     */
    setCliLogLevel(level: CliLogLevel): void;

    /**
     * Log a message
     * @param args The arguments to log
     */
    log(...args: any[]): void;

    /**
     * Log a message
     * @param args The arguments to log
     */
    info(...args: any[]): void;

    /**
     * Log a message
     * @param args The arguments to log
     */
    warn(...args: any[]): void;

    /**
     * Log a message
     * @param args The arguments to log
     */
    error(...args: any[]): void;

    /**
     * Log a message
     * @param args The arguments to log
     */
    debug(...args: any[]): void;
}
