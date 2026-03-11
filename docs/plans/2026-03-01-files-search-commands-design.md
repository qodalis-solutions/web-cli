# Files Plugin: Search & Find Commands

**Date:** 2026-03-01
**Status:** Approved
**Approach:** Basic string/regex matching (Approach A)

## Overview

Add 6 new commands to the files plugin: `grep`, `find`, `head`, `tail`, `wc`. All use existing `IFileSystemService` methods with no schema changes.

## Commands

### grep — Search file contents

```
grep [options] <pattern> <file|directory>
```

- Pattern parsed as JavaScript `RegExp`. Plain strings match as substring.
- With `-r` and a directory, recursively searches all files.
- Without `-r` on a directory, errors "Is a directory".
- Colored output: matched text in red, filename in magenta, line numbers in green.

| Flag | Description |
|------|-------------|
| `-i, --ignore-case` | Case-insensitive matching |
| `-r, -R, --recursive` | Recurse into directories |
| `-n, --line-number` | Show line numbers |
| `-c, --count` | Show only match count per file |
| `-l, --files-with-matches` | Show only filenames with matches |
| `-v, --invert-match` | Show non-matching lines |

### find — Search for files by name/type

```
find [path] [options]
```

- Path defaults to current directory.
- Walks filesystem tree recursively, prints matching paths.
- Glob wildcards in `-name`: `*` = any chars, `?` = single char (converted to regex).

| Flag | Description |
|------|-------------|
| `-name <pattern>` | Match filename (glob wildcards) |
| `-type f\|d` | Filter by type: `f`=file, `d`=directory |
| `-maxdepth <n>` | Limit directory depth |

### head — Show first N lines

```
head [-n count] <file>
```

- Default: 10 lines.
- Multiple files: print `==> filename <==` header before each.

### tail — Show last N lines

```
tail [-n count] <file>
```

- Default: 10 lines.
- Multiple files: print `==> filename <==` header before each.

### wc — Word/line/character count

```
wc [options] <file> [file2...]
```

- Default (no flags): lines, words, chars.
- Multiple files: per-file + total row.
- Aligned column output.

| Flag | Description |
|------|-------------|
| `-l, --lines` | Lines only |
| `-w, --words` | Words only |
| `-c, --chars` | Characters only |

## Architecture

- One processor file per command, following existing naming: `cli-<cmd>-command-processor.ts`
- Registered in `public-api.ts` alongside the existing 12 processors.
- Tab completion provider updated to include all new commands.
- No changes to `IFileSystemService` interface — uses existing `readFile`, `listDirectory`, `getNode`, `isDirectory`.

## Integration Tests

Integration tests at `src/lib/__tests__/` covering:
- grep: substring match, regex, `-i`, `-r`, `-n`, `-c`, `-l`, `-v`, missing file error
- find: by name glob, `-type`, `-maxdepth`, default path
- head/tail: default 10 lines, custom `-n`, file not found
- wc: default all counts, individual flags, multiple files with totals
