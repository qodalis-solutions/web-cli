# Files Plugin Search Commands Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `grep`, `find`, `head`, `tail`, and `wc` commands to the `@qodalis/cli-files` plugin.

**Architecture:** Each command is a standalone `ICliCommandProcessor` class in its own file under `packages/plugins/files/src/lib/processors/`. They use the existing `IFileSystemService` via `context.services.get()` — no schema or interface changes needed. Registration is in `public-api.ts`. Integration tests use Jasmine via Karma.

**Tech Stack:** TypeScript, Jasmine, Karma, `@qodalis/cli-core` interfaces

**Design doc:** `docs/plans/2026-03-01-files-search-commands-design.md`

---

## Conventions Reference

All processors follow this pattern (see `cli-rm-command-processor.ts` for canonical example):

```typescript
import {
    CliProcessCommand,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { IFileSystemService, IFileSystemService_TOKEN } from '../interfaces';
import { LIBRARY_VERSION } from '../version';

export class CliXxxCommandProcessor implements ICliCommandProcessor {
    command = 'xxx';
    description = '...';
    author = DefaultLibraryAuthor;
    version = LIBRARY_VERSION;
    acceptsRawInput = true;
    // valueRequired = true;  // if the command requires a value argument
    metadata = { icon: '...', module: 'file management' };
    parameters = [ /* flag definitions */ ];

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const fs = context.services.get<IFileSystemService>(IFileSystemService_TOKEN);
        // implementation
    }
}
```

Flag access: `command.args['flagName'] || command.args['alias']`
Raw input: `command.value` (first non-flag argument) and `command.rawCommand` (full text after command name)
Output: `context.writer.writeln()`, `context.writer.writeError()`
Color: `context.writer.wrapInColor(text, CliForegroundColor.Red)`
Filesystem: `fs.readFile(path)`, `fs.getNode(path)`, `fs.listDirectory(path)`, `fs.exists(path)`, `fs.isDirectory(path)`, `fs.resolvePath(path)`

---

## Task 1: `head` command

**Files:**
- Create: `packages/plugins/files/src/lib/processors/cli-head-command-processor.ts`

**Step 1: Create the head processor**

```typescript
import {
    CliProcessCommand,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { IFileSystemService, IFileSystemService_TOKEN } from '../interfaces';
import { LIBRARY_VERSION } from '../version';

export class CliHeadCommandProcessor implements ICliCommandProcessor {
    command = 'head';
    description = 'Display the first lines of a file';
    author = DefaultLibraryAuthor;
    version = LIBRARY_VERSION;
    acceptsRawInput = true;
    valueRequired = true;
    metadata = { icon: '⬆️', module: 'file management' };

    parameters = [
        {
            name: 'lines',
            aliases: ['n'],
            description: 'Number of lines to display (default: 10)',
            required: false,
            type: 'number' as const,
        },
    ];

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const fs = context.services.get<IFileSystemService>(
            IFileSystemService_TOKEN,
        );
        const count = parseInt(
            command.args['lines'] || command.args['n'] || '10',
            10,
        );
        const paths = this.parsePaths(command);

        if (paths.length === 0) {
            context.writer.writeError('head: missing file operand');
            return;
        }

        for (let i = 0; i < paths.length; i++) {
            const path = paths[i];
            try {
                if (fs.isDirectory(path)) {
                    context.writer.writeError(`head: ${path}: Is a directory`);
                    continue;
                }
                const content = fs.readFile(path);
                if (content === null) continue;

                if (paths.length > 1) {
                    if (i > 0) context.writer.writeln();
                    context.writer.writeln(`==> ${path} <==`);
                }

                const lines = content.split('\n');
                const selected = lines.slice(0, count);
                context.writer.writeln(selected.join('\n'));
            } catch (e: any) {
                context.writer.writeError(`head: ${e.message}`);
            }
        }
    }

    private parsePaths(command: CliProcessCommand): string[] {
        const raw = command.rawCommand || '';
        const tokens = raw.split(/\s+/).filter(Boolean);
        const paths: string[] = [];
        let i = 0;
        while (i < tokens.length) {
            const t = tokens[i];
            if (t === '-n' || t === '--lines') {
                i += 2; // skip flag and its value
            } else if (t.startsWith('-')) {
                i++;
            } else {
                paths.push(t);
                i++;
            }
        }
        return paths;
    }
}
```

**Step 2: Commit**

```bash
git add packages/plugins/files/src/lib/processors/cli-head-command-processor.ts
git commit -m "feat(files): add head command processor"
```

---

## Task 2: `tail` command

**Files:**
- Create: `packages/plugins/files/src/lib/processors/cli-tail-command-processor.ts`

**Step 1: Create the tail processor**

```typescript
import {
    CliProcessCommand,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { IFileSystemService, IFileSystemService_TOKEN } from '../interfaces';
import { LIBRARY_VERSION } from '../version';

export class CliTailCommandProcessor implements ICliCommandProcessor {
    command = 'tail';
    description = 'Display the last lines of a file';
    author = DefaultLibraryAuthor;
    version = LIBRARY_VERSION;
    acceptsRawInput = true;
    valueRequired = true;
    metadata = { icon: '⬇️', module: 'file management' };

    parameters = [
        {
            name: 'lines',
            aliases: ['n'],
            description: 'Number of lines to display (default: 10)',
            required: false,
            type: 'number' as const,
        },
    ];

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const fs = context.services.get<IFileSystemService>(
            IFileSystemService_TOKEN,
        );
        const count = parseInt(
            command.args['lines'] || command.args['n'] || '10',
            10,
        );
        const paths = this.parsePaths(command);

        if (paths.length === 0) {
            context.writer.writeError('tail: missing file operand');
            return;
        }

        for (let i = 0; i < paths.length; i++) {
            const path = paths[i];
            try {
                if (fs.isDirectory(path)) {
                    context.writer.writeError(`tail: ${path}: Is a directory`);
                    continue;
                }
                const content = fs.readFile(path);
                if (content === null) continue;

                if (paths.length > 1) {
                    if (i > 0) context.writer.writeln();
                    context.writer.writeln(`==> ${path} <==`);
                }

                const lines = content.split('\n');
                const selected = lines.slice(-count);
                context.writer.writeln(selected.join('\n'));
            } catch (e: any) {
                context.writer.writeError(`tail: ${e.message}`);
            }
        }
    }

    private parsePaths(command: CliProcessCommand): string[] {
        const raw = command.rawCommand || '';
        const tokens = raw.split(/\s+/).filter(Boolean);
        const paths: string[] = [];
        let i = 0;
        while (i < tokens.length) {
            const t = tokens[i];
            if (t === '-n' || t === '--lines') {
                i += 2;
            } else if (t.startsWith('-')) {
                i++;
            } else {
                paths.push(t);
                i++;
            }
        }
        return paths;
    }
}
```

**Step 2: Commit**

```bash
git add packages/plugins/files/src/lib/processors/cli-tail-command-processor.ts
git commit -m "feat(files): add tail command processor"
```

---

## Task 3: `wc` command

**Files:**
- Create: `packages/plugins/files/src/lib/processors/cli-wc-command-processor.ts`

**Step 1: Create the wc processor**

```typescript
import {
    CliProcessCommand,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { IFileSystemService, IFileSystemService_TOKEN } from '../interfaces';
import { LIBRARY_VERSION } from '../version';

export class CliWcCommandProcessor implements ICliCommandProcessor {
    command = 'wc';
    description = 'Print line, word, and character counts';
    author = DefaultLibraryAuthor;
    version = LIBRARY_VERSION;
    acceptsRawInput = true;
    valueRequired = true;
    metadata = { icon: '#️⃣', module: 'file management' };

    parameters = [
        {
            name: 'lines',
            aliases: ['l'],
            description: 'Print only the line count',
            required: false,
            type: 'boolean' as const,
        },
        {
            name: 'words',
            aliases: ['w'],
            description: 'Print only the word count',
            required: false,
            type: 'boolean' as const,
        },
        {
            name: 'chars',
            aliases: ['c'],
            description: 'Print only the character count',
            required: false,
            type: 'boolean' as const,
        },
    ];

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const fs = context.services.get<IFileSystemService>(
            IFileSystemService_TOKEN,
        );
        const showLines =
            command.args['lines'] || command.args['l'] || false;
        const showWords =
            command.args['words'] || command.args['w'] || false;
        const showChars =
            command.args['chars'] || command.args['c'] || false;
        const showAll = !showLines && !showWords && !showChars;

        const paths = this.parsePaths(command);
        if (paths.length === 0) {
            context.writer.writeError('wc: missing file operand');
            return;
        }

        let totalLines = 0;
        let totalWords = 0;
        let totalChars = 0;

        for (const path of paths) {
            try {
                if (fs.isDirectory(path)) {
                    context.writer.writeError(`wc: ${path}: Is a directory`);
                    continue;
                }
                const content = fs.readFile(path) ?? '';
                const lineCount = content === '' ? 0 : content.split('\n').length;
                const wordCount =
                    content.trim() === ''
                        ? 0
                        : content.trim().split(/\s+/).length;
                const charCount = content.length;

                totalLines += lineCount;
                totalWords += wordCount;
                totalChars += charCount;

                const parts: string[] = [];
                if (showAll || showLines) parts.push(String(lineCount).padStart(8));
                if (showAll || showWords) parts.push(String(wordCount).padStart(8));
                if (showAll || showChars) parts.push(String(charCount).padStart(8));
                parts.push(` ${path}`);

                context.writer.writeln(parts.join(''));
            } catch (e: any) {
                context.writer.writeError(`wc: ${e.message}`);
            }
        }

        if (paths.length > 1) {
            const parts: string[] = [];
            if (showAll || showLines) parts.push(String(totalLines).padStart(8));
            if (showAll || showWords) parts.push(String(totalWords).padStart(8));
            if (showAll || showChars) parts.push(String(totalChars).padStart(8));
            parts.push(' total');
            context.writer.writeln(parts.join(''));
        }
    }

    private parsePaths(command: CliProcessCommand): string[] {
        const raw = command.rawCommand || '';
        return raw
            .split(/\s+/)
            .filter((t) => t && !t.startsWith('-'));
    }
}
```

**Step 2: Commit**

```bash
git add packages/plugins/files/src/lib/processors/cli-wc-command-processor.ts
git commit -m "feat(files): add wc command processor"
```

---

## Task 4: `find` command

**Files:**
- Create: `packages/plugins/files/src/lib/processors/cli-find-command-processor.ts`

**Step 1: Create the find processor**

```typescript
import {
    CliProcessCommand,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import {
    IFileSystemService,
    IFileSystemService_TOKEN,
    IFileNode,
} from '../interfaces';
import { LIBRARY_VERSION } from '../version';

export class CliFindCommandProcessor implements ICliCommandProcessor {
    command = 'find';
    description = 'Search for files and directories by name or type';
    author = DefaultLibraryAuthor;
    version = LIBRARY_VERSION;
    acceptsRawInput = true;
    metadata = { icon: '🔍', module: 'file management' };

    parameters = [
        {
            name: 'name',
            description: 'Match filename pattern (glob: * and ? supported)',
            required: false,
            type: 'string' as const,
        },
        {
            name: 'type',
            description: 'Filter by type: f (file) or d (directory)',
            required: false,
            type: 'string' as const,
        },
        {
            name: 'maxdepth',
            description: 'Maximum directory depth to search',
            required: false,
            type: 'number' as const,
        },
    ];

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const fs = context.services.get<IFileSystemService>(
            IFileSystemService_TOKEN,
        );

        const searchPath = this.parseSearchPath(command) || fs.getCurrentDirectory();
        const namePattern = command.args['name'] || null;
        const typeFilter = command.args['type'] || null;
        const maxDepth = command.args['maxdepth']
            ? parseInt(command.args['maxdepth'], 10)
            : Infinity;

        try {
            const node = fs.getNode(searchPath);
            if (!node) {
                context.writer.writeError(
                    `find: '${searchPath}': No such file or directory`,
                );
                return;
            }
            if (node.type !== 'directory') {
                context.writer.writeError(
                    `find: '${searchPath}': Not a directory`,
                );
                return;
            }

            const resolvedBase = fs.resolvePath(searchPath);
            const nameRegex = namePattern ? this.globToRegex(namePattern) : null;

            const results: string[] = [];
            this.walk(
                node,
                resolvedBase,
                0,
                maxDepth,
                nameRegex,
                typeFilter,
                results,
            );

            for (const r of results) {
                context.writer.writeln(r);
            }
        } catch (e: any) {
            context.writer.writeError(`find: ${e.message}`);
        }
    }

    private parseSearchPath(command: CliProcessCommand): string | null {
        // The first non-flag token in rawCommand is the search path
        const raw = command.rawCommand || '';
        const tokens = raw.split(/\s+/).filter(Boolean);
        let i = 0;
        while (i < tokens.length) {
            const t = tokens[i];
            if (t === '-name' || t === '-type' || t === '-maxdepth') {
                i += 2; // skip flag and value
            } else if (t.startsWith('-')) {
                i++;
            } else {
                return t;
            }
        }
        return null;
    }

    private globToRegex(pattern: string): RegExp {
        const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
        const regexStr = escaped.replace(/\*/g, '.*').replace(/\?/g, '.');
        return new RegExp(`^${regexStr}$`, 'i');
    }

    private walk(
        node: IFileNode,
        currentPath: string,
        depth: number,
        maxDepth: number,
        nameRegex: RegExp | null,
        typeFilter: string | null,
        results: string[],
    ): void {
        if (!node.children) return;

        for (const child of node.children) {
            const childPath =
                currentPath === '/'
                    ? `/${child.name}`
                    : `${currentPath}/${child.name}`;

            let matches = true;
            if (nameRegex && !nameRegex.test(child.name)) {
                matches = false;
            }
            if (typeFilter === 'f' && child.type !== 'file') {
                matches = false;
            }
            if (typeFilter === 'd' && child.type !== 'directory') {
                matches = false;
            }

            if (matches) {
                results.push(childPath);
            }

            if (child.type === 'directory' && depth < maxDepth) {
                this.walk(
                    child,
                    childPath,
                    depth + 1,
                    maxDepth,
                    nameRegex,
                    typeFilter,
                    results,
                );
            }
        }
    }
}
```

**Step 2: Commit**

```bash
git add packages/plugins/files/src/lib/processors/cli-find-command-processor.ts
git commit -m "feat(files): add find command processor"
```

---

## Task 5: `grep` command

**Files:**
- Create: `packages/plugins/files/src/lib/processors/cli-grep-command-processor.ts`

**Step 1: Create the grep processor**

```typescript
import {
    CliForegroundColor,
    CliProcessCommand,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import {
    IFileSystemService,
    IFileSystemService_TOKEN,
    IFileNode,
} from '../interfaces';
import { LIBRARY_VERSION } from '../version';

export class CliGrepCommandProcessor implements ICliCommandProcessor {
    command = 'grep';
    description = 'Search file contents for a pattern';
    author = DefaultLibraryAuthor;
    version = LIBRARY_VERSION;
    acceptsRawInput = true;
    metadata = { icon: '🔎', module: 'file management' };

    parameters = [
        {
            name: 'ignore-case',
            aliases: ['i'],
            description: 'Case-insensitive matching',
            required: false,
            type: 'boolean' as const,
        },
        {
            name: 'recursive',
            aliases: ['r', 'R'],
            description: 'Recursively search directories',
            required: false,
            type: 'boolean' as const,
        },
        {
            name: 'line-number',
            aliases: ['n'],
            description: 'Show line numbers',
            required: false,
            type: 'boolean' as const,
        },
        {
            name: 'count',
            aliases: ['c'],
            description: 'Show only a count of matching lines per file',
            required: false,
            type: 'boolean' as const,
        },
        {
            name: 'files-with-matches',
            aliases: ['l'],
            description: 'Show only filenames containing matches',
            required: false,
            type: 'boolean' as const,
        },
        {
            name: 'invert-match',
            aliases: ['v'],
            description: 'Select non-matching lines',
            required: false,
            type: 'boolean' as const,
        },
    ];

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const fs = context.services.get<IFileSystemService>(
            IFileSystemService_TOKEN,
        );

        const ignoreCase =
            command.args['ignore-case'] || command.args['i'] || false;
        const recursive =
            command.args['recursive'] ||
            command.args['r'] ||
            command.args['R'] ||
            false;
        const showLineNum =
            command.args['line-number'] || command.args['n'] || false;
        const countOnly =
            command.args['count'] || command.args['c'] || false;
        const filesOnly =
            command.args['files-with-matches'] || command.args['l'] || false;
        const invert =
            command.args['invert-match'] || command.args['v'] || false;

        const { pattern, paths } = this.parseArgs(command);
        if (!pattern) {
            context.writer.writeError(
                'grep: missing pattern. Usage: grep [options] <pattern> <file>',
            );
            return;
        }
        if (paths.length === 0) {
            context.writer.writeError(
                'grep: missing file operand. Usage: grep [options] <pattern> <file>',
            );
            return;
        }

        let regex: RegExp;
        try {
            regex = new RegExp(pattern, ignoreCase ? 'gi' : 'g');
        } catch {
            context.writer.writeError(`grep: invalid pattern '${pattern}'`);
            return;
        }

        // Collect all file paths to search
        const filePaths: string[] = [];
        for (const p of paths) {
            try {
                if (!fs.exists(p)) {
                    context.writer.writeError(
                        `grep: ${p}: No such file or directory`,
                    );
                    continue;
                }
                if (fs.isDirectory(p)) {
                    if (!recursive) {
                        context.writer.writeError(
                            `grep: ${p}: Is a directory`,
                        );
                        continue;
                    }
                    this.collectFiles(fs, fs.resolvePath(p), fs.getNode(p)!, filePaths);
                } else {
                    filePaths.push(fs.resolvePath(p));
                }
            } catch (e: any) {
                context.writer.writeError(`grep: ${e.message}`);
            }
        }

        const multiFile = filePaths.length > 1;

        for (const filePath of filePaths) {
            try {
                const content = fs.readFile(filePath) ?? '';
                const lines = content.split('\n');
                let matchCount = 0;
                const matchingLines: { num: number; text: string }[] = [];

                for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
                    const line = lines[lineIdx];
                    regex.lastIndex = 0;
                    const hasMatch = regex.test(line);
                    const isMatch = invert ? !hasMatch : hasMatch;

                    if (isMatch) {
                        matchCount++;
                        matchingLines.push({
                            num: lineIdx + 1,
                            text: line,
                        });
                    }
                }

                if (filesOnly) {
                    if (matchCount > 0) {
                        context.writer.writeln(filePath);
                    }
                } else if (countOnly) {
                    const prefix = multiFile ? `${filePath}:` : '';
                    context.writer.writeln(`${prefix}${matchCount}`);
                } else {
                    for (const m of matchingLines) {
                        const parts: string[] = [];
                        if (multiFile) {
                            parts.push(
                                context.writer.wrapInColor(
                                    filePath,
                                    CliForegroundColor.Magenta,
                                ),
                            );
                            parts.push(':');
                        }
                        if (showLineNum) {
                            parts.push(
                                context.writer.wrapInColor(
                                    String(m.num),
                                    CliForegroundColor.Green,
                                ),
                            );
                            parts.push(':');
                        }

                        // Highlight matches in the line (unless inverted)
                        if (!invert) {
                            regex.lastIndex = 0;
                            const highlighted = m.text.replace(
                                regex,
                                (match) =>
                                    context.writer.wrapInColor(
                                        match,
                                        CliForegroundColor.Red,
                                    ),
                            );
                            parts.push(highlighted);
                        } else {
                            parts.push(m.text);
                        }

                        context.writer.writeln(parts.join(''));
                    }
                }
            } catch (e: any) {
                context.writer.writeError(`grep: ${filePath}: ${e.message}`);
            }
        }
    }

    private parseArgs(
        command: CliProcessCommand,
    ): { pattern: string | null; paths: string[] } {
        const raw = command.rawCommand || '';
        const tokens = raw.split(/\s+/).filter(Boolean);
        const nonFlags: string[] = [];

        let i = 0;
        while (i < tokens.length) {
            const t = tokens[i];
            if (t.startsWith('-')) {
                i++;
            } else {
                nonFlags.push(t);
                i++;
            }
        }

        if (nonFlags.length === 0) {
            return { pattern: null, paths: [] };
        }
        if (nonFlags.length === 1) {
            return { pattern: nonFlags[0], paths: [] };
        }

        return {
            pattern: nonFlags[0],
            paths: nonFlags.slice(1),
        };
    }

    private collectFiles(
        fs: IFileSystemService,
        basePath: string,
        node: IFileNode,
        result: string[],
    ): void {
        if (!node.children) return;
        for (const child of node.children) {
            const childPath =
                basePath === '/'
                    ? `/${child.name}`
                    : `${basePath}/${child.name}`;
            if (child.type === 'file') {
                result.push(childPath);
            } else if (child.type === 'directory') {
                this.collectFiles(fs, childPath, child, result);
            }
        }
    }
}
```

**Step 2: Commit**

```bash
git add packages/plugins/files/src/lib/processors/cli-grep-command-processor.ts
git commit -m "feat(files): add grep command processor"
```

---

## Task 6: Register all new processors and update exports

**Files:**
- Modify: `packages/plugins/files/src/lib/processors/index.ts`
- Modify: `packages/plugins/files/src/public-api.ts`
- Modify: `packages/plugins/files/src/lib/completion/file-path-completion-provider.ts`

**Step 1: Add exports to processors/index.ts**

Append these lines at the end of `packages/plugins/files/src/lib/processors/index.ts`:

```typescript
export * from './cli-head-command-processor';
export * from './cli-tail-command-processor';
export * from './cli-wc-command-processor';
export * from './cli-find-command-processor';
export * from './cli-grep-command-processor';
```

**Step 2: Update public-api.ts imports and processor array**

Add imports after the existing processor imports (after `CliTreeCommandProcessor` import):

```typescript
import { CliHeadCommandProcessor } from './lib/processors/cli-head-command-processor';
import { CliTailCommandProcessor } from './lib/processors/cli-tail-command-processor';
import { CliWcCommandProcessor } from './lib/processors/cli-wc-command-processor';
import { CliFindCommandProcessor } from './lib/processors/cli-find-command-processor';
import { CliGrepCommandProcessor } from './lib/processors/cli-grep-command-processor';
```

Add to the `processors` array in `filesModule` (after `new CliTreeCommandProcessor()`):

```typescript
new CliHeadCommandProcessor(),
new CliTailCommandProcessor(),
new CliWcCommandProcessor(),
new CliFindCommandProcessor(),
new CliGrepCommandProcessor(),
```

**Step 3: Update tab completion provider**

In `packages/plugins/files/src/lib/completion/file-path-completion-provider.ts`, add to the `FILE_COMMANDS` set:

```typescript
'grep',
'find',
'head',
'tail',
'wc',
```

**Step 4: Commit**

```bash
git add packages/plugins/files/src/lib/processors/index.ts \
       packages/plugins/files/src/public-api.ts \
       packages/plugins/files/src/lib/completion/file-path-completion-provider.ts
git commit -m "feat(files): register head, tail, wc, find, grep processors and update tab completion"
```

---

## Task 7: Build and verify

**Step 1: Build the files plugin**

Run: `cd /Users/nicolaelupei/Documents/Personal/web-cli && pnpm run build`

Expected: Builds all packages successfully without errors.

**Step 2: Commit any build-related fixes if needed**

---

## Task 8: Add test infrastructure for files plugin

**Files:**
- Create: `packages/plugins/files/tsconfig.spec.json`
- Modify: `packages/plugins/files/project.json`

**Step 1: Create tsconfig.spec.json**

```json
{
  "extends": "../../../tsconfig.json",
  "compilerOptions": {
    "outDir": "../../../out-tsc/spec",
    "types": [
      "jasmine"
    ]
  },
  "include": [
    "**/*.spec.ts",
    "**/*.d.ts"
  ]
}
```

**Step 2: Add test target to project.json**

Replace `packages/plugins/files/project.json` with:

```json
{
  "name": "files",
  "$schema": "../../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "packages/plugins/files/src",
  "targets": {
    "build": {
      "executor": "nx:run-commands",
      "options": {
        "commands": [
          "tsup",
          "cp package.json ../../../dist/files/package.json"
        ],
        "cwd": "packages/plugins/files",
        "parallel": false
      },
      "inputs": [
        "production",
        "sharedGlobals"
      ],
      "outputs": [
        "{workspaceRoot}/dist/files"
      ]
    },
    "test": {
      "executor": "@angular-devkit/build-angular:karma",
      "options": {
        "tsConfig": "packages/plugins/files/tsconfig.spec.json",
        "polyfills": [
          "zone.js",
          "zone.js/testing"
        ]
      }
    }
  }
}
```

**Step 3: Commit**

```bash
git add packages/plugins/files/tsconfig.spec.json packages/plugins/files/project.json
git commit -m "chore(files): add test infrastructure (Karma + Jasmine)"
```

---

## Task 9: Integration tests

**Files:**
- Create: `packages/plugins/files/src/tests/search-commands.spec.ts`

The tests instantiate the `IndexedDbFileSystemService` directly (it works in-memory before `initialize()` is called), populate it with test data, then invoke each processor's `processCommand` with a mock context and assert on `writer.written`.

**Step 1: Create integration test file**

```typescript
import { Subject } from 'rxjs';
import {
    CliProcessCommand,
    CliForegroundColor,
    CliBackgroundColor,
    ICliExecutionContext,
    ICliTerminalWriter,
    ICliServiceProvider,
} from '@qodalis/cli-core';
import { IndexedDbFileSystemService } from '../lib/services';
import { IFileSystemService_TOKEN } from '../lib/interfaces';
import { CliHeadCommandProcessor } from '../lib/processors/cli-head-command-processor';
import { CliTailCommandProcessor } from '../lib/processors/cli-tail-command-processor';
import { CliWcCommandProcessor } from '../lib/processors/cli-wc-command-processor';
import { CliFindCommandProcessor } from '../lib/processors/cli-find-command-processor';
import { CliGrepCommandProcessor } from '../lib/processors/cli-grep-command-processor';

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------

function createStubWriter(): ICliTerminalWriter & { written: string[] } {
    const written: string[] = [];
    return {
        written,
        write(text: string) { written.push(text); },
        writeln(text?: string) { written.push(text ?? ''); },
        writeSuccess(msg: string) { written.push(`[success] ${msg}`); },
        writeInfo(msg: string) { written.push(`[info] ${msg}`); },
        writeWarning(msg: string) { written.push(`[warn] ${msg}`); },
        writeError(msg: string) { written.push(`[error] ${msg}`); },
        wrapInColor(text: string, _color: CliForegroundColor) { return text; },
        wrapInBackgroundColor(text: string, _color: CliBackgroundColor) { return text; },
        writeJson(json: any) { written.push(JSON.stringify(json)); },
        writeToFile(_fn: string, _content: string) {},
        writeObjectsAsTable(objects: any[]) { written.push(JSON.stringify(objects)); },
        writeTable(_h: string[], _r: string[][]) {},
        writeDivider() {},
        writeList(_items: string[], _options?: any) {},
        writeKeyValue(_entries: any, _options?: any) {},
        writeColumns(_items: string[], _options?: any) {},
    };
}

function createMockContext(
    writer: ICliTerminalWriter,
    fs: IndexedDbFileSystemService,
): ICliExecutionContext {
    const services: ICliServiceProvider = {
        get<T>(token: any): T {
            if (token === IFileSystemService_TOKEN) return fs as any;
            throw new Error(`Unknown service: ${token}`);
        },
        set() {},
    };

    return {
        writer,
        services,
        spinner: { show() {}, hide() {} },
        progressBar: { show() {}, update() {}, hide() {} },
        onAbort: new Subject<void>(),
        terminal: {} as any,
        reader: {} as any,
        executor: {} as any,
        clipboard: {} as any,
        options: undefined,
        logger: { log() {}, info() {}, warn() {}, error() {}, debug() {}, setCliLogLevel() {} },
        process: { output() {}, exit() {} } as any,
        state: {} as any,
        showPrompt: jasmine.createSpy('showPrompt'),
        setContextProcessor: jasmine.createSpy('setContextProcessor'),
        setCurrentLine: jasmine.createSpy('setCurrentLine'),
        clearLine: jasmine.createSpy('clearLine'),
        clearCurrentLine: jasmine.createSpy('clearCurrentLine'),
        refreshCurrentLine: jasmine.createSpy('refreshCurrentLine'),
        enterFullScreenMode: jasmine.createSpy('enterFullScreenMode'),
        exitFullScreenMode: jasmine.createSpy('exitFullScreenMode'),
    } as any;
}

function makeCommand(
    raw: string,
    args: Record<string, any> = {},
    value?: string,
): CliProcessCommand {
    return {
        command: raw.split(/\s+/)[0],
        rawCommand: raw.split(/\s+/).slice(1).join(' '),
        value: value ?? null,
        args,
        chainCommands: [],
    } as any;
}

function setupTestFs(): IndexedDbFileSystemService {
    const fs = new IndexedDbFileSystemService();
    // Create test structure:
    //   /home/user/welcome.txt (exists from seed)
    //   /home/user/docs/
    //   /home/user/docs/readme.md
    //   /home/user/docs/notes.txt
    //   /home/user/hello.sh
    fs.createDirectory('/home/user/docs');
    fs.createFile('/home/user/docs/readme.md', 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6\nLine 7\nLine 8\nLine 9\nLine 10\nLine 11\nLine 12\n');
    fs.createFile('/home/user/docs/notes.txt', 'Hello World\nhello again\nGoodbye\nHELLO final\n');
    fs.createFile('/home/user/hello.sh', '#!/bin/bash\necho "Hello World"\nexit 0\n');
    return fs;
}

// ---------------------------------------------------------------------------
// head command tests
// ---------------------------------------------------------------------------

describe('CliHeadCommandProcessor', () => {
    let processor: CliHeadCommandProcessor;
    let fs: IndexedDbFileSystemService;
    let writer: ICliTerminalWriter & { written: string[] };
    let ctx: ICliExecutionContext;

    beforeEach(() => {
        processor = new CliHeadCommandProcessor();
        fs = setupTestFs();
        writer = createStubWriter();
        ctx = createMockContext(writer, fs);
    });

    it('should have command "head"', () => {
        expect(processor.command).toBe('head');
    });

    it('should display first 10 lines by default', async () => {
        const cmd = makeCommand('head /home/user/docs/readme.md', {}, '/home/user/docs/readme.md');
        cmd.rawCommand = '/home/user/docs/readme.md';
        await processor.processCommand(cmd, ctx);
        // readme.md has 13 lines (12 + trailing), head shows first 10
        const output = writer.written.join('\n');
        expect(output).toContain('Line 1');
        expect(output).toContain('Line 10');
        expect(output).not.toContain('Line 11');
    });

    it('should respect -n flag', async () => {
        const cmd = makeCommand('head -n 3 /home/user/docs/readme.md', { n: '3' }, '/home/user/docs/readme.md');
        cmd.rawCommand = '-n 3 /home/user/docs/readme.md';
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('Line 1');
        expect(output).toContain('Line 3');
        expect(output).not.toContain('Line 4');
    });

    it('should error on missing file', async () => {
        const cmd = makeCommand('head /nonexistent', {}, '/nonexistent');
        cmd.rawCommand = '/nonexistent';
        await processor.processCommand(cmd, ctx);
        expect(writer.written.some(l => l.includes('[error]'))).toBe(true);
    });

    it('should error on missing operand', async () => {
        const cmd = makeCommand('head', {});
        cmd.rawCommand = '';
        await processor.processCommand(cmd, ctx);
        expect(writer.written.some(l => l.includes('missing file operand'))).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// tail command tests
// ---------------------------------------------------------------------------

describe('CliTailCommandProcessor', () => {
    let processor: CliTailCommandProcessor;
    let fs: IndexedDbFileSystemService;
    let writer: ICliTerminalWriter & { written: string[] };
    let ctx: ICliExecutionContext;

    beforeEach(() => {
        processor = new CliTailCommandProcessor();
        fs = setupTestFs();
        writer = createStubWriter();
        ctx = createMockContext(writer, fs);
    });

    it('should have command "tail"', () => {
        expect(processor.command).toBe('tail');
    });

    it('should display last 10 lines by default', async () => {
        const cmd = makeCommand('tail /home/user/docs/readme.md', {}, '/home/user/docs/readme.md');
        cmd.rawCommand = '/home/user/docs/readme.md';
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('Line 12');
        // Should not contain Line 1 or Line 2 (file has 13 lines, last 10 starts at Line 4)
        expect(output).not.toContain('Line 1\n');
    });

    it('should respect -n flag', async () => {
        const cmd = makeCommand('tail -n 2 /home/user/docs/readme.md', { n: '2' }, '/home/user/docs/readme.md');
        cmd.rawCommand = '-n 2 /home/user/docs/readme.md';
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('Line 12');
        expect(output).not.toContain('Line 10');
    });

    it('should error on missing file', async () => {
        const cmd = makeCommand('tail /nonexistent', {}, '/nonexistent');
        cmd.rawCommand = '/nonexistent';
        await processor.processCommand(cmd, ctx);
        expect(writer.written.some(l => l.includes('[error]'))).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// wc command tests
// ---------------------------------------------------------------------------

describe('CliWcCommandProcessor', () => {
    let processor: CliWcCommandProcessor;
    let fs: IndexedDbFileSystemService;
    let writer: ICliTerminalWriter & { written: string[] };
    let ctx: ICliExecutionContext;

    beforeEach(() => {
        processor = new CliWcCommandProcessor();
        fs = setupTestFs();
        writer = createStubWriter();
        ctx = createMockContext(writer, fs);
    });

    it('should have command "wc"', () => {
        expect(processor.command).toBe('wc');
    });

    it('should show lines, words, chars by default', async () => {
        const cmd = makeCommand('wc /home/user/hello.sh', {}, '/home/user/hello.sh');
        cmd.rawCommand = '/home/user/hello.sh';
        await processor.processCommand(cmd, ctx);
        // hello.sh: 3 lines of content + trailing newline = 4 lines
        const output = writer.written.join('');
        expect(output).toContain('/home/user/hello.sh');
    });

    it('should support -l flag for lines only', async () => {
        const cmd = makeCommand('wc -l /home/user/hello.sh', { l: true }, '/home/user/hello.sh');
        cmd.rawCommand = '/home/user/hello.sh';
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('');
        expect(output).toContain('/home/user/hello.sh');
    });

    it('should show totals for multiple files', async () => {
        const cmd = makeCommand(
            'wc /home/user/hello.sh /home/user/docs/notes.txt',
            {},
        );
        cmd.rawCommand = '/home/user/hello.sh /home/user/docs/notes.txt';
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('total');
    });

    it('should error on missing operand', async () => {
        const cmd = makeCommand('wc', {});
        cmd.rawCommand = '';
        await processor.processCommand(cmd, ctx);
        expect(writer.written.some(l => l.includes('missing file operand'))).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// find command tests
// ---------------------------------------------------------------------------

describe('CliFindCommandProcessor', () => {
    let processor: CliFindCommandProcessor;
    let fs: IndexedDbFileSystemService;
    let writer: ICliTerminalWriter & { written: string[] };
    let ctx: ICliExecutionContext;

    beforeEach(() => {
        processor = new CliFindCommandProcessor();
        fs = setupTestFs();
        writer = createStubWriter();
        ctx = createMockContext(writer, fs);
    });

    it('should have command "find"', () => {
        expect(processor.command).toBe('find');
    });

    it('should find files by -name glob', async () => {
        const cmd = makeCommand('find /home/user -name *.txt', {
            name: '*.txt',
        });
        cmd.rawCommand = '/home/user -name *.txt';
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('notes.txt');
        expect(output).toContain('welcome.txt');
        expect(output).not.toContain('readme.md');
    });

    it('should filter by -type f', async () => {
        const cmd = makeCommand('find /home/user -type d', {
            type: 'd',
        });
        cmd.rawCommand = '/home/user -type d';
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('docs');
        // Should not contain any file entries
        expect(output).not.toContain('.txt');
        expect(output).not.toContain('.md');
        expect(output).not.toContain('.sh');
    });

    it('should respect -maxdepth', async () => {
        const cmd = makeCommand('find /home/user -maxdepth 1 -name *.txt', {
            name: '*.txt',
            maxdepth: '1',
        });
        cmd.rawCommand = '/home/user -maxdepth 1 -name *.txt';
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('welcome.txt');
        // notes.txt is at depth 2 (user/docs/notes.txt), should not appear with maxdepth 1
        expect(output).not.toContain('notes.txt');
    });

    it('should default to cwd when no path given', async () => {
        fs.setCurrentDirectory('/home/user');
        const cmd = makeCommand('find -name *.sh', {
            name: '*.sh',
        });
        cmd.rawCommand = '-name *.sh';
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('hello.sh');
    });

    it('should error on non-existent path', async () => {
        const cmd = makeCommand('find /nope', {});
        cmd.rawCommand = '/nope';
        await processor.processCommand(cmd, ctx);
        expect(writer.written.some(l => l.includes('[error]'))).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// grep command tests
// ---------------------------------------------------------------------------

describe('CliGrepCommandProcessor', () => {
    let processor: CliGrepCommandProcessor;
    let fs: IndexedDbFileSystemService;
    let writer: ICliTerminalWriter & { written: string[] };
    let ctx: ICliExecutionContext;

    beforeEach(() => {
        processor = new CliGrepCommandProcessor();
        fs = setupTestFs();
        writer = createStubWriter();
        ctx = createMockContext(writer, fs);
    });

    it('should have command "grep"', () => {
        expect(processor.command).toBe('grep');
    });

    it('should find matching lines in a file', async () => {
        const cmd = makeCommand('grep Hello /home/user/docs/notes.txt', {});
        cmd.rawCommand = 'Hello /home/user/docs/notes.txt';
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('Hello World');
        expect(output).not.toContain('Goodbye');
    });

    it('should support case-insensitive search with -i', async () => {
        const cmd = makeCommand('grep -i hello /home/user/docs/notes.txt', {
            i: true,
        });
        cmd.rawCommand = 'hello /home/user/docs/notes.txt';
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('Hello World');
        expect(output).toContain('hello again');
        expect(output).toContain('HELLO final');
    });

    it('should support -v for invert match', async () => {
        const cmd = makeCommand('grep -v Hello /home/user/docs/notes.txt', {
            v: true,
        });
        cmd.rawCommand = 'Hello /home/user/docs/notes.txt';
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('hello again');
        expect(output).toContain('Goodbye');
        expect(output).not.toContain('Hello World');
    });

    it('should support -c for count only', async () => {
        const cmd = makeCommand('grep -c Hello /home/user/docs/notes.txt', {
            c: true,
        });
        cmd.rawCommand = 'Hello /home/user/docs/notes.txt';
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('');
        // "Hello World" and "HELLO final" won't match (case-sensitive), only "Hello World"
        expect(output).toContain('1');
    });

    it('should support -l for files-with-matches', async () => {
        const cmd = makeCommand('grep -r -l Hello /home/user', {
            r: true,
            l: true,
        });
        cmd.rawCommand = 'Hello /home/user';
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('notes.txt');
    });

    it('should support -n for line numbers', async () => {
        const cmd = makeCommand('grep -n Hello /home/user/docs/notes.txt', {
            n: true,
        });
        cmd.rawCommand = 'Hello /home/user/docs/notes.txt';
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('');
        expect(output).toContain('1');
        expect(output).toContain('Hello World');
    });

    it('should search recursively with -r', async () => {
        const cmd = makeCommand('grep -r echo /home/user', {
            r: true,
        });
        cmd.rawCommand = 'echo /home/user';
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('echo');
    });

    it('should error when directory given without -r', async () => {
        const cmd = makeCommand('grep Hello /home/user', {});
        cmd.rawCommand = 'Hello /home/user';
        await processor.processCommand(cmd, ctx);
        expect(writer.written.some(l => l.includes('Is a directory'))).toBe(true);
    });

    it('should error on missing pattern', async () => {
        const cmd = makeCommand('grep', {});
        cmd.rawCommand = '';
        await processor.processCommand(cmd, ctx);
        expect(writer.written.some(l => l.includes('missing pattern'))).toBe(true);
    });

    it('should error on non-existent file', async () => {
        const cmd = makeCommand('grep foo /nonexistent', {});
        cmd.rawCommand = 'foo /nonexistent';
        await processor.processCommand(cmd, ctx);
        expect(writer.written.some(l => l.includes('No such file or directory'))).toBe(true);
    });

    it('should support regex patterns', async () => {
        const cmd = makeCommand('grep ^Line.*3$ /home/user/docs/readme.md', {});
        cmd.rawCommand = '^Line.*3$ /home/user/docs/readme.md';
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('Line 3');
        expect(output).not.toContain('Line 1');
    });
});
```

**Step 2: Run the tests**

Run: `cd /Users/nicolaelupei/Documents/Personal/web-cli && npx nx test files`

Expected: All tests pass.

**Step 3: Commit**

```bash
git add packages/plugins/files/src/tests/search-commands.spec.ts
git commit -m "test(files): add integration tests for head, tail, wc, find, grep"
```

---

## Task 10: Final build verification

**Step 1: Full build**

Run: `cd /Users/nicolaelupei/Documents/Personal/web-cli && pnpm run build`

Expected: Clean build of all projects.

**Step 2: Run all tests**

Run: `cd /Users/nicolaelupei/Documents/Personal/web-cli && pnpm test`

Expected: All tests pass.

**Step 3: Final commit (if any fixes needed)**
