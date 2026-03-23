import type { CliProcessCommand } from '../models';
import type { ICliExecutionContext } from './execution-context';
import type { ICliCommandParameterDescriptor } from './command-processor';
import type { ICliGlobalParameterHandler } from './global-parameter';

/**
 * Represents a service that executes commands
 */
export interface ICliCommandExecutorService {
    /**
     * Display the help output for a command, including its description,
     * sub-commands, and parameters.
     * @param command The parsed command to show help for
     * @param context The execution context
     */
    showHelp(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void>;

    /**
     * Execute a command
     * @param command The command to execute
     * @param context The context in which the command is executed
     */
    executeCommand(
        command: string,
        context: ICliExecutionContext,
    ): Promise<void>;

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
