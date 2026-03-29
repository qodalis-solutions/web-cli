import type { CliLogLevel, CliProvider } from '../models';
import type { ICliCommandProcessor } from './command-processor';
import type { ICliExecutionContext } from './execution-context';

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
 * Represents a module for the web CLI (frontend).
 *
 * This interface is for **web/frontend plugins only** — browser-side modules
 * that extend the CLI terminal UI (e.g. `@qodalis/cli-guid`, `@qodalis/cli-tetris`).
 *
 * It is **not** related to backend server processors (Node/Python/.NET).
 * Backend command processors implement their own `ICliCommandProcessor` interfaces
 * in their respective server packages and do not use `apiVersion`.
 */
export interface ICliModule {
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
     * Returns `undefined` when no provider is registered for the token.
     * For multi-provider tokens, returns the last registered value (use `getAll` for the full array).
     * @param service The token (typically a `*_TOKEN` constant) identifying the service
     * @returns The service instance cast to `T`, or `undefined` if not registered
     */
    get<T = unknown>(service: any): T | undefined;

    /**
     * Retrieve all registered services for a multi-provider token.
     * Returns an empty array when no provider is registered for the token.
     * @param service The token (typically a `*_TOKEN` constant) identifying the service
     * @returns Array of all resolved service instances
     */
    getAll<T = unknown>(service: any): T[];

    /**
     * Retrieve a service by its injection token, throwing if not registered.
     * Use this when the service is required and its absence is a programming error.
     * For multi-provider tokens, returns the last registered value (use `getAll` for the full array).
     * @param service The token (typically a `*_TOKEN` constant) identifying the service
     * @returns The service instance, cast to `T`
     * @throws If no service is registered for the given token
     */
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
}

// ── Authentication ─────────────────────────────────────────────────

/** DI token for `ICliServerAuthTokenProvider` (multi-provider) */
export const ICliServerAuthTokenProvider_TOKEN = 'cli-server-auth-token-provider';

/** DI token for `ICliServerAuthService` */
export const ICliServerAuthService_TOKEN = 'cli-server-auth-service';

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
export interface ICliServerAuthTokenProvider {
    /**
     * Return headers for a given server. Called on every request,
     * so implementations can return fresh tokens.
     *
     * @param serverName  The `name` field from `CliServerConfig`
     * @returns Headers to merge into the request, or an empty object
     */
    getHeaders(serverName: string): Record<string, string>;
}

/**
 * Internal service that resolves auth headers for a server by merging:
 * 1. Static/dynamic headers from `CliServerConfig.headers`
 * 2. Headers from all registered `ICliServerAuthTokenProvider`s
 *
 * Consumers should use this service instead of reading `config.headers` directly.
 */
export interface ICliServerAuthService {
    /**
     * Resolve the final set of headers for a server request.
     * Merges config headers with all registered token providers.
     *
     * @param serverName  The server's `name` field
     * @param configHeaders  The `headers` field from `CliServerConfig`
     * @returns Merged headers ready for use in fetch/WebSocket calls
     */
    getHeaders(serverName: string, configHeaders?: import('../models/server').CliHeadersProvider): Record<string, string>;
}
