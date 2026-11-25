import {
    CliProcessCommand,
    CliProcessorMetadata,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { CliUsersCommand, formatTime, USERS_METADATA, words } from './base';
import { CliLinkRequest, CliUsersError } from '../backend/users-backend';
import {
    CliApiTokensService,
    CliApiTokensService_TOKEN,
    LINKS_LOCAL_MESSAGE,
} from '../services/cli-users-services';

const LINK_METADATA: CliProcessorMetadata = { ...USERS_METADATA, requireAuth: true };

/** Terminal links service of this CLI; 501 with the local-mode message when links are not supported. */
function links(context: ICliExecutionContext): CliApiTokensService {
    const service = context.services.get<CliApiTokensService>(CliApiTokensService_TOKEN);
    if (!service?.linksSupported) throw new CliUsersError(501, LINKS_LOCAL_MESSAGE);
    return service;
}

/**
 * A link code as typed (`abcd-2345`, `ABCD 2345`, `abcd2345`) in the server's
 * form, `ABCD-2345`. Throws a usage error for anything that is not 8 letters
 * and digits.
 */
export function normalizeLinkCode(value: string | undefined, usage: string): string {
    const code = (value ?? '').replace(/[\s-]/g, '').toUpperCase();
    if (!code) throw new CliUsersError(400, `usage: ${usage}`);
    if (!/^[A-Z0-9]{8}$/.test(code)) {
        throw new CliUsersError(400, `invalid code '${value}': expected 8 letters and digits, e.g. ABCD-2345`);
    }
    return `${code.slice(0, 4)}-${code.slice(4)}`;
}

function isTrue(value: unknown): boolean {
    return value === true || value === 'true' || value === '';
}

/** The words after the sub-command, joined: `link approve ABCD 2345` is one code. */
function codeArg(command: CliProcessCommand): string | undefined {
    const parts = words(command);
    return parts.length ? parts.join('') : undefined;
}

function writeLinkRequest(context: ICliExecutionContext, link: CliLinkRequest): void {
    const { writer } = context;
    const rows: Array<[string, string]> = [
        ['Code', link.userCode],
        ['Terminal', link.client],
        ['Origin', link.origin ?? '-'],
        ['Address', link.remoteAddress ?? '-'],
        ['Permissions', link.permissions?.length ? link.permissions.join(', ') : 'all of yours'],
        ['Expires', formatTime(link.expiresAt)],
    ];
    for (const [label, value] of rows) writer.writeln(`  ${label.padEnd(12)} ${value}`);
}

class CliLinkApproveCommandProcessor extends CliUsersCommand {
    override command = 'approve';
    override description = 'Approve a terminal link request (creates an API token for it)';
    override acceptsRawInput = true;
    override valueRequired = true;
    override metadata: CliProcessorMetadata = { ...LINK_METADATA };
    override parameters = [
        {
            name: 'yes',
            aliases: ['y'],
            description: 'Do not ask for confirmation',
            type: 'boolean' as const,
            required: false,
        },
    ];
    protected override usage: Array<[string, string]> = [
        ['link approve <code>', 'Show the request, ask, then approve it'],
        ['link approve <code> --yes', 'Approve without asking'],
    ];

    override async processCommand(command: CliProcessCommand, context: ICliExecutionContext): Promise<void> {
        const service = links(context);
        const code = normalizeLinkCode(codeArg(command), 'link approve <code> [--yes]');
        const request = await service.linkRequest(code);
        writeLinkRequest(context, request);
        if (!(isTrue(command.args['yes']) || isTrue(command.args['y']))) {
            const ok = await context.reader.readConfirm(
                `Approve '${request.client}'? It gets an API token that acts as you.`,
                false,
            );
            if (!ok) {
                context.writer.writeInfo('Cancelled: the request is still pending');
                return;
            }
        }
        const approval = await service.approveLink(code);
        context.writer.writeSuccess(
            `Approved: token '${approval.tokenName}' (id ${approval.tokenId}) created for ${request.client}`,
        );
        context.writer.writeln(`Revoke it with: token revoke ${approval.tokenId}`);
    }
}

class CliLinkDenyCommandProcessor extends CliUsersCommand {
    override command = 'deny';
    override description = 'Deny a terminal link request';
    override acceptsRawInput = true;
    override valueRequired = true;
    override metadata: CliProcessorMetadata = { ...LINK_METADATA };
    protected override usage: Array<[string, string]> = [['link deny <code>', 'Refuse the request; the terminal is told']];

    override async processCommand(command: CliProcessCommand, context: ICliExecutionContext): Promise<void> {
        const service = links(context);
        const code = normalizeLinkCode(codeArg(command), 'link deny <code>');
        await service.denyLink(code);
        context.writer.writeSuccess(`Link request ${code} denied`);
    }
}

/**
 * `link approve|deny <code>`: answer the link request of another terminal
 * (`server add` there shows the code), as the server's approval page does.
 */
export class CliLinkCommandProcessor extends CliUsersCommand {
    override command = 'link';
    override description = "Approve or deny another terminal's link request (server add)";
    override metadata: CliProcessorMetadata = { ...LINK_METADATA };
    processors: ICliCommandProcessor[] = [new CliLinkApproveCommandProcessor(), new CliLinkDenyCommandProcessor()];
    protected override usage: Array<[string, string]> = [
        ['link approve <code> [--yes]', 'Approve: creates an API token acting as you for that terminal'],
        ['link deny <code>', 'Deny the request'],
    ];

    override async processCommand(_command: CliProcessCommand, context: ICliExecutionContext): Promise<void> {
        links(context); // local mode: explain where links are available
        this.writeDescription(context);
    }
}
