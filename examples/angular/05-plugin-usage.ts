/**
 * 05 - Plugin Usage
 *
 * Shows how to import and configure official @qodalis plugins:
 *   - Import plugin modules from their packages
 *   - Configure the users module with seed data and authentication
 *   - Register plugins via DI (resolveCliModuleProvider) and template ([modules])
 *   - Add a language pack for internationalization
 *
 * @see https://qodalis-solutions.github.io/web-cli/
 */
import { Component } from '@angular/core';
import { CliModule, resolveCliModuleProvider } from '@qodalis/angular-cli';
import { ICliModule } from '@qodalis/cli-core';
import { CliEngineOptions } from '@qodalis/cli';

// Plugin modules
import { guidModule } from '@qodalis/cli-guid';
import { filesModule } from '@qodalis/cli-files';
import { stringModule } from '@qodalis/cli-string';
import { usersModule } from '@qodalis/cli-users';
import { todoModule } from '@qodalis/cli-todo';
import { regexModule } from '@qodalis/cli-regex';
import { passwordGeneratorModule } from '@qodalis/cli-password-generator';

// Language pack (Spanish)
import { langEsModule } from '@qodalis/cli-lang-es';

// ---------------------------------------------------------------------------
// Configure the users module with seed users and authentication settings
// ---------------------------------------------------------------------------

const configuredUsersModule = usersModule.configure({
    seedUsers: [
        { name: 'alice', email: 'alice@example.com', groups: ['admin'] },
        { name: 'bob', email: 'bob@example.com', groups: ['users'] },
    ],
    defaultPassword: 'changeme',
    requirePassword: true,
    requirePasswordOnBoot: false,
    userDisplayFormatter: (user) => `${user.name}@cli`,
});

// ---------------------------------------------------------------------------
// Approach A: Register all plugins via Angular DI
//
// Modules registered through providers are automatically available to every
// <cli> and <cli-panel> in the component subtree.
// ---------------------------------------------------------------------------

@Component({
    selector: 'app-terminal-plugins-di',
    standalone: true,
    imports: [CliModule],
    providers: [
        ...resolveCliModuleProvider(guidModule),
        ...resolveCliModuleProvider(filesModule),
        ...resolveCliModuleProvider(stringModule),
        ...resolveCliModuleProvider(configuredUsersModule),
        ...resolveCliModuleProvider(todoModule),
        ...resolveCliModuleProvider(regexModule),
        ...resolveCliModuleProvider(passwordGeneratorModule),
        ...resolveCliModuleProvider(langEsModule),
    ],
    template: `<cli [options]="options" [height]="'100%'" />`,
})
export class TerminalPluginsDiComponent {
    options: CliEngineOptions = {};
}

// ---------------------------------------------------------------------------
// Approach B: Register plugins via the [modules] template binding
//
// Useful when the module list is dynamic or when you want to avoid polluting
// the DI tree.
// ---------------------------------------------------------------------------

@Component({
    selector: 'app-terminal-plugins-template',
    standalone: true,
    imports: [CliModule],
    template: `
        <cli
            [options]="options"
            [modules]="modules"
            [height]="'100%'"
        />
    `,
})
export class TerminalPluginsTemplateComponent {
    options: CliEngineOptions = {};

    modules: ICliModule[] = [
        guidModule,
        filesModule,
        stringModule,
        configuredUsersModule,
        todoModule,
        regexModule,
        passwordGeneratorModule,
        langEsModule,
    ];
}
