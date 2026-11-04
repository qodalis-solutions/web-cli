import {
    ICliServerAuthService_TOKEN,
    ICliServerAuthTokenProvider,
    ICliServerAuthTokenProvider_TOKEN,
    buildServerWebSocketUrl,
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

function ticketResponse(ticket: string): Response {
    return new Response(JSON.stringify({ ticket, expiresIn: 30 }), { status: 201 });
}

describe('WebSocket auth (tickets)', () => {
    const bearer: ICliServerAuthTokenProvider = { getHeaders: () => ({ Authorization: 'Bearer SECRET' }) };
    let fetchSpy: jasmine.Spy;
    let warnSpy: jasmine.Spy;

    beforeEach(() => {
        fetchSpy = spyOn(globalThis, 'fetch');
        warnSpy = spyOn(console, 'warn');
    });

    it('fetches a ticket with the headers when no provider issues tickets, never putting them in the URL', async () => {
        fetchSpy.and.resolveTo(ticketResponse('T9'));
        const url = await resolveServerWebSocketUrl(setup([bearer]), 'node', 'ws://h/ws/v1/qcli/events');

        expect(url).toBe('ws://h/ws/v1/qcli/events?ticket=T9');
        expect(url).not.toContain('SECRET');
        expect(url).not.toContain('_header_');
        const [endpoint, init] = fetchSpy.calls.mostRecent().args;
        expect(endpoint).toBe('http://h/api/v1/qcli/sessions/ws-ticket');
        expect(init.method).toBe('POST');
        expect(init.headers.Authorization).toBe('Bearer SECRET');
    });

    it('asks the ticket endpoint under the server base path, over https for wss', async () => {
        fetchSpy.and.resolveTo(ticketResponse('T2'));
        const url = await buildServerWebSocketUrl('wss://h/app/ws/v1/qcli/logs?level=info', { 'X-Api-Key': 'k' });

        expect(fetchSpy.calls.mostRecent().args[0]).toBe('https://h/app/api/v1/qcli/sessions/ws-ticket');
        expect(url).toBe('wss://h/app/ws/v1/qcli/logs?level=info&ticket=T2');
    });

    it('connects without credentials and warns once when the server issues no ticket', async () => {
        fetchSpy.and.resolveTo(new Response('', { status: 404 }));
        const headers = { Authorization: 'Bearer SECRET' };

        expect(await buildServerWebSocketUrl('ws://no-ticket/ws/v1/qcli/events', headers)).toBe(
            'ws://no-ticket/ws/v1/qcli/events',
        );
        expect(await buildServerWebSocketUrl('ws://no-ticket/ws/v1/qcli/shell', headers)).toBe(
            'ws://no-ticket/ws/v1/qcli/shell',
        );
        expect(warnSpy).toHaveBeenCalledTimes(1);
        expect(warnSpy.calls.mostRecent().args[0]).toContain('unsafeHeadersInWebSocketUrl');
        expect(warnSpy.calls.mostRecent().args[0]).not.toContain('SECRET');
    });

    it('a network error while fetching the ticket also falls back to no credentials', async () => {
        fetchSpy.and.rejectWith(new TypeError('Failed to fetch'));
        expect(await buildServerWebSocketUrl('ws://down/ws/v1/qcli/events', { Authorization: 'Bearer SECRET' })).toBe(
            'ws://down/ws/v1/qcli/events',
        );
    });

    it('copies headers into the URL only with unsafeHeadersInWebSocketUrl (legacy)', async () => {
        const url = await resolveServerWebSocketUrl(setup([bearer]), 'node', 'ws://h/x', undefined, {
            unsafeHeadersInWebSocketUrl: true,
        });
        expect(url).toBe('ws://h/x?_header_Authorization=Bearer%20SECRET');
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('no headers: no ticket request and no warning', async () => {
        expect(await buildServerWebSocketUrl('ws://h/x', {})).toBe('ws://h/x');
        expect(fetchSpy).not.toHaveBeenCalled();
        expect(warnSpy).not.toHaveBeenCalled();
    });

    it('uses ticket params from a provider and never puts the bearer token in the URL', async () => {
        fetchSpy.and.resolveTo(new Response('', { status: 404 }));
        const ticketing: ICliServerAuthTokenProvider = {
            getHeaders: () => ({ Authorization: 'Bearer SECRET' }),
            getWebSocketParams: async (name) => (name === 'node' ? { ticket: 'T1' } : undefined),
        };
        const services = setup([ticketing]);
        const url = await resolveServerWebSocketUrl(services, 'node', 'ws://h/ws/v1/qcli/logs?level=info');
        expect(url).toBe('ws://h/ws/v1/qcli/logs?level=info&ticket=T1');
        expect(url).not.toContain('SECRET');
        // other servers get no header params either
        expect(await resolveServerWebSocketUrl(services, 'python', 'ws://p/ws/v1/qcli/events')).toBe(
            'ws://p/ws/v1/qcli/events',
        );
    });

    it('a handling provider without a ticket (signed out) still keeps the token out of the URL', async () => {
        const signedOut: ICliServerAuthTokenProvider = {
            getHeaders: () => ({ Authorization: 'Bearer SECRET' }),
            getWebSocketParams: async () => ({}),
        };
        expect(await resolveServerWebSocketUrl(setup([signedOut]), 'node', 'ws://h/x')).toBe('ws://h/x');
        expect(fetchSpy).not.toHaveBeenCalled();
    });
});
