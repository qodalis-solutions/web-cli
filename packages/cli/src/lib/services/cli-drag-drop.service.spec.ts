import { CliDragDropService } from './cli-drag-drop.service';

describe('CliDragDropService', () => {
    let container: HTMLElement;
    let service: CliDragDropService;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        service = new CliDragDropService(container);
    });

    afterEach(() => {
        service.destroy();
        document.body.removeChild(container);
    });

    it('should emit dropped files via onFileDrop', (done) => {
        const fakeFile = new File(['hello'], 'test.txt', { type: 'text/plain' });

        service.onFileDrop.subscribe((files) => {
            expect(files.length).toBe(1);
            expect(files[0].name).toBe('test.txt');
            done();
        });

        const dropEvent = new DragEvent('drop', {
            bubbles: true,
            dataTransfer: new DataTransfer(),
        });
        (dropEvent.dataTransfer as DataTransfer).items.add(fakeFile);
        container.dispatchEvent(dropEvent);
    });

    it('should not emit after destroy()', () => {
        let emitted = false;
        service.onFileDrop.subscribe(() => { emitted = true; });
        service.destroy();

        const dropEvent = new DragEvent('drop', { bubbles: true });
        container.dispatchEvent(dropEvent);
        expect(emitted).toBeFalse();
    });

    it('should call preventDefault on dragover', () => {
        const dragOverEvent = new DragEvent('dragover', { bubbles: true, cancelable: true });
        container.dispatchEvent(dragOverEvent);
        expect(dragOverEvent.defaultPrevented).toBeTrue();
    });
});
