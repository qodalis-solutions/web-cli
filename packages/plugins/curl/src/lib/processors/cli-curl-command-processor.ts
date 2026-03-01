import {
    CliForegroundColor,
    CliProcessCommand,
    CliProcessorMetadata,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { LIBRARY_VERSION } from '../version';
import {
    CurlResponse,
    buildCurlEquivalent,
    buildFetchOptions,
    extractResponseHeaders,
    formatResponseBody,
    inferMethod,
    parseHeaders,
    resolveBody,
    rewriteUrlToProxy,
} from '../utilities';

export class CliCurlCommandProcessor implements ICliCommandProcessor {
    command = 'curl';

    description = 'Make HTTP requests from the terminal. Supports all HTTP methods, custom headers, request bodies, timeouts, and more.';

    author = DefaultLibraryAuthor;

    version = LIBRARY_VERSION;

    valueRequired = true;

    metadata?: CliProcessorMetadata = {
        icon: '🌐',
        requiredCoreVersion: '>=2.0.0 <3.0.0',
        requiredCliVersion: '>=2.0.0 <3.0.0',
    };

    parameters = [
        {
            name: 'request',
            aliases: ['X'],
            type: 'string' as const,
            description: 'HTTP method (GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS)',
            required: false,
        },
        {
            name: 'header',
            aliases: ['H'],
            type: 'array' as const,
            description: 'Add header, e.g. -H \'Content-Type: application/json\' (repeatable)',
            required: false,
        },
        {
            name: 'data',
            aliases: ['d'],
            type: 'string' as const,
            description: 'Request body (auto-detects JSON, sets method to POST if -X not given)',
            required: false,
        },
        {
            name: 'data-raw',
            type: 'string' as const,
            description: 'Request body sent as-is without JSON parsing',
            required: false,
        },
        {
            name: 'verbose',
            aliases: ['v'],
            type: 'boolean' as const,
            description: 'Show request/response headers and timing',
            required: false,
        },
        {
            name: 'pretty',
            type: 'boolean' as const,
            description: 'Pretty-print JSON response body',
            required: false,
        },
        {
            name: 'timeout',
            type: 'number' as const,
            description: 'Request timeout in milliseconds (default: 30000)',
            required: false,
            defaultValue: '30000',
        },
        {
            name: 'location',
            aliases: ['L'],
            type: 'boolean' as const,
            description: 'Follow redirects (default: true)',
            required: false,
        },
        {
            name: 'proxy',
            type: 'boolean' as const,
            description: 'Route request through proxy.qodalis.com (bypasses CORS)',
            required: false,
        },
        {
            name: 'silent',
            aliases: ['s'],
            type: 'boolean' as const,
            description: 'Only output response body (no status line)',
            required: false,
        },
    ];

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const url = command.value;

        if (!url) {
            context.writer.writeError('URL is required. Usage: curl <url> [options]');
            context.process.exit(1);
            return;
        }

        const args = command.args;
        const explicitMethod = args['request'] || args['X'];
        const data = args['data'] || args['d'];
        const dataRaw = args['data-raw'];
        const hasBody = data != null || dataRaw != null;
        const verbose = !!args['verbose'] || !!args['v'];
        const pretty = !!args['pretty'];
        const silent = !!args['silent'] || !!args['s'];
        const useProxy = !!args['proxy'];
        const timeout = parseInt(args['timeout'] || '30000', 10);
        const followRedirects = args['location'] !== false && args['L'] !== false;

        let method: string;
        try {
            method = inferMethod(explicitMethod, hasBody);
        } catch (e: any) {
            context.writer.writeError(e.message);
            context.process.exit(1);
            return;
        }

        const headers = parseHeaders(args['header'] || args['H']);
        const body = resolveBody(data, dataRaw);
        const requestUrl = useProxy ? rewriteUrlToProxy(url) : url;

        const fetchOptions = buildFetchOptions({
            method,
            headers,
            body,
            followRedirects,
        });

        if (verbose) {
            context.writer.writeln(
                `> ${context.writer.wrapInColor(`${method} ${url}`, CliForegroundColor.Cyan)}`,
            );
            for (const [key, value] of Object.entries(headers)) {
                context.writer.writeln(
                    `> ${context.writer.wrapInColor(`${key}: ${value}`, CliForegroundColor.Yellow)}`,
                );
            }
            if (body) {
                context.writer.writeln(`> Body: ${body}`);
            }
            context.writer.writeln();
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        fetchOptions.signal = controller.signal;

        const startTime = performance.now();

        try {
            const response = await fetch(requestUrl, fetchOptions);
            const elapsed = Math.round(performance.now() - startTime);
            const responseText = await response.text();
            const responseHeaders = extractResponseHeaders(response);

            const curlResponse: CurlResponse = {
                status: response.status,
                statusText: response.statusText,
                headers: responseHeaders,
                body: responseText,
                timing: elapsed,
                url: response.url,
                redirected: response.redirected,
            };

            if (!silent) {
                const statusColor = response.ok ? CliForegroundColor.Green : CliForegroundColor.Red;
                context.writer.writeln(
                    context.writer.wrapInColor(
                        `HTTP ${response.status} ${response.statusText}`,
                        statusColor,
                    ),
                );
            }

            if (verbose) {
                context.writer.writeln();
                for (const [key, value] of Object.entries(responseHeaders)) {
                    context.writer.writeln(
                        `< ${context.writer.wrapInColor(`${key}: ${value}`, CliForegroundColor.Yellow)}`,
                    );
                }
                context.writer.writeln(
                    `< ${context.writer.wrapInColor(`Time: ${elapsed}ms`, CliForegroundColor.Magenta)}`,
                );
                if (response.redirected) {
                    context.writer.writeln(
                        `< ${context.writer.wrapInColor(`Redirected to: ${response.url}`, CliForegroundColor.Cyan)}`,
                    );
                }
                context.writer.writeln();
            }

            const formattedBody = formatResponseBody(responseText, pretty);
            if (formattedBody) {
                context.writer.writeln(formattedBody);
            }

            if (verbose) {
                context.writer.writeln();
                context.writer.writeInfo('Equivalent curl command:');
                context.writer.writeln(buildCurlEquivalent(url, method, headers, body));
            }

            context.process.output(curlResponse);
        } catch (error: any) {
            if (error.name === 'AbortError') {
                context.writer.writeError(`Request timed out after ${timeout}ms`);
            } else {
                context.writer.writeError(`Request failed: ${error.message}`);
            }
            context.process.exit(1);
        } finally {
            clearTimeout(timeoutId);
        }
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer } = context;

        writer.writeln(this.description!);
        writer.writeln();

        writer.writeln(writer.wrapInColor('Usage:', CliForegroundColor.Yellow));
        writer.writeln(`  curl <url> [options]`);
        writer.writeln();

        writer.writeln(writer.wrapInColor('Options:', CliForegroundColor.Yellow));
        writer.writeln(`  ${writer.wrapInColor('-X, --request <METHOD>', CliForegroundColor.Cyan)}   HTTP method (default: GET, or POST if -d given)`);
        writer.writeln(`  ${writer.wrapInColor('-H, --header <header>', CliForegroundColor.Cyan)}    Add header (repeatable)`);
        writer.writeln(`  ${writer.wrapInColor('-d, --data <body>', CliForegroundColor.Cyan)}        Request body (auto-detects JSON)`);
        writer.writeln(`  ${writer.wrapInColor('--data-raw <body>', CliForegroundColor.Cyan)}        Request body as-is`);
        writer.writeln(`  ${writer.wrapInColor('-v, --verbose', CliForegroundColor.Cyan)}            Show headers and timing`);
        writer.writeln(`  ${writer.wrapInColor('--pretty', CliForegroundColor.Cyan)}                 Pretty-print JSON response`);
        writer.writeln(`  ${writer.wrapInColor('--timeout <ms>', CliForegroundColor.Cyan)}           Timeout in ms (default: 30000)`);
        writer.writeln(`  ${writer.wrapInColor('-L, --location', CliForegroundColor.Cyan)}           Follow redirects (default: true)`);
        writer.writeln(`  ${writer.wrapInColor('--proxy', CliForegroundColor.Cyan)}                  Route through CORS proxy`);
        writer.writeln(`  ${writer.wrapInColor('-s, --silent', CliForegroundColor.Cyan)}             Only output body`);
        writer.writeln();

        writer.writeln(writer.wrapInColor('Examples:', CliForegroundColor.Yellow));
        writer.writeln(`  curl https://api.example.com/users`);
        writer.writeln(`  curl https://api.example.com/users -X POST -d '{"name":"John"}' -H 'Content-Type: application/json'`);
        writer.writeln(`  curl https://api.example.com/users -v --pretty`);
        writer.writeln(`  curl https://api.example.com/status -X HEAD`);
        writer.writeln(`  curl https://api.example.com/data --proxy --timeout 5000`);
        writer.writeln();

        writer.writeWarning('The server must allow CORS for this tool to work. Use --proxy to bypass CORS restrictions.');
    }

    async initialize(_context: ICliExecutionContext): Promise<void> {}
}
