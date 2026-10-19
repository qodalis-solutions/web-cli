import { skip } from 'rxjs/operators';
import {
    ICliCommandProcessor,
    ICliExecutionContext,
    CliProcessCommand,
    ICliCommandAuthor,
    CliProcessorMetadata,
    CliIcon,
    CliStateConfiguration,
    DefaultLibraryAuthor,
    CliForegroundColor,
    writeExamples,
    writeUsage,
    writeWrapped,
} from '@qodalis/cli-core';
import { defaultFontSize } from '../engine/cli-terminal-setup';

const MIN_FONT_SIZE = 8;
const MAX_FONT_SIZE = 40;
const STEP = 2;

interface FontSizeState {
    /** Set only after the user picks a size; until then the host's font size stays. */
    fontSize?: number;
}

export class CliFontSizeCommandProcessor implements ICliCommandProcessor {
    command = 'font-size';
    description = 'Adjust the terminal font size';
    aliases = ['fontsize'];
    author: ICliCommandAuthor = DefaultLibraryAuthor;
    metadata: CliProcessorMetadata = { icon: CliIcon.Settings, module: 'system' };

    stateConfiguration: CliStateConfiguration = {
        storeName: 'font-size',
        initialState: {} as FontSizeState,
    };

    processors: ICliCommandProcessor[] = [
        {
            command: 'increase',
            description: `Increase font size by ${STEP}px (max ${MAX_FONT_SIZE})`,
            processCommand: async (_: CliProcessCommand, context: ICliExecutionContext) => {
                await this.setFontSize(context, this.getCurrent(context) + STEP);
            },
        },
        {
            command: 'decrease',
            description: `Decrease font size by ${STEP}px (min ${MIN_FONT_SIZE})`,
            processCommand: async (_: CliProcessCommand, context: ICliExecutionContext) => {
                await this.setFontSize(context, this.getCurrent(context) - STEP);
            },
        },
        {
            command: 'reset',
            description: 'Reset font size to the default',
            processCommand: async (_: CliProcessCommand, context: ICliExecutionContext) => {
                await this.resetFontSize(context);
            },
        },
        {
            command: 'set',
            description: 'Set font size to a specific value',
            valueRequired: true,
            acceptsRawInput: true,
            // Explicit range validation here (instead of relying solely on setFontSize's clamp)
            // so we can surface a clear error message to the user for out-of-range input.
            processCommand: async (cmd: CliProcessCommand, context: ICliExecutionContext) => {
                const n = parseInt(cmd.value ?? '', 10);
                if (isNaN(n) || n < MIN_FONT_SIZE || n > MAX_FONT_SIZE) {
                    context.writer.writeError(
                        `Font size must be between ${MIN_FONT_SIZE} and ${MAX_FONT_SIZE}`,
                    );
                    return;
                }
                await this.setFontSize(context, n);
            },
        },
    ];

    /** The size the host configured (or the built-in default), restored by `font-size reset`. */
    private hostFontSize?: number;

    async initialize(context: ICliExecutionContext): Promise<void> {
        this.hostFontSize = context.terminal?.options?.fontSize as number | undefined;
        const state = context.state.getState<FontSizeState>();
        if (state?.fontSize != null && context.terminal?.options) {
            context.terminal.options.fontSize = state.fontSize;
        }

        // A size set in another tab or terminal is applied here too
        context.state
            .select((s) => (s as FontSizeState).fontSize ?? null)
            .pipe(skip(1))
            .subscribe((fontSize) => {
                if (!context.terminal?.options) return;
                context.terminal.options.fontSize =
                    fontSize ?? this.hostFontSize ?? context.terminal.options.fontSize;
            });
    }

    async processCommand(_: CliProcessCommand, context: ICliExecutionContext): Promise<void> {
        const current = this.getCurrent(context);
        context.writer.writeKeyValue({ 'Current font size': `${current}px` });
        context.writer.writeln();
        context.writer.writeln('Usage:');
        context.writer.writeln(
            `  ${context.writer.wrapInColor('font-size increase', CliForegroundColor.Cyan)}   Increase by ${STEP}px`,
        );
        context.writer.writeln(
            `  ${context.writer.wrapInColor('font-size decrease', CliForegroundColor.Cyan)}   Decrease by ${STEP}px`,
        );
        context.writer.writeln(
            `  ${context.writer.wrapInColor('font-size set <n>', CliForegroundColor.Cyan)}    Set to exact size`,
        );
        context.writer.writeln(
            `  ${context.writer.wrapInColor('font-size reset', CliForegroundColor.Cyan)}      Reset to default (${this.getDefault()}px)`,
        );
    }

    writeDescription(context: ICliExecutionContext): void {
        writeWrapped(
            context,
            `Make the terminal text bigger or smaller, from ${MIN_FONT_SIZE}px to ${MAX_FONT_SIZE}px. The size you pick is saved and restored the next time the terminal opens; reset goes back to the size the page started with.`,
        );
        context.writer.writeln();
        writeUsage(context, [
            ['font-size', 'Show the current size'],
            ['font-size increase|decrease', `Bigger or smaller by ${STEP}px`],
            ['font-size set <n>', `Exact size in pixels (${MIN_FONT_SIZE}-${MAX_FONT_SIZE})`],
            ['font-size reset', 'Back to the default size'],
        ]);
        context.writer.writeln();
        writeExamples(context, [
            ['font-size set 16', 'Use 16px text'],
            ['fontsize increase', `Grow by ${STEP}px`],
            ['font-size reset', 'Forget the saved size'],
        ]);
    }

    private getCurrent(context: ICliExecutionContext): number {
        const fromTerminal = context.terminal?.options?.fontSize as number | undefined;
        if (fromTerminal != null) {
            return fromTerminal;
        }
        const state = context.state.getState<FontSizeState>();
        return state?.fontSize ?? this.getDefault();
    }

    private getDefault(): number {
        return this.hostFontSize ?? defaultFontSize();
    }

    private async resetFontSize(context: ICliExecutionContext): Promise<void> {
        const size = this.getDefault();
        if (context.terminal?.options) {
            context.terminal.options.fontSize = size;
        }
        context.state.updateState({ fontSize: undefined } as FontSizeState);
        await context.state.persist();
        context.writer.writeSuccess(`Font size set to ${size}px`);
    }

    private async setFontSize(context: ICliExecutionContext, size: number): Promise<void> {
        const clamped = Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, size));
        if (context.terminal?.options) {
            context.terminal.options.fontSize = clamped;
        }
        context.state.updateState({ fontSize: clamped } as FontSizeState);
        await context.state.persist();
        context.writer.writeSuccess(`Font size set to ${clamped}px`);
    }
}
