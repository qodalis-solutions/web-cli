import { Inject, Injectable } from '@angular/core';
import {
    ICliExecutionContext,
    ICliCommandProcessor,
    CliProcessCommand,
    getRightOfWord,
    getParameterValue,
    ICliCommandExecutorService,
    CancellablePromise,
    CliForegroundColor,
    ICliCommandProcessorRegistry,
} from '@qodalis/cli-core';
import { CommandParser } from '../../utils';
import { CliExecutionProcess } from '../context/cli-execution-process';
import { CliExecutionContext } from '../context/cli-execution-context';
import { CliArgsParser } from '../../utils/args-parser';
import { ProcessExitedError } from '../context/errors';
import { CliCommandExecutionContext } from '../context/cli-command-executution-context';
import { CliAliasCommandProcessor } from '../processors';
import { CliProcessorsRegistry_TOKEN } from '../tokens';

@Injectable({
    providedIn: 'root',
})
export class CliCommandExecutorService implements ICliCommandExecutorService {
    private commandParser: CommandParser = new CommandParser();

    constructor(
        @Inject(CliProcessorsRegistry_TOKEN)
        private readonly registry: ICliCommandProcessorRegistry,
    ) {}

    public async executeCommand(
        command: string,
        context: ICliExecutionContext,
    ): Promise<void> {
        // Split commands by logical operators
        const parts = command.split(/(&&|\|\|)/).map((part) => part.trim());
        let shouldRunNextCommand = true; // Tracks whether to execute the next command

        let rootContext: CliExecutionContext;
        if (context instanceof CliCommandExecutionContext) {
            rootContext = context.context;
        } else {
            rootContext = context as CliExecutionContext;
        }

        for (let i = 0; i < parts.length; i++) {
            const current = parts[i];

            // If the current part is a logical operator, adjust the shouldRunNextCommand flag
            if (current === '&&') {
                // Run next only if previous succeeded
                continue;
            } else if (current === '||') {
                // Run next only if previous failed
                shouldRunNextCommand = !shouldRunNextCommand;
                continue;
            }

            // Skip execution based on previous command's result and operator
            if (!shouldRunNextCommand) {
                shouldRunNextCommand = true; // Reset for next iteration
                continue;
            }

            // Execute the command
            let commandSuccess = true;
            try {
                const data = context.process.data;
                const command = current;

                await this.executeSingleCommand(command, data, rootContext);

                commandSuccess =
                    context.process.exitCode === undefined ||
                    context.process.exitCode === 0;
            } catch (e) {
                commandSuccess = false;

                context.writer.writeError(`Command ${current} failed: ${e}`);
            }

            shouldRunNextCommand = commandSuccess;
        }
    }

    private async executeSingleCommand(
        command: string,
        data: any | undefined,
        context: CliExecutionContext,
    ): Promise<void> {
        const process = context.process as CliExecutionProcess;

        process.start();

        const { commandName, args: parsedArgs } =
            this.commandParser.parse(command);

        const [mainCommand, ...other] = commandName.split(' ');

        const chainCommands = other.map((c) => c.toLowerCase());

        const searchableProcessors = context.contextProcessor
            ? (context.contextProcessor.processors ?? [])
            : this.registry.processors;

        const processor = this.registry.findProcessorInCollection(
            mainCommand,
            chainCommands,
            searchableProcessors,
        );

        if (!processor) {
            const aliases =
                (
                    this.registry.findProcessor(
                        'alias',
                        [],
                    ) as CliAliasCommandProcessor
                ).aliases ?? {};

            if (aliases[mainCommand]) {
                const alias = aliases[mainCommand];
                return await this.executeSingleCommand(alias, data, context);
            }

            context.writer.writeError(
                `Command: ${commandName} not found or not installed`,
            );

            context.writer.writeln();

            context.writer.writeInfo(
                'Type "help" for a list of available commands.',
            );
            context.writer.writeInfo(
                'Use packages to install additional commands.',
            );

            context.process.exit(-1, {
                silent: true,
            });

            return;
        }

        const args = CliArgsParser.convertToRecord(parsedArgs, processor);

        const commandToProcess: CliProcessCommand = {
            command: commandName,
            chainCommands: chainCommands,
            rawCommand: command,
            args: args,
            data: data,
        };

        if (this.versionRequested(context, processor, args)) {
            process.end();
            return;
        }

        if (await this.helpRequested(commandToProcess, context)) {
            process.end();
            return;
        }

        if (this.setContextProcessorRequested(context, processor, args)) {
            process.end();
            return;
        }

        if (!this.validateBeforeExecution(context, processor, args)) {
            process.end();
            return;
        }

        const value =
            processor.allowUnlistedCommands || processor.valueRequired
                ? getRightOfWord(commandName, processor.command)
                : undefined;

        commandToProcess.value = value;

        const missingValue = processor.valueRequired && !value;

        if (missingValue) {
            context.writer.writeError(
                `Value required for command: ${commandName} <value>`,
            );

            context.process.exit(-1);

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

                context.process.exit(-1);

                return;
            }
        }

        let cancellable: CancellablePromise<void> = null!;

        const commandContext = new CliCommandExecutionContext(
            context,
            processor,
        );

        try {
            const hooks = processor.hooks ?? [];

            for (const hook of hooks.filter((h) => h.when === 'before')) {
                await hook.execute(commandContext);
            }

            cancellable = new CancellablePromise<void>(
                async (resolve, reject) => {
                    processor
                        .processCommand(commandToProcess, commandContext)
                        .then(() => {
                            resolve();
                        })
                        .catch((e) => {
                            reject(e);
                        });
                },
            );

            await cancellable.execute();

            for (const hook of hooks.filter((h) => h.when === 'after')) {
                await hook.execute(commandContext);
            }

            process.end();
        } catch (e) {
            context.spinner?.hide();

            if (e instanceof ProcessExitedError) {
                cancellable?.cancel();

                (context as CliExecutionContext)?.abort();

                if (e.code !== 0) {
                    context.writer.writeError(
                        `Process exited with code ${e.code}`,
                    );
                } else {
                    context.writer.writeInfo(
                        'Process exited successfully with code 0',
                    );
                }
            } else {
                context.writer.writeError(`Error executing command: ${e}`);
                context.process.exit(-1);
            }
        }
    }

    public async showHelp(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        try {
            await this.executeCommand('help ' + command.rawCommand, context);
        } catch (e) {
            context.writer.writeError(`Error executing command: ${e}`);
        }
    }

    private versionRequested(
        context: ICliExecutionContext,
        processor: ICliCommandProcessor,
        args: Record<string, any>,
    ): boolean {
        if (args['v'] || args['version']) {
            context.writer.writeln(
                `${context.writer.wrapInColor(processor.version || '1.0.0', CliForegroundColor.Cyan)}`,
            );
            return true;
        }

        return false;
    }

    private setContextProcessorRequested(
        context: ICliExecutionContext,
        processor: ICliCommandProcessor,
        args: Record<string, any>,
    ): boolean {
        if (args['context']) {
            context.setContextProcessor(processor);
            return true;
        }

        return false;
    }

    private async helpRequested(
        commandToProcess: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<boolean> {
        if (commandToProcess.command?.startsWith('help')) {
            return false;
        }

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
                .map((p) => ({
                    name: p.parameter.name,
                    result: p.parameter.validator!(p.value),
                }))
                .filter((p) => !p.result.valid)
                .map((p) => ({
                    name: p.name,
                    message: p.result.message,
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
}
