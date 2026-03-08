import { UTILITY_PLUGINS, GAME_PLUGINS, LANGUAGE_PACKS } from './plugins';

export interface NavItem {
    label: string;
    path: string;
    children?: NavItem[];
}

export const DOCS_NAV: NavItem[] = [
    { label: 'Getting Started', path: '/docs/getting-started' },
    { label: 'Configuration', path: '/docs/configuration' },
    {
        label: 'Core Concepts',
        path: '/docs/core-concepts',
        children: [
            { label: 'Commands', path: '/docs/core-concepts/commands' },
            { label: 'Execution Context', path: '/docs/core-concepts/execution-context' },
            { label: 'Themes', path: '/docs/core-concepts/themes' },
            { label: 'Tabs & Panes', path: '/docs/core-concepts/tabs-and-panes' },
        ],
    },
    {
        label: 'Plugins',
        path: '/docs/plugins',
        children: [
            ...UTILITY_PLUGINS.map((p) => ({
                label: p.name,
                path: `/docs/plugins/${p.id}`,
            })),
            ...GAME_PLUGINS.map((p) => ({
                label: p.name,
                path: `/docs/plugins/${p.id}`,
            })),
            ...LANGUAGE_PACKS.map((p) => ({
                label: p.name,
                path: `/docs/plugins/${p.id}`,
            })),
        ],
    },
    { label: 'Create a Plugin', path: '/docs/create-plugin' },
    {
        label: 'Server Integration',
        path: '/docs/server-integration',
        children: [
            { label: '.NET Server', path: '/docs/server-integration/dotnet' },
            { label: 'Node.js Server', path: '/docs/server-integration/node' },
            { label: 'Python Server', path: '/docs/server-integration/python' },
        ],
    },
];
