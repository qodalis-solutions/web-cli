# Design: Generic Tab-Completion System

**Date:** 2026-02-28
**Status:** Approved

## Overview

A generic, plugin-extensible tab-completion system for the CLI framework. Built-in command completion by default, with a provider interface that plugins can implement (e.g. files plugin completes file/folder names).

## Behavior (Bash-style)

1. **First Tab** — find completions for the current token. If one match, complete it fully (add space after commands, `/` after directories). If multiple matches, complete the common prefix.
2. **Second Tab** (when still ambiguous) — print all candidates below the prompt, then reprint prompt + current input.
3. **Any other key** — reset completion state.

## Core Interface

```typescript
// In @qodalis/cli-core

export const ICliCompletionProvider_TOKEN = 'cli-completion-provider';

export interface ICliCompletionProvider {
    /** Lower priority = checked first. Default providers: 100 (commands), 200 (params). */
    priority: number;

    /**
     * Return completions for the current input state.
     * @param context Completion context with parsed input info
     * @returns Completion candidates, or empty if this provider doesn't apply
     */
    getCompletions(context: ICliCompletionContext): string[] | Promise<string[]>;
}

export interface ICliCompletionContext {
    /** Full current line text */
    input: string;
    /** Cursor position in the line */
    cursor: number;
    /** The token being completed (word at cursor) */
    token: string;
    /** Index of the token in the tokenized input (0 = command, 1+ = args) */
    tokenIndex: number;
    /** All tokens in the input */
    tokens: string[];
}
```

## Completion Engine (in `cli` package)

`CliCompletionEngine` class:
- Holds sorted list of `ICliCompletionProvider[]`
- `complete(input, cursor)` → returns `{ candidates: string[], token: string, tokenStart: number }`
- Queries providers in priority order, uses first non-empty result
- Tracks state: `lastCandidates`, `tabCount` (reset on non-tab input)

## Default Providers (built into `cli`)

### CommandCompletionProvider (priority 100)
- When token is at index 0: complete from `registry.processors[].command` + aliases
- When token is at index 1+: complete from matched processor's `processors[].command` (sub-commands)

### ParameterCompletionProvider (priority 200)
- When token starts with `--` or `-`: complete from matched processor's `parameters[].name` / `aliases`

## Files Plugin Provider

### FilePathCompletionProvider (priority 50)
- Activates when the command is one of: `ls`, `cd`, `cat`, `cp`, `mv`, `rm`, `touch`, `mkdir`, `rmdir`, `tree`, `echo`
- Completes file/folder names from the virtual filesystem at the resolved path
- Directories get a trailing `/`
- Only completes for the appropriate argument position (e.g. paths, not flags)

## Registration Pattern

```typescript
// In any module
services: [
    {
        provide: ICliCompletionProvider_TOKEN,
        useValue: new FilePathCompletionProvider(fs),
        multi: true,
    },
]
```

The engine collects all providers at boot from the service container.

## Integration Points

1. `normalizeText()` — stop converting `\t` to spaces
2. `handleInput()` — intercept `\t`, delegate to `CliCompletionEngine`
3. On single match: replace token in `_currentLine`, update `cursorPosition`, call `refreshCurrentLine()`
4. On multiple matches + second tab: write candidates below using `writer.writeln()`, then `showPrompt()` + rewrite current line
5. Any non-tab input resets `tabCount`

## File Structure

```
projects/core/src/lib/interfaces/
  completion.ts              (ICliCompletionProvider, ICliCompletionContext, token)

projects/cli/src/lib/completion/
  cli-completion-engine.ts   (CliCompletionEngine)
  cli-command-completion-provider.ts
  cli-parameter-completion-provider.ts

projects/files/src/lib/completion/
  file-path-completion-provider.ts
```
