import { CliTestHarness } from '@qodalis/cli';
import {
    ICliKeyValueStore,
    ICliUsersStoreService_TOKEN,
    ICliGroupsStoreService_TOKEN,
    ICliAuthService_TOKEN,
    ICliUserSessionService_TOKEN,
    ICliPermissionService_TOKEN,
    ICliUserSession,
    ICliUser,
} from '@qodalis/cli-core';
import { firstValueFrom } from 'rxjs';

import {
    CliDefaultUsersStoreService,
    CliDefaultUserSessionService,
    CliDefaultGroupsStoreService,
    CliDefaultAuthService,
    CliDefaultPermissionService,
} from '../lib/services';

import { CliWhoamiCommandProcessor } from '../lib/processors/cli-whoami-command-processor';
import { CliIdCommandProcessor } from '../lib/processors/cli-id-command-processor';
import { CliGroupsCommandProcessor } from '../lib/processors/cli-groups-command-processor';
import { CliListUsersCommandProcessor } from '../lib/processors/cli-list-users-command-processor';
import { CliAddUserCommandProcessor } from '../lib/processors/cli-add-user-command-processor';
import { CliUserdelCommandProcessor } from '../lib/processors/cli-userdel-command-processor';
import { CliUsermodCommandProcessor } from '../lib/processors/cli-usermod-command-processor';
import { CliGroupaddCommandProcessor } from '../lib/processors/cli-groupadd-command-processor';
import { CliGroupdelCommandProcessor } from '../lib/processors/cli-groupdel-command-processor';
import { CliWhoCommandProcessor } from '../lib/processors/cli-who-command-processor';

// ---------------------------------------------------------------------------
// Setup helper
// ---------------------------------------------------------------------------

async function setupHarness(): Promise<{
    harness: CliTestHarness;
    usersStore: CliDefaultUsersStoreService;
    sessionService: CliDefaultUserSessionService;
    authService: CliDefaultAuthService;
    groupsStore: CliDefaultGroupsStoreService;
    adminUser: ICliUser;
}> {
    const harness = new CliTestHarness();

    // Get the in-memory KV store already created by the harness
    const kvStore = harness.services.get<ICliKeyValueStore>('cli-key-value-store');

    // Create and initialize services
    const usersStore = new CliDefaultUsersStoreService();
    await usersStore.initialize(kvStore);

    const sessionService = new CliDefaultUserSessionService();
    await sessionService.initialize(kvStore);

    const authService = new CliDefaultAuthService();
    await authService.initialize(kvStore, usersStore, sessionService);

    const groupsStore = new CliDefaultGroupsStoreService();
    await groupsStore.initialize(kvStore, usersStore);

    const permissionService = new CliDefaultPermissionService();

    // Register services
    harness.registerService(ICliUsersStoreService_TOKEN, usersStore);
    harness.registerService(ICliUserSessionService_TOKEN, sessionService);
    harness.registerService(ICliAuthService_TOKEN, authService);
    harness.registerService(ICliGroupsStoreService_TOKEN, groupsStore);
    harness.registerService(ICliPermissionService_TOKEN, permissionService);

    // Create an admin user
    const adminUser = await usersStore.createUser({
        name: 'root',
        email: 'root@localhost',
        groups: ['admin'],
        homeDir: '/home/root',
    });

    await authService.setPassword(adminUser.id, 'password');

    // Set admin session
    const session: ICliUserSession = {
        user: adminUser,
        loginTime: Date.now(),
        lastActivity: Date.now(),
    };
    harness.setUserSession(session);

    // Register processors
    harness.registerProcessors([
        new CliWhoamiCommandProcessor(),
        new CliIdCommandProcessor(),
        new CliGroupsCommandProcessor(),
        new CliListUsersCommandProcessor(),
        new CliAddUserCommandProcessor(),
        new CliUserdelCommandProcessor(),
        new CliUsermodCommandProcessor(),
        new CliGroupaddCommandProcessor(),
        new CliGroupdelCommandProcessor(),
        new CliWhoCommandProcessor(),
    ]);

    // Initialize processors (injects services via initialize())
    await harness.initializeProcessors();

    return { harness, usersStore, sessionService, authService, groupsStore, adminUser };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Users plugin integration: identity commands', () => {
    let harness: CliTestHarness;
    let adminUser: ICliUser;

    beforeEach(async () => {
        ({ harness, adminUser } = await setupHarness());
    });

    it('whoami should display current user email', async () => {
        const result = await harness.execute('whoami');
        expect(result.output).toContain('root@localhost');
    });

    it('id should display user identity', async () => {
        const result = await harness.execute('id');
        expect(result.output).toContain('name=root');
        expect(result.output).toContain('groups=admin');
    });

    it('id <username> should show specific user', async () => {
        const result = await harness.execute('id root');
        expect(result.output).toContain('name=root');
    });

    it('id <nonexistent> should error', async () => {
        const result = await harness.execute('id nobody');
        expect(result.stderr.some(l => l.includes('no such user'))).toBe(true);
    });

    it('groups should show current user groups', async () => {
        const result = await harness.execute('groups');
        expect(result.output).toContain('root : admin');
    });
});

describe('Users plugin integration: user management', () => {
    let harness: CliTestHarness;
    let usersStore: CliDefaultUsersStoreService;

    beforeEach(async () => {
        ({ harness, usersStore } = await setupHarness());
    });

    it('adduser should create a new user (with password prompts)', async () => {
        // Queue password responses
        harness.setReaderResponses('secret123', 'secret123');

        await harness.execute('adduser John --email=john@example.com --groups=dev');

        const users = await firstValueFrom(usersStore.getUsers());
        const john = users.find(u => u.name === 'John');
        expect(john).toBeDefined();
        expect(john!.email).toBe('john@example.com');
        expect(john!.groups).toContain('dev');
    });

    it('adduser should reject mismatched passwords', async () => {
        harness.setReaderResponses('pass1', 'pass2');

        const result = await harness.execute('adduser MissMatch --email=mm@test.com');
        expect(result.stderr.some(l => l.includes('passwords do not match'))).toBe(true);

        const users = await firstValueFrom(usersStore.getUsers());
        expect(users.find(u => u.name === 'MissMatch')).toBeUndefined();
    });

    it('adduser should fail without admin permissions', async () => {
        // Switch to a non-admin session
        harness.setUserSession({
            user: {
                id: 'user-1',
                name: 'regular',
                email: 'regular@test.com',
                groups: [],
                createdAt: Date.now(),
                updatedAt: Date.now(),
            },
            loginTime: Date.now(),
            lastActivity: Date.now(),
        });

        const result = await harness.execute('adduser Blocked --email=b@test.com');
        expect(result.stderr.some(l => l.includes('permission denied'))).toBe(true);
    });

    it('listusers should show all users', async () => {
        const result = await harness.execute('listusers');
        expect(result.output).toContain('root');
        expect(result.output).toContain('root@localhost');
    });

    it('userdel should delete a user', async () => {
        // First create a user to delete
        harness.setReaderResponses('pass', 'pass');
        await harness.execute('adduser ToDelete --email=del@test.com');

        let users = await firstValueFrom(usersStore.getUsers());
        expect(users.find(u => u.name === 'ToDelete')).toBeDefined();

        await harness.execute('userdel ToDelete');

        users = await firstValueFrom(usersStore.getUsers());
        expect(users.find(u => u.name === 'ToDelete')).toBeUndefined();
    });

    it('usermod should modify a user', async () => {
        // Create a user first
        harness.setReaderResponses('pass', 'pass');
        await harness.execute('adduser Modifiable --email=mod@test.com');

        await harness.execute('usermod Modifiable --email=new@test.com');

        const users = await firstValueFrom(usersStore.getUsers());
        const user = users.find(u => u.name === 'Modifiable');
        expect(user!.email).toBe('new@test.com');
    });
});

describe('Users plugin integration: group management', () => {
    let harness: CliTestHarness;
    let groupsStore: CliDefaultGroupsStoreService;

    beforeEach(async () => {
        ({ harness, groupsStore } = await setupHarness());
    });

    it('groupadd should create a new group', async () => {
        const result = await harness.execute('groupadd developers');
        expect(result.output).toContain("group 'developers' created");

        const groups = await firstValueFrom(groupsStore.getGroups());
        expect(groups.find(g => g.name === 'developers')).toBeDefined();
    });

    it('groupadd should fail for duplicate group', async () => {
        await harness.execute('groupadd mygroup');
        const result = await harness.execute('groupadd mygroup');
        expect(result.stderr.some(l => l.includes('already exists'))).toBe(true);
    });

    it('groupdel should delete a group', async () => {
        await harness.execute('groupadd tempgroup');
        await harness.execute('groupdel tempgroup --force');

        const groups = await firstValueFrom(groupsStore.getGroups());
        expect(groups.find(g => g.name === 'tempgroup')).toBeUndefined();
    });

    it('groupdel should refuse to delete admin group', async () => {
        const result = await harness.execute('groupdel admin --force');
        expect(result.stderr.some(l => l.includes('cannot delete'))).toBe(true);
    });

    it('groupadd should fail without admin permissions', async () => {
        harness.setUserSession({
            user: {
                id: 'user-1',
                name: 'regular',
                email: 'regular@test.com',
                groups: [],
                createdAt: Date.now(),
                updatedAt: Date.now(),
            },
            loginTime: Date.now(),
            lastActivity: Date.now(),
        });

        const result = await harness.execute('groupadd forbidden');
        expect(result.stderr.some(l => l.includes('permission denied'))).toBe(true);
    });
});
