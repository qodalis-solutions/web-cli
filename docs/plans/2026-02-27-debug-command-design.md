# Debug Command Design

## Goal

Add a built-in `debug` system command to the CLI that exposes system internals: registered processors, modules, DI services, state stores, environment info, command history stats, and health checks. Hidden from `help` output but accessible when typed directly.

## Location

Built-in system command at `projects/cli/src/lib/processors/system/cli-debug-command-processor.ts`.

## Architecture

Root processor with child subcommand processors, following the same pattern as `pkg`, `guid`, etc.

### Subcommands

| Subcommand | Description |
|---|---|
| `debug` (no args) | Quick system summary: core/cli versions, framework, terminal size, processor count, module count |
| `debug processors` | All registered processors with command, aliases, version, module, author, sealed/hidden status, child count |
| `debug modules` | All loaded CLI modules with name, version, processor count, dependencies |
| `debug state` | All state stores and their current values via `ICliStateStoreManager` |
| `debug services` | All registered services in the DI container |
| `debug environment` | Browser userAgent, language, platform, terminal dimensions, framework, log level, CLI options |
| `debug history` | Command history stats: total count, unique commands, most used, last N commands |
| `debug health` | Storage availability (IndexedDB), server connectivity, processor initialization status |
| `debug export` | Full JSON dump of all sections for bug reports |

## Hidden from Help

- Add `hidden?: boolean` to `CliProcessorMetadata` in `projects/core/src/lib/models/index.ts`
- Filter hidden processors in help command's listing loop (`cli-help-command-processor.ts`)
- `help debug` still works when explicitly requested

## Output Style

- Structured data via `writeTable()` / `writeObjectsAsTable()`
- Section headers with colored labels matching CLI styling conventions
- `debug export` outputs raw JSON via `writeJson()`

## Files Changed

1. `projects/core/src/lib/models/index.ts` - Add `hidden?: boolean` to `CliProcessorMetadata`
2. `projects/cli/src/lib/processors/system/cli-help-command-processor.ts` - Filter hidden processors
3. `projects/cli/src/lib/processors/system/cli-debug-command-processor.ts` - New file: debug command
4. `projects/cli/src/lib/processors/system/index.ts` - Export and register debug processor
