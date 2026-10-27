# @qodalis/cli-todo

Manage a task list with due dates in the Qodalis CLI.

[![npm version](https://img.shields.io/npm/v/@qodalis/cli-todo.svg)](https://www.npmjs.com/package/@qodalis/cli-todo)
[![license](https://img.shields.io/npm/l/@qodalis/cli-todo.svg)](https://github.com/qodalis-solutions/web-cli/blob/main/LICENSE)

## Install

```bash
npm install @qodalis/cli-todo
```

Or install it at runtime in a running terminal:

```bash
pkg add todo
```

## Usage

Register `todoModule` with your terminal.

```typescript
import { todoModule } from '@qodalis/cli-todo';

// Angular (template)
// <cli [modules]="[todoModule]"></cli>

// Angular (DI, NgModule or application providers)
providers: [resolveCliModuleProvider(todoModule)];

// React
<Cli modules={[todoModule]} />

// Vue
<Cli :modules="[todoModule]" />

// Vanilla TypeScript (CliEngine from @qodalis/cli)
engine.registerModule(todoModule);
```

Tasks are saved in the CLI state store, so they survive page reloads. The module also adds tab completion of task IDs for `edit`, `done`, `toggle` and `rm`.

## Commands

`todo`. Running `todo` alone prints the help.

| Command | Aliases | Description |
|---|---|---|
| `todo ls` | `list` | List tasks with a done/total count |
| `todo add <text>` | | Add a task |
| `todo edit <id> [text]` | | Change a task's text, due date or both |
| `todo done <id>` | `complete` | Mark a task as done |
| `todo toggle <id>` | | Switch a task between done and pending |
| `todo rm <id>` | `remove` | Remove a task |

| Flag | Alias | Applies to | Default | Description |
|---|---|---|---|---|
| `--pending` | | `ls` | `false` | Show only pending tasks |
| `--completed` | | `ls` | `false` | Show only completed tasks |
| `--overdue` | | `ls` | `false` | Show only overdue tasks |
| `--due` | | `add`, `edit` | | Due date; `none` removes it (`edit` only) |
| `--all` | `-a` | `rm` | `false` | Remove every task (always asks for confirmation) |

Due dates: `today`, `tomorrow`, `yesterday`, a day name (`monday` to `sunday`, the next one after today), `next week` (7 days), `next month`, or `YYYY-MM-DD`. Overdue tasks are shown in red and completed tasks are struck through.

```bash
todo add Buy groceries
todo add Submit report --due=tomorrow
todo add Pay rent --due=2026-03-15
todo ls --pending
todo edit 3 Buy organic groceries
todo edit 3 --due="next week"
todo edit 3 --due=none
todo done 1
todo toggle 2
todo rm 3
todo rm --all
```

## Configuration

Set with `configure set todo.<key> <value>` or the interactive `configure` menu.

| Key | Default | Description |
|---|---|---|
| `showCompletedFirst` | `false` | List completed tasks before pending ones in `todo ls` |
| `confirmBeforeDelete` | `false` | Ask for confirmation before `todo rm <id>` |

## Documentation

https://cli.qodalis.com/docs/plugins/todo

## License

MIT
