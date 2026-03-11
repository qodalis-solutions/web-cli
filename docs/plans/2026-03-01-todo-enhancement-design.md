# Todo Plugin Enhancement Design

**Date:** 2026-03-01
**Status:** Approved

## Overview

Enhance `@qodalis/cli-todo` from a minimal CRUD todo list to a practical daily-use task manager with editing, toggle complete/uncomplete, due dates with natural language parsing, filtered listing with progress display, and confirmation for destructive operations.

## Data Model

```typescript
type TodoItem = {
    id: number;
    text: string;
    completed: boolean;
    createdAt: string;      // ISO date string
    completedAt?: string;   // ISO date string, set when toggled complete
    dueDate?: string;       // ISO date string
};
```

Backward compatible — existing todos without new fields still work.

## Commands

### Enhanced

- **`todo ls`** — Progress header `Todos (2/5 done)`, overdue in red, relative due dates. Params: `--pending`, `--completed`, `--overdue`.
- **`todo add <text>`** — New `--due` param with natural language support.
- **`todo rm`** — Confirmation prompt before `--all`.
- **`todo done <id>`** (alias: `complete`) — Sets `completedAt` timestamp.

### New

- **`todo edit <id> <new text>`** — Update text and/or `--due`.
- **`todo toggle <id>`** — Toggle complete/uncomplete.

## List Display

```
Todos (2/5 done)
  [ ] #1 - Buy groceries            due: tomorrow
  [x] #2 - Finish report            done
  [ ] #3 - Call dentist              overdue: 2 days ago
  [x] #4 - Send email               done
  [ ] #5 - Clean kitchen
```

## Natural Language Dates

Supported: `today`, `tomorrow`, `yesterday`, day names (`monday`-`sunday`), `next week`, `next month`, `YYYY-MM-DD`.

Display: "due: tomorrow", "due: in 3 days", "due: Mar 15", "overdue: 2 days ago", "due: today".

## File Structure

```
packages/plugins/todo/src/lib/
  utilities/
    index.ts              # parseDueDate, formatRelativeDate, TodoItem type
  processors/
    cli-todo-command-processor.ts   # rewritten
  completion/
    cli-todo-id-completion-provider.ts  # updated
```
