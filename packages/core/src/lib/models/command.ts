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
     * The value of the command: the text after the command (and sub-command)
     * words, flags removed, as typed (quotes included). Prefer `positionals`
     * to read arguments.
     */
    value?: string;

    /**
     * The positional arguments, split like a shell: quotes removed
     * (`"my file.txt"` is one argument), backslash escapes applied, flags
     * excluded. `cat "a b.txt" c.txt` has `['a b.txt', 'c.txt']`. Set by the
     * engine for every command; empty when there are none.
     */
    positionals?: string[];

    /**
     * The arguments that were entered
     */
    args: Record<string, any>;
};
