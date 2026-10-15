import { cliHasPermission } from '@qodalis/cli-core';
import { CliUsersError } from './users-backend';

/** Input rules shared with the servers (security contract B7). */
export const NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._@-]{0,63}$/;
/**
 * Email addresses: a dot-atom local part (max 64) and a domain of DNS labels
 * ending in a letters-only TLD, or `localhost` (seeded `root@localhost`).
 * Max 254 characters overall. Same rule on all three servers.
 */
export const EMAIL_PATTERN =
    /^(?=.{1,254}$)(?=[^@]{1,64}@)[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:localhost|(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63})$/;
export const PERMISSION_PATTERN = /^(\*|[a-z0-9_.-]+(:([a-z0-9_.-]+|\*))*)$/i;
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]/;

export function assertName(value: string, what = 'name'): string {
    const name = (value ?? '').trim();
    if (!name) throw new CliUsersError(400, `${what} is required`);
    if (!NAME_PATTERN.test(name)) {
        throw new CliUsersError(400, `invalid ${what}: use 1-64 letters, digits, '.', '_', '@' or '-'`);
    }
    return name;
}

export function assertEmail(value: string): string {
    const email = (value ?? '').trim();
    if (!email) throw new CliUsersError(400, 'email is required');
    if (email.length > 254 || CONTROL_CHARS.test(email) || !EMAIL_PATTERN.test(email)) {
        throw new CliUsersError(400, `invalid email: ${email.replace(CONTROL_CHARS, '?').slice(0, 64)}`);
    }
    return email;
}

export function assertText(value: string | undefined, what: string, max: number): string | undefined {
    if (value === undefined) return undefined;
    if (value.length > max) throw new CliUsersError(400, `${what} is too long (max ${max})`);
    if (CONTROL_CHARS.test(value)) throw new CliUsersError(400, `${what} contains control characters`);
    return value;
}

export function assertPermissions(list: string[] | undefined): string[] | undefined {
    if (list === undefined) return undefined;
    if (list.length > 100) throw new CliUsersError(400, 'too many permissions (max 100)');
    for (const p of list) {
        if (typeof p !== 'string' || p.length > 128 || !PERMISSION_PATTERN.test(p.trim())) {
            throw new CliUsersError(400, `invalid permission: ${String(p).slice(0, 64)}`);
        }
    }
    return list.map((p) => p.trim());
}

export function assertData(data: Record<string, any> | undefined): void {
    if (data === undefined) return;
    if (JSON.stringify(data).length > 16 * 1024) throw new CliUsersError(400, 'data is too large (max 16 KB)');
}

/** Safe form of untrusted input for audit details (no control chars, bounded). */
export function sanitizeForAudit(value: string, max = 64): string {
    return String(value ?? '').replace(/[\u0000-\u001f\u007f-\u009f]/g, '?').slice(0, max);
}

/** True when every permission in `required` is granted by `held` (wildcards honoured). */
export function covers(held: readonly string[], required: readonly string[]): boolean {
    return required.every((p) => cliHasPermission(held, p));
}

/** Audit events only the users module writes (local backend and servers). */
const RESERVED_AUDIT_EVENTS = new Set(['login', 'logout', 'su']);
const RESERVED_AUDIT_PREFIXES = ['login_', 'logout_', 'user_', 'group_', 'session_', 'password_', 'audit_'];
const AUDIT_EVENT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$/;

/** True for built-in audit event names (case-insensitive), which extensions cannot write. */
export function isReservedAuditEvent(event: string): boolean {
    const name = String(event ?? '').trim().toLowerCase();
    return RESERVED_AUDIT_EVENTS.has(name) || RESERVED_AUDIT_PREFIXES.some((p) => name.startsWith(p));
}

/** Validate an extension's audit event name: well-formed and not a built-in one. */
export function assertCustomAuditEvent(event: string): string {
    const name = String(event ?? '').trim();
    if (!AUDIT_EVENT_PATTERN.test(name)) {
        throw new CliUsersError(400, `invalid audit event: ${sanitizeForAudit(name)}`);
    }
    if (isReservedAuditEvent(name)) {
        throw new CliUsersError(400, `audit event '${name}' is reserved for the users module`);
    }
    return name;
}
