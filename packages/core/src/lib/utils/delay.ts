/**
 * Returns a promise that resolves after the given number of milliseconds.
 * @param ms Delay duration in milliseconds
 */
export const delay = (ms: number): Promise<void> => {
    return new Promise((resolve) => setTimeout(resolve, ms));
};
