import { CliKeyData } from '@qodalis/cli-core';
import { CliEngine } from '../lib/engine';
import {
    CLI_KEY_PRESSES,
    CLI_SEND_KEYS,
    CliStickyModifier,
    applyStickyCtrlToKeyboard,
    ctrlLetterPress,
    sendTerminalKey,
} from '../lib/keys';
import { CliPanelController, headerMenuItems, panelWrapperClass, runHeaderMenuAction, sendKeyMenuItems } from '../lib/panel';

/** A terminal whose input records what reaches it: keydowns and typed text. */
function fakeTerminal() {
    const textarea = document.createElement('textarea');
    const keydowns: KeyboardEvent[] = [];
    const typed: string[] = [];
    textarea.addEventListener('keydown', (e) => keydowns.push(e));
    document.body.appendChild(textarea);
    const terminal = {
        textarea,
        input: (data: string) => typed.push(data),
    };
    return { terminal, keydowns, typed, dispose: () => textarea.remove() };
}

function fakeEngine(terminal: object, controls?: object, command = 'nano') {
    return {
        getContext: () => ({
            isExecuting: false,
            notifier: {},
            backgroundServices: { list: () => [], on: () => () => undefined },
            services: { get: () => undefined },
            contextProcessor: controls ? { command, controls } : undefined,
        }),
        getTerminal: () => terminal,
        setTheme: () => undefined,
        clearUserTheme: () => false,
        applyUserTheme: () => true,
        destroy: () => undefined,
        focus: jasmine.createSpy('focus'),
    } as unknown as CliEngine & { focus: jasmine.Spy };
}

function panel(config: object = {}) {
    return new CliPanelController({
        config,
        persistPosition: false,
        persistTheme: false,
        viewport: () => ({ width: 412, height: 915 }),
    });
}

describe('terminal keys', () => {
    it('sends key presses as keydowns xterm maps by keyCode, and text as input', () => {
        const t = fakeTerminal();
        sendTerminalKey(t.terminal as never, { press: CLI_KEY_PRESSES.escape });
        sendTerminalKey(t.terminal as never, { press: ctrlLetterPress('c') });
        sendTerminalKey(t.terminal as never, { text: '|' });
        expect(t.keydowns.map((e) => [e.key, e.keyCode, e.ctrlKey])).toEqual([
            ['Escape', 27, false],
            ['c', 67, true],
        ]);
        expect(t.typed).toEqual(['|']);
        t.dispose();
    });

    it('only letters have a Ctrl press', () => {
        expect(ctrlLetterPress('L')).toEqual({ key: 'l', code: 'KeyL', keyCode: 76, ctrlKey: true });
        expect(ctrlLetterPress('1')).toBeUndefined();
        expect(ctrlLetterPress('ab')).toBeUndefined();
    });

    it('the menu has the prompt shortcuts, history and "Ctrl + key" last', () => {
        expect(CLI_SEND_KEYS.map((k) => k.label)).toEqual([
            'Ctrl+C',
            'Ctrl+L',
            'Ctrl+A',
            'Ctrl+E',
            'Ctrl+U',
            'Ctrl+K',
            'Ctrl+W',
            'Ctrl+Y',
            'Ctrl+D',
            'Esc',
            'Tab',
            'Shift+Tab',
            '↑',
            '↓',
            'Ctrl + key',
        ]);
        expect(CLI_SEND_KEYS[CLI_SEND_KEYS.length - 1].press).toBeUndefined();
    });

    describe('sticky Ctrl', () => {
        it('applies to the next key only', () => {
            const states: string[] = [];
            const ctrl = new CliStickyModifier((state) => states.push(state));
            ctrl.arm();
            expect(ctrl.consume()).toBeTrue();
            expect(ctrl.consume()).toBeFalse();
            expect(states).toEqual(['once', 'off']);
        });

        it('turns a letter typed on the keyboard into Ctrl+<letter>, and lets the rest through', () => {
            const t = fakeTerminal();
            const ctrl = new CliStickyModifier();
            const stop = applyStickyCtrlToKeyboard(ctrl, (target) => (target === t.terminal.textarea ? (t.terminal as never) : undefined));

            ctrl.arm();
            const typed = new KeyboardEvent('keydown', { key: 'l', bubbles: true, cancelable: true });
            t.terminal.textarea.dispatchEvent(typed);
            expect(typed.defaultPrevented).toBeTrue();
            expect(t.keydowns.filter((e) => e.ctrlKey).map((e) => e.code)).toEqual(['KeyL']);
            expect(ctrl.state).toBe('off');

            // Keyboards without key codes send the letter as an input event
            ctrl.arm();
            const input = new InputEvent('beforeinput', { data: 'u', inputType: 'insertText', bubbles: true, cancelable: true });
            t.terminal.textarea.dispatchEvent(input);
            expect(input.defaultPrevented).toBeTrue();
            expect(t.keydowns.filter((e) => e.ctrlKey).map((e) => e.code)).toEqual(['KeyL', 'KeyU']);

            // Ctrl off: typing is left alone
            const plain = new KeyboardEvent('keydown', { key: 'x', bubbles: true, cancelable: true });
            t.terminal.textarea.dispatchEvent(plain);
            expect(plain.defaultPrevented).toBeFalse();
            stop();
            t.dispose();
        });
    });
});

describe('panel keys', () => {
    describe('Send key menu', () => {
        it('adds no keys row: keys are sent from the menu only', () => {
            const c = panel();
            c.toggle();
            expect(Object.keys(c.getSnapshot())).not.toContain('extraKeysVisible');
            c.destroy();
        });

        it('lists the prompt shortcuts, after the keys of the command running', () => {
            const c = panel();
            c.toggle();
            c.registerEngine(
                1,
                1,
                fakeEngine(fakeTerminal().terminal, {
                    keys: [{ label: 'Save', key: 'Ctrl+S', data: CliKeyData.ctrl('s'), description: 'Save the file' }],
                }),
            );
            c.toggleSendKeyMenu();
            const items = sendKeyMenuItems(c.getSnapshot());
            expect(items[0]).toEqual(
                jasmine.objectContaining({ label: 'Ctrl+S', description: 'Save the file', heading: 'nano', send: { data: '\x13' } }),
            );
            expect(items[1]).toEqual(jasmine.objectContaining({ label: 'Ctrl+C', heading: 'Keys', separatorBefore: true }));
            c.destroy();
        });

        it('without a command, starts with the prompt shortcuts', () => {
            const c = panel();
            c.toggleSendKeyMenu();
            const items = sendKeyMenuItems(c.getSnapshot());
            expect(items[0].label).toBe('Ctrl+C');
            expect(items[0].heading).toBeUndefined();
            expect(items.length).toBe(CLI_SEND_KEYS.length);
            c.destroy();
        });

        it('sends a combination, closes and gives the terminal the focus back', () => {
            const t = fakeTerminal();
            const engine = fakeEngine(t.terminal, { keys: [{ label: 'Exit', data: CliKeyData.ctrl('x') }] });
            const c = panel();
            const root = document.createElement('div');
            c.setRootElement(root);
            c.toggle();
            c.registerEngine(1, 1, engine);
            c.toggleSendKeyMenu();
            const items = sendKeyMenuItems(c.getSnapshot());

            c.sendKey(items.find((i) => i.label === 'Ctrl+L')!.send);
            expect(c.getSnapshot().sendKeyMenuOpen).toBeFalse();
            expect(t.keydowns.map((e) => [e.code, e.ctrlKey])).toEqual([['KeyL', true]]);
            expect(engine.focus).toHaveBeenCalled();

            // A command's key sends the data it reads
            c.sendKey(items[0].send);
            expect(t.typed).toEqual(['\x18']);

            // "Ctrl + key" holds Ctrl for the next key, which the panel shows
            c.sendKey(items[items.length - 1].send);
            expect(c.getSnapshot().ctrlModifier).toBe('once');
            expect(panelWrapperClass(c.getSnapshot())).toContain('ctrl-held');

            // ...and a letter typed on the keyboard gets it
            const typed = new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true });
            t.terminal.textarea.dispatchEvent(typed);
            expect(typed.defaultPrevented).toBeTrue();
            expect(t.keydowns.filter((e) => e.ctrlKey).map((e) => e.code)).toEqual(['KeyL', 'KeyA']);
            expect(panelWrapperClass(c.getSnapshot())).not.toContain('ctrl-held');
            c.destroy();
            t.dispose();
        });

        it('is the only open menu, and opens from the ⋮ menu of a narrow panel', () => {
            const anchor = document.createElement('button');
            document.body.appendChild(anchor);
            const c = panel();
            c.toggleThemeDropdown();
            c.toggleSendKeyMenu();
            expect(c.getSnapshot().themeDropdownOpen).toBeFalse();
            c.closeMenus();
            expect(c.getSnapshot().sendKeyMenuOpen).toBeFalse();

            c.updatePanelWidth(400);
            c.toggleHeaderMenu(anchor);
            const item = headerMenuItems(c.getSnapshot()).find((i) => i.key === 'send-key')!;
            expect(item.label).toBe('Send key');
            runHeaderMenuAction(c, item);
            expect(c.getSnapshot().headerMenuOpen).toBeFalse();
            expect(c.getSnapshot().sendKeyMenuOpen).toBeTrue();
            expect(c.getSnapshot().sendKeyMenuStyle['position']).toBe('fixed');
            c.destroy();
            anchor.remove();
        });

        it('can be turned off', () => {
            const c = panel({ sendKeys: false });
            c.updatePanelWidth(400);
            expect(headerMenuItems(c.getSnapshot()).some((i) => i.key === 'send-key')).toBeFalse();
            c.setOptions({ sendKeys: true });
            expect(headerMenuItems(c.getSnapshot()).some((i) => i.key === 'send-key')).toBeTrue();
            c.destroy();
        });
    });
});
