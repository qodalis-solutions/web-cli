import {
    CliProcessCommand,
    CliProcessorMetadata,
    CliStateConfiguration,
} from '../models';
import { ICliProcessorHook } from './command-hooks';
import { ICliExecutionContext } from './execution-context';

export interface ICliCommandAuthor {
    /**
     * The name of the author
     */
    name: string;

    /**
     * The email of the author
     */
    email: string;
}

/**
 * Represents a command parameter
 */
export interface ICliCommandParameterDescriptor {
    /**
     * The name of the parameter
     */
    name: string;

    /**
     * Aliases for the parameter
     */
    aliases?: string[];

    /**
     * A description of the parameter
     */
    description: string;

    /**
     * If true, the parameter is required
     */
    required: boolean;

    /**
     * The type of the parameter
     */
    type: 'string' | 'number' | 'boolean' | 'array' | 'object' | string;

    /**
     * The default value of the parameter
     */
    defaultValue?: any;

    /**
     * A validator function that validates the value of the parameter
     * @param value The value to validate
     * @returns An object with a valid property that indicates if the value is valid and an optional message property that contains a message to display if the value is not valid
     */
    validator?: (value: any) => {
        /**
         * Indicates if the value is valid
         */
        valid: boolean;

        /**
         * An optional message to display if the value is not valid
         */
        message?: string;
    };
}

/**
 * Represents a configuration option that a command processor exposes
 * for management via the `configure` command.
 */
export interface ICliConfigurationOption {
    /**
     * The key used to store and retrieve this option, e.g. 'maxItems'
     */
    key: string;

    /**
     * Human-readable label shown in the interactive menu
     */
    label: string;

    /**
     * Description of what this option controls
     */
    description: string;

    /**
     * The data type of the option
     */
    type: 'string' | 'number' | 'boolean' | 'select';

    /**
     * The default value when no configuration has been set
     */
    defaultValue: any;

    /**
     * Available choices for 'select' type options
     */
    options?: { label: string; value: any }[];

    /**
     * Optional validator function
     */
    validator?: (value: any) => { valid: boolean; message?: string };

    /**
     * Override the category grouping (defaults to the processor command name)
     */
    category?: string;
}

/**
 * Represents a command processor
 */
export interface ICliCommandProcessor {
    /**
     * The command that this processor handles
     */
    command: string;

    /**
     * Alternative names for the command
     */
    aliases?: string[];

    /**
     * A description of the command
     */
    description?: string;

    /**
     * The author of the command
     */
    author?: ICliCommandAuthor;

    /**
     * If true, the processor accepts raw text input after the command name as its value.
     * The captured text is available via `command.value` in `processCommand`.
     * @default false
     * @remarks When true, any text following the command name is extracted as the command value
     * rather than being interpreted as sub-commands. Use `valueRequired` instead if the value is mandatory.
     */
    acceptsRawInput?: boolean;

    /**
     * If true, the command requires some form of input before it can execute.
     *
     * The requirement is satisfied by **any** of:
     * - A positional value (text after the command name, available via `command.value`)
     * - Piped data from a previous command (available via `command.data`)
     * - Named arguments (e.g. `--server=node --path=/app`)
     *
     * When set, `command.value` is automatically extracted from the raw input
     * (equivalent to setting `acceptsRawInput`).
     *
     * Additionally, when positional input is present the engine skips
     * required-parameter validation — the processor is responsible for
     * parsing positional text into individual values.  Required-parameter
     * checks still apply when the user provides only named arguments.
     *
     * @default false
     */
    valueRequired?: boolean;

    /**
     * The version of the command processor
     * @default '1.0.0'
     */
    version?: string;

    /**
     * The metadata for the command processor
     */
    metadata?: CliProcessorMetadata;

    /**
     * Processors that are nested under this processor
     */
    processors?: ICliCommandChildProcessor[];

    /**
     * Parameters that the command accepts
     */
    parameters?: ICliCommandParameterDescriptor[];

    /**
     * Hooks that are executed before and after the command is processed
     */
    hooks?: ICliProcessorHook[];

    /**
     * Represents the state configuration for the command processor
     * @remarks The state configuration is used to store and retrieve state information for the command processor
     * @remarks State configuration is optional and can be used to store and retrieve state information for the command processor
     * @remarks The state configuration is used only for root command processors and not for child command processors
     */
    stateConfiguration?: CliStateConfiguration;

    /**
     * Configuration options exposed by this processor for the `configure` command.
     * When defined, these options appear in the interactive configuration menu
     * and can be managed via `configure get/set` subcommands.
     */
    configurationOptions?: ICliConfigurationOption[];

    /**
     * When true, this processor extends (wraps) an existing processor with the same
     * command name instead of replacing it. The registry sets `originalProcessor`
     * to the previous processor so this one can delegate to it.
     */
    extendsProcessor?: boolean;

    /**
     * Reference to the original processor that this one extends.
     * Set automatically by the registry — do not set manually.
     * Call `this.originalProcessor.processCommand(command, context)` to delegate.
     */
    originalProcessor?: ICliCommandProcessor;

    /**
     * Process the command
     * @param command The command to process
     * @param context The context in which the command is executed
     */
    processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void>;

    /**
     * Write the description of the command
     * @param context The context in which the command is executed
     */
    writeDescription?(context: ICliExecutionContext): void;

    /**
     * A function that validates the command before execution
     * @param value The value to validate
     * @returns An object with a valid property that indicates if the value is valid and an optional message property that contains a message to display if the value is not valid
     */
    validateBeforeExecution?: (
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ) => {
        valid: boolean;
        message?: string;
    };

    /**
     * Initialize the command processor
     * @param context The context in which the command is executed
     */
    initialize?(context: ICliExecutionContext): Promise<void>;

    /**
     * Handle raw terminal data when this processor is the active context processor.
     * When implemented, ALL terminal input is routed here instead of normal CLI input handling.
     * Used for full-screen interactive modes (editors, pagers, etc.).
     * @param data The raw terminal data string (escape sequences, control chars, printable text)
     * @param context The execution context
     */
    onData?(data: string, context: ICliExecutionContext): Promise<void>;

    /**
     * Called when the terminal is resized while this processor is the active
     * full-screen context processor. Allows processors to adapt their rendering
     * to the new terminal dimensions.
     * @param cols The new number of columns
     * @param rows The new number of rows
     * @param context The execution context
     */
    onResize?(
        cols: number,
        rows: number,
        context: ICliExecutionContext,
    ): void;

    /**
     * Called when the processor is being disposed — either because full-screen
     * mode ended, the terminal disconnected, or the CLI component is being
     * destroyed. Use this to clean up resources (timers, subscriptions, etc.).
     * @param context The execution context
     */
    onDispose?(context: ICliExecutionContext): void;
}

/**
 * Represents a child command processor
 */
export interface ICliCommandChildProcessor extends ICliCommandProcessor {
    /**
     * The parent processor, it is populated by the processor manager
     */
    parent?: ICliCommandProcessor;
}
