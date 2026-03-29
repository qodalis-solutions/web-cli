import {
    CliForegroundColor,
    CliIcon,
    CliProcessCommand,
    CliProcessorMetadata,
    CliStateConfiguration,
    ICliAuthService,
    ICliCommandParameterDescriptor,
    ICliCommandProcessor,
    ICliExecutionContext,
    ICliUsersStoreService,
} from '@qodalis/cli-core';
import { DefaultLibraryAuthor } from '@qodalis/cli-core';
import {
    ICliAuthService_TOKEN,
    ICliUsersStoreService_TOKEN,
} from '@qodalis/cli-core';
import { requireAdmin } from '../utils/permissions';

export class CliAddUserCommandProcessor implements ICliCommandProcessor {
    command = 'adduser';

    aliases = ['useradd'];

    description?: string | undefined = 'Add a new user';

    author = DefaultLibraryAuthor;

    metadata?: CliProcessorMetadata | undefined = {
        sealed: true,
        module: 'users',
        icon: CliIcon.User,
    };

    stateConfiguration?: CliStateConfiguration | undefined = {
        initialState: {},
        storeName: 'users',
    };

    acceptsRawInput?: boolean | undefined = true;

    valueRequired?: boolean | undefined = true;

    parameters?: ICliCommandParameterDescriptor[] | undefined = [
        {
            name: 'email',
            description: 'The email of the user',
            required: true,
            type: 'email',
            validator: (value: string) => {
                const emailRegex =
                    /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
                if (!emailRegex.test(value)) {
                    return {
                        valid: false,
                        message: 'Invalid email format',
                    };
                }

                return {
                    valid: true,
                };
            },
        },
        {
            name: 'groups',
            description: 'The groups the user belongs to, separated by commas',
            type: 'string',
            required: false,
        },
        {
            name: 'home',
            description: 'The home directory for the user',
            type: 'string',
            required: false,
        },
        {
            name: 'disabled',
            description: 'Create the user as disabled',
            type: 'boolean',
            required: false,
        },
    ];

    private usersStore!: ICliUsersStoreService;
    private authService!: ICliAuthService;

    async initialize(context: ICliExecutionContext): Promise<void> {
        this.usersStore = context.services.getRequired<ICliUsersStoreService>(
            ICliUsersStoreService_TOKEN,
        );
        this.authService = context.services.getRequired<ICliAuthService>(
            ICliAuthService_TOKEN,
        );
    }

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        if (!requireAdmin(context)) {
            return;
        }

        const name: string = command.value as string;
        const email: string = command.args['email'];
        const groups: string[] = command.args['groups']?.split(',') || [];
        const homeDir: string | undefined = command.args['home'];
        const disabled: boolean | undefined = command.args['disabled'];

        let user;

        try {
            user = await this.usersStore.createUser({
                name,
                email,
                groups,
                homeDir,
                disabled,
            });
        } catch (e) {
            context.logger.error(e);
            context.writer.writeError(
                e?.toString() || 'An error occurred while creating the user',
            );
            return;
        }

        // Prompt for password
        const password = await context.reader.readPassword('New password: ');
        if (password === null) {
            // User aborted — clean up the created user
            await this.usersStore.deleteUser(user.id);
            context.writer.writeError('Aborted');
            return;
        }

        const confirmPassword = await context.reader.readPassword(
            'Retype new password: ',
        );
        if (confirmPassword === null) {
            await this.usersStore.deleteUser(user.id);
            context.writer.writeError('Aborted');
            return;
        }

        if (password !== confirmPassword) {
            await this.usersStore.deleteUser(user.id);
            context.writer.writeError('Sorry, passwords do not match.');
            return;
        }

        try {
            await this.authService.setPassword(user.id, password);
        } catch (e) {
            await this.usersStore.deleteUser(user.id);
            context.writer.writeError('Failed to set password');
            return;
        }

        // Create home directory if the files module is installed
        if (user.homeDir) {
            try {
                const fs = context.services.getRequired<any>('cli-file-system-service');
                if (fs && !fs.exists(user.homeDir)) {
                    fs.createDirectory(user.homeDir, true);
                    await fs.persist();
                }
            } catch {
                // Files module not installed — skip
            }
        }

        context.writer.writeInfo('User created successfully');
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer } = context;
        writer.writeln('Add a new user to the system');
        writer.writeln();
        writer.writeln('Usage:');
        writer.writeln(
            `  ${writer.wrapInColor('adduser <name> --email=<email> [--groups=<groups>] [--home=<dir>] [--disabled]', CliForegroundColor.Cyan)}`,
        );
        writer.writeln();
        writer.writeln('Examples:');
        writer.writeln(
            `  adduser John --email=john@example.com                   ${writer.wrapInColor('# Basic', CliForegroundColor.Green)}`,
        );
        writer.writeln(
            `  adduser Jane --email=jane@test.com --groups=admin,dev   ${writer.wrapInColor('# With groups', CliForegroundColor.Green)}`,
        );
        writer.writeln(
            `  adduser bot --email=bot@sys.local --disabled            ${writer.wrapInColor('# Disabled account', CliForegroundColor.Green)}`,
        );
    }
}
