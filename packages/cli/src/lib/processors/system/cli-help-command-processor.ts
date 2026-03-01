import {
    ICliExecutionContext,
    CliProcessCommand,
    ICliCommandProcessor,
    CliForegroundColor,
    CliProcessorMetadata,
    CliIcon,
    ICliCommandProcessorRegistry,
} from '@qodalis/cli-core';
import { DefaultLibraryAuthor } from '@qodalis/cli-core';
import { CliProcessorsRegistry_TOKEN } from '../../tokens';
import { groupBy } from '../../utils';

export class CliHelpCommandProcessor implements ICliCommandProcessor {
    command = 'help';

    aliases = ['man'];

    description = 'Displays help for a command';

    acceptsRawInput?: boolean | undefined = true;

    author = DefaultLibraryAuthor;

    metadata?: CliProcessorMetadata | undefined = {
        sealed: true,
        icon: CliIcon.Help,
        module: 'system',
    };

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const { writer } = context;
        const registry = context.services.get<ICliCommandProcessorRegistry>(
            CliProcessorsRegistry_TOKEN,
        );

        const [_, ...commandsToHelp] = command.command.split(' ');

        if (commandsToHelp.length === 0) {
            await context.executor.executeCommand('version', context);

            writer.writeln(
                writer.wrapInColor(
                    '  Available commands',
                    CliForegroundColor.Yellow,
                ),
            );
            writer.writeln();

            const groupedCommands = groupBy<ICliCommandProcessor, string>(
                registry.processors.filter((p) => !p.metadata?.hidden),
                (x) => x.metadata?.module || 'uncategorized',
            );

            const sortedModules = [...groupedCommands.entries()].sort(
                ([a], [b]) => {
                    if (a === 'uncategorized') return 1;
                    if (b === 'uncategorized') return -1;
                    return 0;
                },
            );

            sortedModules.forEach(([module, processors]) => {
                const displayName = this.formatModuleName(module);
                writer.writeln(
                    `  ${writer.wrapInColor(displayName, CliForegroundColor.Yellow)}`,
                );

                processors.forEach((processor) => {
                    const icon = processor?.metadata?.icon || CliIcon.Extension;
                    const name = writer.wrapInColor(
                        processor.command.padEnd(20),
                        CliForegroundColor.Cyan,
                    );
                    const aliasText = processor.aliases?.length
                        ? writer.wrapInColor(
                              ` ${processor.aliases.join(', ')}`,
                              CliForegroundColor.Magenta,
                          )
                        : '';
                    const desc = processor?.description || '';
                    writer.writeln(`    ${icon}  ${name} ${desc}${aliasText}`);
                });

                writer.writeln();
            });

            await context.executor.executeCommand('hotkeys', context);

            writer.writeln();
            writer.writeln(
                `  Type ${writer.wrapInColor('help <command>', CliForegroundColor.Cyan)} for detailed information about a command`,
            );
        } else {
            const processor = registry.findProcessor(
                commandsToHelp[0],
                commandsToHelp.slice(1),
            );

            if (processor) {
                this.writeProcessorDescription(processor, context);
            } else {
                writer.writeError(`Unknown command: ${commandsToHelp[0]}`);
                writer.writeln();
                writer.writeln(
                    `  Type ${writer.wrapInColor('help', CliForegroundColor.Cyan)} to see all available commands`,
                );
            }
        }
    }

    writeDescription({ writer }: ICliExecutionContext): void {
        writer.writeln('Displays help information for commands');
        writer.writeln();
        writer.writeln(
            writer.wrapInColor('Usage:', CliForegroundColor.Yellow),
        );
        writer.writeln(
            `  ${writer.wrapInColor('help', CliForegroundColor.Cyan)}                    Show all available commands`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('help <command>', CliForegroundColor.Cyan)}            Show details for a command`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('help <command> <sub>', CliForegroundColor.Cyan)}      Show details for a subcommand`,
        );
        writer.writeln();
        writer.writeln(
            writer.wrapInColor('Examples:', CliForegroundColor.Yellow),
        );
        writer.writeln(
            `  help pkg                         ${writer.wrapInColor('# Package manager help', CliForegroundColor.Green)}`,
        );
        writer.writeln(
            `  help theme apply                 ${writer.wrapInColor('# Theme apply subcommand help', CliForegroundColor.Green)}`,
        );
    }

    private writeProcessorDescription(
        processor: ICliCommandProcessor,
        context: ICliExecutionContext,
    ) {
        const { writer } = context;

        // ── Header ───────────────────────────────────────────────
        const icon = processor.metadata?.icon || '';
        const name = writer.wrapInColor(
            processor.command,
            CliForegroundColor.Cyan,
        );
        const version = writer.wrapInColor(
            `v${processor.version || '1.0.0'}`,
            CliForegroundColor.Green,
        );
        writer.writeln();
        writer.writeln(`  ${icon}${icon ? '  ' : ''}${name} ${version}`);

        if (processor.description) {
            writer.writeln(`  ${processor.description}`);
        }

        if (processor.aliases?.length) {
            writer.writeln(
                `  Aliases: ${processor.aliases.map((a: string) => writer.wrapInColor(a, CliForegroundColor.Magenta)).join(', ')}`,
            );
        }

        // ── Extension chain ──────────────────────────────────────
        if (processor.originalProcessor) {
            writer.writeln();
            writer.writeln(
                writer.wrapInColor(
                    '  Extension chain:',
                    CliForegroundColor.Yellow,
                ),
            );
            let current = processor.originalProcessor;
            let depth = 1;
            while (current) {
                const module = current.metadata?.module || 'unknown';
                const ver = current.version || '1.0.0';
                writer.writeln(
                    `  ${'└'.padStart(depth + 1, ' ')} ${writer.wrapInColor(current.command, CliForegroundColor.Cyan)} v${ver} ${writer.wrapInColor(`(${module})`, CliForegroundColor.Magenta)}`,
                );
                current = current.originalProcessor!;
                depth++;
            }
        }

        // ── Description ──────────────────────────────────────────
        if (processor.writeDescription) {
            writer.writeln();
            processor.writeDescription(context);
        }

        // ── Subcommands ──────────────────────────────────────────
        if (processor.processors?.length) {
            writer.writeln();
            writer.writeln(
                writer.wrapInColor(
                    '  Subcommands:',
                    CliForegroundColor.Yellow,
                ),
            );

            processor.processors.forEach((sub) => {
                const subName = writer.wrapInColor(
                    sub.command.padEnd(16),
                    CliForegroundColor.Cyan,
                );
                const subAliases = sub.aliases?.length
                    ? writer.wrapInColor(
                          ` (${sub.aliases.join(', ')})`,
                          CliForegroundColor.Magenta,
                      )
                    : '';
                writer.writeln(
                    `    ${subName} ${sub.description || ''}${subAliases}`,
                );
            });
        }

        // ── Parameters ───────────────────────────────────────────
        const commandParams = processor.parameters || [];
        const globalParams = context.executor.getGlobalParameters();

        if (commandParams.length > 0) {
            writer.writeln();
            writer.writeln(
                writer.wrapInColor(
                    '  Options:',
                    CliForegroundColor.Yellow,
                ),
            );

            commandParams.forEach((param) => {
                this.writeParameter(param, writer);
            });
        }

        if (globalParams.length > 0) {
            writer.writeln();
            writer.writeln(
                writer.wrapInColor(
                    '  Global options:',
                    CliForegroundColor.Yellow,
                ),
            );

            globalParams.forEach((param) => {
                this.writeParameter(param, writer);
            });
        }

        // ── Server notice ────────────────────────────────────────
        if (processor.metadata?.requireServer) {
            writer.writeln();
            writer.writeln(
                `  ${writer.wrapInColor('Requires a connected server', CliForegroundColor.Red)}`,
            );
        }

        writer.writeln();
    }

    private formatModuleName(module: string): string {
        // @qodalis/cli-server → Server
        if (module.startsWith('@qodalis/cli-')) {
            const name = module.replace('@qodalis/cli-', '');
            return name.charAt(0).toUpperCase() + name.slice(1);
        }
        // server:myhost → Server (myhost)
        if (module.startsWith('server:')) {
            const name = module.substring(7);
            return `Server (${name})`;
        }
        // system → System, misc → Misc
        return module.charAt(0).toUpperCase() + module.slice(1);
    }

    private writeParameter(
        param: { name: string; aliases?: string[]; type: string; description: string; required: boolean; defaultValue?: any },
        writer: ICliExecutionContext['writer'],
    ) {
        const aliases = param.aliases?.length
            ? `, ${param.aliases.map((a) => `-${a}`).join(', ')}`
            : '';
        const nameStr = writer.wrapInColor(
            `--${param.name}${aliases}`,
            CliForegroundColor.Cyan,
        );
        const typeStr = writer.wrapInColor(
            `<${param.type}>`,
            CliForegroundColor.Yellow,
        );
        const required = param.required
            ? writer.wrapInColor(' (required)', CliForegroundColor.Red)
            : '';
        const defaultVal =
            param.defaultValue !== undefined && !param.required
                ? writer.wrapInColor(
                      ` [default: ${param.defaultValue}]`,
                      CliForegroundColor.Green,
                  )
                : '';
        writer.writeln(
            `    ${nameStr} ${typeStr}  ${param.description}${required}${defaultVal}`,
        );
    }
}
