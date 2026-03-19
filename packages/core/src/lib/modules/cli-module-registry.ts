import { ICliModule } from '../interfaces';
import { API_VERSION } from '../version';

/**
 * Registry that tracks loaded CLI modules and dispatches boot handlers
 * when new modules are registered (including dynamically via UMD).
 */
export class CliModuleRegistry {
    private readonly modules = new Map<string, ICliModule>();
    private readonly bootHandlers: ((module: ICliModule) => Promise<void>)[] =
        [];

    /** Optional warning callback — set by the engine to route through ICliLogger */
    onWarn?: (message: string) => void;

    /**
     * Register a handler that is called whenever a new module is registered.
     */
    onModuleBoot(handler: (module: ICliModule) => Promise<void>): void {
        this.bootHandlers.push(handler);
    }

    /**
     * Register a module and notify all boot handlers.
     * Modules that do not meet the required API version are skipped with a warning.
     */
    async register(module: ICliModule): Promise<void> {
        const modApiVersion = module.apiVersion;
        if (typeof modApiVersion !== 'number' || modApiVersion < API_VERSION) {
            const msg =
                `[CLI] Plugin "${module.name}" targets API version ${modApiVersion ?? 'unknown'}, ` +
                `but this runtime requires API version ${API_VERSION}. Skipping.`;
            if (this.onWarn) {
                this.onWarn(msg);
            } else {
                console.warn(msg);
            }
            return;
        }
        this.modules.set(module.name, module);
        for (const handler of this.bootHandlers) {
            try {
                await handler(module);
            } catch (e) {
                const msg = `[CLI] Boot handler failed for module "${module.name}": ${e instanceof Error ? e.message : e}`;
                if (this.onWarn) {
                    this.onWarn(msg);
                } else {
                    console.warn(msg);
                }
            }
        }
    }

    /**
     * Get a module by name.
     */
    getModule(name: string): ICliModule | undefined {
        return this.modules.get(name);
    }

    /**
     * Get all registered modules.
     */
    getAll(): ICliModule[] {
        return Array.from(this.modules.values());
    }

    /**
     * Track a module without triggering boot handlers.
     * Used by the boot service for statically-provided modules that are
     * already being booted through the normal pipeline.
     */
    track(module: ICliModule): void {
        this.modules.set(module.name, module);
    }

    /**
     * Check if a module is registered.
     */
    has(name: string): boolean {
        return this.modules.has(name);
    }
}
