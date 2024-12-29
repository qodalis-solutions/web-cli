import { ICliClipboard, ICliExecutionContext } from '@qodalis/cli-core';

export class CliClipboard implements ICliClipboard {
    constructor(private readonly context: ICliExecutionContext) {}

    async write(text: string): Promise<void> {
        try {
            await navigator.clipboard.writeText(text);
        } catch (error) {
            this.context.writer.writeError('Failed to write to clipboard');
        }
    }

    async read(): Promise<string> {
        try {
            return await navigator.clipboard.readText();
        } catch (error) {
            this.context.writer.writeError('Failed to read from clipboard');
            return '';
        }
    }
}
