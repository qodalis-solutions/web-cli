export type CliProcessCommand = {
    /**
     * The command that was entered
     */
    command: string;

    /**
     * Pipeline data passed from the previous command in a pipe chain.
     * When commands are piped (e.g. `cmd1 | cmd2`), the output of `cmd1`
     * is captured and passed here as input to `cmd2`. The shape depends
     * on what the upstream command produced (string, JSON object, array, etc.).
     */
    data?: any;

    /**
     * The chain of commands that were entered
     */
    chainCommands: string[];

    /**
     * The raw command that was entered
     */
    rawCommand: string;

    /**
     * The value of the command
     */
    value?: string;

    /**
     * The arguments that were entered
     */
    args: Record<string, any>;
};
