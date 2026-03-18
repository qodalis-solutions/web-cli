import { ICliFilePickerProvider, CliFilePickerOptions, CliFileResult } from '@qodalis/cli-core';
import { InputModeBase } from './input-mode-base';
import { InputModeHost } from '../input-mode';

/**
 * Input mode for selecting files via the environment's native file picker.
 * Delegates to the host's ICliFilePickerProvider.
 * Keystroke input is ignored — the mode resolves asynchronously when the dialog closes.
 */
export class FileInputMode extends InputModeBase<CliFileResult[]> {
    private waiting = false;

    constructor(
        host: InputModeHost,
        resolve: (value: CliFileResult[] | null) => void,
        private readonly promptText: string,
        private readonly options?: CliFilePickerOptions,
    ) {
        super(host, resolve);
    }

    activate(): void {
        const provider = this.host.filePickerProvider;
        const acceptHint = this.options?.accept ? ` \x1b[2m(${this.options.accept})\x1b[0m` : '';
        this.host.writeToTerminal(`\x1b[36m?\x1b[0m ${this.promptText}${acceptHint}: `);

        if (!provider.isSupported) {
            this.host.writeToTerminal('\x1b[2m(file picker not available)\x1b[0m');
            this.abort();
            return;
        }

        this.host.writeToTerminal('\x1b[33mOpening file picker...\x1b[0m');
        this.waiting = true;
        this.pickFiles(provider);
    }

    private async pickFiles(provider: ICliFilePickerProvider): Promise<void> {
        try {
            let results: CliFileResult[] | null;
            if (this.options?.directory) {
                const dir = await provider.pickDirectory();
                results = dir ? [dir] : null;
            } else {
                results = await provider.pickFiles(this.options);
            }
            this.waiting = false;

            if (!results || this.isResolved) {
                this.host.terminal.write('\x1b[2K\r');
                this.host.writeToTerminal(`\x1b[36m?\x1b[0m ${this.promptText}: \x1b[2m(cancelled)\x1b[0m\r\n`);
                if (!this.isResolved) this.abort();
                return;
            }

            this.host.terminal.write('\x1b[2K\r');
            this.host.writeToTerminal(`\x1b[36m?\x1b[0m ${this.promptText}:\r\n`);
            let totalSize = 0;
            for (const file of results) {
                const sizeStr = this.formatSize(file.size);
                this.host.writeToTerminal(`  \x1b[32m✔\x1b[0m ${file.name} \x1b[2m(${sizeStr})\x1b[0m\r\n`);
                totalSize += file.size;
            }
            if (results.length > 1) {
                this.host.writeToTerminal(`    \x1b[2m${results.length} files selected · ${this.formatSize(totalSize)} total\x1b[0m\r\n`);
            }
            this.resolveAndPop(results);
        } catch {
            this.waiting = false;
            if (this.isResolved) return;
            this.host.terminal.write('\x1b[2K\r');
            this.host.writeToTerminal(`\x1b[36m?\x1b[0m ${this.promptText}: \x1b[31m(error)\x1b[0m\r\n`);
            this.abort();
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async handleInput(_data: string): Promise<void> {
        // No keystroke handling — waiting for async dialog
    }

    private formatSize(bytes: number): string {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
}
