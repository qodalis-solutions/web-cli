import { Terminal } from '@xterm/xterm';
import { CliCommandExecutorService } from '../services/cli-command-executor.service';
import { Observable, Subject } from 'rxjs';

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
 * Represents a command processor
 */
export interface ICliCommandProcessor {
  /**
   * The command that this processor handles
   */
  command: string;

  /**
   * A description of the command
   */
  description?: string;

  /**
   * The author of the command
   */
  author?: ICliCommandAuthor;

  /**
   * If true, the processor can handle partial commands
   */
  allowPartialCommands?: boolean;

  /**
   * The version of the command processor
   * @default '1.0.0'
   */
  version?: string;

  /**
   * Process the command
   * @param command The command to process
   * @param context The context in which the command is executed
   */
  processCommand(
    command: CliProcessCommand,
    context: ICliExecutionContext
  ): Promise<void>;

  /**
   * Processors that are nested under this processor
   */
  processors?: ICliCommandProcessor[];

  /**
   * Parameters that the command accepts
   */
  parameters?: ICliCommandParameterDescriptor[];

  /**
   * Write the description of the command
   * @param context The context in which the command is executed
   */
  writeDescription?(context: ICliExecutionContext): void;
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
  type: string;

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

export type CliProcessCommand = {
  /**
   * The command that was entered
   */
  command: string;
  /**
   * The raw command that was entered
   */
  rawCommand: string;

  /**
   * The arguments that were entered
   */
  args: Record<string, any>;
};

export type CliLoaderProps = {
  show: () => void;
  hide: () => void;
};

export interface ICliTerminalWriter {
  /**
   * Write text to the terminal
   * @param text The text to write
   */
  write(text: string): void;

  /**
   * Write text to the terminal followed by a newline
   * @param text The text to write
   */
  writeln(text: string): void;

  /**
   * Write a success message to the terminal
   * @param messag The message to write
   * @returns void
   */
  writeSuccess: (message: string) => void;

  /**
   * Write an error message to the terminal
   * @param message The message to write
   * @returns void
   */
  writeError: (message: string) => void;

  /**
   * Write a warning message to the terminal
   * @param message The message to write
   * @returns void
   */
  writeWarning: (message: string) => void;
}

export interface ICliUser extends Record<string, any> {
  /**
   * The id of the user
   */
  id: string;

  /**
   * The name of the user
   */
  name: string;

  /**
   * The email of the user
   */
  email: string;
}

export interface ICliUserSession {
  /**
   * The user associated with the session
   */
  user: ICliUser;

  /**
   * The data associated with the user session
   */
  data?: Record<string, any>;
}

/**
 * Represents the context in which a command is executed
 */
export interface ICliExecutionContext {
  /**
   * The data store
   */
  data: Record<string, Record<string, any>>;

  /**
   * The current user session
   */
  userSession?: ICliUserSession;

  /**
   * The loader to use for showing/hiding the loader
   */
  loader?: CliLoaderProps;

  /**
   * A subject that emits when the command is aborted
   */
  onAbort: Subject<void>;

  /**
   * The terminal to use for writing
   */
  terminal: Terminal;

  /**
   * The writer to use for writing to the terminal
   */
  writer: ICliTerminalWriter;

  /**
   * The command executor to use for executing commands
   */
  executor: CliCommandExecutorService;
}

/**
 * Options for the CLI
 */
export type CliOptions = {
  /**
   * The welcome message to display when the CLI starts
   */
  welcomeMessage?: string;
};

/**
 * Represents a service that manages user sessions in the CLI
 */
export interface ICliUserSessionService {
  /**
   * Gets the current user session
   * @returns An observable that emits the current user session
   */
  getUserSession(): Observable<ICliUserSession | undefined>;

  /**
   * Sets the current user session
   * @param session The session to set
   */
  setUserSession(session: ICliUserSession): Promise<void>;
}

/**
 * Represents a service that manages users in the CLI
 */
export interface ICliUsersStoreService {
  /**
   * Gets the current users
   * @returns An observable that emits the current users
   */
  getUsers(): Observable<ICliUser[]>;

  /**
   * Sets the current users
   * @param users The users to set
   */
  setUsers(users: ICliUser[]): Promise<void>;

  /**
   * Gets a user by id
   * @param id The id of the user to get
   * @returns An observable that emits the user with the specified id
   */
  getUser(id: string): Observable<ICliUser | undefined>;
}
