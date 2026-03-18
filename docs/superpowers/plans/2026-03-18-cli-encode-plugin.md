# @qodalis/cli-encode Plugin Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract encoding-related command processors from the built-in CLI into a new `@qodalis/cli-encode` plugin, and add three new encoding commands (binary, rot, morse).

**Architecture:** Create a standard plugin under `packages/plugins/encode/` following the existing plugin pattern (guid, string, etc.). Move 5 existing processors (base64, hex, url, hash, jwt) from `packages/cli/src/lib/processors/` into the plugin, add 3 new processors (binary, rot, morse), register all 8 in an `encodeModule`, remove them from the built-in `miscProcessors` array, and wire the new plugin into all demo apps.

**Tech Stack:** TypeScript, tsup, Karma/Jasmine for tests, Angular DI for demo-angular

---

## Chunk 1: Scaffold plugin and move existing processors

### Task 1: Scaffold the plugin with create-cli-plugin

**Files:**
- Create: `packages/plugins/encode/` (entire directory via scaffolding tool)

- [ ] **Step 1: Run the plugin scaffolding tool**

```bash
cd /home/nicolae/work/cli-workspace/web-cli
pnpm run create-plugin -- --name encode --description "Encoding, decoding, and hashing utilities (base64, hex, url, hash, jwt, binary, rot, morse)" --processor-name CliEncode
```

This auto-creates the plugin directory, `project.json`, `tsup.config.ts`, `tsconfig.spec.json`, `package.json`, boilerplate processor, module, public-api, cli-entrypoint, and updates `tsconfig.base.json` with path alias.

- [ ] **Step 2: Verify scaffolding succeeded**

```bash
ls packages/plugins/encode/src/
# Expected: cli-entrypoint.ts  lib/  public-api.ts  tests/
```

- [ ] **Step 3: Commit scaffold**

```bash
git add packages/plugins/encode/ tsconfig.base.json
git commit -m "chore: scaffold @qodalis/cli-encode plugin"
```

### Task 2: Move base64 processor into the plugin

**Files:**
- Move: `packages/cli/src/lib/processors/cli-base64-command-processor.ts` → `packages/plugins/encode/src/lib/processors/cli-base64-command-processor.ts`
- Modify: `packages/plugins/encode/src/lib/processors/cli-base64-command-processor.ts` (no changes needed, imports already use `@qodalis/cli-core`)

- [ ] **Step 1: Copy the file**

```bash
cp packages/cli/src/lib/processors/cli-base64-command-processor.ts packages/plugins/encode/src/lib/processors/
```

- [ ] **Step 2: Verify imports compile** — The file already imports from `@qodalis/cli-core`, so no import changes needed.

### Task 3: Move hex processor into the plugin

**Files:**
- Move: `packages/cli/src/lib/processors/cli-hex-command-processor.ts` → `packages/plugins/encode/src/lib/processors/cli-hex-command-processor.ts`

- [ ] **Step 1: Copy the file**

```bash
cp packages/cli/src/lib/processors/cli-hex-command-processor.ts packages/plugins/encode/src/lib/processors/
```

### Task 4: Move url processor into the plugin

**Files:**
- Move: `packages/cli/src/lib/processors/cli-url-command-processor.ts` → `packages/plugins/encode/src/lib/processors/cli-url-command-processor.ts`

- [ ] **Step 1: Copy the file**

```bash
cp packages/cli/src/lib/processors/cli-url-command-processor.ts packages/plugins/encode/src/lib/processors/
```

### Task 5: Move hash processor into the plugin

**Files:**
- Move: `packages/cli/src/lib/processors/cli-hash-command-processor.ts` → `packages/plugins/encode/src/lib/processors/cli-hash-command-processor.ts`

- [ ] **Step 1: Copy the file**

```bash
cp packages/cli/src/lib/processors/cli-hash-command-processor.ts packages/plugins/encode/src/lib/processors/
```

### Task 6: Move jwt processor into the plugin

**Files:**
- Move: `packages/cli/src/lib/processors/cli-jwt-command-processor.ts` → `packages/plugins/encode/src/lib/processors/cli-jwt-command-processor.ts`

- [ ] **Step 1: Copy the file**

```bash
cp packages/cli/src/lib/processors/cli-jwt-command-processor.ts packages/plugins/encode/src/lib/processors/
```

### Task 7: Remove moved processors from packages/cli

**Files:**
- Delete: `packages/cli/src/lib/processors/cli-base64-command-processor.ts`
- Delete: `packages/cli/src/lib/processors/cli-hex-command-processor.ts`
- Delete: `packages/cli/src/lib/processors/cli-url-command-processor.ts`
- Delete: `packages/cli/src/lib/processors/cli-hash-command-processor.ts`
- Delete: `packages/cli/src/lib/processors/cli-jwt-command-processor.ts`
- Modify: `packages/cli/src/lib/processors/index.ts` — remove imports, exports, and array entries for all 5 processors

- [ ] **Step 1: Delete the source files**

```bash
rm packages/cli/src/lib/processors/cli-base64-command-processor.ts
rm packages/cli/src/lib/processors/cli-hex-command-processor.ts
rm packages/cli/src/lib/processors/cli-url-command-processor.ts
rm packages/cli/src/lib/processors/cli-hash-command-processor.ts
rm packages/cli/src/lib/processors/cli-jwt-command-processor.ts
```

- [ ] **Step 2: Update index.ts** — Remove these lines from `packages/cli/src/lib/processors/index.ts`:

Remove imports:
```typescript
// DELETE these imports
import { CliBase64CommandProcessor } from './cli-base64-command-processor';
import { CliHashCommandProcessor } from './cli-hash-command-processor';
import { CliHexCommandProcessor } from './cli-hex-command-processor';
import { CliJsonCommandProcessor } from './cli-json-command-processor'; // KEEP - json stays
import { CliJwtCommandProcessor } from './cli-jwt-command-processor';
import { CliUrlCommandProcessor } from './cli-url-command-processor';
```

Remove re-exports:
```typescript
// DELETE these export lines
export * from './cli-base64-command-processor';
export * from './cli-url-command-processor';
export * from './cli-hash-command-processor';
export * from './cli-hex-command-processor';
export * from './cli-jwt-command-processor';
```

Remove from `miscProcessors` array:
```typescript
// DELETE these entries
new CliBase64CommandProcessor(),
new CliUrlCommandProcessor(),
new CliHashCommandProcessor(),
new CliJwtCommandProcessor(),
new CliHexCommandProcessor(),
```

- [ ] **Step 3: Commit moved processors**

```bash
git add -A
git commit -m "refactor: move base64, hex, url, hash, jwt processors to @qodalis/cli-encode plugin"
```

## Chunk 2: Add new processors (binary, rot, morse)

### Task 8: Create binary command processor

**Files:**
- Create: `packages/plugins/encode/src/lib/processors/cli-binary-command-processor.ts`

- [ ] **Step 1: Write the processor**

```typescript
import {
    CliForegroundColor,
    CliProcessCommand,
    CliProcessorMetadata,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';

export class CliBinaryCommandProcessor implements ICliCommandProcessor {
    command = 'binary';

    aliases = ['bin'];

    description = 'Encode or decode binary strings';

    author = DefaultLibraryAuthor;

    processors?: ICliCommandProcessor[] = [];

    metadata?: CliProcessorMetadata = {
        icon: '💻',
        module: '@qodalis/cli-encode',
    };

    constructor() {
        this.processors = [
            {
                command: 'encode',
                aliases: ['enc', 'e'],
                description: 'Encode text to binary',
                acceptsRawInput: true,
                valueRequired: true,
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const text = (command.value || command.data || '') as string;
                    const binary = Array.from(new TextEncoder().encode(text))
                        .map((b) => b.toString(2).padStart(8, '0'))
                        .join(' ');
                    context.writer.writeln(binary);
                    context.process.output(binary);
                },
                writeDescription: (context: ICliExecutionContext) => {
                    const { writer } = context;
                    writer.writeln('Encode text to binary representation');
                    writer.writeln();
                    writer.writeln(`📋 ${context.translator.t('cli.common.usage', 'Usage:')}`);
                    writer.writeln(
                        `  ${writer.wrapInColor('binary encode <text>', CliForegroundColor.Cyan)}`,
                    );
                    writer.writeln();
                    writer.writeln(`📝 ${context.translator.t('cli.common.examples', 'Examples:')}`);
                    writer.writeln(
                        `  binary encode Hi   ${writer.wrapInColor('# → 01001000 01101001', CliForegroundColor.Green)}`,
                    );
                },
            },
            {
                command: 'decode',
                aliases: ['dec', 'd'],
                description: 'Decode binary to text',
                acceptsRawInput: true,
                valueRequired: true,
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const input = (command.value || command.data || '') as string;
                    try {
                        const cleaned = input.replace(/[^01]/g, '');
                        if (cleaned.length === 0 || cleaned.length % 8 !== 0) {
                            throw new Error('Invalid binary');
                        }
                        const bytes = new Uint8Array(
                            (cleaned.match(/.{8}/g) || []).map((b) =>
                                parseInt(b, 2),
                            ),
                        );
                        const text = new TextDecoder().decode(bytes);
                        context.writer.writeln(text);
                        context.process.output(text);
                    } catch {
                        context.writer.writeError(
                            'Invalid binary string (expected groups of 8 bits)',
                        );
                        context.process.exit(-1);
                    }
                },
                writeDescription: (context: ICliExecutionContext) => {
                    const { writer } = context;
                    writer.writeln('Decode binary string back to text');
                    writer.writeln();
                    writer.writeln(`📋 ${context.translator.t('cli.common.usage', 'Usage:')}`);
                    writer.writeln(
                        `  ${writer.wrapInColor('binary decode <binary>', CliForegroundColor.Cyan)}`,
                    );
                    writer.writeln();
                    writer.writeln(`📝 ${context.translator.t('cli.common.examples', 'Examples:')}`);
                    writer.writeln(
                        `  binary decode 01001000 01101001   ${writer.wrapInColor('# → Hi', CliForegroundColor.Green)}`,
                    );
                },
            },
        ];
    }

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        context.executor.showHelp(command, context);
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer, translator: t } = context;
        writer.writeln(t.t('cli.binary.long_description', 'Encode and decode binary strings'));
        writer.writeln(t.t('cli.binary.utf8_note', 'Supports UTF-8 text encoding'));
        writer.writeln();
        writer.writeln(`📋 ${t.t('cli.common.usage', 'Usage:')}`);
        writer.writeln(
            `  ${writer.wrapInColor('binary encode <text>', CliForegroundColor.Cyan)}       ${t.t('cli.binary.encode_desc', 'Text to binary')}`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('binary decode <binary>', CliForegroundColor.Cyan)}     ${t.t('cli.binary.decode_desc', 'Binary to text')}`,
        );
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/plugins/encode/src/lib/processors/cli-binary-command-processor.ts
git commit -m "feat(encode): add binary encode/decode command"
```

### Task 9: Create rot command processor

**Files:**
- Create: `packages/plugins/encode/src/lib/processors/cli-rot-command-processor.ts`

- [ ] **Step 1: Write the processor**

```typescript
import {
    CliForegroundColor,
    CliProcessCommand,
    CliProcessorMetadata,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';

export class CliRotCommandProcessor implements ICliCommandProcessor {
    command = 'rot';

    description = 'Apply ROT cipher (letter rotation)';

    author = DefaultLibraryAuthor;

    metadata?: CliProcessorMetadata = {
        icon: '🔄',
        module: '@qodalis/cli-encode',
    };

    parameters = [
        {
            name: 'shift',
            description: 'Rotation amount (default: 13)',
            type: 'number' as const,
            required: false,
        },
    ];

    acceptsRawInput = true;
    valueRequired = true;

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const text = (command.value || command.data || '') as string;
        const shift = parseInt(command.args['shift']) || 13;
        const normalizedShift = ((shift % 26) + 26) % 26;

        const result = text.replace(/[a-zA-Z]/g, (char) => {
            const base = char >= 'a' ? 97 : 65;
            return String.fromCharCode(
                ((char.charCodeAt(0) - base + normalizedShift) % 26) + base,
            );
        });

        context.writer.writeln(result);
        context.process.output(result);
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer, translator: t } = context;
        writer.writeln(
            t.t('cli.rot.long_description', 'Apply ROT (rotation) cipher to text'),
        );
        writer.writeln(
            t.t('cli.rot.note', 'Default is ROT13 (self-inverse: applying twice returns original)'),
        );
        writer.writeln();
        writer.writeln(`📋 ${t.t('cli.common.usage', 'Usage:')}`);
        writer.writeln(
            `  ${writer.wrapInColor('rot <text>', CliForegroundColor.Cyan)}                 ${t.t('cli.rot.default_desc', 'Apply ROT13')}`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('rot <text> --shift=N', CliForegroundColor.Cyan)}       ${t.t('cli.rot.shift_desc', 'Apply ROT-N')}`,
        );
        writer.writeln();
        writer.writeln(`📝 ${t.t('cli.common.examples', 'Examples:')}`);
        writer.writeln(
            `  rot Hello World              ${writer.wrapInColor('# → Uryyb Jbeyq', CliForegroundColor.Green)}`,
        );
        writer.writeln(
            `  rot Uryyb Jbeyq              ${writer.wrapInColor('# → Hello World (ROT13 is self-inverse)', CliForegroundColor.Green)}`,
        );
        writer.writeln(
            `  rot abc --shift=1            ${writer.wrapInColor('# → bcd', CliForegroundColor.Green)}`,
        );
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/plugins/encode/src/lib/processors/cli-rot-command-processor.ts
git commit -m "feat(encode): add rot cipher command with configurable shift"
```

### Task 10: Create morse command processor

**Files:**
- Create: `packages/plugins/encode/src/lib/processors/cli-morse-command-processor.ts`

- [ ] **Step 1: Write the processor**

```typescript
import {
    CliForegroundColor,
    CliProcessCommand,
    CliProcessorMetadata,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';

const CHAR_TO_MORSE: Record<string, string> = {
    A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.',
    G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..',
    M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.',
    S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-',
    Y: '-.--', Z: '--..',
    '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-',
    '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.',
    '.': '.-.-.-', ',': '--..--', '?': '..--..', "'": '.----.',
    '!': '-.-.--', '/': '-..-.', '(': '-.--.', ')': '-.--.-',
    '&': '.-...', ':': '---...', ';': '-.-.-.', '=': '-...-',
    '+': '.-.-.', '-': '-....-', '_': '..--.-', '"': '.-..-.',
    '$': '...-..-', '@': '.--.-.', ' ': '/',
};

const MORSE_TO_CHAR: Record<string, string> = {};
for (const [char, morse] of Object.entries(CHAR_TO_MORSE)) {
    if (char !== ' ') {
        MORSE_TO_CHAR[morse] = char;
    }
}

export class CliMorseCommandProcessor implements ICliCommandProcessor {
    command = 'morse';

    description = 'Encode or decode Morse code';

    author = DefaultLibraryAuthor;

    processors?: ICliCommandProcessor[] = [];

    metadata?: CliProcessorMetadata = {
        icon: '📡',
        module: '@qodalis/cli-encode',
    };

    constructor() {
        this.processors = [
            {
                command: 'encode',
                aliases: ['enc', 'e'],
                description: 'Encode text to Morse code',
                acceptsRawInput: true,
                valueRequired: true,
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const text = (command.value || command.data || '') as string;
                    const morse = text
                        .toUpperCase()
                        .split('')
                        .map((c) => CHAR_TO_MORSE[c] ?? c)
                        .join(' ');
                    context.writer.writeln(morse);
                    context.process.output(morse);
                },
                writeDescription: (context: ICliExecutionContext) => {
                    const { writer } = context;
                    writer.writeln('Encode text to Morse code');
                    writer.writeln();
                    writer.writeln(`📋 ${context.translator.t('cli.common.usage', 'Usage:')}`);
                    writer.writeln(
                        `  ${writer.wrapInColor('morse encode <text>', CliForegroundColor.Cyan)}`,
                    );
                    writer.writeln();
                    writer.writeln(`📝 ${context.translator.t('cli.common.examples', 'Examples:')}`);
                    writer.writeln(
                        `  morse encode SOS             ${writer.wrapInColor('# → ... --- ...', CliForegroundColor.Green)}`,
                    );
                    writer.writeln(
                        `  morse encode Hello World     ${writer.wrapInColor('# → .... . .-.. .-.. --- / .-- --- .-. .-.. -..', CliForegroundColor.Green)}`,
                    );
                },
            },
            {
                command: 'decode',
                aliases: ['dec', 'd'],
                description: 'Decode Morse code to text',
                acceptsRawInput: true,
                valueRequired: true,
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const input = (command.value || command.data || '') as string;
                    try {
                        const text = input
                            .split(' ')
                            .map((code) => {
                                if (code === '/') return ' ';
                                const char = MORSE_TO_CHAR[code];
                                if (!char) throw new Error(`Unknown morse: ${code}`);
                                return char;
                            })
                            .join('');
                        context.writer.writeln(text);
                        context.process.output(text);
                    } catch {
                        context.writer.writeError(
                            'Invalid Morse code (use spaces between letters, / between words)',
                        );
                        context.process.exit(-1);
                    }
                },
                writeDescription: (context: ICliExecutionContext) => {
                    const { writer } = context;
                    writer.writeln('Decode Morse code back to text');
                    writer.writeln();
                    writer.writeln(`📋 ${context.translator.t('cli.common.usage', 'Usage:')}`);
                    writer.writeln(
                        `  ${writer.wrapInColor('morse decode <morse>', CliForegroundColor.Cyan)}`,
                    );
                    writer.writeln();
                    writer.writeln(`📝 ${context.translator.t('cli.common.examples', 'Examples:')}`);
                    writer.writeln(
                        `  morse decode ... --- ...     ${writer.wrapInColor('# → SOS', CliForegroundColor.Green)}`,
                    );
                },
            },
        ];
    }

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        context.executor.showHelp(command, context);
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer, translator: t } = context;
        writer.writeln(t.t('cli.morse.long_description', 'Encode and decode Morse code'));
        writer.writeln(
            t.t('cli.morse.note', 'Supports letters, numbers, and common punctuation'),
        );
        writer.writeln();
        writer.writeln(`📋 ${t.t('cli.common.usage', 'Usage:')}`);
        writer.writeln(
            `  ${writer.wrapInColor('morse encode <text>', CliForegroundColor.Cyan)}        ${t.t('cli.morse.encode_desc', 'Text to Morse')}`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('morse decode <morse>', CliForegroundColor.Cyan)}       ${t.t('cli.morse.decode_desc', 'Morse to text')}`,
        );
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/plugins/encode/src/lib/processors/cli-morse-command-processor.ts
git commit -m "feat(encode): add morse code encode/decode command"
```

## Chunk 3: Wire up module, update demos, and update docs

### Task 11: Wire up the encode module

**Files:**
- Modify: `packages/plugins/encode/src/lib/processors/` — delete scaffolded boilerplate processor
- Create/Modify: `packages/plugins/encode/src/lib/index.ts` — re-export all processors
- Modify: `packages/plugins/encode/src/public-api.ts` — define `encodeModule` with all 8 processors
- Modify: `packages/plugins/encode/src/cli-entrypoint.ts` — boot the module

- [ ] **Step 1: Delete the scaffolded boilerplate processor** (the one generated by create-cli-plugin)

- [ ] **Step 2: Update `packages/plugins/encode/src/lib/index.ts`**

```typescript
export * from './processors/cli-base64-command-processor';
export * from './processors/cli-hex-command-processor';
export * from './processors/cli-url-command-processor';
export * from './processors/cli-hash-command-processor';
export * from './processors/cli-jwt-command-processor';
export * from './processors/cli-binary-command-processor';
export * from './processors/cli-rot-command-processor';
export * from './processors/cli-morse-command-processor';
```

- [ ] **Step 3: Update `packages/plugins/encode/src/public-api.ts`**

```typescript
export * from './lib';

import { ICliModule } from '@qodalis/cli-core';
import { CliBase64CommandProcessor } from './lib/processors/cli-base64-command-processor';
import { CliHexCommandProcessor } from './lib/processors/cli-hex-command-processor';
import { CliUrlCommandProcessor } from './lib/processors/cli-url-command-processor';
import { CliHashCommandProcessor } from './lib/processors/cli-hash-command-processor';
import { CliJwtCommandProcessor } from './lib/processors/cli-jwt-command-processor';
import { CliBinaryCommandProcessor } from './lib/processors/cli-binary-command-processor';
import { CliRotCommandProcessor } from './lib/processors/cli-rot-command-processor';
import { CliMorseCommandProcessor } from './lib/processors/cli-morse-command-processor';
import { API_VERSION } from './lib/version';

export const encodeModule: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-encode',
    processors: [
        new CliBase64CommandProcessor(),
        new CliHexCommandProcessor(),
        new CliUrlCommandProcessor(),
        new CliHashCommandProcessor(),
        new CliJwtCommandProcessor(),
        new CliBinaryCommandProcessor(),
        new CliRotCommandProcessor(),
        new CliMorseCommandProcessor(),
    ],
};
```

- [ ] **Step 4: Update `packages/plugins/encode/src/cli-entrypoint.ts`**

```typescript
import { bootCliModule, ICliModule } from '@qodalis/cli-core';
import {
    CliBase64CommandProcessor,
    CliHexCommandProcessor,
    CliUrlCommandProcessor,
    CliHashCommandProcessor,
    CliJwtCommandProcessor,
    CliBinaryCommandProcessor,
    CliRotCommandProcessor,
    CliMorseCommandProcessor,
} from './lib';
import { API_VERSION } from './lib/version';

const module: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-encode',
    processors: [
        new CliBase64CommandProcessor(),
        new CliHexCommandProcessor(),
        new CliUrlCommandProcessor(),
        new CliHashCommandProcessor(),
        new CliJwtCommandProcessor(),
        new CliBinaryCommandProcessor(),
        new CliRotCommandProcessor(),
        new CliMorseCommandProcessor(),
    ],
};

bootCliModule(module);
```

- [ ] **Step 5: Commit**

```bash
git add packages/plugins/encode/
git commit -m "feat(encode): wire up encodeModule with all 8 processors"
```

### Task 12: Update demo apps to import encodeModule

**Files:**
- Modify: `apps/demo-angular/src/app/app.module.ts` — add `encodeModule` import and provider
- Modify: `apps/demo-react/src/App.tsx` — add `encodeModule` to modules array
- Modify: `apps/demo-vue/src/App.vue` — add `encodeModule` to modules array

- [ ] **Step 1: Update demo-angular** — Add import and provider:

```typescript
import { encodeModule } from '@qodalis/cli-encode';
// ... in providers array:
resolveCliModuleProvider(encodeModule),
```

- [ ] **Step 2: Update demo-react** — Add import and include in modules:

```typescript
import { encodeModule } from '@qodalis/cli-encode';
// ... add to modules array passed to QodalisCli component
```

- [ ] **Step 3: Update demo-vue** — Add import and include in modules:

```typescript
import { encodeModule } from '@qodalis/cli-encode';
// ... add to modules array passed to QodalisCli component
```

- [ ] **Step 4: Commit**

```bash
git add apps/
git commit -m "feat: register @qodalis/cli-encode in all demo apps"
```

### Task 13: Update docs command groups

**Files:**
- Modify: `apps/docs/src/app/data/commands.ts` — move base64, hash, hex, jwt, url from "Dev Tools" built-in group; add encode plugin group

- [ ] **Step 1: Remove encoding commands from BUILT_IN_GROUPS Dev Tools**

Remove `'base64'`, `'hash'`, `'hex'`, `'jwt'`, `'url'` from the Dev Tools commands array.

- [ ] **Step 2: Add encode plugin group** (check how other plugins are listed in commands.ts and follow that pattern)

- [ ] **Step 3: Commit**

```bash
git add apps/docs/
git commit -m "docs: update command groups for @qodalis/cli-encode plugin"
```

### Task 14: Build and verify

- [ ] **Step 1: Build the entire workspace**

```bash
pnpm run build
```

Expected: all 31+ projects build successfully including the new `encode` plugin.

- [ ] **Step 2: Run encode plugin tests**

```bash
npx nx test encode
```

- [ ] **Step 3: Verify the CLI build still works**

```bash
npx nx test cli
```

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: resolve build issues for @qodalis/cli-encode plugin"
```
