import {
    CliForegroundColor,
    CliProcessCommand,
    CliProcessorMetadata,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';

const CHAR_TO_MORSE: Record<string, string> = {
    A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.',
    G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..',
    M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.',
    S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-',
    Y: '-.--', Z: '--..',
    '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-',
    '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.',
    '.': '.-.-.-', ',': '--..--', '?': '..--..', "'": '.----.',
    '!': '-.-.--', '/': '-..-.', '(': '-.--.', ')': '-.--.-',
    '&': '.-...', ':': '---...', ';': '-.-.-.', '=': '-...-',
    '+': '.-.-.', '-': '-....-', '_': '..--.-', '"': '.-..-.',
    '$': '...-..-', '@': '.--.-.', ' ': '/',
};

const MORSE_TO_CHAR: Record<string, string> = {};
for (const [char, morse] of Object.entries(CHAR_TO_MORSE)) {
    if (char !== ' ') {
        MORSE_TO_CHAR[morse] = char;
    }
}

export class CliMorseCommandProcessor implements ICliCommandProcessor {
    command = 'morse';

    description = 'Encode or decode Morse code';

    author = DefaultLibraryAuthor;

    processors?: ICliCommandProcessor[] = [];

    metadata?: CliProcessorMetadata = {
        icon: '📡',
        module: '@qodalis/cli-encode',
    };

    constructor() {
        this.processors = [
            {
                command: 'encode',
                aliases: ['enc', 'e'],
                description: 'Encode text to Morse code',
                acceptsRawInput: true,
                valueRequired: true,
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const text = (command.value || command.data || '') as string;
                    const morse = text
                        .toUpperCase()
                        .split('')
                        .map((c) => CHAR_TO_MORSE[c] ?? c)
                        .join(' ');
                    context.writer.writeln(morse);
                    context.process.output(morse);
                },
                writeDescription: (context: ICliExecutionContext) => {
                    const { writer } = context;
                    writer.writeln('Encode text to Morse code');
                    writer.writeln();
                    writer.writeln(`📋 ${context.translator.t('cli.common.usage', 'Usage:')}`);
                    writer.writeln(
                        `  ${writer.wrapInColor('morse encode <text>', CliForegroundColor.Cyan)}`,
                    );
                    writer.writeln();
                    writer.writeln(`📝 ${context.translator.t('cli.common.examples', 'Examples:')}`);
                    writer.writeln(
                        `  morse encode SOS             ${writer.wrapInColor('# → ... --- ...', CliForegroundColor.Green)}`,
                    );
                    writer.writeln(
                        `  morse encode Hello World     ${writer.wrapInColor('# → .... . .-.. .-.. --- / .-- --- .-. .-.. -..', CliForegroundColor.Green)}`,
                    );
                },
            },
            {
                command: 'decode',
                aliases: ['dec', 'd'],
                description: 'Decode Morse code to text',
                acceptsRawInput: true,
                valueRequired: true,
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const input = (command.value || command.data || '') as string;
                    try {
                        const text = input
                            .split(' ')
                            .map((code) => {
                                if (code === '/') return ' ';
                                const char = MORSE_TO_CHAR[code];
                                if (!char) throw new Error(`Unknown morse: ${code}`);
                                return char;
                            })
                            .join('');
                        context.writer.writeln(text);
                        context.process.output(text);
                    } catch {
                        context.writer.writeError(
                            'Invalid Morse code (use spaces between letters, / between words)',
                        );
                        context.process.exit(-1);
                    }
                },
                writeDescription: (context: ICliExecutionContext) => {
                    const { writer } = context;
                    writer.writeln('Decode Morse code back to text');
                    writer.writeln();
                    writer.writeln(`📋 ${context.translator.t('cli.common.usage', 'Usage:')}`);
                    writer.writeln(
                        `  ${writer.wrapInColor('morse decode <morse>', CliForegroundColor.Cyan)}`,
                    );
                    writer.writeln();
                    writer.writeln(`📝 ${context.translator.t('cli.common.examples', 'Examples:')}`);
                    writer.writeln(
                        `  morse decode ... --- ...     ${writer.wrapInColor('# → SOS', CliForegroundColor.Green)}`,
                    );
                },
            },
        ];
    }

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        context.executor.showHelp(command, context);
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer, translator: t } = context;
        writer.writeln(t.t('cli.morse.long_description', 'Encode and decode Morse code'));
        writer.writeln(
            t.t('cli.morse.note', 'Supports letters, numbers, and common punctuation'),
        );
        writer.writeln();
        writer.writeln(`📋 ${t.t('cli.common.usage', 'Usage:')}`);
        writer.writeln(
            `  ${writer.wrapInColor('morse encode <text>', CliForegroundColor.Cyan)}        ${t.t('cli.morse.encode_desc', 'Text to Morse')}`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('morse decode <morse>', CliForegroundColor.Cyan)}       ${t.t('cli.morse.decode_desc', 'Morse to text')}`,
        );
    }
}
