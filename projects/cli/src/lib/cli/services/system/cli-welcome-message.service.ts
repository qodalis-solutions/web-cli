import { Injectable } from '@angular/core';
import { LIBRARY_VERSION } from '../../../version';
import { getCliNameArt } from '../../constants';
import { CliForegroundColor, ICliExecutionContext } from '@qodalis/cli-core';
import { getGreetingBasedOnTime } from '../../../utils';

/**
 * Service that displays the welcome message to the user.
 */
@Injectable({
    providedIn: 'root',
})
export class CliWelcomeMessageService {
    /**
     * Displays the welcome message to the user.
     * @param context
     * @returns void
     */
    public displayWelcomeMessage(context: ICliExecutionContext) {
        const welcomeConfig = context.options?.welcomeMessage;

        // Handle the 'show' property
        if (welcomeConfig?.show) {
            const showOption = welcomeConfig.show;

            // Determine if the welcome message should be shown
            if (!this.shouldDisplayWelcomeMessage(showOption)) {
                context.showPrompt();
                return;
            }
        }

        if (welcomeConfig?.message) {
            context.terminal.writeln(welcomeConfig?.message);
        } else {
            const welcomeMessage = [
                `🚀 Welcome to Web CLI [Version ${context.writer.wrapInColor(LIBRARY_VERSION, CliForegroundColor.Green)}]`,
                '(c) 2024 Qodalis Solutions. All rights reserved.',
                getCliNameArt(context.terminal.cols),
                '',
                `📖 ${context.writer.wrapInColor('Documentation:', CliForegroundColor.Green)} https://cli.qodalis.com/docs/`,
                '',
                `💡 Type ${context.writer.wrapInColor('\'help\'', CliForegroundColor.Cyan)} to see available commands`,
                '',
            ];

            welcomeMessage.forEach((line, index) => {
                context.terminal.write(line + '\r\n');
            });
        }

        this.recordWelcomeMessageDisplay();
        context.showPrompt();
        context.textAnimator?.showText(getGreetingBasedOnTime(), {
            speed: 60,
            removeAfterTyping: true,
        });
    }

    /**
     * Determines if the welcome message should be displayed based on the show option.
     * @param showOption - The show option from the config.
     * @returns true if the message should be displayed, false otherwise.
     */
    private shouldDisplayWelcomeMessage(
        showOption: 'always' | 'once' | 'daily' | 'never',
    ): boolean {
        const lastDisplayed = this.getLastWelcomeMessageDisplayTime();

        switch (showOption) {
            case 'always':
                return true;
            case 'once':
                return !lastDisplayed; // Show only if it hasn't been shown before
            case 'daily':
                if (!lastDisplayed) return true; // No previous display, show it
                const now = new Date();
                const lastDate = new Date(lastDisplayed);
                return now.toDateString() !== lastDate.toDateString(); // Compare dates
            case 'never':
                return false;
            default:
                return true;
        }
    }

    /**
     * Records the current time as the last display time for the welcome message.
     */
    private recordWelcomeMessageDisplay(): void {
        localStorage.setItem(
            'cliWelcomeMessageLastDisplayed',
            new Date().toISOString(),
        );
    }

    /**
     * Retrieves the last display time of the welcome message.
     * @returns The ISO string of the last display time or null if not recorded.
     */
    private getLastWelcomeMessageDisplayTime(): string | null {
        return localStorage.getItem('cliWelcomeMessageLastDisplayed');
    }
}
