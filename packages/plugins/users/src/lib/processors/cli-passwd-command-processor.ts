import {
    ICliCommandProcessor,
    ICliExecutionContext,
    CliProcessCommand,
    CliProcessorMetadata,
    CliIcon,
    CliForegroundColor,
    ICliCommandParameterDescriptor,
    ICliUsersStoreService,
    ICliAuthService,
    ICliUsersStoreService_TOKEN,
    ICliAuthService_TOKEN,
    DefaultLibraryAuthor,
    CliStateConfiguration,
} from '@qodalis/cli-core';
import { firstValueFrom } from 'rxjs';

export class CliPasswdCommandProcessor implements ICliCommandProcessor {
    command = 'passwd';
    description = 'Change user password';
    author = DefaultLibraryAuthor;
    acceptsRawInput = true;
    valueRequired = false;
    metadata: CliProcessorMetadata = {
        sealed: true,
        module: 'users',
        icon: CliIcon.User,
    };
    stateConfiguration: CliStateConfiguration = {
        initialState: {},
        storeName: 'users',
    };

    private usersStore!: ICliUsersStoreService;
    private authService!: ICliAuthService;

    async initialize(context: ICliExecutionContext): Promise<void> {
        this.usersStore = context.services.get<ICliUsersStoreService>(
            ICliUsersStoreService_TOKEN,
        );
        this.authService = context.services.get<ICliAuthService>(
            ICliAuthService_TOKEN,
        );
    }

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const session = context.userSession;
        if (!session) {
            context.writer.writeError('passwd: no user session');
            return;
        }

        // Determine target user
        let targetUser = session.user;
        const targetName = command.value as string;

        if (targetName) {
            // Changing another user's password requires admin
            if (!session.user.groups.includes('admin')) {
                context.writer.writeError('passwd: permission denied');
                return;
            }
            const found = await firstValueFrom(
                this.usersStore.getUser(targetName),
            );
            if (!found) {
                context.writer.writeError(
                    `passwd: user '${targetName}' does not exist`,
                );
                return;
            }
            targetUser = found;
        }

        // If changing own password, verify current password first
        const isOwnPassword = targetUser.id === session.user.id;
        if (isOwnPassword) {
            const currentPassword =
                await context.reader.readPassword('Current password: ');
            if (currentPassword === null) return;

            const valid = await this.authService.verifyPassword(
                targetUser.id,
                currentPassword,
            );
            if (!valid) {
                context.writer.writeError('passwd: Authentication failure');
                return;
            }
        }

        const newPassword = await context.reader.readPassword('New password: ');
        if (newPassword === null) return;

        if (!newPassword) {
            context.writer.writeError('passwd: password cannot be empty');
            return;
        }

        const confirmPassword = await context.reader.readPassword(
            'Retype new password: ',
        );
        if (confirmPassword === null) return;

        if (newPassword !== confirmPassword) {
            context.writer.writeError('passwd: passwords do not match');
            return;
        }

        await this.authService.setPassword(targetUser.id, newPassword);
        context.writer.writeSuccess('passwd: password updated successfully');
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer } = context;
        writer.writeln('Change a user password');
        writer.writeln();
        writer.writeln(
            `  ${writer.wrapInColor('passwd', CliForegroundColor.Cyan)}                Change own password`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('passwd <username>', CliForegroundColor.Cyan)}      Change another user\'s password (admin only)`,
        );
    }
}
