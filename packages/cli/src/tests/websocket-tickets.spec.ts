import {
    ICliServerAuthService_TOKEN,
    ICliServerAuthTokenProvider,
    ICliServerAuthTokenProvider_TOKEN,
    resolveServerWebSocketUrl,
} from '@qodalis/cli-core';
import { CliServerAuthService } from '../lib/services/cli-server-auth.service';
import { CliServiceContainer } from '../lib/services/cli-service-container';

function setup(providers: ICliServerAuthTokenProvider[]) {
    const services = new CliServiceContainer();
    for (const p of providers) services.set({ provide: ICliServerAuthTokenProvider_TOKEN, useValue: p, multi: true });
    services.set({ provide: ICliServerAuthService_TOKEN, useValue: new CliServerAuthService(services) });
    return services;
}

describe('WebSocket auth (tickets)', () => {
    const bearer: ICliServerAuthTokenProvider = { getHeaders: () => ({ Authorization: 'Bearer SECRET' }) };

    it('falls back to header params when no provider issues tickets (legacy)', async () => {
        const url = await resolveServerWebSocketUrl(setup([bearer]), 'node', 'ws://h/ws/v1/qcli/events');
        expect(url).toContain('_header_Authorization=Bearer%20SECRET');
    });

    it('uses ticket params and never puts the bearer token in the URL', async () => {
        const ticketing: ICliServerAuthTokenProvider = {
            getHeaders: () => ({ Authorization: 'Bearer SECRET' }),
            getWebSocketParams: async (name) => (name === 'node' ? { ticket: 'T1' } : undefined),
        };
        const services = setup([ticketing]);
        const url = await resolveServerWebSocketUrl(services, 'node', 'ws://h/ws/v1/qcli/logs?level=info');
        expect(url).toBe('ws://h/ws/v1/qcli/logs?level=info&ticket=T1');
        expect(url).not.toContain('SECRET');
        // other servers keep the legacy behaviour
        expect(await resolveServerWebSocketUrl(services, 'python', 'ws://p/x')).toContain('_header_');
    });

    it('a handling provider without a ticket (signed out) still keeps the token out of the URL', async () => {
        const signedOut: ICliServerAuthTokenProvider = {
            getHeaders: () => ({ Authorization: 'Bearer SECRET' }),
            getWebSocketParams: async () => ({}),
        };
        expect(await resolveServerWebSocketUrl(setup([signedOut]), 'node', 'ws://h/x')).toBe('ws://h/x');
    });
});
