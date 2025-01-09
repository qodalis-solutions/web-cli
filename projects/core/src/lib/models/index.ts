import { ITerminalInitOnlyOptions, ITerminalOptions } from '@xterm/xterm';

export type CliProcessCommand = {
    /**
     * The command that was entered
     */
    command: string;

    /**
     * The data that was entered
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
    Monitor = '🖥', // Monitor or display
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
    Plugin = '🔌', // Plugin or extension
    Extension = '🧩', // Extension or component
    Module = '📦', // Module or package
    Evaluate = '🔍', // Evaluate or search
    Variable = '🔧', // Variable or setting
    Script = '📜', // Script or code
    Code = '💾', // Code or file

    // Status and Completion
    Logs = '📜', // Logs or history
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
     * The welcome message options
     */
    welcomeMessage?: {
        /**
         * The message to display
         */
        message?: string;

        /**
         * When to show the welcome message
         * @default 'always'
         */
        show?: 'always' | 'once' | 'daily' | 'never';
    };

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

        /**
         * Reload the page when the user changes
         */
        reloadPageOnUserChange?: boolean;
    };

    /**
     * Custom terminal options
     */
    terminalOptions?: ITerminalOptions & ITerminalInitOnlyOptions;

    /**
     * The minimum log level to display
     */
    logLevel?: CliLogLevel;
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

    /**
     * An icon to display for the processor
     */
    icon?: CliIcon | string;
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

export const enums = {
    CliForegroundColor,
    CliBackgroundColor,
    CliIcon,
    CliLogLevel,
};

export * from './services';
