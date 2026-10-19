import {
    ICliCommandProcessor,
    ICliCommandChildProcessor,
    ICliExecutionContext,
    CliProcessCommand,
    ICliCommandAuthor,
    CliProcessorMetadata,
    CliIcon,
    CliStateConfiguration,
    DefaultLibraryAuthor,
    CliForegroundColor,
    writeExamples,
    writeUsage,
    writeWrapped,
    joinShellWords,
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

    processors: ICliCommandChildProcessor[] = [
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
                // First argument is the name, the rest the template: one
                // (quoted) argument, or else the command line as typed
                const [name = '', ...rest] = cmd.positionals ?? [];
                const raw = (cmd.value ?? '').trim();
                const spaceIdx = raw.search(/\s/);
                const template =
                    rest.length === 1
                        ? rest[0]
                        : spaceIdx === -1
                          ? ''
                          : raw.slice(spaceIdx + 1).trim();
                if (!name || !template) {
                    context.writer.writeError('Usage: snippet save <name> "<template>"');
                    return;
                }
                // From the latest saved snippets (another tab may have added some)
                await context.state.update((state) => ({
                    snippets: { ...(state['snippets'] ?? {}), [name]: template },
                }));
                context.writer.writeSuccess(`Snippet "${name}" saved`);
            },
        },
        {
            command: 'show',
            description: 'Show a snippet template: snippet show <name>',
            acceptsRawInput: true,
            valueRequired: true,
            processCommand: async (cmd: CliProcessCommand, context: ICliExecutionContext) => {
                const name = joinShellWords(cmd.value ?? '');
                const { snippets } = context.state.getState<SnippetState>();
                if (!(name in snippets)) {
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
                const name = joinShellWords(cmd.value ?? '');
                const { snippets } = context.state.getState<SnippetState>();
                if (!(name in snippets)) {
                    context.writer.writeError(`Snippet "${name}" not found`);
                    return;
                }
                await context.state.update((state) => {
                    const updated = { ...(state['snippets'] ?? {}) };
                    delete updated[name];
                    return { snippets: updated };
                });
                context.writer.writeSuccess(`Snippet "${name}" deleted`);
            },
        },
        {
            command: 'run',
            description: 'Run a snippet with variable values: snippet run <name> var1=val1 var2=val2',
            acceptsRawInput: true,
            valueRequired: true,
            processCommand: async (cmd: CliProcessCommand, context: ICliExecutionContext) => {
                const [name = '', ...assignments] = cmd.positionals ?? [];

                const { snippets } = context.state.getState<SnippetState>();
                if (!(name in snippets)) {
                    context.writer.writeError(`Snippet "${name}" not found`);
                    return;
                }

                // key=value pairs (`name="Ana Maria"` is one argument)
                const vars: Record<string, string> = {};
                for (const assignment of assignments) {
                    const match = /^(\w+)=([\s\S]*)$/.exec(assignment);
                    if (match) vars[match[1]] = match[2];
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

    writeDescription(context: ICliExecutionContext): void {
        const t = context.translator;
        writeWrapped(
            context,
            t.t('cli.snippet.help.save_command_lines_you', 'Save command lines you use often as named templates, with {{placeholders}} filled in when you run them. Snippets are saved in the browser and shared by all your terminals and tabs.'),
        );
        context.writer.writeln();
        writeUsage(context, [
            ['snippet save <name> "<template>"', t.t('cli.snippet.help.save_replace_snippet', 'Save (or replace) a snippet')],
            ['snippet run <name> [var=value ...]', t.t('cli.snippet.help.fill_placeholders_run', 'Fill in the placeholders and run it')],
            ['snippet list', t.t('cli.snippet.help.all_saved_snippets', 'All saved snippets')],
            ['snippet show <name>', t.t('cli.snippet.help.print_snippet', 'Print a snippet')],
            ['snippet delete <name>', t.t('cli.snippet.help.delete_snippet_rm_remove', 'Delete a snippet (rm, remove)')],
        ]);
        context.writer.writeln();
        writeExamples(context, [
            ['snippet save greet "echo Hello {{name}}"', t.t('cli.snippet.help.template_placeholder', 'A template with a placeholder')],
            ['snippet run greet name=Ada', t.t('cli.snippet.help.runs_echo_hello_ada', 'Runs: echo Hello Ada')],
            ['snip run greet name="Ada Lovelace"', t.t('cli.snippet.help.quote_values_spaces', 'Quote values with spaces')],
        ]);
    }

    async processCommand(_: CliProcessCommand, context: ICliExecutionContext): Promise<void> {
        const { snippets } = context.state.getState<SnippetState>();
        const count = Object.keys(snippets).length;
        context.writer.writeln(
            `${count} snippet(s) saved. Sub-commands: list, save, show, run, delete`,
        );
    }
}
