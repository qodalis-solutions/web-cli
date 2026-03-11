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

export class CliGroupaddCommandProcessor implements ICliCommandProcessor {
    command = 'groupadd';
    aliases = ['addgroup'];
    description = 'Create a new group';
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
            name: 'description',
            description: 'Group description',
            type: 'string',
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
        const description = command.args['description'] as string | undefined;

        try {
            await this.groupsStore.createGroup(name, description);
            context.writer.writeSuccess(`groupadd: group '${name}' created`);
        } catch (e: any) {
            context.writer.writeError(
                e.message || 'groupadd: failed to create group',
            );
        }
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer } = context;
        writer.writeln('Create a new group');
        writer.writeln();
        writer.writeln(
            `  ${writer.wrapInColor('groupadd <name>', CliForegroundColor.Cyan)}`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('groupadd <name> --description="Team devs"', CliForegroundColor.Cyan)}`,
        );
    }
}
