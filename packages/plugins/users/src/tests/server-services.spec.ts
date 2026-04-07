import { ICliHttpClient, ICliKeyValueStore, ICliUserSessionService } from '@qodalis/cli-core';
import { firstValueFrom } from 'rxjs';

import { CliServerUsersStoreService } from '../lib/services/cli-server-users-store.service';
import { CliServerGroupsStoreService } from '../lib/services/cli-server-groups-store.service';
import { CliServerUserSessionService } from '../lib/services/cli-server-user-session.service';
import { CliServerAuthService } from '../lib/services/cli-server-auth.service';

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
            [`POST ${BASE_URL}/auth/login`]: loginResponse,
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
            [`POST ${BASE_URL}/auth/logout`]: {},
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

    it('should verify password via POST /auth/verify', async () => {
        const http = createMockHttp({
            [`POST ${BASE_URL}/auth/verify`]: { valid: true },
        });
        const service = createAuthService(http);

        const result = await service.verifyPassword('u1', 'correct');
        expect(result).toBeTrue();
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
        expect(http.put).toHaveBeenCalled();
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
});
