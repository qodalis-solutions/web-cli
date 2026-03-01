import {
    ICliExecutionContext,
    CliProcessCommand,
    ICliCommandProcessor,
    ICliCommandAuthor,
    CliProcessorMetadata,
    CliIcon,
    ICliCommandChildProcessor,
    CliForegroundColor,
    LIBRARY_VERSION as CORE_VERSION,
} from '@qodalis/cli-core';

import { DefaultLibraryAuthor } from '@qodalis/cli-core';
import { LIBRARY_VERSION as CLI_VERSION } from '../../version';
import { openLink } from '../../utils';

const githubUrl = 'https://github.com/qodalis-solutions/web-cli';

interface FeedbackType {
    command: string;
    label: string;
    icon: string;
    description: string;
    gitHubLabel: string;
    gitHubTemplate: string;
    titlePrompt: string;
    descriptionPrompt: string;
}

const feedbackTypes: FeedbackType[] = [
    {
        command: 'report-bug',
        label: '🐞 Report a Bug',
        icon: '🐞',
        description: 'Reports a bug on GitHub',
        gitHubLabel: 'bug',
        gitHubTemplate: 'bug_report.md',
        titlePrompt: 'Bug title: ',
        descriptionPrompt: 'Describe the bug (what happened vs what you expected): ',
    },
    {
        command: 'request-feature',
        label: '✨ Request a Feature',
        icon: '✨',
        description: 'Requests a new feature on GitHub',
        gitHubLabel: 'feature-request',
        gitHubTemplate: 'feature_request.md',
        titlePrompt: 'Feature title: ',
        descriptionPrompt: 'Describe the feature you would like: ',
    },
    {
        command: 'request-command',
        label: '🧩 Request a Command',
        icon: '🧩',
        description: 'Requests a new command on GitHub',
        gitHubLabel: 'command-request',
        gitHubTemplate: 'command-request.md',
        titlePrompt: 'Command name or title: ',
        descriptionPrompt: 'Describe what the command should do: ',
    },
];

function collectSystemInfo(context: ICliExecutionContext): string {
    const lines: string[] = [];

    lines.push(`- **CLI Version:** ${CLI_VERSION}`);
    lines.push(`- **Core Version:** ${CORE_VERSION}`);

    let framework = 'vanilla';
    try {
        framework = context.services.get<string>('cli-framework');
    } catch {
        // standalone usage
    }
    lines.push(`- **Framework:** ${framework}`);
    lines.push(`- **Terminal:** ${context.terminal.cols}x${context.terminal.rows}`);

    if (typeof navigator !== 'undefined') {
        lines.push(`- **Browser:** ${navigator.userAgent}`);
        lines.push(`- **Language:** ${navigator.language}`);
        lines.push(`- **Platform:** ${navigator.platform}`);
        lines.push(`- **Online:** ${navigator.onLine}`);
    }

    if (typeof screen !== 'undefined') {
        lines.push(`- **Screen:** ${screen.width}x${screen.height}`);
    }

    return lines.join('\n');
}

function buildIssueBody(
    description: string | undefined,
    systemInfo: string,
): string {
    const sections: string[] = [];

    if (description) {
        sections.push(`## Description\n\n${description}`);
    }

    sections.push(`## System Info\n\n${systemInfo}`);

    return sections.join('\n\n');
}

function buildGitHubUrl(type: FeedbackType, title: string, body: string): string {
    const params = new URLSearchParams();
    params.set('labels', type.gitHubLabel);
    params.set('template', type.gitHubTemplate);
    params.set('title', title);
    params.set('body', body);
    return `${githubUrl}/issues/new?${params.toString()}`;
}

async function runInteractiveFlow(
    type: FeedbackType,
    initialTitle: string | undefined,
    context: ICliExecutionContext,
): Promise<void> {
    const { writer, reader } = context;

    // Step 1: Get title
    let title = initialTitle?.trim();
    if (!title) {
        title = await reader.readLine(type.titlePrompt) ?? undefined;
        if (!title?.trim()) {
            writer.writeInfo('Feedback cancelled.');
            return;
        }
        title = title.trim();
    }

    // Step 2: Optional description
    writer.writeln();
    const addDescription = await reader.readConfirm(
        'Add a description?',
        false,
    );

    let description: string | undefined;
    if (addDescription) {
        const desc = await reader.readLine(type.descriptionPrompt);
        if (desc?.trim()) {
            description = desc.trim();
        }
    }

    // Step 3: Collect system info
    const systemInfo = collectSystemInfo(context);

    // Step 4: Show summary and confirm
    writer.writeln();
    writer.writeln(
        `${writer.wrapInColor('── Summary ──', CliForegroundColor.Cyan)}`,
    );
    writer.writeln(`  Type:  ${type.icon} ${type.command}`);
    writer.writeln(`  Title: ${writer.wrapInColor(title, CliForegroundColor.White)}`);
    if (description) {
        writer.writeln(`  Desc:  ${description}`);
    }
    writer.writeln();
    writer.writeln(
        `${writer.wrapInColor('── System Info (auto-attached) ──', CliForegroundColor.Cyan)}`,
    );
    writer.writeln(`  CLI: ${CLI_VERSION}  Core: ${CORE_VERSION}`);

    let framework = 'vanilla';
    try {
        framework = context.services.get<string>('cli-framework');
    } catch {
        // standalone
    }
    writer.writeln(`  Framework: ${framework}  Terminal: ${context.terminal.cols}x${context.terminal.rows}`);

    if (typeof navigator !== 'undefined') {
        writer.writeln(`  Platform: ${navigator.platform}  Language: ${navigator.language}`);
    }
    writer.writeln();

    const confirmed = await reader.readConfirm(
        'Open on GitHub?',
        true,
    );

    if (!confirmed) {
        writer.writeInfo('Feedback cancelled.');
        return;
    }

    const body = buildIssueBody(description, systemInfo);
    const url = buildGitHubUrl(type, title, body);
    openLink(url);
    writer.writeln();
    writer.writeSuccess(
        `Opened ${type.command} on GitHub. Thank you for your feedback!`,
    );
}

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
        for (const type of feedbackTypes) {
            this.processors?.push({
                command: type.command,
                description: type.description,
                acceptsRawInput: true,
                async processCommand(
                    { value }: CliProcessCommand,
                    context: ICliExecutionContext,
                ): Promise<void> {
                    await runInteractiveFlow(type, value, context);
                },
                writeDescription({ writer }: ICliExecutionContext): void {
                    writer.writeln(`${type.icon} ${type.description}`);
                    writer.writeln();
                    writer.writeln('📋 Usage:');
                    writer.writeln(
                        `  ${writer.wrapInColor(`feedback ${type.command}`, CliForegroundColor.Cyan)}            Interactive mode`,
                    );
                    writer.writeln(
                        `  ${writer.wrapInColor(`feedback ${type.command} <title>`, CliForegroundColor.Cyan)}   Provide title upfront`,
                    );
                },
            });
        }
    }

    async processCommand(
        _: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const { writer, reader } = context;

        writer.writeln('📣 What would you like to do?');
        writer.writeln();

        const options = feedbackTypes.map((t) => ({
            label: t.label,
            value: t.command,
        }));

        const selected = await reader.readSelect(
            'Select feedback type:',
            options,
        );

        if (!selected) {
            writer.writeInfo('Feedback cancelled.');
            return;
        }

        const type = feedbackTypes.find((t) => t.command === selected);
        if (!type) {
            return;
        }

        writer.writeln();
        await runInteractiveFlow(type, undefined, context);
    }

    writeDescription({ writer }: ICliExecutionContext): void {
        writer.writeln(
            'Report bugs, request features, or suggest new commands — interactively or inline.',
        );
        writer.writeln();
        writer.writeln('📋 Usage:');
        writer.writeln(
            `  ${writer.wrapInColor('feedback', CliForegroundColor.Cyan)}                                    Interactive wizard`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('feedback report-bug', CliForegroundColor.Cyan)}                         🐞 Report a bug`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('feedback report-bug <title>', CliForegroundColor.Cyan)}                  🐞 Report with title`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('feedback request-feature', CliForegroundColor.Cyan)}                     ✨ Request a feature`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('feedback request-feature <title>', CliForegroundColor.Cyan)}              ✨ Request with title`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('feedback request-command', CliForegroundColor.Cyan)}                     🧩 Request a command`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('feedback request-command <title>', CliForegroundColor.Cyan)}              🧩 Request with title`,
        );
        writer.writeln();
        writer.writeln('📝 Examples:');
        writer.writeln(
            `  feedback                                          ${writer.wrapInColor('# Start interactive wizard', CliForegroundColor.Green)}`,
        );
        writer.writeln(
            `  feedback report-bug "Login page crashes"          ${writer.wrapInColor('# Opens bug report with title', CliForegroundColor.Green)}`,
        );
        writer.writeln(
            `  feedback request-feature "Dark mode support"      ${writer.wrapInColor('# Opens feature request with title', CliForegroundColor.Green)}`,
        );
    }
}
