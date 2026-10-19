import { ICliEventBus, ICliUserEvent } from '@qodalis/cli-core';
import { Observable, Subscription } from 'rxjs';

/**
 * The users plugin publishes every user event on the terminal's event bus as
 * `user:<type>` (e.g. `user:login`, `user:password_changed`), so other
 * plugins can react without depending on this plugin's services:
 *
 * ```ts
 * context.events?.on('user:login', (e) => console.log(e.data.user.name));
 * context.events?.on('user:*', (e) => audit(e.type));
 * ```
 */
declare module '@qodalis/cli-core' {
    interface CliEventMap {
        'user:login': ICliUserEvent;
        'user:logout': ICliUserEvent;
        'user:login_failed': ICliUserEvent;
        'user:user_created': ICliUserEvent;
        'user:user_deleted': ICliUserEvent;
        'user:user_updated': ICliUserEvent;
        'user:password_changed': ICliUserEvent;
        'user:user_switched': ICliUserEvent;
        'user:user_disabled': ICliUserEvent;
        'user:user_enabled': ICliUserEvent;
        'user:group_created': ICliUserEvent;
        'user:group_updated': ICliUserEvent;
        'user:group_deleted': ICliUserEvent;
        'user:group_member_added': ICliUserEvent;
        'user:group_member_removed': ICliUserEvent;
        'user:session_revoked': ICliUserEvent;
        'user:audit_cleared': ICliUserEvent;
    }
}

/** Forward user events to the event bus as `user:<type>`. */
export function publishUserEvents(
    events$: Observable<ICliUserEvent>,
    bus: ICliEventBus | undefined,
): Subscription | undefined {
    if (!bus) return undefined;
    return events$.subscribe((event) => {
        bus.emit(`user:${event.type}`, event, { source: '@qodalis/cli-users' });
    });
}
