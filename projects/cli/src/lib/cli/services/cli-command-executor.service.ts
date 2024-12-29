import { Inject, Injectable } from '@angular/core';
import {
    ICliExecutionContext,
    ICliCommandProcessor,
    CliProcessCommand,
} from '@qodalis/cli-core';
import {
    CliClearCommandProcessor,
    CliEchoCommandProcessor,
    CliEvalCommandProcessor,
    CliHelpCommandProcessor,
} from '../processors';
import { CliVersionCommandProcessor } from '../processors/cli-version-command-processor';
import { CommandParser, getParameterValue, getRightOfWord } from '../../utils';
import { CliCommandProcessor_TOKEN } from '../tokens';

@Injectable({
    providedIn: 'root',
})
export class CliCommandExecutorService {
    private processors: ICliCommandProcessor[] = [];

    private commandParser: CommandParser = new CommandParser();

    constructor(
        @Inject(CliCommandProcessor_TOKEN)
        implementations: ICliCommandProcessor[],
        cliHelpCommandProcessor: CliHelpCommandProcessor,
        cliVersionCommandProcessor: CliVersionCommandProcessor,
    ) {
        this.registerProcessor(new CliClearCommandProcessor());
        this.registerProcessor(new CliEchoCommandProcessor());
        this.registerProcessor(new CliEvalCommandProcessor());
        this.registerProcessor(cliHelpCommandProcessor);
        this.registerProcessor(cliVersionCommandProcessor);

        implementations.forEach((impl) => this.registerProcessor(impl));
    }

    public async executeCommand(
        command: string,
        context: ICliExecutionContext,
    ): Promise<void> {
        const { commandName, args } = this.commandParser.parse(command);

        const [mainCommand, ...chainCommands] = commandName.split(' ');

        const processor = this.findProcessor(
            mainCommand.toLowerCase(),
            chainCommands,
        );

        if (!processor) {
            context.writer.writeError(`Unknown command: ${commandName}`);

            return;
        }

        const commandToProcess: CliProcessCommand = {
            command: commandName,
            chainCommands: chainCommands,
            rawCommand: command,
            args: args,
        };

        if (this.versionRequested(context, processor, args)) {
            return;
        }

        if (await this.helpRequested(commandToProcess, context)) {
            return;
        }

        if (!this.validateBeforeExecution(context, processor, args)) {
            return;
        }

        const value = processor.allowUnlistedCommands
            ? getRightOfWord(commandName, processor.command)
            : undefined;

        commandToProcess.value = value;

        if (processor.valueRequired && !value) {
            context.writer.writeError(
                `Value required for command: ${commandName} <value>`,
            );
            return;
        }

        if (processor.validateBeforeExecution) {
            const validationResult = processor.validateBeforeExecution(
                commandToProcess,
                context,
            );

            if (validationResult.valid === false) {
                context.writer.writeError(
                    validationResult?.message ||
                        'An error occurred while validating the command.',
                );
                return;
            }
        }

        try {
            await processor.processCommand(commandToProcess, context);
        } catch (e) {
            context.spinner?.hide();
            context.writer.writeError(`Error executing command: ${e}`);
        }
    }

    public async initializeProcessors(
        context: ICliExecutionContext,
    ): Promise<void> {
        await this.initializeProcessorsInternal(context, this.processors);
    }

    public listCommands(): string[] {
        return this.processors.map((p) => p.command);
    }

    public findProcessor(
        mainCommand: string,
        chainCommands: string[],
    ): ICliCommandProcessor | undefined {
        return this._findProcessor(mainCommand, chainCommands, this.processors);
    }

    public async showHelp(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const helpProcessor = this.findProcessor('help', [])!;

        try {
            await helpProcessor.processCommand(
                {
                    ...command,
                    command: 'help ' + command.command,
                },
                context,
            );
        } catch (e) {
            context.writer.writeError(`Error executing command: ${e}`);
        }
    }

    private async initializeProcessorsInternal(
        context: ICliExecutionContext,
        processors: ICliCommandProcessor[],
    ): Promise<void> {
        try {
            processors.forEach(async (p) => {
                if (p.initialize) {
                    await p.initialize(context);
                }

                if (p.processors && p.processors.length > 0) {
                    await this.initializeProcessorsInternal(
                        context,
                        p.processors,
                    );
                }
            });
        } catch (e) {
            context.writer.writeError(`Error initializing processors: ${e}`);
        }
    }

    private versionRequested(
        context: ICliExecutionContext,
        processor: ICliCommandProcessor,
        args: Record<string, any>,
    ): boolean {
        if (args['v'] || args['version']) {
            context.writer.writeln(
                `${processor.command} version: ${processor.version || '1.0.0'} - ${
                    processor.description || 'No description'
                }`,
            );
            return true;
        }

        return false;
    }

    private async helpRequested(
        commandToProcess: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<boolean> {
        if (commandToProcess.args['h'] || commandToProcess.args['help']) {
            await this.showHelp(commandToProcess, context);

            return true;
        }

        return false;
    }

    /**
     * Validates the command arguments before execution.
     * @param context The current CLI execution context.
     * @param processor The processor to validate.
     * @param args The command arguments.
     * @returns True if the arguments are valid, false otherwise.
     */
    private validateBeforeExecution(
        context: ICliExecutionContext,
        processor: ICliCommandProcessor,
        args: Record<string, any>,
    ): boolean {
        // Check for required parameters
        if (processor.parameters?.some((p) => p.required)) {
            const missingParams = processor.parameters?.filter(
                (p) =>
                    p.required &&
                    !args[p.name] &&
                    !p.aliases?.some((a) => args[a]),
            );

            if (missingParams?.length) {
                context.writer.writeError(
                    `Missing required parameters: ${missingParams
                        .map((p) => p.name)
                        .join(', ')}`,
                );

                return false;
            }
        }

        // Check for parameter validation
        const parametersToValidate =
            processor.parameters
                ?.filter((x) => x.validator)
                ?.map((p) => ({
                    parameter: p,
                    value: getParameterValue(p, args),
                }))
                ?.filter((p) => p.value) ?? [];

        if (parametersToValidate.length > 0) {
            const invalidParams = parametersToValidate
                .filter((x) => !x.parameter.validator!(x.value).valid)
                .map((p) => ({
                    name: p.parameter.name,
                    message: p.parameter.validator!(args[p.parameter.name])
                        .message,
                }));

            if (invalidParams?.length) {
                context.writer.writeError('Invalid parameters:');

                invalidParams.forEach((p, index) => {
                    context.writer.writeln(
                        `${index + 1}. Invalid value for ${p.name}: ${args[p.name]} -> ${
                            p.message
                        }`,
                    );
                });

                return false;
            }
        }

        return true;
    }

    /**
     * Recursively searches for a processor matching the given command.
     * @param mainCommand The main command name.
     * @param chainCommands The remaining chain commands (if any).
     * @param processors The list of available processors.
     * @returns The matching processor or undefined if not found.
     */
    private _findProcessor(
        mainCommand: string,
        chainCommands: string[],
        processors: ICliCommandProcessor[],
    ): ICliCommandProcessor | undefined {
        const processor = processors.find((p) => p.command === mainCommand);

        if (!processor) {
            return undefined;
        }

        if (chainCommands.length === 0) {
            return processor;
        }

        if (processor.processors) {
            return this._findProcessor(
                chainCommands[0].toLowerCase(),
                chainCommands.slice(1),
                processor.processors,
            );
        } else if (processor.allowUnlistedCommands) {
            return processor;
        }

        return undefined;
    }

    private registerProcessor(processor: ICliCommandProcessor): void {
        const existingIndex = this.processors.findIndex(
            (p) => p.command === processor.command,
        );

        if (existingIndex !== -1) {
            // Replace the existing processor
            this.processors[existingIndex] = processor;
        } else {
            this.processors.push(processor);
        }
    }
}
