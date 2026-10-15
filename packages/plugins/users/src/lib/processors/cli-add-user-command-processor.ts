import { CliProcessCommand, ICliExecutionContext } from '@qodalis/cli-core';
import { CliUsersCommand, listArg, readNewPassword, usersServices, words, USERS_METADATA } from './base';
import { CliProcessorMetadata } from '@qodalis/cli-core';
import { EMAIL_PATTERN } from '../backend/validation';

export class CliAddUserCommandProcessor extends CliUsersCommand {
    override command = 'adduser';
    override aliases = ['useradd'];
    override description = 'Create a user';
    override acceptsRawInput = true;
    override valueRequired = true;
    override metadata: CliProcessorMetadata = { ...USERS_METADATA, requiredPermissions: ['users:create'] };
    override parameters = [
        {
            name: 'email', description: 'Email address', type: 'string' as const, required: true,
            validator: (value: string) => (EMAIL_PATTERN.test(value) ? { valid: true } : { valid: false, message: 'Invalid email format' }),
        },
        { name: 'groups', description: 'Groups (roles), comma separated (default: users)', type: 'string' as const, required: false },
        { name: 'home', description: 'Home directory', type: 'string' as const, required: false },
        { name: 'disabled', description: 'Create the account disabled', type: 'boolean' as const, required: false },
        { name: 'no-password', description: 'Do not set a password now', type: 'boolean' as const, required: false },
    ];
    protected override usage: Array<[string, string]> = [
        ['adduser <name> --email=<email>', 'Create a user (asks for a password)'],
        ['  [--groups=dev,ops] [--home=/home/x]', 'Groups must exist; default group is "users"'],
        ['  [--disabled] [--no-password]', 'Create disabled / without a password'],
    ];

    override async processCommand(command: CliProcessCommand, context: ICliExecutionContext): Promise<void> {
        const { users, auth } = usersServices(context);
        const [name] = words(command);
        let password: string | undefined;
        if (!command.args['no-password']) {
            const entered = await readNewPassword(context, auth);
            if (entered === null) return;
            password = entered;
        }
        const user = await users.createUser({
            name,
            email: command.args['email'],
            groups: listArg(command.args['groups']) ?? [],
            homeDir: command.args['home'] || `/home/${name}`,
            disabled: !!command.args['disabled'],
            password,
        } as any);
        context.writer.writeSuccess(`User '${user.name}' created (groups: ${user.groups.join(', ') || '-'})`);
    }
}
