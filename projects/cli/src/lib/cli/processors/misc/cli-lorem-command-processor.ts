import {
    CliForegroundColor,
    CliProcessCommand,
    CliProcessorMetadata,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';

const LOREM_WORDS = [
    'lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing',
    'elit', 'sed', 'do', 'eiusmod', 'tempor', 'incididunt', 'ut', 'labore',
    'et', 'dolore', 'magna', 'aliqua', 'enim', 'ad', 'minim', 'veniam',
    'quis', 'nostrud', 'exercitation', 'ullamco', 'laboris', 'nisi',
    'aliquip', 'ex', 'ea', 'commodo', 'consequat', 'duis', 'aute', 'irure',
    'in', 'reprehenderit', 'voluptate', 'velit', 'esse', 'cillum',
    'fugiat', 'nulla', 'pariatur', 'excepteur', 'sint', 'occaecat',
    'cupidatat', 'non', 'proident', 'sunt', 'culpa', 'qui', 'officia',
    'deserunt', 'mollit', 'anim', 'id', 'est', 'laborum',
];

export class CliLoremCommandProcessor implements ICliCommandProcessor {
    command = 'lorem';

    aliases = ['lipsum'];

    description = 'Generate lorem ipsum placeholder text';

    author = DefaultLibraryAuthor;

    processors?: ICliCommandProcessor[] = [];

    metadata?: CliProcessorMetadata = {
        icon: '📝',
        module: 'misc',
    };

    constructor() {
        this.processors = [
            {
                command: 'words',
                aliases: ['w'],
                description: 'Generate a number of words',
                parameters: [
                    {
                        name: 'count',
                        aliases: ['n'],
                        description: 'Number of words (default: 10)',
                        type: 'number',
                        required: false,
                    },
                ],
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const count = Math.min(
                        parseInt(command.args['count'] || command.args['n']) || 10,
                        1000,
                    );
                    const text = this.generateWords(count);
                    context.writer.writeln(text);
                    context.process.output(text);
                },
                writeDescription: (context: ICliExecutionContext) => {
                    const { writer } = context;
                    writer.writeln('Generate a specific number of lorem ipsum words');
                    writer.writeln();
                    writer.writeln('📋 Usage:');
                    writer.writeln(
                        `  ${writer.wrapInColor('lorem words [--count=N]', CliForegroundColor.Cyan)}`,
                    );
                },
            },
            {
                command: 'sentences',
                aliases: ['s'],
                description: 'Generate a number of sentences',
                parameters: [
                    {
                        name: 'count',
                        aliases: ['n'],
                        description: 'Number of sentences (default: 3)',
                        type: 'number',
                        required: false,
                    },
                ],
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const count = Math.min(
                        parseInt(command.args['count'] || command.args['n']) || 3,
                        50,
                    );
                    const sentences: string[] = [];
                    for (let i = 0; i < count; i++) {
                        const wordCount =
                            Math.floor(Math.random() * 10) + 5;
                        const words = this.generateWords(wordCount);
                        sentences.push(
                            words.charAt(0).toUpperCase() +
                                words.slice(1) +
                                '.',
                        );
                    }
                    const text = sentences.join(' ');
                    context.writer.writeln(text);
                    context.process.output(text);
                },
                writeDescription: (context: ICliExecutionContext) => {
                    const { writer } = context;
                    writer.writeln('Generate lorem ipsum sentences');
                    writer.writeln();
                    writer.writeln('📋 Usage:');
                    writer.writeln(
                        `  ${writer.wrapInColor('lorem sentences [--count=N]', CliForegroundColor.Cyan)}`,
                    );
                },
            },
            {
                command: 'paragraphs',
                aliases: ['p'],
                description: 'Generate a number of paragraphs',
                parameters: [
                    {
                        name: 'count',
                        aliases: ['n'],
                        description: 'Number of paragraphs (default: 1)',
                        type: 'number',
                        required: false,
                    },
                ],
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const count = Math.min(
                        parseInt(command.args['count'] || command.args['n']) || 1,
                        20,
                    );
                    const paragraphs: string[] = [];
                    for (let i = 0; i < count; i++) {
                        const sentenceCount =
                            Math.floor(Math.random() * 4) + 3;
                        const sentences: string[] = [];
                        for (let j = 0; j < sentenceCount; j++) {
                            const wordCount =
                                Math.floor(Math.random() * 10) + 5;
                            const words = this.generateWords(wordCount);
                            sentences.push(
                                words.charAt(0).toUpperCase() +
                                    words.slice(1) +
                                    '.',
                            );
                        }
                        paragraphs.push(sentences.join(' '));
                    }
                    const text = paragraphs.join('\n\n');
                    context.writer.writeln(text);
                    context.process.output(text);
                },
                writeDescription: (context: ICliExecutionContext) => {
                    const { writer } = context;
                    writer.writeln('Generate lorem ipsum paragraphs');
                    writer.writeln();
                    writer.writeln('📋 Usage:');
                    writer.writeln(
                        `  ${writer.wrapInColor('lorem paragraphs [--count=N]', CliForegroundColor.Cyan)}`,
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
        const { writer } = context;
        writer.writeln('Generate lorem ipsum placeholder text');
        writer.writeln();
        writer.writeln('📋 Usage:');
        writer.writeln(
            `  ${writer.wrapInColor('lorem words [--count=N]', CliForegroundColor.Cyan)}          Generate words`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('lorem sentences [--count=N]', CliForegroundColor.Cyan)}      Generate sentences`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('lorem paragraphs [--count=N]', CliForegroundColor.Cyan)}     Generate paragraphs`,
        );
    }

    private generateWords(count: number): string {
        const words: string[] = [];
        for (let i = 0; i < count; i++) {
            words.push(
                LOREM_WORDS[Math.floor(Math.random() * LOREM_WORDS.length)],
            );
        }
        return words.join(' ');
    }
}
