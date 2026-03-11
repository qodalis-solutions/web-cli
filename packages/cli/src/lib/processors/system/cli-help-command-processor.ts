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

const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

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
        const t = context.translator;
        const registry = context.services.get<ICliCommandProcessorRegistry>(
            CliProcessorsRegistry_TOKEN,
        );

        const [_, ...commandsToHelp] = command.command.split(' ');

        if (commandsToHelp.length === 0) {
            await context.executor.executeCommand('version', context);

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
                    `  ${BOLD}${writer.wrapInColor(displayName, CliForegroundColor.Yellow)}${RESET}`,
                );

                processors.forEach((processor) => {
                    const icon = processor?.metadata?.icon || CliIcon.Extension;
                    const name = writer.wrapInColor(
                        processor.command.padEnd(20),
                        CliForegroundColor.Cyan,
                    );
                    const aliasText = processor.aliases?.length
                        ? `${DIM} ${processor.aliases.join(', ')}${RESET}`
                        : '';
                    const desc = this.translateDescription(
                        processor.description,
                        processor.command,
                        context,
                    );
                    writer.writeln(`    ${icon}  ${name} ${desc}${aliasText}`);
                });

                writer.writeln();
            });

            writer.writeln(
                `  ${BOLD}${writer.wrapInColor(t.t('cli.help.shortcuts', 'Shortcuts'), CliForegroundColor.Yellow)}${RESET}`,
            );
            await context.executor.executeCommand('hotkeys', context);

            writer.writeln();
            writer.writeln(
                `  ${DIM}${t.t('cli.help.type', 'Type')}${RESET} ${writer.wrapInColor(t.t('cli.help.help_command', 'help <command>'), CliForegroundColor.Cyan)} ${DIM}${t.t('cli.help.for_details', 'for detailed information')}${RESET}`,
            );
        } else {
            const processor = registry.findProcessor(
                commandsToHelp[0],
                commandsToHelp.slice(1),
            );

            if (processor) {
                this.writeProcessorDescription(processor, context);
            } else {
                writer.writeError(t.t('cli.help.unknown_command', 'Unknown command: {command}', { command: commandsToHelp[0] }));
                writer.writeln();
                writer.writeln(
                    `  ${DIM}${t.t('cli.help.type', 'Type')}${RESET} ${writer.wrapInColor('help', CliForegroundColor.Cyan)} ${DIM}${t.t('cli.help.see_all', 'to see all available commands')}${RESET}`,
                );
            }
        }
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer } = context;
        const t = context.translator;
        writer.writeln(t.t('cli.help.long_description', 'Displays help information for commands'));
        writer.writeln();
        writer.writeln(
            writer.wrapInColor(t.t('cli.common.usage', 'Usage:'), CliForegroundColor.Yellow),
        );
        writer.writeln(
            `  ${writer.wrapInColor('help', CliForegroundColor.Cyan)}                    ${t.t('cli.help.show_all', 'Show all available commands')}`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('help <command>', CliForegroundColor.Cyan)}            ${t.t('cli.help.show_details', 'Show details for a command')}`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('help <command> <sub>', CliForegroundColor.Cyan)}      ${t.t('cli.help.show_sub_details', 'Show details for a subcommand')}`,
        );
        writer.writeln();
        writer.writeln(
            writer.wrapInColor(t.t('cli.common.examples', 'Examples:'), CliForegroundColor.Yellow),
        );
        writer.writeln(
            `  help pkg                         ${DIM}# ${t.t('cli.help.example_pkg', 'Package manager help')}${RESET}`,
        );
        writer.writeln(
            `  help theme apply                 ${DIM}# ${t.t('cli.help.example_theme', 'Theme apply subcommand help')}${RESET}`,
        );
    }

    private translateDescription(
        description: string | undefined,
        processorCommand: string,
        context: ICliExecutionContext,
    ): string {
        if (!description) return '';
        return context.translator.t(
            `cli.${processorCommand}.description`,
            description,
        );
    }

    private writeProcessorDescription(
        processor: ICliCommandProcessor,
        context: ICliExecutionContext,
    ) {
        const { writer } = context;
        const t = context.translator;

        // ── Header ───────────────────────────────────────────────
        const icon = processor.metadata?.icon || '';
        const name = `${BOLD}${writer.wrapInColor(processor.command, CliForegroundColor.Cyan)}${RESET}`;
        const version = `${DIM}v${processor.version || '1.0.0'}${RESET}`;

        writer.writeln();
        writer.writeln(`  ${icon}${icon ? '  ' : ''}${name} ${version}`);

        if (processor.description) {
            const desc = this.translateDescription(
                processor.description,
                processor.command,
                context,
            );
            writer.writeln(`  ${desc}`);
        }

        if (processor.aliases?.length) {
            writer.writeln(
                `  ${DIM}${t.t('cli.help.aliases', 'Aliases:')}${RESET} ${processor.aliases.map((a: string) => writer.wrapInColor(a, CliForegroundColor.Magenta)).join(', ')}`,
            );
        }

        // ── Extension chain ──────────────────────────────────────
        if (processor.originalProcessor) {
            writer.writeln();
            writer.writeln(
                `  ${BOLD}${writer.wrapInColor(t.t('cli.help.extension_chain', 'Extension chain'), CliForegroundColor.Yellow)}${RESET}`,
            );
            let current = processor.originalProcessor;
            let depth = 1;
            while (current) {
                const module = current.metadata?.module || 'unknown';
                const ver = current.version || '1.0.0';
                writer.writeln(
                    `  ${'└'.padStart(depth + 1, ' ')} ${writer.wrapInColor(current.command, CliForegroundColor.Cyan)} ${DIM}v${ver}${RESET} ${DIM}(${module})${RESET}`,
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
                `  ${BOLD}${writer.wrapInColor(t.t('cli.help.subcommands', 'Subcommands'), CliForegroundColor.Yellow)}${RESET}`,
            );

            processor.processors.forEach((sub) => {
                const subName = writer.wrapInColor(
                    sub.command.padEnd(16),
                    CliForegroundColor.Cyan,
                );
                const subAliases = sub.aliases?.length
                    ? `${DIM} (${sub.aliases.join(', ')})${RESET}`
                    : '';
                const subDesc = this.translateDescription(
                    sub.description,
                    `${processor.command}.${sub.command}`,
                    context,
                );
                writer.writeln(
                    `    ${subName} ${subDesc}${subAliases}`,
                );
            });
        }

        // ── Parameters ───────────────────────────────────────────
        const commandParams = processor.parameters || [];
        const globalParams = context.executor.getGlobalParameters();

        if (commandParams.length > 0) {
            writer.writeln();
            writer.writeln(
                `  ${BOLD}${writer.wrapInColor(t.t('cli.help.options', 'Options'), CliForegroundColor.Yellow)}${RESET}`,
            );

            commandParams.forEach((param) => {
                this.writeParameter(param, writer, t);
            });
        }

        if (globalParams.length > 0) {
            writer.writeln();
            writer.writeln(
                `  ${BOLD}${writer.wrapInColor(t.t('cli.help.global_options', 'Global options'), CliForegroundColor.Yellow)}${RESET}`,
            );

            globalParams.forEach((param) => {
                this.writeParameter(param, writer, t);
            });
        }

        // ── Server notice ────────────────────────────────────────
        if (processor.metadata?.requireServer) {
            writer.writeln();
            writer.writeln(
                `  ${writer.wrapInColor(t.t('cli.help.requires_server', 'Requires a connected server'), CliForegroundColor.Red)}`,
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
        translator: ICliExecutionContext['translator'],
    ) {
        const aliases = param.aliases?.length
            ? `, ${param.aliases.map((a) => `-${a}`).join(', ')}`
            : '';
        const nameStr = writer.wrapInColor(
            `--${param.name}${aliases}`,
            CliForegroundColor.Cyan,
        );
        const typeStr = `${DIM}<${param.type}>${RESET}`;
        const required = param.required
            ? writer.wrapInColor(` ${translator.t('cli.help.required', '(required)')}`, CliForegroundColor.Red)
            : '';
        const defaultVal =
            param.defaultValue !== undefined && !param.required
                ? `${DIM} [${param.defaultValue}]${RESET}`
                : '';
        writer.writeln(
            `    ${nameStr} ${typeStr}  ${param.description}${required}${defaultVal}`,
        );
    }
}
