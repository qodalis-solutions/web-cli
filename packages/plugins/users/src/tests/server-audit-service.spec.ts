import { ICliHttpClient } from '@qodalis/cli-core';
import { CliServerAuditService } from '../lib/services/cli-server-audit.service';

const BASE_URL = 'http://server/api/v1/qcli';

function mockHttp(): ICliHttpClient {
    return {
        fetch: jasmine.createSpy('fetch'),
        head: jasmine.createSpy('head'),
        get: jasmine.createSpy('get').and.resolveTo([]),
        post: jasmine.createSpy('post'),
        put: jasmine.createSpy('put'),
        patch: jasmine.createSpy('patch'),
        delete: jasmine.createSpy('delete').and.resolveTo(undefined),
        options: jasmine.createSpy('options'),
    };
}

describe('CliServerAuditService', () => {
    const headers = { Authorization: 'Bearer t' };

    it('reads entries from GET /audit with filters as query params', async () => {
        const http = mockHttp();
        const entries = [{ timestamp: 1, event: 'login', username: 'alice' }];
        (http.get as jasmine.Spy).and.resolveTo(entries);
        const service = new CliServerAuditService(BASE_URL, http, () => headers);

        const result = await service.getEntries({ event: 'login', username: 'alice', limit: 10 });

        expect(result).toEqual(entries);
        expect(http.get).toHaveBeenCalledWith(
            `${BASE_URL}/audit?event=login&username=alice&limit=10`,
            { headers },
        );
    });

    it('omits the query string when no filters are given', async () => {
        const http = mockHttp();
        const service = new CliServerAuditService(BASE_URL, http, () => headers);

        await service.getEntries();

        expect(http.get).toHaveBeenCalledWith(`${BASE_URL}/audit`, { headers });
    });

    it('returns an empty list when the server responds with no body', async () => {
        const http = mockHttp();
        (http.get as jasmine.Spy).and.resolveTo(undefined);
        const service = new CliServerAuditService(BASE_URL, http, () => headers);

        expect(await service.getEntries()).toEqual([]);
    });

    it('clears via DELETE /audit', async () => {
        const http = mockHttp();
        const service = new CliServerAuditService(BASE_URL, http, () => headers);

        await service.clear();

        expect(http.delete).toHaveBeenCalledWith(`${BASE_URL}/audit`, { headers });
    });

    it('log() is a no-op (server records events itself)', async () => {
        const http = mockHttp();
        const service = new CliServerAuditService(BASE_URL, http, () => headers);

        await service.log({ event: 'login', username: 'alice' });

        expect(http.post).not.toHaveBeenCalled();
        expect(http.put).not.toHaveBeenCalled();
    });
});
