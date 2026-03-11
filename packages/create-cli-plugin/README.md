# @qodalis/create-cli-plugin

Scaffold new [Qodalis CLI](https://github.com/qodalis-solutions/web-cli) plugins with a single command.

## Usage

```bash
npx @qodalis/create-cli-plugin
```

Or install globally:

```bash
npm install -g @qodalis/create-cli-plugin
create-cli-plugin
```

### Interactive Mode

Run without arguments for interactive prompts:

```
$ npx @qodalis/create-cli-plugin
Creating a standalone plugin project.

? Plugin name (lowercase, e.g. "mylib"): weather
? Description: Weather forecasts for the CLI
? Processor class name (Cli___CommandProcessor): Weather

Scaffolding plugin in /home/user/qodalis-cli-weather...
  created qodalis-cli-weather/package.json
  created qodalis-cli-weather/tsup.config.ts
  ...

Installing dependencies...

Done!

Next steps:
  1. cd qodalis-cli-weather
  2. Implement your command in src/lib/processors/
  3. npx tsup
  4. npm publish --access public
```

### Non-Interactive Mode

Pass arguments directly:

```bash
npx @qodalis/create-cli-plugin --name weather --description "Weather forecasts" --processor-name Weather
```

## Two Modes

### Standalone (default)

Creates a fully independent npm project:

```
qodalis-cli-weather/
├── package.json          # @qodalis/cli-core as npm dependency
├── tsup.config.ts        # Builds CJS + ESM + IIFE bundle
├── tsconfig.json
├── .gitignore
├── README.md
└── src/
    ├── public-api.ts
    ├── cli-entrypoint.ts
    └── lib/
        ├── version.ts
        ├── index.ts
        └── processors/
            └── cli-weather-command-processor.ts
```

### Monorepo

When run inside the [web-cli monorepo](https://github.com/qodalis-solutions/web-cli), creates the plugin at `packages/plugins/<name>/` with:
- `workspace:*` dependencies
- Shared tsup config
- Nx project.json and test config
- Auto-updated tsconfig.base.json path aliases

## What Gets Generated

- **Command Processor** implementing `ICliCommandProcessor` from `@qodalis/cli-core`
- **CLI Module** for framework registration
- **Public API** barrel export
- **IIFE entrypoint** for runtime browser loading via `pkg add`
- **Test spec** with Jasmine
- **Build config** producing CJS, ESM, and IIFE bundles

## After Scaffolding

1. Implement your command logic in `src/lib/processors/`
2. Build: `npm run build` (or `npx tsup`)
3. Publish: `npm publish --access public`

Users install your plugin at runtime:

```bash
pkg add @qodalis/cli-weather
weather forecast --city "New York"
```

## License

MIT
