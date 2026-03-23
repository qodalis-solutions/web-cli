import { Observable, Subscription } from 'rxjs';
import {
    CliBackgroundColor,
    CliForegroundColor,
    CliLogLevel,
    CliProcessCommand,
    CliProvider,
    CliState,
    ICliUser,
    ICliUserSession,
} from '../models';
import { ICliExecutionContext } from './execution-context';
import {
    ICliCommandChildProcessor,
    ICliCommandParameterDescriptor,
    ICliCommandProcessor,
} from './command-processor';
import { ICliGlobalParameterHandler } from './global-parameter';

export interface CliTableOptions {
    /** Expand columns to fill the full terminal width. Default: false */
    fullWidth?: boolean;
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
     * @param message The message to write
     */
    writeSuccess(message: string): void;

    /**
     * Write an info message to the terminal
     * @param message The message to write
     */
    writeInfo(message: string): void;

    /**
     * Write an error message to the terminal
     * @param message The message to write
     */
    writeError(message: string): void;

    /**
     * Write a warning message to the terminal
     * @param message The message to write
     */
    writeWarning(message: string): void;

    /**
     * Wrap text in the specified foreground color.
     * @param text The text to wrap
     * @param color The foreground color to apply
     * @returns The text wrapped in ANSI color codes
     */
    wrapInColor(text: string, color: CliForegroundColor): string;

    /**
     * Wrap text in the specified background color.
     * @param text The text to wrap
     * @param color The background color to apply
     * @returns The text wrapped in ANSI background color codes
     */
    wrapInBackgroundColor(text: string, color: CliBackgroundColor): string;

    /**
     * Write a JSON object to the terminal
     * @param json The JSON object to write
     */
    writeJson(json: any): void;

    /**
     * Write content to a file (triggers a browser download)
     * @param fileName The name of the file to download
     * @param content The content to write to the file
     */
    writeToFile(fileName: string, content: string): void;

    /**
     * Write an object array as a table to the terminal
     * @param objects The objects to write to the table
     */
    writeObjectsAsTable(objects: any[]): void;

    /**
     * Write a table to the terminal
     * @param headers The headers of the table
     * @param rows The rows of the table
     * @param options Optional table rendering options
     */
    writeTable(headers: string[], rows: string[][], options?: CliTableOptions): void;

    /**
     * Write a divider to the terminal
     * @param options Optional: color, length, character
     */
    writeDivider(options?: {
        color?: CliForegroundColor;
        length?: number;
        char?: string;
    }): void;

    /**
     * Write a list of items to the terminal with bullet, numbered, or custom prefix.
     * @param items The list items to display
     * @param options Optional: ordered (numbered), prefix (custom marker), color
     */
    writeList(
        items: string[],
        options?: {
            ordered?: boolean;
            prefix?: string;
            color?: CliForegroundColor;
        },
    ): void;

    /**
     * Write aligned key-value pairs to the terminal.
     * @param entries Key-value pairs as a Record or array of tuples
     * @param options Optional: separator string, key color
     */
    writeKeyValue(
        entries: Record<string, string> | [string, string][],
        options?: { separator?: string; keyColor?: CliForegroundColor },
    ): void;

    /**
     * Write items in a multi-column layout.
     * @param items The items to arrange in columns
     * @param options Optional: number of columns, padding between columns
     */
    writeColumns(
        items: string[],
        options?: { columns?: number; padding?: number },
    ): void;

    /**
     * Write a clickable hyperlink using OSC 8 escape sequences.
     * In terminals that support OSC 8, the text is clickable. In others,
     * it falls back to displaying "text (url)".
     * @param text The visible link text
     * @param url The URL to link to
     */
    writeLink(text: string, url: string): void;

    /**
     * Write text inside a bordered box.
     * Useful for callouts, notices, and highlighted information.
     * @param content The content lines to display inside the box
     * @param options Optional: title, border color, padding
     */
    writeBox(
        content: string | string[],
        options?: {
            title?: string;
            borderColor?: CliForegroundColor;
            padding?: number;
        },
    ): void;

    /**
     * Write text with a specified indentation level.
     * Each level adds 2 spaces of indentation.
     * @param text The text to write
     * @param level The indentation level (default: 1)
     */
    writeIndented(text: string, level?: number): void;
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
     * Display the help output for a command, including its description,
     * sub-commands, and parameters.
     * @param command The parsed command to show help for
     * @param context The execution context
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

    /**
     * Register a global parameter handler.
     * Global parameters (e.g. --help, --version) are evaluated for every
     * command before the processor's own processCommand runs.
     * @param handler The global parameter handler to register
     */
    registerGlobalParameter(handler: ICliGlobalParameterHandler): void;

    /**
     * Returns the descriptors of all registered global parameters.
     * Used by help output and tab-completion.
     */
    getGlobalParameters(): ICliCommandParameterDescriptor[];
}

/**
 * Represents a registry for command processors
 */
export interface ICliCommandProcessorRegistry {
    /**
     * The processors registered with the registry
     */
    readonly processors: ICliCommandProcessor[];

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
     * Recursively searches for a processor matching the given command.
     * @param mainCommand The main command name.
     * @param chainCommands The remaining chain commands (if any).
     * @param processors The list of available processors.
     * @returns The matching processor or undefined if not found.
     */
    findProcessorInCollection(
        mainCommand: string,
        chainCommands: string[],
        processors: ICliCommandProcessor[],
    ): ICliCommandProcessor | undefined;

    /**
     * Get the root processor for a child processor
     * @param child The child processor
     */
    getRootProcessor(child: ICliCommandChildProcessor): ICliCommandProcessor;

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
 * Represents a tracked CLI process entry
 */
export interface ICliProcessEntry {
    pid: number;
    /** Display name (service name for bg services, command text for commands) */
    name: string;
    /** Process type */
    type: 'command' | 'daemon' | 'job' | 'service';
    command: string;
    startTime: number;
    status: 'running' | 'completed' | 'failed' | 'killed';
    exitCode?: number;
}

/** Options for registering a process */
export interface ICliProcessRegisterOptions {
    /** Display name (defaults to command) */
    name?: string;
    /** Process type (defaults to 'command') */
    type?: 'command' | 'daemon' | 'job' | 'service';
    /** Custom kill handler (e.g. for background services) */
    onKill?: () => Promise<void> | void;
}

/**
 * Registry for tracking CLI processes
 */
export interface ICliProcessRegistry {
    /** Register a new process, returns assigned PID */
    register(command: string, options?: ICliProcessRegisterOptions): { pid: number; abortController: AbortController };
    /** Mark process as completed */
    complete(pid: number, exitCode: number): void;
    /** Mark process as failed */
    fail(pid: number): void;
    /** Kill a process by PID */
    kill(pid: number): boolean;
    /** List all processes (running + recent completed) */
    list(): ICliProcessEntry[];
    /** Get the current foreground process PID */
    readonly currentPid: number | undefined;
}

/**
 * Represents a key-value store for the CLI
 */
export interface ICliKeyValueStore {
    /**
     * Retrieves a value by key.
     * @param key - The key to retrieve the value for.
     * @returns A promise resolving to the value or undefined if not found.
     */
    get<T = any>(key: string): Promise<T | undefined>;

    /**
     * Sets a key-value pair in the store.
     * @param key - The key to set.
     * @param value - The value to store.
     * @returns A promise resolving when the value is stored.
     */
    set(key: string, value: any): Promise<void>;

    /**
     * Removes a key-value pair by key.
     * @param key - The key to remove.
     * @returns A promise resolving when the key is removed.
     */
    remove(key: string): Promise<void>;

    /**
     * Clears all key-value pairs from the store.
     * @returns A promise resolving when the store is cleared.
     */
    clear(): Promise<void>;
}

/**
 * Reactive state store scoped to a command processor or module.
 *
 * State is a plain object (`Record<string, any>`). Updates are shallow-merged
 * (top-level keys are replaced, nested objects are not deep-merged).
 * `getState()` returns a snapshot — mutating the returned object has no effect;
 * always use `updateState()` to change state.
 */
export interface ICliStateStore {
    /**
     * Get a snapshot of the current state.
     * @returns A shallow copy of the state object
     */
    getState<T extends CliState = CliState>(): T;

    /**
     * Shallow-merge new values into the current state.
     * Only the provided keys are updated; other keys are preserved.
     * Triggers subscribers and persists if a storage backend is configured.
     * @param newState Partial state to merge with the current state
     */
    updateState(newState: Partial<CliState>): void;

    /**
     * Select a specific property or computed value from the state.
     * @param selector A function to project a slice of the state.
     * @returns Observable of the selected value.
     */
    select<K>(selector: (state: CliState) => K): Observable<K>;

    /**
     * Subscribe to state changes.
     * @param callback Callback function to handle state changes.
     * @returns Subscription object to manage the subscription.
     */
    subscribe(callback: (state: CliState) => void): Subscription;

    /**
     * Reset the state to its initial value.
     */
    reset(): void;

    /**
     * Persist the state to storage.
     */
    persist(): Promise<void>;

    /**
     * Initialize the state from storage.
     */
    initialize(): Promise<void>;
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
export interface ICliModule {
    /**
     * API version this module targets.
     * Modules with apiVersion < 2 (or missing) are rejected by v2 runtimes.
     */
    apiVersion: number;

    /** Unique module identifier, e.g. '@qodalis/cli-guid' */
    name: string;

    /** Semver version string */
    version?: string;

    /** Human-readable description */
    description?: string;

    /** Module names this module depends on (resolved before this module boots) */
    dependencies?: string[];

    /** Boot priority — lower values boot first (default: 0) */
    priority?: number;

    /** Command processors provided by this module */
    processors?: ICliCommandProcessor[];

    /** Services registered into the shared service container */
    services?: CliProvider[];

    /** Module configuration, set via configure() */
    config?: Record<string, any>;

    /**
     * Per-locale translation maps shipped by this module.
     * Keyed by locale code (e.g. 'es', 'fr'), each value is a flat
     * key-value map of translation keys to translated strings.
     *
     * These are automatically registered with the translation service
     * during module boot — no manual onInit() code required.
     *
     * @example
     * translations: {
     *   es: { 'cli.guid.description': 'Generar y validar UUIDs' },
     *   fr: { 'cli.guid.description': 'Générer et valider des UUIDs' },
     * }
     */
    translations?: Record<string, Record<string, string>>;

    /**
     * Returns a configured copy of this module.
     * Modules should narrow the config type via a module-specific interface.
     */
    configure?(config: any): ICliModule;

    /** Called after services are registered and before processors are initialized */
    onInit?(context: ICliExecutionContext): Promise<void>;

    /**
     * Optional first-run setup flow. Called during boot if the module
     * has not been set up yet (determined by a persisted flag in the
     * key-value store). Use context.reader to prompt the user for
     * initial configuration.
     *
     * @returns true to mark setup as complete; false/throw to abort
     * (module still loads, setup re-triggers next boot).
     */
    onSetup?(context: ICliExecutionContext): Promise<boolean>;

    /** Called after all modules have booted and the terminal is interactive */
    onAfterBoot?(context: ICliExecutionContext): Promise<void>;

    /** Called when the module is being torn down */
    onDestroy?(context: ICliExecutionContext): Promise<void>;
}

/**
 * A module that accepts typed configuration via `configure()`.
 * Extend this instead of `ICliModule` when your module has a config type.
 *
 * @example
 * ```ts
 * interface MyModuleConfig { verbose?: boolean }
 * const myModule: ICliConfigurableModule<MyModuleConfig> = {
 *     configure(config) { return { ...this, config }; },
 *     // ...
 * };
 * ```
 */
export interface ICliConfigurableModule<T extends Record<string, any> = Record<string, any>> extends ICliModule {
    configure(config: T): ICliModule;
}

/**
 * @deprecated Use ICliModule instead
 */
export type ICliUmdModule = ICliModule;

/**
 * Represents a logger for the CLI
 */
export interface ICliLogger {
    /**
     * Set the log level of the logger
     * @param level The log level to set
     * @returns void
     * @default CliLogLevel.ERROR
     */
    setCliLogLevel(level: CliLogLevel): void;

    /**
     * Log a general message (LOG level)
     * @param args The arguments to log
     */
    log(...args: any[]): void;

    /**
     * Log an informational message (INFO level)
     * @param args The arguments to log
     */
    info(...args: any[]): void;

    /**
     * Log a warning message (WARN level)
     * @param args The arguments to log
     */
    warn(...args: any[]): void;

    /**
     * Log an error message (ERROR level)
     * @param args The arguments to log
     */
    error(...args: any[]): void;

    /**
     * Log a debug message (DEBUG level)
     * @param args The arguments to log
     */
    debug(...args: any[]): void;
}

// ---------------------------------------------------------------------------
// Translation service
// ---------------------------------------------------------------------------

// Re-export from central tokens for backward compatibility
export { ICliTranslationService_TOKEN } from '../tokens';

/**
 * Provides internationalization (i18n) support for CLI strings.
 */
export interface ICliTranslationService {
    /**
     * Translate a key to the current locale.
     * @param key The translation key (e.g. 'cli.echo.description')
     * @param defaultValue The English fallback string (returned if no translation found)
     * @param params Optional interpolation parameters for `{param}` placeholders
     */
    t(key: string, defaultValue: string, params?: Record<string, string | number>): string;

    /**
     * Get the current locale code (e.g. 'en', 'es', 'fr').
     */
    getLocale(): string;

    /**
     * Set the active locale.
     * @param locale The locale code to switch to
     */
    setLocale(locale: string): void;

    /**
     * Register translations for a locale.
     * Can be called multiple times — translations are merged, with later calls overriding earlier ones.
     * @param locale The locale code
     * @param translations Flat key-value map of translation keys to translated strings
     */
    addTranslations(locale: string, translations: Record<string, string>): void;

    /**
     * Get all locale codes that have at least one registered translation.
     */
    getAvailableLocales(): string[];
}

/**
 * Dependency injection container for CLI services.
 * Services are registered with string tokens and retrieved by type.
 */
export interface ICliServiceProvider {
    /**
     * Retrieve a service by its injection token.
     * @param service The token (typically a `*_TOKEN` constant) identifying the service
     * @returns The service instance, cast to `T`
     * @throws If no service is registered for the given token
     */
    get<T = unknown>(service: any): T;

    /**
     * Register one or more service definitions.
     * @param definition A single provider or an array of providers to register
     */
    set(definition: CliProvider | CliProvider[]): void;
}

export * from './input-reader';

export * from './completion';

export * from './execution-context';

export * from './command-processor';

export * from './progress-bars';

export * from './command-hooks';

export * from './users';

export * from './engine-snapshot';

export * from './background-service';

export * from './worker-protocol';

export * from './global-parameter';

export * from './file-transfer';

export * from './drag-drop';

export * from './file-picker';

// ---------------------------------------------------------------------------
// Permission service
// ---------------------------------------------------------------------------

export * from './syntax-highlighting';

// Re-export from central tokens for backward compatibility
export { ICliPermissionService_TOKEN } from '../tokens';

import { ICliOwnership } from '../models/permissions';

/**
 * Abstract permission service for checking rwx permissions on resources.
 * The default implementation lives in @qodalis/cli-users; consumers can
 * replace it via the DI container.
 */
export interface ICliPermissionService {
    /**
     * Check whether a user may perform an action on a resource.
     * @param user        The acting user.
     * @param action      The requested operation.
     * @param ownership   Owner/group of the resource.
     * @param permissions Permission string (e.g. "rwxr-xr-x").
     * @returns true if allowed.
     */
    check(
        user: ICliUser,
        action: 'read' | 'write' | 'execute',
        ownership: ICliOwnership,
        permissions: string,
    ): boolean;

    /** Parse octal (e.g. "755") to a permission string (e.g. "rwxr-xr-x"). */
    parseOctal(octal: string): string;

    /** Convert a permission string (e.g. "rwxr-xr-x") to octal (e.g. "755"). */
    toOctal(permissions: string): string;
}
