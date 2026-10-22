import {
    ICliServerManager,
    ICliServerManager_TOKEN,
    CliProcessCommand,
    ICliCommandProcessor,
    ICliExecutionContext,
    isCliAccessDeniedError,
} from '@qodalis/cli-core';
import { CliUsersRuntime, displayNameFor, SIGNED_OUT_KEY } from './users-runtime';
import { isCliUsersError } from '../backend/users-backend';

/**
 * Mirror the session into `context.userSession` (prompt, guards, other
 * extensions). Same for both modes.
 */
export function bindSessionToContext(context: ICliExecutionContext, runtime: CliUsersRuntime): void {
    runtime.subscriptions.push(
        runtime.session.getUserSession().subscribe((session) => {
            context.userSession = session
                ? { ...session, displayName: displayNameFor(runtime.config, session.user) }
                : undefined;
        }),
    );
    // Explicit login clears the "signed out" marker; explicit logout sets it
    runtime.subscriptions.push(
        runtime.events.events$.subscribe((event) => {
            if (event.type === 'login') void runtime.kv.remove(SIGNED_OUT_KEY);
            // Any end of a session (logout, expiry, kick, disabled account) is sticky:
            // the next boot must not sign anyone in automatically. Leaving an `su`
            // session is not: the session it suspended is current again.
            if (event.type === 'logout' && !runtime.session.current) void runtime.kv.set(SIGNED_OUT_KEY, true);
        }),
    );
}

/**
 * Bind `runtime.terminate`: drop the local session after the backend ended it
 * (401, kick, idle expiry, account disabled) and tell the user once.
 */
export function bindTermination(context: ICliExecutionContext, runtime: CliUsersRuntime): { consume(): boolean } {
    let justTerminated = false;
    runtime.terminate = async (reason, options = {}) => {
        if (!runtime.session.getToken() && !runtime.session.current) return;
        justTerminated = true;
        await runtime.auth.forgetSession(reason);
        if (options.outsideCommand) {
            // Pushed while the user sits at the prompt: fresh line + redraw prompt
            context.writer?.writeln?.();
            context.writer?.writeWarning?.(`${reason}. Please log in again.`);
            context.showPrompt?.();
        } else {
            context.writer?.writeWarning?.(`${reason}. Please log in again.`);
        }
    };
    return {
        /** True once after a termination (so the failing command does not report it again) */
        consume() {
            const value = justTerminated;
            justTerminated = false;
            return value;
        },
    };
}

/**
 * Periodically check the session expiry the backend reported
 * (`data.expiresAt`) and end it while the user is idle at the prompt.
 */
export function startExpiryWatch(runtime: CliUsersRuntime, intervalMs = 30_000): void {
    const timer = setInterval(async () => {
        const expiresAt = runtime.session.current?.data?.['expiresAt'] as number | undefined;
        if (!expiresAt || expiresAt > Date.now()) return;
        try {
            const still = await runtime.session.refresh();
            if (!still) await runtime.terminate('Session expired', { outsideCommand: true });
        } catch {
            // backend unreachable: try again later
        }
    }, intervalMs);
    runtime.disposers.push(() => clearInterval(timer));
}

/**
 * Server mode: sign out when an administrator revokes this session
 * (`session-kicked` pushed over the server events socket).
 */
export function listenForKicks(context: ICliExecutionContext, runtime: CliUsersRuntime): void {
    if (!runtime.serverName) return;
    const unsubscribe = context.backgroundServices?.on(
        (event) => {
            const payload = (event.data as { data?: { sessionId?: string; reason?: string } } | undefined)?.data;
            if (payload?.sessionId && payload.sessionId === runtime.session.getSessionId()) {
                const why = payload.reason ? ` (${payload.reason})` : '';
                void runtime.terminate(`Session terminated by an administrator${why}`, { outsideCommand: true });
            }
        },
        { source: `server-events:${runtime.serverName}`, type: 'session-kicked' },
    );
    if (unsubscribe) runtime.disposers.push(unsubscribe);
}

/**
 * Wrap the module's processors so backend failures print one clean line
 * (`cmd: message`) and a 401 ends the session once. Wrappers delegate to the
 * originals, so shared processor instances are never mutated.
 */
export function wrapProcessors(
    processors: ICliCommandProcessor[],
    runtime: CliUsersRuntime,
    termination: { consume(): boolean },
    parentPath = '',
): ICliCommandProcessor[] {
    return processors.map((processor) => {
        const wrapped: ICliCommandProcessor = Object.create(processor);
        const path = parentPath ? `${parentPath} ${processor.command}` : processor.command;
        // Sub-commands (e.g. `token create`) report failures the same way
        if (processor.processors?.length) {
            wrapped.processors = wrapProcessors(processor.processors, runtime, termination, path);
        }
        wrapped.processCommand = async (command: CliProcessCommand, ctx: ICliExecutionContext) => {
            termination.consume();
            try {
                // `this` must be the wrapper: initialize() ran on it
                await processor.processCommand.call(wrapped, command, ctx);
            } catch (error: any) {
                if (isCliAccessDeniedError(error)) throw error;
                if (isCliUsersError(error) && error.status === 401) {
                    if (termination.consume()) return; // already reported by terminate()
                    // A 401 can also mean "wrong credentials" (login, su): only end the
                    // session when the backend no longer accepts our token
                    const token = runtime.session.getToken();
                    if (token) {
                        const valid = await runtime.backend.currentSession(token).then(
                            () => true,
                            (e) => !(isCliUsersError(e) && e.status === 401),
                        );
                        if (!valid) {
                            await runtime.terminate('Session expired or revoked');
                            return;
                        }
                    }
                }
                ctx.writer.writeError(`${path}: ${stripPrefix(error?.message, path) ?? 'failed'}`);
                ctx.process?.exit?.(-1, { silent: true } as any);
            }
        };
        return wrapped;
    });
}

function stripPrefix(message: string | undefined, command: string): string | undefined {
    if (!message) return message;
    const prefix = `${command}: `;
    return message.startsWith(prefix) ? message.slice(prefix.length) : message;
}

/**
 * Server mode: when the user signs in or out, reconnect the server so its
 * commands and event socket follow the session (a protected server only
 * exposes its commands to authenticated users).
 */
export function reconnectServerOnSessionChange(context: ICliExecutionContext, runtime: CliUsersRuntime): void {
    if (!runtime.serverName) return;
    // Start from "no token": a session restored at boot also reconnects, because the
    // server's first connection may have run before the token was available (401)
    let lastToken: string | undefined;
    runtime.subscriptions.push(
        runtime.session.getUserSession().subscribe(() => {
            const token = runtime.session.getToken();
            if (token === lastToken) return;
            lastToken = token;
            const manager = context.services.get<ICliServerManager>(ICliServerManager_TOKEN);
            manager?.reconnect(runtime.serverName!).catch(() => undefined);
        }),
    );
}
