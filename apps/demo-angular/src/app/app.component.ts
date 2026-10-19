import { Component, signal } from '@angular/core';
import { ICliModule, CliOptions, CliLogLevel } from '@qodalis/cli-core';
import { CliPanelOptions } from '@qodalis/angular-cli';
import { mountUsersModeSwitcher } from './users-mode';
import { loadLazyPlugins } from './lazy-plugins';

@Component({
    standalone: false,
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: [],
})
export class AppComponent {
    constructor() {
        mountUsersModeSwitcher();
        loadLazyPlugins().then((modules) => this.modules.set(modules));
    }

    // Demonstrates registering CLI modules via [modules] input prop.
    // guid, regex, text-to-image, speed-test, browser-storage, string,
    // todo, and users modules are registered via Angular DI in AppModule instead.
    // These are code-split (see ./lazy-plugins.ts): the terminal is rendered once
    // they have loaded, because the engine takes its modules when it is created.
    modules = signal<ICliModule[] | null>(null);

    options: CliOptions = {
        logLevel: CliLogLevel.DEBUG,
        packageSources: {
            primary: 'local',
            sources: [
                { name: 'local', url: 'http://localhost:3000/', kind: 'file' },
            ],
        },
        servers: [
            { name: 'dotnet', url: 'http://localhost:8046' },
            { name: 'node', url: 'http://localhost:8047' },
            { name: 'python', url: 'http://localhost:8048' },
        ],
    };

    panelOptions: CliPanelOptions = {
        position: 'right',
        isHidden: true,
        syncTheme: true,
        servers: [
            { name: 'dotnet', url: 'http://localhost:8046' },
            { name: 'node', url: 'http://localhost:8047' },
            { name: 'python', url: 'http://localhost:8048' },
        ],
    };
}
