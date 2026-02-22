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
     * If true, the processor can handle unlisted commands
     * @default false
     * @remarks If true, the processor can handle unlisted commands. If false, the processor will only handle commands that are explicitly listed in the processors property
     * @remarks Optional if valueRequired is true
     */
    allowUnlistedCommands?: boolean;

    /**
     * If true, the value is required
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
     * @remarks State confihuration is optional and can be used to store and retrieve state information for the command processor
     * @remarks The state configuration is used only for root command processors and not for child command processors
     */
    stateConfiguration?: CliStateConfiguration;

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
