import {
    CliForegroundColor,
    CliIcon,
    CliProcessCommand,
    CliProcessorMetadata,
    DefaultLibraryAuthor,
    ICliAuditService,
    ICliAuditService_TOKEN,
    ICliAuthService,
    ICliAuthService_TOKEN,
    ICliCommandAuthor,
    ICliCommandParameterDescriptor,
    ICliCommandProcessor,
    ICliExecutionContext,
    ICliGroupsStoreService,
    ICliGroupsStoreService_TOKEN,
    ICliPermissionRegistry,
    ICliPermissionRegistry_TOKEN,
    ICliSessionsService,
    ICliSessionsService_TOKEN,
    ICliUsersStoreService,
    ICliUsersStoreService_TOKEN,
} from '@qodalis/cli-core';
import { CliUsersModuleConfig, CliUsersModuleConfig_TOKEN } from '../models/users-module-config';

/** Services the users commands work with (identical in local and server mode). */
export interface CliUsersCommandServices {
    users: ICliUsersStoreService & {
        getPermissions?(id: string): Promise<{ userId: string; groups: string[]; permissions: string[] }>;
    };
    groups: ICliGroupsStoreService;
    auth: ICliAuthService & { passwordless?: boolean; hostManaged?: boolean };
    sessions: ICliSessionsService;
    audit: ICliAuditService;
    config: CliUsersModuleConfig;
    registry?: ICliPermissionRegistry;
}

export function usersServices(context: ICliExecutionContext): CliUsersCommandServices {
    const s = context.services;
    return {
        users: s.getRequired(ICliUsersStoreService_TOKEN),
        groups: s.getRequired(ICliGroupsStoreService_TOKEN),
        auth: s.getRequired(ICliAuthService_TOKEN),
        sessions: s.getRequired(ICliSessionsService_TOKEN),
        audit: s.getRequired(ICliAuditService_TOKEN),
        config: s.get<CliUsersModuleConfig>(CliUsersModuleConfig_TOKEN) ?? {},
        registry: s.get<ICliPermissionRegistry>(ICliPermissionRegistry_TOKEN),
    };
}

/** Metadata shared by every users command */
export const USERS_METADATA: CliProcessorMetadata = { sealed: true, module: 'users', icon: CliIcon.User };

/** Common shape of every users command. */
export abstract class CliUsersCommand implements ICliCommandProcessor {
    abstract command: string;
    abstract description: string;
    aliases?: string[];
    author: ICliCommandAuthor = DefaultLibraryAuthor;
    acceptsRawInput?: boolean;
    valueRequired?: boolean;
    parameters?: ICliCommandParameterDescriptor[];
    metadata: CliProcessorMetadata = { ...USERS_METADATA };

    /** Usage lines: [syntax, explanation] */
    protected abstract usage: Array<[string, string]>;

    abstract processCommand(command: CliProcessCommand, context: ICliExecutionContext): Promise<void>;

    writeDescription(context: ICliExecutionContext): void {
        const { writer } = context;
        writer.writeln(this.description);
        writer.writeln();
        writer.writeln('Usage:');
        const width = Math.max(...this.usage.map(([u]) => u.length));
        for (const [syntax, text] of this.usage) {
            writer.writeln(`  ${writer.wrapInColor(syntax.padEnd(width), CliForegroundColor.Cyan)}  ${text}`);
        }
        const access = accessText(this.metadata);
        if (access) {
            writer.writeln();
            writer.writeln(`Access: ${access}`);
        }
    }
}

function accessText(meta: CliProcessorMetadata): string | undefined {
    if (meta.requiredPermissions?.length) return `requires ${meta.requiredPermissions.join(', ')}`;
    if (meta.requiredGroups?.length) return `requires group ${meta.requiredGroups.join(' or ')}`;
    if (meta.requireAuth) return 'requires login';
    return undefined;
}

/** Positional value split into words */
export function words(command: CliProcessCommand): string[] {
    return String(command.value ?? '').trim().split(/\s+/).filter(Boolean);
}

/** Comma separated list argument */
export function listArg(value: unknown): string[] | undefined {
    if (value === undefined || value === null || value === true) return undefined;
    return String(value).split(',').map((v) => v.trim()).filter(Boolean);
}

export function formatTime(ts?: number): string {
    return ts ? new Date(ts).toLocaleString() : '-';
}

/** Ask for a new password twice; null when aborted or mismatched (error printed). */
/** How many times interactive prompts re-ask after an invalid answer (like `passwd`). */
export const MAX_PROMPT_ATTEMPTS = 3;

/**
 * Asks for a value until `check` accepts it (returns null) or the attempts run out.
 * Returns null when the user aborts or every attempt was invalid.
 */
export async function readValidated(
    context: ICliExecutionContext,
    prompt: string,
    check: (value: string) => string | null,
): Promise<string | null> {
    for (let attempt = 1; attempt <= MAX_PROMPT_ATTEMPTS; attempt++) {
        const value = await context.reader.readLine(prompt);
        if (value === null) {
            context.writer.writeError('Aborted');
            return null;
        }
        const error = check(value.trim());
        if (!error) return value.trim();
        context.writer.writeError(error);
    }
    return null;
}

export async function readNewPassword(context: ICliExecutionContext, auth: ICliAuthService): Promise<string | null> {
    for (let attempt = 1; attempt <= MAX_PROMPT_ATTEMPTS; attempt++) {
        const password = await context.reader.readPassword('New password: ');
        if (password === null) {
            context.writer.writeError('Aborted');
            return null;
        }
        const policyError = auth.validatePassword?.(password);
        if (policyError) {
            context.writer.writeError(policyError);
            continue;
        }
        const confirm = await context.reader.readPassword('Retype new password: ');
        if (confirm === null) {
            context.writer.writeError('Aborted');
            return null;
        }
        if (confirm === password) return password;
        context.writer.writeError('Sorry, passwords do not match.');
    }
    context.writer.writeError('Password unchanged: too many failed attempts.');
    return null;
}
