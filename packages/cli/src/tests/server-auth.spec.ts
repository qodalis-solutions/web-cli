import {
    ICliServerAuthTokenProvider_TOKEN,
    ICliServiceProvider,
} from '@qodalis/cli-core';
import { CliServerAuthService } from '../lib/services/cli-server-auth.service';

function createMockServices(
    providers?: { getHeaders: (name: string) => Record<string, string> }[],
): ICliServiceProvider {
    return {
        get<T>(token: any): T | undefined {
            if (token === ICliServerAuthTokenProvider_TOKEN && providers) {
                return providers as T;
            }
            return undefined;
        },
        getAll<T>(token: any): T[] {
            if (token === ICliServerAuthTokenProvider_TOKEN && providers) {
                return providers as T[];
            }
            return [];
        },
        getRequired<T>(token: any): T {
            const result = this.get<T>(token);
            if (result === undefined) {
                throw new Error(`No provider for ${token}`);
            }
            return result;
        },
        has(token: any): boolean {
            return token === ICliServerAuthTokenProvider_TOKEN && !!providers;
        },
        set() {},
    };
}

describe('CliServerAuthService', () => {
    it('should return config headers when no token providers registered', () => {
        const services = createMockServices();
        const authService = new CliServerAuthService(services);

        const headers = authService.getHeaders('myServer', {
            Authorization: 'Bearer static',
        });
        expect(headers).toEqual({ Authorization: 'Bearer static' });
    });

    it('should return empty headers when no config and no providers', () => {
        const services = createMockServices();
        const authService = new CliServerAuthService(services);

        expect(authService.getHeaders('myServer')).toEqual({});
    });

    it('should merge config headers with token provider headers', () => {
        const provider = {
            getHeaders: (_name: string) => ({ 'X-Custom': 'from-provider' }),
        };
        const services = createMockServices([provider]);
        const authService = new CliServerAuthService(services);

        const headers = authService.getHeaders('myServer', {
            Authorization: 'Bearer config',
        });
        expect(headers).toEqual({
            Authorization: 'Bearer config',
            'X-Custom': 'from-provider',
        });
    });

    it('should merge multiple token providers', () => {
        const provider1 = {
            getHeaders: () => ({ 'X-One': 'first' }),
        };
        const provider2 = {
            getHeaders: () => ({ 'X-Two': 'second' }),
        };
        const services = createMockServices([provider1, provider2]);
        const authService = new CliServerAuthService(services);

        const headers = authService.getHeaders('myServer');
        expect(headers).toEqual({ 'X-One': 'first', 'X-Two': 'second' });
    });

    it('should let token provider override config headers', () => {
        const provider = {
            getHeaders: () => ({ Authorization: 'Bearer overridden' }),
        };
        const services = createMockServices([provider]);
        const authService = new CliServerAuthService(services);

        const headers = authService.getHeaders('myServer', {
            Authorization: 'Bearer original',
        });
        expect(headers['Authorization']).toBe('Bearer overridden');
    });

    it('should pass server name to token providers', () => {
        const receivedNames: string[] = [];
        const provider = {
            getHeaders: (name: string) => {
                receivedNames.push(name);
                return {};
            },
        };
        const services = createMockServices([provider]);
        const authService = new CliServerAuthService(services);

        authService.getHeaders('server-a');
        authService.getHeaders('server-b');
        expect(receivedNames).toEqual(['server-a', 'server-b']);
    });

    it('should resolve dynamic config headers', () => {
        let counter = 0;
        const services = createMockServices();
        const authService = new CliServerAuthService(services);

        const headers = authService.getHeaders(
            'myServer',
            () => ({ 'X-Count': String(++counter) }),
        );
        expect(headers).toEqual({ 'X-Count': '1' });
    });
});
