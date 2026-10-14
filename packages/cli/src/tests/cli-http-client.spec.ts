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
});
