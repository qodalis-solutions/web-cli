import { LIBRARY_VERSION } from '../version';
import { getCliNameArt } from '../constants';
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
        try {
            const storeManager = context.services.get<ICliStateStoreManager>(
                CliStateStoreManager_TOKEN,
            );
            const configureStore = storeManager.getStateStore(
                CLI_CONFIGURE_STORE_NAME,
            );
            await configureStore.initialize();
            const state = configureStore.getState<Record<string, any>>();
            if (state?.['system']?.['welcomeMessage']) {
                showOption = state['system']['welcomeMessage'];
            }
        } catch {
            // Configure store not available — use module config
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
            const lines = [
                `🚀 Welcome to Web CLI [Version ${context.writer.wrapInColor(LIBRARY_VERSION, CliForegroundColor.Green)}]`,
                `(c) ${new Date().getFullYear()} Qodalis Solutions. All rights reserved.`,
                getCliNameArt(context.terminal.cols),
                '',
                `📖 ${context.writer.wrapInColor('Documentation:', CliForegroundColor.Green)} https://cli.qodalis.com/docs/`,
                '',
                `💡 Type ${context.writer.wrapInColor("'help'", CliForegroundColor.Cyan)} to see available commands`,
                '',
            ];

            lines.forEach((line) => {
                context.terminal.write(line + '\r\n');
            });
        }

        recordWelcomeMessageDisplay();
        context.showPrompt();
        await context.textAnimator?.showText(getGreetingBasedOnTime(), {
            speed: 60,
            removeAfterTyping: true,
        });
    },
};

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
