import {
    ICliExecutionContext,
    CliProcessCommand,
    ICliCommandProcessor,
    CliForegroundColor,
    CliProcessorMetadata,
    CliIcon,
    ICliCommandProcessorRegistry,
    writeWrapped,
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
        const registry = context.services.getRequired<ICliCommandProcessorRegistry>(
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

            const narrow = isNarrow(context);
            sortedModules.forEach(([module, processors]) => {
                const displayName = this.formatModuleName(module);
                writer.writeln(
                    `  ${BOLD}${writer.wrapInColor(displayName, CliForegroundColor.Yellow)}${RESET}`,
                );

                processors.forEach((processor) => {
                    const icon = processor?.metadata?.icon || CliIcon.Extension;
                    const name = writer.wrapInColor(
                        narrow ? processor.command : processor.command.padEnd(20),
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
                    if (narrow) {
                        writer.writeln(`  ${icon} ${name}${aliasText}`);
                        writeWrapped(context, desc, 6);
                        return;
                    }
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
                this.writeProcessorDescription(
                    processor,
                    context,
                    this.commandPath(registry, commandsToHelp) || processor.command,
                );
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

    /**
     * Canonical path of the command being described (`server.status` for
     * `help srv ping`), so a sub-command's translation keys include its
     * parents: `cli.server.status.description`.
     */
    private commandPath(
        registry: ICliCommandProcessorRegistry,
        words: string[],
    ): string {
        const path: string[] = [];
        let candidates: ICliCommandProcessor[] | undefined = registry.processors;
        for (const word of words) {
            const lower = word.toLowerCase();
            const match: ICliCommandProcessor | undefined = candidates?.find(
                (p) =>
                    p.command.toLowerCase() === lower ||
                    p.aliases?.some((a) => a.toLowerCase() === lower),
            );
            if (!match) break;
            path.push(match.command);
            candidates = match.processors;
        }
        return path.join('.');
    }

    private writeProcessorDescription(
        processor: ICliCommandProcessor,
        context: ICliExecutionContext,
        keyPath: string,
    ) {
        const { writer } = context;
        const t = context.translator;

        // ── Header ───────────────────────────────────────────────
        const version = `${DIM}v${processor.version || '1.0.0'}${RESET}`;

        const headerLines: string[] = [];

        if (processor.description) {
            headerLines.push(
                this.translateDescription(processor.description, keyPath, context),
            );
        }

        if (processor.aliases?.length) {
            headerLines.push(
                `${DIM}${t.t('cli.help.aliases', 'Aliases:')}${RESET} ${processor.aliases.map((a: string) => writer.wrapInColor(a, CliForegroundColor.Magenta)).join(', ')}`,
            );
        }

        writer.writeln();
        writer.writeBox(headerLines, {
            title: `${writer.wrapInColor(processor.command, CliForegroundColor.Cyan)} ${version}`,
            borderColor: CliForegroundColor.White,
        });

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

            const narrow = isNarrow(context);
            processor.processors.forEach((sub) => {
                const subName = writer.wrapInColor(
                    narrow ? sub.command : sub.command.padEnd(16),
                    CliForegroundColor.Cyan,
                );
                const subAliases = sub.aliases?.length
                    ? `${DIM} (${sub.aliases.join(', ')})${RESET}`
                    : '';
                const subDesc = this.translateDescription(
                    sub.description,
                    `${keyPath}.${sub.command}`,
                    context,
                );
                if (narrow) {
                    writer.writeln(`    ${subName}${subAliases}`);
                    writeWrapped(context, subDesc, 6);
                    return;
                }
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
                this.writeParameter(param, context, isNarrow(context));
            });
        }

        if (globalParams.length > 0) {
            writer.writeln();
            writer.writeln(
                `  ${BOLD}${writer.wrapInColor(t.t('cli.help.global_options', 'Global options'), CliForegroundColor.Yellow)}${RESET}`,
            );

            globalParams.forEach((param) => {
                // --help, --version, --context: translated by the language packs
                const description = t.t(`cli.help.global_${param.name}`, param.description);
                this.writeParameter({ ...param, description }, context, isNarrow(context));
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
        context: ICliExecutionContext,
        narrow = false,
    ) {
        const { writer, translator } = context;
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
        if (narrow) {
            writer.writeln(`    ${nameStr} ${typeStr}${required}${defaultVal}`);
            writeWrapped(context, param.description, 6);
            return;
        }
        writer.writeln(
            `    ${nameStr} ${typeStr}  ${param.description}${required}${defaultVal}`,
        );
    }
}

/** Narrow terminals (phones) put descriptions on their own line instead of wrapping mid-word. */
function isNarrow(context: ICliExecutionContext): boolean {
    return (context.terminal?.cols ?? 80) < 60;
}
