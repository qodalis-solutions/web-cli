import { Observable } from 'rxjs';

export const ICliDragDropService_TOKEN = 'cli-drag-drop-service';

export interface ICliDragDropService {
    /** Emits an array of dropped File objects each time files are dropped onto the terminal */
    readonly onFileDrop: Observable<File[]>;
}
