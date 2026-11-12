import { Terminal } from '@xterm/xterm';

/** Finger travel before a touch counts as a scroll rather than a tap. */
const SLOP_PX = 8;
/** Below this speed (px/ms) a released swipe stops instead of gliding. */
const MIN_FLING = 0.15;
/** Fraction of the glide speed kept per millisecond (Android's fling feel). */
const FRICTION = 0.997;
/** Moves older than this are left out of the release speed. */
const VELOCITY_WINDOW_MS = 100;
/** How long after a scroll the keyboard stays held back. */
const KEYBOARD_HOLD_MS = 400;

/**
 * Scrolls the terminal's scrollback with a finger, gliding on after a swipe.
 * xterm.js 6 has no touch scrolling of its own, so on phones the output above
 * the screen (the start of `help`) could not be reached.
 *
 * A touch that moves less than {@link SLOP_PX} stays a tap (focus, the
 * keyboard); a scroll never opens the keyboard. Android WebViews show it for
 * any touch while the terminal's textarea has focus, so a touch that starts
 * with the keyboard closed marks the textarea inputmode=none until it is
 * known to be a tap. `paused` hands touches back (full-screen commands such
 * as games read swipes themselves).
 */
export function enableTouchScroll(
    terminal: Terminal,
    paused: () => boolean = () => false,
): () => void {
    const element = terminal.element;
    if (!element) {
        return () => {};
    }
    let startY = 0;
    let lastY = 0;
    let scrolling = false;
    /** Pixels moved that do not yet add up to a whole row. */
    let carry = 0;
    let moves: { y: number; time: number }[] = [];
    let frame = 0;
    let holdTimer = 0;
    /** True while this touch keeps the keyboard closed. */
    let holding = false;

    const textarea = terminal.textarea;
    const keyboardOpen = () => window.innerHeight < screen.height * 0.75;
    const holdKeyboard = () => {
        clearTimeout(holdTimer);
        // Games set inputmode themselves; the textarea is left to them.
        if (
            holding ||
            !textarea ||
            textarea.hasAttribute('inputmode') ||
            keyboardOpen()
        ) {
            return;
        }
        holding = true;
        textarea.setAttribute('inputmode', 'none');
    };
    const releaseKeyboard = () => {
        clearTimeout(holdTimer);
        if (holding) {
            holding = false;
            textarea?.removeAttribute('inputmode');
        }
    };

    const rowHeight = () => {
        const screen = element.querySelector('.xterm-screen');
        return (
            (screen?.clientHeight || element.clientHeight) / terminal.rows || 16
        );
    };
    /** Scrolls by `pixels` (positive: towards older output); false at either end. */
    const scrollBy = (pixels: number): boolean => {
        carry += pixels;
        const height = rowHeight();
        const rows = Math.trunc(carry / height);
        if (rows === 0) {
            return true;
        }
        carry -= rows * height;
        const buffer = terminal.buffer.active;
        const before = buffer.viewportY;
        terminal.scrollLines(-rows);
        const moved = buffer.viewportY !== before;
        if (!moved) {
            carry = 0;
        }
        return moved;
    };
    const stopGlide = () => {
        cancelAnimationFrame(frame);
        frame = 0;
    };
    const glide = (velocity: number) => {
        let previous = performance.now();
        const step = (now: number) => {
            const elapsed = Math.min(now - previous, 50);
            previous = now;
            velocity *= Math.pow(FRICTION, elapsed);
            if (Math.abs(velocity) < 0.02 || !scrollBy(velocity * elapsed)) {
                frame = 0;
                return;
            }
            frame = requestAnimationFrame(step);
        };
        frame = requestAnimationFrame(step);
    };

    const onStart = (e: TouchEvent) => {
        stopGlide();
        scrolling = false;
        if (e.touches.length !== 1 || paused()) {
            return;
        }
        holdKeyboard();
        startY = lastY = e.touches[0].clientY;
        carry = 0;
        moves = [{ y: startY, time: e.timeStamp }];
    };
    const onMove = (e: TouchEvent) => {
        if (e.touches.length !== 1 || paused() || moves.length === 0) {
            return;
        }
        const y = e.touches[0].clientY;
        if (!scrolling && Math.abs(y - startY) < SLOP_PX) {
            return;
        }
        scrolling = true;
        // The page itself never scrolls; the terminal does.
        e.preventDefault();
        scrollBy(y - lastY);
        lastY = y;
        moves.push({ y, time: e.timeStamp });
        while (
            moves.length > 2 &&
            e.timeStamp - moves[0].time > VELOCITY_WINDOW_MS
        ) {
            moves.shift();
        }
    };
    const onEnd = (e: TouchEvent) => {
        if (!scrolling) {
            // A tap: the keyboard opens as usual.
            releaseKeyboard();
            moves = [];
            return;
        }
        // No click follows a scroll, so the keyboard stays as it was.
        e.preventDefault();
        scrolling = false;
        holdTimer = window.setTimeout(releaseKeyboard, KEYBOARD_HOLD_MS);
        const first = moves[0];
        const last = moves[moves.length - 1];
        moves = [];
        const elapsed = last.time - first.time;
        const velocity =
            elapsed > 0 && e.timeStamp - last.time < VELOCITY_WINDOW_MS
                ? (last.y - first.y) / elapsed
                : 0;
        if (Math.abs(velocity) >= MIN_FLING) {
            glide(velocity);
        }
    };

    const options: AddEventListenerOptions = { passive: false, capture: true };
    element.addEventListener('touchstart', onStart, options);
    element.addEventListener('touchmove', onMove, options);
    element.addEventListener('touchend', onEnd, options);
    element.addEventListener('touchcancel', onEnd, options);
    return () => {
        stopGlide();
        releaseKeyboard();
        element.removeEventListener('touchstart', onStart, options);
        element.removeEventListener('touchmove', onMove, options);
        element.removeEventListener('touchend', onEnd, options);
        element.removeEventListener('touchcancel', onEnd, options);
    };
}
