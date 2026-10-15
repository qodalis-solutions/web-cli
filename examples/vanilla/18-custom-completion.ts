/**
 * Example 18 — Custom Tab Completion (Vanilla JS)
 *
 * Demonstrates how to register a custom ICliCompletionProvider
 * to add tab-completion candidates for your commands. The built-in
 * system already completes command names and parameter flags — this
 * lets you add context-aware completions for argument values.
 *
 * Features:
 *   - ICliCompletionProvider interface
 *   - Priority-based ordering (lower = checked first)
 *   - Context-aware completions based on current input
 *   - Registration via module services
 *
 * Docs: https://qodalis-solutions.github.io/web-cli/docs/core-concepts
 */

import '@xterm/xterm/css/xterm.css';
import { CliEngine } from '@qodalis/cli';
import type {
    ICliCommandProcessor,
    ICliExecutionContext,
    ICliModule,
    ICliCompletionProvider,
    ICliCompletionContext,
} from '@qodalis/cli-core';
import { ICliCompletionProvider_TOKEN } from '@qodalis/cli-core';

// ── 1. Simple completion provider ─────────────────────────────

// Provides completions for a "deploy" command's environment argument.
// When the user types "deploy st" and presses Tab, it suggests "staging".
const deployCompletionProvider: ICliCompletionProvider = {
    // Lower priority = checked first. Built-in command completion is 100,
    // parameter completion is 200. Use 50 to take precedence.
    priority: 50,

    getCompletions(context: ICliCompletionContext): string[] {
        const { tokens, tokenIndex } = context;

        // Only complete for the "deploy" command's first argument
        if (tokens[0] !== 'deploy' || tokenIndex !== 1) {
            return [];
        }

        const environments = ['production', 'staging', 'development', 'qa', 'canary'];
        const partial = context.token.toLowerCase();

        return environments.filter((env) => env.startsWith(partial));
    },
};

// ── 2. Dynamic completion provider ────────────────────────────

// Provides completions that change based on runtime state.
const dynamicCompletionProvider: ICliCompletionProvider = {
    priority: 50,

    getCompletions(context: ICliCompletionContext): string[] {
        const { tokens, tokenIndex, token } = context;

        // Complete "user" command's second argument with known usernames
        if (tokens[0] === 'team' && tokenIndex === 1) {
            const knownUsers = ['alice', 'bob', 'charlie', 'diana', 'eve'];
            return knownUsers.filter((u) => u.startsWith(token.toLowerCase()));
        }

        // Complete "--role" flag values for the "team" command
        if (tokens[0] === 'team' && tokens[tokenIndex - 1] === '--role') {
            const roles = ['admin', 'developer', 'reviewer', 'viewer'];
            return roles.filter((r) => r.startsWith(token.toLowerCase()));
        }

        return [];
    },
};

// ── 3. Async completion provider ──────────────────────────────

// Providers can return a Promise for async lookups (e.g., API calls).
const asyncCompletionProvider: ICliCompletionProvider = {
    priority: 60,

    async getCompletions(context: ICliCompletionContext): Promise<string[]> {
        const { tokens, tokenIndex, token } = context;

        if (tokens[0] !== 'search-repos' || tokenIndex !== 1) {
            return [];
        }

        if (token.length < 2) {
            return []; // Don't search for very short input
        }

        // In a real app, this would call an API
        // e.g., const repos = await fetch(`/api/repos?q=${token}`);
        const allRepos = [
            'web-cli', 'cli-server-node', 'cli-server-python',
            'cli-server-dotnet', 'cli-core', 'cli-plugins',
        ];

        return allRepos.filter((r) => r.includes(token.toLowerCase()));
    },
};

// ── Commands that use these completions ───────────────────────

const deployProcessor: ICliCommandProcessor = {
    command: 'deploy',
    description: 'Deploy to an environment (try Tab for completions)',
    valueRequired: true,

    async processCommand(command, context: ICliExecutionContext) {
        context.writer.writeSuccess(`Deploying to: ${command.value}`);
    },
};

const teamProcessor: ICliCommandProcessor = {
    command: 'team',
    description: 'Manage team members (try Tab for username/role completions)',

    parameters: [
        { name: 'role', description: 'Team role', required: false, type: 'string' },
    ],

    async processCommand(command, context: ICliExecutionContext) {
        const user = command.value || '(none)';
        const role = command.args['role'] || 'developer';
        context.writer.writeln(`Team member: ${user}, role: ${role}`);
    },
};

const searchProcessor: ICliCommandProcessor = {
    command: 'search-repos',
    description: 'Search repositories (async Tab completion)',
    valueRequired: true,

    async processCommand(command, context: ICliExecutionContext) {
        context.writer.writeln(`Searching for: ${command.value}`);
    },
};

// ── Module with completion providers ──────────────────────────

const completionModule: ICliModule = {
    apiVersion: 2,
    name: 'completion-demo',
    description: 'Custom tab-completion demos',
    processors: [deployProcessor, teamProcessor, searchProcessor],

    // Register completion providers via the module's services array.
    // Use multi: true so they add to (not replace) existing providers.
    services: [
        {
            provide: ICliCompletionProvider_TOKEN,
            useValue: deployCompletionProvider,
            multi: true,
        },
        {
            provide: ICliCompletionProvider_TOKEN,
            useValue: dynamicCompletionProvider,
            multi: true,
        },
        {
            provide: ICliCompletionProvider_TOKEN,
            useValue: asyncCompletionProvider,
            multi: true,
        },
    ],
};

// ── Bootstrap ─────────────────────────────────────────────────

const container = document.getElementById('terminal')!;
const engine = new CliEngine(container);

engine.registerModules([completionModule]);
engine.start().then(() => engine.focus());

window.addEventListener('beforeunload', () => engine.destroy());
