import {
    ICliExecutionContext,
    ICliCommandProcessor,
    CliProcessCommand,
    getRightOfWord,
    getParameterValue,
    ICliCommandExecutorService,
    ICliCommandParameterDescriptor,
    ICliGlobalParameterHandler,
    CancellablePromise,
    CliForegroundColor,
    ICliCommandProcessorRegistry,
} from '@qodalis/cli-core';
import { CommandParser, CommandPart } from '../parsers';
import { reconcileArgs } from '../parsers/reconcile-args';
import { CliExecutionProcess } from '../context/cli-execution-process';
import { CliArgsParser } from '../parsers/args-parser';
import { ProcessExitedError } from '../errors';
import { CliCommandExecutionContext } from '../context/cli-command-execution-context';
import { CliAliasCommandProcessor } from '../processors';
import { CapturingTerminalWriter } from '../services/capturing-terminal-writer';
import {
    versionGlobalParameter,
    helpGlobalParameter,
    contextGlobalParameter,
} from './global-parameters';

/**
 * Extended execution context interface used internally by the command executor.
 * The concrete implementation (e.g. CliExecutionContext in angular-cli) provides these.
 */
export interface ICliExecutionHost extends ICliExecutionContext {
    contextProcessor?: ICliCommandProcessor;
    abort?(): void;
}

export class CliCommandExecutor implements ICliCommandExecutorService {
    private commandParser: CommandParser = new CommandParser();
    private globalParameters: ICliGlobalParameterHandler[] = [];

    constructor(protected readonly registry: ICliCommandProcessorRegistry) {
        this.registerGlobalParameter(versionGlobalParameter);
        this.registerGlobalParameter(helpGlobalParameter);
        this.registerGlobalParameter(contextGlobalParameter);
    }

    registerGlobalParameter(handler: ICliGlobalParameterHandler): void {
        this.globalParameters.push(handler);
        this.globalParameters.sort(
            (a, b) => (a.priority ?? 0) - (b.priority ?? 0),
        );
    }

    getGlobalParameters(): ICliCommandParameterDescriptor[] {
        return this.globalParameters.map((h) => h.parameter);
    }

    public async executeCommand(
        command: string,
        context: ICliExecutionContext,
    ): Promise<void> {
        const parts = CommandParser.splitByOperators(command);

        let rootContext: ICliExecutionHost;
        if (context instanceof CliCommandExecutionContext) {
            rootContext = context.context as ICliExecutionHost;
        } else {
            rootContext = context as ICliExecutionHost;
        }

        // Track the last *executed* command's success — skipped commands don't change this.
        let lastExitSuccess = true;
        // Whether the next command part should be executed.
        let shouldRunNext = true;
        // Data flowing through the pipeline — explicitly tracked so it survives
        // process.start() resets and failed commands.
        let pipelineData: any = undefined;

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];

            if (part.type === '&&') {
                shouldRunNext = lastExitSuccess;
                continue;
            } else if (part.type === '||') {
                shouldRunNext = !lastExitSuccess;
                continue;
            } else if (part.type === '|') {
                // Pipe: always run next command with previous output
                shouldRunNext = true;
                continue;
            } else if (part.type === ';') {
                // Sequential: always run next, reset pipeline data
                shouldRunNext = true;
                pipelineData = undefined;
                continue;
            } else if (part.type === '>>') {
                const nextPart = parts[i + 1];
                i++;
                if (!nextPart || nextPart.type !== 'command') {
                    context.writer.writeError('Missing file path after >>');
                    lastExitSuccess = false;
                    continue;
                }
                if (shouldRunNext) {
                    await this.appendOutputToFile(nextPart.value, context);
                    // Data was consumed by the redirect — clear it
                    pipelineData = undefined;
                }
                continue;
            } else if (part.type === '>') {
                const nextPart = parts[i + 1];
                i++;
                if (!nextPart || nextPart.type !== 'command') {
                    context.writer.writeError('Missing file path after >');
                    lastExitSuccess = false;
                    continue;
                }
                if (shouldRunNext) {
                    await this.writeOutputToFile(nextPart.value, context);
                    pipelineData = undefined;
                }
                continue;
            }

            // Command part — only execute if shouldRunNext
            if (!shouldRunNext) {
                // Skipped: do NOT update lastExitSuccess or pipelineData
                continue;
            }

            try {
                await this.executeSingleCommand(
                    part.value,
                    pipelineData,
                    rootContext,
                );

                lastExitSuccess =
                    context.process.exitCode === undefined ||
                    context.process.exitCode === 0;

                // Capture output for the next command in the chain
                pipelineData = context.process.data;
            } catch (e) {
                lastExitSuccess = false;
                // Failed command didn't produce usable output — preserve
                // whatever data was available before the failure so that
                // a >> redirect after || can still access it.

                context.writer.writeError(`Command ${part.value} failed: ${e}`);
            }

            // Default: next command runs unless an operator says otherwise
            shouldRunNext = true;
        }
    }

    private async appendOutputToFile(
        filePath: string,
        context: ICliExecutionContext,
    ): Promise<void> {
        const FS_TOKEN = 'cli-file-system-service';

        let fs: any;
        try {
            fs = context.services.get(FS_TOKEN);
        } catch {
            context.writer.writeError(
                '>> redirect requires @qodalis/cli-files plugin',
            );
            return;
        }

        const output = context.process.data;
        if (output === undefined || output === null) {
            return;
        }

        try {
            const resolved = fs.resolvePath(filePath.trim());
            const content =
                typeof output === 'string' ? output : JSON.stringify(output);
            if (fs.exists(resolved)) {
                fs.writeFile(resolved, content, true); // append
            } else {
                fs.createFile(resolved, content);
            }
            await fs.persist();
        } catch (e: any) {
            context.writer.writeError(`>> failed: ${e.message || e}`);
        }
    }

    private async writeOutputToFile(
        filePath: string,
        context: ICliExecutionContext,
    ): Promise<void> {
        const FS_TOKEN = 'cli-file-system-service';

        let fs: any;
        try {
            fs = context.services.get(FS_TOKEN);
        } catch {
            context.writer.writeError(
                '> redirect requires @qodalis/cli-files plugin',
            );
            return;
        }

        const output = context.process.data;
        if (output === undefined || output === null) {
            return;
        }

        try {
            const resolved = fs.resolvePath(filePath.trim());
            const content =
                typeof output === 'string' ? output : JSON.stringify(output);
            if (fs.exists(resolved)) {
                fs.writeFile(resolved, content); // overwrite (no append flag)
            } else {
                fs.createFile(resolved, content);
            }
            await fs.persist();
        } catch (e: any) {
            context.writer.writeError(`> failed: ${e.message || e}`);
        }
    }

    private async executeSingleCommand(
        command: string,
        data: any | undefined,
        context: ICliExecutionHost,
    ): Promise<void> {
        const process = context.process as CliExecutionProcess;

        process.start();

        const parsed = this.commandParser.parse(command);
        let { commandName } = parsed;
        let parsedArgs = parsed.args;

        const [mainCommand, ...other] = commandName.split(' ');

        let chainCommands = other.map((c) => c.toLowerCase());

        const searchableProcessors = context.contextProcessor
            ? (context.contextProcessor.processors ?? [])
            : this.registry.processors;

        const processor = this.registry.findProcessorInCollection(
            mainCommand,
            chainCommands,
            searchableProcessors,
        );

        // Reconcile space-separated args (e.g. --server dotnet)
        // using the processor's parameter descriptors.
        // Only update parsedArgs — commandName and chainCommands stay
        // unchanged so that valueRequired / acceptsRawInput and
        // getRightOfWord() continue to work with the original tokens.
        if (processor?.parameters?.length) {
            const reconciled = reconcileArgs(
                parsed.tokens,
                processor.parameters,
            );
            parsedArgs = reconciled.args;
        }

        if (!processor) {
            const aliasProcessor = this.registry.findProcessor('alias', []) as
                | CliAliasCommandProcessor
                | undefined;
            const aliases = aliasProcessor?.userAliases ?? {};

            if (aliases[mainCommand]) {
                return await this.executeSingleCommand(
                    aliases[mainCommand],
                    data,
                    context,
                );
            }

            context.writer.writeError(
                `Command not found: ${context.writer.wrapInColor(commandName, CliForegroundColor.Cyan)}`,
            );

            context.writer.writeln();

            context.writer.writeInfo(
                `💡 Type ${context.writer.wrapInColor('help', CliForegroundColor.Cyan)} for a list of available commands`,
            );
            context.writer.writeInfo(
                `📦 Use ${context.writer.wrapInColor('pkg add <name>', CliForegroundColor.Cyan)} to install additional commands`,
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

        for (const handler of this.globalParameters) {
            if (await handler.handle(args, processor, commandToProcess, context)) {
                process.end();
                return;
            }
        }

        // Extract positional value BEFORE parameter validation so that
        // we can distinguish positional-mode from named-arg-mode.
        const value =
            processor.acceptsRawInput || processor.valueRequired
                ? getRightOfWord(commandName, processor.command)
                : undefined;

        commandToProcess.value = value;

        const hasPositionalInput = !!value || !!data;
        const hasNamedArgs = Object.keys(args).length > 0;

        // valueRequired is satisfied by: positional value, piped data, or named args
        if (processor.valueRequired && !hasPositionalInput && !hasNamedArgs) {
            context.writer.writeError(
                `Value required: ${context.writer.wrapInColor(`${commandName} <value>`, CliForegroundColor.Cyan)}`,
            );

            context.process.exit(-1);

            return;
        }

        // Required parameter validation only applies in named-arg mode.
        // When positional input is present the processor parses it internally.
        if (!this.validateBeforeExecution(context, processor, args, hasPositionalInput)) {
            process.end();
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

        // Wrap the writer to capture stdout-equivalent output.
        // If the command doesn't call process.output() explicitly,
        // the captured text becomes the implicit pipeline data.
        const capturingWriter = new CapturingTerminalWriter(
            commandContext.writer,
        );
        commandContext.writer = capturingWriter;

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

            // Auto-capture: if the command didn't call process.output()
            // but did write to the terminal, use that output as pipeline data.
            if (!process.outputCalled && capturingWriter.hasOutput()) {
                process.data = capturingWriter.getCapturedData();
            }

            process.end();
        } catch (e) {
            context.spinner?.hide();

            if (e instanceof ProcessExitedError) {
                cancellable?.cancel();

                context.abort?.();

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

    /**
     * Validates the command arguments before execution.
     * @param context The current CLI execution context.
     * @param processor The processor to validate.
     * @param args The command arguments.
     * @param hasPositionalInput Whether the command has positional or piped input.
     *   When true, required-parameter checks are skipped because the processor
     *   will parse the positional text itself.
     * @returns True if the arguments are valid, false otherwise.
     */
    private validateBeforeExecution(
        context: ICliExecutionContext,
        processor: ICliCommandProcessor,
        args: Record<string, any>,
        hasPositionalInput: boolean,
    ): boolean {
        // When the user provides positional input (e.g. `scp cat node /app`)
        // the processor is responsible for parsing that text into individual
        // values.  Required-parameter checks only apply in named-arg mode
        // (e.g. `scp cat --server=node --path=/app`).
        if (!hasPositionalInput && processor.parameters?.some((p) => p.required)) {
            const missingParams = processor.parameters?.filter(
                (p) =>
                    p.required &&
                    !args[p.name] &&
                    !p.aliases?.some((a) => args[a]),
            );

            if (missingParams?.length) {
                context.writer.writeError(
                    `Missing required parameters: ${missingParams
                        .map((p) =>
                            context.writer.wrapInColor(
                                `--${p.name}`,
                                CliForegroundColor.Cyan,
                            ),
                        )
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
                        `  ${index + 1}. ${context.writer.wrapInColor(`--${p.name}`, CliForegroundColor.Cyan)} = "${args[p.name]}" → ${p.message}`,
                    );
                });

                return false;
            }
        }

        return true;
    }
}
