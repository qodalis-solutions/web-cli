import { CliProcessCommand, ICliExecutionContext } from '@qodalis/cli-core';
import { CliUsersCommand, listArg, readNewPassword, readValidated, usersServices, words, USERS_METADATA } from './base';
import { CliProcessorMetadata } from '@qodalis/cli-core';
import { EMAIL_PATTERN, NAME_PATTERN } from '../backend/validation';

export class CliAddUserCommandProcessor extends CliUsersCommand {
    override command = 'adduser';
    override aliases = ['useradd'];
    override description = 'Create a user';
    override acceptsRawInput = true;
    override metadata: CliProcessorMetadata = { ...USERS_METADATA, requiredPermissions: ['users:create'] };
    override parameters = [
        {
            name: 'email', description: 'Email address (asked for when omitted)', type: 'string' as const, required: false,
            validator: (value: string) => (EMAIL_PATTERN.test(value) ? { valid: true } : { valid: false, message: 'Invalid email format' }),
        },
        { name: 'groups', description: 'Groups (roles), comma separated (default: users)', type: 'string' as const, required: false },
        { name: 'home', description: 'Home directory', type: 'string' as const, required: false },
        { name: 'disabled', description: 'Create the account disabled', type: 'boolean' as const, required: false },
        { name: 'no-password', description: 'Do not set a password now', type: 'boolean' as const, required: false },
    ];
    protected override usage: Array<[string, string]> = [
        ['adduser', 'Create a user interactively (asks for name, email, password)'],
        ['adduser <name> --email=<email>', 'Create a user (asks for a password)'],
        ['  [--groups=dev,ops] [--home=/home/x]', 'Groups must exist; default group is "users"'],
        ['  [--disabled] [--no-password]', 'Create disabled / without a password'],
    ];

    override async processCommand(command: CliProcessCommand, context: ICliExecutionContext): Promise<void> {
        const { users, auth } = usersServices(context);
        const name = words(command)[0] ?? (await readValidated(context, 'Username: ', checkName));
        if (!name) return;
        const nameError = checkName(name);
        if (nameError) {
            context.writer.writeError(nameError);
            return;
        }
        const email = command.args['email'] || (await readValidated(context, 'Email: ', checkEmail));
        if (!email) return;
        let password: string | undefined;
        if (!command.args['no-password']) {
            const entered = await readNewPassword(context, auth);
            if (entered === null) return;
            password = entered;
        }
        const user = await users.createUser({
            name,
            email,
            groups: listArg(command.args['groups']) ?? [],
            homeDir: command.args['home'] || `/home/${name}`,
            disabled: !!command.args['disabled'],
            password,
        } as any);
        context.writer.writeSuccess(`User '${user.name}' created (groups: ${user.groups.join(', ') || '-'})`);
    }
}

function checkName(value: string): string | null {
    if (!value) return 'A user name is required';
    return NAME_PATTERN.test(value) ? null : 'Invalid user name (letters, digits, ".", "_", "@", "-"; up to 64 characters)';
}

function checkEmail(value: string): string | null {
    if (!value) return 'An email address is required';
    return EMAIL_PATTERN.test(value) ? null : 'Invalid email format';
}
