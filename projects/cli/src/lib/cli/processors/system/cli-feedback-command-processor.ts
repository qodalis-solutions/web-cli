import { Injectable } from '@angular/core';
import {
    ICliExecutionContext,
    CliProcessCommand,
    ICliCommandProcessor,
    ICliCommandAuthor,
    CliProcessorMetadata,
    CliIcon,
    ICliCommandChildProcessor,
    CliForegroundColor,
} from '@qodalis/cli-core';

import { DefaultLibraryAuthor } from '@qodalis/cli-core';
import { openLink } from '../../../utils';

const githubUrl = 'https://github.com/qodalis-solutions/angular-web-cli';

@Injectable({
    providedIn: 'root',
})
export class CliFeedbackCommandProcessor implements ICliCommandProcessor {
    command = 'feedback';

    aliases = ['support'];

    description?: string | undefined =
        'Allows users to report bugs or request features';

    processors?: ICliCommandChildProcessor[] | undefined = [];

    author?: ICliCommandAuthor | undefined = DefaultLibraryAuthor;

    metadata?: CliProcessorMetadata | undefined = {
        sealed: true,
        icon: CliIcon.Bug,
        module: 'system',
    };

    constructor() {
        this.processors?.push(
            {
                command: 'report-bug',
                description: 'Reports a bug on GitHub',
                allowUnlistedCommands: true,
                async processCommand(
                    { value }: CliProcessCommand,
                    context: ICliExecutionContext,
                ): Promise<void> {
                    openLink(
                        `${githubUrl}/issues/new?assignees=&labels=bug&projects=&template=bug_report.md&title=${value}`,
                    );
                },
                writeDescription({ writer }: ICliExecutionContext): void {
                    writer.writeln('🐞 Opens a new bug report on GitHub');
                    writer.writeln();
                    writer.writeln('📋 Usage:');
                    writer.writeln(`  ${writer.wrapInColor('feedback report-bug <title>', CliForegroundColor.Cyan)}`);
                },
            },
            {
                command: 'request-feature',
                description: 'Requests a new feature on GitHub',
                allowUnlistedCommands: true,
                async processCommand(
                    { value }: CliProcessCommand,
                    context: ICliExecutionContext,
                ): Promise<void> {
                    openLink(
                        `${githubUrl}/issues/new?assignees=&labels=feature-request&projects=&template=feature_request.md&title=${value}`,
                    );
                },
                writeDescription({ writer }: ICliExecutionContext): void {
                    writer.writeln('✨ Opens a new feature request on GitHub');
                    writer.writeln();
                    writer.writeln('📋 Usage:');
                    writer.writeln(`  ${writer.wrapInColor('feedback request-feature <title>', CliForegroundColor.Cyan)}`);
                },
            },
            {
                command: 'request-command',
                description: 'Requests a new command on GitHub',
                allowUnlistedCommands: true,
                async processCommand(
                    { value }: CliProcessCommand,
                    context: ICliExecutionContext,
                ): Promise<void> {
                    openLink(
                        `${githubUrl}/issues/new?assignees=&labels=command-request&projects=&template=command-request.md&title=${value}`,
                    );
                },
                writeDescription({ writer }: ICliExecutionContext): void {
                    writer.writeln('🧩 Opens a new command request on GitHub');
                    writer.writeln();
                    writer.writeln('📋 Usage:');
                    writer.writeln(`  ${writer.wrapInColor('feedback request-command <title>', CliForegroundColor.Cyan)}`);
                },
            },
        );
    }

    async processCommand(
        _: CliProcessCommand,
        { writer }: ICliExecutionContext,
    ): Promise<void> {
        writer.writeln('📣 Available feedback options:');
        writer.writeln();
        this.processors?.forEach((processor) => {
            writer.writeln(
                `  ${writer.wrapInColor(`feedback ${processor.command}`, CliForegroundColor.Cyan)}  ${processor.description}`,
            );
        });
    }

    writeDescription({ writer }: ICliExecutionContext): void {
        writer.writeln('Allows users to report bugs or request features on GitHub');
        writer.writeln();
        writer.writeln('📋 Usage:');
        writer.writeln(`  ${writer.wrapInColor('feedback report-bug <title>', CliForegroundColor.Cyan)}         🐞 Report a bug`);
        writer.writeln(`  ${writer.wrapInColor('feedback request-feature <title>', CliForegroundColor.Cyan)}     ✨ Request a feature`);
        writer.writeln(`  ${writer.wrapInColor('feedback request-command <title>', CliForegroundColor.Cyan)}     🧩 Request a new command`);
        writer.writeln();
        writer.writeln('📝 Examples:');
        writer.writeln(`  feedback report-bug "Login page crashes"          ${writer.wrapInColor('# Opens GitHub issue', CliForegroundColor.Green)}`);
        writer.writeln(`  feedback request-feature "Dark mode support"      ${writer.wrapInColor('# Opens feature request', CliForegroundColor.Green)}`);
    }
}
