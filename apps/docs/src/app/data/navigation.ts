import { UTILITY_PLUGINS, GAME_PLUGINS, LANGUAGE_PACKS } from './plugins';

export interface NavItem {
    label: string;
    path: string;
    children?: NavItem[];
    external?: boolean;
}

export const DOCS_NAV: NavItem[] = [
    { label: 'Getting Started', path: '/docs/getting-started' },
    { label: 'Built-in Commands', path: '/docs/built-in-commands' },
    { label: 'Configuration', path: '/docs/configuration' },
    {
        label: 'Core Concepts',
        path: '/docs/core-concepts',
        children: [
            { label: 'Command Processors', path: '/docs/core-concepts/command-processors' },
            { label: 'Execution Context', path: '/docs/core-concepts/execution-context' },
            { label: 'Theming', path: '/docs/core-concepts/theming' },
            { label: 'Input Reader', path: '/docs/core-concepts/input-reader' },
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
        ],
    },
    { label: 'Create a Plugin', path: '/docs/plugins/create-your-own' },
    {
        label: 'Language Packs',
        path: '/docs/language-packs',
        children: LANGUAGE_PACKS.map((p) => ({
            label: p.name,
            path: `/docs/plugins/${p.id}`,
        })),
    },
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
