import { ICliCommandProcessor, ICliExecutionContext } from '../interfaces';
import { CliForegroundColor, CliProcessCommand } from '../models';

export class ObjectDescriber {
    static describe(
        obj: any,
        options?: {
            filter?: (o: {
                funcName: string;
                func: any;
                args: string[];
            }) => boolean;
        },
    ): ICliCommandProcessor[] {
        const { filter } = options || {};

        const processors: ICliCommandProcessor[] = [];

        const keys = Object.keys(obj);

        const functions = keys.filter((key) => typeof obj[key] === 'function');

        for (const func of functions) {
            const funcValue = obj[func];
            const args = this.getFunctionArguments(funcValue);

            if (filter) {
                const shouldInclude = filter({
                    funcName: func,
                    func: funcValue,
                    args,
                });

                if (!shouldInclude) {
                    continue;
                }
            }

            const supportsMultipleArgs = args.length > 1;

            const supportsDynamicArgs = this.supportsDynamicArgs(funcValue);

            if (args.length === 0 && !supportsDynamicArgs) {
                continue;
            }

            if (
                args.length > 0 &&
                args.some((arg) => arg === 'function' || arg === 'func')
            ) {
                continue;
            }

            const processor: ICliCommandProcessor = {
                command: func,
                description: `A command that executes the function ${func} with the provided arguments`,
                allowUnlistedCommands: true,
                valueRequired: true,
                parameters: [
                    {
                        name: 'debug',
                        description: 'Debug',
                        type: 'boolean',
                        required: false,
                    },
                ],
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const debug = command.args['debug'] as boolean;

                    if (debug) {
                        context.writer.writeln('Executing command: ' + func);
                        context.writer.writeln(
                            'Arguments: ' + JSON.stringify(command.args),
                        );
                        context.writer.writeln(
                            'Function: ' + funcValue.toString(),
                        );
                    }

                    const argsToCallF: any[] = [];

                    if (supportsMultipleArgs) {
                        for (const arg of args.slice(1)) {
                            argsToCallF.push(command.args[arg]);
                        }
                    }

                    if (supportsDynamicArgs && command.value) {
                        const delimiter = command.args['delimiter'] || ',';
                        argsToCallF.push(...command.value.split(delimiter));
                    }

                    if (debug) {
                        context.writer.writeln(
                            'Arguments after processing: ' +
                                JSON.stringify(argsToCallF),
                        );
                    }

                    const result =
                        supportsDynamicArgs && args.length === 0
                            ? funcValue(...argsToCallF)
                            : funcValue(command.value, ...argsToCallF);

                    context.writer.write(
                        context.writer.wrapInColor(
                            'Result: ',
                            CliForegroundColor.Yellow,
                        ),
                    );

                    if (result === null) {
                        context.writer.writeln('null');
                    } else if (result === undefined) {
                        context.writer.writeln('undefined');
                    } else if (typeof result === 'boolean') {
                        context.writer.writeln(result.toString());
                    } else if (typeof result === 'number') {
                        context.writer.writeln(result.toString());
                    } else if (Array.isArray(result)) {
                        context.writer.writeJson(result);
                    } else if (typeof result === 'string') {
                        context.writer.writeln(result);
                    } else if (typeof result === 'object') {
                        context.writer.writeJson(result);
                    } else {
                        context.writer.writeln(result?.toString());
                    }

                    context.process.output(result?.toString());
                },
                writeDescription: (context: ICliExecutionContext) => {
                    context.writer.writeln(func);
                },
            };

            if (supportsDynamicArgs) {
                processor.parameters?.push({
                    name: 'delimiter',
                    description: 'Delimiter',
                    type: 'string',
                    required: false,
                });
            }

            if (supportsMultipleArgs) {
                processor.parameters?.push(
                    ...args.slice(1).map((arg) => ({
                        name: arg,
                        description: arg,
                        type: 'string',
                        required: false,
                    })),
                );
            }

            processors.push(processor);
        }

        return processors;
    }

    static supportsDynamicArgs(func: any): boolean {
        const funcStr = func.toString();
        return funcStr.includes('arguments');
    }

    static getFunctionArguments(func: any): string[] {
        const funcStr = func.toString();
        const args = funcStr.match(/\(([^)]*)\)/);
        if (!args) {
            return [];
        }
        return args[1]
            .split(',')
            .map((arg: string) => arg.trim())
            .filter((arg: string) => arg !== '');
    }
}
