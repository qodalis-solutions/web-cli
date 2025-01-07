export interface ICliProgressBar {
    /**
     * Indicates if the progress bar is running
     */
    isRunning: boolean;

    /**
     * Show the progress bar
     */
    show: () => void;

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
