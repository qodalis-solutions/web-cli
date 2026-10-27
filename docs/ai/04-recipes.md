## Recipes

### Recipe: a complete web plugin end to end

Build, test and register a `dice` web plugin (`dice roll --sides 20 --count 2`) from scaffold to host app.

```bash
npx @qodalis/create-cli-plugin --name dice --description "Roll dice" --processor-name Dice
cd qodalis-cli-dice
```

```typescript
// src/lib/processors/cli-dice-command-processor.ts
import {
    CliProcessCommand,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { LIBRARY_VERSION } from '../version';

class DiceRollProcessor implements ICliCommandProcessor {
    command = 'roll';
    description = 'Roll one or more dice';
    acceptsRawInput = true;                                  // lets users type `--sides 20` as well as `--sides=20`
    parameters = [
        { name: 'sides', aliases: ['s'], description: 'Sides per die', required: false, type: 'number', defaultValue: 6,
          validator: (v: any) => (Number(v) >= 2 ? { valid: true } : { valid: false, message: 'at least 2 sides' }) },
        { name: 'count', aliases: ['c'], description: 'Number of dice', required: false, type: 'number', defaultValue: 1 },
    ];

    async processCommand(command: CliProcessCommand, context: ICliExecutionContext): Promise<void> {
        const sides = Number(command.args['sides'] ?? 6);       // defaultValue is not applied automatically
        const count = Number(command.args['count'] ?? 1);
        const rolls = Array.from({ length: count }, () => 1 + Math.floor(Math.random() * sides));
        context.writer.writeln(`${rolls.join(' ')}  (total ${rolls.reduce((a, b) => a + b, 0)})`);
        context.process.output(rolls);                           // pipe-able
    }
}

export class CliDiceCommandProcessor implements ICliCommandProcessor {
    command = 'dice';
    description = 'Roll dice';
    author = { name: 'Jane Doe', email: 'jane@example.com' };
    version = LIBRARY_VERSION;
    processors = [new DiceRollProcessor()];
    metadata = { icon: '🎲' };

    async processCommand(command: CliProcessCommand, context: ICliExecutionContext): Promise<void> {
        await context.executor.showHelp(command, context);
    }
}
```

```typescript
// src/public-api.ts (generated; module export)
import { ICliModule } from '@qodalis/cli-core';
import { CliDiceCommandProcessor } from './lib/processors/cli-dice-command-processor';
import { API_VERSION } from './lib/version';

export * from './lib/processors/cli-dice-command-processor';
export * from './lib/version';

export const diceModule: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-dice',
    processors: [new CliDiceCommandProcessor()],
    translations: { es: { 'cli.dice.description': 'Tirar dados' } },
};
```

```typescript
// src/tests/index.spec.ts
import { CliTestHarness } from '@qodalis/cli';
import { CliDiceCommandProcessor } from '../lib/processors/cli-dice-command-processor';

describe('dice', () => {
    it('rolls the requested number of dice', async () => {
        const harness = new CliTestHarness();
        harness.registerProcessor(new CliDiceCommandProcessor());
        const result = await harness.execute('dice roll --sides 6 --count 3');
        expect(result.data.length).toBe(3);
        expect(result.data.every((n: number) => n >= 1 && n <= 6)).toBe(true);
    });

    it('rejects one-sided dice', async () => {
        const harness = new CliTestHarness();
        harness.registerProcessor(new CliDiceCommandProcessor());
        const result = await harness.execute('dice roll --sides 1');
        expect(result.output).toContain('at least 2 sides');
    });
});
```

```bash
npx tsup                      # dist/public-api.{js,mjs,d.ts} + dist/umd/index.global.js
npm publish --access public   # then in any Qodalis terminal: pkg add @qodalis/cli-dice
```

```tsx
// Host app (React); Angular: providers: [resolveCliModuleProvider(diceModule)]
import { Cli } from '@qodalis/react-cli';
import { diceModule } from '@qodalis/cli-dice';

export const App = () => <Cli modules={[diceModule]} />;
```

- `CliTestHarness` comes from `@qodalis/cli` (add it as a dev dependency together with a test runner in a standalone project; the monorepo already runs Jasmine/Karma).
- The validator error is printed by the engine (`Invalid parameters:` + message), so the command never runs with bad input.

### Recipe: a server command used from the browser terminal

Add a `sysinfo` command to a Node CLI server and run it from a web terminal configured with that server.

```typescript
// server.ts (Node, Express): npm install @qodalis/cli-server-node @qodalis/cli-server-abstractions
import os from 'node:os';
import {
    CliCommandProcessor,
    CliProcessCommand,
    CliStructuredResponse,
} from '@qodalis/cli-server-abstractions';
import { createCliServer } from '@qodalis/cli-server-node';

class CliSysinfoCommandProcessor extends CliCommandProcessor {
    command = 'sysinfo';
    description = 'Server host information';

    async handleAsync(): Promise<string> {
        return `${os.hostname()} (${os.platform()})`;
    }

    async handleStructuredAsync(_: CliProcessCommand): Promise<CliStructuredResponse> {
        return {
            exitCode: 0,
            outputs: [
                {
                    type: 'key-value',
                    entries: [
                        { key: 'Host', value: os.hostname() },
                        { key: 'Platform', value: `${os.platform()} ${os.release()}` },
                        { key: 'CPUs', value: String(os.cpus().length) },
                        { key: 'Uptime', value: `${Math.round(os.uptime() / 60)} min` },
                    ],
                },
            ],
        };
    }
}

const { app } = createCliServer({
    allowedOrigins: ['http://localhost:4200'],          // the web app's origin (CORS + WebSocket upgrades)
    configure: (builder) => builder.addProcessor(new CliSysinfoCommandProcessor()),
});
app.listen(8047, () => console.log('CLI server on http://localhost:8047'));
```

```typescript
// Web app: tell the terminal about the server (CliOptions.servers)
import { CliOptions } from '@qodalis/cli-core';

export const options: CliOptions = {
    servers: [{ name: 'node', url: 'http://localhost:8047' }],
};
// Angular: <cli [options]="options"></cli>   React: <Cli options={options} />   Vue: <Cli :options="options" />
```

```bash
# in the browser terminal
sysinfo          # bare name (no local command named sysinfo)
node:sysinfo     # explicit server
server ls        # connected servers
```

- The same command in .NET: `cli.AddProcessor<CliSysinfoCommandProcessor>()` with a `CliCommandProcessor` subclass; in Python: `builder.add_processor(...)` with a `CliCommandProcessor` subclass (see the server plugin topics).
- Enable `mcp: true` in `createCliServer` to expose `sysinfo` as an MCP tool too.

### Recipe: a web plugin with an interactive prompt

A `signup` web command that asks for a name, a plan, extra options and confirmation, handling Ctrl+C at every step.

```typescript
import {
    CliProcessCommand,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';

export class CliSignupCommandProcessor implements ICliCommandProcessor {
    command = 'signup';
    description = 'Create an account interactively';

    async processCommand(_: CliProcessCommand, context: ICliExecutionContext): Promise<void> {
        const { reader, writer } = context;

        const email = await reader.readLine('Email: ', {
            placeholder: 'you@example.com',
            validate: (v) => (/^\S+@\S+\.\S+$/.test(v) ? null : 'Enter a valid email'),
        });
        if (email === null) return writer.writeWarning('Cancelled');

        const plan = await reader.readSelect('Plan:', [
            { label: 'Free', value: 'free', description: '1 project' },
            { label: 'Pro', value: 'pro', description: 'unlimited projects' },
        ], { default: 'free' });
        if (plan === null) return writer.writeWarning('Cancelled');

        const extras = await reader.readMultiSelect('Extras:', [
            { label: 'Newsletter', value: 'newsletter', checked: true },
            { label: 'Beta features', value: 'beta' },
        ]);
        if (extras === null) return writer.writeWarning('Cancelled');

        writer.writeKeyValue({ Email: email, Plan: plan, Extras: extras.join(', ') || '-' });
        const confirmed = await reader.readConfirm('Create the account?', true);
        if (!confirmed) return writer.writeWarning('Not created');

        context.spinner?.show('Creating account');
        try {
            await context.http.post('https://api.example.com/accounts', { email, plan, extras });
            context.spinner?.hide();
            writer.writeSuccess(`Account created for ${email}`);
        } catch (e) {
            context.spinner?.hide();
            writer.writeError(`Failed: ${e}`);
            context.process.exit(1);
        }
    }
}
```

```typescript
// test: queue answers in prompt order
const harness = new CliTestHarness();
harness.registerProcessor(new CliSignupCommandProcessor());
harness.setReaderResponses('ada@example.com', 'pro', ['beta'], false);
const result = await harness.execute('signup');
expect(result.output).toContain('ada@example.com');
expect(result.stderr.join('\n')).toContain('Not created');      // writeWarning goes to stderr
```

- Every `reader` method resolves `null` on Ctrl+C/Escape: check it before using the value.
- `readConfirm` resolves `boolean | null`; `!confirmed` treats abort as "no".
