# Qodalis CLI

> Qodalis CLI is a web terminal framework (xterm.js) for Angular, React, Vue and plain TypeScript, extended with plugins: web plugins (TypeScript `ICliModule`s from `@qodalis/cli-core` running in the browser) and server plugins (command processors for the Node.js, .NET and Python CLI servers).

Commands are registered through modules: a web plugin exports an `ICliModule` whose `processors` implement `ICliCommandProcessor`. Scaffold plugins with `npx @qodalis/create-cli-plugin`. AI assistants can use the `@qodalis/mcp-cli` MCP server (`claude mcp add qcli -- npx -y @qodalis/mcp-cli`) for docs search, API lookup and plugin scaffolding.

## Plugin development

- [llms-full.txt](https://cli.qodalis.com/llms-full.txt): Complete plugin development reference in one Markdown file (web plugins, server plugins, recipes)
- [Build plugins with AI](https://cli.qodalis.com/docs/ai-plugin-development): MCP developer tools, setup for Claude Code, example prompts
- [Create a plugin](https://cli.qodalis.com/docs/plugins/create-your-own): Scaffolding, structure, building and publishing a web plugin
- [Command processors](https://cli.qodalis.com/docs/core-concepts/command-processors): The `ICliCommandProcessor` interface
- [Execution context](https://cli.qodalis.com/docs/core-concepts/execution-context): What a command can access while it runs
- [Writer API](https://cli.qodalis.com/docs/core-concepts/writer-api): Terminal output helpers
- [Input reader](https://cli.qodalis.com/docs/core-concepts/input-reader): Interactive prompts

## Integration

- [Getting started](https://cli.qodalis.com/docs/getting-started): Install and embed the terminal per framework
- [Configuration](https://cli.qodalis.com/docs/configuration): `CliOptions`
- [Engine API](https://cli.qodalis.com/docs/engine-api): `CliEngine` for plain TypeScript
- [Server integration](https://cli.qodalis.com/docs/server-integration): Node.js, .NET and Python servers
- [Migration to 2.0](https://cli.qodalis.com/docs/migration): Removed and renamed APIs

## Optional

- [Plugins](https://cli.qodalis.com/docs/plugins): Official plugins (`@qodalis/cli-<name>`)
- [API reference](https://cli.qodalis.com/api/): TypeDoc for all packages
- [Source code](https://github.com/qodalis-solutions/web-cli): web-cli monorepo, `AGENTS.md` for contributors
