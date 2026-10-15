/**
 * 04 - Engine API
 *
 * Shows how to access the CliEngine instance for programmatic control:
 *   - @ViewChild(CliComponent) + getEngine()
 *   - (engineReady) event binding
 *   - Executing commands programmatically via engine.execute()
 *   - Focusing the terminal
 *
 * @see https://qodalis-solutions.github.io/web-cli/
 */
import { Component, ViewChild } from '@angular/core';
import { CliComponent, CliModule } from '@qodalis/angular-cli';
import { CliEngine, CliEngineOptions } from '@qodalis/cli';

@Component({
    selector: 'app-engine-demo',
    standalone: true,
    imports: [CliModule],
    template: `
        <div class="toolbar">
            <button (click)="runHelp()">Run "help"</button>
            <button (click)="runVersion()">Run "version"</button>
            <button (click)="runClear()">Clear</button>
            <button (click)="focusTerminal()">Focus Terminal</button>
        </div>

        <cli
            [options]="options"
            [height]="'calc(100vh - 48px)'"
            (engineReady)="onEngineReady($event)"
        />
    `,
    styles: [
        `
            :host {
                display: block;
                height: 100vh;
            }
            .toolbar {
                display: flex;
                gap: 8px;
                padding: 8px;
                background: #1e1e2e;
            }
            button {
                padding: 4px 12px;
                cursor: pointer;
            }
        `,
    ],
})
export class EngineDemoComponent {
    @ViewChild(CliComponent) cliComponent!: CliComponent;

    options: CliEngineOptions = {
        terminalOptions: {
            fontSize: 14,
            cursorBlink: true,
        },
    };

    private engine?: CliEngine;

    /**
     * Called once the engine has fully initialized and the terminal is ready.
     * This is the safest place to run startup commands or register listeners.
     */
    onEngineReady(engine: CliEngine): void {
        this.engine = engine;
        console.log('CLI engine ready');

        // Example: execute a startup command
        engine.execute('version');
    }

    /**
     * Execute arbitrary commands programmatically.
     */
    runHelp(): void {
        this.engine?.execute('help');
    }

    runVersion(): void {
        this.engine?.execute('version');
    }

    runClear(): void {
        this.engine?.execute('clear');
    }

    /**
     * Focus the terminal so it receives keyboard input.
     * Useful after the user interacts with UI elements outside the terminal.
     */
    focusTerminal(): void {
        this.cliComponent.focus();
    }

    /**
     * Alternative: access the engine through the ViewChild reference
     * instead of caching it from the (engineReady) event.
     */
    getEngineViaViewChild(): CliEngine | undefined {
        return this.cliComponent.getEngine();
    }
}
