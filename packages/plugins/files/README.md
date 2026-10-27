# @qodalis/cli-files

A virtual file system with Linux-style file and text commands for the Qodalis CLI.

[![npm version](https://img.shields.io/npm/v/@qodalis/cli-files.svg)](https://www.npmjs.com/package/@qodalis/cli-files)
[![license](https://img.shields.io/npm/l/@qodalis/cli-files.svg)](https://github.com/qodalis-solutions/web-cli/blob/main/LICENSE)

## Install

```bash
npm install @qodalis/cli-files
```

Or install it at runtime in a running terminal:

```bash
pkg add files
```

## Usage

Register `filesModule` with your terminal.

```typescript
import { filesModule } from '@qodalis/cli-files';

// Angular (template)
// <cli [modules]="[filesModule]"></cli>

// Angular (DI, NgModule or application providers)
providers: [resolveCliModuleProvider(filesModule)];

// React
<Cli modules={[filesModule]} />

// Vue
<Cli :modules="[filesModule]" />

// Vanilla TypeScript (CliEngine from @qodalis/cli)
engine.registerModule(filesModule);
```

To hide the current directory in the prompt:

```typescript
filesModule.configure({ showPathInPrompt: false });
```

### Storage and integration

- Files live in the browser's IndexedDB (database `qodalis-cli-filesystem`) and survive reloads.
- Files dropped onto the terminal are written to the current directory as text.
- Paths complete with Tab.
- The module registers the file transfer service that other plugins (`wget`, `scp`) use to read and write local files.
- With an auth module such as `@qodalis/cli-users`, files get owners and rwx checks, and each user gets a home directory. The permissions `files:admin` (bypass checks) and `files:chown` (chmod/chown files owned by others) can be granted.
- The package also exports `ServerFileSystemService`, an `IFileSystemService` backed by a server's `/api/qcli/fs/*` API. `filesModule` itself always uses IndexedDB.

## Commands

Each command is a root command; run `help <command>` for full usage. Commands marked "pipe" also read piped input.

### Files and directories

| Command | Flags | Description |
|---|---|---|
| `ls [path]` | `-a`/`--all`, `-l`/`--long`, `-h`/`--human-readable` (with `-l`) | List directory contents |
| `cd [path]` | | Change the working directory |
| `pwd` | | Print the working directory |
| `tree [dir]` | `-L`/`--depth <n>` | Show the directory tree |
| `mkdir <dir...>` | `-p`/`--parents` | Create directories |
| `rmdir <dir...>` | | Remove empty directories |
| `touch <file...>` | | Create an empty file or update its timestamp |
| `cp <src> <dest>` | `-r`/`-R`/`--recursive`, `-f`/`--force` | Copy files and directories |
| `mv <src> <dest>` | | Move or rename |
| `rm <path...>` | `-r`/`-R`/`--recursive`, `-f`/`--force` | Remove files or directories |
| `ln -s <target> <link>` | `-s`, `-f`/`--force` | Create a symbolic link |
| `stat <path>` | | Show metadata |
| `du [path]` | `-h`, `-s`, `-d`/`--max-depth <n>` | Estimate space usage |
| `chmod <mode> <file...>` | `-R` | Change permissions (`644`, `u+x`, `go-w`) |
| `chown <owner> <file...>` | `-R` | Change owner and group |
| `find [path]` | `--name <glob>`, `--iname <glob>`, `--type f\|d`, `--maxdepth <n>` | Find files and directories |
| `basename <path>` | | Strip the directory part |
| `dirname <path>` | | Strip the last component |
| `upload` | `--accept <types>` | Pick a file from your machine and save it to the current directory |

### Reading and text processing

| Command | Flags | Description |
|---|---|---|
| `cat <file...>` | | Print files (pipe) |
| `echo <text> [> file \| >> file]` | | Print text, or write / append it to a file |
| `head [file]` | `-n`/`--lines <n>` (default 10) | First lines (pipe) |
| `tail [file]` | `-n`/`--lines <n>` (default 10) | Last lines (pipe) |
| `tac [file]` | | Lines in reverse order (pipe) |
| `wc [file]` | `-l`/`--lines`, `-w`/`--words`, `-c`/`--chars` | Count lines, words, characters (pipe) |
| `grep <pattern> [path...]` | `-i`, `-r`/`-R`, `-n`, `-c`, `-q`, `-l`, `-v`, `-w`, `-o`, `-E` | Search contents by regex (pipe) |
| `sort [file]` | `-r`, `-n`, `-u`, `-k`/`--key <n>`, `-t`/`--field-separator <sep>` | Sort lines (pipe) |
| `uniq [file]` | `-c`, `-d`, `-u`, `-i` | Filter adjacent duplicates (pipe) |
| `cut [file]` | `-d`/`--delimiter <sep>` (default tab), `-f`/`--fields <list>`, `-c`/`--characters <list>` | Extract fields or characters (pipe) |
| `paste <file...>` | `-d`/`--delimiters <sep>` (default tab), `-s`/`--serial` | Merge lines side by side (pipe) |
| `tr <set1> [set2]` | `-d`/`--delete`, `-s`/`--squeeze-repeats` | Translate or delete characters (pipe) |
| `sed '<script>' [file]` | `-i`/`--in-place`, `-n`/`--quiet`, `-e`/`--expression` (repeatable), `-E`/`-r` | Stream editor: `s`, `d`, `p`, `q` with line, range or regex addresses (pipe) |
| `awk '<program>' [file]` | `-F <sep>` | Fields `$1`, `$2`, ..., `BEGIN`/`END`, regex and comparison patterns (pipe) |
| `diff <file1> <file2>` | `-u`/`--unified`, `-i`/`--ignore-case` | Compare files line by line |
| `tee <file...>` | `-a`/`--append` | Copy piped input to files and to the output (pipe) |
| `xargs <cmd> [file]` | `-I`/`--replace <str>`, `-n`/`--max-args <n>` | Run a command with arguments from input (pipe) |

### Scripts

| Command | Aliases | Flags | Description |
|---|---|---|---|
| `sh <file>` | `source`, `.` | `-e`/`--stop-on-error` (default) | Run a script: `#` comments, `;`, variables, `set -e`/`set +e`, `exit`, `if`, `for`, `while`/`until`, `break`/`continue` |

```bash
mkdir -p projects/demo && cd projects/demo
echo "hello world" > notes.txt
echo "another line" >> notes.txt
ls -la
cat notes.txt | grep -n hello
grep -ri todo ~/projects
find . --name="*.txt" | xargs rm
sed -i 's/hello/hi/g' notes.txt
awk -F , '{print $2}' data.csv
sort -n numbers.txt | uniq -c
head -n 5 notes.txt
tree -L 2
chmod u+x script.sh && sh script.sh
diff -u old.txt new.txt
```

The `nano` editor is built into `@qodalis/cli` and edits files of this file system when the module is registered.

## Configuration

Module options, passed to `filesModule.configure()`:

| Option | Default | Description |
|---|---|---|
| `showPathInPrompt` | `true` | Show the current working directory in the prompt |

## Documentation

https://cli.qodalis.com/docs/plugins/files

## License

MIT
