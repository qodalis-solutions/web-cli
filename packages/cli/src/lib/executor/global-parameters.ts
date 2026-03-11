import {
    ICliGlobalParameterHandler,
    ICliCommandProcessor,
    ICliExecutionContext,
    CliProcessCommand,
    CliForegroundColor,
} from '@qodalis/cli-core';

/**
 * --version / -v : prints the processor's version and halts execution.
 */
export const versionGlobalParameter: ICliGlobalParameterHandler = {
    parameter: {
        name: 'version',
        aliases: ['v'],
        type: 'boolean',
        description: 'Displays the version of the command',
        required: false,
    },
    priority: 0,
    handle(
        args: Record<string, any>,
        processor: ICliCommandProcessor,
        _command: CliProcessCommand,
        context: ICliExecutionContext,
    ): boolean {
        if (args['v'] || args['version']) {
            context.writer.writeln(
                `${context.writer.wrapInColor(processor.version || '1.0.0', CliForegroundColor.Cyan)}`,
            );
            return true;
        }
        return false;
    },
};

/**
 * --help / -h : shows help for the current command and halts execution.
 */
export const helpGlobalParameter: ICliGlobalParameterHandler = {
    parameter: {
        name: 'help',
        aliases: ['h'],
        type: 'boolean',
        description: 'Displays help for the command',
        required: false,
    },
    priority: 10,
    async handle(
        args: Record<string, any>,
        _processor: ICliCommandProcessor,
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<boolean> {
        if (command.command?.startsWith('help')) {
            return false;
        }

        if (args['h'] || args['help']) {
            await context.executor.showHelp(command, context);
            return true;
        }
        return false;
    },
};

/**
 * --context : sets the processor as the active context processor and halts execution.
 */
export const contextGlobalParameter: ICliGlobalParameterHandler = {
    parameter: {
        name: 'context',
        aliases: [],
        type: 'boolean',
        description: 'Sets the command as the active context',
        required: false,
    },
    priority: 20,
    handle(
        args: Record<string, any>,
        processor: ICliCommandProcessor,
        _command: CliProcessCommand,
        context: ICliExecutionContext,
    ): boolean {
        if (args['context']) {
            context.setContextProcessor(processor);
            return true;
        }
        return false;
    },
};
