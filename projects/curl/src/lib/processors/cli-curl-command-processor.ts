import { Injectable } from '@angular/core';
import {
    CliForegroundColor,
    CliProcessCommand,
    CliProcessorMetadata,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { LIBRARY_VERSION } from '../version';

@Injectable()
export class CliCurlCommandProcessor implements ICliCommandProcessor {
    command = 'curl';

    description =
        'A command-line tool to execute HTTP requests on your server. Supports GET, POST, PUT, DELETE, headers, and body data.';

    author = DefaultLibraryAuthor;

    version = LIBRARY_VERSION;

    processors?: ICliCommandProcessor[] | undefined = [];

    metadata?: CliProcessorMetadata | undefined = {
        icon: '🌐',
        requiredCoreVersion: '0.0.16',
        requiredCliVersion: '1.0.37',
    };

    constructor() {
        this.registerSubProcessors();
    }

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        context.executor.showHelp(command, context);
    }

    async initialize(context: ICliExecutionContext): Promise<void> {}

    private registerSubProcessors(): void {
        this.processors = [
            {
                command: 'get',
                description: 'Perform an HTTP GET request',
                valueRequired: true,
                parameters: [
                    {
                        name: 'header',
                        aliases: ['H'],
                        type: 'array',
                        description:
                            'Add custom headers. Accept multiple headers.',
                        required: false,
                    },
                    {
                        name: 'proxy',
                        type: 'boolean',
                        description: 'Use procy',
                        required: false,
                    },
                ],
                processCommand: async (command, context) => {
                    await this.executeRequest('GET', command, context);
                },
            },
            {
                command: 'post',
                description: 'Perform an HTTP POST request',
                valueRequired: true,
                parameters: [
                    {
                        name: 'header',
                        aliases: ['H'],
                        type: 'array',
                        description: 'Add custom headers',
                        required: false,
                    },
                    {
                        name: 'data',
                        aliases: ['d'],
                        type: 'string',
                        description: 'Request body',
                        required: false,
                    },
                    {
                        name: 'proxy',
                        type: 'boolean',
                        description: 'Use procy',
                        required: false,
                    },
                ],
                processCommand: async (command, context) => {
                    await this.executeRequest('POST', command, context);
                },
            },
            {
                command: 'put',
                description: 'Perform an HTTP PUT request',
                valueRequired: true,
                parameters: [
                    {
                        name: 'header',
                        aliases: ['H'],
                        type: 'array',
                        description: 'Add custom headers',
                        required: false,
                    },
                    {
                        name: 'data',
                        aliases: ['d'],
                        type: 'string',
                        description: 'Request body',
                        required: false,
                    },
                    {
                        name: 'proxy',
                        type: 'boolean',
                        description: 'Use procy',
                        required: false,
                    },
                ],
                processCommand: async (command, context) => {
                    await this.executeRequest('PUT', command, context);
                },
            },
            {
                command: 'delete',
                description: 'Perform an HTTP DELETE request',
                valueRequired: true,
                parameters: [
                    {
                        name: 'header',
                        aliases: ['H'],
                        type: 'array',
                        description: 'Add custom headers',
                        required: false,
                    },
                    {
                        name: 'proxy',
                        type: 'boolean',
                        description: 'Use procy',
                        required: false,
                    },
                ],
                processCommand: async (command, context) => {
                    await this.executeRequest('DELETE', command, context);
                },
            },
        ];
    }

    private async executeRequest(
        method: string,
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const url = command.value;
        const headers = command.args['header'] || command.args['H'] || [];
        const data = command.args['data'] || command.args['d'];
        const verbose = !!command.args['verbose'];
        const useProxy = !!command.args['proxy'];

        if (!url) {
            context.writer.writeError('URL is required.');
            return;
        }

        // Prepare headers
        const headersObject = headers.reduce(
            (acc: Record<string, string>, header: string) => {
                const [key, value] = header.split(':').map((str) => str.trim());
                if (key && value) acc[key] = value;
                return acc;
            },
            {},
        );

        // Prepare request options
        const options: RequestInit = {
            method,
            headers: headersObject,
            body: data ? JSON.stringify(JSON.parse(data)) : undefined,
        };

        try {
            const requestUrl = useProxy ? this.rewriteUrlToProxy(url) : url;

            const response = await fetch(requestUrl, options);
            const text = await response.text();

            context.writer.writeSuccess('Request successful:');
            if (verbose) {
                context.writer.writeln(`Status: ${response.status}`);
                context.writer.writeln(
                    `Headers: ${JSON.stringify(response.headers, null, 2)}`,
                );
            }
            context.writer.writeln(text);

            context.process.output(text);
        } catch (error) {
            context.writer.writeError(`Request failed: ${error}`);
            context.process.exit(-1);
        } finally {
            context.writer.writeln();
            context.writer.writeInfo('Equivalent curl command:');
            context.writer.writeln(
                this.generateCurlCommand(url, method, headers, data),
            );
        }
    }

    private generateCurlCommand(
        url: string,
        method: string,
        headers: string[],
        data?: string,
    ): string {
        const headerString = headers.map((h) => `-H "${h}"`).join(' ');
        const dataString = data ? `-d '${data}'` : '';
        return `curl -X ${method} ${headerString} ${dataString} "${url}"`;
    }

    private rewriteUrlToProxy(originalUrl: string): string {
        const regex = /^(https?):\/\/([^\/]+)(\/.*)?$/i;

        const match = originalUrl.match(regex);

        if (!match) {
            throw new Error('Invalid URL provided');
        }

        const scheme = match[1]; // 'http' or 'https'
        const domain = match[2]; // domain.com
        const path = match[3] || '/'; // /path or '/'

        return `https://proxy.qodalis.com/proxy/${scheme}/${domain}${path}`;
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer } = context;
        writer.writeln(this.description!);
        writer.writeln();
        writer.writeln('📋 Usage:');
        writer.writeln(`  ${writer.wrapInColor('curl <method> <url> [options]', CliForegroundColor.Cyan)}`);
        writer.writeln();
        writer.writeln('⚙️  Options:');
        writer.writeln(`  ${writer.wrapInColor('-H, --header', CliForegroundColor.Yellow)}     Add custom headers`);
        writer.writeln(`  ${writer.wrapInColor('-d, --data', CliForegroundColor.Yellow)}       Add request body (JSON)`);
        writer.writeln(`  ${writer.wrapInColor('--verbose', CliForegroundColor.Yellow)}        Print detailed response (status, headers)`);
        writer.writeln(`  ${writer.wrapInColor('--proxy', CliForegroundColor.Yellow)}          Route request through proxy`);
        writer.writeln();
        writer.writeln('📝 Examples:');
        writer.writeln(`  curl get https://api.example.com/users`);
        writer.writeln(`  curl post https://api.example.com/users -d='{"name":"John"}' -H="Content-Type: application/json"`);
        writer.writeln(`  curl delete https://api.example.com/users/1 --proxy`);
        writer.writeln();
        writer.writeWarning('⚠️  The server must allow CORS for this tool to work');
    }
}
