import { Terminal } from '@xterm/xterm';
import {
    CliBackgroundColor,
    CliForegroundColor,
    CliIcon,
    formatJson,
    ICliTerminalWriter,
} from '@qodalis/cli-core';

export class CliTerminalWriter implements ICliTerminalWriter {
    constructor(public readonly terminal: Terminal) {}

    write(text: string): void {
        this.terminal.write(text);
    }
    writeln(text: string): void {
        this.terminal.writeln(text);
    }

    public writeSuccess(message: string) {
        this.writeLog(message, CliForegroundColor.Green, CliIcon.CheckIcon);
    }

    public writeInfo(message: string) {
        this.writeLog(message, CliForegroundColor.Cyan, CliIcon.InfoIcon);
    }

    public writeWarning(message: string) {
        this.writeLog(message, CliForegroundColor.Yellow, CliIcon.WarningIcon);
    }

    public writeError(message: string) {
        this.writeLog(message, CliForegroundColor.Red, CliIcon.CrossIcon);
    }

    private writeLog(
        message: string,
        color: CliForegroundColor,
        icon?: CliIcon,
    ) {
        this.terminal.writeln(
            this.wrapInColor(icon ? icon + ' ' + message : message, color),
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

    public writeToFile(fileName: string, content: string): void {
        const blob = new Blob([content], { type: 'text/plain' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = fileName;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    public writeObjectsAsTable(objects: any[]): void {
        if (objects.length === 0) {
            this.writeInfo('No objects to display');
            return;
        }

        const headers = Object.keys(objects[0]);
        const rows = objects.map((object) =>
            headers.map((header) => object[header]),
        );

        this.writeTable(headers, rows);
    }

    public writeTable(headers: string[], rows: string[][]): void {
        // Calculate column widths
        const colWidths = headers.map((header, colIndex) =>
            Math.max(
                header.length,
                ...rows.map((row) => row[colIndex]?.length || 0),
            ),
        );

        // Function to pad text to a specific width
        const padText = (text: string, width: number) =>
            text?.toString()?.padEnd(width, ' ');

        // Write the header
        this.write(
            headers
                .map((header, i) =>
                    this.wrapInColor(
                        padText(header, colWidths[i]),
                        CliForegroundColor.Yellow,
                    ),
                )
                .join(' | ') + '\r\n',
        );
        this.write(
            '-'.repeat(colWidths.reduce((sum, w) => sum + w + 3, -3)) + '\r\n',
        );

        // Write the rows
        rows.forEach((row) => {
            this.write(
                row.map((cell, i) => padText(cell, colWidths[i])).join(' | ') +
                    '\r\n',
            );
        });
    }
}
