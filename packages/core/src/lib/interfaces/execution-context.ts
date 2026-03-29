import { Terminal } from '@xterm/xterm';
import { Subject } from 'rxjs';
import {
    ICliClipboard,
    ICliCommandExecutorService,
    ICliCommandProcessor,
    ICliServiceProvider,
    ICliExecutionProcess,
    ICliLogger,
    ICliPercentageProgressBar,
    ICliSpinner,
    ICliStateStore,
    ICliTerminalWriter,
    ICliTextAnimator,
    ICliTranslationService,
    ICliHttpClient,
    ICliNotifier,
} from '.';
import { ICliInputReader } from './input-reader';
import { ICliBackgroundServiceRegistry } from './background-service';
import { CliOptions, ICliUserSession } from '../models';

/**
 * A managed timer handle returned by createInterval/createTimeout.
 * Managed timers are automatically cleared when full-screen mode exits
 * or the CLI component is destroyed.
 */
export interface ICliManagedTimer {
    /** Clear this timer immediately. */
    readonly clear: () => void;
}

/**
 * A managed interval handle with the ability to change the delay.
 */
export interface ICliManagedInterval extends ICliManagedTimer {
    /** Change the interval delay. Restarts the interval with the new delay. */
    readonly setDelay: (ms: number) => void;
}

/**
 * Options for entering full-screen mode.
 */
export interface CliFullScreenOptions {
    /**
     * Whether to show the terminal cursor. Defaults to `false` (cursor hidden).
     * Set to `true` for REPL / input-line interfaces where the user types text.
     */
    showCursor?: boolean;
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
     * The text animator to use for showing/hiding text
     */
    textAnimator?: ICliTextAnimator;

    /**
     * The progress bar to use for showing progress
     */
    progressBar: ICliPercentageProgressBar;

    /**
     * A subject that emits when the command is aborted
     */
    onAbort: Subject<void>;

    /**
     * Abort signal for the current command. Fires when the command is
     * cancelled via Ctrl+C or killed. Commands should check this signal
     * or listen to onAbort for cooperative cancellation.
     */
    signal?: AbortSignal;

    /**
     * The terminal to use for writing
     */
    terminal: Terminal;

    /**
     * The writer to use for writing to the terminal
     */
    writer: ICliTerminalWriter;

    /**
     * The reader to use for interactive input prompts (text, password, confirm, select)
     */
    reader: ICliInputReader;

    /**
     * The command executor to use for executing commands
     */
    executor: ICliCommandExecutorService;

    /**
     * The clipboard to use for copying/pasting
     */
    clipboard: ICliClipboard;

    /**
     * The state store to use for storing state
     */
    state: ICliStateStore;

    /**
     * The options for the CLI
     */
    options?: CliOptions;

    /**
     * Prints the prompt to the terminal.
     */
    showPrompt: (options?: {
        reset?: boolean;
        newLine?: boolean;
        keepCurrentLine?: boolean;
    }) => void;

    /**
     * Submit and execute a command — adds to history, runs the command,
     * and shows a new prompt afterwards. Used by both interactive input
     * and programmatic execution to ensure identical behaviour.
     */
    submitCommand(command: string): Promise<void>;

    /**
     * Notifier service for displaying status notifications in the panel header bar.
     * Supports severity levels: info, success, warn, error.
     * Cleared automatically when the command finishes.
     *
     * @example
     * ```ts
     * context.notifier.info('Downloading 45%...');
     * context.notifier.success('Connected to server');
     * context.notifier.warn('Rate limited, retrying...');
     * context.notifier.error('Connection failed');
     * context.notifier.clear();
     * ```
     */
    notifier: ICliNotifier;

    /**
     * Set the current processor as the context processor, i.e. the processor that will handle the command
     * @param processor The processor to set
     * @param silent Indicates if the setting should be silent, i.e. not write to the terminal
     * @param fullScreen When true, Ctrl+C is passed through to the processor (full-screen apps manage their own exit)
     */
    setContextProcessor: (
        processor: ICliCommandProcessor | undefined,
        silent?: boolean,
        fullScreen?: boolean,
    ) => void;

    /**
     * The number of visible characters the prompt occupies on the current line.
     */
    promptLength: number;

    /**
     * The current user input text on the active line.
     */
    readonly currentLine: string;

    /**
     * Sets the current line text.
     * @param line The new line content
     */
    setCurrentLine: (line: string) => void;

    /**
     * The cursor position within the current line.
     */
    cursorPosition: number;

    /**
     * Clears the current terminal line, including content that wraps across multiple rows.
     * Uses promptLength + currentLine.length to determine how many rows to clear.
     */
    clearLine: () => void;

    /**
     * Clears the current line content and reprints the prompt.
     */
    clearCurrentLine: () => void;

    /**
     * Refreshes the display of the current line (clears and redraws prompt + input).
     */
    refreshCurrentLine: () => void;

    /**
     * The process to use for exiting the CLI
     */
    process: ICliExecutionProcess;

    /**
     * The logger to use for logging
     */
    logger: ICliLogger;

    /**
     * The services to use for the CLI context
     */
    services: ICliServiceProvider;

    /**
     * The translation service for i18n string resolution.
     * Use `translator.t(key, defaultValue)` to get translated strings.
     */
    translator: ICliTranslationService;

    /**
     * Optional callback that returns the current path to display in the prompt.
     * Any plugin can set this to customize the path segment of the prompt
     * (e.g. a filesystem plugin showing the current working directory).
     * When set, the returned path replaces the default `~` in the prompt.
     * Return null to fall back to the default `~`.
     */
    promptPathProvider?: () => string | null;

    /**
     * Enter full-screen mode: switches to the alternate screen buffer,
     * positions the cursor at row 1 col 1, and sets the given processor
     * as the context processor so that all terminal input is routed to
     * its `onData` method.
     *
     * By default the cursor is hidden (suitable for games / editors that
     * manage their own cursor). Pass `{ showCursor: true }` to keep it
     * visible (suitable for REPL / input-line interfaces).
     *
     * @param processor The processor that will handle all input in full-screen mode
     * @param options Optional settings for full-screen mode
     */
    enterFullScreenMode: (
        processor: ICliCommandProcessor,
        options?: CliFullScreenOptions,
    ) => void;

    /**
     * Exit full-screen mode: restores the cursor, leaves the alternate screen buffer,
     * clears the context processor, and re-displays the prompt.
     */
    exitFullScreenMode: () => void;

    /**
     * Creates a managed interval that is automatically cleared when full-screen
     * mode exits or the CLI component is destroyed.
     * @param callback The function to call on each interval tick
     * @param ms The interval delay in milliseconds
     * @returns A managed interval handle with clear() and setDelay() methods
     */
    createInterval: (
        callback: () => void,
        ms: number,
    ) => ICliManagedInterval;

    /**
     * Creates a managed timeout that is automatically cleared when full-screen
     * mode exits or the CLI component is destroyed.
     * @param callback The function to call when the timeout fires
     * @param ms The timeout delay in milliseconds
     * @returns A managed timer handle with a clear() method
     */
    createTimeout: (callback: () => void, ms: number) => ICliManagedTimer;

    /**
     * Registry for managing background services and jobs.
     * Each CLI session owns its own isolated registry. Services registered here
     * are scoped to this session and destroyed when the engine shuts down.
     */
    backgroundServices: ICliBackgroundServiceRegistry;

    /**
     * HTTP client for making requests. Automatically wires the command's
     * abort signal so requests are cancelled on Ctrl+C.
     *
     * @example
     * ```ts
     * const data = await context.http.get<MyData>('https://api.example.com/data');
     * ```
     */
    http: ICliHttpClient;
}
