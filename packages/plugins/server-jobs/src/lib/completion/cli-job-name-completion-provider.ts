import {
    ICliCompletionProvider,
    ICliCompletionContext,
    ICliServiceProvider,
    resolveServerHeaders,
} from '@qodalis/cli-core';
import { CliJobsService } from '../services/cli-jobs-service';

/**
 * Sub-commands of `server jobs` that accept a job name/id as a value.
 */
const JOB_NAME_SUBCOMMANDS = new Set([
    'info',
    'trigger',
    'pause',
    'resume',
    'stop',
    'cancel',
    'history',
    'logs',
    'edit',
]);

/**
 * Provides tab-completion for job names when typing
 * `server jobs <subcommand> <name>`.
 *
 * Priority 50 — checked before command and parameter completion so that
 * job names are suggested instead of treating the value position as
 * a sub-command or flag.
 */
export class CliJobNameCompletionProvider implements ICliCompletionProvider {
    priority = 50;

    private services: ICliServiceProvider | null = null;

    setServices(services: ICliServiceProvider): void {
        this.services = services;
    }

    async getCompletions(context: ICliCompletionContext): Promise<string[]> {
        const { tokens, tokenIndex, token } = context;

        // Expected: server jobs <subcommand> <value>
        // tokens[0] = 'server', tokens[1] = 'jobs', tokens[2] = subcommand, tokens[3] = value
        if (tokenIndex !== 3 || tokens.length < 3) {
            return [];
        }

        if (tokens[0].toLowerCase() !== 'server') {
            return [];
        }

        if (tokens[1].toLowerCase() !== 'jobs') {
            return [];
        }

        const subCommand = tokens[2].toLowerCase();
        if (!JOB_NAME_SUBCOMMANDS.has(subCommand)) {
            return [];
        }

        if (!this.services) {
            return [];
        }

        const lowerPrefix = token.toLowerCase();

        try {
            const manager = this.services.getRequired<any>('cli-server-manager');
            if (!manager?.connections) {
                return [];
            }

            const names: string[] = [];
            for (const [name, connection] of manager.connections as Map<string, any>) {
                if (!connection.connected) continue;

                const config = connection.config;
                const baseUrl = config.url.endsWith('/')
                    ? config.url.slice(0, -1)
                    : config.url;
                const headers = resolveServerHeaders(this.services!, name, config.headers);
                const service = new CliJobsService(baseUrl, headers);

                try {
                    const jobs = await service.listJobs();
                    for (const job of jobs) {
                        if (!names.includes(job.name)) {
                            names.push(job.name);
                        }
                    }
                } catch {
                    // skip unreachable servers
                }
            }

            return names
                .filter((name) => name.toLowerCase().startsWith(lowerPrefix))
                .sort();
        } catch {
            return [];
        }
    }
}
