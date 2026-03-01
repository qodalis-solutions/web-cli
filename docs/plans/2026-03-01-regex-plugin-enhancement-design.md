# Regex Plugin Enhancement Design

## Goal

Bring `@qodalis/cli-regex` to feature parity with other plugins (guid, string) by adding all standard regex operations, proper parameters, aliases, structured output, and comprehensive tests.

## Current State

Single sub-command: `regex match <pattern> <text>` with no parameters, no aliases, no structured output.

## New Sub-Commands (6 total)

| Command | Aliases | Description |
|---------|---------|-------------|
| `regex match <pattern> <text>` | `find` | First match with position, groups, highlighting (enhanced) |
| `regex match-all <pattern> <text>` | `matches`, `find-all` | All matches with positions |
| `regex test <pattern> <text>` | `check`, `is-match` | Boolean match test |
| `regex replace <pattern> <replacement> <text>` | `sub`, `substitute` | Replace matches |
| `regex split <pattern> <text>` | — | Split text by pattern |
| `regex extract <pattern> <text>` | `groups`, `capture` | Extract capture groups (named + numbered) |

## Shared Parameters

| Parameter | Alias | Type | Default | Description |
|-----------|-------|------|---------|-------------|
| `--flags` | `-f` | string | varies | Regex flags (g, i, m, s, u) |
| `--case-insensitive` | `-i` | boolean | false | Shorthand for `i` flag |
| `--copy` | `-c` | boolean | false | Copy result to clipboard |

## Architecture

### Utilities (`src/lib/utilities/index.ts`)

- `parseFlags(args)` — merge `--flags` and `--case-insensitive` into flags string
- `createRegex(pattern, flags)` — safe RegExp construction with error handling
- `formatMatchResult(match)` — consistent match object formatting

### Output Pattern

All commands use `context.process.output()` for structured results + `context.writer` for human-readable display with highlighting.

### Error Handling

- Invalid regex → clear error with description
- Missing arguments → usage hint
- Invalid flags → list valid options

## Files Changed

- `src/lib/processors/cli-regex-command-processor.ts` — rewrite with all sub-commands
- `src/lib/utilities/index.ts` — new utilities file
- `src/lib/index.ts` — add utilities export
- `src/public-api.ts` — add utilities export
- `src/tests/index.spec.ts` — comprehensive functional tests
