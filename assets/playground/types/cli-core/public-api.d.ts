import { ITerminalOptions, ITerminalInitOnlyOptions, Terminal, ITheme } from '@xterm/xterm';
import { Observable, Subscription, Subject } from 'rxjs';

type CliProcessCommand = {
    /**
     * The command that was entered
     */
    command: string;
    /**
     * Pipeline data passed from the previous command in a pipe chain.
     * When commands are piped (e.g. `cmd1 | cmd2`), the output of `cmd1`
     * is captured and passed here as input to `cmd2`. The shape depends
     * on what the upstream command produced (string, JSON object, array, etc.).
     */
    data?: any;
    /**
     * The chain of commands that were entered
     */
    chainCommands: string[];
    /**
     * The raw command that was entered
     */
    rawCommand: string;
    /**
     * The value of the command: the text after the command (and sub-command)
     * words, flags removed, as typed (quotes included). Prefer `positionals`
     * to read arguments.
     */
    value?: string;
    /**
     * The positional arguments, split like a shell: quotes removed
     * (`"my file.txt"` is one argument), backslash escapes applied, flags
     * excluded. `cat "a b.txt" c.txt` has `['a b.txt', 'c.txt']`. Set by the
     * engine for every command; empty when there are none.
     */
    positionals?: string[];
    /**
     * The arguments that were entered
     */
    args: Record<string, any>;
};

declare enum CliForegroundColor {
    Black = "\u001B[30m",
    Red = "\u001B[31m",
    Green = "\u001B[32m",
    Yellow = "\u001B[33m",
    Blue = "\u001B[34m",
    Magenta = "\u001B[35m",
    Cyan = "\u001B[36m",
    White = "\u001B[37m",
    Reset = "\u001B[0m"
}
declare enum CliBackgroundColor {
    Black = "\u001B[40m",
    Red = "\u001B[41m",
    Green = "\u001B[42m",
    Yellow = "\u001B[43m",
    Blue = "\u001B[44m",
    Magenta = "\u001B[45m",
    Cyan = "\u001B[46m",
    White = "\u001B[47m"
}

declare enum CliIcon {
    CheckIcon = "\u2714",// Success, completion
    CrossIcon = "\u2718",// Failure, error
    InfoIcon = "\u2139",// Information
    WarningIcon = "\u26A0",// Warning
    QuestionMark = "?",// Help or unknown state
    Exclamation = "\u2757",// Emphasis or alert
    Ellipsis = "\u2026",// Loading or truncated text
    Dot = "\u2022",// List item
    Bullet = "\u2023",// Alternate bullet point
    ArrowRight = "\u2192",// Navigation or next step
    ArrowLeft = "\u2190",// Previous step or navigation
    ArrowUp = "\u2191",// Up direction
    ArrowDown = "\u2193",// Down direction
    ArrowRightFilled = "\u25B6",// Navigation or next step (filled)
    ArrowLeftFilled = "\u25C0",// Previous step or navigation (filled)
    ArrowUpFilled = "\u25B2",// Up direction (filled)
    ArrowDownFilled = "\u25BC",// Down direction (filled)
    DoubleArrowRight = "\u00BB",// Fast forward or next
    DoubleArrowLeft = "\u00AB",// Rewind or previous
    Star = "\u2605",// Highlight or favorite (filled)
    StarEmpty = "\u2606",// Highlight or favorite (empty)
    Plus = "+",// Addition or increment
    Minus = "-",// Subtraction or decrement
    Progress = "\u23F3",// Indicating progress
    Success = "\u2705",// Success (alternative to CheckIcon)
    Failure = "\u274C",// Failure (alternative to CrossIcon)
    Clock = "\u23F0",// Time-related
    Timer = "\u23F1",// Stopwatch or timer
    Alarm = "\uD83D\uDD14",// Alarm or alert
    Calendar = "\uD83D\uDCC5",// Calendar or date
    Folder = "\uD83D\uDCC1",// Directory or file grouping
    FolderOpen = "\uD83D\uDCC2",// Open folder
    File = "\uD83D\uDCC4",// File or document
    Archive = "\uD83D\uDDC3",// Archive or file grouping
    Link = "\uD83D\uDD17",// Hyperlink or connection
    Chain = "\u26D3",// Chain or linked
    Bookmark = "\uD83D\uDD16",// Bookmark or save
    Edit = "\u270F",// Edit or modify
    Trash = "\uD83D\uDDD1",// Deletion or removal
    Add = "\u2795",// Add user or item
    Remove = "\u2796",// Remove user or item
    Reload = "\uD83D\uDD04",// Refresh or reload
    Save = "\uD83D\uDCBE",// Save or store
    Undo = "\u21A9",// Undo action
    Redo = "\u21AA",// Redo action
    Play = "\u25B6",// Start or play
    Pause = "\u23F8",// Pause or stop temporarily
    Stop = "\u23F9",// Stop or end
    Cancel = "\u274E",// Cancel or close
    User = "\uD83D\uDC64",// User or profile
    Group = "\uD83D\uDC65",// Group or team
    Lock = "\uD83D\uDD12",// Secured or locked
    Unlock = "\uD83D\uDD13",// Unlocked or accessible
    Help = "\u2753",// Help or support
    Key = "\uD83D\uDD11",// Authentication or key
    Shield = "\uD83D\uDEE1",// Security or protection
    Gear = "\u2699",// Settings or configuration
    Settings = "\u2699\uFE0F",// Settings (alternative)
    Theme = "\uD83C\uDFA8",// Theme or appearance
    Light = "\uD83D\uDCA1",// Light mode
    Bug = "\uD83D\uDC1E",// Bug or issue
    Wrench = "\uD83D\uDD27",// Maintenance or tools
    Hammer = "\uD83D\uDD28",// Build or fix
    Terminal = "\uD83D\uDCBB",// Terminal or command line
    Database = "\uD83D\uDDC4",// Database or storage
    Server = "\uD83D\uDDA5",// Server or host
    Cloud = "\u2601",// Cloud or remote
    Network = "\uD83C\uDF10",// Network or connection
    Monitor = "\uD83D\uDCFA",// Monitor or display
    Printer = "\uD83D\uDDA8",// Printer or output
    USB = "\uD83D\uDD0C",// USB or connection
    Speaker = "\uD83D\uDD0A",// Speaker or audio
    Microphone = "\uD83C\uDF99",// Microphone or input
    Camera = "\uD83D\uDCF7",// Camera or video
    Video = "\uD83C\uDFA5",// Video or media
    Music = "\uD83C\uDFB5",// Music or audio
    Phone = "\uD83D\uDCDE",// Phone or communication
    Package = "\uD83D\uDCE6",// Package or bundle
    Plugin = "\uD83E\uDDE9",// Plugin or extension
    Extension = "\uD83D\uDD0C",// Extension or connection
    Module = "\uD83E\uDDF1",// Module or package
    Evaluate = "\uD83D\uDD0D",// Evaluate or search
    Variable = "\uD835\uDC65",// Variable or setting
    Script = "\uD83D\uDCDC",// Script or code
    Code = "\uD83D\uDCDD",// Code or file
    Logs = "\uD83D\uDCCB",// Logs or history
    Power = "\u23FB",// On/Off state
    Heart = "\u2764",// Love or favorite
    Flame = "\uD83D\uDD25",// Trending or hot
    Growth = "\uD83D\uDCC8",// Growth or increase
    Decline = "\uD83D\uDCC9",// Decline or decrease
    WarningFilled = "\u26A0\uFE0F",// Warning (filled)
    Sun = "\u2600",// Brightness or day
    Moon = "\uD83C\uDF19",// Night or dark mode
    Rain = "\uD83C\uDF27",// Rain or bad weather
    Snow = "\u2744",// Snow or cold
    Lightning = "\u26A1",// Lightning or danger
    Tree = "\uD83C\uDF32",// Nature or environment
    Smile = "\uD83D\uDE0A",// Happiness or positive state
    Sad = "\uD83D\uDE22",// Sadness or negative state
    Angry = "\uD83D\uDE21",// Anger or frustration
    Clap = "\uD83D\uDC4F",// Applause or celebration
    ThumbsUp = "\uD83D\uDC4D",// Approval or success
    ThumbsDown = "\uD83D\uDC4E",// Disapproval or failure
    Rocket = "\uD83D\uDE80",// Launch or deploy
    Globe = "\uD83C\uDF0D",// Earth or international
    Medal = "\uD83C\uDFC5",// Achievement or award
    Trophy = "\uD83C\uDFC6",// Winner or champion
    Flag = "\uD83D\uDEA9",// Mark or flag
    StarFilled = "\u2B50",// Highlight or favorite
    StarOutline = "\u2729",// Alternate star icon
    Fireworks = "\uD83C\uDF86",// Celebration
    Balloon = "\uD83C\uDF88",// Party or fun
    Gift = "\uD83C\uDF81"
}

/**
 * A key a full-screen command reads while it runs (an editor, a game).
 * Hosts on touch screens show these as buttons, since on-screen keyboards
 * lack Ctrl, Esc and the arrows; help screens can list them.
 */
interface ICliCommandKey {
    /** Short button text: `'Save'`, `'↑'`, `'FLAG'` */
    label: string;
    /**
     * What the key sends to the command's `onData`, as a terminal would:
     * `'\x13'` (Ctrl+S), `'\x1b[A'` (Up), `' '` (Space), `'f'`
     */
    data: string;
    /** The usual key, for help: `'Ctrl+S'`, `'Space'`, `'F'` */
    key?: string;
    /** What the key does: `'Save the file'`; also the button's accessible name */
    description?: string;
    /** Repeats while held down (arrows, Delete) */
    repeat?: boolean;
}
/** The controls of a full-screen command, for hosts that show on-screen keys. */
interface ICliCommandControls {
    /** The keys the command reads, most used first */
    keys: ICliCommandKey[];
    /**
     * The command also reads typed text (an editor, a word game): touch hosts
     * keep the on-screen keyboard open next to the keys. Otherwise they may
     * close it so the command gets the whole screen.
     */
    textInput?: boolean;
    /** `data` of the key a tap on the screen sends (e.g. rotate, reveal), if any */
    tap?: string;
    /** Swipes on the screen send the arrow keys (games on a board) */
    swipe?: boolean;
}
/** Terminal input for the keys commands commonly declare. */
declare const CliKeyData: {
    readonly up: "\u001B[A";
    readonly down: "\u001B[B";
    readonly right: "\u001B[C";
    readonly left: "\u001B[D";
    readonly home: "\u001B[H";
    readonly end: "\u001B[F";
    readonly pageUp: "\u001B[5~";
    readonly pageDown: "\u001B[6~";
    readonly delete: "\u001B[3~";
    readonly escape: "\u001B";
    readonly enter: "\r";
    readonly backspace: "";
    readonly space: " ";
    /** Ctrl+<letter>: `ctrl('s')` is `'\x13'` */
    readonly ctrl: (letter: string) => string;
};

interface CliTableOptions {
    /** Expand columns to fill the full terminal width. Default: false */
    fullWidth?: boolean;
}
interface ICliTerminalWriter {
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
    writeList(items: string[], options?: {
        ordered?: boolean;
        prefix?: string;
        color?: CliForegroundColor;
    }): void;
    /**
     * Write aligned key-value pairs to the terminal.
     * @param entries Key-value pairs as a Record or array of tuples
     * @param options Optional: separator string, key color
     */
    writeKeyValue(entries: Record<string, string> | [string, string][], options?: {
        separator?: string;
        keyColor?: CliForegroundColor;
    }): void;
    /**
     * Write items in a multi-column layout.
     * @param items The items to arrange in columns
     * @param options Optional: number of columns, padding between columns
     */
    writeColumns(items: string[], options?: {
        columns?: number;
        padding?: number;
    }): void;
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
    writeBox(content: string | string[], options?: {
        title?: string;
        borderColor?: CliForegroundColor;
        padding?: number;
    }): void;
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
interface ICliClipboard {
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
 * Describes a global parameter (e.g. --help, --version) together with
 * the handler that executes when the parameter is present.
 *
 * Global parameters are checked for every command before the command
 * processor's own `processCommand` runs. If the handler returns `true`,
 * command execution is halted (the parameter "consumed" the invocation).
 */
interface ICliGlobalParameterHandler {
    /**
     * The parameter descriptor shown in help output and used for tab-completion.
     */
    parameter: ICliCommandParameterDescriptor;
    /**
     * Execution priority — lower values run first.
     * @default 0
     */
    priority?: number;
    /**
     * Evaluate and optionally handle the parameter.
     * @returns `true` to halt command execution, `false` to continue.
     */
    handle(args: Record<string, any>, processor: ICliCommandProcessor, command: CliProcessCommand, context: ICliExecutionContext): boolean | Promise<boolean>;
}

/**
 * Represents a service that executes commands
 */
interface ICliCommandExecutorService {
    /**
     * Display the help output for a command, including its description,
     * sub-commands, and parameters.
     * @param command The parsed command to show help for
     * @param context The execution context
     */
    showHelp(command: CliProcessCommand, context: ICliExecutionContext): Promise<void>;
    /**
     * Execute a command
     * @param command The command to execute
     * @param context The context in which the command is executed
     */
    executeCommand(command: string, context: ICliExecutionContext): Promise<void>;
    /**
     * Run a command line and return its output as text instead of showing it
     * (as `$(...)` does); its errors and warnings are still shown.
     */
    capture?(command: string, context: ICliExecutionContext): Promise<string>;
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
interface ICliCommandProcessorRegistry {
    /**
     * The processors registered with the registry
     */
    readonly processors: ICliCommandProcessor[];
    /**
     * Find a processor for a command
     * @param mainCommand
     * @param chainCommands
     */
    findProcessor(mainCommand: string, chainCommands: string[]): ICliCommandProcessor | undefined;
    /**
     * Recursively searches for a processor matching the given command.
     * @param mainCommand The main command name.
     * @param chainCommands The remaining chain commands (if any).
     * @param processors The list of available processors.
     * @returns The matching processor or undefined if not found.
     */
    findProcessorInCollection(mainCommand: string, chainCommands: string[], processors: ICliCommandProcessor[]): ICliCommandProcessor | undefined;
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
/**
 * Represents a tracked CLI process entry
 */
interface ICliProcessEntry {
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
interface ICliProcessRegisterOptions {
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
interface ICliProcessRegistry {
    /** Register a new process, returns assigned PID */
    register(command: string, options?: ICliProcessRegisterOptions): {
        pid: number;
        abortController: AbortController;
    };
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

interface ICliExecutionProcess {
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
    }) => void;
    /**
     * Output data from the process
     * @param data The data to output
     */
    output(data: any): void;
}

/**
 * Represents a key-value store for the CLI
 */
interface ICliKeyValueStore {
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
 * `getState()` returns a shallow copy: assigning its top-level keys has no
 * effect, and nested objects must not be mutated in place either; always use
 * `updateState()` to change state.
 *
 * Saved state is loaded once, before the store's command first runs (or by
 * `initialize()`), and merged over the initial state, so keys added to the
 * initial state later are present. Changes are saved with `persist()`, or
 * after every change with `autoPersist`.
 *
 * A store is global by default: one saved state shared by every terminal and
 * tab of the browser. A save writes only the top-level keys this terminal
 * changed (merged into what is saved, under a cross-tab lock), so terminals
 * changing different keys never overwrite each other; for the same key the
 * last save wins. Changes saved elsewhere are applied here, except keys
 * changed here and not saved yet. A store with `scope: 'session'` belongs to
 * one terminal and is never saved.
 */
interface ICliStateStore {
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
     * Change the state from its latest saved value and save it, atomically
     * (under a lock shared by all tabs): use it for read-modify-write changes
     * such as adding an item to a list, so terminals changing the same key at
     * once never lose each other's change.
     *
     * ```ts
     * await context.state.update((s) => ({ todos: [...s.todos, todo] }));
     * ```
     */
    update(change: (state: CliState) => Partial<CliState>): Promise<void>;
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
     * Persist the state to storage (does nothing when no storage is available).
     */
    persist(): Promise<void>;
    /**
     * Load the saved state, once: later calls resolve when that first load
     * is done and keep changes made since.
     */
    initialize(): Promise<void>;
    /** Read the saved state again, replacing the current state. */
    reload?(): Promise<void>;
}

/** Ownership metadata attached to files, directories, or other resources */
interface ICliOwnership {
    /** User ID of the owner */
    uid: string;
    /** Primary group name */
    gid: string;
}
/** Default file permissions: rw-r--r-- (644) */
declare const DEFAULT_FILE_PERMISSIONS = "rw-r--r--";
/** Default directory permissions: rwxr-xr-x (755) */
declare const DEFAULT_DIR_PERMISSIONS = "rwxr-xr-x";

/** A single audit log entry */
interface ICliAuditEntry {
    /** Entry id (server-assigned in server mode) */
    id?: string;
    /** When the event occurred */
    timestamp: number;
    /** Event type (e.g., 'login', 'logout', 'login_failed') */
    event: string;
    /** Username involved */
    username: string;
    /** Optional additional details */
    details?: string;
    /** Id of the user the entry is about, when known */
    userId?: string;
    /** The user who performed the action, when different from `username` */
    actor?: string;
    /** Id of the acting user, when different from the subject */
    actorId?: string;
    /** Extra data (e.g. remote address) */
    metadata?: Record<string, unknown>;
}
/** Service for persistent audit logging */
interface ICliAuditService {
    /** Log an audit entry (timestamp is added automatically) */
    log(entry: Omit<ICliAuditEntry, 'timestamp'>): Promise<void>;
    /** Retrieve audit entries with optional filtering */
    getEntries(options?: {
        limit?: number;
        event?: string;
        username?: string;
    }): Promise<ICliAuditEntry[]>;
    /** Clear all audit entries */
    clear(): Promise<void>;
}

/**
 * A permission an extension uses, declared so tools (`perms --list`,
 * `groupmod --grant` completion, docs) can show it. Declaring is optional:
 * any `resource:action` string can be granted and checked.
 */
interface CliPermissionDefinition {
    /** Permission string, `resource:action` (e.g. `files:chown`). */
    name: string;
    /** Human readable description. */
    description?: string;
    /** Module that declared it (filled in at registration). */
    module?: string;
}
/** Registry of permissions declared by modules (`ICliModule.permissions`). */
interface ICliPermissionRegistry {
    register(definitions: CliPermissionDefinition[], module?: string): void;
    list(): CliPermissionDefinition[];
    get(name: string): CliPermissionDefinition | undefined;
    /** Remove the permissions registered by `module` (when it is unloaded). */
    unregister?(module: string): void;
}
/** The identity checks are made against. */
interface ICliPrincipal {
    /** User id */
    id: string;
    /** Login name (used as file owner) */
    name: string;
    /** Group (role) names */
    groups: string[];
    /** Effective permissions (union of the groups' permissions) */
    permissions: string[];
}
/** rwx-style protected resource (files, directories, or anything an extension owns). */
interface ICliProtectedResource {
    ownership?: ICliOwnership;
    /** 9-char mode string, e.g. `rwxr-x---` */
    permissions?: string;
}
type CliAccessAction = 'read' | 'write' | 'execute';
/**
 * Authorization service. Provided by an auth module (the users module provides
 * one in local and in server mode). Extensions should use the helpers
 * {@link cliAuthorize} / {@link cliCanAccess}, which allow everything when no
 * authorization service is registered.
 */
interface ICliAuthorizationService {
    /** The signed-in principal, or undefined when nobody is signed in. */
    getPrincipal(): ICliPrincipal | undefined;
    /** Does the current principal hold `permission` (wildcards honoured)? */
    can(permission: string): boolean;
    /**
     * rwx check on a resource for the current principal (owner / group / other).
     * Principals holding `*` or any of `bypassPermissions` are always allowed.
     * Resources without a mode or ownership are allowed.
     */
    canAccess(resource: ICliProtectedResource, action: CliAccessAction, bypassPermissions?: string[]): boolean;
}
/** Thrown when an operation is not permitted. The message is user facing. */
declare class CliAccessDeniedError extends Error {
    readonly code = "EACCES";
    constructor(message?: string);
}
/** True for {@link CliAccessDeniedError} (also across bundle copies). */
declare function isCliAccessDeniedError(error: unknown): error is CliAccessDeniedError;
/**
 * Check a permission for the current principal. Returns `true` when no
 * authorization service is registered (no auth module loaded).
 */
declare function cliAuthorize(context: Pick<ICliExecutionContext, 'services'>, permission: string): boolean;
/**
 * rwx check for the current principal. Returns `true` when no authorization
 * service is registered.
 */
declare function cliCanAccess(context: Pick<ICliExecutionContext, 'services'>, resource: ICliProtectedResource, action: CliAccessAction, bypassPermissions?: string[]): boolean;
/**
 * Reference rwx evaluation shared by implementations of
 * {@link ICliAuthorizationService.canAccess}.
 */
declare function cliEvaluateAccess(principal: ICliPrincipal | undefined, resource: ICliProtectedResource, action: CliAccessAction, bypassPermissions?: string[]): boolean;

/**
 * Context passed to completion providers describing the current input state.
 */
interface ICliCompletionContext {
    /** Full current line text */
    input: string;
    /** Cursor position in the line */
    cursor: number;
    /** The token (word) being completed at the cursor position */
    token: string;
    /** Start index of the token in the input string */
    tokenStart: number;
    /** Index of the token among all tokens (0 = command, 1+ = arguments) */
    tokenIndex: number;
    /** All tokens parsed from the input */
    tokens: string[];
}
/**
 * Provides tab-completion candidates for CLI input.
 * Plugins can register providers to extend completion (e.g. file paths, custom values).
 */
interface ICliCompletionProvider {
    /**
     * Priority order. Lower values are checked first.
     * Built-in defaults: 100 (commands), 200 (parameters).
     * Plugins should use lower values (e.g. 50) to take precedence for specific commands.
     */
    priority: number;
    /**
     * Return completion candidates for the current input context.
     * Return an empty array if this provider does not apply.
     */
    getCompletions(context: ICliCompletionContext): string[] | Promise<string[]>;
}

interface ICliDragDropService {
    /** Emits an array of dropped File objects each time files are dropped onto the terminal */
    readonly onFileDrop: Observable<File[]>;
}

/**
 * Options for readFile file picker.
 */
interface CliFilePickerOptions {
    /** Allow selecting multiple files. Default: false. */
    multiple?: boolean;
    /**
     * File type filter. Accepts MIME types (e.g. 'image/*') or extensions
     * (e.g. '.json,.txt'). Maps to the HTML accept attribute in browsers
     * and file filter in Electron.
     */
    accept?: string;
    /**
     * When true, pick a directory instead of files. Default: false.
     * Cannot be combined with `multiple` — if both are set, `directory` takes precedence
     * and a single directory is returned.
     */
    directory?: boolean;
    /**
     * How to read file content. Default: 'text'.
     * - 'text': Read as UTF-8 string (suitable for text files)
     * - 'arraybuffer': Read as ArrayBuffer (suitable for binary files like images)
     */
    readAs?: 'text' | 'arraybuffer';
}
/**
 * Result returned by readFile for each selected file.
 */
interface CliFileResult {
    /** File name without path (e.g. 'config.json') */
    name: string;
    /** Full file path. Available in Electron, undefined in browser. */
    path?: string;
    /**
     * File content. Type depends on `CliFilePickerOptions.readAs`:
     * - 'text' (default): `string` (UTF-8 decoded)
     * - 'arraybuffer': `ArrayBuffer` (raw bytes)
     */
    content: string | ArrayBuffer;
    /** File size in bytes */
    size: number;
    /** MIME type (e.g. 'application/json', 'image/png') */
    type: string;
}
/**
 * Abstraction for environment-specific file picking.
 * Implementations handle the actual dialog interaction for their environment.
 */
interface ICliFilePickerProvider {
    /** Whether file picking is supported in this environment */
    readonly isSupported: boolean;
    /**
     * Open a file picker dialog and return selected files.
     * @returns Array of selected files, or null if the user cancelled
     */
    pickFiles(options?: CliFilePickerOptions): Promise<CliFileResult[] | null>;
    /**
     * Open a directory picker dialog and return the selected directory.
     * @returns The selected directory, or null if the user cancelled
     */
    pickDirectory(): Promise<CliFileResult | null>;
}

/**
 * Represents an entry in a file listing.
 */
interface ICliFileEntry {
    name: string;
    type: 'file' | 'directory';
    size: number;
    modified: string;
}

/**
 * Abstraction for file transfer operations.
 * Default implementation uses browser-native APIs (file picker, download dialog).
 * @qodalis/cli-files overrides with virtual FS backed by IndexedDB.
 */
interface ICliFileTransferService {
    readFile(path: string): Promise<string | null>;
    writeFile(path: string, content: string): Promise<void>;
    listFiles(path: string): Promise<ICliFileEntry[]>;
    exists(path: string): Promise<boolean>;
    downloadToBrowser(filename: string, content: string | Blob): void;
    uploadFromBrowser(accept?: string): Promise<{
        name: string;
        content: string;
    } | null>;
}

/**
 * Options for HTTP client requests.
 * Extends standard RequestInit with convenience fields.
 */
interface CliHttpRequestOptions extends Omit<RequestInit, 'method' | 'body'> {
    /**
     * Request timeout in milliseconds. When set, the request is automatically
     * aborted after this duration. Combines with any existing abort signal.
     */
    timeout?: number;
}
/**
 * HTTP client for making requests from command processors.
 *
 * Automatically merges the command's abort signal so that requests are
 * cancelled when the user presses Ctrl+C. Provides typed convenience
 * methods for common HTTP verbs as well as a raw `fetch()` for cases
 * that need full Response access (streaming, progress, etc.).
 *
 * Available on the execution context as `context.http`.
 *
 * @example
 * ```ts
 * // Typed JSON response
 * const users = await context.http.get<User[]>('https://api.example.com/users');
 *
 * // POST with body
 * await context.http.post('https://api.example.com/users', { name: 'John' });
 *
 * // Raw fetch for streaming
 * const response = await context.http.fetch('https://example.com/file.zip');
 * const reader = response.body?.getReader();
 * ```
 */
interface ICliHttpClient {
    /**
     * Make a raw HTTP request. Returns the full Response object for cases
     * that need streaming, headers, or status inspection.
     * The command's abort signal is automatically merged.
     */
    fetch(url: string, init?: RequestInit): Promise<Response>;
    /**
     * HTTP GET request. Returns the parsed JSON response body.
     */
    get<T = any>(url: string, options?: CliHttpRequestOptions): Promise<T>;
    /**
     * HTTP POST request. Automatically serializes the body as JSON
     * (unless body is FormData, Blob, string, or ArrayBuffer).
     * Returns the parsed JSON response body.
     */
    post<T = any>(url: string, body?: any, options?: CliHttpRequestOptions): Promise<T>;
    /**
     * HTTP PUT request. Automatically serializes the body as JSON.
     * Returns the parsed JSON response body.
     */
    put<T = any>(url: string, body?: any, options?: CliHttpRequestOptions): Promise<T>;
    /**
     * HTTP PATCH request. Automatically serializes the body as JSON.
     * Returns the parsed JSON response body.
     */
    patch<T = any>(url: string, body?: any, options?: CliHttpRequestOptions): Promise<T>;
    /**
     * HTTP DELETE request. Returns the parsed JSON response body (if any).
     */
    delete<T = any>(url: string, options?: CliHttpRequestOptions): Promise<T>;
    /**
     * HTTP HEAD request. Returns the full Response (no body parsing).
     */
    head(url: string, options?: CliHttpRequestOptions): Promise<Response>;
    /**
     * HTTP OPTIONS request. Returns the parsed JSON response body.
     */
    options<T = any>(url: string, options?: CliHttpRequestOptions): Promise<T>;
}
/**
 * Error thrown by `ICliHttpClient` JSON helpers (`get`, `post`, `put`,
 * `patch`, `delete`, `options`) when the server responds with a non-2xx status.
 *
 * Exposes the HTTP status so callers can react to specific responses
 * (for example, clearing a stored session token on `401`).
 *
 * @example
 * ```ts
 * try {
 *     await context.http.get(url);
 * } catch (e) {
 *     if (e instanceof CliHttpError && e.status === 401) {
 *         // token expired or revoked
 *     }
 * }
 * ```
 */
declare class CliHttpError extends Error {
    /** HTTP status code of the failed response */
    readonly status: number;
    /** HTTP status text of the failed response */
    readonly statusText: string;
    /** Parsed JSON error body, when the server returned one */
    readonly body?: unknown | undefined;
    constructor(message: string, 
    /** HTTP status code of the failed response */
    status: number, 
    /** HTTP status text of the failed response */
    statusText?: string, 
    /** Parsed JSON error body, when the server returned one */
    body?: unknown | undefined);
}

/** A sign-in session as listed by {@link ICliSessionsService}. Never carries a token. */
interface ICliSessionInfo {
    id: string;
    userId: string;
    userName: string;
    createdAt: number;
    lastActivity: number;
    /** When the session expires if idle; undefined when there is no timeout */
    expiresAt?: number;
    /** True for the caller's own session */
    current?: boolean;
    metadata?: {
        userAgent?: string;
        remoteAddress?: string;
        [key: string]: unknown;
    };
}
/**
 * Lists and revokes sign-in sessions. Implemented locally (sessions of this
 * browser) and by servers (all sessions). Used by `sessions` / `session-kick`.
 */
interface ICliSessionsService {
    /** All sessions visible to the caller */
    list(): Promise<ICliSessionInfo[]>;
    /** Revoke a session by id */
    revoke(sessionId: string, reason?: string): Promise<void>;
    /** Revoke every session of a user (optionally keeping one) */
    revokeUser(userId: string, options?: {
        exceptSessionId?: string;
        reason?: string;
    }): Promise<void>;
}

/** Represents a user lifecycle event */
interface ICliUserEvent {
    /** The type of event that occurred */
    type: 'login' | 'logout' | 'login_failed' | 'user_created' | 'user_deleted' | 'user_updated' | 'password_changed' | 'user_switched' | 'user_disabled' | 'user_enabled' | 'group_created' | 'group_updated' | 'group_deleted' | 'group_member_added' | 'group_member_removed' | 'session_revoked' | 'audit_cleared';
    /** The user involved in the event (for group events: the acting user) */
    user: ICliUser;
    /** The acting user's name, when different from `user` (e.g. an admin) */
    actor?: string;
    /** When the event occurred */
    timestamp: number;
    /** Optional additional details */
    details?: string;
    /** `user_updated`: the user's name before a rename (set only when the name changed) */
    previousName?: string;
}
/** Service that emits user lifecycle events for plugins to subscribe to */
interface ICliUserEventService {
    /** Observable stream of user events */
    readonly events$: Observable<ICliUserEvent>;
    /** Emit a user event */
    emit(event: ICliUserEvent): void;
}

/**
 * Represents a service that manages user sessions in the CLI
 */
interface ICliUserSessionService {
    /** Gets the current user session as a reactive stream */
    getUserSession(): Observable<ICliUserSession | undefined>;
    /** Sets the current user session */
    setUserSession(session: ICliUserSession): Promise<void>;
    /** Clears the current session (logout) */
    clearSession(): Promise<void>;
    /** Persists the current session to storage */
    persistSession(): Promise<void>;
    /** Restores a session from storage (called on boot) */
    restoreSession(): Promise<ICliUserSession | undefined>;
}
/**
 * Represents a service that manages users in the CLI
 */
interface ICliUsersStoreService {
    /** Gets users with optional filtering and pagination */
    getUsers(options?: {
        query?: string;
        skip?: number;
        take?: number;
    }): Observable<ICliUser[]>;
    /** Creates a new user */
    createUser(user: CliAddUser): Promise<ICliUser>;
    /** Gets a user by id, name, or email */
    getUser(id: string): Observable<ICliUser | undefined>;
    /** Updates an existing user */
    updateUser(id: string, updates: CliUpdateUser): Promise<ICliUser>;
    /** Deletes a user by id */
    deleteUser(id: string): Promise<void>;
}
/**
 * Represents a service that manages groups in the CLI
 */
interface ICliGroupsStoreService {
    /** Gets all groups */
    getGroups(): Observable<ICliGroup[]>;
    /** Gets a group by id or name */
    getGroup(id: string): Observable<ICliGroup | undefined>;
    /** Creates a new group (role), optionally with permissions */
    createGroup(name: string, description?: string, permissions?: string[]): Promise<ICliGroup>;
    /** Updates a group's description and/or permissions (by id or name) */
    updateGroup(id: string, updates: {
        description?: string;
        permissions?: string[];
    }): Promise<ICliGroup>;
    /** Adds a user (id or name) to a group (id or name) */
    addMember(groupId: string, userId: string): Promise<void>;
    /** Removes a user (id or name) from a group (id or name) */
    removeMember(groupId: string, userId: string): Promise<void>;
    /** Deletes a group by id */
    deleteGroup(id: string): Promise<void>;
    /** Gets all users that belong to a group */
    getGroupMembers(groupId: string): Observable<ICliUser[]>;
}
/**
 * Represents a service that handles authentication in the CLI
 */
interface ICliAuthService {
    /**
     * Authenticates a user and returns a session. `password` may be omitted
     * only when the implementation allows passwordless sign-in.
     */
    login(username: string, password?: string): Promise<ICliUserSession>;
    /**
     * Ends the current session. After `switchUser` the session it suspended is
     * resumed (Unix `exit` after `su`); otherwise the CLI is left signed out.
     */
    logout(): Promise<void>;
    /**
     * Switch to another user (`su`). Requires the target's password unless
     * the caller may skip it (implementation-defined, e.g. `users:update`).
     * Goes through the same lockout, events and audit as `login`.
     * Implementations may suspend the current session instead of ending it,
     * so that `logout` returns to it (like nested Unix shells).
     */
    switchUser?(username: string, password?: string): Promise<ICliUserSession>;
    /**
     * Sets or updates a user's password.
     * @param currentPassword The user's current password, when changing one's own
     * password. Server-backed implementations forward it so the server can
     * re-check it; local implementations may ignore it.
     */
    setPassword(userId: string, password: string, currentPassword?: string): Promise<void>;
    /** Verifies a password against stored credentials */
    verifyPassword(userId: string, password: string): Promise<boolean>;
    /** Hashes a password with a salt using Web Crypto SHA-256 */
    hashPassword(password: string, salt: string): Promise<string>;
    /** Validate password against policy. Returns error message or null if valid. */
    validatePassword?(password: string): string | null;
}

/**
 * Token for the CLI user session service.
 */
declare const ICliUserSessionService_TOKEN: CliToken<ICliUserSessionService>;
/**
 * Token for the CLI users store service.
 */
declare const ICliUsersStoreService_TOKEN: CliToken<ICliUsersStoreService>;
/**
 * Token for the CLI groups store service.
 */
declare const ICliGroupsStoreService_TOKEN: CliToken<ICliGroupsStoreService>;
/**
 * Token for the CLI auth service.
 */
declare const ICliAuthService_TOKEN: CliToken<ICliAuthService>;
/**
 * Token for registering completion providers via module services (multi: true).
 */
declare const ICliCompletionProvider_TOKEN: CliToken<ICliCompletionProvider>;
/**
 * Token for the drag-and-drop service.
 */
declare const ICliDragDropService_TOKEN: CliToken<ICliDragDropService>;
/**
 * Token for the file transfer service.
 */
declare const ICliFileTransferService_TOKEN: CliToken<ICliFileTransferService>;
/**
 * Token for the translation service.
 */
declare const ICliTranslationService_TOKEN: CliToken<ICliTranslationService>;
/**
 * Token for the permission service.
 */
declare const ICliPermissionService_TOKEN: CliToken<ICliPermissionService>;
/**
 * Token for the file picker provider.
 */
declare const ICliFilePickerProvider_TOKEN: CliToken<ICliFilePickerProvider>;
/**
 * Token for the HTTP client service.
 */
declare const ICliHttpClient_TOKEN: CliToken<ICliHttpClient>;
/**
 * Token for the user event service (lifecycle events).
 */
declare const ICliUserEventService_TOKEN: CliToken<ICliUserEventService>;
/**
 * Token for the audit service (persistent event logging).
 */
declare const ICliAuditService_TOKEN: CliToken<ICliAuditService>;
/**
 * Token for the authorization service ({@link ICliAuthorizationService}).
 * Provided by an auth module (e.g. `@qodalis/cli-users`); absent otherwise.
 */
declare const ICliAuthorizationService_TOKEN: CliToken<ICliAuthorizationService>;
/**
 * Token for the permission registry ({@link ICliPermissionRegistry}).
 * Always provided by the CLI engine.
 */
declare const ICliPermissionRegistry_TOKEN: CliToken<ICliPermissionRegistry>;
/**
 * Token for the sessions service ({@link ICliSessionsService}).
 */
declare const ICliSessionsService_TOKEN: CliToken<ICliSessionsService>;
/**
 * Token for the persistent key-value store used by modules (setup state, etc.).
 */
declare const ICliKeyValueStore_TOKEN: CliToken<ICliKeyValueStore>;

/**
 * Abstract permission service for checking rwx permissions on resources.
 * The default implementation lives in @qodalis/cli-users; consumers can
 * replace it via the DI container.
 */
interface ICliPermissionService {
    /**
     * Check whether a user may perform an action on a resource.
     * @param user        The acting user.
     * @param action      The requested operation.
     * @param ownership   Owner/group of the resource.
     * @param permissions Permission string (e.g. "rwxr-xr-x").
     * @returns true if allowed.
     */
    check(user: ICliUser, action: 'read' | 'write' | 'execute', ownership: ICliOwnership, permissions: string): boolean;
    /** Parse octal (e.g. "755") to a permission string (e.g. "rwxr-xr-x"). */
    parseOctal(octal: string): string;
    /** Convert a permission string (e.g. "rwxr-xr-x") to octal (e.g. "755"). */
    toOctal(permissions: string): string;
}

/**
 * Represents an option for the readSelect and readSelectInline prompts.
 */
interface CliSelectOption {
    /** Display text shown to the user */
    label: string;
    /** Value returned when this option is selected */
    value: string;
    /** Optional description shown as dimmed italic text after the label */
    description?: string;
    /** Group name — options sharing the same group are displayed under a group header */
    group?: string;
    /** When true, the option is visible but cannot be selected (rendered dimmed) */
    disabled?: boolean;
}
/**
 * Represents an option for the readMultiSelect prompt.
 */
interface CliMultiSelectOption extends CliSelectOption {
    /** Whether the option is pre-selected */
    checked?: boolean;
}
/**
 * Options for readLine input.
 */
interface CliLineOptions {
    /**
     * Pre-filled default value. Shown in the buffer when the prompt opens.
     * The cursor starts at the end of the default text.
     */
    default?: string;
    /**
     * Validation function called on Enter.
     * Return an error message string to reject the input and display the error.
     * Return null to accept the input.
     */
    validate?: (value: string) => string | null;
    /** Placeholder text shown dimmed when the buffer is empty */
    placeholder?: string;
}
/**
 * Options for readSelect and readSelectInline.
 */
interface CliSelectOptions {
    /** Pre-select an option by its value */
    default?: string;
    /** Enable type-to-filter. When true, printable keystrokes filter the option list. Default: false. */
    searchable?: boolean;
    /** Callback invoked each time the highlighted option changes */
    onChange?: (value: string) => void;
}
/**
 * Options for readMultiSelect.
 */
interface CliMultiSelectOptions {
    /** Enable type-to-filter. When true, printable keystrokes filter the option list. Default: false. */
    searchable?: boolean;
    /** Callback invoked each time the set of checked options changes */
    onChange?: (values: string[]) => void;
}
/**
 * Options for readNumber input.
 */
interface CliNumberOptions {
    /** Minimum allowed value */
    min?: number;
    /** Maximum allowed value */
    max?: number;
    /** Pre-filled default value */
    default?: number;
}
/**
 * Options for readDate input.
 */
interface CliDateOptions {
    /**
     * Date format string. Supported tokens: YYYY (4-digit year), MM (2-digit month),
     * DD (2-digit day). Separators can be `-`, `/`, or `.`.
     * @default 'YYYY-MM-DD'
     */
    format?: string;
    /** Minimum allowed date in the same format as `format` */
    min?: string;
    /** Maximum allowed date in the same format as `format` */
    max?: string;
    /** Pre-filled default value */
    default?: string;
}
/**
 * Provides interactive input reading from the terminal.
 * All methods resolve with `null` when the user aborts (Ctrl+C or Escape).
 */
interface ICliInputReader {
    /**
     * Read a line of text input.
     * @param prompt - The prompt text displayed to the user
     * @param options - Optional configuration for default value, validation, and placeholder
     * @returns The entered text, or null if aborted
     */
    readLine(prompt: string, options?: CliLineOptions): Promise<string | null>;
    /**
     * Read a password (masked input).
     * @param prompt - The prompt text displayed to the user
     * @returns The entered password, or null if aborted
     */
    readPassword(prompt: string): Promise<string | null>;
    /**
     * Read a yes/no confirmation.
     * @param prompt - The prompt text displayed to the user
     * @param defaultValue - Default value when Enter is pressed without input
     * @returns true for yes, false for no, or null if aborted
     */
    readConfirm(prompt: string, defaultValue?: boolean): Promise<boolean | null>;
    /**
     * Read a selection from a vertical list of options.
     * @param prompt - The prompt text displayed to the user
     * @param options - Array of options to choose from
     * @param selectOptions - Optional configuration for default, search, onChange
     * @returns The selected option's value, or null if aborted
     */
    readSelect(prompt: string, options: CliSelectOption[], selectOptions?: CliSelectOptions): Promise<string | null>;
    /**
     * Read a selection from an inline horizontal list.
     * @param prompt - The prompt text displayed to the user
     * @param options - Array of options to choose from
     * @param selectOptions - Optional configuration for default, search, onChange
     * @returns The selected option's value, or null if aborted
     */
    readSelectInline(prompt: string, options: CliSelectOption[], selectOptions?: CliSelectOptions): Promise<string | null>;
    /**
     * Read multiple selections from a checkbox list.
     * @param prompt - The prompt text displayed to the user
     * @param options - Array of options with optional pre-checked state
     * @param selectOptions - Optional configuration for search, onChange
     * @returns Array of selected option values, or null if aborted
     */
    readMultiSelect(prompt: string, options: CliMultiSelectOption[], selectOptions?: CliMultiSelectOptions): Promise<string[] | null>;
    /**
     * Read a number input.
     * @param prompt - The prompt text displayed to the user
     * @param options - Optional configuration for min, max, and default value
     * @returns The entered number, or null if aborted
     */
    readNumber(prompt: string, options?: CliNumberOptions): Promise<number | null>;
    /**
     * Read a date input with format validation.
     * @param prompt - The prompt text displayed to the user
     * @param options - Optional configuration for format, min/max range, default
     * @returns The date string in the specified format, or null if aborted
     */
    readDate(prompt: string, options?: CliDateOptions): Promise<string | null>;
    /**
     * Read file(s) via the environment's file picker dialog.
     * @param prompt - The prompt text displayed to the user
     * @param options - Optional configuration for multiple, accept filter, directory mode
     * @returns Array of selected files with content, or null if cancelled/unsupported
     */
    readFile(prompt: string, options?: CliFilePickerOptions): Promise<CliFileResult[] | null>;
}

interface ICliProgressBar {
    /**
     * Indicates if the progress bar is running
     */
    isRunning: boolean;
    /**
     * Show the progress bar
     */
    show: (text?: string) => void;
    /**
     * Hide the progress bar
     */
    hide: () => void;
}
/**
 * Represents a spinner for the CLI
 */
interface ICliSpinner extends ICliProgressBar {
    /**
     * Set the text of the spinner
     * @param text The text to set
     */
    setText: (text: string) => void;
}
type CliPercentageProgressBarUpdateValueOptions = {
    /**
     * The type of update to perform
     * @default 'replace'
     */
    type?: 'replace' | 'increment';
};
/**
 * Represents a progress bar for the CLI
 */
interface ICliPercentageProgressBar extends ICliProgressBar {
    /**
     * Update the progress of the progress bar.
     * @param progress The progress value (0–100). Values outside this range are clamped.
     * @param options Optional: update type ('replace' or 'increment')
     */
    update: (progress: number, options?: CliPercentageProgressBarUpdateValueOptions) => void;
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
type CliTextAnimatorOptions = {
    /**
     * The speed of the animation
     * @default 100
     */
    speed?: number;
    /**
     * The text will be removed after typing
     */
    removeAfterTyping?: boolean;
};
interface ICliTextAnimator extends ICliProgressBar {
    /**
     * Show animated text in a typing and erasing effect.
     * @param text The text to animate
     * @param options Optional: speed (ms per character), removeAfterTyping
     * @returns A promise that resolves when the animation completes
     */
    showText: (text: string, options?: CliTextAnimatorOptions) => Promise<void>;
    /**
     * Stop the running animation, erase what it wrote and resolve the
     * `showText` promise. Optional for backward compatibility.
     */
    cancel?: () => void;
}

/**
 * Result of a guard check.
 *
 * - `true` or `undefined`: allow the command.
 * - `false`: block it with the generic message `<command>: permission denied`.
 * - a non-empty `string`: block it and print this message.
 * - `{ allowed, message }`: explicit form; `message` is used when `allowed` is false.
 */
type CliCommandGuardResult = boolean | string | void | {
    allowed: boolean;
    message?: string;
};
/**
 * A global command guard: a check that runs before **every** command, across
 * all processors and modules, and can block it.
 *
 * Use guards for cross-cutting policies such as authentication, permission
 * checks, feature flags, maintenance windows or rate limiting, instead of
 * repeating the check inside each processor.
 *
 * ## When guards run
 *
 * For each command the executor:
 * 1. parses the input and resolves the processor (and sub-processor);
 * 2. handles global parameters such as `--help` (help is never guarded);
 * 3. extracts the positional value into `command.value`;
 * 4. **runs the guards**;
 * 5. validates required values/parameters, runs processor hooks and finally
 *    calls `processCommand`.
 *
 * Guards run in ascending `priority` (default `0`). For each guard the executor
 * calls `appliesTo` (if defined) and skips the guard when it returns `false`;
 * otherwise it awaits `canActivate`. The **first** guard that blocks stops the
 * chain: its message is written as an error and the command exits with code
 * `-1`. A guard that throws (in `appliesTo` or `canActivate`) also blocks the
 * command, so a broken guard fails closed.
 *
 * ## Access to the context
 *
 * Both `appliesTo` and `canActivate` receive the {@link ICliExecutionContext}
 * of the command about to run, so a guard can:
 * - resolve services with `context.services.get(...)` / `getRequired(...)`
 *   (e.g. a policy, feature-flag or permission service registered by any
 *   module) to decide **what** should be guarded and **whether** it may run;
 * - inspect `context.userSession` for the signed-in user and their groups;
 * - read the processor's `metadata` (for example `requireAuth` or
 *   `requiredGroups`) and the parsed `command` (`command.value`, `command.args`);
 * - prompt the user via `context.reader` (e.g. a confirmation guard).
 *
 * Guards should not write to the terminal to report a denial; return a message
 * instead so the executor prints it consistently.
 *
 * ## Registering guards
 *
 * The preferred way is the module's `guards` array; the boot sequence
 * registers each entry as a multi-provider under {@link ICliCommandGuard_TOKEN}.
 * Several modules can contribute guards; all of them run.
 *
 * ```ts
 * const billingModule: ICliModule = {
 *     apiVersion: 2,
 *     name: 'billing',
 *     processors: [new InvoiceProcessor()],
 *     guards: [billingGuard],
 * };
 * ```
 *
 * Guards can also be added at runtime (e.g. from `onInit`):
 *
 * ```ts
 * context.services.set({ provide: ICliCommandGuard_TOKEN, useValue: myGuard, multi: true });
 * ```
 *
 * ## Example: policy resolved from a service
 *
 * ```ts
 * const featureFlagGuard: ICliCommandGuard = {
 *     name: 'feature-flags',
 *     // Only guard commands that are behind a flag; the flag list comes from a service
 *     appliesTo: (processor, _command, context) =>
 *         context.services.get<FeatureFlags>(FeatureFlags_TOKEN)?.isFlagged(processor.command) ?? false,
 *     canActivate: async (_command, processor, context) => {
 *         const flags = context.services.getRequired<FeatureFlags>(FeatureFlags_TOKEN);
 *         return (await flags.isEnabled(processor.command, context.userSession?.user))
 *             ? true
 *             : `${processor.command}: not available for your account`;
 *     },
 * };
 * ```
 *
 * ## Without a guard-providing module
 *
 * Guards are opt-in. When no guard is registered every command runs as before.
 * The engine registers three built-in guards that enforce the processor access
 * metadata (`requireAuth`, `requiredGroups`, `requiredPermissions`); they stay
 * inactive until an auth module (e.g. `@qodalis/cli-users`) registers an
 * `ICliAuthorizationService`, so without one that metadata is informational.
 */
interface ICliCommandGuard {
    /** Unique name, shown in diagnostics when the guard throws. */
    name: string;
    /** Execution order; lower runs first. Defaults to `0`. */
    priority?: number;
    /**
     * Optional filter deciding whether this guard is relevant for the command.
     * Return `false` to skip the guard. When omitted the guard applies to
     * every command. May be async, and may use `context` to resolve services.
     */
    appliesTo?(processor: ICliCommandProcessor, command: CliProcessCommand, context: ICliExecutionContext): boolean | Promise<boolean>;
    /**
     * Decide whether the command may run. See {@link CliCommandGuardResult}
     * for the accepted return values.
     */
    canActivate(command: CliProcessCommand, processor: ICliCommandProcessor, context: ICliExecutionContext): CliCommandGuardResult | Promise<CliCommandGuardResult>;
}
/** DI token for {@link ICliCommandGuard}; register guards as multi-providers. */
declare const ICliCommandGuard_TOKEN: CliToken<ICliCommandGuard>;

/**
 * Represents a serialized snapshot of a CLI engine's state.
 * Used to duplicate terminal tabs with full state preservation.
 */
interface CliEngineSnapshot {
    /** Schema version for forward compatibility */
    version: 1;
    /** Timestamp (ms since epoch) when the snapshot was taken */
    timestamp: number;
    /** Serialized terminal state */
    terminal: {
        /** Terminal buffer serialized via @xterm/addon-serialize */
        serializedBuffer: string;
        /** Terminal column count at time of snapshot */
        cols: number;
        /** Terminal row count at time of snapshot */
        rows: number;
    };
    /** Command history entries (most recent last) */
    commandHistory: string[];
    /** Named state store entries */
    stateStores: Array<{
        name: string;
        state: Record<string, any>;
    }>;
}

/**
 * Background service lifecycle type.
 * - `'daemon'` — Long-running service whose `onStart` blocks until the abort signal
 *   fires. Suitable for event loops, polling, or WebSocket connections. Can be
 *   stopped and restarted.
 * - `'job'` — Run-to-completion task whose `onStart` resolves when the work is done.
 *   Automatically transitions to `'done'` status on success. Cannot be restarted.
 */
type CliBackgroundServiceType = 'daemon' | 'job';
/**
 * Lifecycle status of a background service.
 */
type CliBackgroundServiceStatus = 'pending' | 'running' | 'stopped' | 'failed' | 'done';
/**
 * Where the service code is executing.
 */
type CliServiceExecutionMode = 'main-thread' | 'worker';
/**
 * An event emitted by a background service.
 * Services control terminal notification visibility by setting `data.notify: true`.
 */
interface ICliServiceEvent {
    /** Name of the service that emitted this event */
    source: string;
    /** Event type — services define their own, registry emits lifecycle events */
    type: string;
    /** Arbitrary payload */
    data?: unknown;
    /** Set automatically by the registry */
    timestamp?: Date;
}
/**
 * Handler function for service events.
 */
type CliServiceEventHandler = (event: ICliServiceEvent) => void;
/**
 * Log severity level for background service messages.
 * Shared by `ICliServiceLogEntry`, `ICliServiceContext.log()`,
 * and `WorkerServiceContext.log()`.
 */
type CliServiceLogLevel = 'info' | 'warn' | 'error';
/**
 * A single log entry from a background service.
 */
interface ICliServiceLogEntry {
    timestamp: Date;
    level: CliServiceLogLevel;
    message: string;
}
/**
 * Per-service runtime context.
 * Each background service receives its own context with an independent abort signal
 * and scoped timers (not shared with the full-screen timer set).
 */
interface ICliServiceContext {
    /** AbortSignal scoped to this service — independent of Ctrl+C */
    signal: AbortSignal;
    /** Emit an event from this service */
    emit(event: ICliServiceEvent): void;
    /** Log a message to this service's private log buffer */
    log(message: string, level?: CliServiceLogLevel): void;
    /** Create an interval scoped to this service (auto-cleared on stop) */
    createInterval(callback: () => void, ms: number): ICliManagedInterval;
    /** Create a timeout scoped to this service (auto-cleared on stop) */
    createTimeout(callback: () => void, ms: number): ICliManagedTimer;
    /** Access the shared state store */
    state: ICliStateStore;
    /** Access the shared service container */
    services: ICliServiceProvider;
}
/**
 * A background service that can run as a daemon or job.
 */
interface ICliBackgroundService {
    /** Unique name for this service */
    name: string;
    /** Human-readable description */
    description?: string;
    /** 'daemon' for long-running, 'job' for run-to-completion */
    type: CliBackgroundServiceType;
    /** Whether this service can run in a Web Worker */
    workerCompatible?: boolean;
    /** Factory that creates the Worker instance (when workerCompatible) */
    workerFactory?: () => Worker;
    /** Called when the service starts */
    onStart(context: ICliServiceContext): Promise<void>;
    /** Called for graceful shutdown */
    onStop?(context: ICliServiceContext): Promise<void>;
    /**
     * Called when the service throws an unrecoverable error.
     * Use this hook for logging or cleanup; throwing from `onError` itself
     * is safe — the registry catches it and marks the service as failed.
     */
    onError?(error: Error, context: ICliServiceContext): void;
}
/**
 * Read-only snapshot of a background service's current state.
 */
interface ICliBackgroundServiceInfo {
    /** Process ID assigned by the process registry */
    pid?: number;
    name: string;
    description?: string;
    type: CliBackgroundServiceType;
    status: CliBackgroundServiceStatus;
    executionMode: CliServiceExecutionMode;
    startedAt?: Date;
    stoppedAt?: Date;
    error?: string;
    /** Uptime in milliseconds (only when running) */
    uptime?: number;
}
/**
 * Registry that manages background service lifecycle.
 * Exposed on `ICliExecutionContext.backgroundServices`.
 */
interface ICliBackgroundServiceRegistry {
    register(service: ICliBackgroundService): void;
    start(name: string): Promise<void>;
    stop(name: string): Promise<void>;
    restart(name: string): Promise<void>;
    startJob(name: string, task: (context: ICliServiceContext) => Promise<void>, options?: {
        workerCompatible?: boolean;
    }): Promise<void>;
    getStatus(name: string): ICliBackgroundServiceInfo | undefined;
    list(): ICliBackgroundServiceInfo[];
    getLogs(name: string, limit?: number): ICliServiceLogEntry[];
    on(handler: CliServiceEventHandler, filter?: {
        source?: string;
        type?: string;
    }): () => void;
    destroyAll(): Promise<void>;
}

/**
 * One event on the CLI event bus.
 */
interface CliEvent<T = unknown> {
    /** Namespaced type, e.g. `package:installed` or `todo:added`. */
    type: string;
    /** Event payload. */
    data: T;
    /** Who emitted it (module or command name), when known. */
    source?: string;
    /** When it was emitted (ms since epoch). */
    timestamp: number;
}
type CliEventHandler<T = unknown> = (event: CliEvent<T>) => void;
/**
 * Payload types of the known events, keyed by event type. The built-in
 * events are listed here; plugins add their own with declaration merging:
 *
 * ```ts
 * declare module '@qodalis/cli-core' {
 *     interface CliEventMap {
 *         'todo:added': { id: number; text: string };
 *     }
 * }
 * ```
 *
 * Events not listed can still be emitted and received; their payload is
 * then `unknown`.
 */
interface CliEventMap {
    /** Boot finished: modules are set up and the terminal accepts input. */
    'boot:completed': {
        durationMs: number;
        modules: number;
        commands: number;
    };
    /** A command line finished running (typed, or run with `engine.execute`). */
    'command:executed': {
        command: string;
        exitCode: number;
        durationMs: number;
    };
    /** A module (plugin) was booted, at startup or later (e.g. `pkg add`). */
    'module:loaded': {
        name: string;
        version?: string;
        commands: number;
    };
    /** A module was unloaded (e.g. `pkg remove`, or before `pkg update`). */
    'module:unloaded': {
        name: string;
    };
    /** `pkg add` installed a package. */
    'package:installed': {
        name: string;
        version: string;
    };
    /** `pkg update` changed a package's version. */
    'package:updated': {
        name: string;
        version: string;
        previousVersion: string;
    };
    /** `pkg remove` removed a package. */
    'package:removed': {
        name: string;
        version: string;
    };
    /** A server connected (at boot, or after a reconnect). */
    'server:connected': {
        name: string;
        url: string;
        commands: number;
        reconnected: boolean;
    };
    /** A server could not be reached at boot. */
    'server:unavailable': {
        name: string;
        url: string;
    };
    /** A connected server went away. */
    'server:disconnected': {
        name: string;
    };
    /** An event pushed by a server over its event socket. */
    'server:event': {
        server: string;
        type: string;
        data: unknown;
    };
    /** Background service lifecycle (`service:registered`, `service:started`, ...). */
    'service:registered': {
        name: string;
        [key: string]: unknown;
    };
    'service:started': {
        name: string;
        [key: string]: unknown;
    };
    'service:stopped': {
        name: string;
        [key: string]: unknown;
    };
    'service:completed': {
        name: string;
        [key: string]: unknown;
    };
    'service:failed': {
        name: string;
        error?: string;
        [key: string]: unknown;
    };
    'service:status': {
        name: string;
        [key: string]: unknown;
    };
    /** A custom event emitted by a background service with `context.emit()`. */
    'service:event': {
        service: string;
        type: string;
        data: unknown;
    };
    /** A setting changed with `configure` (`category` is `system` or a plugin key). */
    'config:changed': {
        category: string;
        key: string;
        value: unknown;
    };
    /** A configuration category was reset to its defaults. */
    'config:reset': {
        category: string;
    };
    /** The signed-in user changed (sign-in, sign-out, `su`). */
    'session:changed': {
        user?: string;
    };
}
/** Event types with a known payload. */
type CliEventType = keyof CliEventMap;
/** Payload of event `K`: from {@link CliEventMap}, or `unknown`. */
type CliEventData<K extends string> = K extends CliEventType ? CliEventMap[K] : unknown;
/**
 * Publish/subscribe bus shared by the system, modules and commands of one
 * terminal. Handlers run synchronously in subscription order; a failing
 * handler is logged and does not affect the others or the emitter.
 *
 * Patterns: an exact type (`package:installed`), a namespace wildcard
 * (`package:*`) or `*` for everything.
 *
 * Events live in memory: each terminal has its own bus for its lifetime,
 * with a short recent history, and nothing is persisted.
 *
 * Get it from a command or module with `context.events`, or from the
 * services container with {@link ICliEventBus_TOKEN}.
 */
interface ICliEventBus {
    /**
     * Emit an event to every matching handler.
     *
     * ```ts
     * bus.emit('package:installed', { name, version }); // checked against CliEventMap
     * bus.emit<TodoAdded>('todo:added', { id, text });   // explicit payload type
     * bus.emit('todo:refresh');                          // custom event, no payload
     * ```
     */
    emit<K extends CliEventType>(type: K, data: CliEventMap[K], options?: CliEmitOptions): void;
    emit<T = unknown, K extends string = string>(type: K & CustomEventType<K>, data?: T, options?: CliEmitOptions): void;
    /**
     * Handle events matching `pattern`. Returns a function that unsubscribes.
     *
     * ```ts
     * bus.on('package:installed', (e) => e.data.version); // typed from CliEventMap
     * bus.on<TodoAdded>('todo:added', (e) => e.data.text); // explicit payload type
     * bus.on('server:*', (e) => console.log(e.type));      // anonymous: data is unknown
     * ```
     */
    on<K extends CliEventType>(pattern: K, handler: CliEventHandler<CliEventMap[K]>): () => void;
    on<T = unknown>(pattern: string, handler: CliEventHandler<T>): () => void;
    /** Like `on`, but only for the next matching event. */
    once<K extends CliEventType>(pattern: K, handler: CliEventHandler<CliEventMap[K]>): () => void;
    once<T = unknown>(pattern: string, handler: CliEventHandler<T>): () => void;
    /**
     * Recent events matching `pattern`, oldest first. The bus keeps the last
     * events in memory only: events are not persisted across reloads (state
     * that must survive a reload belongs in a state store).
     */
    history<K extends CliEventType>(pattern: K, limit?: number): CliEvent<CliEventMap[K]>[];
    history<T = unknown>(pattern?: string, limit?: number): CliEvent<T>[];
    /** Matching events as an observable (completes when the bus is disposed). */
    events$<K extends CliEventType>(pattern: K): Observable<CliEvent<CliEventMap[K]>>;
    events$<T = unknown>(pattern?: string): Observable<CliEvent<T>>;
}
interface CliEmitOptions {
    /** Who emits the event (module or command name). */
    source?: string;
}
/**
 * A type that is not a key of {@link CliEventMap}. Keeps `emit` from accepting
 * a known event with an unchecked payload.
 */
type CustomEventType<K extends string> = K extends CliEventType ? never : K;
/** Service token of the terminal's {@link ICliEventBus}. */
declare const ICliEventBus_TOKEN: CliToken<ICliEventBus>;

/**
 * Messages sent from the main thread to a background service Worker.
 */
type CliWorkerInboundMessage = {
    type: 'start';
    config?: Record<string, unknown>;
} | {
    type: 'stop';
} | {
    type: 'abort';
};
/**
 * Messages sent from a background service Worker to the main thread.
 */
type CliWorkerOutboundMessage = {
    type: 'log';
    level: 'info' | 'warn' | 'error';
    message: string;
} | {
    type: 'event';
    event: Omit<ICliServiceEvent, 'timestamp'>;
} | {
    type: 'state-update';
    patch: Record<string, unknown>;
} | {
    type: 'status';
    status: CliBackgroundServiceStatus;
} | {
    type: 'error';
    message: string;
    stack?: string;
};

/**
 * Opaque state value carried between lines during syntax highlighting.
 * Encodes context such as "inside a multi-line string" or "inside a block comment"
 * so the highlighter can resume correctly on the next line.
 * `0` typically represents the default/root state.
 */
type LineState = number;
interface ISyntaxHighlightRule {
    pattern: RegExp;
    tokenType: string;
    captureGroup?: number;
}
interface ISyntaxHighlighter {
    id: string;
    /** Human-readable language name (e.g. 'TypeScript'). Falls back to `id` when absent. */
    name?: string;
    extensions: string[];
    initialState: LineState;
    getRules(state: LineState): ISyntaxHighlightRule[];
    getNextLineState(line: string, currentState: LineState): LineState;
}
interface ISyntaxTheme {
    name: string;
    colors: Record<string, string>;
}

/**
 * Represents a package source for the CLI package manager
 */
interface CliPackageSource {
    /**
     * The name of the source, e.g. 'local', 'unpkg', 'jsdelivr'
     */
    name: string;
    /**
     * The base URL for fetching package files, e.g. 'http://localhost:3000/'
     */
    url: string;
    /**
     * The kind of source.
     * - 'registry': npm-compatible registry with search API (e.g. npmjs.org, Verdaccio)
     * - 'file': static file server, packages are discovered by probing known paths
     * @default 'file'
     */
    kind?: 'registry' | 'file';
}
/**
 * Represents a log level for the CLI
 */
declare enum CliLogLevel {
    None = 0,
    DEBUG = 1,
    LOG = 2,
    INFO = 3,
    WARN = 4,
    ERROR = 5
}
/**
 * How the CLI reports its startup.
 */
interface CliBootOptions {
    /**
     * Report each boot step (terminal, services, servers, modules) in the
     * terminal while the CLI starts. When `false`, a spinner is shown instead.
     * Users can override it with `configure set system.bootLogs false`.
     * @default true
     */
    showLogs?: boolean;
    /**
     * Keep the boot report on screen after startup instead of clearing it
     * when the terminal is ready. Warnings and errors are kept either way.
     * @default false
     */
    keepLogs?: boolean;
    /**
     * Steps taking at least this many milliseconds are highlighted as slow.
     * @default 500
     */
    slowStepMs?: number;
}
/**
 * Options for the CLI
 */
type CliOptions = Record<string, any> & {
    /**
     * How the CLI reports its startup (boot log, spinner).
     */
    boot?: CliBootOptions;
    /**
     * Custom terminal options
     */
    terminalOptions?: ITerminalOptions & ITerminalInitOnlyOptions;
    /**
     * The minimum log level to display
     */
    logLevel?: CliLogLevel;
    /**
     * Custom package sources for the package manager.
     * Built-in sources (unpkg, jsdelivr) are always available.
     */
    packageSources?: {
        /**
         * Name of the primary source. Defaults to 'unpkg'.
         */
        primary?: string;
        /**
         * Additional custom sources
         */
        sources?: CliPackageSource[];
    };
    /**
     * Remote CLI servers to connect to.
     * Commands from each server are discovered and registered as proxy processors.
     */
    servers?: CliServerConfig[];
    /**
     * Whether the `eval` / `js` / `calc` command is enabled.
     * Disabled by default because it runs arbitrary JavaScript via `eval()`
     * in the host page context — a security risk in multi-tenant or
     * user-facing deployments.
     * @default false
     */
    allowEval?: boolean;
};
/**
 * Represents a package that can be installed
 */
interface Package {
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
type CliProcessorMetadata = Record<string, any> & {
    /**
     * If true, the processor is sealed and cannot be replaced or removed.
     * Sealed processors can still be extended (wrapped) by processors with `extendsProcessor = true`.
     */
    sealed?: boolean;
    /**
     * The command's text is code or other literal input (`eval`): the engine
     * passes the whole line as typed, without operators (`|`, `;`, `&&`,
     * `>`) or expansion of `$(...)`, `$VAR`, braces and wildcards, so
     * `eval [1,2].map(x => x * 2)` keeps its `=>`, `*` and `${...}`.
     */
    literalInput?: boolean;
    /**
     * If true, the processor requires the server to be running
     */
    requireServer?: boolean;
    /**
     * The module the processor belongs to
     */
    module?: string;
    /**
     * An icon to display for the processor
     */
    icon?: CliIcon | string;
    /**
     * The minimum required version of @qodalis/cli-core for this processor.
     * If the installed core version is lower, the processor will be skipped during boot.
     */
    requiredCoreVersion?: string;
    /**
     * The minimum required version of @qodalis/cli for this processor.
     * If the installed CLI version is lower, the processor will be skipped during boot.
     */
    requiredCliVersion?: string;
    /**
     * If true, the command requires a signed-in user. Enforced by a
     * core guard that activates when an auth module registers an
     * `ICliAuthorizationService` (e.g. `@qodalis/cli-users`); without one the
     * flag is informational.
     */
    requireAuth?: boolean;
    /**
     * The signed-in user must belong to at least one of these groups
     * (e.g. `['admin']`). Implies `requireAuth`. Enforced like `requireAuth`.
     */
    requiredGroups?: string[];
    /**
     * The signed-in user must hold **all** of these permissions
     * (e.g. `['users:create']`), granted through their groups (roles).
     * Implies `requireAuth`. Enforced like `requireAuth`.
     */
    requiredPermissions?: string[];
    /**
     * If true, the processor is hidden from the help command listing.
     * The command still works when typed directly and `help <command>` still shows its details.
     */
    hidden?: boolean;
};
/**
 * Represents a state configuration for the CLI processor
 */
type CliStateConfiguration = {
    /**
     * The initial state for the processor
     */
    initialState: Record<string, any>;
    /**
     * The store identifier for the processor, if any
     * @remarks If the store identifier is not set, the processor command name is used
     */
    storeName?: string;
    /**
     * Save the state after every change, so `persist()` does not have to be
     * called. Changes made in the same tick are saved together.
     * @default false
     */
    autoPersist?: boolean;
    /**
     * Version of the state's shape. When the saved state has an older
     * version, `migrate` converts it while it is loaded. Saved state without
     * a version counts as version 0.
     */
    version?: number;
    /**
     * Convert saved state of version `fromVersion` to the current
     * {@link version}. The result is merged over `initialState`.
     */
    migrate?: (state: CliState, fromVersion: number) => CliState;
    /**
     * Apply changes saved by other tabs and terminals of the same browser.
     * @default true
     */
    syncAcrossTabs?: boolean;
    /**
     * Where the state lives:
     * - `'global'`: saved in the browser and shared by every terminal and tab
     *   (each save merges the keys it changed, so terminals changing
     *   different keys never overwrite each other).
     * - `'user'`: like `'global'`, but saved separately for each signed-in
     *   user (signed out, the state is shared); it switches when the user
     *   signs in or out.
     * - `'session'`: this terminal only, in memory; never saved or shared.
     * @default 'global'
     */
    scope?: CliStateScope;
};
/** See {@link CliStateConfiguration.scope}. */
type CliStateScope = 'global' | 'user' | 'session';
/** Options of a state store (see {@link CliStateConfiguration}). */
type CliStateStoreOptions = Pick<CliStateConfiguration, 'autoPersist' | 'version' | 'migrate' | 'syncAcrossTabs' | 'scope'>;
type CliState = Record<string, any>;
/**
 * Position of the CLI panel relative to the viewport edge.
 * - `'bottom'` — anchored to the bottom (default)
 * - `'top'` — anchored to the top
 * - `'left'` — anchored to the left (vertical layout)
 * - `'right'` — anchored to the right (vertical layout)
 */
type CliPanelPosition = 'bottom' | 'top' | 'left' | 'right';
/**
 * Alignment of the hidden-mode tab along its viewport edge.
 * - `'start'` — left for horizontal panels, top for vertical panels
 * - `'center'` — centered along the edge (default)
 * - `'end'` — right for horizontal panels, bottom for vertical panels
 */
type CliPanelHideAlignment = 'start' | 'center' | 'end';
/**
 * Configuration for the CLI panel component.
 */
interface CliPanelConfig {
    /**
     * Whether the CLI should be collapsed by default.
     * @default true
     */
    isCollapsed?: boolean;
    /**
     * Whether the panel starts hidden (showing only the small tab/arrow).
     * @default false
     */
    isHidden?: boolean;
    /**
     * Position of the panel relative to the viewport.
     * @default 'bottom'
     */
    position?: CliPanelPosition;
    /**
     * Whether the close button is shown.
     * @default true
     */
    closable?: boolean;
    /**
     * Whether the panel can be resized by dragging.
     * @default true
     */
    resizable?: boolean;
    /**
     * Whether the hide button is shown. When hidden, the panel collapses
     * to a small tab at the viewport edge.
     * @default true
     */
    hideable?: boolean;
    /**
     * Alignment of the hide tab along the panel's viewport edge.
     * For bottom/top: 'start' = left, 'center', 'end' = right.
     * For left/right: 'start' = top, 'center', 'end' = bottom.
     * @default 'center'
     */
    hideAlignment?: CliPanelHideAlignment;
    /**
     * When true, the panel's chrome (header, border, background) automatically
     * syncs its colors with the active terminal theme. CSS custom properties
     * are derived from the xterm theme and applied as inline styles.
     * @default false
     */
    syncTheme?: boolean;
}

/**
 * Framework-agnostic interface for programmatic control of the CLI panel.
 *
 * CliEngine is referenced as a generic to avoid a circular dependency
 * between @qodalis/cli-core and @qodalis/cli. Framework implementations
 * resolve this to the concrete CliEngine class.
 */
interface ICliPanelRef<TEngine = unknown> {
    /** Expand the panel (sets collapsed=false). Initializes the first tab on first call. */
    open(): void;
    /** Collapse the panel body (sets collapsed=true). */
    collapse(): void;
    toggleCollapse(): void;
    /** Hide the panel to a small viewport-edge tab (reversible via unhide). */
    hide(): void;
    unhide(): void;
    toggleHide(): void;
    /** Destroy the panel (removes from DOM). Irreversible. */
    close(): void;
    maximize(): void;
    restore(): void;
    toggleMaximize(): void;
    /**
     * Set panel dimensions. Only the dimension relevant to the current
     * position is applied immediately (height for top/bottom, width for
     * left/right). The other dimension is stored for when the position changes.
     */
    resize(dimensions: {
        height?: number;
        width?: number;
    }): void;
    setPosition(position: CliPanelPosition): void;
    /** Create a new tab. Returns the new tab's ID. Title defaults to "Terminal {id}". */
    addTab(title?: string): number;
    /** Close a tab by ID. No-op if the ID does not exist. */
    closeTab(tabId: number): void;
    /** Activate a tab by ID. No-op if the ID does not exist. */
    selectTab(tabId: number): void;
    /** Programmatically rename a tab. No-op if the ID does not exist. */
    renameTab(tabId: number, title: string): void;
    /**
     * Split the active pane (or a pane within the specified tab) to create
     * a new pane to the right. Returns the new pane's ID.
     */
    splitPane(tabId?: number): number;
    /**
     * Close a pane by ID. Searches all tabs for the pane.
     * No-op if the ID does not exist.
     */
    closePane(paneId: number): void;
    /** Get the engine for a specific pane, or the active pane if omitted. */
    getEngine(paneId?: number): TEngine | undefined;
    getState(): CliPanelState;
}
interface CliPanelState {
    collapsed: boolean;
    hidden: boolean;
    maximized: boolean;
    position: CliPanelPosition;
    height: number;
    width: number;
    activeTabId: number;
    activePaneId: number;
    tabs: CliPanelTabState[];
}
interface CliPanelTabState {
    id: number;
    title: string;
    panes: CliPanelPaneState[];
}
interface CliPanelPaneState {
    id: number;
    widthPercent: number;
}

type CliNotificationLevel = 'info' | 'success' | 'warn' | 'error';
interface CliNotification {
    level: CliNotificationLevel;
    message: string;
    timestamp: number;
}

interface ICliNotifier {
    /** Set an info-level notification (progress, status updates). */
    info(message: string): void;
    /** Set a success-level notification. */
    success(message: string): void;
    /** Set a warn-level notification. */
    warn(message: string): void;
    /** Set an error-level notification. */
    error(message: string): void;
    /** Clear the current notification. */
    clear(): void;
    /** The current notification, or undefined if cleared. */
    readonly current: CliNotification | undefined;
    /** Observable that emits on every change (set or clear). */
    readonly change$: Observable<CliNotification | undefined>;
}

/**
 * A managed timer handle returned by createInterval/createTimeout.
 * Managed timers are automatically cleared when full-screen mode exits
 * or the CLI component is destroyed.
 */
interface ICliManagedTimer {
    /** Clear this timer immediately. */
    readonly clear: () => void;
}
/**
 * A managed interval handle with the ability to change the delay.
 */
interface ICliManagedInterval extends ICliManagedTimer {
    /** Change the interval delay. Restarts the interval with the new delay. */
    readonly setDelay: (ms: number) => void;
}
/**
 * Options for entering full-screen mode.
 */
interface CliFullScreenOptions {
    /**
     * Whether to show the terminal cursor. Defaults to `false` (cursor hidden).
     * Set to `true` for REPL / input-line interfaces where the user types text.
     */
    showCursor?: boolean;
}
/**
 * Represents the context in which a command is executed
 */
interface ICliExecutionContext {
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
     * The terminal's event bus: emit and subscribe to events shared by the
     * system, modules and commands. Optional for backward compatibility.
     */
    readonly events?: ICliEventBus;
    /**
     * `true` once the CLI has finished booting (modules set up, terminal
     * ready). Optional for backward compatibility; `undefined` means unknown.
     */
    readonly isBooted?: boolean;
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
    setContextProcessor: (processor: ICliCommandProcessor | undefined, silent?: boolean, fullScreen?: boolean) => void;
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
    enterFullScreenMode: (processor: ICliCommandProcessor, options?: CliFullScreenOptions) => void;
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
    createInterval: (callback: () => void, ms: number) => ICliManagedInterval;
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

interface ICliProcessorHook {
    when: 'before' | 'after';
    execute: (context: ICliExecutionContext) => Promise<void>;
}

interface ICliCommandAuthor {
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
 * Represents a command parameter
 */
interface ICliCommandParameterDescriptor {
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
    type: 'string' | 'number' | 'boolean' | 'array' | 'object' | string;
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
/**
 * Represents a configuration option that a command processor exposes
 * for management via the `configure` command.
 */
interface ICliConfigurationOption {
    /**
     * The key used to store and retrieve this option, e.g. 'maxItems'
     */
    key: string;
    /**
     * Human-readable label shown in the interactive menu
     */
    label: string;
    /**
     * Description of what this option controls
     */
    description: string;
    /**
     * The data type of the option
     */
    type: 'string' | 'number' | 'boolean' | 'select';
    /**
     * The default value when no configuration has been set
     */
    defaultValue: any;
    /**
     * Available choices for 'select' type options
     */
    options?: {
        label: string;
        value: any;
    }[];
    /**
     * Optional validator function
     */
    validator?: (value: any) => {
        valid: boolean;
        message?: string;
    };
    /**
     * Override the category grouping (defaults to the processor command name)
     */
    category?: string;
}
/**
 * Represents a command processor
 */
interface ICliCommandProcessor {
    /**
     * The command that this processor handles
     */
    command: string;
    /**
     * Alternative names for the command
     */
    aliases?: string[];
    /**
     * A description of the command
     */
    description?: string;
    /**
     * The author of the command
     */
    author?: ICliCommandAuthor;
    /**
     * If true, the processor accepts raw text input after the command name as its value.
     * The captured text is available via `command.value` in `processCommand`.
     * @default false
     * @remarks When true, any text following the command name is extracted as the command value
     * rather than being interpreted as sub-commands. Use `valueRequired` instead if the value is mandatory.
     */
    acceptsRawInput?: boolean;
    /**
     * If true, the command requires some form of input before it can execute.
     *
     * The requirement is satisfied by **any** of:
     * - A positional value (text after the command name, available via `command.value`)
     * - Piped data from a previous command (available via `command.data`)
     * - Named arguments (e.g. `--server=node --path=/app`)
     *
     * When set, `command.value` is automatically extracted from the raw input
     * (equivalent to setting `acceptsRawInput`).
     *
     * Additionally, when positional input is present the engine skips
     * required-parameter validation — the processor is responsible for
     * parsing positional text into individual values.  Required-parameter
     * checks still apply when the user provides only named arguments.
     *
     * @default false
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
     * The keys a full-screen command reads while it runs (an editor, a
     * game), so hosts on touch screens can show them as buttons.
     */
    controls?: ICliCommandControls;
    /**
     * Processors that are nested under this processor
     */
    processors?: ICliCommandChildProcessor[];
    /**
     * Parameters that the command accepts
     */
    parameters?: ICliCommandParameterDescriptor[];
    /**
     * Hooks that are executed before and after the command is processed
     */
    hooks?: ICliProcessorHook[];
    /**
     * Represents the state configuration for the command processor
     * @remarks The state configuration is used to store and retrieve state information for the command processor
     * @remarks State configuration is optional and can be used to store and retrieve state information for the command processor
     * @remarks The state configuration is used only for root command processors and not for child command processors
     */
    stateConfiguration?: CliStateConfiguration;
    /**
     * Configuration options exposed by this processor for the `configure` command.
     * When defined, these options appear in the interactive configuration menu
     * and can be managed via `configure get/set` subcommands.
     */
    configurationOptions?: ICliConfigurationOption[];
    /**
     * When true, this processor extends (wraps) an existing processor with the same
     * command name instead of replacing it. The registry sets `originalProcessor`
     * to the previous processor so this one can delegate to it.
     */
    extendsProcessor?: boolean;
    /**
     * Reference to the original processor that this one extends.
     * Set automatically by the registry — do not set manually.
     * Call `this.originalProcessor.processCommand(command, context)` to delegate.
     */
    originalProcessor?: ICliCommandProcessor;
    /**
     * Process the command
     * @param command The command to process
     * @param context The context in which the command is executed
     */
    processCommand(command: CliProcessCommand, context: ICliExecutionContext): Promise<void>;
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
    validateBeforeExecution?: (command: CliProcessCommand, context: ICliExecutionContext) => {
        valid: boolean;
        message?: string;
    };
    /**
     * Initialize the command processor
     * @param context The context in which the command is executed
     */
    initialize?(context: ICliExecutionContext): Promise<void>;
    /**
     * Handle raw terminal data when this processor is the active context processor.
     * When implemented, ALL terminal input is routed here instead of normal CLI input handling.
     * Used for full-screen interactive modes (editors, pagers, etc.).
     * @param data The raw terminal data string (escape sequences, control chars, printable text)
     * @param context The execution context
     */
    onData?(data: string, context: ICliExecutionContext): Promise<void>;
    /**
     * Called when the terminal is resized while this processor is the active
     * full-screen context processor. Allows processors to adapt their rendering
     * to the new terminal dimensions.
     * @param cols The new number of columns
     * @param rows The new number of rows
     * @param context The execution context
     */
    onResize?(cols: number, rows: number, context: ICliExecutionContext): void;
    /**
     * Called when the processor is being disposed — either because full-screen
     * mode ended, the terminal disconnected, or the CLI component is being
     * destroyed. Use this to clean up resources (timers, subscriptions, etc.).
     * @param context The execution context
     */
    onDispose?(context: ICliExecutionContext): void;
}
/**
 * Represents a child command processor
 */
interface ICliCommandChildProcessor extends ICliCommandProcessor {
    /**
     * The parent processor, it is populated by the processor manager
     */
    parent?: ICliCommandProcessor;
}

/**
 * Represents a service that pings the server
 */
interface ICliPingServerService {
    /**
     * Pings the server
     */
    ping(): Promise<void>;
}
/**
 * Represents a module for the web CLI (frontend).
 *
 * This interface is for **web/frontend plugins only** — browser-side modules
 * that extend the CLI terminal UI (e.g. `@qodalis/cli-guid`, `@qodalis/cli-tetris`).
 *
 * It is **not** related to backend server processors (Node/Python/.NET).
 * Backend command processors implement their own `ICliCommandProcessor` interfaces
 * in their respective server packages and do not use `apiVersion`.
 */
interface ICliModule {
    /**
     * The web plugin API version this module targets.
     *
     * This is a **frontend-only** concept used by the browser CLI runtime
     * to ensure plugin compatibility. It has no relation to backend server
     * API versioning (e.g. `/api/v1/qcli/`).
     *
     * Modules with `apiVersion` less than the runtime's `API_VERSION` are
     * rejected with a warning at boot time.
     *
     * Use the `API_VERSION` constant exported from `@qodalis/cli-core` to
     * target the current runtime version.
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
    /**
     * Global command guards contributed by this module. They are registered
     * when the module boots and run before every command (across all modules),
     * e.g. authentication or permission checks. See {@link ICliCommandGuard}.
     */
    guards?: ICliCommandGuard[];
    /**
     * Permissions this module uses (`resource:action`), registered in the
     * {@link ICliPermissionRegistry} at boot so they can be listed and granted.
     */
    permissions?: CliPermissionDefinition[];
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
interface ICliConfigurableModule<T extends Record<string, any> = Record<string, any>> extends ICliModule {
    configure(config: T): ICliModule;
}
/**
 * Represents a logger for the CLI
 */
interface ICliLogger {
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

/**
 * Provides internationalization (i18n) support for CLI strings.
 */
interface ICliTranslationService {
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
interface ICliServiceProvider {
    /**
     * Retrieve a service by its injection token.
     * Returns `undefined` when no provider is registered for the token.
     * For multi-provider tokens, returns the last registered value (use `getAll` for the full array).
     * @param service The token (typically a `*_TOKEN` constant) identifying the service
     * @returns The service instance cast to `T`, or `undefined` if not registered
     */
    get<T>(service: CliToken<T>): T | undefined;
    get<T = unknown>(service: any): T | undefined;
    /**
     * Retrieve all registered services for a multi-provider token.
     * Returns an empty array when no provider is registered for the token.
     * @param service The token (typically a `*_TOKEN` constant) identifying the service
     * @returns Array of all resolved service instances
     */
    getAll<T>(service: CliToken<T>): T[];
    getAll<T = unknown>(service: any): T[];
    /**
     * Retrieve a service by its injection token, throwing if not registered.
     * Use this when the service is required and its absence is a programming error.
     * For multi-provider tokens, returns the last registered value (use `getAll` for the full array).
     * @param service The token (typically a `*_TOKEN` constant) identifying the service
     * @returns The service instance, cast to `T`
     * @throws If no service is registered for the given token
     */
    getRequired<T>(service: CliToken<T>): T;
    getRequired<T = unknown>(service: any): T;
    /**
     * Check whether a service is registered for the given token.
     * @param service The token identifying the service
     * @returns `true` if a service is registered, `false` otherwise
     */
    has(service: any): boolean;
    /**
     * Register one or more service definitions.
     * @param definition A single provider or an array of providers to register
     */
    set(definition: CliProvider | CliProvider[]): void;
    /**
     * Remove a registration. With `provider` (the provider object passed to
     * `set`, or the registered value), only that registration is removed: for
     * a single token the previous registration becomes active again, for a
     * multi token the others remain. Without it, every registration of the
     * token is removed. Sealed tokens cannot be removed.
     * @returns Whether something was removed
     */
    remove?(service: any, provider?: unknown): boolean;
}
/** DI token for `ICliServerAuthTokenProvider` (multi-provider) */
declare const ICliServerAuthTokenProvider_TOKEN: CliToken<ICliServerAuthTokenProvider>;
/** DI token for `ICliServerAuthService` */
declare const ICliServerAuthService_TOKEN: CliToken<ICliServerAuthService>;
/**
 * Integrators implement this interface to supply auth credentials
 * for server requests. Multiple providers can be registered — the
 * auth service merges headers from all of them (later providers
 * override earlier ones for the same header name).
 *
 * @example
 * ```ts
 * class MyAuthProvider implements ICliServerAuthTokenProvider {
 *     getHeaders(serverName: string) {
 *         return { Authorization: `Bearer ${this.oauthService.getAccessToken()}` };
 *     }
 * }
 *
 * // Register in a module:
 * const myModule: ICliModule = {
 *     name: 'my-auth',
 *     services: [{
 *         provide: ICliServerAuthTokenProvider_TOKEN,
 *         useValue: new MyAuthProvider(),
 *         multi: true,
 *     }],
 * };
 * ```
 */
interface ICliServerAuthTokenProvider {
    /**
     * Return headers for a given server. Called on every request,
     * so implementations can return fresh tokens.
     *
     * @param serverName  The `name` field from `CliServerConfig`
     * @returns Headers to merge into the request, or an empty object
     */
    getHeaders(serverName: string): Record<string, string>;
    /**
     * Optional: query parameters for WebSocket upgrades to this server (e.g. a
     * short-lived single-use ticket). Called right before each connection.
     * Return `undefined` when this provider does not handle the server.
     * When any provider returns params, headers are NOT copied into the URL
     * (so bearer tokens never appear in WebSocket URLs).
     */
    getWebSocketParams?(serverName: string): Promise<Record<string, string> | undefined>;
}
/**
 * Minimal view of the CLI server manager (token `ICliServerManager_TOKEN`),
 * e.g. for auth modules that must refresh a server after sign-in.
 */
interface ICliServerManager {
    /** Reconnect a server: re-fetch its commands and reopen its event socket. */
    reconnect(name: string): Promise<{
        success: boolean;
        commandCount: number;
    }>;
    /**
     * The server a command should target when the user names none: the
     * default server (`server default`) when connected, otherwise the first
     * connected server. `null` when no server is connected (for example every
     * server requires a login the user has not done yet).
     */
    preferredServer?(): string | null;
}
/** Token for {@link ICliServerManager} */
declare const ICliServerManager_TOKEN: CliToken<ICliServerManager>;
/**
 * Internal service that resolves auth headers for a server by merging:
 * 1. Static/dynamic headers from `CliServerConfig.headers`
 * 2. Headers from all registered `ICliServerAuthTokenProvider`s
 *
 * Consumers should use this service instead of reading `config.headers` directly.
 */
interface ICliServerAuthService {
    /**
     * Resolve the final set of headers for a server request.
     * Merges config headers with all registered token providers.
     *
     * @param serverName  The server's `name` field
     * @param configHeaders  The `headers` field from `CliServerConfig`
     * @returns Merged headers ready for use in fetch/WebSocket calls
     */
    getHeaders(serverName: string, configHeaders?: CliHeadersProvider): Record<string, string>;
    /**
     * WebSocket upgrade query params from the registered token providers, or
     * `undefined` when no provider handles this server.
     */
    getWebSocketParams?(serverName: string): Promise<Record<string, string> | undefined>;
}

/**
 * A static header map or a function that returns one.
 * Use a function when headers contain short-lived tokens (e.g. JWTs)
 * so that every request gets a fresh value.
 *
 * @example
 * // Static
 * headers: { 'X-Api-Key': 'abc123' }
 *
 * // Dynamic (token refresh)
 * headers: () => ({ Authorization: `Bearer ${auth.getToken()}` })
 */
type CliHeadersProvider = Record<string, string> | (() => Record<string, string>);
/**
 * Resolves a CliHeadersProvider to a plain header map.
 */
declare function resolveHeaders(provider?: CliHeadersProvider): Record<string, string>;
/**
 * Resolves auth headers for a server request using the auth service if available,
 * otherwise falls back to resolving config headers directly.
 *
 * This is the single entry point plugins should use to get headers for server requests.
 *
 * @param services  The service provider (from context.services)
 * @param serverName  The server name
 * @param configHeaders  The headers from CliServerConfig
 * @returns Resolved headers ready for use
 */
declare function resolveServerHeaders(services: ICliServiceProvider | undefined, serverName: string, configHeaders?: CliHeadersProvider): Record<string, string>;
/**
 * Configuration for a remote CLI server
 */
type CliServerConfig = {
    /** Unique identifier, used for namespacing commands */
    name: string;
    /** Base URL of the server, e.g. "https://api.example.com" */
    url: string;
    /** Whether this server is enabled. @default true */
    enabled?: boolean;
    /**
     * Custom headers sent with every request (e.g. auth tokens).
     * Can be a static object or a function that returns fresh headers
     * on each call (useful for rotating tokens / JWTs).
     */
    headers?: CliHeadersProvider;
    /** Request timeout in milliseconds. @default 30000 */
    timeout?: number;
};
/**
 * A single output item in a server response
 */
type CliServerOutput = {
    type: 'text';
    value: string;
    style?: 'success' | 'error' | 'info' | 'warning';
} | {
    type: 'table';
    headers: string[];
    rows: string[][];
} | {
    type: 'list';
    items: string[];
    ordered?: boolean;
} | {
    type: 'json';
    value: any;
} | {
    type: 'key-value';
    entries: {
        key: string;
        value: string;
    }[];
};
/**
 * Structured response from a server command execution
 */
type CliServerResponse = {
    exitCode: number;
    outputs: CliServerOutput[];
};
/**
 * Metadata about a remote command processor, returned by GET /api/qcli/commands
 */
type CliServerCommandDescriptor = {
    command: string;
    description?: string;
    version?: string;
    parameters?: {
        name: string;
        aliases?: string[];
        description: string;
        required: boolean;
        type: string;
        defaultValue?: any;
    }[];
    processors?: CliServerCommandDescriptor[];
};
/**
 * Server capabilities returned by GET /api/qcli/capabilities
 */
type CliServerCapabilities = {
    /** Whether this server supports remote shell access */
    shell: boolean;
    /** Server operating system (e.g. "linux", "win32", "darwin") */
    os?: string;
    /** Path to the shell binary on the server */
    shellPath?: string;
    /** Server version string */
    version?: string;
    /** Whether this server supports SSE streaming execution */
    streaming?: boolean;
};

/**
 * A DI token that carries the type of the service it identifies, so
 * `services.get(TOKEN)` is typed without a type argument:
 *
 * ```ts
 * export const ITodoStore_TOKEN = createCliToken<ITodoStore>('todo-store');
 * const store = context.services.get(ITodoStore_TOKEN); // ITodoStore | undefined
 * ```
 *
 * At runtime it is the plain string, so it works anywhere a string token does.
 */
type CliToken<T> = string & {
    readonly __cliTokenType?: T;
};
/** Create a typed {@link CliToken}. */
declare function createCliToken<T>(name: string): CliToken<T>;
type MultiServices = {
    /**
     * When true, injector returns an array of instances. This is useful to allow multiple
     * providers spread across many files to provide configuration information to a common token.
     */
    multi?: boolean;
};
type CliValueProvider = MultiServices & {
    useValue: any;
};
type CliTypeProvider = MultiServices & {
    useClass: any;
    /** DI tokens resolved from the container and passed as constructor arguments. */
    deps?: any[];
};
type CliFactoryProvider = MultiServices & {
    useFactory: (...args: any[]) => any;
    /** DI tokens resolved from the container and passed as factory arguments. */
    deps?: any[];
};
/**
 * Service registration. `useFactory` and `useClass` providers are created
 * lazily, on the first `get()` of their token (or of a token depending on
 * them), so their `deps` may be registered after them.
 */
type CliProvider = {
    provide: any;
    /** When true, this token is sealed after registration and cannot be overwritten. */
    sealed?: boolean;
    /** When true, a new instance is created on every `get()` call instead of returning a singleton. */
    transient?: boolean;
} & (CliValueProvider | CliTypeProvider | CliFactoryProvider) & Record<string, any>;

/**
 * Represents a user in the CLI
 */
interface ICliUser {
    /** Unique user identifier */
    id: string;
    /** Login name (unique) */
    name: string;
    /** Email address (unique) */
    email: string;
    /** Group IDs this user belongs to */
    groups: string[];
    /** Virtual home directory path, e.g. /home/root */
    homeDir?: string;
    /** Account creation timestamp */
    createdAt: number;
    /** Last modification timestamp */
    updatedAt: number;
    /** Whether the account is locked */
    disabled?: boolean;
    /** The user must set a new password before doing anything else */
    mustChangePassword?: boolean;
    /** Extensible metadata (department, phone, preferences, etc.) */
    data?: Record<string, any>;
    /** Timestamp of last successful login */
    lastLoginAt?: number;
}
/**
 * Represents user credentials (shadow pattern — stored separately from ICliUser)
 */
interface ICliUserCredentials {
    /** The user ID this credential belongs to */
    userId: string;
    /** SHA-256 hash of salt + password */
    passwordHash: string;
    /** Random salt for this user */
    salt: string;
    /** Timestamp of last password change */
    lastChanged: number;
}
/**
 * Represents a group in the CLI
 */
interface ICliGroup {
    /** Unique group identifier */
    id: string;
    /** Group name (unique) */
    name: string;
    /** Optional group description */
    description?: string;
    /** Group creation timestamp */
    createdAt: number;
    /**
     * Permissions granted to every member of the group. Groups act as roles.
     * Permission strings are `resource:action` (e.g. `users:create`), with
     * `*` wildcards (`users:*`, `*`). See {@link cliPermissionMatches}.
     */
    permissions?: string[];
    /** Built-in groups (`admin`, `users`) cannot be deleted */
    builtIn?: boolean;
    /** Last modification timestamp */
    updatedAt?: number;
}
/**
 * Represents an active user session
 */
interface ICliUserSession {
    /** The user associated with this session */
    user: ICliUser;
    /** Pre-computed display name for the prompt (set by users module) */
    displayName?: string;
    /** Timestamp when the session started */
    loginTime: number;
    /** Timestamp of last activity */
    lastActivity: number;
    /**
     * Effective permissions of the user (union of their groups' permissions),
     * resolved by the users module at login and refreshed when groups change.
     */
    permissions?: string[];
    /** Extensible data (tokens, metadata, etc.) */
    data?: Record<string, any>;
}
/** Fields required to create a new user */
type CliAddUser = Omit<ICliUser, 'id' | 'createdAt' | 'updatedAt'>;
/** Fields that can be updated on a user */
type CliUpdateUser = Partial<Omit<ICliUser, 'id' | 'createdAt'>>;

declare const enums: {
    CliForegroundColor: typeof CliForegroundColor;
    CliBackgroundColor: typeof CliBackgroundColor;
    CliIcon: typeof CliIcon;
    CliLogLevel: typeof CliLogLevel;
};

/**
 * Registry that tracks loaded web CLI modules (frontend plugins) and dispatches
 * boot handlers when new modules are registered (including dynamically via UMD).
 *
 * This registry is for **browser-side web plugins only**. Backend server
 * processors (Node/Python/.NET) have their own registries and do not use
 * this class or the `apiVersion` gating mechanism.
 */
declare class CliModuleRegistry {
    private readonly modules;
    private readonly bootHandlers;
    private readonly unregisterHandlers;
    /** Registrations whose boot handlers are still running. */
    private readonly inFlight;
    /** Optional warning callback — set by the engine to route through ICliLogger */
    onWarn?: (message: string) => void;
    /**
     * Register a handler that is called whenever a new module is registered.
     */
    onModuleBoot(handler: (module: ICliModule) => Promise<void>): void;
    /**
     * Register a web plugin module and notify all boot handlers.
     * Modules whose `apiVersion` is below the runtime's `API_VERSION` are
     * skipped with a warning — this ensures only compatible frontend plugins load.
     */
    register(module: ICliModule): Promise<void>;
    /**
     * Resolve once every registration in progress (including ones started
     * meanwhile, e.g. a plugin loading another) has finished booting.
     */
    whenIdle(): Promise<void>;
    private registerInternal;
    /**
     * Register a handler that is called when a module is unregistered,
     * e.g. so its processors can be removed.
     */
    onModuleUnregister(handler: (module: ICliModule) => void): void;
    /**
     * Unregister a module and notify all unregister handlers. A module
     * registered again afterwards (e.g. a newer version) boots again.
     * Returns the removed module, or `undefined` when it was not registered.
     */
    unregister(name: string): ICliModule | undefined;
    /**
     * Get a module by name.
     */
    getModule(name: string): ICliModule | undefined;
    /**
     * Get all registered modules.
     */
    getAll(): ICliModule[];
    /**
     * Track a module without triggering boot handlers.
     * Used by the boot service for statically-provided modules that are
     * already being booted through the normal pipeline.
     */
    track(module: ICliModule): void;
    /**
     * Check if a module is registered.
     */
    has(name: string): boolean;
}

declare const initializeBrowserEnvironment: ({ context, registry, }: {
    context: ICliExecutionContext;
    registry: CliModuleRegistry;
}) => void;
/**
 * Boot a CLI module by registering it with the global module registry.
 * Used by UMD entrypoints to register themselves when loaded dynamically.
 */
declare const bootCliModule: (module: ICliModule) => Promise<void>;

declare class ObjectDescriber {
    static describe(obj: any, options?: {
        filter?: (o: {
            funcName: string;
            func: any;
            args: string[];
        }) => boolean;
    }): ICliCommandProcessor[];
    static supportsDynamicArgs(func: any): boolean;
    static getFunctionArguments(func: any): string[];
}

/**
 * Token for the configure command's state store.
 */
declare const CLI_CONFIGURE_STORE_NAME = "configure";
/**
 * Retrieves a configuration value for a given category and key
 * from a configuration state store.
 *
 * @param state The state store to read from (should be the 'configure' store)
 * @param category The category (processor command name or 'system')
 * @param key The configuration key
 * @param defaultValue Fallback value if not configured
 * @returns The configured value or the default
 */
declare function getConfigValue<T = any>(state: ICliStateStore, category: string, key: string, defaultValue: T): T;
/**
 * Retrieves a plugin configuration value from the execution context.
 * This is a convenience wrapper for plugins — handles store lookup internally.
 *
 * @param context The execution context
 * @param category The category (usually the processor's command name)
 * @param key The configuration key
 * @param defaultValue Fallback value if not configured
 * @returns The configured value or the default
 */
declare function getPluginConfigValue<T = any>(context: ICliExecutionContext, category: string, key: string, defaultValue: T): T;
/**
 * Resolves all configuration options from registered processors,
 * grouped by category.
 */
declare function resolveConfigurationCategories(registry: ICliCommandProcessorRegistry): Map<string, {
    processorCommand: string;
    options: ICliConfigurationOption[];
}>;

/**
 * Returns a promise that resolves after the given number of milliseconds.
 * @param ms Delay duration in milliseconds
 */
declare const delay: (ms: number) => Promise<void>;

/**
 * Clears the current line in the terminal, accounting for text that wraps across multiple lines.
 * @param terminal The xterm terminal instance
 * @param contentLength The total visible character count on the line (prompt + text)
 */
declare const clearTerminalLine: (terminal: Terminal, contentLength: number) => void;

/**
 * Compares two dotted version strings.
 * Returns -1 if a < b, 0 if equal, 1 if a > b.
 */
declare function compareVersions(a: string, b: string): -1 | 0 | 1;
/**
 * Returns true if the installed version satisfies the minimum required version.
 */
declare function satisfiesMinVersion(installed: string, required: string): boolean;
/**
 * Returns true if the installed version satisfies the given semver range.
 * If range is undefined/empty, returns true (no constraint).
 * If range looks like a plain version (no operators), treats it as >= that version.
 */
declare function satisfiesVersionRange(installed: string, range: string | undefined): boolean;

/**
 * Describes the version information returned by a CLI server's discovery endpoint.
 */
interface ServerVersionInfo {
    supportedVersions: number[];
    preferredVersion: number;
    serverVersion: string;
}
/**
 * Negotiates the API version between a frontend CLI client and a backend server.
 *
 * Flow:
 * 1. Client calls `discover(baseUrl)` which hits `GET ${VERSIONS_ENDPOINT}`
 * 2. Server returns supported versions
 * 3. Client picks the highest mutually supported version
 * 4. All subsequent calls use `/api/v{n}/qcli/*`
 */
declare class ServerVersionNegotiator {
    private static readonly CLIENT_SUPPORTED_VERSIONS;
    /**
     * Given a server's version info, pick the highest mutually compatible version.
     * Returns null if no compatible version exists.
     */
    static negotiate(serverInfo: ServerVersionInfo): number | null;
    /**
     * Discover the server's supported versions and negotiate the best match.
     * Returns the negotiated API version and the base path for all subsequent calls,
     * or null if the server is unreachable or incompatible.
     */
    static discover(baseUrl: string, headers?: CliHeadersProvider, options?: {
        /** Rethrow when the server cannot be reached (instead of `null`, "no discovery") */
        rethrowNetworkErrors?: boolean;
    }): Promise<{
        apiVersion: number;
        basePath: string;
    } | null>;
}

/**
 * Builds a WebSocket URL that includes authentication credentials from headers
 * as query parameters. Since the browser WebSocket API does not support custom
 * request headers, this allows the host server's auth middleware to validate
 * the connection during the HTTP upgrade handshake.
 *
 * All configured headers are forwarded as query parameters prefixed with
 * `_header_` to avoid collisions with application-level query params.
 *
 * Accepts both static header maps and dynamic provider functions.
 *
 * **Security note:** Query parameters are visible in browser history, server
 * access logs, proxy/CDN logs, and the `Referer` header. Tokens placed in the
 * URL are therefore more exposed than those sent via HTTP headers. This is an
 * inherent limitation of the browser WebSocket API (no custom headers).
 * Server-side middleware that reads `_header_*` params should strip them from
 * logs and avoid forwarding them in redirects.
 *
 * @param wsUrl  The base WebSocket URL (may already contain query parameters)
 * @param headers  The headers provider from CliServerConfig (may include Authorization, etc.)
 * @returns The WebSocket URL with auth credentials appended as query parameters
 */
declare function buildAuthenticatedWebSocketUrl(wsUrl: string, headers?: CliHeadersProvider): string;
/**
 * Build the WebSocket URL for a configured server. Prefers upgrade params
 * from auth providers (e.g. a single-use ticket from the users module); only
 * when no provider handles the server are headers copied into the URL
 * (legacy behaviour, see {@link buildAuthenticatedWebSocketUrl}).
 */
declare function resolveServerWebSocketUrl(services: ICliServiceProvider | undefined, serverName: string, wsUrl: string, configHeaders?: CliHeadersProvider): Promise<string>;
/** Append query params to a URL that may already have some. */
declare function appendQueryParams(url: string, params: Record<string, string>): string;

/**
 * Derives CLI panel CSS custom property values from an xterm ITheme object.
 * Used when `syncTheme` is enabled on the panel config.
 */
interface ThemeLike {
    background?: string;
    foreground?: string;
    cursor?: string;
    cyan?: string;
    blue?: string;
    magenta?: string;
    selectionBackground?: string;
}
/**
 * Derive CSS custom properties for the CLI panel from the active xterm theme.
 * Returns a record of property name → value that can be applied as inline styles.
 */
declare function derivePanelThemeStyles(theme: ThemeLike): Record<string, string>;

/**
 * Load the user's saved panel position from localStorage.
 * Returns null if no preference is saved or localStorage is unavailable.
 */
declare function loadPanelPosition(): CliPanelPosition | null;
/**
 * Save the user's panel position preference to localStorage.
 */
declare function savePanelPosition(position: CliPanelPosition): void;
/**
 * Get the next position in the cycle: bottom -> right -> top -> left -> bottom
 */
declare function nextPanelPosition(current: CliPanelPosition): CliPanelPosition;

/**
 * Strip all ANSI escape sequences from a string.
 * @param text The text potentially containing ANSI codes
 * @returns The text with all ANSI codes removed
 */
declare function stripAnsi(text: string): string;
/**
 * Return the visible (display) width of a string in terminal columns,
 * ignoring ANSI escape codes and accounting for wide characters (emoji,
 * East Asian fullwidth, etc.) that occupy two columns.
 * @param text The text potentially containing ANSI codes
 * @returns The number of terminal columns the text occupies
 */
declare function visibleLength(text: string): number;
/**
 * Cut a string to at most `width` terminal columns, keeping ANSI escape codes intact.
 * When the text is too wide it ends with `ellipsis` followed by a reset (`\x1b[0m`)
 * so no colour leaks into the rest of the line. Use it for lines that are redrawn in
 * place: a line that wraps takes two rows and breaks cursor-up based redraws.
 * @param text The text potentially containing ANSI codes
 * @param width The maximum number of columns (values below 1 return '')
 * @param ellipsis Appended when the text is cut (default '…')
 */
declare function truncateToWidth(text: string, width: number, ellipsis?: string): string;

/**
 * Permission strings are `resource:action` (for example `users:create`).
 * A trailing `*` segment matches anything at that level and below; a `*`
 * in any other position matches exactly one segment:
 *
 * | granted       | matches                               |
 * |---------------|---------------------------------------|
 * | `*`           | every permission                      |
 * | `users:*`     | `users:create`, `users:delete`, ...   |
 * | `*:read`      | `users:read`, `groups:read`, ...      |
 * | `users:read`  | only `users:read`                     |
 *
 * Matching is case-insensitive.
 */
declare function cliPermissionMatches(granted: string, required: string): boolean;
/** True when any granted permission matches `required`. */
declare function cliHasPermission(granted: readonly string[] | undefined, required: string): boolean;
/** The subset of `required` permissions not covered by `granted`. */
declare function cliMissingPermissions(granted: readonly string[] | undefined, required: readonly string[]): string[];
/** Union of permissions, de-duplicated, preserving first-seen order. */
declare function cliMergePermissions(...lists: (readonly string[] | undefined)[]): string[];
/**
 * Built-in permissions used by the users module. Other modules define their
 * own (e.g. `deploy:run`); any string in `resource:action` form works.
 */
/** Permissions for remote CLI server features. */
declare const CliServerPermissions: {
    /** Open a remote shell on a server (`ssh`) */
    readonly ShellExecute: "shell:execute";
};
declare const CliUsersPermissions: {
    readonly UsersRead: "users:read";
    readonly UsersCreate: "users:create";
    readonly UsersUpdate: "users:update";
    readonly UsersDelete: "users:delete";
    readonly GroupsRead: "groups:read";
    readonly GroupsCreate: "groups:create";
    readonly GroupsUpdate: "groups:update";
    readonly GroupsDelete: "groups:delete";
    readonly SessionsRead: "sessions:read";
    readonly SessionsRevoke: "sessions:revoke";
    readonly AuditRead: "audit:read";
    readonly AuditClear: "audit:clear";
};

/**
 * `metadata.requireAuth` (also implied by `requiredGroups` /
 * `requiredPermissions`): the command needs a signed-in principal.
 * Active only when an {@link ICliAuthorizationService} is registered.
 */
declare const cliRequireAuthGuard: ICliCommandGuard;
/**
 * `metadata.requiredGroups`: the principal must belong to at least one group.
 * Active only when an {@link ICliAuthorizationService} is registered.
 */
declare const cliRequiredGroupsGuard: ICliCommandGuard;
/**
 * `metadata.requiredPermissions`: the principal must hold all permissions.
 * Active only when an {@link ICliAuthorizationService} is registered.
 */
declare const cliRequiredPermissionsGuard: ICliCommandGuard;
/**
 * Guards enforcing access metadata on processors. Registered by the CLI
 * engine; they do nothing until an auth module registers an
 * {@link ICliAuthorizationService}.
 */
declare const cliAccessMetadataGuards: ICliCommandGuard[];

/**
 * The server a command should use when the user does not name one.
 *
 * Prefers the server manager's choice (the default server, else the first
 * connected one) so a command does not pick a server that is down or that
 * rejects the user (a protected server they have not signed in to). Falls
 * back to the first configured server when no manager is available or
 * nothing is connected, so callers still get a clear error from that server.
 */
declare function cliDefaultServer(context: Pick<ICliExecutionContext, 'services' | 'options'>): CliServerConfig | undefined;

/** A help row: the left column and its description. */
type CliHelpRow = readonly [string, string];
/** Write a `📋 Usage:` block with aligned, highlighted commands. */
declare function writeUsage(context: ICliExecutionContext, rows: readonly CliHelpRow[]): void;
/** Write a `📝 Examples:` block with aligned `# comments`. */
declare function writeExamples(context: ICliExecutionContext, rows: readonly CliHelpRow[]): void;
/**
 * Write a paragraph wrapped at word boundaries to the terminal width (at
 * most 100 columns), so long help text never breaks inside a word.
 */
declare function writeWrapped(context: ICliExecutionContext, text: string, indent?: number): void;
/** `💡 Use <command> to <action>` hint. */
declare function writeHint(context: ICliExecutionContext, command: string, action: string): void;

/**
 * Split text into arguments like a POSIX shell: spaces separate words,
 * quotes are removed (`"a b"` is one word), single quotes keep everything
 * literally, and a backslash escapes the next character outside quotes
 * (`my\ file`) or `"`, `\`, `$` and `` ` `` inside double quotes. A quote
 * without a closing one is ordinary text (`it's`).
 */
declare function splitShellWords(text: string): string[];
/**
 * The arguments as a shell's echo prints them: {@link splitShellWords}
 * joined by one space. Inside double quotes, a backslash before other
 * characters stays (`"a\nb"`) for echo's escape step.
 */
declare function joinShellWords(text: string): string;
/** Quote a value so {@link splitShellWords} reads it back as one word. */
declare function quoteShellWord(value: string): string;

/**
 * Text given as one free-form argument (JSON, code, a query) without one
 * pair of quotes wrapping all of it: `'{"a": 1}'` -> `{"a": 1}`, and
 * `"say \"hi\""` -> `say "hi"`. Anything else is kept as typed, so quotes
 * and backslashes inside the text are never touched.
 */
declare function unquoteRawArgument(text: string): string;

/**
 * Retrieve a parameter's value from the parsed arguments, checking aliases.
 * @param p The parameter descriptor
 * @param args The parsed command arguments
 * @returns The matched value, or `undefined` if not found
 */
declare const getParameterValue: (p: ICliCommandParameterDescriptor, args: Record<string, any>) => unknown;
/**
 * Pretty-print a JSON value with ANSI color highlighting.
 * @param json The value to format
 * @returns A colorized, indented string suitable for terminal output
 */
declare const formatJson: (json: any) => string;
/**
 * Apply ANSI color codes to a JSON string using token-based scanning.
 * Handles keys, strings, numbers, booleans, null, and structural characters.
 * @param jsonString The raw JSON string to colorize
 * @returns The colorized string
 */
declare const colorizeJson: (jsonString: string) => string;
/**
 * Convert a key-value object to a URL query string. Arrays produce repeated keys.
 * @param params The parameters to encode
 * @returns The encoded query string (without leading `?`)
 */
declare const toQueryString: (params: Record<string, any>) => string;
/**
 * Highlight regex matches in text using an ANSI background color.
 * @param text The source text
 * @param pattern The regex pattern to highlight
 * @param bgColor The background color to apply (default: Yellow)
 * @returns The text with matching segments wrapped in ANSI background color codes
 */
declare const highlightTextWithBg: (text: string, pattern: RegExp, bgColor?: CliBackgroundColor) => string;
/**
 * Extract the substring to the right of a given word in a command string.
 * @param command The full command string
 * @param word The word to search for
 * @returns The trimmed text after the word, or `undefined` if not found
 */
declare const getRightOfWord: (command: string, word: string) => string | undefined;
/**
 * Apply a color function to the first word of a text string, preserving leading whitespace.
 * @param text The text to process
 * @param colorFunction A function that wraps a word in ANSI color codes
 * @returns The text with only the first word colorized
 */
declare const colorFirstWord: (text: string, colorFunction: (word: string) => string) => string;

declare const utils: {
    getParameterValue: (p: ICliCommandParameterDescriptor, args: Record<string, any>) => unknown;
    formatJson: (json: any) => string;
    colorizeJson: (jsonString: string) => string;
    toQueryString: (params: Record<string, any>) => string;
    highlightTextWithBg: (text: string, pattern: RegExp, bgColor?: CliBackgroundColor) => string;
    getRightOfWord: (command: string, word: string) => string | undefined;
    colorFirstWord: (text: string, colorFunction: (word: string) => string) => string;
    ObjectDescriber: typeof ObjectDescriber;
    delay: (ms: number) => Promise<void>;
    getConfigValue: typeof getConfigValue;
    getPluginConfigValue: typeof getPluginConfigValue;
    resolveConfigurationCategories: typeof resolveConfigurationCategories;
    CLI_CONFIGURE_STORE_NAME: string;
};

declare const DefaultLibraryAuthor: ICliCommandAuthor;
declare const constants: {
    DefaultLibraryAuthor: ICliCommandAuthor;
};

/** Error message used when a `CancellablePromise` is cancelled. */
declare const CANCELLATION_ERROR_MESSAGE = "Promise cancelled";
/**
 * A promise wrapper that supports cooperative cancellation.
 *
 * Create with an executor (like `new Promise`), then call `execute()` to run.
 * Call `cancel()` to reject with a cancellation error and prevent further
 * resolve/reject callbacks from firing.
 *
 * @example
 * ```ts
 * const cp = new CancellablePromise<string>((resolve) => {
 *     setTimeout(() => resolve('done'), 5000);
 * });
 * cp.execute().catch(e => console.log(e.message)); // 'Promise cancelled'
 * cp.cancel();
 * ```
 */
declare class CancellablePromise<T> {
    private executor;
    private hasCancelled;
    private abortController;
    constructor(executor: (resolve: (value: T) => void, reject: (reason?: any) => void) => void);
    /**
     * Run the executor and return a promise for its result.
     * If `cancel()` has been called, the promise rejects immediately.
     */
    execute(): Promise<T>;
    /**
     * Cancel the promise. The executing promise rejects with
     * `Error('Promise cancelled')` and subsequent resolve/reject calls are ignored.
     */
    cancel(): void;
}

type CliTheme = ITheme;
type DefaultThemesType = {
    default: CliTheme;
    classic: CliTheme;
    dracula: CliTheme;
    monokai: CliTheme;
    solarizedDark: CliTheme;
    solarizedLight: CliTheme;
    gruvboxDark: CliTheme;
    gruvboxLight: CliTheme;
    nord: CliTheme;
    oneDark: CliTheme;
    material: CliTheme;
    highContrastLight: CliTheme;
    tokyoNight: CliTheme;
    catppuccinMocha: CliTheme;
    catppuccinFrappe: CliTheme;
    rosePine: CliTheme;
    kanagawa: CliTheme;
    everforestDark: CliTheme;
    ayuDark: CliTheme;
    catppuccinLatte: CliTheme;
    rosePineDawn: CliTheme;
    everforestLight: CliTheme;
    githubLight: CliTheme;
    cyberpunk: CliTheme;
    retroGreen: CliTheme;
    retroAmber: CliTheme;
    matrix: CliTheme;
    synthwave: CliTheme;
    highContrastDark: CliTheme;
    yellow: CliTheme;
    [key: string]: CliTheme;
};

declare const DefaultThemes: DefaultThemesType;

type CliThemeCategory = 'dark' | 'light';
interface CliThemeInfo {
    theme: ITheme;
    category: CliThemeCategory;
    tags: string[];
    description: string;
}

declare const DefaultThemeInfos: Record<string, CliThemeInfo>;

declare const LIBRARY_VERSION = "2.0.0";
declare const API_VERSION = 2;

/**
 * Context provided to worker service handlers inside a Web Worker.
 */
interface WorkerServiceContext {
    /** Emit an event to the main thread */
    emit(event: Omit<ICliServiceEvent, 'timestamp'>): void;
    /** Log a message (forwarded to the main-thread log buffer) */
    log(message: string, level?: CliServiceLogLevel): void;
    /** Update state on the main thread */
    updateState(patch: Record<string, unknown>): void;
    /** Create an interval that is auto-cleared on stop */
    createInterval(callback: () => void, ms: number): ICliManagedInterval;
    /** Create a timeout that is auto-cleared on stop */
    createTimeout(callback: () => void, ms: number): ICliManagedTimer;
    /** AbortSignal scoped to this service */
    signal: AbortSignal;
}
/**
 * Lightweight helper for authoring worker-compatible background services.
 * Call this at the top level of your worker script.
 */
declare function createWorkerService(handlers: {
    onStart(ctx: WorkerServiceContext): Promise<void>;
    onStop?(): Promise<void>;
}): void;

/**
 * Browser-based file transfer service using native browser APIs.
 *
 * This is the default implementation when no virtual filesystem is available.
 * `readFile` and `uploadFromBrowser` open a file picker dialog.
 * `writeFile` and `downloadToBrowser` trigger a browser download.
 *
 * **Limitations:** `listFiles()` and `exists()` are not supported in the
 * browser environment and always return empty/false respectively.
 * Use `@qodalis/cli-files` for full filesystem capabilities.
 */
declare class BrowserFileTransferService implements ICliFileTransferService {
    readFile(_path: string): Promise<string | null>;
    writeFile(path: string, content: string): Promise<void>;
    /**
     * Not supported in browser — always returns an empty array.
     * Use `@qodalis/cli-files` for directory listing.
     */
    listFiles(_path: string): Promise<ICliFileEntry[]>;
    /**
     * Not supported in browser — always returns `false`.
     * Use `@qodalis/cli-files` for file existence checks.
     */
    exists(_path: string): Promise<boolean>;
    downloadToBrowser(filename: string, content: string | Blob): void;
    uploadFromBrowser(accept?: string): Promise<{
        name: string;
        content: string;
    } | null>;
    private _pickFile;
}

export { API_VERSION, BrowserFileTransferService, CANCELLATION_ERROR_MESSAGE, CLI_CONFIGURE_STORE_NAME, CancellablePromise, CliAccessDeniedError, CliBackgroundColor, CliForegroundColor, CliHttpError, CliIcon, CliKeyData, CliLogLevel, CliModuleRegistry, CliServerPermissions, CliUsersPermissions, DEFAULT_DIR_PERMISSIONS, DEFAULT_FILE_PERMISSIONS, DefaultLibraryAuthor, DefaultThemeInfos, DefaultThemes, ICliAuditService_TOKEN, ICliAuthService_TOKEN, ICliAuthorizationService_TOKEN, ICliCommandGuard_TOKEN, ICliCompletionProvider_TOKEN, ICliDragDropService_TOKEN, ICliEventBus_TOKEN, ICliFilePickerProvider_TOKEN, ICliFileTransferService_TOKEN, ICliGroupsStoreService_TOKEN, ICliHttpClient_TOKEN, ICliKeyValueStore_TOKEN, ICliPermissionRegistry_TOKEN, ICliPermissionService_TOKEN, ICliServerAuthService_TOKEN, ICliServerAuthTokenProvider_TOKEN, ICliServerManager_TOKEN, ICliSessionsService_TOKEN, ICliTranslationService_TOKEN, ICliUserEventService_TOKEN, ICliUserSessionService_TOKEN, ICliUsersStoreService_TOKEN, LIBRARY_VERSION, ObjectDescriber, ServerVersionNegotiator, appendQueryParams, bootCliModule, buildAuthenticatedWebSocketUrl, clearTerminalLine, cliAccessMetadataGuards, cliAuthorize, cliCanAccess, cliDefaultServer, cliEvaluateAccess, cliHasPermission, cliMergePermissions, cliMissingPermissions, cliPermissionMatches, cliRequireAuthGuard, cliRequiredGroupsGuard, cliRequiredPermissionsGuard, colorFirstWord, colorizeJson, compareVersions, constants, createCliToken, createWorkerService, delay, derivePanelThemeStyles, enums, formatJson, getConfigValue, getParameterValue, getPluginConfigValue, getRightOfWord, highlightTextWithBg, initializeBrowserEnvironment, isCliAccessDeniedError, joinShellWords, loadPanelPosition, nextPanelPosition, quoteShellWord, resolveConfigurationCategories, resolveHeaders, resolveServerHeaders, resolveServerWebSocketUrl, satisfiesMinVersion, satisfiesVersionRange, savePanelPosition, splitShellWords, stripAnsi, toQueryString, truncateToWidth, unquoteRawArgument, utils, visibleLength, writeExamples, writeHint, writeUsage, writeWrapped };
export type { CliAccessAction, CliAddUser, CliBackgroundServiceStatus, CliBackgroundServiceType, CliBootOptions, CliCommandGuardResult, CliDateOptions, CliEmitOptions, CliEngineSnapshot, CliEvent, CliEventData, CliEventHandler, CliEventMap, CliEventType, CliFactoryProvider, CliFilePickerOptions, CliFileResult, CliFullScreenOptions, CliHeadersProvider, CliHelpRow, CliHttpRequestOptions, CliLineOptions, CliMultiSelectOption, CliMultiSelectOptions, CliNotification, CliNotificationLevel, CliNumberOptions, CliOptions, CliPackageSource, CliPanelConfig, CliPanelHideAlignment, CliPanelPaneState, CliPanelPosition, CliPanelState, CliPanelTabState, CliPercentageProgressBarUpdateValueOptions, CliPermissionDefinition, CliProcessCommand, CliProcessorMetadata, CliProvider, CliSelectOption, CliSelectOptions, CliServerCapabilities, CliServerCommandDescriptor, CliServerConfig, CliServerOutput, CliServerResponse, CliServiceEventHandler, CliServiceExecutionMode, CliServiceLogLevel, CliState, CliStateConfiguration, CliStateScope, CliStateStoreOptions, CliTableOptions, CliTextAnimatorOptions, CliTheme, CliThemeCategory, CliThemeInfo, CliToken, CliTypeProvider, CliUpdateUser, CliValueProvider, CliWorkerInboundMessage, CliWorkerOutboundMessage, CustomEventType, DefaultThemesType, ICliAuditEntry, ICliAuditService, ICliAuthService, ICliAuthorizationService, ICliBackgroundService, ICliBackgroundServiceInfo, ICliBackgroundServiceRegistry, ICliClipboard, ICliCommandAuthor, ICliCommandChildProcessor, ICliCommandControls, ICliCommandExecutorService, ICliCommandGuard, ICliCommandKey, ICliCommandParameterDescriptor, ICliCommandProcessor, ICliCommandProcessorRegistry, ICliCompletionContext, ICliCompletionProvider, ICliConfigurableModule, ICliConfigurationOption, ICliDragDropService, ICliEventBus, ICliExecutionContext, ICliExecutionProcess, ICliFileEntry, ICliFilePickerProvider, ICliFileTransferService, ICliGlobalParameterHandler, ICliGroup, ICliGroupsStoreService, ICliHttpClient, ICliInputReader, ICliKeyValueStore, ICliLogger, ICliManagedInterval, ICliManagedTimer, ICliModule, ICliNotifier, ICliOwnership, ICliPanelRef, ICliPercentageProgressBar, ICliPermissionRegistry, ICliPermissionService, ICliPingServerService, ICliPrincipal, ICliProcessEntry, ICliProcessRegisterOptions, ICliProcessRegistry, ICliProcessorHook, ICliProgressBar, ICliProtectedResource, ICliServerAuthService, ICliServerAuthTokenProvider, ICliServerManager, ICliServiceContext, ICliServiceEvent, ICliServiceLogEntry, ICliServiceProvider, ICliSessionInfo, ICliSessionsService, ICliSpinner, ICliStateStore, ICliTerminalWriter, ICliTextAnimator, ICliTranslationService, ICliUser, ICliUserCredentials, ICliUserEvent, ICliUserEventService, ICliUserSession, ICliUserSessionService, ICliUsersStoreService, ISyntaxHighlightRule, ISyntaxHighlighter, ISyntaxTheme, LineState, Package, ServerVersionInfo, WorkerServiceContext };
