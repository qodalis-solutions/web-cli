import { Observable } from 'rxjs';
import { CliNotification } from '../models/notification';

export interface ICliNotifier {
    /** Set an info-level notification (progress, status updates). */
    info(message: string): void;

    /** Set a success-level notification. */
    success(message: string): void;

    /** Set a warn-level notification. */
    warn(message: string): void;

    /** Set an error-level notification. */
    error(message: string): void;

    /** Clear the current notification. */
    clear(): void;

    /** The current notification, or undefined if cleared. */
    readonly current: CliNotification | undefined;

    /** Observable that emits on every change (set or clear). */
    readonly change$: Observable<CliNotification | undefined>;
}
