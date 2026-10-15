/**
 * 02 - Custom Commands
 *
 * Demonstrates two ways to register custom command processors:
 *   1. DI-based  -- via resolveCliModuleProvider() in the component's providers array
 *   2. Template-based -- via the [modules] input binding on <cli>
 *
 * Also shows how to define a processor with typed parameters and a custom module.
 *
 * @see https://qodalis-solutions.github.io/web-cli/
 */
import { Component } from '@angular/core';
import { CliModule, resolveCliModuleProvider } from '@qodalis/angular-cli';
import {
    ICliCommandProcessor,
    ICliCommandParameterDescriptor,
    ICliExecutionContext,
    CliProcessCommand,
    ICliModule,
} from '@qodalis/cli-core';
import { CliEngineOptions } from '@qodalis/cli';

// ---------------------------------------------------------------------------
// 1. Define a custom command processor
// ---------------------------------------------------------------------------

const greetProcessor: ICliCommandProcessor = {
    command: 'greet',
    description: 'Greet a user by name',
    parameters: [
        {
            name: 'name',
            aliases: ['n'],
            description: 'Name of the person to greet',
            required: true,
            type: 'string',
        },
        {
            name: 'uppercase',
            aliases: ['u'],
            description: 'Print the greeting in uppercase',
            required: false,
            type: 'boolean',
            defaultValue: false,
        },
    ],

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const name = command.args?.['name'] ?? 'World';
        const upper = command.args?.['uppercase'] === true;
        let message = `Hello, ${name}!`;
        if (upper) {
            message = message.toUpperCase();
        }
        context.writer.writeln(message);
    },
};

// ---------------------------------------------------------------------------
// 2. Bundle the processor into a module (recommended pattern)
// ---------------------------------------------------------------------------

const greetModule: ICliModule = {
    name: 'greet-module',
    description: 'Custom greeting commands',
    version: '1.0.0',
    processors: [greetProcessor],
};

// ---------------------------------------------------------------------------
// 3a. DI-based registration -- module is available to every <cli> in this
//     component tree without an explicit [modules] binding.
// ---------------------------------------------------------------------------

@Component({
    selector: 'app-terminal-di',
    standalone: true,
    imports: [CliModule],
    providers: [
        ...resolveCliModuleProvider(greetModule),
    ],
    template: `<cli [options]="options" [height]="'100%'" />`,
})
export class TerminalDiComponent {
    options: CliEngineOptions = {};
}

// ---------------------------------------------------------------------------
// 3b. Template-based registration -- modules are passed directly to the
//     component via its [modules] input.
// ---------------------------------------------------------------------------

@Component({
    selector: 'app-terminal-template',
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
export class TerminalTemplateComponent {
    options: CliEngineOptions = {};
    modules: ICliModule[] = [greetModule];
}
