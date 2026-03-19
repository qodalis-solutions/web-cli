import { ITerminalInitOnlyOptions, ITerminalOptions } from '@xterm/xterm';

export type CliProcessCommand = {
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
    // General Symbols
    CheckIcon = '✔', // Success, completion
    CrossIcon = '✘', // Failure, error
    InfoIcon = 'ℹ', // Information
    WarningIcon = '⚠', // Warning
    QuestionMark = '?', // Help or unknown state
    Exclamation = '❗', // Emphasis or alert
    Ellipsis = '…', // Loading or truncated text
    Dot = '•', // List item
    Bullet = '‣', // Alternate bullet point

    // Arrows
    ArrowRight = '→', // Navigation or next step
    ArrowLeft = '←', // Previous step or navigation
    ArrowUp = '↑', // Up direction
    ArrowDown = '↓', // Down direction
    ArrowRightFilled = '▶', // Navigation or next step (filled)
    ArrowLeftFilled = '◀', // Previous step or navigation (filled)
    ArrowUpFilled = '▲', // Up direction (filled)
    ArrowDownFilled = '▼', // Down direction (filled)
    DoubleArrowRight = '»', // Fast forward or next
    DoubleArrowLeft = '«', // Rewind or previous

    // Lists and Progress
    Star = '★', // Highlight or favorite (filled)
    StarEmpty = '☆', // Highlight or favorite (empty)
    Plus = '+', // Addition or increment
    Minus = '-', // Subtraction or decrement
    Progress = '⏳', // Indicating progress
    Success = '✅', // Success (alternative to CheckIcon)
    Failure = '❌', // Failure (alternative to CrossIcon)

    // Time and Calendar
    Clock = '⏰', // Time-related
    Timer = '⏱', // Stopwatch or timer
    Alarm = '🔔', // Alarm or alert
    Calendar = '📅', // Calendar or date

    // Navigation and Folders
    Folder = '📁', // Directory or file grouping
    FolderOpen = '📂', // Open folder
    File = '📄', // File or document
    Archive = '🗃', // Archive or file grouping
    Link = '🔗', // Hyperlink or connection
    Chain = '⛓', // Chain or linked
    Bookmark = '🔖', // Bookmark or save

    // Actions
    Edit = '✏', // Edit or modify
    Trash = '🗑', // Deletion or removal
    Add = '➕', // Add user or item
    Remove = '➖', // Remove user or item
    Reload = '🔄', // Refresh or reload
    Save = '💾', // Save or store
    Undo = '↩', // Undo action
    Redo = '↪', // Redo action
    Play = '▶', // Start or play
    Pause = '⏸', // Pause or stop temporarily
    Stop = '⏹', // Stop or end
    Cancel = '❎', // Cancel or close

    // User and Security
    User = '👤', // User or profile
    Group = '👥', // Group or team
    Lock = '🔒', // Secured or locked
    Unlock = '🔓', // Unlocked or accessible
    Help = '❓', // Help or support
    Key = '🔑', // Authentication or key
    Shield = '🛡', // Security or protection

    // Tools and Settings
    Gear = '⚙', // Settings or configuration
    Settings = '⚙️', // Settings (alternative)
    Theme = '🎨', // Theme or appearance
    Light = '💡', // Light mode
    Bug = '🐞', // Bug or issue
    Wrench = '🔧', // Maintenance or tools
    Hammer = '🔨', // Build or fix

    // Technology and Devices
    Terminal = '💻', // Terminal or command line
    Database = '🗄', // Database or storage
    Server = '🖥', // Server or host
    Cloud = '☁', // Cloud or remote
    Network = '🌐', // Network or connection
    Monitor = '📺', // Monitor or display
    Printer = '🖨', // Printer or output
    USB = '🔌', // USB or connection
    Speaker = '🔊', // Speaker or audio
    Microphone = '🎙', // Microphone or input
    Camera = '📷', // Camera or video
    Video = '🎥', // Video or media
    Music = '🎵', // Music or audio
    Phone = '📞', // Phone or communication

    // Development and Evaluation
    Package = '📦', // Package or bundle
    Plugin = '🧩', // Plugin or extension
    Extension = '🔌', // Extension or connection
    Module = '🧱', // Module or package
    Evaluate = '🔍', // Evaluate or search
    Variable = '𝑥', // Variable or setting
    Script = '📜', // Script or code
    Code = '📝', // Code or file

    // Status and Completion
    Logs = '📋', // Logs or history
    Power = '⏻', // On/Off state
    Heart = '❤', // Love or favorite
    Flame = '🔥', // Trending or hot
    Growth = '📈', // Growth or increase
    Decline = '📉', // Decline or decrease
    WarningFilled = '⚠️', // Warning (filled)

    // Nature and Weather
    Sun = '☀', // Brightness or day
    Moon = '🌙', // Night or dark mode
    Rain = '🌧', // Rain or bad weather
    Snow = '❄', // Snow or cold
    Lightning = '⚡', // Lightning or danger
    Tree = '🌲', // Nature or environment

    // Emotions and Expressions
    Smile = '😊', // Happiness or positive state
    Sad = '😢', // Sadness or negative state
    Angry = '😡', // Anger or frustration
    Clap = '👏', // Applause or celebration
    ThumbsUp = '👍', // Approval or success
    ThumbsDown = '👎', // Disapproval or failure

    // Miscellaneous
    Rocket = '🚀', // Launch or deploy
    Globe = '🌍', // Earth or international
    Medal = '🏅', // Achievement or award
    Trophy = '🏆', // Winner or champion
    Flag = '🚩', // Mark or flag
    StarFilled = '⭐', // Highlight or favorite
    StarOutline = '✩', // Alternate star icon
    Fireworks = '🎆', // Celebration
    Balloon = '🎈', // Party or fun
    Gift = '🎁', // Reward or present
}

/**
 * Represents a package source for the CLI package manager
 */
export interface CliPackageSource {
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
 * Options for the CLI
 */
export type CliOptions = Record<string, any> & {
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
 * Configuration for a remote CLI server
 */
export type CliServerConfig = {
    /** Unique identifier, used for namespacing commands */
    name: string;

    /** Base URL of the server, e.g. "https://api.example.com" */
    url: string;

    /** Whether this server is enabled. @default true */
    enabled?: boolean;

    /** Custom headers sent with every request (e.g. auth tokens) */
    headers?: Record<string, string>;

    /** Request timeout in milliseconds. @default 30000 */
    timeout?: number;
};

/**
 * A single output item in a server response
 */
export type CliServerOutput =
    | {
          type: 'text';
          value: string;
          style?: 'success' | 'error' | 'info' | 'warning';
      }
    | { type: 'table'; headers: string[]; rows: string[][] }
    | { type: 'list'; items: string[]; ordered?: boolean }
    | { type: 'json'; value: any }
    | { type: 'key-value'; entries: { key: string; value: string }[] };

/**
 * Structured response from a server command execution
 */
export type CliServerResponse = {
    exitCode: number;
    outputs: CliServerOutput[];
};

/**
 * Metadata about a remote command processor, returned by GET /api/qcli/commands
 */
export type CliServerCommandDescriptor = {
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
export type CliServerCapabilities = {
    /** Whether this server supports remote shell access */
    shell: boolean;
    /** Server operating system (e.g. "linux", "win32", "darwin") */
    os?: string;
    /** Path to the shell binary on the server */
    shellPath?: string;
    /** Server version string */
    version?: string;
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
     * If true, the processor is sealed and cannot be replaced or removed.
     * Sealed processors can still be extended (wrapped) by processors with `extendsProcessor = true`.
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
     * If true, the processor is hidden from the help command listing.
     * The command still works when typed directly and `help <command>` still shows its details.
     */
    hidden?: boolean;
};

/**
 * Represents a state configuration for the CLI processor
 */
export type CliStateConfiguration = {
    /**
     * The initial state for the processor
     */
    initialState: Record<string, any>;

    /**
     * The store identifier for the processor, if any
     * @remarks If the store identifier is not set, the processor command name is used
     */
    storeName?: string;
};

/**
 * Represents a log level for the CLI
 */
export enum CliLogLevel {
    None = 0,
    DEBUG = 1,
    LOG = 2,
    INFO = 3,
    WARN = 4,
    ERROR = 5,
}

export type CliState = Record<string, any>;

/**
 * Position of the CLI panel relative to the viewport edge.
 * - `'bottom'` — anchored to the bottom (default)
 * - `'top'` — anchored to the top
 * - `'left'` — anchored to the left (vertical layout)
 * - `'right'` — anchored to the right (vertical layout)
 */
export type CliPanelPosition = 'bottom' | 'top' | 'left' | 'right';

/**
 * Alignment of the hidden-mode tab along its viewport edge.
 * - `'start'` — left for horizontal panels, top for vertical panels
 * - `'center'` — centered along the edge (default)
 * - `'end'` — right for horizontal panels, bottom for vertical panels
 */
export type CliPanelHideAlignment = 'start' | 'center' | 'end';

/**
 * Configuration for the CLI panel component.
 */
export interface CliPanelConfig {
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

export const enums = {
    CliForegroundColor,
    CliBackgroundColor,
    CliIcon,
    CliLogLevel,
};

export * from './services';
export * from './users';
export * from './permissions';
