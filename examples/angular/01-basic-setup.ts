/**
 * 01 - Basic Setup
 *
 * Minimal Angular standalone component that renders an interactive CLI terminal.
 * Configures terminal appearance and log level via CliEngineOptions.
 *
 * @see https://qodalis-solutions.github.io/web-cli/
 */
import { Component } from '@angular/core';
import { CliModule } from '@qodalis/angular-cli';
import { CliLogLevel } from '@qodalis/cli-core';
import { CliEngineOptions } from '@qodalis/cli';

@Component({
    selector: 'app-terminal',
    standalone: true,
    imports: [CliModule],
    template: `
        <cli
            [options]="options"
            [height]="'100%'"
        />
    `,
    styles: [
        `
            :host {
                display: block;
                width: 100%;
                height: 100vh;
            }
        `,
    ],
})
export class TerminalComponent {
    options: CliEngineOptions = {
        // Customize xterm.js terminal appearance
        terminalOptions: {
            fontSize: 14,
            fontFamily: '"Cascadia Code", "Fira Code", monospace',
            cursorBlink: true,
            cursorStyle: 'bar',
        },

        // Show warnings and errors only (set to CliLogLevel.DEBUG for verbose output)
        logLevel: CliLogLevel.WARN,
    };
}
