import { CliProcessCommand } from '../models';
import { ICliCommandParameterDescriptor, ICliCommandProcessor } from './command-processor';
import { ICliExecutionContext } from './execution-context';

/**
 * Describes a global parameter (e.g. --help, --version) together with
 * the handler that executes when the parameter is present.
 *
 * Global parameters are checked for every command before the command
 * processor's own `processCommand` runs. If the handler returns `true`,
 * command execution is halted (the parameter "consumed" the invocation).
 */
export interface ICliGlobalParameterHandler {
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
    handle(
        args: Record<string, any>,
        processor: ICliCommandProcessor,
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): boolean | Promise<boolean>;
}
