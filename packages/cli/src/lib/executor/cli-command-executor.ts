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
    ICliProcessRegistry,
} from '@qodalis/cli-core';
import { CliProcessRegistry_TOKEN } from '../services/cli-process-registry';
import { CommandParser, CommandPart } from '../parsers';
import { reconcileArgs } from '../parsers/reconcile-args';
import { CliExecutionProcess } from '../context/cli-execution-process';
import { CliArgsParser } from '../parsers/args-parser';
import { ProcessExitedError } from '../errors';
import { CliCommandExecutionContext } from '../context/cli-command-execution-context';
import { CliAliasCommandProcessor } from '../processors';
import { CapturingTerminalWriter } from '../services/capturing-terminal-writer';
import { ICliEnvironment, ICliEnvironment_TOKEN } from '../services/cli-environment';
import {
    versionGlobalParameter,
    helpGlobalParameter,
    contextGlobalParameter,
} from './global-parameters';
import {
    writeOutputToFile,
    appendOutputToFile,
    writeStderrToFile,
    appendStderrToFile,
} from './cli-io-redirect-handler';
import { tryExecuteScript, expandEnvironmentVars } from './cli-script-executor';

/**
 * Extended execution context interface used internally by the command executor.
 * The concrete implementation (e.g. CliExecutionContext in angular-cli) provides these.
 */
export interface ICliExecutionHost extends ICliExecutionContext {
    contextProcessor?: ICliCommandProcessor;
    abort?(): void;
    lastCommandResult?: { command: string; success: boolean };
    isExecuting?: boolean;
    statusText?: string;
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

        rootContext.isExecuting = true;
        try {

        // Track the last *executed* command's success — skipped commands don't change this.
        let lastExitSuccess = true;
        // Whether the next command part should be executed.
        let shouldRunNext = true;
        // Data flowing through the pipeline — explicitly tracked so it survives
        // process.start() resets and failed commands.
        let pipelineData: any = undefined;
        // The capturing writer from the last executed command, used for stderr redirects.
        let lastCapturingWriter: CapturingTerminalWriter | undefined;

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
                    await appendOutputToFile(nextPart.value, context);
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
                    await writeOutputToFile(nextPart.value, context);
                    pipelineData = undefined;
                }
                continue;
            } else if (part.type === '2>>') {
                const nextPart = parts[i + 1];
                i++;
                if (!nextPart || nextPart.type !== 'command') {
                    context.writer.writeError('Missing file path after 2>>');
                    lastExitSuccess = false;
                    continue;
                }
                if (shouldRunNext) {
                    await appendStderrToFile(nextPart.value, context, lastCapturingWriter);
                }
                continue;
            } else if (part.type === '2>') {
                const nextPart = parts[i + 1];
                i++;
                if (!nextPart || nextPart.type !== 'command') {
                    context.writer.writeError('Missing file path after 2>');
                    lastExitSuccess = false;
                    continue;
                }
                if (shouldRunNext) {
                    await writeStderrToFile(nextPart.value, context, lastCapturingWriter);
                }
                continue;
            }

            // Command part — only execute if shouldRunNext
            if (!shouldRunNext) {
                // Skipped: do NOT update lastExitSuccess or pipelineData
                continue;
            }

            try {
                lastCapturingWriter = await this.executeSingleCommand(
                    part.value,
                    pipelineData,
                    rootContext,
                );

                lastExitSuccess =
                    context.process.exitCode === undefined ||
                    context.process.exitCode === 0;

                rootContext.lastCommandResult = {
                    command: part.value,
                    success: lastExitSuccess,
                };

                // Capture output for the next command in the chain
                pipelineData = context.process.data;
            } catch (e) {
                lastExitSuccess = false;
                rootContext.lastCommandResult = {
                    command: part.value,
                    success: false,
                };
                // Failed command didn't produce usable output — preserve
                // whatever data was available before the failure so that
                // a >> redirect after || can still access it.

                context.writer.writeError(`Command ${part.value} failed: ${e}`);
            }

            // Default: next command runs unless an operator says otherwise
            shouldRunNext = true;
        }

        } finally {
            rootContext.isExecuting = false;
            rootContext.statusText = undefined;
        }
    }

    private async executeSingleCommand(
        command: string,
        data: any | undefined,
        context: ICliExecutionHost,
    ): Promise<CapturingTerminalWriter | undefined> {
        const process = context.process as CliExecutionProcess;

        // Substitute environment variables ($VAR / ${VAR}) before parsing
        command = expandEnvironmentVars(command, context);

        // Handle inline variable assignment: VAR=value (no command after it)
        const assignMatch = command.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
        if (assignMatch) {
            try {
                const env = context.services.get<ICliEnvironment>(ICliEnvironment_TOKEN);
                let val = assignMatch[2];
                if (
                    (val.startsWith('"') && val.endsWith('"')) ||
                    (val.startsWith("'") && val.endsWith("'"))
                ) {
                    val = val.slice(1, -1);
                }
                env.set(assignMatch[1], val);
                process.start();
                process.end();
                return;
            } catch {
                // Environment service not available — treat as command
            }
        }

        process.start();

        let processEntry: { pid: number; abortController: AbortController } | undefined;
        try {
            const procRegistry = context.services.get<ICliProcessRegistry>(CliProcessRegistry_TOKEN);
            processEntry = procRegistry.register(command);
        } catch {
            // Registry not available — proceed without it
        }

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
        // Update both parsedArgs AND commandName so that consumed
        // flag values (e.g. "5" in "-n 5") are excluded from
        // the positional value passed to the processor.
        if (processor?.parameters?.length) {
            const reconciled = reconcileArgs(
                parsed.tokens,
                processor.parameters,
            );
            parsedArgs = reconciled.args;
            commandName = reconciled.commandParts.join(' ');
        }

        if (!processor) {
            const aliasProcessor = this.registry.findProcessor('alias', []) as
                | CliAliasCommandProcessor
                | undefined;
            const aliases = aliasProcessor?.userAliases ?? {};

            if (aliases[mainCommand]) {
                this.completeProcess(processEntry, context, 0);
                return await this.executeSingleCommand(
                    aliases[mainCommand],
                    data,
                    context,
                );
            }

            // Try executing as a script file (./path or /path)
            if (mainCommand.startsWith('./') || mainCommand.startsWith('/')) {
                const executed = await tryExecuteScript(
                    mainCommand,
                    context,
                    this.executeCommand.bind(this),
                );
                if (executed) {
                    this.completeProcess(processEntry, context, 0);
                    process.end();
                    return;
                }
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

            this.failProcess(processEntry, context);

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
            // Skip global handler if the processor declares its own parameter
            // with the same name or overlapping alias (e.g. curl's -v for verbose)
            if (this.processorOwnsParameter(processor, handler.parameter)) {
                continue;
            }
            if (await handler.handle(args, processor, commandToProcess, context)) {
                this.completeProcess(processEntry, context, 0);
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

        const commandAbortController = new AbortController();
        commandContext.signal = commandAbortController.signal;

        const abortSub = context.onAbort.subscribe(() => {
            commandAbortController.abort();
        });

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

            this.completeProcess(processEntry, context, context.process.exitCode ?? 0);

            if (!process.exited) {
                process.end();
            }

            return capturingWriter;
        } catch (e) {
            context.spinner?.hide();

            if (e instanceof ProcessExitedError) {
                if (e.code === 0) {
                    this.completeProcess(processEntry, context, 0);
                } else {
                    this.failProcess(processEntry, context);
                }

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
                this.failProcess(processEntry, context);
                context.writer.writeError(`Error executing command: ${e}`);
                context.process.exit(-1);
            }
        } finally {
            abortSub.unsubscribe();
        }

        return capturingWriter;
    }

    private completeProcess(
        processEntry: { pid: number } | undefined,
        context: ICliExecutionContext,
        exitCode: number,
    ): void {
        if (!processEntry) return;
        try {
            const procRegistry = context.services.get<ICliProcessRegistry>(CliProcessRegistry_TOKEN);
            procRegistry.complete(processEntry.pid, exitCode);
        } catch { /* ignore */ }
    }

    private failProcess(
        processEntry: { pid: number } | undefined,
        context: ICliExecutionContext,
    ): void {
        if (!processEntry) return;
        try {
            const procRegistry = context.services.get<ICliProcessRegistry>(CliProcessRegistry_TOKEN);
            procRegistry.fail(processEntry.pid);
        } catch { /* ignore */ }
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

    /**
     * Returns true when the processor (or one of its ancestors) declares a
     * parameter whose name or aliases overlap with the global handler's
     * parameter.  In that case the global handler must be skipped so the
     * processor can handle the flag itself.
     */
    private processorOwnsParameter(
        processor: ICliCommandProcessor,
        globalParam: ICliCommandParameterDescriptor,
    ): boolean {
        const globalNames = new Set<string>([
            globalParam.name,
            ...(globalParam.aliases ?? []),
        ]);

        const params = processor.parameters;
        if (!params) return false;

        return params.some(
            (p) =>
                globalNames.has(p.name) ||
                p.aliases?.some((a) => globalNames.has(a)),
        );
    }
}
