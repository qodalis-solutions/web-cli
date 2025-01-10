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
                    writer.writeln(
                        'Reports a bug on GitHub. Usage: feedback report-bug <description>',
                    );
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
                    writer.writeln(
                        'Requests a new feature on GitHub. Usage: feedback request-feature <description>',
                    );
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
                    writer.writeln(
                        'Requests a new command on GitHub. Usage: feedback request-command <description>',
                    );
                },
            },
        );
    }

    async processCommand(
        _: CliProcessCommand,
        { writer }: ICliExecutionContext,
    ): Promise<void> {
        writer.writeln('Use one of the following subcommands:');
        this.processors?.forEach((processor) => {
            writer.writeln(
                `- ${writer.wrapInColor(`feedback ${processor.command}`, CliForegroundColor.Cyan)}: ${processor.description}`,
            );
        });
    }

    writeDescription({ writer }: ICliExecutionContext): void {
        writer.writeln(
            'Allows users to report bugs or request features on GitHub.',
        );
    }
}
