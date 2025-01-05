import { Inject, Injectable } from '@angular/core';
import {
    ICliExecutionContext,
    ICliCommandProcessor,
    CliProcessCommand,
    getRightOfWord,
    getParameterValue,
    ICliCommandExecutorService,
    CliIcon,
    CancellablePromise,
} from '@qodalis/cli-core';
import {
    CliClearCommandProcessor,
    CliEchoCommandProcessor,
    CliEvalCommandProcessor,
    CliHelpCommandProcessor,
    CliVersionCommandProcessor,
} from '../processors';
import { CommandParser } from '../../utils';
import { CliCommandProcessor_TOKEN } from '../tokens';
import { ProcessExitedError } from './cli-execution-process';
import { CliExecutionContext } from './cli-execution-context';

@Injectable({
    providedIn: 'root',
})
export class CliCommandExecutorService implements ICliCommandExecutorService {
    private processors: ICliCommandProcessor[] = [];

    private commandParser: CommandParser = new CommandParser();

    private initialized = false;
    private initializing = false;

    constructor(
        @Inject(CliCommandProcessor_TOKEN)
        private readonly implementations: ICliCommandProcessor[],
        cliHelpCommandProcessor: CliHelpCommandProcessor,
        cliVersionCommandProcessor: CliVersionCommandProcessor,
    ) {
        this.registerProcessor(new CliClearCommandProcessor());
        this.registerProcessor(new CliEchoCommandProcessor());
        this.registerProcessor(new CliEvalCommandProcessor());
        this.registerProcessor(cliHelpCommandProcessor);
        this.registerProcessor(cliVersionCommandProcessor);
    }

    public async executeCommand(
        command: string,
        context: ICliExecutionContext,
    ): Promise<void> {
        // Split commands by logical operators
        const parts = command.split(/(&&|\|\|)/).map((part) => part.trim());
        let shouldRunNextCommand = true; // Tracks whether to execute the next command

        for (let i = 0; i < parts.length; i++) {
            const current = parts[i];

            // If the current part is a logical operator, adjust the shouldRunNextCommand flag
            if (current === '&&') {
                shouldRunNextCommand = shouldRunNextCommand && true;
                continue;
            } else if (current === '||') {
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

                context.process.start();

                await this.executeSingleCommand(command, data, context);

                commandSuccess = context.process.exitCode === 0;

                context.process.end();
            } catch (e) {
                context.process.end();
                commandSuccess = false;

                context.writer.writeError(`Command ${current} failed: ${e}`);
            }

            shouldRunNextCommand = commandSuccess;
        }
    }

    private async executeSingleCommand(
        command: string,
        data: string | undefined,
        context: ICliExecutionContext,
    ): Promise<void> {
        const { commandName, args } = this.commandParser.parse(command);

        const [mainCommand, ...other] = commandName.split(' ');

        const chainCommands = other.map((c) => c.toLowerCase());

        const executionContext = context as CliExecutionContext;

        const searchableProcessors = executionContext.mainProcessor
            ? (executionContext.mainProcessor.processors ?? [])
            : this.processors;

        const processor = this._findProcessor(
            mainCommand,
            chainCommands,
            searchableProcessors,
        );

        if (!processor) {
            context.writer.writeError(
                `Command: ${commandName} not found or not installed`,
            );

            context.writer.writeInfo(
                'Type "help" for a list of available commands.',
            );
            context.writer.writeInfo(
                'Use packages to install additional commands.',
            );

            context.process.exit(-1);

            return;
        }

        const commandToProcess: CliProcessCommand = {
            command: commandName,
            chainCommands: chainCommands,
            rawCommand: command,
            args: args,
            data: data,
        };

        if (this.versionRequested(context, processor, args)) {
            return;
        }

        if (await this.helpRequested(commandToProcess, context)) {
            return;
        }

        if (this.setMainProcessorRequested(context, processor, args)) {
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
            // Check if the value is provided in the command and set it for chaining
            if (data) {
                commandToProcess.value = data;
            } else {
                context.writer.writeError(
                    `Value required for command: ${commandName} <value>`,
                );

                context.process.exit(-1);

                return;
            }
        } else if (processor.allowUnlistedCommands && !value) {
            if (data) {
                commandToProcess.value = data;
            }
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

        try {
            cancellable = new CancellablePromise<void>(
                async (resolve, reject) => {
                    processor
                        .processCommand(commandToProcess, context)
                        .then(() => {
                            resolve();
                        })
                        .catch((e) => {
                            reject(e);
                        });
                },
            );

            await cancellable.promise;
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
                    context.writer.writeInfo('Process exited successfully');
                }
            } else {
                context.writer.writeError(`Error executing command: ${e}`);
                context.process.exit(-1);
            }
        }
    }

    public async initializeProcessors(
        context: ICliExecutionContext,
    ): Promise<void> {
        if (this.initialized || this.initializing) {
            return;
        }
        this.initializing = true;

        let processors = this.implementations;

        if (!context.options?.usersModule?.enabled) {
            processors = processors.filter(
                (p) => p.metadata?.module !== 'users',
            );
        }

        context.spinner?.show();

        context.spinner?.setText(CliIcon.Rocket + '  Booting...');

        processors.forEach((impl) => this.registerProcessor(impl));

        await this.initializeProcessorsInternal(context, this.processors);

        context.spinner?.hide();

        this.initialized = true;
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
            for (const p of processors) {
                if (p.initialize) {
                    await p.initialize(context);
                }

                if (p.processors && p.processors.length > 0) {
                    await this.initializeProcessorsInternal(
                        context,
                        p.processors,
                    );
                }
            }
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

    private setMainProcessorRequested(
        context: ICliExecutionContext,
        processor: ICliCommandProcessor,
        args: Record<string, any>,
    ): boolean {
        if (args['main']) {
            context.setMainProcessor(processor);
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
        const processor = processors.find(
            (p) => p.command.toLowerCase() === mainCommand.toLowerCase(),
        );

        if (!processor) {
            return undefined;
        }

        if (chainCommands.length === 0) {
            return processor;
        }

        if (processor.processors) {
            return this._findProcessor(
                chainCommands[0],
                chainCommands.slice(1),
                processor.processors,
            );
        } else if (processor.allowUnlistedCommands) {
            return processor;
        }

        return undefined;
    }

    public registerProcessor(processor: ICliCommandProcessor): void {
        const existingProcessor = this.getProcessorByName(processor.command);

        if (existingProcessor) {
            if (existingProcessor.metadata?.sealed) {
                console.warn(
                    `Processor with command: ${processor.command} is sealed and cannot be replaced.`,
                );

                return;
            }

            const existingIndex = this.processors.findIndex(
                (p) => p.command === processor.command,
            );

            // Replace the existing processor
            this.processors[existingIndex] = processor;
        } else {
            this.processors.push(processor);
        }
    }

    public unregisterProcessor(processor: ICliCommandProcessor): void {
        const existingProcessor = this.getProcessorByName(processor.command);

        if (existingProcessor) {
            if (existingProcessor.metadata?.sealed) {
                console.warn(
                    `Processor with command: ${processor.command} is sealed and cannot be removed.`,
                );
                return;
            }
        }

        const index = this.processors.findIndex(
            (p) => p.command === processor.command,
        );

        if (index !== -1) {
            this.processors.splice(index, 1);
        }
    }

    private getProcessorByName(name: string): ICliCommandProcessor | undefined {
        return this.processors.find(
            (p) => p.command.toLowerCase() === name.toLowerCase(),
        );
    }
}
