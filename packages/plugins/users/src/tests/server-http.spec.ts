import { CliHttpError, ICliHttpClient } from '@qodalis/cli-core';
import {
    withUnauthorizedHandler,
    isUnauthorizedError,
} from '../lib/utils/server-http';

function failingHttp(error: unknown): ICliHttpClient {
    const reject = () => Promise.reject(error);
    return {
        fetch: jasmine.createSpy('fetch'),
        head: jasmine.createSpy('head'),
        get: jasmine.createSpy('get').and.callFake(reject),
        post: jasmine.createSpy('post').and.callFake(reject),
        put: jasmine.createSpy('put').and.callFake(reject),
        patch: jasmine.createSpy('patch').and.callFake(reject),
        delete: jasmine.createSpy('delete').and.callFake(reject),
        options: jasmine.createSpy('options').and.callFake(reject),
    };
}

describe('isUnauthorizedError', () => {
    it('detects CliHttpError with status 401', () => {
        expect(isUnauthorizedError(new CliHttpError('nope', 401))).toBeTrue();
        expect(isUnauthorizedError(new CliHttpError('nope', 403))).toBeFalse();
    });

    it('detects plain objects carrying status 401', () => {
        expect(isUnauthorizedError({ status: 401 })).toBeTrue();
        expect(isUnauthorizedError(new Error('x'))).toBeFalse();
        expect(isUnauthorizedError(undefined)).toBeFalse();
    });
});

describe('withUnauthorizedHandler', () => {
    it('calls onUnauthorized on 401 and re-throws', async () => {
        const error = new CliHttpError('expired', 401);
        const onUnauthorized = jasmine.createSpy('onUnauthorized');
        const http = withUnauthorizedHandler(failingHttp(error), { onUnauthorized });

        await expectAsync(http.get('http://s/api/v1/qcli/users')).toBeRejectedWith(error);
        expect(onUnauthorized).toHaveBeenCalledOnceWith(error);
    });

    it('covers every JSON verb', async () => {
        const error = new CliHttpError('expired', 401);
        const onUnauthorized = jasmine.createSpy('onUnauthorized');
        const http = withUnauthorizedHandler(failingHttp(error), { onUnauthorized });

        await expectAsync(http.post('u', {})).toBeRejected();
        await expectAsync(http.put('u', {})).toBeRejected();
        await expectAsync(http.patch('u', {})).toBeRejected();
        await expectAsync(http.delete('u')).toBeRejected();
        await expectAsync(http.options('u')).toBeRejected();
        expect(onUnauthorized).toHaveBeenCalledTimes(5);
    });

    it('ignores non-401 errors', async () => {
        const error = new CliHttpError('nope', 403);
        const onUnauthorized = jasmine.createSpy('onUnauthorized');
        const http = withUnauthorizedHandler(failingHttp(error), { onUnauthorized });

        await expectAsync(http.get('u')).toBeRejectedWith(error);
        expect(onUnauthorized).not.toHaveBeenCalled();
    });

    it('skips URLs matched by ignore()', async () => {
        const error = new CliHttpError('bad credentials', 401);
        const onUnauthorized = jasmine.createSpy('onUnauthorized');
        const http = withUnauthorizedHandler(failingHttp(error), {
            onUnauthorized,
            ignore: (url, method) => method === 'POST' && url === 'http://s/api/v1/qcli/sessions',
        });

        await expectAsync(http.post('http://s/api/v1/qcli/sessions', {})).toBeRejectedWith(error);
        expect(onUnauthorized).not.toHaveBeenCalled();
    });

    it('passes the HTTP method to ignore() so same-URL requests can differ', async () => {
        const error = new CliHttpError('expired', 401);
        const onUnauthorized = jasmine.createSpy('onUnauthorized');
        const ignore = jasmine.createSpy('ignore').and.callFake(
            (url: string, method: string) => method === 'POST' && url === 'http://s/api/v1/qcli/sessions',
        );
        const http = withUnauthorizedHandler(failingHttp(error), { onUnauthorized, ignore });

        // GET /sessions with an expired token is a real session expiry
        await expectAsync(http.get('http://s/api/v1/qcli/sessions')).toBeRejected();

        expect(ignore).toHaveBeenCalledWith('http://s/api/v1/qcli/sessions', 'GET', undefined);
        expect(onUnauthorized).toHaveBeenCalledTimes(1);
    });

    it('passes successful responses through untouched', async () => {
        const inner = failingHttp(new Error('unused'));
        (inner.get as jasmine.Spy).and.resolveTo([{ id: 'u1' }]);
        const onUnauthorized = jasmine.createSpy('onUnauthorized');
        const http = withUnauthorizedHandler(inner, { onUnauthorized });

        const users = await http.get('u', { headers: { a: 'b' } });
        expect(users).toEqual([{ id: 'u1' }]);
        expect(inner.get).toHaveBeenCalledWith('u', { headers: { a: 'b' } });
        expect(onUnauthorized).not.toHaveBeenCalled();
    });
});
