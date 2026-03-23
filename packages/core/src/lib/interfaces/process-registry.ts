import type {
    ICliCommandChildProcessor,
    ICliCommandProcessor,
} from './command-processor';

/**
 * Represents a registry for command processors
 */
export interface ICliCommandProcessorRegistry {
    /**
     * The processors registered with the registry
     */
    readonly processors: ICliCommandProcessor[];

    /**
     * Find a processor for a command
     * @param mainCommand
     * @param chainCommands
     */
    findProcessor(
        mainCommand: string,
        chainCommands: string[],
    ): ICliCommandProcessor | undefined;

    /**
     * Recursively searches for a processor matching the given command.
     * @param mainCommand The main command name.
     * @param chainCommands The remaining chain commands (if any).
     * @param processors The list of available processors.
     * @returns The matching processor or undefined if not found.
     */
    findProcessorInCollection(
        mainCommand: string,
        chainCommands: string[],
        processors: ICliCommandProcessor[],
    ): ICliCommandProcessor | undefined;

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
export interface ICliProcessEntry {
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
export interface ICliProcessRegisterOptions {
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
export interface ICliProcessRegistry {
    /** Register a new process, returns assigned PID */
    register(command: string, options?: ICliProcessRegisterOptions): { pid: number; abortController: AbortController };
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
