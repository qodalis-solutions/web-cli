import { ICliUser } from '../models';
import { Observable } from 'rxjs';

/** Represents a user lifecycle event */
export interface ICliUserEvent {
    /** The type of event that occurred */
    type:
        | 'login'
        | 'logout'
        | 'login_failed'
        | 'user_created'
        | 'user_deleted'
        | 'user_updated'
        | 'password_changed'
        | 'user_switched'
        | 'user_disabled'
        | 'user_enabled'
        | 'group_created'
        | 'group_updated'
        | 'group_deleted'
        | 'group_member_added'
        | 'group_member_removed'
        | 'session_revoked'
        | 'audit_cleared';
    /** The user involved in the event (for group events: the acting user) */
    user: ICliUser;
    /** The acting user's name, when different from `user` (e.g. an admin) */
    actor?: string;
    /** When the event occurred */
    timestamp: number;
    /** Optional additional details */
    details?: string;
}

/** Service that emits user lifecycle events for plugins to subscribe to */
export interface ICliUserEventService {
    /** Observable stream of user events */
    readonly events$: Observable<ICliUserEvent>;
    /** Emit a user event */
    emit(event: ICliUserEvent): void;
}
