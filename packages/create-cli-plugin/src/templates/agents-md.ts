import { TemplateVars } from './types';

/** AGENTS.md for standalone plugins: how AI coding agents build, test and extend the plugin. */
export function agentsMdTemplate(vars: TemplateVars): string {
    const fence = '`'.repeat(3);
    const processorClass = `Cli${vars.processorName}CommandProcessor`;
    return `# AGENTS.md

\`@qodalis/cli-${vars.name}\` is a Qodalis CLI web plugin: ${vars.description}. It adds the \`${vars.name}\` command to Qodalis CLI browser terminals (Angular, React, Vue or vanilla TypeScript).

Full plugin API reference, with examples: https://cli.qodalis.com/llms-full.txt

## Commands

${fence}bash
pnpm install          # or npm install
pnpm run build        # tsup -> dist/public-api.{js,mjs,d.ts} and dist/umd/index.global.js
npm publish --access public
${fence}

No test runner is configured. \`src/tests/index.spec.ts\` uses Jasmine-style \`describe\`/\`it\`/\`expect\`. To run it, add a runner (for example vitest with \`globals: true\`). For command-level tests, add \`@qodalis/cli\` as a dev dependency and use \`CliTestHarness\`:

${fence}typescript
import { CliTestHarness } from '@qodalis/cli';
import { ${processorClass} } from '../lib/processors/${vars.processorFileName}';

const harness = new CliTestHarness();
harness.registerProcessor(new ${processorClass}());
const result = await harness.execute('${vars.name}');
// result.output, result.stderr, result.exitCode, result.data, result.tables, result.lists
${fence}

## Structure

| Path | Purpose |
|---|---|
| \`src/lib/processors/${vars.processorFileName}.ts\` | \`${processorClass}\`, which implements \`ICliCommandProcessor\` (command \`${vars.name}\`) |
| \`src/public-api.ts\` | Package exports, including \`${vars.name}Module: ICliModule\`, which host apps register |
| \`src/cli-entrypoint.ts\` | UMD entry: \`bootCliModule(module)\` so \`pkg add @qodalis/cli-${vars.name}\` works in a running terminal |
| \`src/lib/version.ts\` | \`LIBRARY_VERSION\` and \`API_VERSION\` (2) |
| \`tsup.config.ts\` | Library build (CJS, ESM, d.ts) and IIFE bundle (\`dist/umd\`, all dependencies bundled) |

When you add a processor, put it in the module's \`processors\` array in **both** \`src/public-api.ts\` and \`src/cli-entrypoint.ts\`.

## Key APIs (from \`@qodalis/cli-core\`)

- \`ICliModule\`: \`apiVersion\` (must be \`API_VERSION\`), \`name\`, \`processors\`, \`services\`, \`translations\`, \`guards\`, \`permissions\`, and the \`onInit\`, \`onAfterBoot\` and \`onDestroy\` hooks.
- \`ICliCommandProcessor\`: \`command\`, \`description\`, \`parameters\`, \`processors\` (sub-commands), \`acceptsRawInput\`/\`valueRequired\`, \`metadata\`, \`stateConfiguration\`, \`processCommand(command, context)\`.
- \`CliProcessCommand\`: \`args\` (flags), \`positionals\` (shell-split arguments), \`value\`, \`data\` (piped input).
- \`ICliExecutionContext\`: \`writer\` (output), \`reader\` (prompts; every method returns \`null\` when the user cancels), \`state\`, \`http\`, \`spinner\`, \`progressBar\`, \`services\`, \`translator\`, \`process.exit(code)\` and \`process.output(data)\`.

## Rules

- Register commands only through the module. Do not use \`registerProcessor\`, \`resolveCommandProcessorProvider\` or a \`processors\` prop: they were removed in 2.0.0-rc.1.
- Depend only on \`@qodalis/cli-core\` at runtime, never on Angular, React or Vue.
- Write output with \`context.writer\`, not \`console.log\`. Make HTTP requests with \`context.http\`, which is aborted on Ctrl+C.
- \`defaultValue\` on a parameter is only shown in help. Apply defaults yourself: \`command.args['x'] ?? fallback\`.
- Build before you report a change as done.
`;
}
