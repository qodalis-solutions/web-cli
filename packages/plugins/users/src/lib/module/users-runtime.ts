import { publishUserEvents } from '../events';
import {
    ICliAuditService_TOKEN,
    ICliAuthorizationService_TOKEN,
    ICliAuthService_TOKEN,
    ICliExecutionContext,
    ICliGroupsStoreService_TOKEN,
    ICliKeyValueStore,
    ICliKeyValueStore_TOKEN,
    ICliPermissionService_TOKEN,
    ICliServerAuthTokenProvider,
    ICliServerAuthTokenProvider_TOKEN,
    ICliSessionsService_TOKEN,
    ICliUser,
    ICliUserEventService_TOKEN,
    ICliUserSessionService_TOKEN,
    ICliUsersStoreService_TOKEN,
} from '@qodalis/cli-core';
import { Subscription } from 'rxjs';
import {
    CliUsersModuleConfig,
    CliUsersModuleConfig_TOKEN,
} from '../models/users-module-config';
import { ICliUsersBackend } from '../backend/users-backend';
import { CliLocalUsersBackend } from '../backend/local-users-backend';
import { CliHttpUsersBackend } from '../backend/http-users-backend';
import { CliUserSessionService } from '../services/cli-user-session.service';
import {
    CliApiTokensService,
    CliApiTokensService_TOKEN,
    CliGroupsStoreService,
    CliSessionsService,
    CliUsersAuditService,
    CliUsersAuthorizationService,
    CliUsersAuthService,
    CliUsersStoreService,
} from '../services/cli-users-services';
import { CliDefaultUserEventService } from '../services/cli-default-user-event.service';
import { CliDefaultPermissionService } from '../services/cli-default-permission.service';
import { withUnauthorizedHandler } from '../utils/server-http';
import { createPasswordPolicyValidator } from '../utils/password-policy';

/** KV key of the session token, per mode */
export const LOCAL_TOKEN_KEY = 'cli-users-token';
export const SERVER_TOKEN_KEY = 'cli-server-auth-token';
/** Set after an explicit logout (local mode) so boot does not auto-login */
export const SIGNED_OUT_KEY = 'cli-users-signed-out';

/** Everything the users module wires up for one CLI instance. */
export interface CliUsersRuntime {
    config: CliUsersModuleConfig;
    kv: ICliKeyValueStore;
    backend: ICliUsersBackend;
    /** Set in local mode */
    local?: CliLocalUsersBackend;
    session: CliUserSessionService;
    auth: CliUsersAuthService;
    users: CliUsersStoreService;
    groups: CliGroupsStoreService;
    sessions: CliSessionsService;
    /** API tokens (server backends; fails with 501 locally) */
    tokens: CliApiTokensService;
    audit: CliUsersAuditService;
    events: CliDefaultUserEventService;
    authorization: CliUsersAuthorizationService;
    /** Server name in server mode */
    serverName?: string;
    /**
     * Ends the local session after the backend invalidated it (401, kick,
     * expiry). Prints `reason` once. Bound by the module.
     */
    terminate: (
        reason: string,
        options?: { outsideCommand?: boolean },
    ) => Promise<void>;
    subscriptions: Subscription[];
    disposers: Array<() => void>;
}

/**
 * Build the backend and services for the configured mode and register them
 * in the service container. Local and server mode differ only in the backend.
 */
export async function createUsersRuntime(
    context: ICliExecutionContext,
    config: CliUsersModuleConfig,
): Promise<CliUsersRuntime> {
    const kv = context.services.getRequired<ICliKeyValueStore>(
        ICliKeyValueStore_TOKEN,
    );
    const validatePassword = createPasswordPolicyValidator(
        config.passwordPolicy,
    );

    // Late-bound so backends can report revoked sessions before the runtime exists
    const runtimeRef: { current?: CliUsersRuntime } = {};

    let backend: ICliUsersBackend;
    let local: CliLocalUsersBackend | undefined;
    let tokenKey: string;
    let onTokenChange: ((token: string | undefined) => void) | undefined;
    let serverName: string | undefined;
    let serverUrl: string | undefined;

    if (config.backend) {
        backend = config.backend;
        tokenKey = `${SERVER_TOKEN_KEY}:custom`;
    } else if (config.server) {
        serverName = config.server;
        const serverConfig = context.options?.servers?.find(
            (s) => s.name === serverName,
        );
        if (!serverConfig) {
            throw new Error(
                `@qodalis/cli-users: server "${serverName}" not found in options.servers`,
            );
        }
        serverUrl = serverConfig.url.replace(/\/+$/, '');
        const baseUrl = serverUrl + '/api/v1/qcli';

        // Share the bearer token with every other request to this server
        let currentToken: string | undefined;
        onTokenChange = (token) => (currentToken = token);
        const tokenProvider: ICliServerAuthTokenProvider = {
            getHeaders: (name: string): Record<string, string> =>
                name === serverName && currentToken
                    ? { Authorization: `Bearer ${currentToken}` }
                    : {},
            // WebSockets authenticate with a single-use ticket, never the bearer token in the URL
            getWebSocketParams: async (
                name: string,
            ): Promise<Record<string, string> | undefined> => {
                if (name !== serverName) return undefined;
                const rt = runtimeRef.current;
                const token = rt?.session.getToken();
                if (!token || !rt?.backend.createWebSocketTicket) return {};
                try {
                    const { ticket } =
                        await rt.backend.createWebSocketTicket(token);
                    return { ticket };
                } catch {
                    return {}; // e.g. older server without tickets: connect unauthenticated
                }
            },
        };
        context.services.set({
            provide: ICliServerAuthTokenProvider_TOKEN,
            useValue: tokenProvider,
            multi: true,
        });

        // Any 401 (except a failed login) means the stored token is no longer valid.
        // Only a request made with the current token says so: ending the previous
        // session after a new login (or a late answer for an old token) must not
        // sign the new session out.
        // Logging out with a token the server already dropped is still a logout:
        // `logout()` ends the session once, without a "session expired" warning.
        const loginUrl = `${baseUrl}/sessions`;
        const logoutUrl = `${baseUrl}/sessions/current`;
        const http = withUnauthorizedHandler(context.http, {
            onUnauthorized: () =>
                runtimeRef.current?.terminate(
                    'Session expired or revoked by the server',
                ),
            ignore: (url, method, requestOptions) =>
                (method === 'POST' && url === loginUrl) ||
                (method === 'DELETE' && url === logoutUrl) ||
                !currentToken ||
                authorizationHeader(requestOptions?.headers) !==
                    `Bearer ${currentToken}`,
        });
        backend = new CliHttpUsersBackend(baseUrl, http);
        tokenKey = SERVER_TOKEN_KEY;
    } else {
        local = new CliLocalUsersBackend(kv, {
            sessionTimeoutMs: config.sessionTimeout ?? 0,
            validatePassword,
            maxLoginAttempts: config.bruteForceProtection?.maxAttempts ?? 5,
            lockoutMs:
                (config.bruteForceProtection?.lockoutSeconds ?? 300) * 1000,
            allowTrustedLogin: config.requirePassword === false,
            hashIterations: config.passwordHashIterations,
            onSessionRevoked: ({ sessionId, reason }) => {
                const rt = runtimeRef.current;
                if (rt && sessionId === rt.session.getSessionId()) {
                    void rt.terminate(`Session ended (${reason})`);
                }
            },
        });
        await local.initialize();
        backend = local;
        tokenKey = LOCAL_TOKEN_KEY;
    }

    const events = new CliDefaultUserEventService();
    if (config.hostAuth && !config.server && !config.backend) {
        throw new Error(
            '@qodalis/cli-users: hostAuth requires server mode (config.server) or a custom backend',
        );
    }
    const session = new CliUserSessionService(
        backend,
        kv,
        tokenKey,
        onTokenChange,
        {
            tokenSource: config.hostAuth?.getToken,
            persistToken: config.persistToken,
            // A session the backend no longer accepts counts as a sign-out
            onExpired: (user) =>
                events.emit({
                    type: 'logout',
                    user,
                    timestamp: Date.now(),
                    details: 'session expired',
                }),
        },
    );
    const auth = new CliUsersAuthService(backend, session, events, {
        passwordless: config.requirePassword === false,
        validatePassword,
        hostAuth: config.hostAuth,
    });
    const users = new CliUsersStoreService(backend, session, events);
    const groups = new CliGroupsStoreService(backend, session, events);
    const sessions = new CliSessionsService(backend, session, events);
    const tokens = new CliApiTokensService(
        backend,
        session,
        events,
        absoluteUrl(serverUrl ?? backendServerUrl(backend)),
    );
    const audit = new CliUsersAuditService(
        backend,
        session,
        events,
        local
            ? (event, username, details) =>
                  local!.appendAudit(event, username, details)
            : undefined,
    );
    const authorization = new CliUsersAuthorizationService(session);

    context.services.set([
        { provide: CliUsersModuleConfig_TOKEN, useValue: config },
        { provide: ICliUserEventService_TOKEN, useValue: events },
        { provide: ICliUserSessionService_TOKEN, useValue: session },
        { provide: ICliAuthService_TOKEN, useValue: auth },
        { provide: ICliUsersStoreService_TOKEN, useValue: users },
        { provide: ICliGroupsStoreService_TOKEN, useValue: groups },
        { provide: ICliSessionsService_TOKEN, useValue: sessions },
        { provide: CliApiTokensService_TOKEN, useValue: tokens },
        { provide: ICliAuditService_TOKEN, useValue: audit },
        { provide: ICliAuthorizationService_TOKEN, useValue: authorization },
        {
            provide: ICliPermissionService_TOKEN,
            useValue: new CliDefaultPermissionService(authorization),
        },
    ]);

    const runtime: CliUsersRuntime = {
        config,
        kv,
        backend,
        local,
        session,
        auth,
        users,
        groups,
        sessions,
        tokens,
        audit,
        events,
        authorization,
        serverName,
        terminate: async () => {},
        subscriptions: [],
        disposers: [],
    };
    const published = publishUserEvents(events.events$, context.events);
    if (published) runtime.subscriptions.push(published);
    runtimeRef.current = runtime;
    return runtime;
}

/** Display name for the prompt */
export function displayNameFor(
    config: CliUsersModuleConfig,
    user: ICliUser,
): string {
    return config.userDisplayFormatter
        ? config.userDisplayFormatter(user)
        : user.name;
}

/** Server URL of a custom backend exposing `baseUrl` (e.g. `http://host/api/v1/qcli`) */
function backendServerUrl(backend: ICliUsersBackend): string | undefined {
    const baseUrl = (backend as { baseUrl?: unknown }).baseUrl;
    if (typeof baseUrl !== 'string') return undefined;
    return baseUrl.replace(/\/+$/, '').replace(/\/api\/v1\/qcli$/, '');
}

/** Resolve a relative server URL (same-origin deployments) against the page origin */
function absoluteUrl(url: string | undefined): string | undefined {
    if (url === undefined) return undefined;
    if (/^https?:\/\//i.test(url)) return url;
    const origin =
        typeof location !== 'undefined' ? location?.origin : undefined;
    if (!origin || origin === 'null') return url || undefined;
    return `${origin}${url.startsWith('/') ? '' : '/'}${url}`.replace(
        /\/+$/,
        '',
    );
}

/** `Authorization` header of a request, whatever form the headers were given in */
function authorizationHeader(
    headers: HeadersInit | undefined,
): string | undefined {
    if (!headers) return undefined;
    if (typeof Headers !== 'undefined' && headers instanceof Headers)
        return headers.get('Authorization') ?? undefined;
    if (Array.isArray(headers))
        return headers.find(([k]) => k.toLowerCase() === 'authorization')?.[1];
    const record = headers as Record<string, string>;
    const key = Object.keys(record).find(
        (k) => k.toLowerCase() === 'authorization',
    );
    return key ? record[key] : undefined;
}
