import { Injectable } from '@angular/core';
import {
  ICliExecutionContext,
  CliProcessCommand,
  ICliCommandProcessor,
  ICliCommandParameterDescriptor,
} from '../models';

@Injectable({
  providedIn: 'root',
})
export class CliHelpCommandProcessor implements ICliCommandProcessor {
  command = 'help';

  description?: string | undefined = 'Displays help for a command';

  allowPartialCommands?: boolean | undefined = true;

  constructor() {}

  async processCommand(
    command: CliProcessCommand,
    context: ICliExecutionContext
  ): Promise<void> {
    const [_, ...commands] = command.command.split(' ');

    if (commands.length === 0) {
      const commands = context.executor.listCommands();
      context.writer.writeln('\x1b[33mAvailable commands:\x1b[0m');
      commands.forEach((command) => {
        const processor = context.executor.findProcessor(command, []);
        context.writer.writeln(
          `- \x1b[31m${command}\x1b[0m - ${
            processor?.description || 'Missing description'
          }`
        );
      });
    } else {
      const processor = context.executor.findProcessor(
        commands[0],
        commands.slice(1)
      );

      if (processor) {
        context.writer.writeln(
          `\x1b[33mCommand:\x1b[0m ${processor.command} @${
            processor.version || '1.0.0'
          } - ${processor.description}`
        );

        if (processor.writeDescription) {
          processor.writeDescription(context);
        } else {
          context.writer.writeln('\x1b[33mNo description available\x1b[0m');
        }

        if (processor.processors?.length) {
          context.writer.writeln('\x1b[33mSubcommands:\x1b[0m');

          processor.processors.forEach((subprocessor) => {
            context.writer.writeln(`- ${subprocessor.command}`);
          });
        }

        const defaultParameters: ICliCommandParameterDescriptor[] = [
          {
            name: 'version',
            aliases: ['v'],
            type: 'boolean',
            description: 'Displays the version of the command',
            required: false,
          },
        ];

        const parameters = [
          ...(processor.parameters || []),
          ...defaultParameters,
        ];

        context.writer.writeln('\x1b[33mParameters:\x1b[0m');

        parameters.forEach((parameter) => {
          context.writer.writeln(
            `--${parameter.name} (${parameter.type}) ${
              parameter.aliases ? `(${parameter.aliases.join(', ')})` : ''
            } - ${parameter.description}${
              parameter.required ? ' (required)' : ''
            }`
          );
        });
      } else {
        context.writer.writeln(`\x1b[33mUnknown command: ${commands[0]}`);
      }
    }
  }
}
