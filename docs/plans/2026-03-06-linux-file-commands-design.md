# Design: Popular Linux File Commands for Files Plugin

## Date: 2026-03-06

## Overview

Add 17 popular Linux file commands to the `@qodalis/cli-files` plugin. Each command should behave similarly to its Linux counterpart, operating on the virtual in-memory filesystem (IFileSystemService).

## Existing Commands (17)

ls, cd, pwd, mkdir, rmdir, touch, cat, echo, rm, cp, mv, tree, head, tail, wc, find, grep

## New Commands (17)

### Text Processing (9)

| Command | Description | Key Flags |
|---------|-------------|-----------|
| `sed` | Stream editor for text substitution/deletion | `s/pattern/replace/flags`, `d` (delete), `-i` (in-place), `-n` (suppress output), `p` (print) |
| `awk` | Pattern scanning and text processing | `-F` (field separator), `print $N`, `BEGIN/END` blocks, basic pattern matching |
| `sort` | Sort lines of text | `-r` (reverse), `-n` (numeric), `-u` (unique), `-k` (key/field), `-t` (delimiter) |
| `uniq` | Filter/report duplicate lines | `-c` (count), `-d` (duplicates only), `-i` (ignore case), `-u` (unique only) |
| `cut` | Extract columns/fields from text | `-d` (delimiter), `-f` (fields), `-c` (characters) |
| `tr` | Translate/delete characters | `-d` (delete), `-s` (squeeze), character classes like `[:upper:]` `[:lower:]` |
| `tee` | Read stdin, write to file and stdout | `-a` (append) |
| `diff` | Compare files line by line | `-u` (unified format), `-i` (ignore case), `--color` |
| `paste` | Merge lines of files side by side | `-d` (delimiter), `-s` (serial/transpose) |

### File Info/Manipulation (5)

| Command | Description | Key Flags |
|---------|-------------|-----------|
| `chmod` | Change file permissions | Octal (755) and symbolic (u+x, g-w) modes |
| `stat` | Display file status/metadata | Shows name, size, type, permissions, timestamps |
| `ln` | Create symbolic links | `-s` (symbolic, default in virtual FS) |
| `basename` | Strip directory from path | Optional suffix removal |
| `dirname` | Strip last component from path | |
| `du` | Estimate file space usage | `-h` (human-readable), `-s` (summary), `-d` (max depth) |

### Other (2)

| Command | Description | Key Flags |
|---------|-------------|-----------|
| `xargs` | Build and execute commands from piped input | `-I {}` (replace string), `-n` (max args per command) |
| `tac` | Print file in reverse line order | |

## Architecture

### Pattern
Each command follows the existing processor pattern:
- Class implementing `ICliCommandProcessor`
- Access filesystem via `context.services.get<IFileSystemService>(IFileSystemService_TOKEN)`
- Parse args from `command.rawCommand`
- Output via `context.writer`
- Persist after write operations

### Filesystem Extensions Needed
- `IFileSystemService` needs no changes for most commands — they operate on file content strings
- `chmod` will modify the existing `permissions` field on `IFileNode`
- `ln` needs a new `symlink` field or `type: 'symlink'` support on `IFileNode` — will store target path in content
- `du` can compute sizes by traversing the tree

### Grouping
- **Text processing commands** (`sed`, `awk`, `sort`, `uniq`, `cut`, `tr`, `diff`, `paste`): Pure text operations on file content strings
- **Pipe-aware commands** (`tee`, `xargs`): Need to work with piped input if available, otherwise read from file
- **File metadata commands** (`chmod`, `stat`, `ln`, `basename`, `dirname`, `du`): Operate on file nodes/paths
- **Simple commands** (`tac`): Trivial reverse of file content

### Testing
- One test file per logical group (text-processing, file-metadata, pipe-commands)
- Tests follow existing pattern with `createStubWriter()`, `createMockContext()`, `makeCommand()`, `setupTestFs()`
- Cover: default behavior, all flags, error cases, edge cases

## Scope Limits
- `sed`: Support `s///` substitution (with `g`, `i` flags), line addressing (number, `$`, ranges), `d` (delete), `p` (print), `-n` suppress. No hold/pattern space commands.
- `awk`: Support field splitting, `print`, `$N` fields, `NR`/`NF` variables, `BEGIN`/`END`, basic conditionals (`if`/`else`), basic patterns. No associative arrays or complex functions.
- `xargs`: Support `-I` replace string and `-n` max args. No parallel execution.
- Pipe support: `tee` and `xargs` will check for piped input in the execution context; if unavailable, they read from file arguments.
