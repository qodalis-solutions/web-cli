import { IInputMode } from './input-mode';
import { ICliCommandProcessor, ICliExecutionContext } from '@qodalis/cli-core';

/**
 * Input mode for raw command processors (full-screen games, --context, etc.).
 * Bypasses most default key handling — routes everything to the processor's onData.
 *
 * When `fullScreen` is false (i.e. --context mode), Ctrl+C exits the context
 * and returns to the command line. When `fullScreen` is true, Ctrl+C is passed
 * through to the processor (full-screen apps manage their own exit).
 */
export class RawMode implements IInputMode {
    constructor(
        private readonly processor: ICliCommandProcessor,
        private readonly context: ICliExecutionContext,
        private readonly fullScreen = false,
    ) {}

    async handleInput(data: string): Promise<void> {
        if (this.processor.onData) {
            await this.processor.onData(data, this.context);
        }
    }

    handleKeyEvent(event: KeyboardEvent): boolean {
        // In --context mode (not full-screen), Ctrl+C exits the context
        if (
            !this.fullScreen &&
            event.code === 'KeyC' &&
            event.ctrlKey
        ) {
            this.context.setContextProcessor(undefined);
            this.context.writer.writeln('');
            this.context.showPrompt();
            return false;
        }

        // Prevent browser defaults for Ctrl key combos (Ctrl+S, Ctrl+Q, etc.)
        if (event.ctrlKey) {
            event.preventDefault();
        }
        // Let all keys pass through to onData
        return true;
    }
}
