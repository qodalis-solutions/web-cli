/**
 * Example 11 — Progress Bars, Spinners & Text Animations (Vanilla JS)
 *
 * Demonstrates the three visual feedback tools available on the
 * execution context: spinner, percentage progress bar, and text animator.
 *
 * Features:
 *   - context.spinner — indeterminate loading indicator
 *   - context.progressBar — 0–100% progress bar with setText
 *   - context.textAnimator — character-by-character typing effect
 *
 * Docs: https://qodalis-solutions.github.io/web-cli/docs/core-concepts
 */

import '@xterm/xterm/css/xterm.css';
import { CliEngine } from '@qodalis/cli';
import type {
    ICliCommandProcessor,
    ICliExecutionContext,
    ICliModule,
} from '@qodalis/cli-core';

// ── 1. Spinner — indeterminate loader ─────────────────────────

const spinnerDemo: ICliCommandProcessor = {
    command: 'spinner-demo',
    description: 'Show a spinner while simulating async work',

    async processCommand(_command, context: ICliExecutionContext) {
        const { spinner, writer } = context;

        // Show the spinner with initial text
        spinner?.show('Connecting to server...');

        await delay(1500);

        // Update the text while it's spinning
        spinner?.setText('Fetching data...');
        await delay(1500);

        spinner?.setText('Processing results...');
        await delay(1000);

        // Hide when done
        spinner?.hide();

        writer.writeSuccess('All done!');
    },
};

// ── 2. Percentage progress bar ────────────────────────────────

const progressDemo: ICliCommandProcessor = {
    command: 'progress-demo',
    description: 'Demonstrate the percentage progress bar',

    async processCommand(_command, context: ICliExecutionContext) {
        const { progressBar, writer } = context;

        writer.writeln('Downloading files...');

        // Show the progress bar (optionally with text)
        progressBar.show('Downloading...');

        // Update progress from 0 to 100
        for (let i = 0; i <= 100; i += 10) {
            progressBar.update(i);
            progressBar.setText(`Downloading... ${i}%`);
            await delay(300);
        }

        // Mark as complete (fills to 100% and hides)
        progressBar.complete();

        writer.writeSuccess('Download complete!');
        writer.writeln('');

        // You can also use increment mode
        writer.writeln('Processing items...');
        progressBar.show('Processing...');
        progressBar.update(0);

        for (let i = 0; i < 20; i++) {
            // Increment by 5 each time instead of setting absolute value
            progressBar.update(5, { type: 'increment' });
            await delay(150);
        }

        progressBar.complete();
        writer.writeSuccess('Processing complete!');
    },
};

// ── 3. Text animator — typing effect ──────────────────────────

const animatorDemo: ICliCommandProcessor = {
    command: 'animator-demo',
    description: 'Show text with a typing animation effect',

    async processCommand(_command, context: ICliExecutionContext) {
        const { textAnimator, writer } = context;

        // Basic typing animation (stays on screen)
        await textAnimator?.showText('Hello, welcome to the CLI!', {
            speed: 50, // ms per character
        });
        writer.writeln(''); // newline after animation

        // Typing animation that erases itself after typing
        await textAnimator?.showText('This message will disappear...', {
            speed: 40,
            removeAfterTyping: true,
        });

        // Slower dramatic effect
        await textAnimator?.showText('✨ The future is now.', {
            speed: 100,
        });
        writer.writeln('');
    },
};

// ── 4. Combined — real-world pattern ──────────────────────────

const deployDemo: ICliCommandProcessor = {
    command: 'deploy-demo',
    description: 'Simulated deploy showing spinner → progress → animation',

    async processCommand(_command, context: ICliExecutionContext) {
        const { spinner, progressBar, textAnimator, writer } = context;

        // Phase 1: Spinner for indeterminate work
        spinner?.show('Building project...');
        await delay(2000);
        spinner?.hide();
        writer.writeSuccess('Build complete');

        // Phase 2: Progress bar for measurable work
        const steps = ['Uploading assets', 'Deploying functions', 'Updating CDN', 'Running health checks'];
        progressBar.show('Deploying...');

        for (let i = 0; i < steps.length; i++) {
            progressBar.setText(steps[i]);
            progressBar.update(Math.round(((i + 1) / steps.length) * 100));
            await delay(800);
        }

        progressBar.complete();

        // Phase 3: Text animation for the final message
        writer.writeln('');
        await textAnimator?.showText('🚀 Deployed to production successfully!', {
            speed: 30,
        });
        writer.writeln('');
    },
};

// ── Module & Bootstrap ────────────────────────────────────────

function delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
}

const progressModule: ICliModule = {
    apiVersion: 2,
    name: 'progress-demo',
    description: 'Spinner, progress bar, and text animator demos',
    processors: [spinnerDemo, progressDemo, animatorDemo, deployDemo],
};

const container = document.getElementById('terminal')!;
const engine = new CliEngine(container);

engine.registerModules([progressModule]);
engine.start().then(() => engine.focus());

window.addEventListener('beforeunload', () => engine.destroy());
