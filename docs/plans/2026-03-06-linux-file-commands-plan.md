# Linux File Commands Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add 17 popular Linux file commands (sed, awk, sort, uniq, cut, tr, tee, diff, paste, chmod, stat, ln, basename, dirname, du, xargs, tac) to the `@qodalis/cli-files` plugin.

**Architecture:** Each command is a standalone class implementing `ICliCommandProcessor`, following the exact pattern of existing processors (grep, head, etc.). Commands read/write via `IFileSystemService`. Grouped into 7 implementation tasks by complexity/similarity. Tests use Jasmine with existing helpers.

**Tech Stack:** TypeScript, Jasmine, Karma, xterm.js writer, IFileSystemService virtual filesystem

---

## Reference: Existing Patterns

All processors live in `packages/plugins/files/src/lib/processors/`. Every processor:

```typescript
import {
    CliProcessCommand,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { IFileSystemService, IFileSystemService_TOKEN } from '../interfaces';
import { LIBRARY_VERSION } from '../version';
```

- Sets `command`, `description`, `author = DefaultLibraryAuthor`, `version = LIBRARY_VERSION`, `acceptsRawInput = true`
- Sets `metadata = { icon: '...', module: 'file management' }`
- Gets fs via `context.services.get<IFileSystemService>(IFileSystemService_TOKEN)`
- Parses args from `command.rawCommand` (split on whitespace, filter flags)
- Outputs via `context.writer.writeln()` / `context.writer.writeError()`
- Calls `await fs.persist()` after write operations

Tests live in `packages/plugins/files/src/tests/`. Use helpers: `createStubWriter()`, `createMockContext()`, `makeCommand()`, `setupTestFs()`.

Registration: Add import + `new Cli<Name>CommandProcessor()` to `public-api.ts` processors array, add export to `processors/index.ts`.

---

## Task 1: Simple Commands — `tac`, `basename`, `dirname`

**Files:**
- Create: `packages/plugins/files/src/lib/processors/cli-tac-command-processor.ts`
- Create: `packages/plugins/files/src/lib/processors/cli-basename-command-processor.ts`
- Create: `packages/plugins/files/src/lib/processors/cli-dirname-command-processor.ts`
- Create: `packages/plugins/files/src/tests/simple-commands.spec.ts`
- Modify: `packages/plugins/files/src/lib/processors/index.ts`
- Modify: `packages/plugins/files/src/public-api.ts`

### Step 1: Write tests for tac, basename, dirname

Create `packages/plugins/files/src/tests/simple-commands.spec.ts` with the same test helpers from `search-commands.spec.ts` (copy `createStubWriter`, `createMockContext`, `makeCommand`, `setupTestFs`).

Tests for `tac`:
```typescript
describe('CliTacCommandProcessor', () => {
    let processor: CliTacCommandProcessor;
    let fs: IndexedDbFileSystemService;
    let writer: ICliTerminalWriter & { written: string[] };
    let ctx: ICliExecutionContext;

    beforeEach(() => {
        processor = new CliTacCommandProcessor();
        fs = setupTestFs();
        writer = createStubWriter();
        ctx = createMockContext(writer, fs);
    });

    it('should have command "tac"', () => {
        expect(processor.command).toBe('tac');
    });

    it('should print file lines in reverse order', async () => {
        fs.createFile('/home/user/lines.txt', 'line1\nline2\nline3\n');
        const cmd = makeCommand('tac /home/user/lines.txt');
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        const idx1 = output.indexOf('line3');
        const idx2 = output.indexOf('line2');
        const idx3 = output.indexOf('line1');
        expect(idx1).toBeLessThan(idx2);
        expect(idx2).toBeLessThan(idx3);
    });

    it('should error on missing operand', async () => {
        const cmd = makeCommand('tac');
        await processor.processCommand(cmd, ctx);
        expect(writer.written.some(l => l.includes('missing file operand'))).toBe(true);
    });

    it('should error on nonexistent file', async () => {
        const cmd = makeCommand('tac /nope');
        await processor.processCommand(cmd, ctx);
        expect(writer.written.some(l => l.includes('[error]'))).toBe(true);
    });

    it('should handle multiple files', async () => {
        fs.createFile('/home/user/a.txt', 'a1\na2\n');
        fs.createFile('/home/user/b.txt', 'b1\nb2\n');
        const cmd = makeCommand('tac /home/user/a.txt /home/user/b.txt');
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('a2');
        expect(output).toContain('b2');
    });
});
```

Tests for `basename`:
```typescript
describe('CliBasenameCommandProcessor', () => {
    let processor: CliBasenameCommandProcessor;
    let writer: ICliTerminalWriter & { written: string[] };
    let ctx: ICliExecutionContext;

    beforeEach(() => {
        processor = new CliBasenameCommandProcessor();
        const fs = setupTestFs();
        writer = createStubWriter();
        ctx = createMockContext(writer, fs);
    });

    it('should have command "basename"', () => {
        expect(processor.command).toBe('basename');
    });

    it('should strip directory from path', async () => {
        const cmd = makeCommand('basename /home/user/docs/readme.md');
        await processor.processCommand(cmd, ctx);
        expect(writer.written).toContain('readme.md');
    });

    it('should strip suffix if provided', async () => {
        const cmd = makeCommand('basename /home/user/docs/readme.md .md');
        await processor.processCommand(cmd, ctx);
        expect(writer.written).toContain('readme');
    });

    it('should handle root path', async () => {
        const cmd = makeCommand('basename /');
        await processor.processCommand(cmd, ctx);
        expect(writer.written).toContain('/');
    });

    it('should error on missing operand', async () => {
        const cmd = makeCommand('basename');
        await processor.processCommand(cmd, ctx);
        expect(writer.written.some(l => l.includes('missing operand'))).toBe(true);
    });
});
```

Tests for `dirname`:
```typescript
describe('CliDirnameCommandProcessor', () => {
    let processor: CliDirnameCommandProcessor;
    let writer: ICliTerminalWriter & { written: string[] };
    let ctx: ICliExecutionContext;

    beforeEach(() => {
        processor = new CliDirnameCommandProcessor();
        const fs = setupTestFs();
        writer = createStubWriter();
        ctx = createMockContext(writer, fs);
    });

    it('should have command "dirname"', () => {
        expect(processor.command).toBe('dirname');
    });

    it('should strip last component from path', async () => {
        const cmd = makeCommand('dirname /home/user/docs/readme.md');
        await processor.processCommand(cmd, ctx);
        expect(writer.written).toContain('/home/user/docs');
    });

    it('should return / for root-level paths', async () => {
        const cmd = makeCommand('dirname /home');
        await processor.processCommand(cmd, ctx);
        expect(writer.written).toContain('/');
    });

    it('should return . for bare filename', async () => {
        const cmd = makeCommand('dirname readme.md');
        await processor.processCommand(cmd, ctx);
        expect(writer.written).toContain('.');
    });

    it('should error on missing operand', async () => {
        const cmd = makeCommand('dirname');
        await processor.processCommand(cmd, ctx);
        expect(writer.written.some(l => l.includes('missing operand'))).toBe(true);
    });
});
```

### Step 2: Implement tac, basename, dirname processors

**`cli-tac-command-processor.ts`:**
- Read file(s), split by `\n`, reverse, join and writeln
- Support multiple files with `==> filename <==` headers

**`cli-basename-command-processor.ts`:**
- Parse path and optional suffix from rawCommand
- Split path by `/`, take last component, strip suffix if it matches end
- Pure string operation, no fs access needed

**`cli-dirname-command-processor.ts`:**
- Parse path from rawCommand
- Split by `/`, return everything except last component
- Return `.` for bare filenames, `/` for root-level

### Step 3: Register processors

Add exports to `processors/index.ts`, add imports and instances to `public-api.ts`.

### Step 4: Run tests, verify pass

Run: `npx nx test files`

### Step 5: Commit

```
feat(files): add tac, basename, dirname commands
```

---

## Task 2: Text Sorting/Filtering — `sort`, `uniq`, `cut`, `paste`

**Files:**
- Create: `packages/plugins/files/src/lib/processors/cli-sort-command-processor.ts`
- Create: `packages/plugins/files/src/lib/processors/cli-uniq-command-processor.ts`
- Create: `packages/plugins/files/src/lib/processors/cli-cut-command-processor.ts`
- Create: `packages/plugins/files/src/lib/processors/cli-paste-command-processor.ts`
- Create: `packages/plugins/files/src/tests/text-filtering-commands.spec.ts`
- Modify: `packages/plugins/files/src/lib/processors/index.ts`
- Modify: `packages/plugins/files/src/public-api.ts`

### Step 1: Write tests

**sort tests:**
- Default alphabetical sort
- `-r` reverse sort
- `-n` numeric sort
- `-u` unique (deduplicate)
- `-k 2` sort by field 2
- `-t ','` custom delimiter with `-k`
- Error on missing operand
- Error on nonexistent file

**uniq tests:**
- Default: collapse adjacent duplicates
- `-c` prefix lines with count
- `-d` only print duplicate lines
- `-u` only print unique lines
- `-i` case-insensitive comparison
- Error on missing operand

**cut tests:**
- `-d ',' -f 2` extract field 2 with comma delimiter
- `-f 1,3` extract fields 1 and 3
- `-c 1-5` extract characters 1-5
- `-c 3` extract single character position
- Default delimiter is tab
- Error on missing operand
- Error when neither -f nor -c given

**paste tests:**
- Merge two files side by side (tab-separated by default)
- `-d ','` custom delimiter
- `-s` serial mode (transpose each file to one line)
- Error on missing operand

### Step 2: Implement processors

**`cli-sort-command-processor.ts`:**
- Read file content, split lines
- Parameters: `-r` (reverse), `-n` (numeric), `-u` (unique), `-k` (key field, 1-indexed), `-t` (delimiter)
- Sort logic: if `-k`, split each line by delimiter (default whitespace), compare by field; if `-n`, `parseFloat` comparison; if `-u`, deduplicate after sort; if `-r`, reverse
- Output sorted lines

**`cli-uniq-command-processor.ts`:**
- Read file content, split lines
- Parameters: `-c` (count), `-d` (duplicates only), `-i` (ignore case), `-u` (unique only)
- Walk lines, compare adjacent (optionally case-insensitive)
- Group consecutive identical lines, then output based on flags

**`cli-cut-command-processor.ts`:**
- Read file content, split lines
- Parameters: `-d` (delimiter, default tab), `-f` (fields, comma-separated list/ranges), `-c` (character positions, comma-separated list/ranges)
- Parse field/char specs: support `N`, `N-M`, `N-`, `-M`
- For `-f`: split each line by delimiter, select fields
- For `-c`: select character positions from each line

**`cli-paste-command-processor.ts`:**
- Read multiple files, split each into lines
- Parameters: `-d` (delimiter, default tab), `-s` (serial)
- Normal mode: zip lines from all files, join with delimiter
- Serial mode: for each file, join all its lines with delimiter, output one line per file

### Step 3: Register processors

### Step 4: Run tests, verify pass

Run: `npx nx test files`

### Step 5: Commit

```
feat(files): add sort, uniq, cut, paste commands
```

---

## Task 3: Character Translation — `tr`

**Files:**
- Create: `packages/plugins/files/src/lib/processors/cli-tr-command-processor.ts`
- Create: `packages/plugins/files/src/tests/tr-command.spec.ts`
- Modify: `packages/plugins/files/src/lib/processors/index.ts`
- Modify: `packages/plugins/files/src/public-api.ts`

### Step 1: Write tests

```typescript
// tr reads from file (since no stdin in virtual FS): tr [options] SET1 [SET2] <file>
describe('CliTrCommandProcessor', () => {
    // Basic translate: tr 'a-z' 'A-Z' file.txt → uppercase all lowercase
    // Character classes: tr '[:lower:]' '[:upper:]' file.txt
    // Delete: tr -d 'aeiou' file.txt → remove vowels
    // Squeeze: tr -s ' ' file.txt → collapse repeated spaces
    // Delete + squeeze combo: tr -ds 'aeiou' ' ' file.txt
    // Range expansion: tr 'a-f' 'A-F' file.txt
    // Error: missing operands
    // Error: nonexistent file
});
```

### Step 2: Implement processor

**`cli-tr-command-processor.ts`:**
- Parameters: `-d` (delete), `-s` (squeeze repeats)
- Parse SET1 and SET2 from rawCommand (quoted or unquoted)
- Expand ranges: `a-z` → all chars a through z
- Expand character classes: `[:upper:]`, `[:lower:]`, `[:digit:]`, `[:alpha:]`, `[:alnum:]`, `[:space:]`
- Translate mode (SET1 + SET2): map each char in SET1 to corresponding char in SET2
- Delete mode (`-d`): remove all chars in SET1
- Squeeze mode (`-s`): replace repeated occurrences of chars in SET1 (or SET2 if with -d) with single
- Since no stdin, read from file argument (last non-flag non-set argument)

### Step 3: Register, test, commit

```
feat(files): add tr command
```

---

## Task 4: File Metadata — `stat`, `chmod`, `du`, `ln`

**Files:**
- Create: `packages/plugins/files/src/lib/processors/cli-stat-command-processor.ts`
- Create: `packages/plugins/files/src/lib/processors/cli-chmod-command-processor.ts`
- Create: `packages/plugins/files/src/lib/processors/cli-du-command-processor.ts`
- Create: `packages/plugins/files/src/lib/processors/cli-ln-command-processor.ts`
- Create: `packages/plugins/files/src/tests/file-metadata-commands.spec.ts`
- Modify: `packages/plugins/files/src/lib/processors/index.ts`
- Modify: `packages/plugins/files/src/public-api.ts`

### Step 1: Write tests

**stat tests:**
- Display file metadata (name, size, type, permissions, timestamps)
- Display directory metadata
- Error on nonexistent path
- Error on missing operand

**chmod tests:**
- Octal mode: `chmod 755 file.txt` → sets permissions to `rwxr-xr-x`
- Symbolic: `chmod u+x file.txt` → adds execute for user
- Symbolic: `chmod go-w file.txt` → removes write for group+other
- Symbolic: `chmod a+r file.txt` → adds read for all
- Recursive: `chmod -R 755 dir/`
- Error on invalid mode
- Error on nonexistent file
- Verify `fs.persist()` called (node permissions field updated)

**du tests:**
- Default: show sizes for all files/dirs recursively
- `-s` summary only (total for the path)
- `-h` human-readable (K, M, G)
- `-d 1` max depth
- Error on nonexistent path
- Error on missing operand

**ln tests:**
- `ln -s target linkname` creates a symlink (file with `type: 'symlink'` or content storing target)
- Since virtual FS doesn't have real symlinks, store as a file with a special marker
- Actually: simplest approach — create a regular file whose content is the target path, and note in the IFileNode a `symlink` field. But since we can't modify IFileNode easily without breaking things, just store as a file with content `-> target` and update `ls` to recognize it later. OR: add optional `linkTarget?: string` to IFileNode.
- `ln -s /home/user/docs/readme.md /home/user/link.md`
- Error without `-s` (hard links not supported in virtual FS)
- Error on missing operand
- Error on nonexistent target (warning only, ln allows dangling symlinks)

### Step 2: Implement processors

**`cli-stat-command-processor.ts`:**
- Get node via `fs.getNode(path)`
- Display: File, Size, Type (file/directory), Permissions, Created, Modified
- Format timestamps with `new Date(ts).toLocaleString()`

**`cli-chmod-command-processor.ts`:**
- Parse mode: detect octal (3-digit number) vs symbolic (u/g/o/a +/-/= r/w/x)
- Octal: convert to permission string (`rwxr-xr-x` format)
- Symbolic: parse who (u/g/o/a), operation (+/-/=), permissions (r/w/x), apply to existing permission string
- Parameters: `-R` for recursive
- Update `node.permissions`, call `fs.persist()`
- Helper: `octalToPermString(octal: string): string` and `applySymbolicMode(current: string, mode: string): string`

**`cli-du-command-processor.ts`:**
- Traverse tree, sum file sizes
- Parameters: `-h` (human-readable), `-s` (summary), `-d`/`--max-depth` (depth limit)
- Human-readable: format bytes as K/M/G
- Output each directory's cumulative size, then total

**`cli-ln-command-processor.ts`:**
- Only support `-s` (symbolic links); error without it ("hard links not supported")
- Add `linkTarget?: string` field to `IFileNode` interface
- Create a file node with `linkTarget` set to the target path
- Call `fs.persist()`

### Step 2b: Modify IFileNode interface

Add to `packages/plugins/files/src/lib/interfaces/i-file-node.ts`:
```typescript
/** For symbolic links: the target path this link points to */
linkTarget?: string;
```

### Step 3: Register, test, commit

```
feat(files): add stat, chmod, du, ln commands
```

---

## Task 5: Stream Editor — `sed`

**Files:**
- Create: `packages/plugins/files/src/lib/processors/cli-sed-command-processor.ts`
- Create: `packages/plugins/files/src/tests/sed-command.spec.ts`
- Modify: `packages/plugins/files/src/lib/processors/index.ts`
- Modify: `packages/plugins/files/src/public-api.ts`

### Step 1: Write tests

```typescript
describe('CliSedCommandProcessor', () => {
    // Substitution
    it('should substitute first occurrence: sed "s/Hello/Hi/" file');
    it('should substitute all occurrences with g flag: sed "s/Hello/Hi/g" file');
    it('should support case-insensitive with i flag: sed "s/hello/Hi/gi" file');
    it('should support alternate delimiters: sed "s|/path|/new|g" file');

    // In-place editing
    it('should modify file in-place with -i: sed -i "s/old/new/g" file');
    it('should not modify file without -i');

    // Line addressing
    it('should apply to specific line: sed "2s/foo/bar/" file');
    it('should apply to line range: sed "1,3s/foo/bar/" file');
    it('should apply to last line: sed "$s/foo/bar/" file');

    // Delete command
    it('should delete lines: sed "2d" file');
    it('should delete line range: sed "1,3d" file');
    it('should delete matching lines: sed "/pattern/d" file');

    // Print command
    it('should print matching lines with -n and p: sed -n "/Hello/p" file');

    // Multiple expressions
    it('should support -e for multiple expressions: sed -e "s/a/b/" -e "s/c/d/" file');

    // Errors
    it('should error on missing expression');
    it('should error on missing file');
    it('should error on invalid regex');
});
```

### Step 2: Implement processor

**`cli-sed-command-processor.ts`:**
- Parameters: `-i` (in-place), `-n` (suppress default output), `-e` (expression, multiple allowed)
- Parse sed expressions from rawCommand
- Expression parser handles:
  - `[addr]s/pattern/replacement/flags` — substitution
  - `[addr]d` — delete
  - `[addr]p` — print
- Address types: none (all lines), `N` (line N), `$` (last line), `N,M` (range), `/regex/` (pattern match)
- Substitution flags: `g` (global), `i` (case-insensitive), `p` (print if substituted)
- Alternate delimiters: first char after `s` is the delimiter
- Process line by line: check address, apply command, collect output
- If `-i`, write result back to file and persist

### Step 3: Register, test, commit

```
feat(files): add sed command
```

---

## Task 6: Pattern Processing — `awk`

**Files:**
- Create: `packages/plugins/files/src/lib/processors/cli-awk-command-processor.ts`
- Create: `packages/plugins/files/src/tests/awk-command.spec.ts`
- Modify: `packages/plugins/files/src/lib/processors/index.ts`
- Modify: `packages/plugins/files/src/public-api.ts`

### Step 1: Write tests

```typescript
describe('CliAwkCommandProcessor', () => {
    // Field printing
    it('should print specific field: awk "{print $2}" file');
    it('should print multiple fields: awk "{print $1, $3}" file');
    it('should print whole line with $0: awk "{print $0}" file');
    it('should use custom separator: awk -F "," "{print $2}" file');

    // Built-in variables
    it('should support NR (line number): awk "{print NR, $0}" file');
    it('should support NF (field count): awk "{print NF}" file');

    // BEGIN/END blocks
    it('should execute BEGIN block before processing: awk "BEGIN{print \"header\"} {print $1}" file');
    it('should execute END block after processing: awk "{sum+=$1} END{print sum}" file');

    // Pattern matching
    it('should filter by pattern: awk "/error/ {print $0}" file');
    it('should filter by field comparison: awk "$1 > 10 {print $0}" file');

    // String concatenation
    it('should concatenate fields: awk "{print $1 \"-\" $2}" file');

    // Errors
    it('should error on missing program');
    it('should error on missing file');
});
```

### Step 2: Implement processor

**`cli-awk-command-processor.ts`:**
- Parameters: `-F` (field separator, default whitespace)
- Parse awk program from quoted string in rawCommand
- Mini awk interpreter:
  - Tokenize program into rules: `[pattern] { action }`
  - Special patterns: `BEGIN`, `END`, `/regex/`, field comparisons (`$N op value`)
  - Actions: `print` statement with `$N` field references, string literals, `NR`, `NF`
  - Basic arithmetic: `+`, `-`, `*`, `/`, `+=` for accumulator patterns
  - Output separator: space by default (OFS)
- Process: run BEGIN rules, then for each line split by FS and run matching rules, then run END rules

### Step 3: Register, test, commit

```
feat(files): add awk command
```

---

## Task 7: Remaining Commands — `diff`, `tee`, `xargs`

**Files:**
- Create: `packages/plugins/files/src/lib/processors/cli-diff-command-processor.ts`
- Create: `packages/plugins/files/src/lib/processors/cli-tee-command-processor.ts`
- Create: `packages/plugins/files/src/lib/processors/cli-xargs-command-processor.ts`
- Create: `packages/plugins/files/src/tests/pipe-commands.spec.ts`
- Modify: `packages/plugins/files/src/lib/processors/index.ts`
- Modify: `packages/plugins/files/src/public-api.ts`

### Step 1: Write tests

**diff tests:**
- Compare two identical files → no output
- Compare two different files → show differences
- `-u` unified format with `---`/`+++`/`@@` headers
- `-i` ignore case differences
- Error on missing operand
- Error on nonexistent file

**tee tests:**
- `tee file.txt` with piped input → writes to file AND outputs to terminal
- Since no real piping, `tee` reads from a file argument: `tee outfile < infile` or use `command.pipedInput` if available
- `-a` append mode
- Multiple output files
- Error on missing operand

**xargs tests:**
- Basic: `xargs echo < file` → echo each line from file
- `-I {}` replace string: `xargs -I {} echo "Processing {}" < file`
- `-n 2` max args per invocation
- Error on missing command
- Since execution context has `executor`, use it to run commands

### Step 2: Implement processors

**`cli-diff-command-processor.ts`:**
- Read both files, split into lines
- Implement simple LCS-based diff algorithm
- Default output: `N{a,c,d}M` format with `<` and `>` markers
- `-u` unified: show `--- file1`, `+++ file2`, `@@ -start,count +start,count @@`, context lines with `-`/`+` prefixes
- `-i` compare lines case-insensitively
- Color: red for removals, green for additions (using `wrapInColor`)

**`cli-tee-command-processor.ts`:**
- `extendsProcessor = false`
- Read input from file (last arg or piped input via `command.pipedInput` if the framework supports it)
- Write to each specified output file (and terminal)
- `-a` append mode for files
- Call `fs.persist()` after writing

**`cli-xargs-command-processor.ts`:**
- Read input from file argument
- Split input into arguments (by newline or whitespace)
- `-I {}` replace placeholder in command template
- `-n N` group N args per execution
- Execute commands via `context.executor.executeCommands()` if available
- If executor not available, just output what would be executed

### Step 3: Register, test, commit

```
feat(files): add diff, tee, xargs commands
```

---

## Task 8: Final Integration & Cleanup

### Step 1: Run full test suite

Run: `npx nx test files`

Verify all tests pass (existing + new).

### Step 2: Run build

Run: `pnpm run build:affected`

Verify no TypeScript errors.

### Step 3: Run lint

Run: `npx nx lint files`

Fix any lint issues.

### Step 4: Final commit

```
chore(files): verify all new commands build and pass tests
```

---

## Summary: 17 New Commands in 8 Tasks

| Task | Commands | Complexity |
|------|----------|-----------|
| 1 | tac, basename, dirname | Simple |
| 2 | sort, uniq, cut, paste | Medium |
| 3 | tr | Medium |
| 4 | stat, chmod, du, ln | Medium |
| 5 | sed | Complex |
| 6 | awk | Complex |
| 7 | diff, tee, xargs | Medium-Complex |
| 8 | Integration & cleanup | Simple |
