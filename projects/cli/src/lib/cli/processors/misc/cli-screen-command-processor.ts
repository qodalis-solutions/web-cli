import {
    CliForegroundColor,
    CliProcessCommand,
    CliProcessorMetadata,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';

export class CliScreenCommandProcessor implements ICliCommandProcessor {
    command = 'screen';

    aliases = ['display'];

    description = 'Display screen and terminal information';

    author = DefaultLibraryAuthor;

    metadata?: CliProcessorMetadata = {
        icon: '🖥️',
        module: 'misc',
    };

    async processCommand(
        _: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const { writer } = context;

        function writeItem(key: string, value: string): void {
            writer.writeln(
                `  ${writer.wrapInColor(key.padEnd(22), CliForegroundColor.Cyan)} ${value}`,
            );
        }

        writer.writeln(
            writer.wrapInColor('🖥️  Screen:', CliForegroundColor.Yellow),
        );
        writeItem('Resolution:', `${screen.width} x ${screen.height}`);
        writeItem('Available:', `${screen.availWidth} x ${screen.availHeight}`);
        writeItem('Color Depth:', `${screen.colorDepth}-bit`);
        writeItem('Pixel Ratio:', `${window.devicePixelRatio}x`);
        writeItem('Orientation:', screen.orientation?.type || 'unknown');
        writer.writeln();

        writer.writeln(
            writer.wrapInColor('🪟 Viewport:', CliForegroundColor.Yellow),
        );
        writeItem('Inner Size:', `${window.innerWidth} x ${window.innerHeight}`);
        writeItem('Outer Size:', `${window.outerWidth} x ${window.outerHeight}`);
        writer.writeln();

        writer.writeln(
            writer.wrapInColor('📟 Terminal:', CliForegroundColor.Yellow),
        );
        writeItem('Columns:', `${context.terminal.cols}`);
        writeItem('Rows:', `${context.terminal.rows}`);
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer } = context;
        writer.writeln('Display screen, viewport, and terminal dimensions');
        writer.writeln();
        writer.writeln('📋 Usage:');
        writer.writeln(
            `  ${writer.wrapInColor('screen', CliForegroundColor.Cyan)}`,
        );
        writer.writeln();
        writer.writeln('📝 Shows: resolution, color depth, pixel ratio, viewport size, terminal size');
    }
}
