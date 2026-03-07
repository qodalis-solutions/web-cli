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
} from '@qodalis/cli-core';

const DEFAULT_FONT_SIZE = 20;
const MIN_FONT_SIZE = 8;
const MAX_FONT_SIZE = 40;
const STEP = 2;

interface FontSizeState {
    fontSize: number;
}

export class CliFontSizeCommandProcessor implements ICliCommandProcessor {
    command = 'font-size';
    description = 'Adjust the terminal font size';
    aliases = ['fontsize'];
    author: ICliCommandAuthor = DefaultLibraryAuthor;
    metadata: CliProcessorMetadata = { icon: CliIcon.Settings, module: 'system' };

    stateConfiguration: CliStateConfiguration = {
        storeName: 'font-size',
        initialState: { fontSize: DEFAULT_FONT_SIZE } as FontSizeState,
    };

    processors: ICliCommandProcessor[] = [
        {
            command: 'increase',
            description: `Increase font size by ${STEP}px (max ${MAX_FONT_SIZE})`,
            processCommand: async (_: CliProcessCommand, context: ICliExecutionContext) => {
                this.setFontSize(context, this.getCurrent(context) + STEP);
            },
        },
        {
            command: 'decrease',
            description: `Decrease font size by ${STEP}px (min ${MIN_FONT_SIZE})`,
            processCommand: async (_: CliProcessCommand, context: ICliExecutionContext) => {
                this.setFontSize(context, this.getCurrent(context) - STEP);
            },
        },
        {
            command: 'reset',
            description: `Reset font size to default (${DEFAULT_FONT_SIZE}px)`,
            processCommand: async (_: CliProcessCommand, context: ICliExecutionContext) => {
                this.setFontSize(context, DEFAULT_FONT_SIZE);
            },
        },
        {
            command: 'set',
            description: 'Set font size to a specific value',
            valueRequired: true,
            acceptsRawInput: true,
            processCommand: async (cmd: CliProcessCommand, context: ICliExecutionContext) => {
                const n = parseInt(cmd.value ?? '', 10);
                if (isNaN(n) || n < MIN_FONT_SIZE || n > MAX_FONT_SIZE) {
                    context.writer.writeError(
                        `Font size must be between ${MIN_FONT_SIZE} and ${MAX_FONT_SIZE}`,
                    );
                    return;
                }
                this.setFontSize(context, n);
            },
        },
    ];

    async initialize(context: ICliExecutionContext): Promise<void> {
        const state = context.state.getState<FontSizeState>();
        if (state.fontSize && state.fontSize !== DEFAULT_FONT_SIZE) {
            if (context.terminal?.options) {
                context.terminal.options.fontSize = state.fontSize;
            }
        }
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
            `  ${context.writer.wrapInColor('font-size reset', CliForegroundColor.Cyan)}      Reset to default (${DEFAULT_FONT_SIZE}px)`,
        );
    }

    private getCurrent(context: ICliExecutionContext): number {
        const fromTerminal = context.terminal?.options?.fontSize as number | undefined;
        if (fromTerminal != null) {
            return fromTerminal;
        }
        const state = context.state.getState<FontSizeState>();
        return state?.fontSize ?? DEFAULT_FONT_SIZE;
    }

    private setFontSize(context: ICliExecutionContext, size: number): void {
        const clamped = Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, size));
        if (context.terminal?.options) {
            context.terminal.options.fontSize = clamped;
        }
        context.state.updateState({ fontSize: clamped } as FontSizeState);
        context.state.persist();
        context.writer.writeSuccess(`Font size set to ${clamped}px`);
    }
}
