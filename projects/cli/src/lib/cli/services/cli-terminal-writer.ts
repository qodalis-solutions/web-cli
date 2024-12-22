import { Terminal } from '@xterm/xterm';
import { ICliTerminalWriter } from '../models';

export class CliTerminalWriter implements ICliTerminalWriter {
    constructor(public readonly terminal: Terminal) {}

    write(text: string): void {
        this.terminal.write(text);
    }
    writeln(text: string): void {
        this.terminal.writeln(text);
    }

    public writeSuccess(message: string) {
        this.terminal.writeln('\x1b[32m' + message + '\x1b[0m');
    }

    public writeWarning(message: string) {
        this.terminal.writeln('\x1b[33m' + message + '\x1b[0m');
    }

    public writeError(message: string) {
        this.terminal.writeln('\x1b[31m' + message + '\x1b[0m');
    }
}
