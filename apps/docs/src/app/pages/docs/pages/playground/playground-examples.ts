/** A starting point in the playground: code, and the commands run after each build. */
export interface PlaygroundExample {
    id: string;
    title: string;
    code: string;
    commands: string;
}

export const PLAYGROUND_EXAMPLES: PlaygroundExample[] = [
    {
        id: 'command',
        title: 'A command',
        commands: 'greet Ada\ngreet Grace --shout',
        code: `import {
    CliProcessCommand,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';

export class GreetProcessor implements ICliCommandProcessor {
    command = 'greet';
    description = 'Say hello';
    // Words after the command (greet Ada) are its input, not sub-commands
    acceptsRawInput = true;

    parameters = [
        {
            name: 'shout',
            description: 'Greet in capitals',
            type: 'boolean' as const,
            required: false,
        },
    ];

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const name = command.positionals?.[0] ?? 'World';
        const greeting = \`Hello, \${name}!\`;
        context.writer.writeSuccess(command.args['shout'] ? greeting.toUpperCase() : greeting);
    }
}
`,
    },
    {
        id: 'sub-commands',
        title: 'Sub-commands',
        commands: 'notes add buy milk\nnotes add call Ada\nnotes list',
        code: `import {
    CliProcessCommand,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';

const notes: string[] = [];

export class NotesProcessor implements ICliCommandProcessor {
    command = 'notes';
    description = 'Keep short notes';

    processors: ICliCommandProcessor[] = [
        {
            command: 'add',
            description: 'Add a note',
            acceptsRawInput: true,
            async processCommand(command: CliProcessCommand, context: ICliExecutionContext) {
                const text = command.positionals?.join(' ');
                if (!text) {
                    context.writer.writeError('Usage: notes add <text>');
                    return;
                }
                notes.push(text);
                context.writer.writeSuccess(\`Added note #\${notes.length}\`);
            },
        },
        {
            command: 'list',
            description: 'List the notes',
            async processCommand(_command: CliProcessCommand, context: ICliExecutionContext) {
                if (notes.length === 0) {
                    context.writer.writeInfo('No notes yet');
                    return;
                }
                context.writer.writeTable(
                    ['#', 'Note'],
                    notes.map((note, i) => [String(i + 1), note]),
                );
            },
        },
    ];

    async processCommand(_command: CliProcessCommand, context: ICliExecutionContext) {
        context.writer.writeln('Use notes add <text> or notes list');
    }
}
`,
    },
    {
        id: 'prompts',
        title: 'Asking questions',
        commands: 'order',
        code: `import {
    CliProcessCommand,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';

// Run "order" in the terminal and answer the questions
export class OrderProcessor implements ICliCommandProcessor {
    command = 'order';
    description = 'Order a coffee';

    async processCommand(_command: CliProcessCommand, context: ICliExecutionContext) {
        const name = await context.reader.readLine('Your name: ');
        if (name === null) return; // Ctrl+C

        const size = await context.reader.readSelect('Size:', [
            { label: 'Small', value: 'small' },
            { label: 'Medium', value: 'medium' },
            { label: 'Large', value: 'large' },
        ]);
        if (size === null) return;

        const milk = await context.reader.readConfirm('With milk?', true);
        if (milk === null) return;

        context.writer.writeSuccess(
            \`One \${size} coffee\${milk ? ' with milk' : ''} for \${name || 'you'}.\`,
        );
    }
}
`,
    },
    {
        id: 'progress',
        title: 'Progress and cancelling',
        commands: 'download',
        code: `import {
    CliProcessCommand,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Press Ctrl+C while it runs to cancel
export class DownloadProcessor implements ICliCommandProcessor {
    command = 'download';
    description = 'Pretend to download a file';

    async processCommand(_command: CliProcessCommand, context: ICliExecutionContext) {
        context.progressBar.show('Downloading');
        for (let percent = 0; percent <= 100; percent += 5) {
            if (context.signal?.aborted) {
                context.progressBar.complete();
                context.writer.writeWarning('Cancelled');
                return;
            }
            context.progressBar.update(percent);
            await sleep(80);
        }
        context.progressBar.complete();
        context.writer.writeSuccess('Downloaded report.pdf (2.4 MB)');
    }
}
`,
    },
    {
        id: 'module',
        title: 'A module',
        commands: 'help dice\ndice roll 3',
        code: `import {
    CliProcessCommand,
    ICliCommandProcessor,
    ICliExecutionContext,
    ICliModule,
} from '@qodalis/cli-core';

const roll: ICliCommandProcessor = {
    command: 'roll',
    description: 'Roll dice: dice roll [count]',
    acceptsRawInput: true,
    async processCommand(command: CliProcessCommand, context: ICliExecutionContext) {
        const count = Math.min(Number(command.positionals?.[0] ?? 1) || 1, 20);
        const rolls = Array.from({ length: count }, () => 1 + Math.floor(Math.random() * 6));
        context.writer.writeln(\`🎲 \${rolls.join(' ')}  (total \${rolls.reduce((a, b) => a + b, 0)})\`);
    },
};

// A module groups commands (and services, settings, translations) under one name
export const diceModule: ICliModule = {
    apiVersion: 2,
    name: 'dice',
    processors: [
        {
            command: 'dice',
            description: 'Dice games',
            processors: [roll],
            async processCommand(_command: CliProcessCommand, context: ICliExecutionContext) {
                context.writer.writeln('Try: dice roll 3');
            },
        },
    ],
};
`,
    },
];
