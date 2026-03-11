import { ICliTranslationService } from '@qodalis/cli-core';

/**
 * Default implementation of the translation service.
 *
 * Maintains a map of locale -> flat key-value translations.
 * The 'en' locale is always implicitly available via defaultValue fallbacks.
 * Supports simple {param} interpolation.
 */
export class CliTranslationService implements ICliTranslationService {
    private locale = 'en';
    private readonly translations = new Map<string, Record<string, string>>();

    t(
        key: string,
        defaultValue: string,
        params?: Record<string, string | number>,
    ): string {
        let result: string | undefined;

        // 1. Try current locale
        if (this.locale !== 'en') {
            result = this.translations.get(this.locale)?.[key];
        }

        // 2. Try 'en' translations (if explicitly registered)
        if (result === undefined) {
            result = this.translations.get('en')?.[key];
        }

        // 3. Fall back to the default value
        if (result === undefined) {
            result = defaultValue;
        }

        // 4. Interpolate params
        if (params) {
            for (const [paramKey, paramValue] of Object.entries(params)) {
                result = result.replace(
                    new RegExp(`\\{${paramKey}\\}`, 'g'),
                    String(paramValue),
                );
            }
        }

        return result;
    }

    getLocale(): string {
        return this.locale;
    }

    setLocale(locale: string): void {
        this.locale = locale;
    }

    addTranslations(locale: string, translations: Record<string, string>): void {
        const existing = this.translations.get(locale) || {};
        this.translations.set(locale, { ...existing, ...translations });
    }

    getAvailableLocales(): string[] {
        const locales = new Set<string>(['en', ...this.translations.keys()]);
        return [...locales].sort();
    }
}
