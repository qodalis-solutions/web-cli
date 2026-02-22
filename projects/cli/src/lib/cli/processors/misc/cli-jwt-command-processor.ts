import {
    CliForegroundColor,
    CliProcessCommand,
    CliProcessorMetadata,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';

export class CliJwtCommandProcessor implements ICliCommandProcessor {
    command = 'jwt';

    description = 'Decode and inspect JWT tokens';

    author = DefaultLibraryAuthor;

    processors?: ICliCommandProcessor[] = [];

    metadata?: CliProcessorMetadata = {
        icon: '🔑',
        module: 'misc',
    };

    constructor() {
        this.processors = [
            {
                command: 'decode',
                aliases: ['d'],
                description: 'Decode a JWT token',
                allowUnlistedCommands: true,
                valueRequired: true,
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const token = (command.value || command.data || '') as string;
                    const { writer } = context;

                    const parts = token.split('.');
                    if (parts.length !== 3) {
                        writer.writeError(
                            'Invalid JWT token (expected 3 parts separated by dots)',
                        );
                        context.process.exit(-1);
                        return;
                    }

                    try {
                        const header = JSON.parse(this.base64UrlDecode(parts[0]));
                        const payload = JSON.parse(this.base64UrlDecode(parts[1]));

                        writer.writeln(
                            writer.wrapInColor('Header:', CliForegroundColor.Yellow),
                        );
                        writer.writeln(JSON.stringify(header, null, 2));
                        writer.writeln();

                        writer.writeln(
                            writer.wrapInColor('Payload:', CliForegroundColor.Yellow),
                        );
                        writer.writeln(JSON.stringify(payload, null, 2));
                        writer.writeln();

                        // Show expiration info
                        if (payload.exp) {
                            const expDate = new Date(payload.exp * 1000);
                            const isExpired = expDate.getTime() < Date.now();
                            writer.writeln(
                                `${writer.wrapInColor('Expires:', CliForegroundColor.Yellow)} ${expDate.toLocaleString()} ${isExpired
                                    ? writer.wrapInColor('(EXPIRED)', CliForegroundColor.Red)
                                    : writer.wrapInColor('(valid)', CliForegroundColor.Green)
                                }`,
                            );
                        }

                        if (payload.iat) {
                            const iatDate = new Date(payload.iat * 1000);
                            writer.writeln(
                                `${writer.wrapInColor('Issued:', CliForegroundColor.Yellow)}  ${iatDate.toLocaleString()}`,
                            );
                        }

                        writer.writeln();
                        writer.writeln(
                            writer.wrapInColor('Signature:', CliForegroundColor.Yellow) +
                                ` ${parts[2].substring(0, 20)}...`,
                        );

                        context.process.output({ header, payload });
                    } catch {
                        writer.writeError('Failed to decode JWT token');
                        context.process.exit(-1);
                    }
                },
                writeDescription: (context: ICliExecutionContext) => {
                    const { writer } = context;
                    writer.writeln('Decode a JWT token and display its header and payload');
                    writer.writeln('Shows expiration status and issue date if present');
                    writer.writeln();
                    writer.writeln('📋 Usage:');
                    writer.writeln(
                        `  ${writer.wrapInColor('jwt decode <token>', CliForegroundColor.Cyan)}`,
                    );
                },
            },
        ];
    }

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        context.executor.showHelp(command, context);
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer } = context;
        writer.writeln('Decode and inspect JSON Web Tokens (JWT)');
        writer.writeln();
        writer.writeln('📋 Usage:');
        writer.writeln(
            `  ${writer.wrapInColor('jwt decode <token>', CliForegroundColor.Cyan)}       Decode and display JWT contents`,
        );
        writer.writeln();
        writer.writeln('📝 Shows: header, payload, expiration status, issue date');
    }

    private base64UrlDecode(str: string): string {
        str = str.replace(/-/g, '+').replace(/_/g, '/');
        while (str.length % 4) {
            str += '=';
        }
        return decodeURIComponent(
            atob(str)
                .split('')
                .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join(''),
        );
    }
}
