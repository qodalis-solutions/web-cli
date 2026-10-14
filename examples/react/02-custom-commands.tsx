/**
 * 02 - Custom Commands
 *
 * Shows how to define custom ICliCommandProcessor instances, wrap them
 * in an ICliModule, and register them with the CLI engine.
 *
 * Docs: https://qodalis-solutions.github.io/web-cli/
 */

import React from 'react';
import {
    ICliCommandProcessor,
    ICliExecutionContext,
    ICliModule,
    API_VERSION,
} from '@qodalis/cli-core';
import { Cli, CliConfigProvider } from '@qodalis/react-cli';

// ---------------------------------------------------------------------------
// 1. Define a command processor
// ---------------------------------------------------------------------------

const greetProcessor: ICliCommandProcessor = {
    command: 'greet',
    description: 'Greet someone by name',

    // Declare parameters so they show up in `greet --help`
    parameters: [
        {
            name: 'name',
            description: 'Name of the person to greet',
            required: true,
            type: 'string',
        },
        {
            name: 'shout',
            description: 'Print the greeting in uppercase',
            required: false,
            type: 'boolean',
        },
    ],

    async processCommand(command, context: ICliExecutionContext): Promise<void> {
        const name = command.args['name'] ?? 'World';
        let message = `Hello, ${name}!`;

        if (command.args['shout']) {
            message = message.toUpperCase();
        }

        context.writer.writeln(message);
    },
};

// ---------------------------------------------------------------------------
// 2. A processor with sub-commands (nested processors)
// ---------------------------------------------------------------------------

const mathProcessor: ICliCommandProcessor = {
    command: 'math',
    description: 'Simple math utilities',

    async processCommand(_command, context: ICliExecutionContext) {
        context.writer.writeln('Usage: math <add|multiply> --a <num> --b <num>');
    },

    processors: [
        {
            command: 'add',
            description: 'Add two numbers',
            parameters: [
                { name: 'a', description: 'First number', required: true, type: 'number' },
                { name: 'b', description: 'Second number', required: true, type: 'number' },
            ],
            async processCommand({ args }, context) {
                const a = parseFloat(args['a']);
                const b = parseFloat(args['b']);
                context.writer.writeln(`${a} + ${b} = ${a + b}`);
            },
        },
        {
            command: 'multiply',
            description: 'Multiply two numbers',
            parameters: [
                { name: 'a', description: 'First number', required: true, type: 'number' },
                { name: 'b', description: 'Second number', required: true, type: 'number' },
            ],
            async processCommand({ args }, context) {
                const a = parseFloat(args['a']);
                const b = parseFloat(args['b']);
                context.writer.writeln(`${a} * ${b} = ${a * b}`);
            },
        },
    ],
};

// ---------------------------------------------------------------------------
// 3. Wrap processors in a module
// ---------------------------------------------------------------------------

const myModule: ICliModule = {
    apiVersion: API_VERSION,
    name: 'my-custom-module',
    version: '1.0.0',
    description: 'Custom commands for the demo app',
    processors: [greetProcessor, mathProcessor],
};

// ---------------------------------------------------------------------------
// 4. Inline module definition (shorter alternative)
// ---------------------------------------------------------------------------

const inlineModule: ICliModule = {
    apiVersion: API_VERSION,
    name: 'inline-demo',
    version: '0.1.0',
    description: 'Quick inline module',
    processors: [
        {
            command: 'ping',
            description: 'Respond with pong',
            async processCommand(_cmd, context) {
                context.writer.writeSuccess('pong');
            },
        },
        {
            command: 'timestamp',
            description: 'Print the current ISO timestamp',
            async processCommand(_cmd, context) {
                context.writer.writeln(new Date().toISOString());
            },
        },
    ],
};

// ---------------------------------------------------------------------------
// 5. Render
// ---------------------------------------------------------------------------

export function CustomCommandsDemo() {
    return (
        <CliConfigProvider modules={[myModule, inlineModule]}>
            <div style={{ height: '100vh' }}>
                <Cli
                    onReady={(engine) => {
                        console.log('Custom commands registered');
                    }}
                />
            </div>
        </CliConfigProvider>
    );
}
