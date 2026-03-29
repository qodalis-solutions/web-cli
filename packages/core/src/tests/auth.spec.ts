import { resolveHeaders, resolveServerHeaders } from '../lib/models/server';
import { buildAuthenticatedWebSocketUrl } from '../lib/utils/websocket-auth';
import { ICliServiceProvider } from '../lib/interfaces/services';

// ---------------------------------------------------------------------------
// resolveHeaders
// ---------------------------------------------------------------------------
describe('resolveHeaders', () => {
    it('should return empty object when provider is undefined', () => {
        expect(resolveHeaders(undefined)).toEqual({});
    });

    it('should return static headers as-is', () => {
        const headers = { Authorization: 'Bearer abc' };
        expect(resolveHeaders(headers)).toEqual({ Authorization: 'Bearer abc' });
    });

    it('should invoke function provider and return result', () => {
        const provider = () => ({ 'X-Token': 'dynamic' });
        expect(resolveHeaders(provider)).toEqual({ 'X-Token': 'dynamic' });
    });

    it('should return fresh values on each call for function provider', () => {
        let counter = 0;
        const provider = () => ({ 'X-Count': String(++counter) });

        expect(resolveHeaders(provider)).toEqual({ 'X-Count': '1' });
        expect(resolveHeaders(provider)).toEqual({ 'X-Count': '2' });
    });
});

// ---------------------------------------------------------------------------
// buildAuthenticatedWebSocketUrl
// ---------------------------------------------------------------------------
describe('buildAuthenticatedWebSocketUrl', () => {
    it('should return original URL when no headers', () => {
        expect(buildAuthenticatedWebSocketUrl('ws://localhost/ws')).toBe(
            'ws://localhost/ws',
        );
    });

    it('should return original URL when headers are empty', () => {
        expect(buildAuthenticatedWebSocketUrl('ws://localhost/ws', {})).toBe(
            'ws://localhost/ws',
        );
    });

    it('should append headers as _header_ prefixed query params', () => {
        const url = buildAuthenticatedWebSocketUrl('ws://localhost/ws', {
            Authorization: 'Bearer token123',
        });
        expect(url).toBe(
            'ws://localhost/ws?_header_Authorization=Bearer%20token123',
        );
    });

    it('should append multiple headers', () => {
        const url = buildAuthenticatedWebSocketUrl('ws://localhost/ws', {
            Authorization: 'Bearer abc',
            'X-Api-Key': 'key123',
        });
        expect(url).toContain('_header_Authorization=Bearer%20abc');
        expect(url).toContain('_header_X-Api-Key=key123');
    });

    it('should use & separator when URL already has query params', () => {
        const url = buildAuthenticatedWebSocketUrl(
            'ws://localhost/ws?existing=true',
            { Authorization: 'Bearer abc' },
        );
        expect(url).toContain('?existing=true&_header_Authorization=');
        expect(url).not.toMatch(/\?.*\?/); // no double ?
    });

    it('should resolve function headers provider', () => {
        const url = buildAuthenticatedWebSocketUrl(
            'ws://localhost/ws',
            () => ({ 'X-Token': 'dynamic' }),
        );
        expect(url).toBe('ws://localhost/ws?_header_X-Token=dynamic');
    });

    it('should encode special characters in header keys and values', () => {
        const url = buildAuthenticatedWebSocketUrl('ws://localhost/ws', {
            'X-Special Key': 'value with spaces & symbols=yes',
        });
        expect(url).toContain('_header_X-Special%20Key=');
        expect(url).toContain('value%20with%20spaces%20%26%20symbols%3Dyes');
    });
});

// ---------------------------------------------------------------------------
// resolveServerHeaders
// ---------------------------------------------------------------------------
describe('resolveServerHeaders', () => {
    it('should fall back to config headers when no services', () => {
        const headers = resolveServerHeaders(undefined, 'srv', {
            Authorization: 'Bearer abc',
        });
        expect(headers).toEqual({ Authorization: 'Bearer abc' });
    });

    it('should fall back to config headers when auth service not registered', () => {
        const services: ICliServiceProvider = {
            get<T>(_token: any): T | undefined {
                return undefined;
            },
            getAll<T>(_token: any): T[] { return []; },
            getRequired<T>(_token: any): T { throw new Error('not found'); },
            has(_token: any): boolean {
                return false;
            },
            set() {},
        };
        const headers = resolveServerHeaders(services, 'srv', {
            'X-Key': 'val',
        });
        expect(headers).toEqual({ 'X-Key': 'val' });
    });

    it('should use auth service when registered', () => {
        const services: ICliServiceProvider = {
            get<T>(_token: any): T | undefined {
                return {
                    getHeaders: () => ({ Authorization: 'Bearer from-service' }),
                } as T;
            },
            getAll<T>(_token: any): T[] { return []; },
            getRequired<T>(token: any): T { return this.get(token) as T; },
            has(_token: any): boolean {
                return true;
            },
            set() {},
        };
        const headers = resolveServerHeaders(services, 'srv');
        expect(headers).toEqual({ Authorization: 'Bearer from-service' });
    });

    it('should return empty object when no services and no config headers', () => {
        expect(resolveServerHeaders(undefined, 'srv')).toEqual({});
    });

    it('should propagate errors from auth service getHeaders', () => {
        const services: ICliServiceProvider = {
            get<T>(_token: any): T | undefined {
                return {
                    getHeaders: () => {
                        throw new Error('token refresh failed');
                    },
                } as T;
            },
            getAll<T>(_token: any): T[] { return []; },
            getRequired<T>(token: any): T { return this.get(token) as T; },
            has(_token: any): boolean {
                return true;
            },
            set() {},
        };
        expect(() => resolveServerHeaders(services, 'srv')).toThrowError(
            'token refresh failed',
        );
    });
});
