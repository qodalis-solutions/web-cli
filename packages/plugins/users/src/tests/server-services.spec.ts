import { ICliHttpClient, ICliKeyValueStore, ICliUserSessionService, ICliExecutionContext, CliProcessCommand } from '@qodalis/cli-core';
import { firstValueFrom } from 'rxjs';

import { CliServerUsersStoreService } from '../lib/services/cli-server-users-store.service';
import { CliServerGroupsStoreService } from '../lib/services/cli-server-groups-store.service';
import { CliServerUserSessionService } from '../lib/services/cli-server-user-session.service';
import { CliServerAuthService } from '../lib/services/cli-server-auth.service';
import { CliSessionsCommandProcessor } from '../lib/processors/cli-sessions-command-processor';
import { CliSessionKickCommandProcessor } from '../lib/processors/cli-session-kick-command-processor';

// ── Mocks ───────────────────────────────────────────────────────────

class MockKeyValueStore implements ICliKeyValueStore {
    private store = new Map<string, any>();

    async get<T>(key: string): Promise<T | undefined> {
        return this.store.get(key) as T;
    }

    async set(key: string, value: any): Promise<void> {
        this.store.set(key, value);
    }

    async remove(key: string): Promise<void> {
        this.store.delete(key);
    }

    async clear(): Promise<void> {
        this.store.clear();
    }
}

function createMockHttp(responses: Record<string, any> = {}): ICliHttpClient {
    const resolve = (url: string, method: string) => {
        const key = `${method} ${url}`;
        if (key in responses) return responses[key];
        // Fall back to url-only match
        if (url in responses) return responses[url];
        throw new Error(`Mock HTTP: no response for ${method} ${url}`);
    };

    return {
        fetch: jasmine.createSpy('fetch'),
        get: jasmine.createSpy('get').and.callFake(
            (url: string) => Promise.resolve(resolve(url, 'GET')),
        ),
        post: jasmine.createSpy('post').and.callFake(
            (url: string) => Promise.resolve(resolve(url, 'POST')),
        ),
        put: jasmine.createSpy('put').and.callFake(
            (url: string) => Promise.resolve(resolve(url, 'PUT')),
        ),
        patch: jasmine.createSpy('patch').and.callFake(
            (url: string) => Promise.resolve(resolve(url, 'PATCH')),
        ),
        delete: jasmine.createSpy('delete').and.callFake(
            (url: string) => Promise.resolve(resolve(url, 'DELETE')),
        ),
        head: jasmine.createSpy('head'),
        options: jasmine.createSpy('options'),
    };
}

const BASE_URL = 'http://localhost:8047/api/v1/qcli';

// ── CliServerUsersStoreService ──────────────────────────────────────

describe('CliServerUsersStoreService', () => {
    const mockUser = {
        id: 'u1',
        name: 'alice',
        email: 'alice@test.com',
        groups: ['admin'],
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };

    it('should fetch users via GET /users', async () => {
        const http = createMockHttp({
            [`GET ${BASE_URL}/users`]: [mockUser],
        });
        const service = new CliServerUsersStoreService(BASE_URL, http, () => ({}));

        const users = await firstValueFrom(service.getUsers());
        expect(users.length).toBe(1);
        expect(users[0].name).toBe('alice');
        expect(http.get).toHaveBeenCalled();
    });

    it('should pass query params to GET /users', async () => {
        const http = createMockHttp();
        (http.get as jasmine.Spy).and.returnValue(Promise.resolve([]));

        const service = new CliServerUsersStoreService(BASE_URL, http, () => ({}));
        await firstValueFrom(service.getUsers({ query: 'alice', skip: 0, take: 10 }));

        const url = (http.get as jasmine.Spy).calls.first().args[0];
        expect(url).toContain('query=alice');
        expect(url).toContain('skip=0');
        expect(url).toContain('take=10');
    });

    it('should fetch a single user via GET /users/:id', async () => {
        const http = createMockHttp({
            [`GET ${BASE_URL}/users/u1`]: mockUser,
        });
        const service = new CliServerUsersStoreService(BASE_URL, http, () => ({}));

        const user = await firstValueFrom(service.getUser('u1'));
        expect(user).toBeDefined();
        expect(user!.name).toBe('alice');
    });

    it('should return undefined for missing user', async () => {
        const http = createMockHttp();
        (http.get as jasmine.Spy).and.returnValue(Promise.reject(new Error('404')));

        const service = new CliServerUsersStoreService(BASE_URL, http, () => ({}));
        const user = await firstValueFrom(service.getUser('nonexistent'));
        expect(user).toBeUndefined();
    });

    it('should create a user via POST /users', async () => {
        const http = createMockHttp({
            [`POST ${BASE_URL}/users`]: mockUser,
        });
        const service = new CliServerUsersStoreService(BASE_URL, http, () => ({}));

        const created = await service.createUser({
            name: 'alice',
            email: 'alice@test.com',
            groups: ['admin'],
        });
        expect(created.id).toBe('u1');
        expect(http.post).toHaveBeenCalled();
    });

    it('should update a user via PUT /users/:id', async () => {
        const updated = { ...mockUser, email: 'alice2@test.com' };
        const http = createMockHttp({
            [`PUT ${BASE_URL}/users/u1`]: updated,
        });
        const service = new CliServerUsersStoreService(BASE_URL, http, () => ({}));

        const result = await service.updateUser('u1', { email: 'alice2@test.com' });
        expect(result.email).toBe('alice2@test.com');
    });

    it('should delete a user via DELETE /users/:id', async () => {
        const http = createMockHttp({
            [`DELETE ${BASE_URL}/users/u1`]: undefined,
        });
        const service = new CliServerUsersStoreService(BASE_URL, http, () => ({}));

        await expectAsync(service.deleteUser('u1')).toBeResolved();
        expect(http.delete).toHaveBeenCalled();
    });

    it('should include auth headers from getHeaders', async () => {
        const http = createMockHttp();
        (http.get as jasmine.Spy).and.returnValue(Promise.resolve([]));

        const headers = () => ({ Authorization: 'Bearer test-token' });
        const service = new CliServerUsersStoreService(BASE_URL, http, headers);

        await firstValueFrom(service.getUsers());
        const opts = (http.get as jasmine.Spy).calls.first().args[1];
        expect(opts.headers.Authorization).toBe('Bearer test-token');
    });
});

// ── CliServerGroupsStoreService ─────────────────────────────────────

describe('CliServerGroupsStoreService', () => {
    const mockGroup = {
        id: 'admin',
        name: 'admin',
        description: 'Administrators',
        createdAt: Date.now(),
    };

    it('should fetch groups via GET /groups', async () => {
        const http = createMockHttp({
            [`GET ${BASE_URL}/groups`]: [mockGroup],
        });
        const service = new CliServerGroupsStoreService(BASE_URL, http, () => ({}));

        const groups = await firstValueFrom(service.getGroups());
        expect(groups.length).toBe(1);
        expect(groups[0].name).toBe('admin');
    });

    it('should fetch a single group via GET /groups/:id', async () => {
        const http = createMockHttp({
            [`GET ${BASE_URL}/groups/admin`]: mockGroup,
        });
        const service = new CliServerGroupsStoreService(BASE_URL, http, () => ({}));

        const group = await firstValueFrom(service.getGroup('admin'));
        expect(group).toBeDefined();
        expect(group!.name).toBe('admin');
    });

    it('should create a group via POST /groups', async () => {
        const http = createMockHttp({
            [`POST ${BASE_URL}/groups`]: mockGroup,
        });
        const service = new CliServerGroupsStoreService(BASE_URL, http, () => ({}));

        const group = await service.createGroup('admin', 'Administrators');
        expect(group.name).toBe('admin');
    });

    it('should delete a group via DELETE /groups/:id', async () => {
        const http = createMockHttp({
            [`DELETE ${BASE_URL}/groups/admin`]: undefined,
        });
        const service = new CliServerGroupsStoreService(BASE_URL, http, () => ({}));

        await expectAsync(service.deleteGroup('admin')).toBeResolved();
    });

    it('should fetch group members via GET /groups/:id/members', async () => {
        const mockUser = {
            id: 'u1', name: 'alice', email: 'a@b.com',
            groups: ['admin'], createdAt: 0, updatedAt: 0,
        };
        const http = createMockHttp({
            [`GET ${BASE_URL}/groups/admin/members`]: [mockUser],
        });
        const service = new CliServerGroupsStoreService(BASE_URL, http, () => ({}));

        const members = await firstValueFrom(service.getGroupMembers('admin'));
        expect(members.length).toBe(1);
        expect(members[0].name).toBe('alice');
    });
});

// ── CliServerUserSessionService ─────────────────────────────────────

describe('CliServerUserSessionService', () => {
    let kvStore: MockKeyValueStore;

    beforeEach(() => {
        kvStore = new MockKeyValueStore();
    });

    it('should start with undefined session', async () => {
        const http = createMockHttp();
        const service = new CliServerUserSessionService(BASE_URL, http, kvStore);

        const session = await firstValueFrom(service.getUserSession());
        expect(session).toBeUndefined();
    });

    it('should set and get session', async () => {
        const http = createMockHttp();
        const service = new CliServerUserSessionService(BASE_URL, http, kvStore);
        const mockSession = {
            user: { id: 'u1', name: 'alice', email: 'a@b.com', groups: [], createdAt: 0, updatedAt: 0 },
            loginTime: Date.now(),
            lastActivity: Date.now(),
        };

        await service.setUserSession(mockSession);
        const session = await firstValueFrom(service.getUserSession());
        expect(session).toBeDefined();
        expect(session!.user.name).toBe('alice');
    });

    it('should clear session and remove token from store', async () => {
        const http = createMockHttp();
        const service = new CliServerUserSessionService(BASE_URL, http, kvStore);
        await kvStore.set('cli-server-auth-token', 'some-token');

        await service.clearSession();
        const session = await firstValueFrom(service.getUserSession());
        expect(session).toBeUndefined();

        const token = await kvStore.get('cli-server-auth-token');
        expect(token).toBeUndefined();
    });

    it('should restore session from server when token exists', async () => {
        await kvStore.set('cli-server-auth-token', 'valid-token');

        const serverSession = {
            user: { id: 'u1', name: 'alice', email: 'a@b.com', groups: [], createdAt: 0, updatedAt: 0 },
            loginTime: 1000,
            lastActivity: 2000,
        };
        const http = createMockHttp({
            [`GET ${BASE_URL}/sessions/current`]: serverSession,
        });
        const service = new CliServerUserSessionService(BASE_URL, http, kvStore);

        const restored = await service.restoreSession();
        expect(restored).toBeDefined();
        expect(restored!.user.name).toBe('alice');
    });

    it('should return undefined and clear token when restore fails', async () => {
        await kvStore.set('cli-server-auth-token', 'expired-token');

        const http = createMockHttp();
        (http.get as jasmine.Spy).and.returnValue(Promise.reject(new Error('401')));

        const service = new CliServerUserSessionService(BASE_URL, http, kvStore);
        const restored = await service.restoreSession();

        expect(restored).toBeUndefined();
        const token = await kvStore.get('cli-server-auth-token');
        expect(token).toBeUndefined();
    });

    it('should return undefined when no token exists', async () => {
        const http = createMockHttp();
        const service = new CliServerUserSessionService(BASE_URL, http, kvStore);

        const restored = await service.restoreSession();
        expect(restored).toBeUndefined();
    });

    it('persistSession should be a no-op', async () => {
        const http = createMockHttp();
        const service = new CliServerUserSessionService(BASE_URL, http, kvStore);

        await expectAsync(service.persistSession()).toBeResolved();
    });
});

// ── CliServerAuthService ────────────────────────────────────────────

describe('CliServerAuthService', () => {
    let kvStore: MockKeyValueStore;
    let tokenChanges: (string | undefined)[];
    let mockSessionService: ICliUserSessionService;
    let lastSession: any;

    beforeEach(() => {
        kvStore = new MockKeyValueStore();
        tokenChanges = [];
        lastSession = undefined;
        mockSessionService = {
            getUserSession: jasmine.createSpy('getUserSession'),
            setUserSession: jasmine.createSpy('setUserSession').and.callFake(
                async (s: any) => { lastSession = s; },
            ),
            clearSession: jasmine.createSpy('clearSession').and.callFake(
                async () => { lastSession = undefined; },
            ),
            persistSession: jasmine.createSpy('persistSession'),
            restoreSession: jasmine.createSpy('restoreSession'),
        };
    });

    function createAuthService(http: ICliHttpClient): CliServerAuthService {
        return new CliServerAuthService(
            BASE_URL, http, kvStore, mockSessionService,
            (token) => { tokenChanges.push(token); },
        );
    }

    it('should login and store token', async () => {
        const loginResponse = {
            token: 'jwt-123',
            session: {
                user: { id: 'u1', name: 'alice', email: 'a@b.com', groups: [], createdAt: 0, updatedAt: 0 },
                loginTime: 1000,
            },
        };
        const http = createMockHttp({
            [`POST ${BASE_URL}/sessions`]: loginResponse,
        });
        const service = createAuthService(http);

        const session = await service.login('alice', 'pass');
        expect(session.user.name).toBe('alice');
        expect(tokenChanges).toContain('jwt-123');

        const storedToken = await kvStore.get('cli-server-auth-token');
        expect(storedToken).toBe('jwt-123');
    });

    it('should logout and clear token', async () => {
        const http = createMockHttp({
            [`DELETE ${BASE_URL}/sessions/current`]: {},
        });
        const service = createAuthService(http);

        // Simulate having a token
        await kvStore.set('cli-server-auth-token', 'jwt-123');
        await service.initialize();

        await service.logout();
        expect(mockSessionService.clearSession).toHaveBeenCalled();

        const storedToken = await kvStore.get('cli-server-auth-token');
        expect(storedToken).toBeUndefined();
        expect(tokenChanges[tokenChanges.length - 1]).toBeUndefined();
    });

    it('should verify password via POST /users/:id/verify-password', async () => {
        const http = createMockHttp({
            [`POST ${BASE_URL}/users/u1/verify-password`]: { valid: true },
        });
        const service = createAuthService(http);

        const result = await service.verifyPassword('u1', 'correct');
        expect(result).toBeTrue();
        expect((http.post as jasmine.Spy).calls.mostRecent().args[1]).toEqual({ password: 'correct' });
    });

    it('should logout via DELETE /sessions/current', async () => {
        const http = createMockHttp({
            [`DELETE ${BASE_URL}/sessions/current`]: undefined,
        });
        const service = createAuthService(http);
        await kvStore.set('cli-server-auth-token', 'jwt-123');
        await service.initialize();

        await service.logout();

        expect(http.delete).toHaveBeenCalledWith(
            `${BASE_URL}/sessions/current`,
            { headers: { Authorization: 'Bearer jwt-123' } },
        );
        expect(http.post).not.toHaveBeenCalled();
    });

    it('should return false when verify fails', async () => {
        const http = createMockHttp();
        (http.post as jasmine.Spy).and.returnValue(Promise.reject(new Error('401')));

        const service = createAuthService(http);
        const result = await service.verifyPassword('u1', 'wrong');
        expect(result).toBeFalse();
    });

    it('should set password via PUT /users/:id/password', async () => {
        const http = createMockHttp({
            [`PUT ${BASE_URL}/users/u1/password`]: {},
        });
        const service = createAuthService(http);

        await expectAsync(service.setPassword('u1', 'newpass')).toBeResolved();
        expect((http.put as jasmine.Spy).calls.mostRecent().args[1]).toEqual({ newPassword: 'newpass' });
    });

    it('should forward currentPassword when changing own password', async () => {
        const http = createMockHttp({
            [`PUT ${BASE_URL}/users/u1/password`]: {},
        });
        const service = createAuthService(http);

        await service.setPassword('u1', 'newpass', 'oldpass');

        expect((http.put as jasmine.Spy).calls.mostRecent().args[1]).toEqual({
            newPassword: 'newpass',
            currentPassword: 'oldpass',
        });
    });

    it('should initialize and restore token from kvStore', async () => {
        await kvStore.set('cli-server-auth-token', 'stored-token');

        const http = createMockHttp();
        const service = createAuthService(http);

        await service.initialize();
        expect(tokenChanges).toContain('stored-token');
    });

    it('hashPassword should return the password as-is', async () => {
        const http = createMockHttp();
        const service = createAuthService(http);

        const result = await service.hashPassword('mypass', 'salt');
        expect(result).toBe('mypass');
    });

    it('validatePassword should return null', () => {
        const http = createMockHttp();
        const service = createAuthService(http);

        expect(service.validatePassword('any')).toBeNull();
    });

    it('should handle login HTTP failure', async () => {
        const http = createMockHttp();
        (http.post as jasmine.Spy).and.returnValue(
            Promise.reject(new Error('500 Internal Server Error')),
        );
        const service = createAuthService(http);

        await expectAsync(service.login('alice', 'pass')).toBeRejectedWithError(
            '500 Internal Server Error',
        );
    });

    it('should handle logout server error silently', async () => {
        const http = createMockHttp();
        (http.post as jasmine.Spy).and.returnValue(
            Promise.reject(new Error('Network error')),
        );
        const service = createAuthService(http);

        // Should not throw — the catch block absorbs the error
        await expectAsync(service.logout()).toBeResolved();
        expect(mockSessionService.clearSession).toHaveBeenCalled();
        expect(tokenChanges[tokenChanges.length - 1]).toBeUndefined();
    });

    it('should initialize with no stored token without calling onTokenChange', async () => {
        // kvStore is empty — no token stored
        const http = createMockHttp();
        const service = createAuthService(http);

        await service.initialize();
        // onTokenChange should NOT have been called (no token to restore)
        expect(tokenChanges.length).toBe(0);
    });
});

// ── CliServerGroupsStoreService — error paths ─────────────────────

describe('CliServerGroupsStoreService (error paths)', () => {
    it('should return undefined when getGroup HTTP call rejects', async () => {
        const http = createMockHttp();
        (http.get as jasmine.Spy).and.returnValue(
            Promise.reject(new Error('404 Not Found')),
        );
        const service = new CliServerGroupsStoreService(BASE_URL, http, () => ({}));

        const group = await firstValueFrom(service.getGroup('nonexistent'));
        expect(group).toBeUndefined();
    });
});

// ── Mock execution context helper ──────────────────────────────────

function createMockContext(httpClient: ICliHttpClient): {
    context: ICliExecutionContext;
    written: { info: string[]; error: string[]; success: string[]; tables: any[][] };
} {
    const written = {
        info: [] as string[],
        error: [] as string[],
        success: [] as string[],
        tables: [] as any[][],
    };

    const writer: any = {
        writeInfo: jasmine.createSpy('writeInfo').and.callFake((msg: string) => written.info.push(msg)),
        writeError: jasmine.createSpy('writeError').and.callFake((msg: string) => written.error.push(msg)),
        writeSuccess: jasmine.createSpy('writeSuccess').and.callFake((msg: string) => written.success.push(msg)),
        writeObjectsAsTable: jasmine.createSpy('writeObjectsAsTable').and.callFake((rows: any[]) => written.tables.push(rows)),
        writeln: jasmine.createSpy('writeln'),
        wrapInColor: jasmine.createSpy('wrapInColor').and.callFake((text: string) => text),
    };

    const context = {
        writer,
        http: httpClient,
    } as unknown as ICliExecutionContext;

    return { context, written };
}

// ── CliSessionsCommandProcessor ────────────────────────────────────

describe('CliSessionsCommandProcessor', () => {
    const getHeaders = () => ({ Authorization: 'Bearer tok' });

    it('should display sessions as a table when sessions exist', async () => {
        const sessions = [
            {
                id: 'abcdefgh-1234',
                user: { name: 'alice' },
                loginTime: 1700000000000,
                lastActivity: 1700000060000,
            },
            {
                id: 'ijklmnop-5678',
                userId: 'bob-id',
                loginTime: 1700000000000,
                lastActivity: 1700000120000,
            },
        ];
        const http = createMockHttp({
            [`GET ${BASE_URL}/sessions`]: sessions,
        });
        const processor = new CliSessionsCommandProcessor(BASE_URL, getHeaders);
        const { context, written } = createMockContext(http);
        const command: CliProcessCommand = { command: 'sessions', rawCommand: 'sessions' } as any;

        await processor.processCommand(command, context);

        expect(written.tables.length).toBe(1);
        expect(written.tables[0].length).toBe(2);
        expect(written.tables[0][0]['USER']).toBe('alice');
        expect(written.tables[0][1]['USER']).toBe('bob-id');
        expect(written.tables[0][0]['ID']).toBe('abcdefgh-1234'); // full id, so it can be passed to session-kick
    });

    it('should display info message when no sessions', async () => {
        const http = createMockHttp({
            [`GET ${BASE_URL}/sessions`]: [],
        });
        const processor = new CliSessionsCommandProcessor(BASE_URL, getHeaders);
        const { context, written } = createMockContext(http);
        const command: CliProcessCommand = { command: 'sessions', rawCommand: 'sessions' } as any;

        await processor.processCommand(command, context);

        expect(written.info.length).toBe(1);
        expect(written.info[0]).toBe('No active sessions');
        expect(written.tables.length).toBe(0);
    });

    it('should display error on HTTP failure', async () => {
        const http = createMockHttp();
        (http.get as jasmine.Spy).and.returnValue(
            Promise.reject(new Error('Connection refused')),
        );
        const processor = new CliSessionsCommandProcessor(BASE_URL, getHeaders);
        const { context, written } = createMockContext(http);
        const command: CliProcessCommand = { command: 'sessions', rawCommand: 'sessions' } as any;

        await processor.processCommand(command, context);

        expect(written.error.length).toBe(1);
        expect(written.error[0]).toBe('Connection refused');
    });

    it('should have correct metadata', () => {
        const processor = new CliSessionsCommandProcessor(BASE_URL, getHeaders);
        expect(processor.command).toBe('sessions');
        expect(processor.metadata?.sealed).toBe(true);
        expect(processor.metadata?.module).toBe('users');
    });
});

// ── CliSessionKickCommandProcessor ─────────────────────────────────

describe('CliSessionKickCommandProcessor', () => {
    const getHeaders = () => ({ Authorization: 'Bearer tok' });

    it('should kick a session successfully', async () => {
        const http = createMockHttp({
            [`DELETE ${BASE_URL}/sessions/sess-123`]: undefined,
        });
        const processor = new CliSessionKickCommandProcessor(BASE_URL, getHeaders);
        const { context, written } = createMockContext(http);
        const command: CliProcessCommand = {
            command: 'session-kick',
            value: 'sess-123',
            rawCommand: 'session-kick sess-123',
        } as any;

        await processor.processCommand(command, context);

        expect(written.success.length).toBe(1);
        expect(written.success[0]).toBe('Session sess-123 terminated');
        expect(http.delete).toHaveBeenCalled();
    });

    it('should display error when no session ID is provided', async () => {
        const http = createMockHttp();
        const processor = new CliSessionKickCommandProcessor(BASE_URL, getHeaders);
        const { context, written } = createMockContext(http);
        const command: CliProcessCommand = {
            command: 'session-kick',
            value: '',
            rawCommand: 'session-kick',
        } as any;

        await processor.processCommand(command, context);

        expect(written.error.length).toBe(1);
        expect(written.error[0]).toBe('Usage: session-kick <session-id>');
        expect(http.delete).not.toHaveBeenCalled();
    });

    it('should display error when value is undefined', async () => {
        const http = createMockHttp();
        const processor = new CliSessionKickCommandProcessor(BASE_URL, getHeaders);
        const { context, written } = createMockContext(http);
        const command: CliProcessCommand = {
            command: 'session-kick',
            value: undefined,
            rawCommand: 'session-kick',
        } as any;

        await processor.processCommand(command, context);

        expect(written.error.length).toBe(1);
        expect(written.error[0]).toBe('Usage: session-kick <session-id>');
    });

    it('should display error on HTTP failure during kick', async () => {
        const http = createMockHttp();
        (http.delete as jasmine.Spy).and.returnValue(
            Promise.reject(new Error('Forbidden')),
        );
        const processor = new CliSessionKickCommandProcessor(BASE_URL, getHeaders);
        const { context, written } = createMockContext(http);
        const command: CliProcessCommand = {
            command: 'session-kick',
            value: 'sess-999',
            rawCommand: 'session-kick sess-999',
        } as any;

        await processor.processCommand(command, context);

        expect(written.error.length).toBe(1);
        expect(written.error[0]).toBe('Forbidden');
    });

    it('should have correct metadata', () => {
        const processor = new CliSessionKickCommandProcessor(BASE_URL, getHeaders);
        expect(processor.command).toBe('session-kick');
        expect(processor.valueRequired).toBe(true);
        expect(processor.metadata?.sealed).toBe(true);
        expect(processor.metadata?.module).toBe('users');
    });
});

// ── Session id tracking and user events (server mode) ──────────────

describe('CliServerUserSessionService (session id)', () => {
    it('exposes the server session id after restore', async () => {
        const kvStore = new MockKeyValueStore();
        await kvStore.set('cli-server-auth-token', 'tok');
        const http = createMockHttp({
            [`GET ${BASE_URL}/sessions/current`]: {
                id: 'sess-42',
                user: { id: 'u1', name: 'alice', email: 'a@b.com', groups: [], createdAt: 0, updatedAt: 0 },
                loginTime: 1000,
                lastActivity: 2000,
            },
        });
        const service = new CliServerUserSessionService(BASE_URL, http, kvStore);

        const restored = await service.restoreSession();

        expect(restored?.data?.['sessionId']).toBe('sess-42');
        expect(service.getSessionId()).toBe('sess-42');
    });

    it('returns undefined session id when no session is active', () => {
        const service = new CliServerUserSessionService(BASE_URL, createMockHttp(), new MockKeyValueStore());
        expect(service.getSessionId()).toBeUndefined();
    });
});

describe('CliServerAuthService (session id + events)', () => {
    let kvStore: MockKeyValueStore;
    let sessionService: CliServerUserSessionService;
    let events: any[];
    const eventService = {
        events$: undefined as any,
        emit: (e: any) => events.push(e),
    };
    const user = { id: 'u1', name: 'alice', email: 'a@b.com', groups: [], createdAt: 0, updatedAt: 0 };

    beforeEach(() => {
        kvStore = new MockKeyValueStore();
        events = [];
    });

    function createAuth(http: ICliHttpClient): CliServerAuthService {
        sessionService = new CliServerUserSessionService(BASE_URL, http, kvStore);
        return new CliServerAuthService(BASE_URL, http, kvStore, sessionService, () => {}, eventService as any);
    }

    it('stores the server session id and emits a login event', async () => {
        const http = createMockHttp({
            [`POST ${BASE_URL}/sessions`]: {
                token: 't1',
                session: { id: 'sess-1', user, loginTime: 1000 },
            },
        });
        const auth = createAuth(http);

        const session = await auth.login('alice', 'pw');

        expect(session.data?.['sessionId']).toBe('sess-1');
        expect(sessionService.getSessionId()).toBe('sess-1');
        expect(events.length).toBe(1);
        expect(events[0].type).toBe('login');
        expect(events[0].user.name).toBe('alice');
    });

    it('emits login_failed and rethrows when the server rejects credentials', async () => {
        const http = createMockHttp();
        (http.post as jasmine.Spy).and.rejectWith(new Error('Invalid credentials'));
        const auth = createAuth(http);

        await expectAsync(auth.login('alice', 'bad')).toBeRejectedWithError('Invalid credentials');

        expect(events.length).toBe(1);
        expect(events[0].type).toBe('login_failed');
        expect(events[0].user.name).toBe('alice');
        expect(events[0].details).toBe('Invalid credentials');
    });

    it('emits a logout event for the user that was signed in', async () => {
        const http = createMockHttp({
            [`POST ${BASE_URL}/sessions`]: { token: 't1', session: { id: 's', user, loginTime: 1 } },
            [`DELETE ${BASE_URL}/sessions/current`]: undefined,
        });
        const auth = createAuth(http);
        await auth.login('alice', 'pw');
        events = [];

        await auth.logout();

        expect(events.length).toBe(1);
        expect(events[0].type).toBe('logout');
        expect(events[0].user.id).toBe('u1');
        expect(sessionService.getSessionId()).toBeUndefined();
    });

    it('emits password_changed only when changing the current user password', async () => {
        const http = createMockHttp({
            [`POST ${BASE_URL}/sessions`]: { token: 't1', session: { id: 's', user, loginTime: 1 } },
            [`PUT ${BASE_URL}/users/u1/password`]: undefined,
            [`PUT ${BASE_URL}/users/other/password`]: undefined,
        });
        const auth = createAuth(http);
        await auth.login('alice', 'pw');
        events = [];

        await auth.setPassword('other', 'x');
        expect(events.length).toBe(0);

        await auth.setPassword('u1', 'y');
        expect(events.length).toBe(1);
        expect(events[0].type).toBe('password_changed');
    });
});

describe('CliServerAuthService.forgetToken', () => {
    it('clears the token locally without contacting the server', async () => {
        const kvStore = new MockKeyValueStore();
        await kvStore.set('cli-server-auth-token', 'tok');
        const http = createMockHttp();
        const tokens: (string | undefined)[] = [];
        const sessionService = new CliServerUserSessionService(BASE_URL, http, kvStore);
        const auth = new CliServerAuthService(BASE_URL, http, kvStore, sessionService, (t) => tokens.push(t));
        await auth.initialize();
        expect(tokens).toEqual(['tok']);

        await auth.forgetToken();

        expect(tokens).toEqual(['tok', undefined]);
        expect(await kvStore.get('cli-server-auth-token')).toBeUndefined();
        expect(http.post).not.toHaveBeenCalled();
    });
});
