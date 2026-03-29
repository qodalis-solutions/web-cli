import { Subject } from 'rxjs';
import { ICliNotifier, CliNotification, CliNotificationLevel } from '@qodalis/cli-core';

export class CliNotifier implements ICliNotifier {
    private _current: CliNotification | undefined;
    private readonly _change$ = new Subject<CliNotification | undefined>();

    readonly change$ = this._change$.asObservable();

    get current(): CliNotification | undefined {
        return this._current;
    }

    info(message: string): void {
        this.set('info', message);
    }

    success(message: string): void {
        this.set('success', message);
    }

    warn(message: string): void {
        this.set('warn', message);
    }

    error(message: string): void {
        this.set('error', message);
    }

    clear(): void {
        this._current = undefined;
        this._change$.next(undefined);
    }

    private set(level: CliNotificationLevel, message: string): void {
        this._current = { level, message, timestamp: Date.now() };
        this._change$.next(this._current);
    }
}
