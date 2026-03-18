import { CliFilePickerOptions, CliFileResult } from './file-picker';

/**
 * Represents an option for the readSelect and readSelectInline prompts.
 */
export interface CliSelectOption {
    /** Display text shown to the user */
    label: string;
    /** Value returned when this option is selected */
    value: string;
    /** Optional description shown as dimmed italic text after the label */
    description?: string;
    /** Group name — options sharing the same group are displayed under a group header */
    group?: string;
    /** When true, the option is visible but cannot be selected (rendered dimmed) */
    disabled?: boolean;
}

/**
 * Represents an option for the readMultiSelect prompt.
 */
export interface CliMultiSelectOption extends CliSelectOption {
    /** Whether the option is pre-selected */
    checked?: boolean;
}

/**
 * Options for readLine input.
 */
export interface CliLineOptions {
    /**
     * Pre-filled default value. Shown in the buffer when the prompt opens.
     * The cursor starts at the end of the default text.
     */
    default?: string;
    /**
     * Validation function called on Enter.
     * Return an error message string to reject the input and display the error.
     * Return null to accept the input.
     */
    validate?: (value: string) => string | null;
    /** Placeholder text shown dimmed when the buffer is empty */
    placeholder?: string;
}

/**
 * Options for readSelect and readSelectInline.
 */
export interface CliSelectOptions {
    /** Pre-select an option by its value */
    default?: string;
    /** Enable type-to-filter. When true, printable keystrokes filter the option list. Default: false. */
    searchable?: boolean;
    /** Callback invoked each time the highlighted option changes */
    onChange?: (value: string) => void;
}

/**
 * Options for readMultiSelect.
 */
export interface CliMultiSelectOptions {
    /** Enable type-to-filter. When true, printable keystrokes filter the option list. Default: false. */
    searchable?: boolean;
    /** Callback invoked each time the set of checked options changes */
    onChange?: (values: string[]) => void;
}

/**
 * Options for readDate input.
 */
export interface CliDateOptions {
    /**
     * Date format string. Supported tokens: YYYY (4-digit year), MM (2-digit month),
     * DD (2-digit day). Separators can be `-`, `/`, or `.`.
     * @default 'YYYY-MM-DD'
     */
    format?: string;
    /** Minimum allowed date in the same format as `format` */
    min?: string;
    /** Maximum allowed date in the same format as `format` */
    max?: string;
    /** Pre-filled default value */
    default?: string;
}

/**
 * Provides interactive input reading from the terminal.
 * All methods resolve with `null` when the user aborts (Ctrl+C or Escape).
 */
export interface ICliInputReader {
    /**
     * Read a line of text input.
     * @param prompt - The prompt text displayed to the user
     * @param options - Optional configuration for default value, validation, and placeholder
     * @returns The entered text, or null if aborted
     */
    readLine(prompt: string, options?: CliLineOptions): Promise<string | null>;

    /**
     * Read a password (masked input).
     * @param prompt - The prompt text displayed to the user
     * @returns The entered password, or null if aborted
     */
    readPassword(prompt: string): Promise<string | null>;

    /**
     * Read a yes/no confirmation.
     * @param prompt - The prompt text displayed to the user
     * @param defaultValue - Default value when Enter is pressed without input
     * @returns true for yes, false for no, or null if aborted
     */
    readConfirm(prompt: string, defaultValue?: boolean): Promise<boolean | null>;

    /**
     * Read a selection from a vertical list of options.
     * @param prompt - The prompt text displayed to the user
     * @param options - Array of options to choose from
     * @param selectOptions - Optional configuration for default, search, onChange
     * @returns The selected option's value, or null if aborted
     */
    readSelect(prompt: string, options: CliSelectOption[], selectOptions?: CliSelectOptions): Promise<string | null>;

    /**
     * Read a selection from an inline horizontal list.
     * @param prompt - The prompt text displayed to the user
     * @param options - Array of options to choose from
     * @param selectOptions - Optional configuration for default, search, onChange
     * @returns The selected option's value, or null if aborted
     */
    readSelectInline(prompt: string, options: CliSelectOption[], selectOptions?: CliSelectOptions): Promise<string | null>;

    /**
     * Read multiple selections from a checkbox list.
     * @param prompt - The prompt text displayed to the user
     * @param options - Array of options with optional pre-checked state
     * @param selectOptions - Optional configuration for search, onChange
     * @returns Array of selected option values, or null if aborted
     */
    readMultiSelect(prompt: string, options: CliMultiSelectOption[], selectOptions?: CliMultiSelectOptions): Promise<string[] | null>;

    /**
     * Read a number input.
     * @param prompt - The prompt text displayed to the user
     * @param options - Optional configuration for min, max, and default value
     * @returns The entered number, or null if aborted
     */
    readNumber(prompt: string, options?: { min?: number; max?: number; default?: number }): Promise<number | null>;

    /**
     * Read a date input with format validation.
     * @param prompt - The prompt text displayed to the user
     * @param options - Optional configuration for format, min/max range, default
     * @returns The date string in the specified format, or null if aborted
     */
    readDate(prompt: string, options?: CliDateOptions): Promise<string | null>;

    /**
     * Read file(s) via the environment's file picker dialog.
     * @param prompt - The prompt text displayed to the user
     * @param options - Optional configuration for multiple, accept filter, directory mode
     * @returns Array of selected files with content, or null if cancelled/unsupported
     */
    readFile(prompt: string, options?: CliFilePickerOptions): Promise<CliFileResult[] | null>;
}
