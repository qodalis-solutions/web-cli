import {
    ICliCommandProcessor,
    ICliExecutionContext,
    CliProcessCommand,
    CliProcessorMetadata,
    CliIcon,
    CliForegroundColor,
    ICliCommandParameterDescriptor,
    ICliUsersStoreService,
    ICliUsersStoreService_TOKEN,
    DefaultLibraryAuthor,
    CliStateConfiguration,
    CliUpdateUser,
} from '@qodalis/cli-core';
import { firstValueFrom } from 'rxjs';
import { requireAdmin } from '../utils/permissions';

export class CliUsermodCommandProcessor implements ICliCommandProcessor {
    command = 'usermod';
    description = 'Modify a user account';
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
            name: 'email',
            description: 'New email address',
            type: 'string',
            required: false,
        },
        {
            name: 'groups',
            description: 'Replace groups (comma-separated)',
            type: 'string',
            required: false,
        },
        {
            name: 'add-groups',
            description: 'Add to groups (comma-separated)',
            type: 'string',
            required: false,
        },
        {
            name: 'remove-groups',
            description: 'Remove from groups (comma-separated)',
            type: 'string',
            required: false,
        },
        {
            name: 'home',
            description: 'Set home directory',
            type: 'string',
            required: false,
        },
        {
            name: 'disable',
            description: 'Disable the account',
            type: 'boolean',
            required: false,
        },
        {
            name: 'enable',
            description: 'Enable the account',
            type: 'boolean',
            required: false,
        },
    ];

    private usersStore!: ICliUsersStoreService;

    async initialize(context: ICliExecutionContext): Promise<void> {
        this.usersStore = context.services.get<ICliUsersStoreService>(
            ICliUsersStoreService_TOKEN,
        );
    }

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        if (!requireAdmin(context)) return;

        const target = command.value as string;
        const user = await firstValueFrom(this.usersStore.getUser(target));

        if (!user) {
            context.writer.writeError(
                `usermod: user '${target}' does not exist`,
            );
            return;
        }

        const updates: CliUpdateUser = {};

        if (command.args['email']) {
            updates.email = command.args['email'];
        }

        if (command.args['home']) {
            updates.homeDir = command.args['home'];
        }

        if (command.args['disable']) {
            updates.disabled = true;
        }

        if (command.args['enable']) {
            updates.disabled = false;
        }

        // Handle groups
        if (command.args['groups']) {
            updates.groups = command.args['groups']
                .split(',')
                .map((g: string) => g.trim());
        } else {
            let groups = [...user.groups];
            if (command.args['add-groups']) {
                const toAdd = command.args['add-groups']
                    .split(',')
                    .map((g: string) => g.trim());
                groups = [...new Set([...groups, ...toAdd])];
            }
            if (command.args['remove-groups']) {
                const toRemove = command.args['remove-groups']
                    .split(',')
                    .map((g: string) => g.trim());
                groups = groups.filter((g) => !toRemove.includes(g));
            }
            if (command.args['add-groups'] || command.args['remove-groups']) {
                updates.groups = groups;
            }
        }

        if (Object.keys(updates).length === 0) {
            context.writer.writeError('usermod: no changes specified');
            return;
        }

        try {
            await this.usersStore.updateUser(user.id, updates);
            context.writer.writeSuccess(`usermod: user '${user.name}' updated`);
        } catch (e: any) {
            context.writer.writeError(
                e.message || 'usermod: failed to update user',
            );
        }
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer } = context;
        writer.writeln('Modify a user account');
        writer.writeln();
        writer.writeln(
            `  ${writer.wrapInColor('usermod <username> [options]', CliForegroundColor.Cyan)}`,
        );
        writer.writeln();
        writer.writeln('Options:');
        writer.writeln(
            `  ${writer.wrapInColor('--email=<email>', CliForegroundColor.Cyan)}              Change email`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('--groups=<g1,g2>', CliForegroundColor.Cyan)}             Replace groups`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('--add-groups=<g1,g2>', CliForegroundColor.Cyan)}         Add to groups`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('--remove-groups=<g1,g2>', CliForegroundColor.Cyan)}      Remove from groups`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('--home=<path>', CliForegroundColor.Cyan)}                Set home directory`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('--disable', CliForegroundColor.Cyan)}                    Disable account`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('--enable', CliForegroundColor.Cyan)}                     Enable account`,
        );
    }
}
