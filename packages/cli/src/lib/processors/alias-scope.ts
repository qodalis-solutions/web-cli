import {
    ICliAuthorizationService,
    ICliAuthorizationService_TOKEN,
    ICliExecutionContext,
} from '@qodalis/cli-core';

const ANONYMOUS = '\u0000anonymous';

/**
 * Aliases are per user when an auth module is loaded (so one user cannot plant
 * an alias that another, more privileged user later runs). Without an auth
 * module there is a single shared set, as before.
 *
 * @returns the owner key, or undefined for the shared set
 */
export function aliasOwner(context: Pick<ICliExecutionContext, 'services'>): string | undefined {
    let auth: ICliAuthorizationService | undefined;
    try {
        auth = context.services.get<ICliAuthorizationService>(ICliAuthorizationService_TOKEN);
    } catch {
        auth = undefined;
    }
    if (!auth) return undefined;
    return auth.getPrincipal()?.name ?? ANONYMOUS;
}

export interface CliAliasState {
    aliases?: Record<string, string>;
    aliasesByUser?: Record<string, Record<string, string>>;
}

export function aliasesFor(state: CliAliasState | undefined, owner: string | undefined): Record<string, string> {
    if (owner === undefined) return state?.aliases ?? {};
    return state?.aliasesByUser?.[owner] ?? {};
}

export function withAliases(
    state: CliAliasState | undefined,
    owner: string | undefined,
    aliases: Record<string, string>,
): CliAliasState {
    if (owner === undefined) return { aliases };
    return { aliasesByUser: { ...(state?.aliasesByUser ?? {}), [owner]: aliases } };
}
