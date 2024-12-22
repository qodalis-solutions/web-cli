import {
  CliProcessCommand,
  ICliCommandProcessor,
  ICliExecutionContext,
} from '../models';

export class CliPingCommandProcessor implements ICliCommandProcessor {
  command = 'ping';

  description?: string | undefined = 'Pings the server';

  async processCommand(
    _: CliProcessCommand,
    context: ICliExecutionContext
  ): Promise<void> {
    //TODO: Implement ping
    context.writer.writeln('pong');
  }
}

export class CliClearCommandProcessor implements ICliCommandProcessor {
  command = 'clear';

  description?: string | undefined = 'Clears the terminal';

  async processCommand(
    _: CliProcessCommand,
    context: ICliExecutionContext
  ): Promise<void> {
    context.terminal.clear();
  }
}

export class CliEchoCommandProcessor implements ICliCommandProcessor {
  command = 'echo';

  description?: string | undefined = 'Prints the specified text';

  allowPartialCommands?: boolean | undefined = true;

  async processCommand(
    command: CliProcessCommand,
    context: ICliExecutionContext
  ): Promise<void> {
    context.writer.writeln(command.command.replace('echo ', '').trim());
  }

  writeDescription(context: ICliExecutionContext): void {
    context.writer.writeln('echo <text>');
    context.writer.writeln('Prints the specified text');
  }
}

export { CliHelpCommandProcessor } from './cli-help-command-processor';

export { CliSwitchUserCommandProcessor } from './cli-switch-user-command-processor';

export { CliVersionCommandProcessor } from './cli-version-command-processor';

export { CliLogsCommandProcessor } from './cli-logs-command-processor';

export { CliHistoryCommandProcessor } from './cli-history-command-processor';
