import {
    ICliCommandProcessor,
    ICliExecutionContext,
    CliProcessCommand,
    CliProcessorMetadata,
    CliIcon,
    CliForegroundColor,
    ICliCommandParameterDescriptor,
    ICliGroupsStoreService,
    ICliGroupsStoreService_TOKEN,
    DefaultLibraryAuthor,
    CliStateConfiguration,
} from '@qodalis/cli-core';
import { requireAdmin } from '../utils/permissions';

export class CliGroupdelCommandProcessor implements ICliCommandProcessor {
    command = 'groupdel';
    aliases = ['delgroup'];
    description = 'Delete a group';
    author = DefaultLibraryAuthor;
    acceptsRawInput = true;
    valueRequired = true;
    metadata: CliProcessorMetadata = {
        sealed: true,
        module: 'users',
        icon: CliIcon.User,
    };
    stateConfiguration: CliStateConfiguration = {
        initialState: {},
        storeName: 'users',
    };
    parameters: ICliCommandParameterDescriptor[] = [
        {
            name: 'force',
            aliases: ['f'],
            description: 'Skip confirmation prompt',
            type: 'boolean',
            required: false,
        },
    ];

    private groupsStore!: ICliGroupsStoreService;

    async initialize(context: ICliExecutionContext): Promise<void> {
        this.groupsStore = context.services.get<ICliGroupsStoreService>(
            ICliGroupsStoreService_TOKEN,
        );
    }

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        if (!requireAdmin(context)) return;

        const name = command.value as string;

        if (!command.args['force'] && !command.args['f']) {
            const confirmed = await context.reader.readConfirm(
                `Delete group '${name}'?`,
            );
            if (!confirmed) {
                context.writer.writeln('Cancelled.');
                return;
            }
        }

        try {
            await this.groupsStore.deleteGroup(name);
            context.writer.writeSuccess(`groupdel: group '${name}' deleted`);
        } catch (e: any) {
            context.writer.writeError(
                e.message || 'groupdel: failed to delete group',
            );
        }
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer } = context;
        writer.writeln('Delete a group');
        writer.writeln();
        writer.writeln(
            `  ${writer.wrapInColor('groupdel <name>', CliForegroundColor.Cyan)}`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('groupdel <name> --force', CliForegroundColor.Cyan)}    Skip confirmation`,
        );
    }
}
