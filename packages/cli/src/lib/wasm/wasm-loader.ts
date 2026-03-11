import { ICliWasmAccelerator } from './types';
import { JsFallbackAccelerator } from './fallback';

/** Cached accelerator instance. */
let accelerator: ICliWasmAccelerator | null = null;

/** Whether initialization has been attempted. */
let initialized = false;

/** Whether the WASM module loaded successfully (vs JS fallback). */
let wasmLoaded = false;

/** Default paths where the .wasm binary might be served from. */
const WASM_SEARCH_PATHS = [
    '/assets/wasm/qodalis_cli_wasm_bg.wasm',
    './assets/wasm/qodalis_cli_wasm_bg.wasm',
    '/wasm/qodalis_cli_wasm_bg.wasm',
];

// ── wasm-bindgen glue (inlined from wasm-pack output) ──────────────

let wasm: any;
let cachedDataViewMemory0: DataView | null = null;
let cachedInt32ArrayMemory0: Int32Array | null = null;
let cachedUint8ArrayMemory0: Uint8Array | null = null;
let WASM_VECTOR_LEN = 0;

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;

const cachedTextEncoder: any = new TextEncoder();
if (!('encodeInto' in cachedTextEncoder)) {
    cachedTextEncoder.encodeInto = function (arg: string, view: Uint8Array) {
        const buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return { read: arg.length, written: buf.length };
    };
}

function getDataViewMemory0(): DataView {
    if (cachedDataViewMemory0 === null || (cachedDataViewMemory0.buffer as any).detached === true ||
        ((cachedDataViewMemory0.buffer as any).detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

function getInt32ArrayMemory0(): Int32Array {
    if (cachedInt32ArrayMemory0 === null || cachedInt32ArrayMemory0.byteLength === 0) {
        cachedInt32ArrayMemory0 = new Int32Array(wasm.memory.buffer);
    }
    return cachedInt32ArrayMemory0;
}

function getUint8ArrayMemory0(): Uint8Array {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function decodeText(ptr: number, len: number): string {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

function getStringFromWasm0(ptr: number, len: number): string {
    ptr = ptr >>> 0;
    return decodeText(ptr, len);
}

function passStringToWasm0(arg: string, malloc: any, realloc: any): number {
    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;
    const mem = getUint8ArrayMemory0();
    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }

    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = cachedTextEncoder.encodeInto(arg, view);
        offset += ret.written!;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

function getArrayI32FromWasm0(ptr: number, len: number): Int32Array {
    ptr = ptr >>> 0;
    return getInt32ArrayMemory0().subarray(ptr / 4, ptr / 4 + len);
}

// ── WASM function wrappers ─────────────────────────────────────────

function wasmTextSearch(
    text: string, needle: string,
    startRow: number, startCol: number,
    caseSensitive: boolean, wrap: boolean,
): Int32Array {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        const ptr0 = passStringToWasm0(text, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(needle, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len1 = WASM_VECTOR_LEN;
        wasm.text_search(retptr, ptr0, len0, ptr1, len1, startRow, startCol, caseSensitive, wrap);
        const r0 = getDataViewMemory0().getInt32(retptr + 0, true);
        const r1 = getDataViewMemory0().getInt32(retptr + 4, true);
        const v = getArrayI32FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export3(r0, r1 * 4, 4);
        return v;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

function wasmTextReplaceAll(
    text: string, needle: string,
    replacement: string, caseSensitive: boolean,
): string {
    let d0: number, d1: number;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        const ptr0 = passStringToWasm0(text, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(needle, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passStringToWasm0(replacement, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len2 = WASM_VECTOR_LEN;
        wasm.text_replace_all(retptr, ptr0, len0, ptr1, len1, ptr2, len2, caseSensitive);
        d0 = getDataViewMemory0().getInt32(retptr + 0, true);
        d1 = getDataViewMemory0().getInt32(retptr + 4, true);
        return getStringFromWasm0(d0, d1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(d0!, d1!, 1);
    }
}

function wasmPrefixMatch(candidates: string, prefix: string): string {
    let d0: number, d1: number;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        const ptr0 = passStringToWasm0(candidates, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(prefix, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len1 = WASM_VECTOR_LEN;
        wasm.prefix_match(retptr, ptr0, len0, ptr1, len1);
        d0 = getDataViewMemory0().getInt32(retptr + 0, true);
        d1 = getDataViewMemory0().getInt32(retptr + 4, true);
        return getStringFromWasm0(d0, d1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(d0!, d1!, 1);
    }
}

function wasmCommonPrefix(strings: string): string {
    let d0: number, d1: number;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        const ptr0 = passStringToWasm0(strings, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.common_prefix(retptr, ptr0, len0);
        d0 = getDataViewMemory0().getInt32(retptr + 0, true);
        d1 = getDataViewMemory0().getInt32(retptr + 4, true);
        return getStringFromWasm0(d0, d1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(d0!, d1!, 1);
    }
}

// ── WASM instantiation ─────────────────────────────────────────────

async function instantiateWasm(wasmBytes: ArrayBuffer): Promise<void> {
    const imports = { __proto__: null, './qodalis_cli_wasm_bg.js': { __proto__: null } };
    const { instance } = await WebAssembly.instantiate(wasmBytes, imports as any);
    wasm = instance.exports;
    cachedDataViewMemory0 = null;
    cachedInt32ArrayMemory0 = null;
    cachedUint8ArrayMemory0 = null;
}

async function fetchWasmBinary(paths: string[]): Promise<ArrayBuffer> {
    for (const path of paths) {
        try {
            const response = await fetch(path);
            if (response.ok) {
                return await response.arrayBuffer();
            }
        } catch {
            // try next path
        }
    }
    throw new Error('WASM binary not found');
}

// ── Public API ──────────────────────────────────────────────────────

function createWasmAccelerator(): ICliWasmAccelerator {
    return {
        textSearch(text, needle, startRow, startCol, caseSensitive, wrap) {
            const result = wasmTextSearch(text, needle, startRow, startCol, caseSensitive, wrap);
            return [result[0], result[1]];
        },

        textReplaceAll(text, needle, replacement, caseSensitive) {
            const raw = wasmTextReplaceAll(text, needle, replacement, caseSensitive);
            const idx = raw.indexOf('\n');
            return {
                count: parseInt(raw.slice(0, idx), 10),
                text: raw.slice(idx + 1),
            };
        },

        prefixMatch(candidates, prefix) {
            const result = wasmPrefixMatch(candidates.join('\n'), prefix);
            return result === '' ? [] : result.split('\n');
        },

        commonPrefix(strings) {
            return wasmCommonPrefix(strings.join('\n'));
        },
    };
}

/**
 * Attempt to load the WASM accelerator module.
 * Searches for the .wasm binary at common asset paths.
 * Falls back silently to JsFallbackAccelerator on failure.
 * Safe to call multiple times — only the first call performs the load.
 *
 * @param wasmUrl Optional explicit URL to the .wasm binary.
 */
export async function initWasmAccelerator(wasmUrl?: string): Promise<ICliWasmAccelerator> {
    if (initialized && accelerator) {
        return accelerator;
    }

    try {
        const paths = wasmUrl ? [wasmUrl, ...WASM_SEARCH_PATHS] : WASM_SEARCH_PATHS;
        const bytes = await fetchWasmBinary(paths);
        await instantiateWasm(bytes);
        accelerator = createWasmAccelerator();
        wasmLoaded = true;
    } catch {
        accelerator = new JsFallbackAccelerator();
    }

    initialized = true;
    return accelerator;
}

/**
 * Synchronously return the cached accelerator.
 * If not yet initialized, creates a JsFallbackAccelerator immediately.
 * Intended for use in hot paths where async loading is not acceptable.
 */
export function getAccelerator(): ICliWasmAccelerator {
    if (!accelerator) {
        accelerator = new JsFallbackAccelerator();
    }
    return accelerator;
}

/**
 * Returns true if the WASM accelerator was loaded successfully.
 * Returns false if using the JS fallback.
 */
export function isWasmAccelerated(): boolean {
    return wasmLoaded;
}
