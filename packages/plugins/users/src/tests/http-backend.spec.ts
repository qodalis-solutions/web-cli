import { CliHttpError, ICliHttpClient } from '@qodalis/cli-core';
import { CliHttpUsersBackend, toUsersError } from '../lib/backend/http-users-backend';
import { CliUsersError } from '../lib/backend/users-backend';

function fakeHttp(responder: (method: string, url: string, body?: any, options?: any) => any): ICliHttpClient & { calls: any[] } {
    const calls: any[] = [];
    const handle = (method: string) => async (url: string, a?: any, b?: any) => {
        const [body, options] = method === 'GET' || method === 'DELETE' ? [undefined, a] : [a, b];
        calls.push({ method, url, body, headers: options?.headers ?? {} });
        return responder(method, url, body, options);
    };
    return {
        calls,
        fetch: handle('FETCH') as any,
        head: handle('HEAD') as any,
        get: handle('GET') as any,
        post: handle('POST') as any,
        put: handle('PUT') as any,
        patch: handle('PATCH') as any,
        delete: handle('DELETE') as any,
        options: handle('OPTIONS') as any,
    };
}

describe('CliHttpUsersBackend', () => {
    const base = 'http://srv/api/v1/qcli';

    it('maps every operation to the contract paths with the bearer token', async () => {
        const http = fakeHttp(() => ({}));
        const b = new CliHttpUsersBackend(base, http);
        await b.login('root', 'pw');
        await b.logout('T');
        await b.currentSession('T');
        await b.listSessions('T');
        await b.revokeSession('T', 's/1');
        await b.listUsers('T', { query: 'a b', skip: 1, take: 2 });
        await b.getUser('T', 'al ice');
        await b.getUserPermissions('T', 'alice');
        await b.createUser('T', { name: 'a', email: 'a@x.io' });
        await b.updateUser('T', 'a', { email: 'b@x.io', lastLoginAt: 5 });
        await b.deleteUser('T', 'a');
        await b.setPassword('T', 'a', 'new', 'old');
        await b.listGroups('T');
        await b.getGroupMembers('T', 'dev');
        await b.createGroup('T', { name: 'dev', permissions: ['x:y'] });
        await b.updateGroup('T', 'dev', { permissions: [] });
        await b.deleteGroup('T', 'dev');
        await b.addGroupMember('T', 'dev', 'a');
        await b.removeGroupMember('T', 'dev', 'a');
        await b.listAudit('T', { limit: 5, event: 'login' });
        await b.clearAudit('T');
        await b.listApiTokens('T');
        await b.listApiTokens('T', { all: true });
        await b.createApiToken('T', { name: 'ci', expiresInDays: null, permissions: ['a:b'] });
        await b.revokeApiToken('T', 'tok/1');

        expect(http.calls.map((c) => `${c.method} ${c.url.replace(base, '')}`)).toEqual([
            'POST /sessions',
            'DELETE /sessions/current',
            'GET /sessions/current',
            'GET /sessions',
            'DELETE /sessions/s%2F1',
            'GET /users?query=a+b&skip=1&take=2',
            'GET /users/al%20ice',
            'GET /users/alice/permissions',
            'POST /users',
            'PUT /users/a',
            'DELETE /users/a',
            'PUT /users/a/password',
            'GET /groups',
            'GET /groups/dev/members',
            'POST /groups',
            'PUT /groups/dev',
            'DELETE /groups/dev',
            'POST /groups/dev/members/a',
            'DELETE /groups/dev/members/a',
            'GET /audit?limit=5&event=login',
            'DELETE /audit',
            'GET /tokens',
            'GET /tokens?all=true',
            'POST /tokens',
            'DELETE /tokens/tok%2F1',
        ]);
        expect(http.calls[23].body).toEqual({ name: 'ci', expiresInDays: null, permissions: ['a:b'] });
        expect(http.calls[0].headers.Authorization).toBeUndefined();
        expect(http.calls[1].headers.Authorization).toBe('Bearer T');
        expect(http.calls[9].body).toEqual({ email: 'b@x.io' });
        expect(http.calls[11].body).toEqual({ password: 'new', currentPassword: 'old' });
    });

    it('converts server errors to CliUsersError with the server message', async () => {
        const http = fakeHttp(() => {
            throw new CliHttpError('http', 409, 'Conflict', { error: 'user already exists: a' });
        });
        const b = new CliHttpUsersBackend(base, http);
        try {
            await b.createUser('T', { name: 'a', email: 'a@x.io' });
            fail('expected error');
        } catch (e: any) {
            expect(e instanceof CliUsersError).toBeTrue();
            expect(e.status).toBe(409);
            expect(e.message).toBe('user already exists: a');
        }
    });

    it('returns undefined for missing users and groups', async () => {
        const http = fakeHttp(() => {
            throw new CliHttpError('http', 404, 'Not Found', { error: 'not found' });
        });
        const b = new CliHttpUsersBackend(base, http);
        expect(await b.getUser('T', 'x')).toBeUndefined();
        expect(await b.getGroup('T', 'x')).toBeUndefined();
    });

    it('requires a password for server login', async () => {
        const b = new CliHttpUsersBackend(base, fakeHttp(() => ({})));
        await expectAsync(b.login('root', undefined)).toBeRejectedWith(jasmine.objectContaining({ status: 400 }));
    });

    it('understands python {detail} and string bodies, and network failures', () => {
        expect(toUsersError(new CliHttpError('http', 400, 'Bad', { detail: 'bad input' })).message).toBe('bad input');
        expect(toUsersError(new CliHttpError('http', 500, 'Err', '{"error":"boom"}')).message).toBe('boom');
        expect((toUsersError(new TypeError('Failed to fetch')) as CliUsersError).status).toBe(0);
    });
});
