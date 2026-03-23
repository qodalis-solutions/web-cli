import {
    ITerminalOptions,
    ITerminalInitOnlyOptions,
    Terminal,
} from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { SerializeAddon } from '@xterm/addon-serialize';
import { DefaultThemes } from '@qodalis/cli-core';
import { OverlayAddon } from '../addons/overlay';
import { CliDragDropService } from '../services/cli-drag-drop.service';

export interface TerminalSetupResult {
    terminal: Terminal;
    fitAddon: FitAddon;
    serializeAddon: SerializeAddon;
    dragDropService: CliDragDropService;
    wheelListener: (e: WheelEvent) => void;
}

/**
 * Merge user-supplied terminal options with sensible defaults.
 */
export function getTerminalOptions(
    userOptions?: Partial<ITerminalOptions & ITerminalInitOnlyOptions>,
): ITerminalOptions & ITerminalInitOnlyOptions {
    return {
        cursorBlink: true,
        allowProposedApi: true,
        fontSize: 20,
        theme: DefaultThemes.default,
        convertEol: true,
        ...(userOptions ?? {}),
    };
}

/**
 * Create and configure an xterm.js Terminal with all required addons,
 * open it into the given container, and return the instances.
 */
export function initializeTerminal(
    container: HTMLElement,
    opts: ITerminalOptions & ITerminalInitOnlyOptions,
): TerminalSetupResult {
    const terminal = new Terminal(opts);

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(new WebLinksAddon());
    terminal.loadAddon(new OverlayAddon());
    terminal.loadAddon(new Unicode11Addon());
    const serializeAddon = new SerializeAddon();
    terminal.loadAddon(serializeAddon);

    terminal.open(container);
    fitAddon.fit();

    // Mark the container so the theme processor can update its background
    // when the theme changes, and set the initial background to match.
    container.classList.add('terminal-container');
    container.style.background = opts.theme?.background ?? '#000';

    // Prevent wheel events from scrolling the host page
    const wheelListener = (e: WheelEvent) => e.preventDefault();
    container.addEventListener('wheel', wheelListener, { passive: false });

    terminal.focus();

    const dragDropService = new CliDragDropService(container);

    return { terminal, fitAddon, serializeAddon, dragDropService, wheelListener };
}

/** Maximum time (ms) to wait for container layout before rejecting. */
const LAYOUT_TIMEOUT_MS = 10_000;

/**
 * Wait until the container element has non-zero dimensions.
 * xterm.js requires the host element to be laid out before open() is called.
 * Rejects after {@link LAYOUT_TIMEOUT_MS} if the container stays hidden.
 */
export function waitForLayout(container: HTMLElement): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        const deadline = Date.now() + LAYOUT_TIMEOUT_MS;
        const check = () => {
            if (
                container.offsetWidth > 0 &&
                container.offsetHeight > 0
            ) {
                resolve();
                return;
            }
            if (Date.now() >= deadline) {
                reject(new Error(
                    'CliEngine.start(): container has zero dimensions after ' +
                    `${LAYOUT_TIMEOUT_MS}ms. Ensure the container ` +
                    'element is visible and laid out before calling start().',
                ));
                return;
            }
            requestAnimationFrame(check);
        };
        check();
    });
}
