/**
 * Example 02 — Custom Commands (Vanilla JS)
 *
 * Shows how to create custom command processors and modules.
 * Covers: parameters, aliases, sub-commands, validation,
 * extending existing commands, and module lifecycle.
 *
 * Docs: https://qodalis-solutions.github.io/web-cli/docs/core-concepts/command-processors
 */

import '@xterm/xterm/css/xterm.css';
import { CliEngine } from '@qodalis/cli';
import type {
    ICliCommandProcessor,
    ICliCommandChildProcessor,
    ICliModule,
    CliProcessCommand,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { CliForegroundColor } from '@qodalis/cli-core';

// ── 1. Simple command processor ────────────────────────────────

const helloProcessor: ICliCommandProcessor = {
    command: 'hello',
    description: 'Say hello to someone',
    aliases: ['hi', 'hey'],

    // Define accepted parameters
    parameters: [
        {
            name: 'name',
            description: 'Name to greet',
            required: false,
            type: 'string',
            defaultValue: 'World',
        },
        {
            name: 'loud',
            description: 'Shout the greeting',
            required: false,
            type: 'boolean',
        },
    ],

    async processCommand(command: CliProcessCommand, context: ICliExecutionContext) {
        const name = (command.args['name'] as string) || 'World';
        const loud = command.args['loud'] as boolean;

        let message = `Hello, ${name}!`;
        if (loud) message = message.toUpperCase();

        context.writer.writeln(
            context.writer.wrapInColor(message, CliForegroundColor.Cyan),
        );
    },

    // Custom help text shown by `help hello`
    writeDescription(context: ICliExecutionContext) {
        context.writer.writeln('Usage:');
        context.writer.writeln('  hello                  — greet the world');
        context.writer.writeln('  hello --name=Alice     — greet Alice');
        context.writer.writeln('  hello --loud           — SHOUT the greeting');
    },
};

// ── 2. Command with sub-commands ───────────────────────────────

const userListSubCommand: ICliCommandChildProcessor = {
    command: 'list',
    description: 'List all users',
    async processCommand(_command, context) {
        context.writer.writeTable(
            ['ID', 'Name', 'Role'],
            [
                ['1', 'Alice', 'admin'],
                ['2', 'Bob', 'user'],
                ['3', 'Charlie', 'user'],
            ],
        );
    },
};

const userInfoSubCommand: ICliCommandChildProcessor = {
    command: 'info',
    description: 'Show user details',
    valueRequired: true,
    async processCommand(command, context) {
        context.writer.writeKeyValue({
            'User': command.value || 'unknown',
            'Status': 'active',
            'Last login': new Date().toLocaleString(),
        });
    },
};

const userProcessor: ICliCommandProcessor = {
    command: 'user',
    description: 'User management commands',
    processors: [userListSubCommand, userInfoSubCommand],

    async processCommand(_command, context) {
        // Called when just `user` is typed without a sub-command
        context.writer.writeInfo('Available sub-commands: user list, user info <name>');
    },
};

// ── 3. Command with validation ─────────────────────────────────

const ageProcessor: ICliCommandProcessor = {
    command: 'check-age',
    description: 'Validate an age value',
    parameters: [
        {
            name: 'age',
            description: 'Age to validate',
            required: true,
            type: 'number',
            validator: (value) => {
                const num = Number(value);
                if (isNaN(num) || num < 0 || num > 150) {
                    return { valid: false, message: 'Age must be between 0 and 150' };
                }
                return { valid: true };
            },
        },
    ],

    // Pre-execution validation (runs before processCommand)
    validateBeforeExecution(command, _context) {
        if (!command.args['age']) {
            return { valid: false, message: 'Please provide --age=<number>' };
        }
        return { valid: true };
    },

    async processCommand(command, context) {
        context.writer.writeSuccess(`Age ${command.args['age']} is valid!`);
    },
};

// ── 4. Command that extends another command ────────────────────

const extendedHelpProcessor: ICliCommandProcessor = {
    command: 'help',
    description: 'Extended help with tips',
    extendsProcessor: true, // wraps the built-in help command

    async processCommand(command, context) {
        // Delegate to the original help command first
        if (this.originalProcessor) {
            await this.originalProcessor.processCommand(command, context);
        }
        // Then add our own content
        context.writer.writeln();
        context.writer.writeBox('Tip: Use Tab for auto-completion!', {
            title: 'Pro Tip',
            borderColor: CliForegroundColor.Yellow,
        });
    },
};

// ── 5. Command with configurationOptions ───────────────────────

const weatherProcessor: ICliCommandProcessor = {
    command: 'weather',
    description: 'Show weather (demo)',

    // Expose settings via the `configure` command
    configurationOptions: [
        {
            key: 'unit',
            label: 'Temperature Unit',
            description: 'Celsius or Fahrenheit',
            type: 'select',
            defaultValue: 'celsius',
            options: [
                { label: 'Celsius', value: 'celsius' },
                { label: 'Fahrenheit', value: 'fahrenheit' },
            ],
        },
        {
            key: 'city',
            label: 'Default City',
            description: 'City for weather lookups',
            type: 'string',
            defaultValue: 'London',
        },
    ],

    // Persistent state — survives page reloads
    stateConfiguration: {
        initialState: { lastQuery: null },
    },

    async processCommand(_command, context) {
        const state = context.state.getState<{ lastQuery: string | null }>();
        const city = state.lastQuery || 'London';
        context.writer.writeInfo(`Weather in ${city}: 22°C, partly cloudy`);
        context.state.updateState({ lastQuery: city });
    },
};

// ── 6. Command with full-screen mode ───────────────────────────

const clockProcessor: ICliCommandProcessor = {
    command: 'clock',
    description: 'Full-screen clock display (press q to exit)',

    async processCommand(_command, context) {
        context.enterFullScreenMode(this);
        this._render(context);
        // Managed interval — auto-cleared when full-screen exits
        context.createInterval(() => this._render(context), 1000);
    },

    _render(context: ICliExecutionContext) {
        const time = new Date().toLocaleTimeString();
        const { cols, rows } = context.terminal;
        const x = Math.floor((cols - time.length) / 2);
        const y = Math.floor(rows / 2);
        context.writer.write(`\x1b[2J`);            // clear screen
        context.writer.write(`\x1b[${y};${x}H`);    // move cursor
        context.writer.write(
            context.writer.wrapInColor(time, CliForegroundColor.Green),
        );
    },

    async onData(data: string, context: ICliExecutionContext) {
        if (data === 'q' || data === 'Q' || data === '\x1b') {
            context.exitFullScreenMode();
        }
    },

    onResize(_cols: number, _rows: number, context: ICliExecutionContext) {
        this._render(context);
    },

    onDispose(_context: ICliExecutionContext) {
        // Managed timers are auto-cleared, nothing extra to clean up
    },
} as ICliCommandProcessor & { _render: (ctx: ICliExecutionContext) => void };

// ── 7. Module — bundle processors with lifecycle hooks ─────────

const myModule: ICliModule = {
    apiVersion: 2,
    name: 'my-custom-commands',
    description: 'Demo custom commands module',
    processors: [
        helloProcessor,
        userProcessor,
        ageProcessor,
        extendedHelpProcessor,
        weatherProcessor,
        clockProcessor,
    ],

    // Called after services are registered, before processors initialize
    async onInit(context) {
        context.logger.debug('Custom commands module initializing...');
    },

    // Called after all modules have booted
    async onAfterBoot(context) {
        context.logger.debug('Custom commands module ready!');
    },
};

// ── Bootstrap ──────────────────────────────────────────────────

const container = document.getElementById('terminal')!;
const engine = new CliEngine(container);

engine.registerModules([myModule]);

engine.start().then(() => engine.focus());

window.addEventListener('beforeunload', () => engine.destroy());
