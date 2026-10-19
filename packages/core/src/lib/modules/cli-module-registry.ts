import { ICliModule } from '../interfaces';
import { API_VERSION } from '../version';

/**
 * Registry that tracks loaded web CLI modules (frontend plugins) and dispatches
 * boot handlers when new modules are registered (including dynamically via UMD).
 *
 * This registry is for **browser-side web plugins only**. Backend server
 * processors (Node/Python/.NET) have their own registries and do not use
 * this class or the `apiVersion` gating mechanism.
 */
export class CliModuleRegistry {
    private readonly modules = new Map<string, ICliModule>();
    private readonly bootHandlers: ((module: ICliModule) => Promise<void>)[] =
        [];
    private readonly unregisterHandlers: ((module: ICliModule) => void)[] = [];
    /** Registrations whose boot handlers are still running. */
    private readonly inFlight = new Set<Promise<void>>();

    /** Optional warning callback — set by the engine to route through ICliLogger */
    onWarn?: (message: string) => void;

    /**
     * Register a handler that is called whenever a new module is registered.
     */
    onModuleBoot(handler: (module: ICliModule) => Promise<void>): void {
        this.bootHandlers.push(handler);
    }

    /**
     * Register a web plugin module and notify all boot handlers.
     * Modules whose `apiVersion` is below the runtime's `API_VERSION` are
     * skipped with a warning — this ensures only compatible frontend plugins load.
     */
    register(module: ICliModule): Promise<void> {
        const registration = this.registerInternal(module);
        this.inFlight.add(registration);
        const done = () => this.inFlight.delete(registration);
        registration.then(done, done);
        return registration;
    }

    /**
     * Resolve once every registration in progress (including ones started
     * meanwhile, e.g. a plugin loading another) has finished booting.
     */
    async whenIdle(): Promise<void> {
        while (this.inFlight.size > 0) {
            await Promise.allSettled([...this.inFlight]);
        }
    }

    private async registerInternal(module: ICliModule): Promise<void> {
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
     * Register a handler that is called when a module is unregistered,
     * e.g. so its processors can be removed.
     */
    onModuleUnregister(handler: (module: ICliModule) => void): void {
        this.unregisterHandlers.push(handler);
    }

    /**
     * Unregister a module and notify all unregister handlers. A module
     * registered again afterwards (e.g. a newer version) boots again.
     * Returns the removed module, or `undefined` when it was not registered.
     */
    unregister(name: string): ICliModule | undefined {
        const module = this.modules.get(name);
        if (!module) return undefined;
        this.modules.delete(name);
        for (const handler of this.unregisterHandlers) {
            try {
                handler(module);
            } catch (e) {
                const msg = `[CLI] Unregister handler failed for module "${name}": ${e instanceof Error ? e.message : e}`;
                if (this.onWarn) {
                    this.onWarn(msg);
                } else {
                    console.warn(msg);
                }
            }
        }
        return module;
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
