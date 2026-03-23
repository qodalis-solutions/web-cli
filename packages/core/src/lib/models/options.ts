import { ITerminalInitOnlyOptions, ITerminalOptions } from '@xterm/xterm';
import { CliIcon } from './icons';
import { CliServerConfig } from './server';

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
