# Server commands as rich as web commands

Date: 2026-11-12. Issues: web-cli#206, cli-server-dotnet#72, cli-server-node#57, cli-server-python#61.
Applies to the three servers (next server release) and web-cli (`@qodalis/cli-core`, `@qodalis/cli`).

## Problem

`GET /api/v1/qcli/commands` sends a command's name, description, version, parameters and sub-commands only. In the
web CLI a server command therefore shows one line of help, no examples, no aliases, and sits under a generic
`server:<name>` module with the 🖥 icon.

## Contract (same JSON names on every server; every field optional)

Command descriptor (root and sub-commands):

| Field | Type | Meaning |
|---|---|---|
| `aliases` | `string[]` | Other names of the command. The server resolves them too (`/execute`, streaming, MCP), so an alias works from any client |
| `examples` | `{ command, description? }[]` | Example command lines for help |
| `documentation` | `string` | Longer help text shown by `help <command>`: plain text, paragraphs separated by a blank line |
| `module` | `string` | The group the command is listed under in `help` (e.g. `weather`) |
| `icon` | `string` | One emoji for `help` |

Parameter descriptor:

| Field | Type | Meaning |
|---|---|---|
| `allowedValues` | `string[]` | The only values the parameter takes: shown in help, offered by Tab completion, checked by the web CLI before the command is sent (ignoring case), and an `enum` in the MCP tool's input schema |

Fields that are empty or absent are left out of the JSON. Older servers send none of them and older clients ignore
them.

Server API names: Node `aliases`, `examples`, `documentation`, `module`, `icon` on `ICliCommandProcessor` and
`allowedValues` on `ICliCommandParameterDescriptor`; Python `aliases`, `examples`, `documentation`, `module`, `icon`
and `allowed_values`; .NET `Aliases`, `Examples` (`CliCommandExample`), `Documentation`, `Module`, `Icon` and
`AllowedValues` (default interface members, so existing processors compile unchanged).

## Web CLI

- `ICliCommandParameterDescriptor.allowedValues` (core) works for every command, not only server ones: help lists
  them, and Tab completes them after `--name ` and `--name=`.
- The proxy processors map `aliases` (a namespaced command also answers to `<server>:<alias>`; a bare alias is only
  registered when no local command owns that name), `module` and `icon` (fallbacks: `server:<name>` and 🖥), and
  render `documentation` and `examples` through `writeDescription`, like web commands.
- Allowed values become a parameter validator, so a wrong value is refused before the request.
- Help names the server a command runs on ("Runs on server node") instead of the generic notice.

## Built-in and demo commands

Every server gives its built-in processors (echo, hash, http, base64, uuid, status, system) and the weather plugin
examples and documentation, and `allowedValues` where a parameter has a fixed set (hash `--algorithm`, ...).
