import { UTILITY_PLUGINS, GAME_PLUGINS, LANGUAGE_PACKS } from './plugins';

export interface NavItem {
    label: string;
    path: string;
    children?: NavItem[];
    external?: boolean;
}

export const DOCS_NAV: NavItem[] = [
    { label: 'sidebar.getting-started', path: '/docs/getting-started' },
    { label: 'sidebar.built-in-commands', path: '/docs/built-in-commands' },
    { label: 'sidebar.configuration', path: '/docs/configuration' },
    {
        label: 'sidebar.core-concepts',
        path: '/docs/core-concepts',
        children: [
            { label: 'sidebar.command-processors', path: '/docs/core-concepts/command-processors' },
            { label: 'sidebar.execution-context', path: '/docs/core-concepts/execution-context' },
            { label: 'sidebar.theming', path: '/docs/core-concepts/theming' },
            { label: 'sidebar.input-reader', path: '/docs/core-concepts/input-reader' },
            { label: 'sidebar.tabs-and-panes', path: '/docs/core-concepts/tabs-and-panes' },
        ],
    },
    {
        label: 'sidebar.plugins',
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
    { label: 'sidebar.panel-api', path: '/docs/panel-api' },
    { label: 'sidebar.create-a-plugin', path: '/docs/plugins/create-your-own' },
    {
        label: 'sidebar.language-packs',
        path: '/docs/language-packs',
        children: LANGUAGE_PACKS.map((p) => ({
            label: p.name,
            path: `/docs/plugins/${p.id}`,
        })),
    },
    {
        label: 'sidebar.server-integration',
        path: '/docs/server-integration',
        children: [
            { label: 'sidebar.dotnet-server', path: '/docs/server-integration/dotnet' },
            { label: 'sidebar.node-server', path: '/docs/server-integration/node' },
            { label: 'sidebar.python-server', path: '/docs/server-integration/python' },
        ],
    },
];
