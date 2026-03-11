export interface ICliProgressBar {
    /**
     * Indicates if the progress bar is running
     */
    isRunning: boolean;

    /**
     * Show the progress bar
     */
    show: (text?: string) => void;

    /**
     * Hide the progress bar
     */
    hide: () => void;
}

/**
 * Represents a spinner for the CLI
 */
export interface ICliSpinner extends ICliProgressBar {
    /**
     * Set the text of the spinner
     * @param text The text to set
     */
    setText: (text: string) => void;
}

export type CliPercentageProgressBarUpdateValueOptions = {
    /**
     * The type of update to perform
     * @default 'replace'
     */
    type?: 'replace' | 'increment';
};

/**
 * Represents a progress bar for the CLI
 */
export interface ICliPercentageProgressBar extends ICliProgressBar {
    /**
     * Update the progress of the progress bar
     * @param progress The progress to update to
     * @returns void
     */
    update: (
        progress: number,
        options?: CliPercentageProgressBarUpdateValueOptions,
    ) => void;

    /**
     * Complete the progress bar
     * @returns void
     */
    complete: () => void;

    /**
     * Set the text of the spinner
     * @param text The text to set
     */
    setText: (text: string) => void;
}

export type CliTextAnimatorOptions = {
    /**
     * The speed of the animation
     * @default 100
     */
    speed?: number;

    /**
     * The text will be removed after typing
     */
    removeAfterTyping?: boolean;
};

export interface ICliTextAnimator extends ICliProgressBar {
    /**
     * Show animated text in a typing and erasing effect.
     * @param text
     * @param options
     * @returns
     */
    showText: (text: string, options?: CliTextAnimatorOptions) => Promise<void>;
}
