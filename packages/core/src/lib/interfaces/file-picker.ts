export { ICliFilePickerProvider_TOKEN } from '../tokens';

/**
 * Options for readFile file picker.
 */
export interface CliFilePickerOptions {
    /** Allow selecting multiple files. Default: false. */
    multiple?: boolean;
    /**
     * File type filter. Accepts MIME types (e.g. 'image/*') or extensions
     * (e.g. '.json,.txt'). Maps to the HTML accept attribute in browsers
     * and file filter in Electron.
     */
    accept?: string;
    /**
     * When true, pick a directory instead of files. Default: false.
     * Cannot be combined with `multiple` — if both are set, `directory` takes precedence
     * and a single directory is returned.
     */
    directory?: boolean;
    /**
     * How to read file content. Default: 'text'.
     * - 'text': Read as UTF-8 string (suitable for text files)
     * - 'arraybuffer': Read as ArrayBuffer (suitable for binary files like images)
     */
    readAs?: 'text' | 'arraybuffer';
}

/**
 * Result returned by readFile for each selected file.
 */
export interface CliFileResult {
    /** File name without path (e.g. 'config.json') */
    name: string;
    /** Full file path. Available in Electron, undefined in browser. */
    path?: string;
    /**
     * File content. Type depends on `CliFilePickerOptions.readAs`:
     * - 'text' (default): `string` (UTF-8 decoded)
     * - 'arraybuffer': `ArrayBuffer` (raw bytes)
     */
    content: string | ArrayBuffer;
    /** File size in bytes */
    size: number;
    /** MIME type (e.g. 'application/json', 'image/png') */
    type: string;
}

/**
 * Abstraction for environment-specific file picking.
 * Implementations handle the actual dialog interaction for their environment.
 */
export interface ICliFilePickerProvider {
    /** Whether file picking is supported in this environment */
    readonly isSupported: boolean;

    /**
     * Open a file picker dialog and return selected files.
     * @returns Array of selected files, or null if the user cancelled
     */
    pickFiles(options?: CliFilePickerOptions): Promise<CliFileResult[] | null>;

    /**
     * Open a directory picker dialog and return the selected directory.
     * @returns The selected directory, or null if the user cancelled
     */
    pickDirectory(): Promise<CliFileResult | null>;
}
