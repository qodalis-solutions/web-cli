/**
 * Example 07 — HTTP Client (Vanilla JS)
 *
 * Demonstrates context.http — the built-in HTTP client that automatically
 * wires the command's abort signal so requests cancel on Ctrl+C.
 *
 * Methods: get, post, put, patch, delete, head, options, fetch
 *
 * Docs: https://qodalis-solutions.github.io/web-cli/docs/core-concepts/http-client
 */

import '@xterm/xterm/css/xterm.css';
import { CliEngine } from '@qodalis/cli';
import type {
    ICliCommandProcessor,
    ICliModule,
    CliProcessCommand,
    ICliExecutionContext,
} from '@qodalis/cli-core';

// ── 1. GET request with typed response ─────────────────────────

interface Todo {
    userId: number;
    id: number;
    title: string;
    completed: boolean;
}

const fetchTodosProcessor: ICliCommandProcessor = {
    command: 'fetch-todos',
    description: 'Fetch todos from JSONPlaceholder API',
    parameters: [
        { name: 'limit', description: 'Number of todos to fetch', required: false, type: 'number', defaultValue: 5 },
    ],

    async processCommand(command: CliProcessCommand, context: ICliExecutionContext) {
        const limit = (command.args['limit'] as number) || 5;

        context.spinner?.show('Fetching todos...');

        try {
            // GET request — returns parsed JSON, typed as Todo[]
            // Automatically cancelled if the user presses Ctrl+C
            const todos = await context.http.get<Todo[]>(
                `https://jsonplaceholder.typicode.com/todos?_limit=${limit}`,
            );

            context.spinner?.hide();
            context.writer.writeObjectsAsTable(
                todos.map(t => ({
                    ID: t.id,
                    Title: t.title.substring(0, 40),
                    Done: t.completed ? '✓' : '✗',
                })),
            );
        } catch (error: any) {
            context.spinner?.hide();
            if (error.name === 'AbortError') {
                context.writer.writeWarning('Request cancelled.');
            } else {
                context.writer.writeError(`Failed: ${error.message}`);
            }
        }
    },
};

// ── 2. POST request ────────────────────────────────────────────

const createTodoProcessor: ICliCommandProcessor = {
    command: 'create-todo',
    description: 'Create a todo via POST request',
    parameters: [
        { name: 'title', description: 'Todo title', required: true, type: 'string' },
    ],

    async processCommand(command: CliProcessCommand, context: ICliExecutionContext) {
        const title = command.args['title'] as string;

        context.spinner?.show('Creating todo...');

        try {
            // POST — body is auto-serialized as JSON
            const result = await context.http.post<Todo>(
                'https://jsonplaceholder.typicode.com/todos',
                { title, completed: false, userId: 1 },
            );

            context.spinner?.hide();
            context.writer.writeSuccess(`Created todo #${result.id}: ${result.title}`);
        } catch (error: any) {
            context.spinner?.hide();
            context.writer.writeError(`Failed: ${error.message}`);
        }
    },
};

// ── 3. Request with timeout ────────────────────────────────────

const timeoutDemoProcessor: ICliCommandProcessor = {
    command: 'fetch-slow',
    description: 'Demonstrate request timeout',

    async processCommand(_command: CliProcessCommand, context: ICliExecutionContext) {
        context.spinner?.show('Fetching with 3s timeout...');

        try {
            // The timeout option auto-aborts after the specified duration
            await context.http.get('https://httpbin.org/delay/10', {
                timeout: 3000, // 3 seconds
            });

            context.spinner?.hide();
            context.writer.writeSuccess('Request completed.');
        } catch (error: any) {
            context.spinner?.hide();
            if (error.name === 'AbortError') {
                context.writer.writeWarning('Request timed out after 3 seconds.');
            } else {
                context.writer.writeError(`Failed: ${error.message}`);
            }
        }
    },
};

// ── 4. Raw fetch for streaming ─────────────────────────────────

const streamDemoProcessor: ICliCommandProcessor = {
    command: 'fetch-stream',
    description: 'Stream a response using raw fetch()',

    async processCommand(_command: CliProcessCommand, context: ICliExecutionContext) {
        try {
            // Use raw fetch() when you need the full Response object
            // (for streaming, headers, status codes, etc.)
            const response = await context.http.fetch(
                'https://jsonplaceholder.typicode.com/posts/1',
            );

            context.writer.writeKeyValue({
                'Status': `${response.status} ${response.statusText}`,
                'Content-Type': response.headers.get('content-type') || 'unknown',
            });

            const body = await response.json();
            context.writer.writeln();
            context.writer.writeJson(body);
        } catch (error: any) {
            context.writer.writeError(`Failed: ${error.message}`);
        }
    },
};

// ── 5. Progress bar with HTTP ──────────────────────────────────

const progressDemoProcessor: ICliCommandProcessor = {
    command: 'fetch-progress',
    description: 'Demonstrate progress bar with HTTP request',

    async processCommand(_command: CliProcessCommand, context: ICliExecutionContext) {
        const { progressBar, writer, http } = context;

        writer.writeInfo('Fetching multiple resources...');
        const urls = [
            'https://jsonplaceholder.typicode.com/posts/1',
            'https://jsonplaceholder.typicode.com/posts/2',
            'https://jsonplaceholder.typicode.com/posts/3',
            'https://jsonplaceholder.typicode.com/posts/4',
            'https://jsonplaceholder.typicode.com/posts/5',
        ];

        progressBar.show('Fetching resources...');

        for (let i = 0; i < urls.length; i++) {
            await http.get(urls[i]);
            progressBar.update(Math.round(((i + 1) / urls.length) * 100));
        }

        progressBar.complete();
        writer.writeSuccess(`Fetched ${urls.length} resources.`);
    },
};

// ── Module & Bootstrap ─────────────────────────────────────────

const httpDemoModule: ICliModule = {
    apiVersion: 2,
    name: 'http-demo',
    processors: [
        fetchTodosProcessor,
        createTodoProcessor,
        timeoutDemoProcessor,
        streamDemoProcessor,
        progressDemoProcessor,
    ],
};

const container = document.getElementById('terminal')!;
const engine = new CliEngine(container);
engine.registerModules([httpDemoModule]);
engine.start().then(() => engine.focus());
window.addEventListener('beforeunload', () => engine.destroy());
