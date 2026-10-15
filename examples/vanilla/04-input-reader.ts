/**
 * Example 04 — Input Reader (Vanilla JS)
 *
 * Demonstrates all 9 methods of ICliInputReader for interactive prompts.
 * Type `demo-input` to walk through each input type.
 *
 * All reader methods return `null` when the user presses Escape or Ctrl+C.
 *
 * Docs: https://qodalis-solutions.github.io/web-cli/docs/core-concepts/input-reader
 */

import '@xterm/xterm/css/xterm.css';
import { CliEngine } from '@qodalis/cli';
import type {
    ICliCommandProcessor,
    ICliModule,
    CliProcessCommand,
    ICliExecutionContext,
} from '@qodalis/cli-core';

const inputDemoProcessor: ICliCommandProcessor = {
    command: 'demo-input',
    description: 'Showcase all input reader methods',

    async processCommand(_command: CliProcessCommand, context: ICliExecutionContext) {
        const { reader, writer } = context;

        // ── 1. readLine — free-text input ──────────────────────
        writer.writeln('--- readLine ---');
        const name = await reader.readLine('What is your name? ', {
            default: 'World',                     // pre-filled default
            placeholder: 'Type your name...',     // dimmed hint when empty
            validate: (value) => {                // validation on Enter
                if (value.length < 2) return 'Name must be at least 2 characters';
                return null; // null = valid
            },
        });
        if (name === null) { writer.writeWarning('Cancelled.'); return; }
        writer.writeSuccess(`Hello, ${name}!`);
        writer.writeln();

        // ── 2. readPassword — masked input ─────────────────────
        writer.writeln('--- readPassword ---');
        const password = await reader.readPassword('Enter a secret: ');
        if (password === null) { writer.writeWarning('Cancelled.'); return; }
        writer.writeSuccess(`Secret received (${password.length} chars).`);
        writer.writeln();

        // ── 3. readConfirm — yes/no prompt ─────────────────────
        writer.writeln('--- readConfirm ---');
        const confirmed = await reader.readConfirm('Do you like CLI tools?', true);
        if (confirmed === null) { writer.writeWarning('Cancelled.'); return; }
        writer.writeInfo(confirmed ? 'Great choice!' : 'Maybe you will soon!');
        writer.writeln();

        // ── 4. readNumber — numeric input ──────────────────────
        writer.writeln('--- readNumber ---');
        const age = await reader.readNumber('Your age: ', {
            min: 1,
            max: 150,
            default: 25,
        });
        if (age === null) { writer.writeWarning('Cancelled.'); return; }
        writer.writeSuccess(`You are ${age} years old.`);
        writer.writeln();

        // ── 5. readSelect — vertical selection list ────────────
        writer.writeln('--- readSelect ---');
        const color = await reader.readSelect(
            'Pick your favorite color:',
            [
                { label: 'Red', value: 'red', description: 'The color of fire' },
                { label: 'Green', value: 'green', description: 'The color of nature' },
                { label: 'Blue', value: 'blue', description: 'The color of the sky' },
                { label: 'Purple', value: 'purple', description: 'The color of royalty' },
            ],
            {
                default: 'blue',       // pre-selected option
                searchable: true,      // enable type-to-filter
            },
        );
        if (color === null) { writer.writeWarning('Cancelled.'); return; }
        writer.writeSuccess(`You picked: ${color}`);
        writer.writeln();

        // ── 6. readSelect with groups ──────────────────────────
        writer.writeln('--- readSelect (grouped) ---');
        const framework = await reader.readSelect(
            'Choose a framework:',
            [
                { label: 'Angular', value: 'angular', group: 'Frontend' },
                { label: 'React', value: 'react', group: 'Frontend' },
                { label: 'Vue', value: 'vue', group: 'Frontend' },
                { label: 'Express', value: 'express', group: 'Backend' },
                { label: 'FastAPI', value: 'fastapi', group: 'Backend' },
                { label: 'ASP.NET', value: 'aspnet', group: 'Backend', disabled: true },
            ],
        );
        if (framework === null) { writer.writeWarning('Cancelled.'); return; }
        writer.writeSuccess(`Selected: ${framework}`);
        writer.writeln();

        // ── 7. readSelectInline — horizontal selection ──────────
        writer.writeln('--- readSelectInline ---');
        const size = await reader.readSelectInline(
            'T-shirt size:',
            [
                { label: 'S', value: 'small' },
                { label: 'M', value: 'medium' },
                { label: 'L', value: 'large' },
                { label: 'XL', value: 'xlarge' },
            ],
            { default: 'medium' },
        );
        if (size === null) { writer.writeWarning('Cancelled.'); return; }
        writer.writeSuccess(`Size: ${size}`);
        writer.writeln();

        // ── 8. readMultiSelect — checkbox list ─────────────────
        writer.writeln('--- readMultiSelect ---');
        const toppings = await reader.readMultiSelect(
            'Choose toppings:',
            [
                { label: 'Cheese', value: 'cheese', checked: true },
                { label: 'Pepperoni', value: 'pepperoni' },
                { label: 'Mushrooms', value: 'mushrooms' },
                { label: 'Olives', value: 'olives' },
                { label: 'Pineapple', value: 'pineapple', description: '🍍' },
            ],
            { searchable: true },
        );
        if (toppings === null) { writer.writeWarning('Cancelled.'); return; }
        writer.writeSuccess(`Toppings: ${toppings.join(', ')}`);
        writer.writeln();

        // ── 9. readDate — date input with format validation ────
        writer.writeln('--- readDate ---');
        const date = await reader.readDate('Pick a date: ', {
            format: 'YYYY-MM-DD',       // supported: YYYY, MM, DD with -/./
            default: '2025-01-15',
            min: '2020-01-01',
            max: '2030-12-31',
        });
        if (date === null) { writer.writeWarning('Cancelled.'); return; }
        writer.writeSuccess(`Date: ${date}`);
        writer.writeln();

        // ── 10. readFile — file picker dialog ──────────────────
        writer.writeln('--- readFile ---');
        const files = await reader.readFile('Select a file: ', {
            multiple: false,
            accept: '.txt,.json,.csv',    // file type filter
        });
        if (files === null) { writer.writeWarning('No file selected.'); return; }
        for (const file of files) {
            writer.writeKeyValue({
                'File': file.name,
                'Size': `${file.size} bytes`,
                'Type': file.type || 'unknown',
            });
        }
        writer.writeln();

        // ── Summary ────────────────────────────────────────────
        writer.writeDivider();
        writer.writeSuccess('All input methods demonstrated!');
    },
};

// ── Module & Bootstrap ─────────────────────────────────────────

const inputDemoModule: ICliModule = {
    apiVersion: 2,
    name: 'input-demo',
    processors: [inputDemoProcessor],
};

const container = document.getElementById('terminal')!;
const engine = new CliEngine(container);
engine.registerModules([inputDemoModule]);
engine.start().then(() => engine.focus());
window.addEventListener('beforeunload', () => engine.destroy());
