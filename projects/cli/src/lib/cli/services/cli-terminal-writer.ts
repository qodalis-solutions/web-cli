import { Terminal } from '@xterm/xterm';
import {
    CliBackgroundColor,
    CliForegroundColor,
    ICliTerminalWriter,
} from '../models';
import { formatJson } from '../../utils';

export class CliTerminalWriter implements ICliTerminalWriter {
    constructor(public readonly terminal: Terminal) {}

    write(text: string): void {
        this.terminal.write(text);
    }
    writeln(text: string): void {
        this.terminal.writeln(text);
    }

    public writeSuccess(message: string) {
        this.terminal.writeln(
            this.wrapInColor(message, CliForegroundColor.Green),
        );
    }

    public writeInfo(message: string) {
        this.terminal.writeln(
            this.wrapInColor(message, CliForegroundColor.Blue),
        );
    }

    public writeWarning(message: string) {
        this.terminal.writeln(
            this.wrapInColor(message, CliForegroundColor.Yellow),
        );
    }

    public writeError(message: string) {
        this.terminal.writeln(
            this.wrapInColor(message, CliForegroundColor.Red),
        );
    }

    public wrapInColor(text: string, color: CliForegroundColor): string {
        return color + text + CliForegroundColor.Reset;
    }

    public wrapInBackgroundColor(text: string, color: CliBackgroundColor) {
        return color + text + CliForegroundColor.Reset;
    }

    public writeJson(json: any) {
        this.terminal.writeln(formatJson(json));
    }

    public writeToFileFile(fileName: string, content: string): void {
        const blob = new Blob([content], { type: 'text/plain' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = fileName;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}
