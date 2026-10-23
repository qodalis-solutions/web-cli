/**
 * Playground links: the code and the commands to run travel in the URL
 * fragment (never sent to the server), deflate-compressed and base64url-encoded.
 *
 *   /docs/playground#code=<...>&run=<...>
 */
export const PLAYGROUND_PATH = '/docs/playground';

export interface PlaygroundSnippet {
    code: string;
    commands?: string;
}

export async function playgroundUrl(snippet: PlaygroundSnippet): Promise<string> {
    const params = new URLSearchParams();
    params.set('code', await encode(snippet.code));
    if (snippet.commands?.trim()) params.set('run', await encode(snippet.commands));
    return `${PLAYGROUND_PATH}#${params.toString()}`;
}

/** The snippet in a playground URL fragment, or undefined when it has none or it is damaged. */
export async function readPlaygroundFragment(fragment: string): Promise<PlaygroundSnippet | undefined> {
    const params = new URLSearchParams(fragment.replace(/^#/, ''));
    const code = params.get('code');
    if (!code) return undefined;
    try {
        const run = params.get('run');
        return { code: await decode(code), commands: run ? await decode(run) : undefined };
    } catch {
        return undefined;
    }
}

async function encode(text: string): Promise<string> {
    const bytes = new TextEncoder().encode(text);
    const packed = typeof CompressionStream === 'function'
        ? await transform(bytes, new CompressionStream('deflate-raw'))
        : bytes;
    // "z" marks compressed data, "p" plain (browsers without CompressionStream)
    const prefix = packed === bytes ? 'p' : 'z';
    return prefix + toBase64Url(packed);
}

async function decode(value: string): Promise<string> {
    const bytes = fromBase64Url(value.slice(1));
    const unpacked = value[0] === 'z'
        ? await transform(bytes, new DecompressionStream('deflate-raw'))
        : bytes;
    return new TextDecoder().decode(unpacked);
}

async function transform(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
    const output = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
    return new Uint8Array(await new Response(output).arrayBuffer());
}

function toBase64Url(bytes: Uint8Array): string {
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): Uint8Array {
    const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}
