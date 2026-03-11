# WebAssembly CLI Acceleration — Nano Editor & Tab Completion

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add WebAssembly-accelerated text search (nano editor) and prefix matching (tab completion) directly inside `@qodalis/cli`, with automatic JS fallback.

**Architecture:** A Rust crate at `packages/cli/wasm/` compiles via wasm-pack into `packages/cli/wasm/pkg/`. TypeScript wrappers at `packages/cli/src/lib/wasm/` load the `.wasm` binary and expose a unified `ICliWasmAccelerator` interface. When WASM isn't available, a `JsFallbackAccelerator` provides identical behavior using pure JS. The CLI eagerly initializes WASM at startup so `getAcceleratorSync()` returns the fast path by the time the user types.

**Tech Stack:** Rust + wasm-pack + wasm-bindgen (WASM crate), TypeScript + tsup (wrapper), existing Karma/Jasmine tests.

---

## Task 1: Scaffold the Rust/WASM crate inside packages/cli

**Files:**
- Create: `packages/cli/wasm/Cargo.toml`
- Create: `packages/cli/wasm/src/lib.rs`
- Create: `packages/cli/wasm/.gitignore`
- Create: `packages/cli/wasm/build.sh`

**Step 1: Create Cargo.toml**

```toml
[package]
name = "qodalis-cli-wasm"
version = "2.0.0-beta.1"
edition = "2021"

[lib]
crate-type = ["cdylib", "rlib"]

[dependencies]
wasm-bindgen = "0.2"

[profile.release]
opt-level = "z"
lto = true
codegen-units = 1
strip = true
```

**Step 2: Create src/lib.rs**

```rust
use wasm_bindgen::prelude::*;

/// Boyer-Moore-Horspool text search across newline-separated text.
/// Returns [row, col] of first match from (start_row, start_col), or [-1, -1].
#[wasm_bindgen]
pub fn text_search(
    text: &str,
    needle: &str,
    start_row: usize,
    start_col: usize,
    case_sensitive: bool,
    wrap: bool,
) -> Vec<i32> {
    if needle.is_empty() {
        return vec![-1, -1];
    }

    let lines: Vec<&str> = text.split('\n').collect();
    let total = lines.len();

    let needle_lower;
    let search_needle = if case_sensitive {
        needle
    } else {
        needle_lower = needle.to_lowercase();
        &needle_lower
    };

    let needle_bytes = search_needle.as_bytes();
    let nlen = needle_bytes.len();

    // Build Boyer-Moore-Horspool bad character table
    let mut shift = [nlen; 256];
    for i in 0..nlen - 1 {
        shift[needle_bytes[i] as usize] = nlen - 1 - i;
    }

    // Search from start_row to end
    for row in start_row..total {
        let line = lines[row];
        let haystack = if case_sensitive {
            line.to_string()
        } else {
            line.to_lowercase()
        };
        let hay = haystack.as_bytes();
        let from = if row == start_row { start_col + 1 } else { 0 };

        if let Some(col) = bmh_search(hay, needle_bytes, &shift, from) {
            return vec![row as i32, col as i32];
        }
    }

    if !wrap {
        return vec![-1, -1];
    }

    // Wrap around from beginning to start_row
    for row in 0..=start_row {
        let line = lines[row];
        let haystack = if case_sensitive {
            line.to_string()
        } else {
            line.to_lowercase()
        };
        let hay = haystack.as_bytes();
        let end_col = if row == start_row {
            start_col
        } else {
            haystack.len()
        };

        if let Some(col) = bmh_search(hay, needle_bytes, &shift, 0) {
            if row < start_row || col < end_col {
                return vec![row as i32, col as i32];
            }
        }
    }

    vec![-1, -1]
}

/// Replace all occurrences of needle in text.
/// Returns "count\n<new_text>" to avoid multiple return values.
#[wasm_bindgen]
pub fn text_replace_all(
    text: &str,
    needle: &str,
    replacement: &str,
    case_sensitive: bool,
) -> String {
    if needle.is_empty() {
        return format!("0\n{}", text);
    }

    let lines: Vec<&str> = text.split('\n').collect();
    let mut result_lines: Vec<String> = Vec::with_capacity(lines.len());
    let mut count: usize = 0;

    let needle_lower;
    let search_needle = if case_sensitive {
        needle
    } else {
        needle_lower = needle.to_lowercase();
        &needle_lower
    };

    let nlen = needle.len();
    let needle_bytes = search_needle.as_bytes();

    let mut shift_table = [nlen; 256];
    for i in 0..nlen - 1 {
        shift_table[needle_bytes[i] as usize] = nlen - 1 - i;
    }

    for line in lines {
        let hay_lower;
        let haystack: &str = if case_sensitive {
            line
        } else {
            hay_lower = line.to_lowercase();
            &hay_lower
        };

        let hay = haystack.as_bytes();
        let src = line.as_bytes();
        let mut new_line = Vec::new();
        let mut pos = 0;

        while pos + nlen <= hay.len() {
            if let Some(idx) = bmh_search(hay, needle_bytes, &shift_table, pos) {
                new_line.extend_from_slice(&src[pos..idx]);
                new_line.extend_from_slice(replacement.as_bytes());
                pos = idx + nlen;
                count += 1;
            } else {
                break;
            }
        }
        new_line.extend_from_slice(&src[pos..]);
        result_lines.push(String::from_utf8_lossy(&new_line).to_string());
    }

    format!("{}\n{}", count, result_lines.join("\n"))
}

/// Batch prefix matching for tab completion.
/// candidates: newline-separated. Returns newline-separated sorted matches.
#[wasm_bindgen]
pub fn prefix_match(candidates: &str, prefix: &str) -> String {
    if prefix.is_empty() {
        let mut all: Vec<&str> = candidates.split('\n').filter(|s| !s.is_empty()).collect();
        all.sort_unstable();
        return all.join("\n");
    }

    let prefix_lower = prefix.to_lowercase();
    let mut matches: Vec<&str> = candidates
        .split('\n')
        .filter(|s| !s.is_empty() && s.to_lowercase().starts_with(&prefix_lower))
        .collect();

    matches.sort_unstable();
    matches.join("\n")
}

/// Longest common prefix of newline-separated strings.
#[wasm_bindgen]
pub fn common_prefix(strings: &str) -> String {
    let items: Vec<&str> = strings.split('\n').filter(|s| !s.is_empty()).collect();
    if items.is_empty() {
        return String::new();
    }

    let first = items[0].as_bytes();
    let mut len = first.len();

    for item in &items[1..] {
        let bytes = item.as_bytes();
        len = len.min(bytes.len());
        for i in 0..len {
            if first[i] != bytes[i] {
                len = i;
                break;
            }
        }
        if len == 0 {
            return String::new();
        }
    }

    items[0][..len].to_string()
}

fn bmh_search(hay: &[u8], needle: &[u8], shift: &[usize; 256], from: usize) -> Option<usize> {
    let hlen = hay.len();
    let nlen = needle.len();
    if nlen == 0 || from + nlen > hlen {
        return None;
    }

    let mut i = from;
    while i + nlen <= hlen {
        let mut j = nlen - 1;
        while hay[i + j] == needle[j] {
            if j == 0 {
                return Some(i);
            }
            j -= 1;
        }
        i += shift[hay[i + nlen - 1] as usize];
    }

    None
}
```

**Step 3: Create .gitignore**

```
/target/
/pkg/
```

**Step 4: Create build.sh**

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
wasm-pack build --target web --out-dir pkg --release
```

**Step 5: Build and verify**

Run: `cd packages/cli/wasm && chmod +x build.sh && ./build.sh`
Expected: `packages/cli/wasm/pkg/` with `.wasm`, `.js`, `.d.ts` files

---

## Task 2: Create the TypeScript wrapper with JS fallback

**Files:**
- Create: `packages/cli/src/lib/wasm/types.ts`
- Create: `packages/cli/src/lib/wasm/fallback.ts`
- Create: `packages/cli/src/lib/wasm/wasm-loader.ts`
- Create: `packages/cli/src/lib/wasm/index.ts`

**Step 1: Create types.ts**

```typescript
export interface ICliWasmAccelerator {
    /** Search for needle starting from (startRow, startCol). Returns [row, col] or [-1, -1]. */
    textSearch(
        text: string,
        needle: string,
        startRow: number,
        startCol: number,
        caseSensitive: boolean,
        wrap: boolean,
    ): [number, number];

    /** Replace all occurrences. Returns { count, text }. */
    textReplaceAll(
        text: string,
        needle: string,
        replacement: string,
        caseSensitive: boolean,
    ): { count: number; text: string };

    /** Filter candidates by prefix (case-insensitive), return sorted matches. */
    prefixMatch(candidates: string[], prefix: string): string[];

    /** Longest common prefix of the given strings. */
    commonPrefix(strings: string[]): string;
}
```

**Step 2: Create fallback.ts**

```typescript
import { ICliWasmAccelerator } from './types';

export class JsFallbackAccelerator implements ICliWasmAccelerator {
    textSearch(
        text: string,
        needle: string,
        startRow: number,
        startCol: number,
        caseSensitive: boolean,
        wrap: boolean,
    ): [number, number] {
        if (!needle) return [-1, -1];

        const lines = text.split('\n');
        const search = caseSensitive ? needle : needle.toLowerCase();

        for (let row = startRow; row < lines.length; row++) {
            const line = caseSensitive ? lines[row] : lines[row].toLowerCase();
            const from = row === startRow ? startCol + 1 : 0;
            const idx = line.indexOf(search, from);
            if (idx !== -1) return [row, idx];
        }

        if (!wrap) return [-1, -1];

        for (let row = 0; row <= startRow; row++) {
            const line = caseSensitive ? lines[row] : lines[row].toLowerCase();
            const endCol = row === startRow ? startCol : line.length;
            const idx = line.indexOf(search);
            if (idx !== -1 && idx < endCol) return [row, idx];
        }

        return [-1, -1];
    }

    textReplaceAll(
        text: string,
        needle: string,
        replacement: string,
        caseSensitive: boolean,
    ): { count: number; text: string } {
        if (!needle) return { count: 0, text };

        const lines = text.split('\n');
        let count = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            let newLine = '';
            let searchFrom = 0;
            const search = caseSensitive ? needle : needle.toLowerCase();

            while (searchFrom <= line.length) {
                const haystack = caseSensitive ? line : line.toLowerCase();
                const idx = haystack.indexOf(search, searchFrom);
                if (idx === -1) {
                    newLine += line.slice(searchFrom);
                    break;
                }
                newLine += line.slice(searchFrom, idx) + replacement;
                searchFrom = idx + needle.length;
                count++;
            }

            lines[i] = newLine;
        }

        return { count, text: lines.join('\n') };
    }

    prefixMatch(candidates: string[], prefix: string): string[] {
        if (!prefix) {
            return [...candidates].sort();
        }
        const lowerPrefix = prefix.toLowerCase();
        return candidates
            .filter((c) => c.toLowerCase().startsWith(lowerPrefix))
            .sort();
    }

    commonPrefix(strings: string[]): string {
        if (strings.length === 0) return '';
        let prefix = strings[0];
        for (let i = 1; i < strings.length; i++) {
            while (!strings[i].startsWith(prefix)) {
                prefix = prefix.slice(0, -1);
                if (prefix === '') return '';
            }
        }
        return prefix;
    }
}
```

**Step 3: Create wasm-loader.ts**

```typescript
import { ICliWasmAccelerator } from './types';
import { JsFallbackAccelerator } from './fallback';

let accelerator: ICliWasmAccelerator | null = null;
let loadAttempted = false;

/**
 * Eagerly load the WASM accelerator. Falls back to JS if unavailable.
 * Safe to call multiple times — only loads once.
 */
export async function initWasmAccelerator(): Promise<ICliWasmAccelerator> {
    if (accelerator) return accelerator;

    if (!loadAttempted) {
        loadAttempted = true;
        try {
            const wasm = await import('../../wasm/pkg/qodalis_cli_wasm');
            await wasm.default();
            accelerator = createWasmAccelerator(wasm);
            return accelerator;
        } catch {
            // WASM not available — use JS fallback
        }
    }

    accelerator = new JsFallbackAccelerator();
    return accelerator;
}

/**
 * Get the accelerator synchronously. Returns WASM if already loaded, else JS fallback.
 * Call initWasmAccelerator() at startup to ensure WASM is ready.
 */
export function getAccelerator(): ICliWasmAccelerator {
    if (accelerator) return accelerator;
    accelerator = new JsFallbackAccelerator();
    return accelerator;
}

function createWasmAccelerator(wasm: any): ICliWasmAccelerator {
    return {
        textSearch(text, needle, startRow, startCol, caseSensitive, wrap) {
            const result = wasm.text_search(
                text, needle, startRow, startCol, caseSensitive, wrap,
            );
            return [result[0], result[1]];
        },

        textReplaceAll(text, needle, replacement, caseSensitive) {
            const raw = wasm.text_replace_all(text, needle, replacement, caseSensitive);
            const idx = raw.indexOf('\n');
            return {
                count: parseInt(raw.slice(0, idx), 10),
                text: raw.slice(idx + 1),
            };
        },

        prefixMatch(candidates, prefix) {
            const result = wasm.prefix_match(candidates.join('\n'), prefix);
            return result ? result.split('\n').filter(Boolean) : [];
        },

        commonPrefix(strings) {
            return wasm.common_prefix(strings.join('\n'));
        },
    };
}
```

**Step 4: Create index.ts**

```typescript
export { ICliWasmAccelerator } from './types';
export { JsFallbackAccelerator } from './fallback';
export { initWasmAccelerator, getAccelerator } from './wasm-loader';
```

**Step 5: Export from packages/cli/src/lib/index.ts**

Add: `export * from './wasm';`

---

## Task 3: Integrate WASM into NanoEditorBuffer

**Files:**
- Modify: `packages/cli/src/lib/editor/nano-editor-buffer.ts`

**Step 1: Replace searchForward and replaceAll**

Add import at top:
```typescript
import { getAccelerator } from '../wasm';
```

Replace `searchForward`:
```typescript
searchForward(needle: string, caseSensitive = false): boolean {
    if (!needle) return false;

    const accel = getAccelerator();
    const text = this.lines.join('\n');
    const [row, col] = accel.textSearch(
        text, needle, this.cursorRow, this.cursorCol, caseSensitive, true,
    );

    if (row === -1) return false;

    this.cursorRow = row;
    this.cursorCol = col;
    return true;
}
```

Replace `replaceAll`:
```typescript
replaceAll(
    needle: string,
    replacement: string,
    caseSensitive = false,
): number {
    if (!needle) return 0;

    const accel = getAccelerator();
    const text = this.lines.join('\n');
    const result = accel.textReplaceAll(text, needle, replacement, caseSensitive);

    if (result.count > 0) {
        this.lines = result.text.split('\n');
        this.dirty = true;
    }

    return result.count;
}
```

---

## Task 4: Integrate WASM into tab completion

**Files:**
- Modify: `packages/cli/src/lib/completion/cli-command-completion-provider.ts`
- Modify: `packages/cli/src/lib/completion/cli-parameter-completion-provider.ts`
- Modify: `packages/cli/src/lib/completion/cli-completion-engine.ts`

**Step 1: Update CliCommandCompletionProvider**

Add import:
```typescript
import { getAccelerator } from '../wasm';
```

Replace `getCommandNames`:
```typescript
private getCommandNames(
    processors: ICliCommandProcessor[],
    prefix: string,
): string[] {
    const names: string[] = [];
    for (const p of processors) {
        names.push(p.command);
        if (p.aliases) {
            names.push(...p.aliases);
        }
    }
    return getAccelerator().prefixMatch(names, prefix);
}
```

**Step 2: Update CliParameterCompletionProvider**

Add import:
```typescript
import { getAccelerator } from '../wasm';
```

Replace the filtering loop at end of `getCompletions` with:
```typescript
const candidates: string[] = [];
for (const param of allParameters) {
    if (isDoubleDash) {
        candidates.push(`--${param.name}`);
    } else {
        if (param.aliases) {
            for (const alias of param.aliases) {
                candidates.push(`-${alias}`);
            }
        }
        candidates.push(`--${param.name}`);
    }
}

const dashPrefix = isDoubleDash ? `--${prefix}` : `-${prefix}`;
return getAccelerator().prefixMatch(candidates, dashPrefix);
```

**Step 3: Update CliCompletionEngine**

Add import:
```typescript
import { getAccelerator } from '../wasm';
```

Replace `commonPrefix`:
```typescript
private commonPrefix(strings: string[]): string {
    return getAccelerator().commonPrefix(strings);
}
```

---

## Task 5: Eager WASM initialization at CLI startup

**Files:**
- Modify: CLI engine initialization (find where `CliCompletionEngine` is created or the CLI boots)

**Step 1: Add eager init call**

Find the CLI engine constructor or init method. Add:
```typescript
import { initWasmAccelerator } from '../wasm';

// In constructor or init:
initWasmAccelerator().catch(() => {
    // Silent fallback — getAccelerator() returns JsFallbackAccelerator
});
```

This ensures WASM is loaded by the time the user types their first command.

---

## Task 6: Update build to compile WASM and copy .wasm to dist

**Files:**
- Modify: `packages/cli/project.json`

**Step 1: Add wasm build step to project.json**

Update the build target commands:
```json
{
    "commands": [
        "cd packages/cli/wasm && ./build.sh",
        "tsup",
        "cp package.json ../../dist/cli/package.json",
        "mkdir -p ../../dist/cli/assets && cp -r src/assets/* ../../dist/cli/assets/ 2>/dev/null || true",
        "mkdir -p ../../dist/cli/wasm && cp wasm/pkg/qodalis_cli_wasm_bg.wasm ../../dist/cli/wasm/"
    ]
}
```

**Step 2: Verify full build**

Run: `npx nx build cli`
Expected: `dist/cli/` contains JS/ESM/DTS files + `dist/cli/wasm/qodalis_cli_wasm_bg.wasm`

---

## Task 7: Write tests

**Files:**
- Create: `packages/cli/src/tests/wasm-accelerator.spec.ts`

**Step 1: Write tests for the accelerator**

```typescript
import { JsFallbackAccelerator, ICliWasmAccelerator } from '../lib/wasm';

describe('ICliWasmAccelerator (JsFallback)', () => {
    let accel: ICliWasmAccelerator;

    beforeEach(() => {
        accel = new JsFallbackAccelerator();
    });

    describe('textSearch', () => {
        const text = 'hello world\nfoo bar baz\nHello Again';

        it('should find needle in first line', () => {
            expect(accel.textSearch(text, 'world', 0, -1, true, false))
                .toEqual([0, 6]);
        });

        it('should find case-insensitively', () => {
            expect(accel.textSearch(text, 'hello', 0, 0, false, false))
                .toEqual([2, 0]);
        });

        it('should wrap around', () => {
            expect(accel.textSearch(text, 'hello', 1, 0, false, true))
                .toEqual([0, 0]);
        });

        it('should return [-1,-1] when not found', () => {
            expect(accel.textSearch(text, 'xyz', 0, -1, true, true))
                .toEqual([-1, -1]);
        });

        it('should return [-1,-1] for empty needle', () => {
            expect(accel.textSearch(text, '', 0, 0, true, true))
                .toEqual([-1, -1]);
        });
    });

    describe('textReplaceAll', () => {
        it('should replace all occurrences', () => {
            const result = accel.textReplaceAll('foo bar foo\nbaz foo', 'foo', 'X', true);
            expect(result.count).toBe(3);
            expect(result.text).toBe('X bar X\nbaz X');
        });

        it('should handle case-insensitive replace', () => {
            const result = accel.textReplaceAll('Foo foo FOO', 'foo', 'X', false);
            expect(result.count).toBe(3);
            expect(result.text).toBe('X X X');
        });

        it('should return 0 for empty needle', () => {
            const result = accel.textReplaceAll('hello', '', 'X', true);
            expect(result.count).toBe(0);
            expect(result.text).toBe('hello');
        });
    });

    describe('prefixMatch', () => {
        const candidates = ['help', 'hello', 'history', 'hash', 'hex'];

        it('should match prefix case-insensitively', () => {
            expect(accel.prefixMatch(candidates, 'he'))
                .toEqual(['hello', 'help', 'hex']);
        });

        it('should return all sorted when prefix is empty', () => {
            expect(accel.prefixMatch(candidates, ''))
                .toEqual(['hash', 'hello', 'help', 'hex', 'history']);
        });

        it('should return empty for no matches', () => {
            expect(accel.prefixMatch(candidates, 'z')).toEqual([]);
        });
    });

    describe('commonPrefix', () => {
        it('should find common prefix', () => {
            expect(accel.commonPrefix(['hello', 'help', 'hex'])).toBe('he');
        });

        it('should return full string for single item', () => {
            expect(accel.commonPrefix(['hello'])).toBe('hello');
        });

        it('should return empty for no common prefix', () => {
            expect(accel.commonPrefix(['abc', 'xyz'])).toBe('');
        });

        it('should return empty for empty array', () => {
            expect(accel.commonPrefix([])).toBe('');
        });
    });
});
```

**Step 2: Run tests**

Run: `npx nx test cli`
Expected: All tests pass

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | Rust WASM crate (Boyer-Moore search + prefix match) | `packages/cli/wasm/` (new) |
| 2 | TypeScript wrapper + JS fallback | `packages/cli/src/lib/wasm/` (new) |
| 3 | Wire into NanoEditorBuffer | `packages/cli/src/lib/editor/nano-editor-buffer.ts` |
| 4 | Wire into tab completion | `packages/cli/src/lib/completion/*.ts` |
| 5 | Eager WASM init at startup | CLI engine init |
| 6 | Build infra (wasm-pack + copy .wasm) | `packages/cli/project.json` |
| 7 | Tests | `packages/cli/src/tests/wasm-accelerator.spec.ts` |

**Dependencies:** Task 1 → Task 2 → Tasks 3, 4, 5 (parallel) → Task 6 → Task 7
