import {
    CliEvent,
    CliForegroundColor,
    CliProcessCommand,
    cliAuthorize,
    CliProcessorMetadata,
    CliUsersPermissions,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
    joinShellWords,
    unquoteRawArgument,
} from '@qodalis/cli-core';

const DATA_PREVIEW_LENGTH = 120;

/**
 * Namespaces of the system's own events: emitting them from the terminal
 * could make the engine or plugins act on something that did not happen
 * (`session:changed` switches whose saved state is used).
 */
const RESERVED_NAMESPACES = [
    'boot', 'command', 'config', 'module', 'package', 'server', 'service', 'session', 'user',
];

/** `user:*` events carry account details: only for those who may read the audit log. */
function canSee(event: CliEvent, context: ICliExecutionContext): boolean {
    return !event.type.startsWith('user:') || cliAuthorize(context, CliUsersPermissions.AuditRead);
}

/** `14:03:21.512  package:installed  [pkg]  {"name":"@qodalis/cli-guid",...}` */
function formatEvent(event: CliEvent, context: ICliExecutionContext): string {
    const { writer } = context;
    const time = new Date(event.timestamp).toISOString().slice(11, 23);
    const source = event.source
        ? `  ${writer.wrapInColor(`[${event.source}]`, CliForegroundColor.Blue)}`
        : '';
    let data = '';
    if (event.data !== undefined) {
        try {
            data = JSON.stringify(event.data) ?? '';
        } catch {
            data = String(event.data);
        }
        if (data.length > DATA_PREVIEW_LENGTH) {
            data = `${data.slice(0, DATA_PREVIEW_LENGTH - 1)}…`;
        }
    }
    return `${writer.wrapInColor(time, CliForegroundColor.Yellow)}  ${writer.wrapInColor(event.type, CliForegroundColor.Cyan)}${source}${data ? `  ${data}` : ''}`;
}

function busOf(context: ICliExecutionContext) {
    if (!context.events) {
        context.writer.writeError(
            'The event bus is not available in this terminal',
        );
    }
    return context.events;
}

/**
 * `events`: inspect the terminal's event bus — watch events live, show the
 * recent ones, or emit one (for testing plugins).
 */
export class CliEventsCommandProcessor implements ICliCommandProcessor {
    command = 'events';

    description = 'Watch, list and emit events on the event bus';

    author = DefaultLibraryAuthor;

    version = '1.0.0';

    metadata?: CliProcessorMetadata = {
        sealed: true,
        icon: '📡',
        module: 'system',
    };

    processors: ICliCommandProcessor[] = [
        {
            command: 'watch',
            description: 'Print events as they happen (Ctrl+C to stop)',
            acceptsRawInput: true,
            processCommand: async (command, context) => {
                const bus = busOf(context);
                if (!bus) return;
                const pattern = joinShellWords(command.value ?? '') || '*';

                context.writer.writeInfo(
                    `Watching ${context.writer.wrapInColor(pattern, CliForegroundColor.Cyan)} — press Ctrl+C to stop`,
                );
                await new Promise<void>((resolve) => {
                    const off = bus.on(pattern, (event) => {
                        if (canSee(event, context)) {
                            context.writer.writeln(formatEvent(event, context));
                        }
                    });
                    const sub = context.onAbort.subscribe(() => {
                        off();
                        sub.unsubscribe();
                        resolve();
                    });
                });
            },
            writeDescription: (context) => {
                const t = context.translator;
                context.writer.writeln(
                    t.t('cli.events.watch.help.intro', 'Print events as they happen, until Ctrl+C'),
                );
                context.writer.writeln();
                context.writer.writeln(
                    `  events watch                 ${t.t('cli.events.watch.help.every_event', 'Every event')}`,
                );
                context.writer.writeln(
                    `  events watch package:*       ${t.t('cli.events.watch.help.namespace', 'A namespace')}`,
                );
                context.writer.writeln(
                    `  events watch boot:completed  ${t.t('cli.events.watch.help.one_type', 'One type')}`,
                );
            },
        },
        {
            command: 'log',
            aliases: ['ls'],
            description: 'Show recent events (kept in memory, not persisted)',
            acceptsRawInput: true,
            parameters: [
                {
                    name: 'limit',
                    aliases: ['n'],
                    type: 'number',
                    description: 'How many events to show (default 20)',
                    required: false,
                },
            ],
            processCommand: async (command, context) => {
                const bus = busOf(context);
                if (!bus) return;
                const pattern = joinShellWords(command.value ?? '') || '*';
                const limit = Number(
                    command.args['limit'] ?? command.args['n'] ?? 20,
                );
                const events = bus
                    .history(pattern)
                    .filter((event) => canSee(event, context))
                    .slice(-(limit > 0 ? limit : 20));

                if (events.length === 0) {
                    context.writer.writeInfo(`No events matching ${pattern}`);
                    return;
                }
                for (const event of events) {
                    context.writer.writeln(formatEvent(event, context));
                }
            },
            writeDescription: (context) => {
                const t = context.translator;
                context.writer.writeln(
                    t.t('cli.events.log.help.intro', 'Show the most recent events, oldest first'),
                );
                context.writer.writeln();
                context.writer.writeln(
                    `  events log                   ${t.t('cli.events.log.help.last_20', 'Last 20 events')}`,
                );
                context.writer.writeln(
                    `  events log server:* -n 50    ${t.t('cli.events.log.help.last_50_server', 'Last 50 server events')}`,
                );
            },
        },
        {
            command: 'emit',
            description: 'Emit an event: events emit <type> [json]',
            valueRequired: true,
            acceptsRawInput: true,
            metadata: {
                // Emitting can trigger what plugins do on events
                requiredPermissions: ['system:events'],
            },
            processCommand: async (command, context) => {
                const bus = busOf(context);
                if (!bus) return;
                // The type, then a JSON or text payload (quotes around it removed)
                const raw = command.value!.trim();
                const space = raw.search(/\s/);
                const type = command.positionals?.[0] ?? '';
                const namespace = type.includes(':') ? type.slice(0, type.indexOf(':')) : '';
                if (RESERVED_NAMESPACES.includes(namespace)) {
                    context.writer.writeError(
                        `events emit: '${type}' is a system event and cannot be emitted from the terminal`,
                    );
                    context.process.exit(1, { silent: true });
                    return;
                }
                const payload =
                    space === -1 ? '' : unquoteRawArgument(raw.slice(space + 1));

                let data: unknown = undefined;
                if (payload) {
                    try {
                        data = JSON.parse(payload);
                    } catch {
                        data = payload; // plain text payload
                    }
                }
                bus.emit(type, data, { source: 'events' });
                context.writer.writeSuccess(
                    `Emitted ${context.writer.wrapInColor(type, CliForegroundColor.Cyan)}`,
                );
            },
            writeDescription: (context) => {
                context.writer.writeln(
                    context.translator.t('cli.events.emit.help.intro', 'Emit an event, e.g. to test a plugin that listens for it'),
                );
                context.writer.writeln();
                context.writer.writeln(`  events emit todo:refresh`);
                context.writer.writeln(`  events emit demo:ping {"n": 1}`);
            },
        },
    ];

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        await context.executor.showHelp(command, context);
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer, translator: t } = context;
        writer.writeln(t.t('cli.events.description', this.description));
        writer.writeln();
        writer.writeln(`📋 ${t.t('cli.events.help.commands', 'Commands:')}`);
        writer.writeln(
            `  ${writer.wrapInColor('events watch [pattern]', CliForegroundColor.Cyan)}       ${t.t('cli.events.help.print_live', 'Print events live')}`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('events log [pattern] [-n N]', CliForegroundColor.Cyan)}  ${t.t('cli.events.help.recent', 'Recent events')}`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('events emit <type> [json]', CliForegroundColor.Cyan)}    ${t.t('cli.events.help.emit', 'Emit an event')}`,
        );
        writer.writeln();
        writer.writeln(
            t.t('cli.events.help.patterns', 'Patterns: an exact type (package:installed), a namespace (package:*) or * for all.'),
        );
        writer.writeln(
            t.t('cli.events.help.in_memory', 'Events are kept in memory for this terminal only; nothing is persisted.'),
        );
    }
}
