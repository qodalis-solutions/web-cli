import {
    CliForegroundColor,
    CliProcessCommand,
    CliProcessorMetadata,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';

export class CliOpenCommandProcessor implements ICliCommandProcessor {
    command = 'open';

    description = 'Open a URL in a new browser tab';

    author = DefaultLibraryAuthor;

    allowUnlistedCommands = true;

    valueRequired = true;

    metadata?: CliProcessorMetadata = {
        icon: '🌐',
        module: 'misc',
    };

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        let url = (command.value || '') as string;

        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }

        try {
            new URL(url);
        } catch {
            context.writer.writeError(`Invalid URL: ${command.value}`);
            context.process.exit(-1);
            return;
        }

        const opened = window.open(url, '_blank');

        if (opened) {
            context.writer.writeSuccess(
                `Opened ${context.writer.wrapInColor(url, CliForegroundColor.Blue)}`,
            );
        } else {
            context.writer.writeError(
                'Failed to open URL. Pop-ups may be blocked by the browser.',
            );
            context.process.exit(-1);
        }
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer } = context;
        writer.writeln('Open a URL in a new browser tab');
        writer.writeln('Automatically adds https:// if no protocol is specified');
        writer.writeln();
        writer.writeln('📋 Usage:');
        writer.writeln(
            `  ${writer.wrapInColor('open <url>', CliForegroundColor.Cyan)}`,
        );
        writer.writeln();
        writer.writeln('📝 Examples:');
        writer.writeln(
            `  open google.com                  ${writer.wrapInColor('# Opens https://google.com', CliForegroundColor.Green)}`,
        );
        writer.writeln(
            `  open https://github.com          ${writer.wrapInColor('# Opens GitHub', CliForegroundColor.Green)}`,
        );
    }
}
