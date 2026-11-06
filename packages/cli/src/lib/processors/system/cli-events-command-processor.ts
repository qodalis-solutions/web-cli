import {
    CliEvent,
    CliForegroundColor,
    CliProcessCommand,
    cliAuthorize,
    CliProcessorMetadata,
    CliUsersPermissions,
    DefaultLibraryAuthor,
    ICliCommandParameterDescriptor,
    ICliCommandProcessor,
    ICliExecutionContext,
    joinShellWords,
    unquoteRawArgument,
} from '@qodalis/cli-core';
import { matchesEventPattern } from '../../services/cli-event-bus';

const DATA_PREVIEW_LENGTH = 120;

/** Events a server sent, relayed on the bus as `server:event {server, type, data}`. */
const SERVER_EVENT = 'server:event';

/** Fields of a server event that are not printed as `key=value`. */
const SERVER_ENVELOPE_FIELDS = new Set(['type', 'timestamp']);

/**
 * Namespaces of the system's own events: emitting them from the terminal
 * could make the engine or plugins act on something that did not happen
 * (`session:changed` switches whose saved state is used).
 */
const RESERVED_NAMESPACES = [
    'boot', 'command', 'config', 'module', 'package', 'server', 'service', 'session', 'user',
];

interface ServerEventData {
    server: string;
    type: string;
    data: unknown;
}

/** Which events to show: a type pattern, and where they come from. */
interface EventFilter {
    pattern: string;
    /** Only the events of this server */
    server?: string;
    /** Only the terminal's own events */
    local?: boolean;
}

function serverEventOf(event: CliEvent): ServerEventData | undefined {
    return event.type === SERVER_EVENT ? (event.data as ServerEventData) : undefined;
}

/**
 * Whether the event passes the filter. A server event matches by the type the
 * server gave it (`job:*`), and still by `server:*` for all server events.
 */
function matchesFilter(event: CliEvent, filter: EventFilter): boolean {
    const remote = serverEventOf(event);
    if (!remote) {
        return !filter.server && matchesEventPattern(event.type, filter.pattern);
    }
    if (filter.local) return false;
    if (filter.server && remote.server.toLowerCase() !== filter.server.toLowerCase()) return false;
    return (
        matchesEventPattern(remote.type, filter.pattern) ||
        matchesEventPattern(SERVER_EVENT, filter.pattern)
    );
}

/**
 * `user:*` events of the terminal carry account details: only for those who may
 * read the audit log. A server sends a client only the events it may see.
 */
function canSee(event: CliEvent, context: ICliExecutionContext): boolean {
    return !event.type.startsWith('user:') || cliAuthorize(context, CliUsersPermissions.AuditRead);
}

/** `jobId=cleanup executionId=4f2… duration=1520`, shortened to one line. */
export function formatServerEventFields(data: unknown): string {
    if (!data || typeof data !== 'object') return '';
    const parts: string[] = [];
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
        if (SERVER_ENVELOPE_FIELDS.has(key) || value === undefined || value === null) continue;
        const text = typeof value === 'string' ? value : JSON.stringify(value);
        parts.push(`${key}=${/\s/.test(text) ? JSON.stringify(text) : text}`);
    }
    return shorten(parts.join(' '));
}

function shorten(text: string): string {
    return text.length > DATA_PREVIEW_LENGTH ? `${text.slice(0, DATA_PREVIEW_LENGTH - 1)}…` : text;
}

/**
 * `14:03:21.512  package:installed  [pkg]  {"name":"@qodalis/cli-guid",...}`, and for
 * a server event `14:03:22.020  job:completed  [node]  jobId=cleanup duration=1520`
 * (at the time the server sent it).
 */
function formatEvent(event: CliEvent, context: ICliExecutionContext): string {
    const { writer } = context;
    const remote = serverEventOf(event);
    let time = event.timestamp as number | string;
    let type = event.type;
    let source = event.source;
    let data = '';
    if (remote) {
        const sent = (remote.data as { timestamp?: unknown } | null)?.timestamp;
        if (typeof sent === 'string' && !isNaN(Date.parse(sent))) time = sent;
        type = remote.type;
        source = remote.server;
        data = formatServerEventFields(remote.data);
    } else if (event.data !== undefined) {
        try {
            data = JSON.stringify(event.data) ?? '';
        } catch {
            data = String(event.data);
        }
        data = shorten(data);
    }
    const when = new Date(time).toISOString().slice(11, 23);
    const from = source
        ? `  ${writer.wrapInColor(`[${source}]`, remote ? CliForegroundColor.Magenta : CliForegroundColor.Blue)}`
        : '';
    return `${writer.wrapInColor(when, CliForegroundColor.Yellow)}  ${writer.wrapInColor(type, CliForegroundColor.Cyan)}${from}${data ? `  ${data}` : ''}`;
}

/** The pattern and the --server / --local options of watch and log. */
function filterOf(command: CliProcessCommand): EventFilter {
    const server = command.args['server'] ?? command.args['s'];
    return {
        pattern: joinShellWords(command.value ?? '') || '*',
        server: server === undefined || server === true ? undefined : String(server),
        local: !!(command.args['local'] || command.args['l']),
    };
}

const FILTER_PARAMETERS: ICliCommandParameterDescriptor[] = [
    {
        name: 'server',
        aliases: ['s'],
        type: 'string',
        description: 'Only the events of this server',
        required: false,
    },
    {
        name: 'local',
        aliases: ['l'],
        type: 'boolean',
        description: "Only the terminal's own events",
        required: false,
    },
];

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

    description = 'Watch, list and emit events of the terminal and the connected servers';

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
            parameters: FILTER_PARAMETERS,
            processCommand: async (command, context) => {
                const bus = busOf(context);
                if (!bus) return;
                const filter = filterOf(command);

                context.writer.writeInfo(
                    `Watching ${context.writer.wrapInColor(filter.pattern, CliForegroundColor.Cyan)} — press Ctrl+C to stop`,
                );
                await new Promise<void>((resolve) => {
                    const off = bus.on('*', (event) => {
                        if (matchesFilter(event, filter) && canSee(event, context)) {
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
                context.writer.writeln(
                    `  events watch job:* -s node   ${t.t('cli.events.watch.help.server_jobs', 'Job events of the server node')}`,
                );
                context.writer.writeln(
                    `  events watch --local         ${t.t('cli.events.watch.help.local_only', "Only the terminal's own events")}`,
                );
            },
        },
        {
            command: 'log',
            aliases: ['ls'],
            description: 'Show recent events (kept in memory, not persisted)',
            acceptsRawInput: true,
            parameters: [
                ...FILTER_PARAMETERS,
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
                const filter = filterOf(command);
                const limit = Number(
                    command.args['limit'] ?? command.args['n'] ?? 20,
                );
                const events = bus
                    .history('*')
                    .filter((event) => matchesFilter(event, filter) && canSee(event, context))
                    .slice(-(limit > 0 ? limit : 20));

                if (events.length === 0) {
                    context.writer.writeInfo(`No events matching ${filter.pattern}`);
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
                context.writer.writeln(
                    `  events log job:failed        ${t.t('cli.events.log.help.failed_jobs', 'Recent failed job runs, on every server')}`,
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
            t.t('cli.events.help.servers', 'Events of the connected servers (job runs, user, token and file changes, ...) are shown with the server name; each server sends only the events you may see. Filter with --server <name>, or --local for the terminal\'s own events.'),
        );
        writer.writeln(
            t.t('cli.events.help.in_memory', 'Events are kept in memory for this terminal only; nothing is persisted.'),
        );
    }
}
