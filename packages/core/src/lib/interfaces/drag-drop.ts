import { Observable } from 'rxjs';

// Re-export from central tokens for backward compatibility
export { ICliDragDropService_TOKEN } from '../tokens';

export interface ICliDragDropService {
    /** Emits an array of dropped File objects each time files are dropped onto the terminal */
    readonly onFileDrop: Observable<File[]>;
}
