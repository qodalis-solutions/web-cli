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
    /** Whether this server supports SSE streaming execution */
    streaming?: boolean;
};
