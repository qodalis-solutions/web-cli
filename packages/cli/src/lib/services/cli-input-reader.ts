import {
    ICliInputReader,
    CliSelectOption,
    CliMultiSelectOption,
    CliLineOptions,
    CliSelectOptions,
    CliMultiSelectOptions,
    CliDateOptions,
    CliFilePickerOptions,
    CliFileResult,
} from '@qodalis/cli-core';
import { InputModeHost } from '../input/input-mode';
import {
    LineInputMode,
    PasswordInputMode,
    ConfirmInputMode,
    SelectInputMode,
    InlineSelectInputMode,
    MultiSelectInputMode,
    NumberInputMode,
    DateInputMode,
    FileInputMode,
} from '../input/modes';

/**
 * Factory-based input reader. Creates the appropriate input mode
 * and pushes it onto the mode stack for each request.
 */
export class CliInputReader implements ICliInputReader {
    constructor(private readonly host: InputModeHost) {}

    readLine(prompt: string, options?: CliLineOptions): Promise<string | null> {
        return new Promise<string | null>((resolve) => {
            const mode = new LineInputMode(this.host, resolve, prompt, options);
            this.host.pushMode(mode);
        });
    }

    readPassword(prompt: string): Promise<string | null> {
        return new Promise<string | null>((resolve) => {
            const mode = new PasswordInputMode(this.host, resolve, prompt);
            this.host.pushMode(mode);
        });
    }

    readConfirm(prompt: string, defaultValue: boolean = false): Promise<boolean | null> {
        return new Promise<boolean | null>((resolve) => {
            const mode = new ConfirmInputMode(this.host, resolve, prompt, defaultValue);
            this.host.pushMode(mode);
        });
    }

    readSelect(prompt: string, options: CliSelectOption[], selectOptions?: CliSelectOptions): Promise<string | null> {
        if (!options || options.length === 0) {
            return Promise.reject(new Error('readSelect requires at least one option'));
        }
        return new Promise<string | null>((resolve) => {
            const mode = new SelectInputMode(this.host, resolve, prompt, options, selectOptions);
            this.host.pushMode(mode);
        });
    }

    readSelectInline(prompt: string, options: CliSelectOption[], selectOptions?: CliSelectOptions): Promise<string | null> {
        if (!options || options.length === 0) {
            return Promise.reject(new Error('readSelectInline requires at least one option'));
        }
        return new Promise<string | null>((resolve) => {
            const mode = new InlineSelectInputMode(this.host, resolve, prompt, options, selectOptions);
            this.host.pushMode(mode);
        });
    }

    readMultiSelect(prompt: string, options: CliMultiSelectOption[], selectOptions?: CliMultiSelectOptions): Promise<string[] | null> {
        if (!options || options.length === 0) {
            return Promise.reject(new Error('readMultiSelect requires at least one option'));
        }
        return new Promise<string[] | null>((resolve) => {
            const mode = new MultiSelectInputMode(this.host, resolve, prompt, options, selectOptions);
            this.host.pushMode(mode);
        });
    }

    readNumber(prompt: string, options?: { min?: number; max?: number; default?: number }): Promise<number | null> {
        return new Promise<number | null>((resolve) => {
            const mode = new NumberInputMode(this.host, resolve, prompt, options);
            this.host.pushMode(mode);
        });
    }

    readDate(prompt: string, options?: CliDateOptions): Promise<string | null> {
        return new Promise<string | null>((resolve) => {
            const mode = new DateInputMode(this.host, resolve, prompt, options);
            this.host.pushMode(mode);
        });
    }

    readFile(prompt: string, options?: CliFilePickerOptions): Promise<CliFileResult[] | null> {
        return new Promise<CliFileResult[] | null>((resolve) => {
            const mode = new FileInputMode(this.host, resolve, prompt, options);
            this.host.pushMode(mode);
        });
    }
}
