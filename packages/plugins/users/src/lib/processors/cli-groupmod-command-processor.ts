import { CliProcessCommand, cliMergePermissions, ICliExecutionContext } from '@qodalis/cli-core';
import { firstValueFrom } from 'rxjs';
import { CliUsersCommand, listArg, usersServices, words, USERS_METADATA } from './base';
import { CliProcessorMetadata } from '@qodalis/cli-core';

export class CliGroupmodCommandProcessor extends CliUsersCommand {
    override command = 'groupmod';
    override description = 'Change a group: permissions, description, members';
    override acceptsRawInput = true;
    override valueRequired = true;
    override metadata: CliProcessorMetadata = { ...USERS_METADATA, requiredPermissions: ['groups:update'] };
    override parameters = [
        { name: 'grant', aliases: ['g'], description: 'Add permissions', type: 'string' as const, required: false },
        { name: 'revoke', aliases: ['r'], description: 'Remove permissions', type: 'string' as const, required: false },
        { name: 'set', description: 'Replace permissions ("" clears)', type: 'string' as const, required: false },
        { name: 'description', aliases: ['d'], description: 'New description', type: 'string' as const, required: false },
        { name: 'add-member', description: 'Add users, comma separated', type: 'string' as const, required: false },
        { name: 'remove-member', description: 'Remove users, comma separated', type: 'string' as const, required: false },
    ];
    protected override usage: Array<[string, string]> = [
        ['groupmod <group> --grant=users:read,audit:*', 'Grant permissions'],
        ['groupmod <group> --revoke=audit:*', 'Revoke permissions'],
        ['groupmod <group> --set=files:*', 'Replace permissions'],
        ['groupmod <group> --description="..."', 'Change description'],
        ['groupmod <group> --add-member=alice,bob', 'Add members'],
        ['groupmod <group> --remove-member=bob', 'Remove members'],
    ];

    override async processCommand(command: CliProcessCommand, context: ICliExecutionContext): Promise<void> {
        const { groups, registry } = usersServices(context);
        const [name] = words(command);
        const a = command.args;
        const group = await firstValueFrom(groups.getGroup(name));
        if (!group) {
            context.writer.writeError(`groupmod: group '${name}' does not exist`);
            context.process.exit(-1, { silent: true });
            return;
        }

        const updates: { description?: string; permissions?: string[] } = {};
        const description = a['description'] ?? a['d'];
        if (description !== undefined) updates.description = String(description);

        const set = a['set'] !== undefined ? listArg(a['set'] === true ? '' : a['set']) ?? [] : undefined;
        const grant = listArg(a['grant'] ?? a['g']) ?? [];
        const revoke = (listArg(a['revoke'] ?? a['r']) ?? []).map((p) => p.toLowerCase());
        if (set !== undefined || grant.length || revoke.length) {
            let permissions = cliMergePermissions(set ?? group.permissions ?? [], grant);
            permissions = permissions.filter((p) => !revoke.includes(p.toLowerCase()));
            updates.permissions = permissions;
            const unknown = [...(set ?? []), ...grant].filter((p) => p !== '*' && !p.endsWith(':*') && registry && !registry.get(p));
            if (unknown.length) {
                context.writer.writeWarning(`Not declared by any module (granted anyway): ${unknown.join(', ')}`);
            }
        }

        let changed = false;
        if (Object.keys(updates).length) {
            const updated = await groups.updateGroup(group.name, updates);
            context.writer.writeln(`${updated.name}: ${(updated.permissions ?? []).join(', ') || '(no permissions)'}`);
            changed = true;
        }
        for (const user of listArg(a['add-member']) ?? []) {
            await groups.addMember(group.name, user);
            context.writer.writeln(`added ${user} to ${group.name}`);
            changed = true;
        }
        for (const user of listArg(a['remove-member']) ?? []) {
            await groups.removeMember(group.name, user);
            context.writer.writeln(`removed ${user} from ${group.name}`);
            changed = true;
        }
        if (!changed) {
            context.writer.writeError('groupmod: no changes specified (see help groupmod)');
            context.process.exit(-1, { silent: true });
            return;
        }
        context.writer.writeSuccess(`Group '${group.name}' updated`);
    }
}
