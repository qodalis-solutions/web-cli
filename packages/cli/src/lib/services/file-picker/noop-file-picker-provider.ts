import { ICliFilePickerProvider, CliFilePickerOptions, CliFileResult } from '@qodalis/cli-core';

/**
 * No-op file picker provider for environments where file picking is not supported.
 * Always returns null and reports isSupported = false.
 */
export class NoopFilePickerProvider implements ICliFilePickerProvider {
    readonly isSupported = false;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async pickFiles(_options?: CliFilePickerOptions): Promise<CliFileResult[] | null> {
        return null;
    }

    async pickDirectory(): Promise<CliFileResult | null> {
        return null;
    }
}
