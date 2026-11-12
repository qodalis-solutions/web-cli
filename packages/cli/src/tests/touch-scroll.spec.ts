import { Terminal } from '@xterm/xterm';
import { enableTouchScroll } from '../lib/engine/cli-touch-scroll';

/** A terminal of 10 rows, 20px each, with 50 rows of scrollback. */
function fakeTerminal() {
    const element = document.createElement('div');
    const screenEl = document.createElement('div');
    screenEl.className = 'xterm-screen';
    Object.defineProperty(screenEl, 'clientHeight', { value: 200 });
    element.appendChild(screenEl);
    const textarea = document.createElement('textarea');
    element.appendChild(textarea);
    document.body.appendChild(element);
    const buffer = { viewportY: 50 };
    const scrollLines = jasmine
        .createSpy('scrollLines')
        .and.callFake((rows: number) => {
            buffer.viewportY = Math.max(
                0,
                Math.min(50, buffer.viewportY + rows),
            );
        });
    const terminal = {
        element,
        textarea,
        rows: 10,
        buffer: { active: buffer },
        scrollLines,
    } as unknown as Terminal;
    return { terminal, element, textarea, buffer, scrollLines };
}

function touch(target: Element, type: string, y?: number): TouchEvent {
    const touches =
        y === undefined
            ? []
            : [new Touch({ identifier: 1, target, clientX: 10, clientY: y })];
    const event = new TouchEvent(type, {
        touches,
        changedTouches: touches,
        bubbles: true,
        cancelable: true,
    });
    target.dispatchEvent(event);
    return event;
}

describe('enableTouchScroll', () => {
    let fake: ReturnType<typeof fakeTerminal>;
    let dispose: () => void;

    beforeEach(() => {
        fake = fakeTerminal();
    });

    afterEach(() => {
        dispose?.();
        fake.element.remove();
    });

    it('scrolls the scrollback with a finger drag and keeps the page still', () => {
        dispose = enableTouchScroll(fake.terminal);
        touch(fake.element, 'touchstart', 100);
        const move = touch(fake.element, 'touchmove', 160);
        expect(move.defaultPrevented).toBeTrue();
        expect(fake.buffer.viewportY).toBe(47);
        const end = touch(fake.element, 'touchend');
        expect(end.defaultPrevented).toBeTrue();
    });

    it('scrolls back down when the finger moves up', () => {
        fake.buffer.viewportY = 10;
        dispose = enableTouchScroll(fake.terminal);
        touch(fake.element, 'touchstart', 200);
        touch(fake.element, 'touchmove', 100);
        expect(fake.buffer.viewportY).toBe(15);
        touch(fake.element, 'touchend');
    });

    it('leaves a tap alone', () => {
        dispose = enableTouchScroll(fake.terminal);
        touch(fake.element, 'touchstart', 100);
        const move = touch(fake.element, 'touchmove', 104);
        const end = touch(fake.element, 'touchend');
        expect(move.defaultPrevented).toBeFalse();
        expect(end.defaultPrevented).toBeFalse();
        expect(fake.scrollLines).not.toHaveBeenCalled();
        expect(fake.textarea.hasAttribute('inputmode')).toBeFalse();
    });

    it('hands touches back while paused', () => {
        dispose = enableTouchScroll(fake.terminal, () => true);
        touch(fake.element, 'touchstart', 100);
        const move = touch(fake.element, 'touchmove', 200);
        expect(move.defaultPrevented).toBeFalse();
        expect(fake.scrollLines).not.toHaveBeenCalled();
    });

    it('stops listening once disposed', () => {
        enableTouchScroll(fake.terminal)();
        touch(fake.element, 'touchstart', 100);
        const move = touch(fake.element, 'touchmove', 200);
        expect(move.defaultPrevented).toBeFalse();
        expect(fake.scrollLines).not.toHaveBeenCalled();
    });
});
