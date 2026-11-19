import {
    CliForegroundColor,
    CliProcessCommand,
    CliProcessorMetadata,
    ICliCommandProcessor,
    ICliExecutionContext,
    joinShellWords,
} from '@qodalis/cli-core';
import { CliUsersCommand, formatTime, listArg, USERS_METADATA, words } from './base';
import { CliApiToken, CliCreateApiToken, CliServerPermission, CliUsersError } from '../backend/users-backend';
import {
    API_TOKENS_LOCAL_MESSAGE,
    CliApiTokensService,
    CliApiTokensService_TOKEN,
} from '../services/cli-users-services';

const TOKEN_METADATA: CliProcessorMetadata = { ...USERS_METADATA, requireAuth: true };

/** API tokens service of this CLI; 501 with the local-mode message when tokens are not supported. */
export function apiTokens(context: ICliExecutionContext): CliApiTokensService {
    const service = context.services.get<CliApiTokensService>(CliApiTokensService_TOKEN);
    if (!service?.supported) throw new CliUsersError(501, API_TOKENS_LOCAL_MESSAGE);
    return service;
}

/** `--expires=<days>|never` → `expiresInDays` (undefined = server default) */
export function parseExpires(value: unknown): number | null | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    const text = String(value).trim().toLowerCase();
    if (text === 'never') return null;
    if (!/^\d+$/.test(text)) {
        throw new CliUsersError(400, `invalid --expires '${value}': use a number of days (1-365) or 'never'`);
    }
    return Number(text);
}

/** Example command connecting Claude Code to the server's MCP endpoint */
export function claudeMcpAddExample(serverUrl: string | undefined, token: string): string {
    const server = serverUrl ? serverUrl.replace(/\/+$/, '') : '<server>';
    return `claude mcp add --transport http qcli ${server}/api/qcli/mcp --header "Authorization: Bearer ${token}"`;
}

class CliTokenCreateCommandProcessor extends CliUsersCommand {
    override command = 'create';
    override description = 'Create an API token (shown once)';
    override acceptsRawInput = true;
    override valueRequired = true;
    override metadata: CliProcessorMetadata = { ...TOKEN_METADATA };
    override parameters = [
        {
            name: 'expires',
            description: "Days until the token expires (1-365, default 90) or 'never'",
            type: 'string' as const,
            required: false,
        },
        {
            name: 'permissions',
            description: 'Limit the token to these permissions (comma separated)',
            type: 'string' as const,
            required: false,
        },
        {
            name: 'select',
            description: "Pick the permissions from the server's list",
            type: 'boolean' as const,
            required: false,
        },
    ];
    protected override usage: Array<[string, string]> = [
        ['token create <name>', 'Create a token that expires in 90 days'],
        ['token create <name> --expires=30', 'Expire after 30 days (1-365)'],
        ['token create <name> --expires=never', 'Never expire (if the server allows it)'],
        ['token create <name> --permissions=a,b', 'Limit the token to some of your permissions'],
        ['token create <name> --select', "Pick the token's permissions from the server's list"],
    ];

    override async processCommand(command: CliProcessCommand, context: ICliExecutionContext): Promise<void> {
        const service = apiTokens(context);
        const name = joinShellWords(String(command.value ?? ''));
        if (!name) {
            throw new CliUsersError(
                400,
                'usage: token create <name> [--expires=<days>|never] [--permissions=a,b|--select]',
            );
        }
        const request: CliCreateApiToken = { name };
        const expiresInDays = parseExpires(command.args['expires']);
        if (expiresInDays !== undefined) request.expiresInDays = expiresInDays;
        if (isTrue(command.args['select'])) {
            if (command.args['permissions'] !== undefined) {
                throw new CliUsersError(400, 'use --select or --permissions, not both');
            }
            const chosen = await selectPermissions(name, service, context);
            if (!chosen) return;
            request.permissions = chosen;
        } else {
            const permissions = listArg(command.args['permissions']);
            if (permissions?.length) request.permissions = permissions;
        }

        const { token, apiToken } = await service.create(request);
        const { writer } = context;
        const expiry = apiToken.expiresAt ? `expires ${formatTime(apiToken.expiresAt)}` : 'never expires';
        writer.writeSuccess(`Token '${apiToken.name}' created (id ${apiToken.id}, ${expiry})`);
        if (apiToken.permissions?.length) writer.writeln(`Scope: ${apiToken.permissions.join(', ')}`);
        writer.writeln();
        writer.writeln(`  ${writer.wrapInColor(token, CliForegroundColor.Green)}`);
        writer.writeln();
        writer.writeWarning('Copy the token now: it will not be shown again.');
        writer.writeln();
        writer.writeln('Use it with an MCP client, e.g. Claude Code:');
        writer.writeln(`  ${writer.wrapInColor(claudeMcpAddExample(service.serverUrl, token), CliForegroundColor.Cyan)}`);
    }
}

/**
 * Opens the permission picker for `token create --select`. Returns the chosen
 * names in the order the server lists them, or null when nothing should be created.
 */
async function selectPermissions(
    name: string,
    service: CliApiTokensService,
    context: ICliExecutionContext,
): Promise<string[] | null> {
    const catalog = await service.permissions();
    if (!catalog.length) {
        throw new CliUsersError(400, 'the server lists no permissions you hold; use --permissions');
    }
    const picked = await context.reader.readMultiSelect(
        `Permissions for ${name}:`,
        catalog.map((p) => ({ label: p.name, value: p.name, description: p.description, group: p.group })),
        { searchable: true },
    );
    if (picked === null) {
        context.writer.writeInfo('Cancelled');
        return null;
    }
    if (!picked.length) {
        context.writer.writeInfo('No permissions selected; token not created');
        return null;
    }
    const set = new Set(picked);
    return catalog.filter((p) => set.has(p.name)).map((p) => p.name);
}

class CliTokenPermissionsCommandProcessor extends CliUsersCommand {
    override command = 'permissions';
    override description = 'List the permissions you can put on a token';
    override metadata: CliProcessorMetadata = { ...TOKEN_METADATA };
    override parameters = [
        {
            name: 'all',
            aliases: ['a'],
            description: 'Every permission the server knows (requires users:read)',
            type: 'boolean' as const,
            required: false,
        },
    ];
    protected override usage: Array<[string, string]> = [
        ['token permissions', 'Permissions you hold, which a token can be limited to'],
        ['token permissions --all', 'Every permission the server knows (requires users:read)'],
    ];

    override async processCommand(command: CliProcessCommand, context: ICliExecutionContext): Promise<void> {
        const all = isTrue(command.args['all'] ?? command.args['a']);
        const permissions = await apiTokens(context).permissions(all ? { all } : undefined);
        if (!permissions.length) {
            context.writer.writeInfo('No permissions');
            return;
        }
        context.writer.writeTable(
            ['GROUP', 'PERMISSION', 'DESCRIPTION'],
            permissions.map((p) => [p.group, permissionLabel(p), p.description]),
        );
    }
}

class CliTokenListCommandProcessor extends CliUsersCommand {
    override command = 'list';
    override aliases = ['ls'];
    override description = 'List API tokens';
    override metadata: CliProcessorMetadata = { ...TOKEN_METADATA };
    override parameters = [
        {
            name: 'all',
            aliases: ['a'],
            description: "Every user's tokens (requires tokens:read)",
            type: 'boolean' as const,
            required: false,
        },
    ];
    protected override usage: Array<[string, string]> = [
        ['token list', 'Your tokens'],
        ['token list --all', "Every user's tokens (requires tokens:read)"],
    ];

    override async processCommand(command: CliProcessCommand, context: ICliExecutionContext): Promise<void> {
        const all = isTrue(command.args['all'] ?? command.args['a']);
        const tokens = await apiTokens(context).list({ all });
        if (!tokens.length) {
            context.writer.writeInfo('No API tokens');
            return;
        }
        const headers = ['NAME', 'ID', 'EXPIRES', 'LAST USED', 'SCOPE'];
        context.writer.writeTable(
            all ? ['USER', ...headers] : headers,
            tokens.map((t) => {
                const row = tokenRow(t);
                return all ? [t.userName ?? t.userId, ...row] : row;
            }),
        );
    }
}

class CliTokenRevokeCommandProcessor extends CliUsersCommand {
    override command = 'revoke';
    override aliases = ['rm'];
    override description = 'Revoke an API token';
    override acceptsRawInput = true;
    override valueRequired = true;
    override metadata: CliProcessorMetadata = { ...TOKEN_METADATA };
    protected override usage: Array<[string, string]> = [
        ['token revoke <id>', 'Revoke a token (your own, or any with tokens:revoke)'],
    ];

    override async processCommand(command: CliProcessCommand, context: ICliExecutionContext): Promise<void> {
        const service = apiTokens(context);
        const [id] = words(command);
        if (!id) throw new CliUsersError(400, 'usage: token revoke <id>');
        await service.revoke(id);
        context.writer.writeSuccess(`Token ${id} revoked`);
    }
}

/** `token create|list|revoke|permissions`: API tokens for MCP clients, CI and scripts (server mode). */
export class CliTokenCommandProcessor extends CliUsersCommand {
    override command = 'token';
    override aliases = ['tokens'];
    override description = 'Manage API tokens (MCP clients, CI, scripts)';
    override metadata: CliProcessorMetadata = { ...TOKEN_METADATA };
    processors: ICliCommandProcessor[] = [
        new CliTokenCreateCommandProcessor(),
        new CliTokenListCommandProcessor(),
        new CliTokenRevokeCommandProcessor(),
        new CliTokenPermissionsCommandProcessor(),
    ];
    protected override usage: Array<[string, string]> = [
        ['token create <name> [--expires=<days>|never] [--permissions=a,b]', 'Create a token (shown once)'],
        ['token create <name> --select', 'Pick the permissions from a list'],
        ['token list [--all]', 'List your tokens (--all: every user, requires tokens:read)'],
        ['token revoke <id>', 'Revoke a token (your own, or any with tokens:revoke)'],
        [
            'token permissions [--all]',
            'Permissions you can put on a token (--all: every one, requires users:read)',
        ],
    ];

    override async processCommand(_command: CliProcessCommand, context: ICliExecutionContext): Promise<void> {
        apiTokens(context); // local mode: explain where tokens are available
        this.writeDescription(context);
    }
}

function tokenRow(t: CliApiToken): string[] {
    return [
        t.name,
        t.id,
        t.expiresAt ? formatTime(t.expiresAt) : 'never',
        t.lastUsedAt ? formatTime(t.lastUsedAt) : 'never',
        tokenScope(t),
    ];
}

function tokenScope(t: CliApiToken): string {
    const scope = t.permissions?.length ? t.permissions.join(', ') : '(all)';
    return t.audience === 'host' ? `${scope} (host)` : scope;
}

function permissionLabel(p: CliServerPermission): string {
    return p.surface === 'host' ? `${p.name} (host)` : p.name;
}

function isTrue(value: unknown): boolean {
    return value === true || value === 'true' || value === '';
}
