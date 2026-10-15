import { ICliUserEventService, ICliUserEvent } from '@qodalis/cli-core';
import { Subject, Observable } from 'rxjs';

export class CliDefaultUserEventService implements ICliUserEventService {
    private subject = new Subject<ICliUserEvent>();

    readonly events$: Observable<ICliUserEvent> = this.subject.asObservable();

    emit(event: ICliUserEvent): void {
        this.subject.next(event);
    }
}
