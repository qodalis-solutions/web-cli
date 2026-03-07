import {
    ICliCommandProcessor,
    ICliExecutionContext,
    CliProcessCommand,
    ICliCommandAuthor,
    CliProcessorMetadata,
    CliIcon,
    CliStateConfiguration,
    DefaultLibraryAuthor,
    CliForegroundColor,
} from '@qodalis/cli-core';

interface SnippetState {
    snippets: Record<string, string>;
}

export class CliSnippetCommandProcessor implements ICliCommandProcessor {
    command = 'snippet';
    description = 'Save and reuse parameterized command templates';
    aliases = ['snip'];
    author: ICliCommandAuthor = DefaultLibraryAuthor;
    metadata: CliProcessorMetadata = { icon: CliIcon.Code, module: 'system' };

    stateConfiguration: CliStateConfiguration = {
        storeName: 'snippets',
        initialState: { snippets: {} } as SnippetState,
    };

    processors: ICliCommandProcessor[] = [
        {
            command: 'list',
            description: 'List all saved snippets',
            processCommand: async (_: CliProcessCommand, context: ICliExecutionContext) => {
                const { snippets } = context.state.getState<SnippetState>();
                const entries = Object.entries(snippets);
                if (entries.length === 0) {
                    context.writer.writeInfo('No snippets saved yet. Use: snippet save <name> "<template>"');
                    return;
                }
                context.writer.writeln(
                    context.writer.wrapInColor('Saved snippets:', CliForegroundColor.Yellow),
                );
                for (const [name, template] of entries) {
                    context.writer.writeln(
                        `  ${context.writer.wrapInColor(name, CliForegroundColor.Cyan)}  ${template}`,
                    );
                }
            },
        },
        {
            command: 'save',
            description: 'Save a new snippet: snippet save <name> "<template>"',
            acceptsRawInput: true,
            valueRequired: true,
            processCommand: async (cmd: CliProcessCommand, context: ICliExecutionContext) => {
                const raw = (cmd.value ?? '').trim();
                // Parse: first token is name, rest is template (with optional quotes)
                const spaceIdx = raw.indexOf(' ');
                if (spaceIdx === -1) {
                    context.writer.writeError('Usage: snippet save <name> "<template>"');
                    return;
                }
                const name = raw.slice(0, spaceIdx).trim();
                let template = raw.slice(spaceIdx + 1).trim();
                // Strip surrounding quotes if present
                if (
                    (template.startsWith('"') && template.endsWith('"')) ||
                    (template.startsWith("'") && template.endsWith("'"))
                ) {
                    template = template.slice(1, -1);
                }
                if (!name || !template) {
                    context.writer.writeError('Usage: snippet save <name> "<template>"');
                    return;
                }
                const state = context.state.getState<SnippetState>();
                state.snippets[name] = template;
                context.state.updateState({ snippets: { ...state.snippets } });
                await context.state.persist();
                context.writer.writeSuccess(`Snippet "${name}" saved`);
            },
        },
        {
            command: 'show',
            description: 'Show a snippet template: snippet show <name>',
            acceptsRawInput: true,
            valueRequired: true,
            processCommand: async (cmd: CliProcessCommand, context: ICliExecutionContext) => {
                const name = (cmd.value ?? '').trim();
                const { snippets } = context.state.getState<SnippetState>();
                if (!snippets[name]) {
                    context.writer.writeError(`Snippet "${name}" not found`);
                    return;
                }
                context.writer.writeln(
                    `${context.writer.wrapInColor(name, CliForegroundColor.Cyan)}: ${snippets[name]}`,
                );
            },
        },
        {
            command: 'delete',
            description: 'Delete a snippet: snippet delete <name>',
            aliases: ['rm', 'remove'],
            acceptsRawInput: true,
            valueRequired: true,
            processCommand: async (cmd: CliProcessCommand, context: ICliExecutionContext) => {
                const name = (cmd.value ?? '').trim();
                const state = context.state.getState<SnippetState>();
                if (!state.snippets[name]) {
                    context.writer.writeError(`Snippet "${name}" not found`);
                    return;
                }
                delete state.snippets[name];
                context.state.updateState({ snippets: { ...state.snippets } });
                await context.state.persist();
                context.writer.writeSuccess(`Snippet "${name}" deleted`);
            },
        },
        {
            command: 'run',
            description: 'Run a snippet with variable values: snippet run <name> var1=val1 var2=val2',
            acceptsRawInput: true,
            valueRequired: true,
            processCommand: async (cmd: CliProcessCommand, context: ICliExecutionContext) => {
                const raw = (cmd.value ?? '').trim();
                const spaceIdx = raw.indexOf(' ');
                const name = spaceIdx === -1 ? raw : raw.slice(0, spaceIdx);
                const argsStr = spaceIdx === -1 ? '' : raw.slice(spaceIdx + 1).trim();

                const { snippets } = context.state.getState<SnippetState>();
                if (!snippets[name]) {
                    context.writer.writeError(`Snippet "${name}" not found`);
                    return;
                }

                // Parse key=value pairs
                const vars: Record<string, string> = {};
                const varPattern = /(\w+)=(?:"([^"]*)"|([\S]*))/g;
                let match: RegExpExecArray | null;
                while ((match = varPattern.exec(argsStr)) !== null) {
                    vars[match[1]] = match[2] ?? match[3] ?? '';
                }

                // Replace {{var}} placeholders
                let resolved = snippets[name];
                for (const [key, value] of Object.entries(vars)) {
                    resolved = resolved.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
                }

                // Check for unresolved variables
                const missing = [...resolved.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]);
                if (missing.length > 0) {
                    context.writer.writeError(
                        `Missing variables: ${missing.join(', ')}. Usage: snippet run ${name} ${missing.map((v) => `${v}=value`).join(' ')}`,
                    );
                    return;
                }

                context.writer.writeInfo(`Running: ${resolved}`);
                await context.executor.executeCommand(resolved, context);
            },
        },
    ];

    async processCommand(_: CliProcessCommand, context: ICliExecutionContext): Promise<void> {
        const { snippets } = context.state.getState<SnippetState>();
        const count = Object.keys(snippets).length;
        context.writer.writeln(
            `${count} snippet(s) saved. Sub-commands: list, save, show, run, delete`,
        );
    }
}
