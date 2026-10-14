import {
    ICliCommandProcessor,
    ICliExecutionContext,
    CliProcessCommand,
    CliProcessorMetadata,
    CliIcon,
    CliForegroundColor,
    ICliCommandParameterDescriptor,
    ICliAuditService,
    ICliAuditService_TOKEN,
    DefaultLibraryAuthor,
    CliStateConfiguration,
} from '@qodalis/cli-core';

export class CliLastCommandProcessor implements ICliCommandProcessor {
    command = 'last';
    description = 'Show login/logout history';
    author = DefaultLibraryAuthor;
    acceptsRawInput = true;
    valueRequired = false;
    metadata: CliProcessorMetadata = {
        sealed: true,
        module: 'users',
        icon: CliIcon.User,
        requireAuth: true,
    };
    stateConfiguration: CliStateConfiguration = {
        initialState: {},
        storeName: 'users',
    };

    parameters: ICliCommandParameterDescriptor[] = [
        {
            name: 'limit',
            description: 'Number of entries to show (default: 20)',
            required: false,
            type: 'number',
        },
        {
            name: 'event',
            description: 'Filter by event type (login, logout, login_failed, password_changed, user_created, user_deleted)',
            required: false,
            type: 'string',
        },
    ];

    private auditService!: ICliAuditService;

    async initialize(context: ICliExecutionContext): Promise<void> {
        this.auditService = context.services.getRequired<ICliAuditService>(
            ICliAuditService_TOKEN,
        );
    }

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const limit = Number(command.args['limit']) || 20;
        const event = command.args['event'] as string | undefined;
        const username = command.value as string | undefined;

        const entries = await this.auditService.getEntries({
            limit,
            event,
            username,
        });

        if (entries.length === 0) {
            context.writer.writeInfo('No audit entries found');
            return;
        }

        const rows = entries.map((e) => ({
            USER: e.username,
            EVENT: e.event,
            TIME: new Date(e.timestamp).toLocaleString(),
            DETAILS: e.details || '',
        }));

        context.writer.writeObjectsAsTable(rows);
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer } = context;
        writer.writeln('Show login/logout history and audit events');
        writer.writeln();
        writer.writeln(
            `  ${writer.wrapInColor('last', CliForegroundColor.Cyan)}                     Show recent events`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('last <username>', CliForegroundColor.Cyan)}          Filter by user`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('last --event=login', CliForegroundColor.Cyan)}       Filter by event type`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('last --limit=50', CliForegroundColor.Cyan)}          Show more entries`,
        );
    }
}
