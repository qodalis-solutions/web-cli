import { CliPermissionDefinition, ICliPermissionRegistry } from '@qodalis/cli-core';

/** Default {@link ICliPermissionRegistry}: permissions declared by modules. */
export class CliPermissionRegistry implements ICliPermissionRegistry {
    private readonly definitions = new Map<string, CliPermissionDefinition>();

    register(definitions: CliPermissionDefinition[], module?: string): void {
        for (const def of definitions ?? []) {
            const name = def?.name?.trim();
            if (!name) continue;
            const key = name.toLowerCase();
            if (!this.definitions.has(key)) {
                this.definitions.set(key, { ...def, name, module: def.module ?? module });
            }
        }
    }

    list(): CliPermissionDefinition[] {
        return [...this.definitions.values()].sort((a, b) => a.name.localeCompare(b.name));
    }

    get(name: string): CliPermissionDefinition | undefined {
        return this.definitions.get(name.trim().toLowerCase());
    }
}
