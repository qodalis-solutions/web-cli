/**
 * Password hashing shared with the servers' format:
 * `pbkdf2$<iterations>$<saltB64>$<hashB64>` (PBKDF2-HMAC-SHA256, 32-byte key).
 * Legacy local credentials (hex SHA-256 of salt + password) are still
 * verified and flagged for re-hashing.
 */
export const DEFAULT_HASH_ITERATIONS = 100_000;

const toB64 = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes));
const fromB64 = (b64: string): Uint8Array => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
    const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(password),
        'PBKDF2',
        false,
        ['deriveBits'],
    );
    const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
        key,
        256,
    );
    return new Uint8Array(bits);
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
    return diff === 0;
}

export async function hashPassword(password: string, iterations = DEFAULT_HASH_ITERATIONS): Promise<string> {
    const salt = new Uint8Array(16);
    crypto.getRandomValues(salt);
    const hash = await pbkdf2(password, salt, iterations);
    return `pbkdf2$${iterations}$${toB64(salt)}$${toB64(hash)}`;
}

export async function verifyPasswordHash(
    password: string,
    stored: string,
    legacySalt?: string,
): Promise<{ valid: boolean; needsRehash: boolean }> {
    if (stored.startsWith('pbkdf2$')) {
        const [, iter, saltB64, hashB64] = stored.split('$');
        const iterations = Number(iter);
        if (!iterations || !saltB64 || !hashB64) return { valid: false, needsRehash: false };
        const actual = await pbkdf2(password, fromB64(saltB64), iterations);
        return { valid: constantTimeEqual(actual, fromB64(hashB64)), needsRehash: false };
    }
    // Legacy: hex(SHA-256(salt + password))
    const digest = new Uint8Array(
        await crypto.subtle.digest('SHA-256', new TextEncoder().encode((legacySalt ?? '') + password)),
    );
    const hex = Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('');
    const valid = constantTimeEqual(new TextEncoder().encode(hex), new TextEncoder().encode(stored));
    return { valid, needsRehash: valid };
}
