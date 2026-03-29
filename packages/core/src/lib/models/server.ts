import type {
    ICliServerAuthService,
    ICliServiceProvider,
} from '../interfaces/services';
import { ICliServerAuthService_TOKEN } from '../interfaces/services';

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
export type CliHeadersProvider =
    | Record<string, string>
    | (() => Record<string, string>);

/**
 * Resolves a CliHeadersProvider to a plain header map.
 */
export function resolveHeaders(
    provider?: CliHeadersProvider,
): Record<string, string> {
    if (!provider) return {};
    return typeof provider === 'function' ? provider() : provider;
}

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
export function resolveServerHeaders(
    services: ICliServiceProvider | undefined,
    serverName: string,
    configHeaders?: CliHeadersProvider,
): Record<string, string> {
    if (services) {
        const authService = services.get<ICliServerAuthService>(
            ICliServerAuthService_TOKEN,
        );
        if (authService) {
            return authService.getHeaders(serverName, configHeaders);
        }
    }
    return resolveHeaders(configHeaders);
}

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
    /** Whether this server supports SSE streaming execution */
    streaming?: boolean;
};
