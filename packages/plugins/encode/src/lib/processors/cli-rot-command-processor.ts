import {
    CliForegroundColor,
    CliProcessCommand,
    CliProcessorMetadata,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';

export class CliRotCommandProcessor implements ICliCommandProcessor {
    command = 'rot';

    description = 'Apply ROT cipher (letter rotation)';

    author = DefaultLibraryAuthor;

    metadata?: CliProcessorMetadata = {
        icon: '🔄',
        module: 'encoding',
    };

    parameters = [
        {
            name: 'shift',
            description: 'Rotation amount (default: 13)',
            type: 'number' as const,
            required: false,
        },
    ];

    acceptsRawInput = true;
    valueRequired = true;

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const text = (command.value || command.data || '') as string;
        const shift = parseInt(command.args['shift']) || 13;
        const normalizedShift = ((shift % 26) + 26) % 26;

        const result = text.replace(/[a-zA-Z]/g, (char) => {
            const base = char >= 'a' ? 97 : 65;
            return String.fromCharCode(
                ((char.charCodeAt(0) - base + normalizedShift) % 26) + base,
            );
        });

        context.writer.writeln(result);
        context.process.output(result);
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer, translator: t } = context;
        writer.writeln(
            t.t('cli.rot.long_description', 'Apply ROT (rotation) cipher to text'),
        );
        writer.writeln(
            t.t('cli.rot.note', 'Default is ROT13 (self-inverse: applying twice returns original)'),
        );
        writer.writeln();
        writer.writeln(`📋 ${t.t('cli.common.usage', 'Usage:')}`);
        writer.writeln(
            `  ${writer.wrapInColor('rot <text>', CliForegroundColor.Cyan)}                 ${t.t('cli.rot.default_desc', 'Apply ROT13')}`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('rot <text> --shift=N', CliForegroundColor.Cyan)}       ${t.t('cli.rot.shift_desc', 'Apply ROT-N')}`,
        );
        writer.writeln();
        writer.writeln(`📝 ${t.t('cli.common.examples', 'Examples:')}`);
        writer.writeln(
            `  rot Hello World              ${writer.wrapInColor('# → Uryyb Jbeyq', CliForegroundColor.Green)}`,
        );
        writer.writeln(
            `  rot Uryyb Jbeyq              ${writer.wrapInColor('# → Hello World (ROT13 is self-inverse)', CliForegroundColor.Green)}`,
        );
        writer.writeln(
            `  rot abc --shift=1            ${writer.wrapInColor('# → bcd', CliForegroundColor.Green)}`,
        );
    }
}
