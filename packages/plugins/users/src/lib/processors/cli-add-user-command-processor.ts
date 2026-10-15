import { CliProcessCommand, ICliExecutionContext } from '@qodalis/cli-core';
import { firstValueFrom } from 'rxjs';
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
        { name: 'full-name', description: 'Full name (stored in the user data as fullName)', type: 'string' as const, required: false },
        { name: 'groups', description: 'Groups (roles), comma separated (default: users)', type: 'string' as const, required: false },
        { name: 'home', description: 'Home directory (default: /home/<name>)', type: 'string' as const, required: false },
        { name: 'disabled', description: 'Create the account disabled', type: 'boolean' as const, required: false },
        { name: 'no-password', description: 'Do not set a password now', type: 'boolean' as const, required: false },
    ];
    protected override usage: Array<[string, string]> = [
        ['adduser', 'Create a user step by step (name, email, full name, groups, home, status, password)'],
        ['adduser <name>', 'Same, with the name given'],
        ['adduser <name> --email=<email>', 'Non-interactive: only asks for the password'],
        ['  [--full-name="Jane Doe"] [--groups=dev,ops] [--home=/home/x]', 'Groups must exist; default group is "users"'],
        ['  [--disabled] [--no-password]', 'Create disabled / without a password'],
    ];

    override async processCommand(command: CliProcessCommand, context: ICliExecutionContext): Promise<void> {
        const { users, groups: groupsStore, auth } = usersServices(context);
        const a = command.args;
        // Without --email the command walks through every field, like Linux `adduser`.
        // With --email it stays scriptable: only the password is asked for.
        const interactive = !a['email'];

        const name = words(command)[0] ?? (await readValidated(context, 'Username: ', checkName));
        if (!name) return;
        const nameError = checkName(name);
        if (nameError) {
            context.writer.writeError(nameError);
            return;
        }
        const email = a['email'] || (await readValidated(context, 'Email: ', checkEmail));
        if (!email) return;

        let fullName: string | undefined = a['full-name'] ? String(a['full-name']).trim() : undefined;
        let groups = listArg(a['groups']);
        let homeDir: string = a['home'] || `/home/${name}`;
        let disabled = !!a['disabled'];

        if (interactive) {
            if (fullName === undefined) {
                const entered = await context.reader.readLine('Full name (optional): ');
                if (entered === null) return aborted(context);
                fullName = entered.trim() || undefined;
            }
            if (!groups) {
                const picked = await readGroups(context, () => firstValueFrom(groupsStore.getGroups()));
                if (picked === null) return aborted(context);
                groups = picked;
            }
            if (!a['home']) {
                const entered = await context.reader.readLine('Home directory: ', { default: homeDir });
                if (entered === null) return aborted(context);
                homeDir = entered.trim() || homeDir;
            }
            if (!a['disabled']) {
                const enabled = await context.reader.readConfirm('Enable the account now?', true);
                if (enabled === null) return aborted(context);
                disabled = !enabled;
            }
        }

        let password: string | undefined;
        if (!a['no-password']) {
            const entered = await readNewPassword(context, auth);
            if (entered === null) return;
            password = entered;
        }
        const user = await users.createUser({
            name,
            email,
            groups: groups ?? [],
            homeDir,
            disabled,
            password,
            ...(fullName ? { data: { fullName } } : {}),
        } as any);
        context.writer.writeSuccess(`User '${user.name}' created (groups: ${user.groups.join(', ') || '-'})`);
    }
}

/** Multi-select over the existing groups; typed names when the caller may not list groups. */
async function readGroups(
    context: ICliExecutionContext,
    loadGroups: () => Promise<{ name: string; description?: string }[]>,
): Promise<string[] | null> {
    const available = await loadGroups().catch(() => []);
    if (!available.length) {
        const typed = await context.reader.readLine('Groups, comma separated (Enter for "users"): ');
        return typed === null ? null : listArg(typed) ?? [];
    }
    return context.reader.readMultiSelect(
        'Groups',
        available.map((g) => ({
            label: g.description ? `${g.name} — ${g.description}` : g.name,
            value: g.name,
            checked: g.name === 'users',
        })),
    );
}

function aborted(context: ICliExecutionContext): void {
    context.writer.writeError('Aborted');
}

function checkName(value: string): string | null {
    if (!value) return 'A user name is required';
    return NAME_PATTERN.test(value) ? null : 'Invalid user name (letters, digits, ".", "_", "@", "-"; up to 64 characters)';
}

function checkEmail(value: string): string | null {
    if (!value) return 'An email address is required';
    return EMAIL_PATTERN.test(value) ? null : 'Invalid email format';
}
