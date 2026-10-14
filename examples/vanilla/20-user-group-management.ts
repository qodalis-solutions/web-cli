/**
 * Example 20 — Using the users services from your own commands (Vanilla JS)
 *
 * The users module registers the same services in local and server mode, so
 * extensions can build on them without caring where users live:
 *   - ICliUsersStoreService   users (getUsers, createUser, updateUser, deleteUser)
 *   - ICliGroupsStoreService  groups/roles (createGroup, updateGroup, addMember, ...)
 *   - ICliSessionsService     list / revoke sessions
 *   - ICliAuditService        read the audit trail
 *   - ICliUserEventService    react to login, logout, user/group changes
 *   - ICliAuthorizationService (generic) current principal and permission checks
 *
 * All calls run as the signed-in user, so the backend enforces permissions:
 * a call the user may not make rejects with a CliUsersError (status 403).
 *
 * Try: onboard carol carol@example.com ; team-report
 *
 * Docs: https://qodalis-solutions.github.io/web-cli/docs/plugins/users
 */

import '@xterm/xterm/css/xterm.css';
import { CliEngine } from '@qodalis/cli';
import {
    ICliCommandProcessor,
    ICliGroupsStoreService,
    ICliGroupsStoreService_TOKEN,
    ICliModule,
    ICliSessionsService,
    ICliSessionsService_TOKEN,
    ICliUserEventService,
    ICliUserEventService_TOKEN,
    ICliUsersStoreService,
    ICliUsersStoreService_TOKEN,
} from '@qodalis/cli-core';
import { usersModule } from '@qodalis/cli-users';
import { firstValueFrom } from 'rxjs';

/** One command that creates a user, makes sure the team role exists and adds them to it */
const onboard: ICliCommandProcessor = {
    command: 'onboard',
    description: 'Create a user in the "team" role: onboard <name> <email>',
    acceptsRawInput: true,
    valueRequired: true,
    metadata: { requiredPermissions: ['users:create', 'groups:update'] },
    async processCommand(command, context) {
        const [name, email] = String(command.value).split(/\s+/);
        const users = context.services.getRequired<ICliUsersStoreService>(ICliUsersStoreService_TOKEN);
        const groups = context.services.getRequired<ICliGroupsStoreService>(ICliGroupsStoreService_TOKEN);

        if (!(await firstValueFrom(groups.getGroup('team')))) {
            await groups.createGroup('team', 'Product team', ['users:read', 'sessions:read']);
        }
        const user = await users.createUser({ name, email, groups: ['users'], homeDir: `/home/${name}` });
        await groups.addMember('team', user.name);
        context.writer.writeSuccess(`${name} onboarded (no password yet: run 'passwd ${name}')`);
    },
};

/** Who is in the team and who is online */
const teamReport: ICliCommandProcessor = {
    command: 'team-report',
    description: 'Team members and their active sessions',
    metadata: { requiredPermissions: ['groups:read', 'sessions:read'] },
    async processCommand(_command, context) {
        const groups = context.services.getRequired<ICliGroupsStoreService>(ICliGroupsStoreService_TOKEN);
        const sessions = context.services.getRequired<ICliSessionsService>(ICliSessionsService_TOKEN);
        const members = await firstValueFrom(groups.getGroupMembers('team'));
        const online = new Set((await sessions.list()).map((s) => s.userId));
        context.writer.writeTable(
            ['USER', 'EMAIL', 'ONLINE'],
            members.map((u) => [u.name, u.email, online.has(u.id) ? 'yes' : '']),
        );
    },
};

const teamModule: ICliModule = {
    apiVersion: 2,
    name: 'team',
    processors: [onboard, teamReport],
    async onAfterBoot(context) {
        // React to user lifecycle events from any mode
        context.services.get<ICliUserEventService>(ICliUserEventService_TOKEN)?.events$.subscribe((e) => {
            if (e.type === 'group_member_added') context.logger.info(`${e.user.name} joined ${e.details}`);
        });
    },
};

const engine = new CliEngine(document.getElementById('terminal')!);
engine.registerModules([
    usersModule.configure({
        seedUsers: [{ name: 'root', email: 'root@localhost', groups: ['admin'] }],
        defaultPassword: 'root',
    }),
    teamModule,
]);
engine.start().then(() => engine.focus());
