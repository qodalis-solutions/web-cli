import {
    ICliStateStore,
    ICliCommandProcessorRegistry,
    ICliConfigurationOption,
} from '../interfaces';

/**
 * Token for the configure command's state store.
 */
export const CLI_CONFIGURE_STORE_NAME = 'configure';

/**
 * Retrieves a configuration value for a given category and key
 * from a configuration state store.
 *
 * @param state The state store to read from (should be the 'configure' store)
 * @param category The category (processor command name or 'system')
 * @param key The configuration key
 * @param defaultValue Fallback value if not configured
 * @returns The configured value or the default
 */
export function getConfigValue<T = any>(
    state: ICliStateStore,
    category: string,
    key: string,
    defaultValue: T,
): T {
    try {
        const s = state.getState<Record<string, any>>();
        const bucket =
            category === 'system' ? s?.['system'] : s?.['plugins']?.[category];
        if (bucket && key in bucket) {
            return bucket[key] as T;
        }
    } catch {
        // State not initialized or not available
    }
    return defaultValue;
}

/**
 * Resolves all configuration options from registered processors,
 * grouped by category.
 */
export function resolveConfigurationCategories(
    registry: ICliCommandProcessorRegistry,
): Map<
    string,
    { processorCommand: string; options: ICliConfigurationOption[] }
> {
    const categories = new Map<
        string,
        { processorCommand: string; options: ICliConfigurationOption[] }
    >();

    for (const processor of registry.processors) {
        if (
            processor.configurationOptions &&
            processor.configurationOptions.length > 0
        ) {
            for (const option of processor.configurationOptions) {
                const cat = option.category || processor.command;
                if (!categories.has(cat)) {
                    categories.set(cat, {
                        processorCommand: processor.command,
                        options: [],
                    });
                }
                categories.get(cat)!.options.push(option);
            }
        }
    }

    return categories;
}
