import { CliHttpError } from '@qodalis/cli-core';
import { CliHttpClient } from '../lib/services/cli-http-client';

function jsonResponse(status: number, body: unknown, statusText = ''): Response {
    return new Response(JSON.stringify(body), {
        status,
        statusText,
        headers: { 'Content-Type': 'application/json' },
    });
}

describe('CliHttpClient', () => {
    let fetchSpy: jasmine.Spy;

    beforeEach(() => {
        fetchSpy = spyOn(globalThis, 'fetch');
    });

    it('returns parsed JSON on success', async () => {
        fetchSpy.and.resolveTo(jsonResponse(200, { ok: true }));
        const client = new CliHttpClient();
        const result = await client.get<{ ok: boolean }>('http://x/api');
        expect(result.ok).toBeTrue();
    });

    it('throws CliHttpError with status and body on non-2xx', async () => {
        fetchSpy.and.resolveTo(
            jsonResponse(401, { error: 'Invalid or expired session' }, 'Unauthorized'),
        );
        const client = new CliHttpClient();

        let caught: unknown;
        try {
            await client.get('http://x/api/v1/qcli/users');
        } catch (e) {
            caught = e;
        }

        expect(caught instanceof CliHttpError).toBeTrue();
        const err = caught as CliHttpError;
        expect(err.status).toBe(401);
        expect(err.statusText).toBe('Unauthorized');
        expect(err.message).toBe('Invalid or expired session');
        expect(err.body).toEqual({ error: 'Invalid or expired session' });
    });

    it('falls back to "<status> <statusText>" when the body is not JSON', async () => {
        fetchSpy.and.resolveTo(
            new Response('not json', { status: 500, statusText: 'Server Error' }),
        );
        const client = new CliHttpClient();

        await expectAsync(client.post('http://x/api', {})).toBeRejectedWithError(
            CliHttpError,
            '500 Server Error',
        );
    });
    it('keeps headers passed as a Headers instance or tuple list', async () => {
        fetchSpy.and.callFake(async () => jsonResponse(200, {}));
        const client = new CliHttpClient();

        await client.get('http://x/a', { headers: new Headers({ Authorization: 'Bearer A' }) });
        await client.post('http://x/b', { v: 1 }, { headers: [['Authorization', 'Bearer B']] });

        const h1 = new Headers(fetchSpy.calls.argsFor(0)[1].headers);
        const h2 = new Headers(fetchSpy.calls.argsFor(1)[1].headers);
        expect(h1.get('authorization')).toBe('Bearer A');
        expect(h2.get('authorization')).toBe('Bearer B');
        expect(h2.get('content-type')).toBe('application/json');
    });

    it('does not add a second content type when the caller set one in lower case', async () => {
        fetchSpy.and.callFake(async () => jsonResponse(200, {}));
        await new CliHttpClient().post('http://x/b', { v: 1 }, { headers: { 'content-type': 'application/vnd.api+json' } });
        const h = new Headers(fetchSpy.calls.argsFor(0)[1].headers);
        expect(h.get('content-type')).toBe('application/vnd.api+json');
    });
});
