import {
    CliForegroundColor,
    CliProcessCommand,
    CliProcessorMetadata,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliCommandParameterDescriptor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { LIBRARY_VERSION } from '../version';

const RESET = '\x1b[0m';
const GREEN = '\x1b[38;5;82m';
const RED = '\x1b[38;5;196m';
const CYAN = '\x1b[38;5;45m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const GREEN_BG = '\x1b[48;5;22m';
const RED_BG = '\x1b[48;5;52m';

export class CliYesnoCommandProcessor implements ICliCommandProcessor {
    command = 'yesno';

    description = 'Generate a random yes/no answer with animation';

    acceptsRawInput = true;

    author = DefaultLibraryAuthor;

    version = LIBRARY_VERSION;

    metadata?: CliProcessorMetadata | undefined = {
        icon: '🎰',
    };

    parameters?: ICliCommandParameterDescriptor[] = [
        {
            name: 'count',
            aliases: ['n'],
            description: 'Number of rounds to run (default: 1)',
            required: false,
            type: 'number',
            defaultValue: '1',
        },
    ];

    processors?: ICliCommandProcessor[] | undefined = [];

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const count = parseInt(command.args['count'] || command.args['n']) || 1;
        const question = command.value?.trim();

        if (question) {
            context.writer.writeln(
                `${CYAN}?${RESET} ${BOLD}${question}${RESET}`,
            );
            context.writer.writeln();
        }

        for (let i = 0; i < count; i++) {
            if (i > 0) {
                context.writer.writeln();
            }

            await this.runSlotMachine(context);
        }
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer } = context;
        writer.writeln(this.description);
        writer.writeln();
        writer.writeln(
            `  ${writer.wrapInColor('yesno', CliForegroundColor.Cyan)}                          Generate a random yes/no`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('yesno Should I deploy?', CliForegroundColor.Cyan)}      Ask a question`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('yesno --count=5', CliForegroundColor.Cyan)}               Run 5 rounds`,
        );
    }

    private runSlotMachine(context: ICliExecutionContext): Promise<void> {
        return new Promise<void>((resolve) => {
            const result = Math.random() < 0.5;
            const totalSteps = 20;
            let step = 0;
            let aborted = false;

            const subscription = context.onAbort.subscribe(() => {
                aborted = true;
                subscription.unsubscribe();
                this.clearBox(context);
                context.writer.writeln(`${DIM}(cancelled)${RESET}`);
                resolve();
            });

            const animate = () => {
                if (aborted) {
                    return;
                }

                this.clearBox(context);

                const isLast = step === totalSteps;
                const currentValue = isLast ? result : step % 2 === 0;

                this.drawBox(context, currentValue, isLast);

                step++;

                if (step <= totalSteps) {
                    const baseDelay = 60;
                    const progress = step / totalSteps;
                    const delay = baseDelay + Math.pow(progress, 3) * 440;
                    setTimeout(animate, delay);
                } else {
                    subscription.unsubscribe();
                    context.writer.writeln();
                    const label = result ? 'YES' : 'NO';
                    const color = result ? GREEN : RED;
                    context.writer.writeln(
                        `  ${color}${BOLD}The answer is: ${label}${RESET}`,
                    );
                    resolve();
                }
            };

            animate();
        });
    }

    private drawBox(
        context: ICliExecutionContext,
        value: boolean,
        isFinal: boolean,
    ): void {
        const label = value ? ' YES ' : '  NO ';
        const color = isFinal ? (value ? GREEN : RED) : CYAN;
        const bgColor = isFinal ? (value ? GREEN_BG : RED_BG) : '';
        const border = isFinal ? color : DIM;

        const top = `  ${border}+-----------+${RESET}`;
        const mid = `  ${border}|${RESET} ${bgColor}${color}${BOLD}  > ${label} <  ${RESET} ${border}|${RESET}`;
        const bot = `  ${border}+-----------+${RESET}`;

        context.terminal.write(`${top}\r\n${mid}\r\n${bot}`);
    }

    private clearBox(context: ICliExecutionContext): void {
        for (let i = 0; i < 3; i++) {
            context.terminal.write('\x1b[2K');
            if (i < 2) {
                context.terminal.write('\x1b[A');
            }
        }
        context.terminal.write('\r');
    }
}
