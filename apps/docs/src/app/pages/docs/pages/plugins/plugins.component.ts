import { Component, computed, OnDestroy, OnInit, signal } from '@angular/core';
import {
    UTILITY_PLUGINS,
    GAME_PLUGINS,
    PLUGINS,
    PluginData,
} from '../../../../data/plugins';

/** The public catalog of the plugin marketplace. */
export const MARKETPLACE_CATALOG_URL =
    'https://plugins.qodalis.com/api/v1/qcli/marketplace/plugins';

/** A plugin as the marketplace lists it (the fields this page shows). */
export interface CatalogPlugin {
    name: string;
    shortName: string;
    description: string;
    category: string;
    tags: string[];
    publisher: { id: string; name: string; verified: boolean };
    official: boolean;
    latest: string | null;
    downloads: { weekly: number };
}

const CATALOG_TIMEOUT_MS = 5000;

@Component({
    standalone: false,
    selector: 'docs-plugins',
    templateUrl: './plugins.component.html',
    styleUrl: './plugins.component.sass',
})
export class PluginsComponent implements OnInit, OnDestroy {
    utilityPlugins: PluginData[] = UTILITY_PLUGINS;
    gamePlugins: PluginData[] = GAME_PLUGINS;

    /** The marketplace catalog, or `null` until (unless) it answers. */
    readonly catalog = signal<CatalogPlugin[] | null>(null);
    readonly query = signal('');
    readonly category = signal('');

    readonly categories = computed(() =>
        [...new Set((this.catalog() ?? []).map((p) => p.category))].sort(),
    );

    readonly filtered = computed(() => {
        const words = this.query().toLowerCase().split(/\s+/).filter(Boolean);
        const category = this.category();
        return (this.catalog() ?? []).filter((plugin) => {
            if (category && plugin.category !== category) return false;
            const text =
                `${plugin.name} ${plugin.shortName} ${plugin.description} ${plugin.tags.join(' ')}`.toLowerCase();
            return words.every((word) => text.includes(word));
        });
    });

    private readonly controller = new AbortController();

    ngOnInit(): void {
        void this.loadCatalog();
    }

    ngOnDestroy(): void {
        this.controller.abort();
    }

    /** Docs page of an official plugin, when this site has one. */
    detailLink(plugin: CatalogPlugin): string | null {
        const known = PLUGINS.find((p) => p.npmPackage === plugin.name);
        return known ? `/docs/plugins/${known.id}` : null;
    }

    /** `pkg add` argument: short name for the official plugins, else the npm name. */
    installName(plugin: CatalogPlugin): string {
        return plugin.name.startsWith('@qodalis/cli-')
            ? plugin.shortName
            : plugin.name;
    }

    onQuery(event: Event): void {
        this.query.set((event.target as HTMLInputElement).value);
    }

    toggleCategory(category: string): void {
        this.category.set(this.category() === category ? '' : category);
    }

    /** Read the catalog in the browser; the static lists stay when it fails. */
    private async loadCatalog(): Promise<void> {
        if (typeof fetch !== 'function') return;
        const timer = setTimeout(
            () => this.controller.abort(),
            CATALOG_TIMEOUT_MS,
        );
        try {
            const plugins: CatalogPlugin[] = [];
            for (let page = 1; page <= 5; page++) {
                const response = await fetch(
                    `${MARKETPLACE_CATALOG_URL}?page=${page}&pageSize=100&sort=name`,
                    { signal: this.controller.signal, credentials: 'omit' },
                );
                if (!response.ok) return;
                const body = await response.json();
                if (!Array.isArray(body?.items)) return;
                plugins.push(...body.items);
                if (plugins.length >= body.total || body.items.length === 0) {
                    break;
                }
            }
            if (plugins.length > 0) this.catalog.set(plugins);
        } catch {
            // Unreachable or blocked: keep the static lists
        } finally {
            clearTimeout(timer);
        }
    }
}
