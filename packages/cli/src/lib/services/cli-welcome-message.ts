import { LIBRARY_VERSION } from '../version';
import { resolveCliBranding } from '../constants';
import {
    CliForegroundColor,
    ICliModule,
    CLI_CONFIGURE_STORE_NAME,
} from '@qodalis/cli-core';
import { getGreetingBasedOnTime } from '../utils';
import { CliStateStoreManager_TOKEN } from '../tokens';
import { ICliStateStoreManager } from '../state/cli-state-store-manager';

export interface CliWelcomeMessageConfig {
    /** Custom message to display instead of the default */
    message?: string;
    /** When to show the welcome message (default: 'always') */
    show?: 'always' | 'once' | 'daily' | 'never';
}

interface ICliWelcomeModule extends ICliModule {
    configure(config: CliWelcomeMessageConfig): ICliModule;
}

export const welcomeModule: ICliWelcomeModule = {
    apiVersion: 2,
    name: '@qodalis/cli-welcome',
    priority: -1,

    configure(config: CliWelcomeMessageConfig): ICliModule {
        return { ...this, config };
    },

    async onAfterBoot(context) {
        const config = (this.config || {}) as CliWelcomeMessageConfig;

        // Check the configure command's persisted state first, then fall back to module config
        let showOption = config.show;
        const storeManager = context.services.get<ICliStateStoreManager>(
            CliStateStoreManager_TOKEN,
        );
        if (storeManager) {
            const configureStore = storeManager.getStateStore(
                CLI_CONFIGURE_STORE_NAME,
            );
            await configureStore.initialize();
            const state = configureStore.getState<Record<string, any>>();
            // configure stores its defaults up front, so 'always' there is not a choice and the host's option stays
            const stored = state?.['system']?.['welcomeMessage'];
            if (stored && stored !== 'always') {
                showOption = stored;
            }
        }

        if (showOption) {
            if (!shouldDisplayWelcomeMessage(showOption)) {
                context.showPrompt();
                return;
            }
        }

        if (config.message) {
            context.terminal.writeln(config.message);
        } else {
            const branding = resolveCliBranding(context.options?.branding);
            const art = branding.art(context.terminal.cols);
            const lines = [
                `🚀 Welcome to ${branding.name} [Version ${context.writer.wrapInColor(LIBRARY_VERSION, CliForegroundColor.Green)}]`,
                `(c) ${new Date().getFullYear()} Qodalis Solutions. All rights reserved.`,
                art,
                '',
                `📖 ${context.writer.wrapInColor('Documentation:', CliForegroundColor.Green)} https://cli.qodalis.com/docs/`,
                '',
                `💡 Type ${context.writer.wrapInColor("'help'", CliForegroundColor.Cyan)} to see available commands`,
                '',
            ];

            lines.forEach((line) => {
                // The art is drawn for the width already; text wraps at words
                const wrapped =
                    line === art
                        ? [line]
                        : wrapWelcomeLine(line, context.terminal.cols);
                wrapped.forEach((part) =>
                    context.terminal.write(part + '\r\n'),
                );
            });
        }

        recordWelcomeMessageDisplay();
        context.showPrompt();
        bannerShown.add(context);
    },
};

/** Contexts that showed the welcome banner; the greeting follows only those. */
const bannerShown = new WeakSet<object>();

/**
 * Animated, time-based greeting on the first prompt. Runs after every other
 * module's `onAfterBoot` hook (setup and sign-in prompts come first), and
 * only when the welcome banner was shown.
 */
export const greetingModule: ICliModule = {
    apiVersion: 2,
    name: '@qodalis/cli-greeting',
    priority: Number.MAX_VALUE,

    async onAfterBoot(context) {
        if (!bannerShown.has(context)) return;

        // Disabled with `configure set system.greeting false`
        const storeManager = context.services.get<ICliStateStoreManager>(
            CliStateStoreManager_TOKEN,
        );
        if (storeManager) {
            const configureStore = storeManager.getStateStore(
                CLI_CONFIGURE_STORE_NAME,
            );
            await configureStore.initialize();
            const configState = configureStore.getState<Record<string, any>>();
            if (configState?.['system']?.['greeting'] === false) {
                return;
            }
        }

        // Keys typed during boot are being replayed at the prompt, or a
        // prompt is open: an animated greeting would write over them.
        const host = context as {
            typedDuringBoot?: boolean;
            isReadingInput?: boolean;
        };
        if (
            host.typedDuringBoot ||
            host.isReadingInput ||
            context.currentLine
        ) {
            return;
        }

        // The animation erases itself with backspaces, which cannot go back
        // to a previous row: the greeting must fit on the prompt's line
        const buffer = context.terminal.buffer?.active;
        const room = context.terminal.cols - (buffer?.cursorX ?? 0) - 1;
        const greeting = fitGreeting(getGreetingBasedOnTime(), room);
        if (!greeting) return;

        await context.textAnimator?.showText(greeting, {
            speed: 60,
            removeAfterTyping: true,
        });
    },
};

/**
 * The greeting cut at a word to fit `room` columns (emoji count as two), or
 * null when even its first words do not fit.
 */
export function fitGreeting(text: string, room: number): string | null {
    const width = (value: string) =>
        Array.from(value).reduce(
            (sum, ch) =>
                sum +
                (ch.codePointAt(0)! > 0xffff ||
                /\p{Extended_Pictographic}/u.test(ch)
                    ? 2
                    : ch === '\ufe0f'
                      ? 0
                      : 1),
            0,
        );
    if (width(text) <= room) return text;
    const words = text.split(' ');
    let fitted = '';
    for (const word of words) {
        const next = fitted ? `${fitted} ${word}` : word;
        if (width(next) > room) break;
        fitted = next;
    }
    // An emoji and a word or two is not worth showing
    return fitted.split(' ').length >= 3 ? fitted.replace(/[,;:]$/, '') : null;
}

/**
 * Welcome lines wrapped at words to the terminal width, so a narrow terminal
 * (a phone) never breaks a word across lines. Lines that fit are unchanged.
 */
export function wrapWelcomeLine(line: string, cols: number): string[] {
    const width = Math.max(20, cols - 1);
    const visible = (value: string) =>
        Array.from(value.replace(/\x1b\[[0-9;]*m/g, '')).reduce(
            (sum, ch) =>
                sum +
                (ch.codePointAt(0)! > 0xffff ? 2 : ch === '\ufe0f' ? 0 : 1),
            0,
        );
    if (visible(line) <= width) return [line];
    const lines: string[] = [];
    let current = '';
    for (const word of line.split(' ')) {
        if (current && visible(current) + 1 + visible(word) > width) {
            lines.push(current);
            current = word;
        } else {
            current = current ? `${current} ${word}` : word;
        }
    }
    if (current) lines.push(current);
    return lines;
}

function shouldDisplayWelcomeMessage(
    showOption: 'always' | 'once' | 'daily' | 'never',
): boolean {
    const lastDisplayed = localStorage.getItem(
        'cliWelcomeMessageLastDisplayed',
    );

    switch (showOption) {
        case 'always':
            return true;
        case 'once':
            return !lastDisplayed;
        case 'daily':
            if (!lastDisplayed) return true;
            const now = new Date();
            const lastDate = new Date(lastDisplayed);
            return now.toDateString() !== lastDate.toDateString();
        case 'never':
            return false;
        default:
            return true;
    }
}

function recordWelcomeMessageDisplay(): void {
    localStorage.setItem(
        'cliWelcomeMessageLastDisplayed',
        new Date().toISOString(),
    );
}
