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
} from '.';
import { CliOptions, ICliUserSession } from '../models';

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
     * Set the current processor as the context processor, i.e. the processor that will handle the command
     * @param processor The processor to set
     * @param silent Indicates if the setting should be silent, i.e. not write to the terminal
     */
    setContextProcessor: (
        processor: ICliCommandProcessor,
        silent?: boolean,
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
}
