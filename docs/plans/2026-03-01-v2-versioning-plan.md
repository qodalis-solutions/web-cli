# v2 Versioning Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enforce plugin versioning (apiVersion + semver ranges), dependency graph resolution, URL-path backend API versioning, and frontend auto-negotiation across the Qodalis CLI ecosystem.

**Architecture:** Dual-layer versioning on the frontend (hard `apiVersion` break + semver range enforcement on `requiredCoreVersion`/`requiredCliVersion`). Topological sort for plugin dependency resolution. URL-path versioned REST/WebSocket endpoints on all three backend implementations (.NET, Node.js, Python) with a discovery endpoint for auto-negotiation.

**Tech Stack:** TypeScript (web-cli monorepo, tsup/ng-packagr), .NET 8 / ASP.NET Core (cli-server-dotnet), Node.js / Express (cli-server-node), Python / FastAPI (cli-server-python), semver npm package.

**Backend Repos:**
- `cli-server-dotnet/` — .NET 8, ASP.NET Core, NuGet packages (v1.0.0-beta.1)
- `cli-server-node/` — Express + ws, TypeScript (v1.0.0-beta.1)
- `cli-server-python/` — FastAPI + uvicorn + websockets, Python 3.10+ (v1.0.0b1)

---

## Task 1: Add `semver` dependency to web-cli workspace

**Files:**
- Modify: `web-cli/package.json`

**Step 1: Install semver**

Run:
```bash
cd /Users/nicolaelupei/Documents/Personal/web-cli && pnpm add semver -w && pnpm add -D @types/semver -w
```

**Step 2: Verify installation**

Run: `pnpm ls semver`
Expected: `semver` listed in dependencies

**Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add semver dependency for version range checking"
```

---

## Task 2: Add `apiVersion` to `ICliModule` interface

**Files:**
- Modify: `packages/core/src/lib/interfaces/index.ts:386-425` (ICliModule definition)

**Step 1: Write the failing test**

Create: `packages/core/src/tests/api-version.spec.ts`

```typescript
import { ICliModule } from '../lib/interfaces';

describe('ICliModule apiVersion', () => {
    it('should require apiVersion field on module', () => {
        const module: ICliModule = {
            apiVersion: 2,
            name: '@qodalis/test-module',
            processors: [],
        };
        expect(module.apiVersion).toBe(2);
    });

    it('should accept apiVersion 1 for legacy detection', () => {
        const module: ICliModule = {
            apiVersion: 1,
            name: '@qodalis/legacy-module',
            processors: [],
        };
        expect(module.apiVersion).toBe(1);
    });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/nicolaelupei/Documents/Personal/web-cli && npx jest packages/core/src/tests/api-version.spec.ts --no-cache`
Expected: FAIL — `apiVersion` does not exist on type `ICliModule`

**Step 3: Add `apiVersion` to `ICliModule`**

In `packages/core/src/lib/interfaces/index.ts`, add to the `ICliModule` interface (after `name`):

```typescript
export interface ICliModule {
    /**
     * API version this module targets.
     * Modules with apiVersion < 2 (or missing) are rejected by v2 runtimes.
     */
    apiVersion: number;

    /** Unique module identifier, e.g. '@qodalis/cli-guid' */
    name: string;
    // ... rest unchanged
}
```

**Step 4: Run test to verify it passes**

Run: `npx jest packages/core/src/tests/api-version.spec.ts --no-cache`
Expected: PASS

**Step 5: Fix all existing ICliModule usages**

Every place that creates an `ICliModule` literal must now include `apiVersion: 2`. Known locations:

- `packages/plugins/guid/src/cli-entrypoint.ts` — add `apiVersion: 2`
- `packages/plugins/guid/src/public-api.ts` — add `apiVersion: 2`
- Every other plugin's `cli-entrypoint.ts` and `public-api.ts` (14 plugins total)
- `packages/cli/src/lib/services/cli-boot.ts` — the `buildCoreModule()` method
- `packages/core/src/lib/modules/index.ts` — if any module literals exist
- `packages/angular-cli/` — any module literals

For each file, add `apiVersion: 2` to the module literal.

**Step 6: Build to verify no type errors**

Run: `cd /Users/nicolaelupei/Documents/Personal/web-cli && pnpm run build:core`
Expected: BUILD SUCCESS

**Step 7: Commit**

```bash
git add -A
git commit -m "feat(core): add required apiVersion field to ICliModule"
```

---

## Task 3: Evolve `version.ts` to export `API_VERSION`

**Files:**
- Modify: `tools/inject-versions.js` (lines 34-52, the `writeVersionFile` function)
- Modify: `tools/create-library.js` (lines 150-156, the version.ts template)
- All generated `version.ts` files will be updated on next `inject-versions` run

**Step 1: Update `inject-versions.js`**

In the `writeVersionFile` function, change the template:

```javascript
function writeVersionFile(packageDir, lib) {
    const packageJsonPath = path.join(packageDir, "package.json");
    const versionFilePath = path.join(packageDir, "src", "lib", "version.ts");

    const packageJson = require(packageJsonPath);
    const version = packageJson.version;
    const majorVersion = parseInt(version.split('.')[0], 10);

    const versionFileContent = `
// Automatically generated during build
export const LIBRARY_VERSION = '${version}';
export const API_VERSION = ${majorVersion};
  `;

    const versionDir = path.dirname(versionFilePath);
    if (!fs.existsSync(versionDir)) {
        console.log(`Skipping ${lib} (no src/lib/ directory)`);
        return;
    }

    fs.writeFileSync(versionFilePath, versionFileContent, {
        encoding: "utf8",
    });
    console.log(`Version ${version} (API v${majorVersion}) written to ${versionFilePath}`);
}
```

**Step 2: Update `create-library.js` template**

Change the version.ts template section:

```javascript
await createFile(
    projectDirectory + "/src/lib/version.ts",
    `
// Automatically generated during build
export const LIBRARY_VERSION = '${version}';
export const API_VERSION = ${parseInt(version.split('.')[0], 10)};
    `,
);
```

**Step 3: Run inject-versions**

Run: `cd /Users/nicolaelupei/Documents/Personal/web-cli && pnpm run inject-versions`
Expected: All version.ts files updated with `API_VERSION` constant

**Step 4: Verify a generated file**

Read `packages/plugins/guid/src/lib/version.ts` and confirm it contains:
```typescript
export const LIBRARY_VERSION = '2.0.1';
export const API_VERSION = 2;
```

**Step 5: Commit**

```bash
git add tools/inject-versions.js tools/create-library.js packages/*/src/lib/version.ts packages/plugins/*/src/lib/version.ts
git commit -m "feat: generate API_VERSION in version.ts from major version"
```

---

## Task 4: Update all plugin module definitions with `apiVersion`

**Files:**
- Modify: All 14 plugins' `cli-entrypoint.ts` and `public-api.ts`

**Step 1: Update each plugin's `cli-entrypoint.ts`**

Pattern for every plugin (example: guid):

```typescript
import { bootCliModule, ICliModule } from '@qodalis/cli-core';
import { CliGuidCommandProcessor } from './lib';
import { API_VERSION } from './lib/version';

const module: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-guid',
    processors: [new CliGuidCommandProcessor()],
};

bootCliModule(module);
```

Apply to all 14 plugins:
- `packages/plugins/guid/src/cli-entrypoint.ts`
- `packages/plugins/regex/src/cli-entrypoint.ts`
- `packages/plugins/text-to-image/src/cli-entrypoint.ts`
- `packages/plugins/speed-test/src/cli-entrypoint.ts`
- `packages/plugins/browser-storage/src/cli-entrypoint.ts`
- `packages/plugins/string/src/cli-entrypoint.ts`
- `packages/plugins/todo/src/cli-entrypoint.ts`
- `packages/plugins/curl/src/cli-entrypoint.ts`
- `packages/plugins/password-generator/src/cli-entrypoint.ts`
- `packages/plugins/server-logs/src/cli-entrypoint.ts`
- `packages/plugins/qr/src/cli-entrypoint.ts`
- `packages/plugins/files/src/cli-entrypoint.ts`
- `packages/plugins/users/src/cli-entrypoint.ts`
- `packages/plugins/yesno/src/cli-entrypoint.ts`

**Step 2: Update each plugin's `public-api.ts`**

Same pattern — add `apiVersion: API_VERSION` import and field. Example for guid:

```typescript
import { ICliModule } from '@qodalis/cli-core';
import { CliGuidCommandProcessor } from './lib/processors/cli-guid-command-processor';
import { API_VERSION } from './lib/version';

export const guidModule: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-guid',
    processors: [new CliGuidCommandProcessor()],
};
```

**Step 3: Build all plugins**

Run: `cd /Users/nicolaelupei/Documents/Personal/web-cli && pnpm run build`
Expected: All 23 projects build successfully

**Step 4: Commit**

```bash
git add packages/plugins/*/src/cli-entrypoint.ts packages/plugins/*/src/public-api.ts
git commit -m "feat(plugins): set apiVersion from generated API_VERSION constant"
```

---

## Task 5: Replace custom version utils with `semver` and add range checking

**Files:**
- Modify: `packages/core/src/lib/utils/version-utils.ts`
- Test: `packages/core/src/tests/version-utils.spec.ts`

**Step 1: Write failing tests for semver range support**

Create or update `packages/core/src/tests/version-utils.spec.ts`:

```typescript
import { satisfiesVersionRange, satisfiesMinVersion, compareVersions } from '../lib/utils/version-utils';

describe('version-utils', () => {
    describe('compareVersions (backward compat)', () => {
        it('should compare dotted versions', () => {
            expect(compareVersions('2.0.0', '1.0.0')).toBe(1);
            expect(compareVersions('1.0.0', '2.0.0')).toBe(-1);
            expect(compareVersions('2.0.0', '2.0.0')).toBe(0);
        });
    });

    describe('satisfiesMinVersion (backward compat)', () => {
        it('should return true when installed >= required', () => {
            expect(satisfiesMinVersion('2.0.1', '2.0.0')).toBe(true);
        });
        it('should return false when installed < required', () => {
            expect(satisfiesMinVersion('1.9.0', '2.0.0')).toBe(false);
        });
    });

    describe('satisfiesVersionRange', () => {
        it('should satisfy a caret range', () => {
            expect(satisfiesVersionRange('2.0.1', '>=2.0.0 <3.0.0')).toBe(true);
        });
        it('should reject outside range', () => {
            expect(satisfiesVersionRange('3.0.0', '>=2.0.0 <3.0.0')).toBe(false);
        });
        it('should handle simple min version string as >=', () => {
            expect(satisfiesVersionRange('2.1.0', '2.0.0')).toBe(true);
        });
        it('should return true if no range specified', () => {
            expect(satisfiesVersionRange('2.0.0', undefined)).toBe(true);
        });
    });
});
```

**Step 2: Run tests to verify failure**

Run: `npx jest packages/core/src/tests/version-utils.spec.ts --no-cache`
Expected: FAIL — `satisfiesVersionRange` not found

**Step 3: Implement `satisfiesVersionRange`**

Update `packages/core/src/lib/utils/version-utils.ts`:

```typescript
import semver from 'semver';

/**
 * Compares two dotted version strings.
 * Returns -1 if a < b, 0 if equal, 1 if a > b.
 */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
    const result = semver.compare(semver.coerce(a)!, semver.coerce(b)!);
    return result as -1 | 0 | 1;
}

/**
 * Returns true if the installed version satisfies the minimum required version.
 */
export function satisfiesMinVersion(installed: string, required: string): boolean {
    return compareVersions(installed, required) >= 0;
}

/**
 * Returns true if the installed version satisfies the given semver range.
 * If range is undefined/empty, returns true (no constraint).
 * If range looks like a plain version (no operators), treats it as >= that version.
 */
export function satisfiesVersionRange(installed: string, range: string | undefined): boolean {
    if (!range) return true;

    const coerced = semver.coerce(installed);
    if (!coerced) return false;

    // If the range is a plain version string (e.g. "2.0.0"), treat as >=
    if (semver.valid(range)) {
        return semver.gte(coerced, semver.coerce(range)!);
    }

    return semver.satisfies(coerced, range);
}
```

**Step 4: Run tests**

Run: `npx jest packages/core/src/tests/version-utils.spec.ts --no-cache`
Expected: PASS

**Step 5: Export from core public API**

Ensure `satisfiesVersionRange` is exported from `packages/core/src/public-api.ts`.

**Step 6: Build core**

Run: `pnpm run build:core`
Expected: SUCCESS

**Step 7: Commit**

```bash
git add packages/core/src/lib/utils/version-utils.ts packages/core/src/tests/version-utils.spec.ts packages/core/src/public-api.ts
git commit -m "feat(core): add semver range checking via satisfiesVersionRange"
```

---

## Task 6: Enforce `apiVersion` check in CliBoot

**Files:**
- Modify: `packages/cli/src/lib/services/cli-boot.ts` (boot method ~line 39, bootModule ~line 83)
- Test: `packages/cli/src/tests/cli-boot-versioning.spec.ts`

**Step 1: Write failing test**

```typescript
import { ICliModule } from '@qodalis/cli-core';

// Test the apiVersion filtering logic (unit test the function, not the full boot)
describe('CliBoot apiVersion enforcement', () => {
    function isModuleCompatible(module: ICliModule, requiredApiVersion: number): boolean {
        const moduleApiVersion = (module as any).apiVersion;
        return typeof moduleApiVersion === 'number' && moduleApiVersion >= requiredApiVersion;
    }

    it('should accept v2 module in v2 runtime', () => {
        const mod: ICliModule = { apiVersion: 2, name: 'test', processors: [] };
        expect(isModuleCompatible(mod, 2)).toBe(true);
    });

    it('should reject v1 module in v2 runtime', () => {
        const mod = { apiVersion: 1, name: 'legacy' } as ICliModule;
        expect(isModuleCompatible(mod, 2)).toBe(false);
    });

    it('should reject module with missing apiVersion', () => {
        const mod = { name: 'old' } as any as ICliModule;
        expect(isModuleCompatible(mod, 2)).toBe(false);
    });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest packages/cli/src/tests/cli-boot-versioning.spec.ts --no-cache`
Expected: FAIL or PASS (this is a pure logic test, may pass immediately — the real work is integrating into CliBoot)

**Step 3: Modify CliBoot.boot() to filter modules by apiVersion**

In `packages/cli/src/lib/services/cli-boot.ts`, in the `boot()` method, after collecting modules and before topological sort:

```typescript
// Import at top of file
import { API_VERSION } from '../version';

// In boot() method, before topological sort:
const compatible = modules.filter((module) => {
    const modApiVersion = (module as any).apiVersion;
    if (typeof modApiVersion !== 'number' || modApiVersion < API_VERSION) {
        context.writer.writeWarning(
            `Plugin "${module.name}" targets API version ${modApiVersion ?? 'unknown'}, ` +
            `but this runtime requires API version ${API_VERSION}. Skipping. ` +
            `See https://qodalis.com/docs/upgrade-v2`,
        );
        return false;
    }
    return true;
});

const sorted = this.topologicalSort(compatible, context);
```

**Step 4: Update `filterByVersion` to use semver ranges**

In the same file, update the `filterByVersion` method to use `satisfiesVersionRange`:

```typescript
import { satisfiesVersionRange } from '@qodalis/cli-core';

private filterByVersion(
    processors: ICliCommandProcessor[],
    context: CliExecutionContext,
): ICliCommandProcessor[] {
    return processors.filter((p) => {
        const meta = p.metadata;
        if (meta?.requiredCoreVersion && !satisfiesVersionRange(CORE_VERSION, meta.requiredCoreVersion)) {
            context.writer.writeWarning(
                `Plugin "${p.command}" requires cli-core ${meta.requiredCoreVersion} but ${CORE_VERSION} is installed. Skipping.`,
            );
            return false;
        }
        if (meta?.requiredCliVersion && !satisfiesVersionRange(CLI_VERSION, meta.requiredCliVersion)) {
            context.writer.writeWarning(
                `Plugin "${p.command}" requires cli ${meta.requiredCliVersion} but ${CLI_VERSION} is installed. Skipping.`,
            );
            return false;
        }
        return true;
    });
}
```

**Step 5: Build and test**

Run: `pnpm run build:core && pnpm run build:cli`
Expected: SUCCESS

**Step 6: Commit**

```bash
git add packages/cli/src/lib/services/cli-boot.ts packages/cli/src/tests/cli-boot-versioning.spec.ts
git commit -m "feat(cli): enforce apiVersion check and semver ranges at boot"
```

---

## Task 7: Enforce `apiVersion` in dynamic UMD module loading

**Files:**
- Modify: `packages/core/src/lib/modules/cli-module-registry.ts`
- Modify: `packages/core/src/lib/modules/index.ts` (bootCliModule)

**Step 1: Add apiVersion check to `CliModuleRegistry.register()`**

In `packages/core/src/lib/modules/cli-module-registry.ts`:

```typescript
import { API_VERSION } from '../version';

async register(module: ICliModule): Promise<void> {
    const modApiVersion = (module as any).apiVersion;
    if (typeof modApiVersion !== 'number' || modApiVersion < API_VERSION) {
        console.warn(
            `[CLI] Plugin "${module.name}" targets API version ${modApiVersion ?? 'unknown'}, ` +
            `but this runtime requires API version ${API_VERSION}. Skipping.`,
        );
        return;
    }

    this.modules.set(module.name, module);
    for (const handler of this.bootHandlers) {
        await handler(module);
    }
}
```

**Step 2: Build core**

Run: `pnpm run build:core`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add packages/core/src/lib/modules/cli-module-registry.ts
git commit -m "feat(core): enforce apiVersion in dynamic UMD module registration"
```

---

## Task 8: Implement dependency graph topological sort

**Files:**
- Modify: `packages/cli/src/lib/services/cli-boot.ts` (the `topologicalSort` method)
- Test: `packages/cli/src/tests/topological-sort.spec.ts`

**Step 1: Write failing test**

```typescript
import { ICliModule } from '@qodalis/cli-core';

// Extract and test the topological sort logic
function topologicalSort(modules: ICliModule[]): ICliModule[] {
    const moduleMap = new Map(modules.map((m) => [m.name, m]));
    const visited = new Set<string>();
    const sorted: ICliModule[] = [];
    const visiting = new Set<string>();

    function visit(name: string): void {
        if (visited.has(name)) return;
        if (visiting.has(name)) {
            throw new Error(`Circular dependency detected: ${name}`);
        }

        const mod = moduleMap.get(name);
        if (!mod) return; // dependency not loaded — handled elsewhere

        visiting.add(name);
        for (const dep of mod.dependencies ?? []) {
            visit(dep);
        }
        visiting.delete(name);
        visited.add(name);
        sorted.push(mod);
    }

    for (const mod of modules) {
        visit(mod.name);
    }

    return sorted;
}

describe('topologicalSort', () => {
    it('should sort modules with no dependencies', () => {
        const a: ICliModule = { apiVersion: 2, name: 'a', processors: [] };
        const b: ICliModule = { apiVersion: 2, name: 'b', processors: [] };
        const result = topologicalSort([a, b]);
        expect(result).toHaveLength(2);
    });

    it('should put dependency before dependent', () => {
        const core: ICliModule = { apiVersion: 2, name: 'core', processors: [] };
        const plugin: ICliModule = { apiVersion: 2, name: 'plugin', dependencies: ['core'], processors: [] };
        const result = topologicalSort([plugin, core]);
        expect(result[0].name).toBe('core');
        expect(result[1].name).toBe('plugin');
    });

    it('should throw on circular dependency', () => {
        const a: ICliModule = { apiVersion: 2, name: 'a', dependencies: ['b'], processors: [] };
        const b: ICliModule = { apiVersion: 2, name: 'b', dependencies: ['a'], processors: [] };
        expect(() => topologicalSort([a, b])).toThrow('Circular dependency');
    });

    it('should handle deep dependency chains', () => {
        const a: ICliModule = { apiVersion: 2, name: 'a', processors: [] };
        const b: ICliModule = { apiVersion: 2, name: 'b', dependencies: ['a'], processors: [] };
        const c: ICliModule = { apiVersion: 2, name: 'c', dependencies: ['b'], processors: [] };
        const result = topologicalSort([c, a, b]);
        expect(result.map((m) => m.name)).toEqual(['a', 'b', 'c']);
    });
});
```

**Step 2: Run test**

Run: `npx jest packages/cli/src/tests/topological-sort.spec.ts --no-cache`
Expected: PASS (this tests the algorithm directly)

**Step 3: Replace existing `topologicalSort` in CliBoot**

In `packages/cli/src/lib/services/cli-boot.ts`, replace the existing `topologicalSort` method with the algorithm above, adding warning output for missing dependencies.

**Step 4: Build**

Run: `pnpm run build:cli`
Expected: SUCCESS

**Step 5: Commit**

```bash
git add packages/cli/src/lib/services/cli-boot.ts packages/cli/src/tests/topological-sort.spec.ts
git commit -m "feat(cli): implement Kahn's topological sort for module dependency resolution"
```

---

## Task 9: Add `ApiVersion` to .NET `ICliCommandProcessor`

**Files:**
- Modify: `cli-server-dotnet/src/Qodalis.Cli.Abstractions/ICliCommandProcessor.cs`
- Modify: `cli-server-dotnet/src/Qodalis.Cli/CliCommandProcessor.cs` (base class)

**Step 1: Add `ApiVersion` property to interface**

In `ICliCommandProcessor.cs`, add:

```csharp
/// <summary>
/// The API version this processor targets. Default is 1 for backward compatibility.
/// </summary>
int ApiVersion { get; }
```

**Step 2: Add default in base class**

In `CliCommandProcessor.cs`, add:

```csharp
public virtual int ApiVersion { get; set; } = 1;
```

**Step 3: Build**

Run: `cd /Users/nicolaelupei/Documents/Personal/cli-server-dotnet && dotnet build src/Qodalis.Cli.sln`
Expected: SUCCESS

**Step 4: Commit**

```bash
cd /Users/nicolaelupei/Documents/Personal/cli-server-dotnet
git add -A
git commit -m "feat(abstractions): add ApiVersion property to ICliCommandProcessor"
```

---

## Task 10: Add URL-path versioned controllers to .NET backend

**Files:**
- Modify: `cli-server-dotnet/src/Qodalis.Cli/Controllers/CliController.cs`
- Create: `cli-server-dotnet/src/Qodalis.Cli/Controllers/CliControllerV2.cs`
- Modify: `cli-server-dotnet/src/Qodalis.Cli/Models/CliServerCommandDescriptor.cs`

**Step 1: Rename existing controller route to v1**

In `CliController.cs`, change:
```csharp
[Route("api/cli")]
```
to:
```csharp
[Route("api/v1/cli")]
```

**Step 2: Create v2 controller**

Create `cli-server-dotnet/src/Qodalis.Cli/Controllers/CliControllerV2.cs`:

```csharp
using Microsoft.AspNetCore.Mvc;
using Qodalis.Cli.Abstractions;
using Qodalis.Cli.Models;
using Qodalis.Cli.Services;

namespace Qodalis.Cli.Controllers;

[ApiController]
[Route("api/v2/cli")]
public class CliControllerV2 : ControllerBase
{
    private readonly ICliCommandRegistry _registry;
    private readonly ICliCommandExecutorService _executor;

    public CliControllerV2(
        ICliCommandRegistry registry,
        ICliCommandExecutorService executor)
    {
        _registry = registry;
        _executor = executor;
    }

    [HttpGet("version")]
    public IActionResult GetVersion()
    {
        return Ok(new { ApiVersion = 2, ServerVersion = "2.0.0" });
    }

    [HttpGet("commands")]
    public IActionResult GetCommands()
    {
        var descriptors = _registry.Processors
            .Where(p => p.ApiVersion >= 2)
            .Select(MapToDescriptor)
            .ToList();
        return Ok(descriptors);
    }

    [HttpPost("execute")]
    public async Task<IActionResult> ExecuteAsync(
        [FromBody] CliProcessCommand command,
        CancellationToken cancellationToken)
    {
        var response = await _executor.ExecuteAsync(command, cancellationToken);
        return Ok(response);
    }

    private static CliServerCommandDescriptor MapToDescriptor(ICliCommandProcessor p) =>
        new()
        {
            Command = p.Command,
            Description = p.Description,
            Version = p.Version,
            ApiVersion = p.ApiVersion,
            Parameters = p.Parameters?.Select(param => new CliCommandParameterDescriptorDto
            {
                Name = param.Name,
                Description = param.Description,
                Type = param.Type,
                Required = param.Required,
                DefaultValue = param.DefaultValue,
                Aliases = param.Aliases,
            }).ToList(),
            Processors = p.Processors?.Select(MapToDescriptor).ToList(),
        };
}
```

**Step 3: Add `ApiVersion` to `CliServerCommandDescriptor`**

In `CliServerCommandDescriptor.cs`:

```csharp
public int? ApiVersion { get; set; }
```

**Step 4: Build**

Run: `dotnet build src/Qodalis.Cli.sln`
Expected: SUCCESS

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add URL-path versioned v1/v2 controllers"
```

---

## Task 11: Add version discovery endpoint

**Files:**
- Create: `cli-server-dotnet/src/Qodalis.Cli/Controllers/CliVersionController.cs`

**Step 1: Create unversioned discovery controller**

```csharp
using Microsoft.AspNetCore.Mvc;

namespace Qodalis.Cli.Controllers;

[ApiController]
[Route("api/cli")]
public class CliVersionController : ControllerBase
{
    [HttpGet("versions")]
    public IActionResult GetVersions()
    {
        return Ok(new
        {
            SupportedVersions = new[] { 1, 2 },
            PreferredVersion = 2,
            ServerVersion = "2.0.0",
        });
    }
}
```

**Step 2: Build**

Run: `dotnet build src/Qodalis.Cli.sln`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: add unversioned /api/cli/versions discovery endpoint"
```

---

## Task 12: Version WebSocket endpoints

**Files:**
- Modify: `cli-server-dotnet/src/Qodalis.Cli/Extensions/WebApplicationExtensions.cs`

**Step 1: Add versioned WebSocket routes**

Update the middleware in `UseCli()` to accept both `/ws/v1/cli*` and `/ws/v2/cli*` paths:

```csharp
app.Use(async (context, next) =>
{
    if (context.WebSockets.IsWebSocketRequest)
    {
        // v1 and v2 event WebSocket
        if (context.Request.Path == "/ws/v1/cli/events" ||
            context.Request.Path == "/ws/v2/cli/events" ||
            context.Request.Path == "/ws/cli/events")  // legacy unversioned
        {
            var manager = context.RequestServices.GetRequiredService<CliEventSocketManager>();
            var socket = await context.WebSockets.AcceptWebSocketAsync();
            await manager.HandleConnectionAsync(socket, context.RequestAborted);
            return;
        }

        // v1 and v2 terminal WebSocket
        if (context.Request.Path == "/ws/v1/cli" ||
            context.Request.Path == "/ws/v2/cli" ||
            context.Request.Path == "/ws/cli")  // legacy unversioned
        {
            var webSocket = await context.WebSockets.AcceptWebSocketAsync();
            // ... existing bash process handling
        }
    }

    await next();
});
```

**Step 2: Build and verify**

Run: `dotnet build src/Qodalis.Cli.sln`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: add versioned WebSocket routes /ws/v1/cli and /ws/v2/cli"
```

---

## Task 13: Implement frontend auto-negotiation

**Files:**
- Create: `packages/core/src/lib/services/server-version-negotiator.ts`
- Test: `packages/core/src/tests/server-version-negotiator.spec.ts`

**Step 1: Write failing test**

```typescript
describe('ServerVersionNegotiator', () => {
    it('should pick highest compatible version', () => {
        const clientSupported = [1, 2];
        const serverSupported = [1, 2];
        const result = negotiateVersion(clientSupported, serverSupported);
        expect(result).toBe(2);
    });

    it('should fall back to lower common version', () => {
        const clientSupported = [1, 2];
        const serverSupported = [1];
        const result = negotiateVersion(clientSupported, serverSupported);
        expect(result).toBe(1);
    });

    it('should return null when no common version', () => {
        const clientSupported = [2];
        const serverSupported = [1];
        const result = negotiateVersion(clientSupported, serverSupported);
        expect(result).toBeNull();
    });
});

function negotiateVersion(client: number[], server: number[]): number | null {
    const common = client.filter((v) => server.includes(v));
    return common.length > 0 ? Math.max(...common) : null;
}
```

**Step 2: Implement `ServerVersionNegotiator`**

```typescript
export interface ServerVersionInfo {
    supportedVersions: number[];
    preferredVersion: number;
    serverVersion: string;
}

export class ServerVersionNegotiator {
    private static readonly CLIENT_SUPPORTED_VERSIONS = [2];

    static negotiate(serverInfo: ServerVersionInfo): number | null {
        const common = this.CLIENT_SUPPORTED_VERSIONS.filter((v) =>
            serverInfo.supportedVersions.includes(v),
        );
        return common.length > 0 ? Math.max(...common) : null;
    }

    static async discover(baseUrl: string): Promise<{ apiVersion: number; basePath: string } | null> {
        try {
            const response = await fetch(`${baseUrl}/api/cli/versions`);
            if (!response.ok) return null;

            const info: ServerVersionInfo = await response.json();
            const version = this.negotiate(info);

            if (version === null) return null;

            return {
                apiVersion: version,
                basePath: `${baseUrl}/api/v${version}/cli`,
            };
        } catch {
            return null;
        }
    }
}
```

**Step 3: Export from core**

Add export in `packages/core/src/public-api.ts`.

**Step 4: Build and test**

Run: `pnpm run build:core`
Expected: SUCCESS

**Step 5: Commit**

```bash
git add packages/core/src/lib/services/server-version-negotiator.ts packages/core/src/tests/server-version-negotiator.spec.ts packages/core/src/public-api.ts
git commit -m "feat(core): add ServerVersionNegotiator for auto-negotiation with backend"
```

---

## Task 14: Integration test — full boot with mixed v1/v2 modules

**Files:**
- Create: `packages/cli/src/tests/boot-integration.spec.ts`

**Step 1: Write integration test**

```typescript
describe('CliBoot integration — mixed apiVersion modules', () => {
    it('should boot v2 modules and skip v1 modules with warning', () => {
        // Create a mock context with writer.writeWarning spy
        // Register one v2 module and one v1 module
        // Call boot()
        // Assert: v2 module's processors are registered
        // Assert: v1 module's processors are NOT registered
        // Assert: writeWarning was called for v1 module
    });

    it('should resolve dependencies and boot in order', () => {
        // Module A (no deps) and Module B (depends on A)
        // Register B first, then A
        // Assert: A boots before B
    });

    it('should skip module with missing dependency', () => {
        // Module C depends on "nonexistent"
        // Assert: C is skipped with warning
    });
});
```

Implement the full test with mocked execution context based on existing test patterns in the repo.

**Step 2: Run tests**

Run: `npx jest packages/cli/src/tests/boot-integration.spec.ts --no-cache`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/cli/src/tests/boot-integration.spec.ts
git commit -m "test(cli): add integration tests for mixed apiVersion boot and dependency resolution"
```

---

## Task 15: Add `apiVersion` to Node.js `ICliCommandProcessor` and version routes

**Files:**
- Modify: `cli-server-node/src/abstractions/cli-command-processor.ts`
- Modify: `cli-server-node/src/controllers/cli-controller.ts`
- Create: `cli-server-node/src/controllers/cli-controller-v2.ts`
- Create: `cli-server-node/src/controllers/cli-version-controller.ts`
- Modify: `cli-server-node/src/create-cli-server.ts`
- Modify: `cli-server-node/src/services/cli-event-socket-manager.ts`

**Step 1: Add `apiVersion` to interface and base class**

In `cli-server-node/src/abstractions/cli-command-processor.ts`:

```typescript
export interface ICliCommandProcessor {
    command: string;
    description: string;
    author: ICliCommandAuthor;
    allowUnlistedCommands?: boolean;
    valueRequired?: boolean;
    version: string;
    apiVersion: number;  // NEW
    processors?: ICliCommandProcessor[];
    parameters?: ICliCommandParameterDescriptor[];
    handleAsync(command: CliProcessCommand): Promise<string>;
}

export abstract class CliCommandProcessor implements ICliCommandProcessor {
    abstract command: string;
    abstract description: string;
    author: ICliCommandAuthor = DefaultLibraryAuthor;
    allowUnlistedCommands?: boolean;
    valueRequired?: boolean;
    version: string = '1.0.0';
    apiVersion: number = 1;  // NEW — default 1 for backward compat
    processors?: ICliCommandProcessor[];
    parameters?: ICliCommandParameterDescriptor[];

    abstract handleAsync(command: CliProcessCommand): Promise<string>;
}
```

**Step 2: Rename existing controller route to v1**

In `cli-server-node/src/controllers/cli-controller.ts`, the controller is a factory function that returns a Router. It's mounted at a base path in `create-cli-server.ts`. Change the mount point in `create-cli-server.ts`:

```typescript
// Before:
app.use(basePath, createCliController(registry, executor));

// After:
app.use('/api/v1/cli', createCliController(registry, executor));
app.use('/api/v2/cli', createCliControllerV2(registry, executor));
```

**Step 3: Create v2 controller**

Create `cli-server-node/src/controllers/cli-controller-v2.ts`:

```typescript
import { Router } from 'express';
import { ICliCommandProcessor } from '../abstractions';
import { CliServerCommandDescriptor, CliServerCommandParameterDescriptorDto } from '../models';
import { ICliCommandRegistry, ICliCommandExecutorService } from '../services';

export function createCliControllerV2(
    registry: ICliCommandRegistry,
    executor: ICliCommandExecutorService,
): Router {
    const router = Router();

    router.get('/version', (_req, res) => {
        res.json({ apiVersion: 2, serverVersion: '2.0.0' });
    });

    router.get('/commands', (_req, res) => {
        const descriptors = registry.processors
            .filter((p) => p.apiVersion >= 2)
            .map(mapToDescriptor);
        res.json(descriptors);
    });

    router.post('/execute', async (req, res) => {
        const command = req.body;
        const response = await executor.executeAsync(command);
        res.json(response);
    });

    return router;
}

function mapToDescriptor(processor: ICliCommandProcessor): CliServerCommandDescriptor {
    const descriptor: CliServerCommandDescriptor = {
        command: processor.command,
        description: processor.description,
        version: processor.version,
        apiVersion: processor.apiVersion,
    };

    if (processor.parameters?.length) {
        descriptor.parameters = processor.parameters.map(
            (p): CliServerCommandParameterDescriptorDto => ({
                name: p.name,
                aliases: p.aliases,
                description: p.description,
                required: p.required,
                type: p.type,
                defaultValue: p.defaultValue,
            }),
        );
    }

    if (processor.processors?.length) {
        descriptor.processors = processor.processors.map(mapToDescriptor);
    }

    return descriptor;
}
```

**Step 4: Create version discovery controller**

Create `cli-server-node/src/controllers/cli-version-controller.ts`:

```typescript
import { Router } from 'express';

export function createCliVersionController(): Router {
    const router = Router();

    router.get('/versions', (_req, res) => {
        res.json({
            supportedVersions: [1, 2],
            preferredVersion: 2,
            serverVersion: '2.0.0',
        });
    });

    return router;
}
```

**Step 5: Update `create-cli-server.ts` to mount all routes**

```typescript
import { createCliController } from './controllers/cli-controller';
import { createCliControllerV2 } from './controllers/cli-controller-v2';
import { createCliVersionController } from './controllers/cli-version-controller';

// In createCliServer():
app.use('/api/cli', createCliVersionController());      // unversioned discovery
app.use('/api/v1/cli', createCliController(registry, executor));  // v1
app.use('/api/v2/cli', createCliControllerV2(registry, executor)); // v2
```

**Step 6: Version WebSocket endpoints**

In `cli-server-node/src/services/cli-event-socket-manager.ts`, update the upgrade handler:

```typescript
server.on('upgrade', (request, socket, head) => {
    const url = request.url;
    if (url !== '/ws/cli/events' &&
        url !== '/ws/v1/cli/events' &&
        url !== '/ws/v2/cli/events') {
        return;
    }

    this._wss!.handleUpgrade(request, socket, head, (ws) => {
        this._wss!.emit('connection', ws, request);
    });
});
```

**Step 7: Add `apiVersion` to model**

In `cli-server-node/src/models/` add `apiVersion?: number` to `CliServerCommandDescriptor`.

**Step 8: Build**

Run: `cd /Users/nicolaelupei/Documents/Personal/cli-server-node && npm run build`
Expected: SUCCESS

**Step 9: Commit**

```bash
cd /Users/nicolaelupei/Documents/Personal/cli-server-node
git add -A
git commit -m "feat: add apiVersion to processors, URL-path versioned routes, and discovery endpoint"
```

---

## Task 16: Add `api_version` to Python `ICliCommandProcessor` and version routes

**Files:**
- Modify: `cli-server-python/src/qodalis_cli/abstractions/cli_command_processor.py`
- Modify: `cli-server-python/src/qodalis_cli/controllers/cli_controller.py`
- Create: `cli-server-python/src/qodalis_cli/controllers/cli_controller_v2.py`
- Create: `cli-server-python/src/qodalis_cli/controllers/cli_version_controller.py`
- Modify: `cli-server-python/src/qodalis_cli/create_cli_server.py`

**Step 1: Add `api_version` property to base class**

In `cli-server-python/src/qodalis_cli/abstractions/cli_command_processor.py`:

```python
class ICliCommandProcessor(abc.ABC):
    @property
    @abc.abstractmethod
    def command(self) -> str: ...

    @property
    @abc.abstractmethod
    def description(self) -> str: ...

    @property
    def author(self) -> ICliCommandAuthor:
        return DEFAULT_LIBRARY_AUTHOR

    @property
    def version(self) -> str:
        return "1.0.0"

    @property
    def api_version(self) -> int:
        """API version this processor targets. Default 1 for backward compat."""
        return 1

    # ... rest unchanged
```

**Step 2: Create v2 router**

Create `cli-server-python/src/qodalis_cli/controllers/cli_controller_v2.py`:

```python
from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from ..abstractions import ICliCommandProcessor
from ..abstractions.cli_process_command import CliProcessCommand
from ..models import CliServerCommandDescriptor, CliServerCommandParameterDescriptorDto, CliServerResponse
from ..services.cli_command_executor_service import ICliCommandExecutorService
from ..services.cli_command_registry import ICliCommandRegistry


class ExecuteRequest(BaseModel):
    command: str = ""
    raw_command: str = Field(alias="rawCommand", default="")
    value: str | None = None
    args: dict[str, Any] = Field(default_factory=dict)
    chain_commands: list[str] = Field(alias="chainCommands", default_factory=list)
    data: Any = None

    model_config = {"populate_by_name": True}


def _map_to_descriptor(processor: ICliCommandProcessor) -> dict[str, Any]:
    params = None
    if processor.parameters:
        params = [
            CliServerCommandParameterDescriptorDto(
                name=p.name,
                description=p.description,
                required=p.required,
                type=p.type,
                aliases=p.aliases,
                defaultValue=p.default_value,
            ).model_dump(by_alias=True, exclude_none=True)
            for p in processor.parameters
        ]

    subs = None
    if processor.processors:
        subs = [_map_to_descriptor(p) for p in processor.processors]

    desc = CliServerCommandDescriptor(
        command=processor.command,
        description=processor.description,
        version=processor.version,
        apiVersion=processor.api_version,
        parameters=params if params else None,
        processors=subs if subs else None,
    )
    return desc.model_dump(by_alias=True, exclude_none=True)


def create_cli_router_v2(
    registry: ICliCommandRegistry,
    executor: ICliCommandExecutorService,
) -> APIRouter:
    router = APIRouter()

    @router.get("/version")
    async def get_version() -> dict[str, Any]:
        return {"apiVersion": 2, "serverVersion": "2.0.0"}

    @router.get("/commands")
    async def get_commands() -> list[dict[str, Any]]:
        return [
            _map_to_descriptor(p)
            for p in registry.processors
            if p.api_version >= 2
        ]

    @router.post("/execute")
    async def execute_command(request: ExecuteRequest) -> JSONResponse:
        cmd = CliProcessCommand(
            command=request.command,
            raw_command=request.raw_command,
            value=request.value,
            args=request.args,
            chain_commands=request.chain_commands,
            data=request.data,
        )
        result = await executor.execute_async(cmd)
        return JSONResponse(result.model_dump(by_alias=True, exclude_none=True))

    return router
```

**Step 3: Create version discovery router**

Create `cli-server-python/src/qodalis_cli/controllers/cli_version_controller.py`:

```python
from __future__ import annotations

from typing import Any

from fastapi import APIRouter


def create_cli_version_router() -> APIRouter:
    router = APIRouter()

    @router.get("/versions")
    async def get_versions() -> dict[str, Any]:
        return {
            "supportedVersions": [1, 2],
            "preferredVersion": 2,
            "serverVersion": "2.0.0",
        }

    return router
```

**Step 4: Update `create_cli_server.py` to mount all routes**

In `cli-server-python/src/qodalis_cli/create_cli_server.py`:

```python
from .controllers import create_cli_router
from .controllers.cli_controller_v2 import create_cli_router_v2
from .controllers.cli_version_controller import create_cli_version_router

# Replace single router mount with:
app.include_router(create_cli_version_router(), prefix="/api/cli")    # unversioned discovery
app.include_router(router, prefix="/api/v1/cli")                      # v1
app.include_router(create_cli_router_v2(registry, executor), prefix="/api/v2/cli")  # v2
```

**Step 5: Version WebSocket endpoints**

In `create_cli_server.py`, add versioned WebSocket paths:

```python
@app.websocket("/ws/cli/events")
async def websocket_events_legacy(websocket: WebSocket) -> None:
    await event_socket_manager.handle_connection(websocket)

@app.websocket("/ws/v1/cli/events")
async def websocket_events_v1(websocket: WebSocket) -> None:
    await event_socket_manager.handle_connection(websocket)

@app.websocket("/ws/v2/cli/events")
async def websocket_events_v2(websocket: WebSocket) -> None:
    await event_socket_manager.handle_connection(websocket)
```

**Step 6: Add `apiVersion` to model**

In the models directory, add `apiVersion: int | None = None` to `CliServerCommandDescriptor`.

**Step 7: Verify**

Run: `cd /Users/nicolaelupei/Documents/Personal/cli-server-python && python -c "from qodalis_cli.create_cli_server import create_cli_server; print('OK')"`
Expected: OK

**Step 8: Commit**

```bash
cd /Users/nicolaelupei/Documents/Personal/cli-server-python
git add -A
git commit -m "feat: add api_version to processors, URL-path versioned routes, and discovery endpoint"
```

---

## Task 17: Full build verification and smoke test

**Step 1: Build entire web-cli monorepo**

Run: `cd /Users/nicolaelupei/Documents/Personal/web-cli && pnpm run build`
Expected: All 23 projects build successfully

**Step 2: Run all web-cli tests**

Run: `pnpm test`
Expected: All tests pass

**Step 3: Build .NET backend**

Run: `cd /Users/nicolaelupei/Documents/Personal/cli-server-dotnet && dotnet build src/Qodalis.Cli.sln --configuration Release`
Expected: SUCCESS

**Step 4: Build Node.js backend**

Run: `cd /Users/nicolaelupei/Documents/Personal/cli-server-node && npm run build`
Expected: SUCCESS

**Step 5: Verify Python backend imports**

Run: `cd /Users/nicolaelupei/Documents/Personal/cli-server-python && pip install -e . && python -c "from qodalis_cli.create_cli_server import create_cli_server; print('OK')"`
Expected: OK

**Step 6: Smoke test Angular demo**

Run: `cd /Users/nicolaelupei/Documents/Personal/web-cli && pnpm run serve:angular-demo`
- Open `http://localhost:4303`
- Type `help` — verify all v2 plugins appear
- Type `guid` — verify GUID plugin works
- Kill the dev server

**Step 7: Verify version discovery endpoints**

For each backend, start the server and check:
```bash
curl http://localhost:<port>/api/cli/versions
# Expected: {"supportedVersions":[1,2],"preferredVersion":2,"serverVersion":"2.0.0"}

curl http://localhost:<port>/api/v2/cli/version
# Expected: {"apiVersion":2,"serverVersion":"2.0.0"}

curl http://localhost:<port>/api/v1/cli/version
# Expected: {"version":"1.0.0"}
```

Ports: .NET = 8046, Node.js = 8047, Python = 8048

**Step 8: Final commit if any fixups needed**

```bash
# In each repo that needed fixes:
git add -A
git commit -m "chore: fixups from full build verification"
```
