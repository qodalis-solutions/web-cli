import {
    ICliExecutionContext,
    CliProcessCommand,
    ICliCommandProcessor,
    ICliCommandAuthor,
    CliProcessorMetadata,
    CliIcon,
    CliForegroundColor,
    ICliCommandParameterDescriptor,
} from '@qodalis/cli-core';

import { DefaultLibraryAuthor } from '@qodalis/cli-core';
import { CliCommandHistory } from '../../services/cli-command-history';
import { CliCommandHistory_TOKEN } from '../../tokens';

export class CliHistoryCommandProcessor implements ICliCommandProcessor {
    command = 'history';

    aliases = ['hist'];

    description?: string | undefined =
        'Prints the command history of the current session';

    processors?: ICliCommandProcessor[] | undefined = [];

    author?: ICliCommandAuthor | undefined = DefaultLibraryAuthor;

    metadata?: CliProcessorMetadata | undefined = {
        sealed: true,
        icon: CliIcon.Code,
        module: 'system',
    };

    constructor() {
        this.processors?.push({
            command: 'list',
            description: this.description,
            processCommand: this.processCommand.bind(this),
            writeDescription: this.writeDescription.bind(this),
        });

        this.processors?.push({
            command: 'clear',
            description: 'Clears the command history',
            processCommand: async (
                _: CliProcessCommand,
                context: ICliExecutionContext,
            ) => {
                const commandHistory = context.services.getRequired<CliCommandHistory>(
                    CliCommandHistory_TOKEN,
                );
                await commandHistory.clearHistory();
                context.writer.writeInfo('Command history cleared');
            },
            writeDescription: (context: ICliExecutionContext) => {
                context.writer.writeln('Clears the command history');
            },
        });

        const searchParameters: ICliCommandParameterDescriptor[] = [
            {
                name: 'n',
                description: 'Maximum number of results to show',
                required: false,
                type: 'number',
            },
        ];

        this.processors?.push({
            command: 'search',
            description: 'Search command history for a pattern',
            parameters: searchParameters,
            processCommand: async (
                cmd: CliProcessCommand,
                context: ICliExecutionContext,
            ) => {
                const commandHistory = context.services.getRequired<CliCommandHistory>(
                    CliCommandHistory_TOKEN,
                );
                const query = (cmd.value ?? '').trim();
                const limit = (cmd.args?.['n'] as number) ?? 0;

                const matches = commandHistory.search(query);

                if (matches.length === 0) {
                    context.writer.writeInfo(
                        query
                            ? `No history entries matching "${query}"`
                            : '📜 No command history yet',
                    );
                    return;
                }

                const displayed = limit > 0 ? matches.slice(-limit) : matches;
                const startOffset =
                    limit > 0 ? matches.length - displayed.length : 0;

                context.writer.writeln(
                    context.writer.wrapInColor(
                        `📜 ${matches.length} match${matches.length !== 1 ? 'es' : ''}${query ? ` for "${query}"` : ''}:`,
                        CliForegroundColor.Yellow,
                    ),
                );

                displayed.forEach((command, i) => {
                    const globalIndex = startOffset + i;
                    const highlighted = query
                        ? command.replace(
                              new RegExp(
                                  query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
                                  'gi',
                              ),
                              (m) =>
                                  context.writer.wrapInColor(
                                      m,
                                      CliForegroundColor.Cyan,
                                  ),
                          )
                        : command;
                    context.writer.writeln(
                        `  ${context.writer.wrapInColor(String(globalIndex + 1).padStart(3), CliForegroundColor.Yellow)}  ${highlighted}`,
                    );
                });
            },
            writeDescription: (context: ICliExecutionContext) => {
                context.writer.writeln(
                    'Search command history for a pattern (case-insensitive substring match)',
                );
                context.writer.writeln();
                context.writer.writeln(`📋 ${context.translator.t('cli.common.usage', 'Usage:')}`);
                context.writer.writeln(
                    `  ${context.writer.wrapInColor('history search git', CliForegroundColor.Cyan)}          Show all history entries containing "git"`,
                );
                context.writer.writeln(
                    `  ${context.writer.wrapInColor('history search git --n 5', CliForegroundColor.Cyan)}    Show last 5 matches`,
                );
            },
        });
    }

    async processCommand(
        _: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const { writer } = context;
        const commandHistory = context.services.getRequired<CliCommandHistory>(
            CliCommandHistory_TOKEN,
        );
        const history = commandHistory.getHistory();

        if (history.length === 0) {
            writer.writeInfo('📜 No command history yet');
            return;
        } else {
            writer.writeln(
                writer.wrapInColor(
                    `📜 Command history (${history.length} entries):`,
                    CliForegroundColor.Yellow,
                ),
            );
            history.forEach((command, index) => {
                writer.writeln(
                    `  ${writer.wrapInColor(String(index + 1).padStart(3), CliForegroundColor.Yellow)}  ${command}`,
                );
            });
        }
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer, translator: t } = context;
        writer.writeln(t.t('cli.history.long_description', 'Prints the command history of the current session'));
        writer.writeln();
        writer.writeln(`📋 ${t.t('cli.common.usage', 'Usage:')}`);
        writer.writeln(
            `  ${writer.wrapInColor('history', CliForegroundColor.Cyan)}                  ${t.t('cli.history.show', 'Show command history')}`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('history search <q>', CliForegroundColor.Cyan)}      ${t.t('cli.history.search', 'Search history for pattern')}`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('history clear', CliForegroundColor.Cyan)}            ${t.t('cli.history.clear', 'Clear all history')}`,
        );
        writer.writeln();
        writer.writeln(
            `💡 ${t.t('cli.history.arrow_hint', 'Use {keys} arrow keys to navigate through history', { keys: '↑/↓' })}`,
        );
        writer.writeln(
            `💡 ${t.t('cli.history.prefix_hint', 'Type a prefix then {key} to search history by prefix', { key: '↑' })}`,
        );
    }
}
