export interface ICliExecutionProcess {
    /**
     * Indicates if the process has exited
     */
    exited?: boolean;

    /**
     * The exit code of the process
     */
    exitCode?: number;

    /**
     * Indicates if the process is running
     */
    running: boolean;

    /**
     * The data of the process
     */
    data: any | undefined;

    /**
     * Exit the process
     * @param code The exit code
     * @returns void
     */
    exit: (
        /**
         * The exit code
         */
        code?: number,

        /**
         * Options for exiting the process
         */
        options?: {
            /**
             * Indicates if the exit should be silent, i.e. not throw an error
             */
            silent?: boolean;
        },
    ) => void;

    /**
     * Output data from the process
     * @param data The data to output
     */
    output(data: any): void;
}
