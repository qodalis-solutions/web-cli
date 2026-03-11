import { Observable, Subject } from 'rxjs';
import { ICliDragDropService } from '@qodalis/cli-core';

export class CliDragDropService implements ICliDragDropService {
    private readonly _subject = new Subject<File[]>();
    private readonly _dragOver: (e: DragEvent) => void;
    private readonly _drop: (e: DragEvent) => void;

    constructor(private readonly _container: HTMLElement) {
        this._dragOver = (e: DragEvent) => e.preventDefault();
        this._drop = (e: DragEvent) => {
            e.preventDefault();
            const files = Array.from(e.dataTransfer?.files ?? []);
            if (files.length > 0) {
                this._subject.next(files);
            }
        };

        this._container.addEventListener('dragover', this._dragOver);
        this._container.addEventListener('drop', this._drop);
    }

    get onFileDrop(): Observable<File[]> {
        return this._subject.asObservable();
    }

    destroy(): void {
        this._container.removeEventListener('dragover', this._dragOver);
        this._container.removeEventListener('drop', this._drop);
        this._subject.complete();
    }
}
