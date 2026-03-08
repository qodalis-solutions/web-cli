import {
    CliForegroundColor,
    CliProcessCommand,
    CliProcessorMetadata,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';

export class CliClearCommandProcessor implements ICliCommandProcessor {
    command = 'clear';

    aliases = ['cls'];

    description?: string | undefined = 'Clears the terminal';

    author = DefaultLibraryAuthor;

    metadata?: CliProcessorMetadata | undefined = {
        icon: '🧹',
        module: 'misc',
    };

    async processCommand(
        _: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        context.terminal.clear();
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer, translator: t } = context;
        writer.writeln(t.t('cli.clear.long_description', 'Clears all content from the terminal screen'));
        writer.writeln();
        writer.writeln(`📋 ${t.t('cli.common.usage', 'Usage:')}`);
        writer.writeln(
            `  ${writer.wrapInColor('clear', CliForegroundColor.Cyan)}`,
        );
        writer.writeln();
        writer.writeln(
            `⌨️  ${t.t('cli.clear.shortcut', 'Shortcut:')} ${writer.wrapInColor('Ctrl+L', CliForegroundColor.Yellow)}`,
        );
    }
}
