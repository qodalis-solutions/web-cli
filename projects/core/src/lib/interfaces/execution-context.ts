import { Terminal } from '@xterm/xterm';
import { Subject } from 'rxjs';
import {
    ICliClipboard,
    ICliCommandDataStore,
    ICliCommandExecutorService,
    ICliCommandProcessor,
    ICliContextServices,
    ICliExecutionProcess,
    ICliLogger,
    ICliPercentageProgressBar,
    ICliSpinner,
    ICliTerminalWriter,
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
     * Set the current processor as the context processor, i.e. the processor that will handle the command
     * @param processor The processor to set
     * @param silent Indicates if the setting should be silent, i.e. not write to the terminal
     */
    setContextProcessor(
        processor: ICliCommandProcessor,
        silent?: boolean,
    ): void;

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
    services: ICliContextServices;
}
