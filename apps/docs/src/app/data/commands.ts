export interface CommandGroup {
    label: string;
    commands: string[];
}

export const BUILT_IN_GROUPS: CommandGroup[] = [
    {
        label: 'Dev Tools',
        commands: [
            'eval',
            'json',
            'base64',
            'hash',
            'hex',
            'jwt',
            'url',
            'diff',
            'color',
            'ping',
            'snippet',
        ],
    },
    {
        label: 'Utilities',
        commands: [
            'random',
            'lorem',
            'timestamp',
            'convert',
            'cal',
            'seq',
            'echo',
            'yes',
            'sleep',
            'open',
            'clipboard',
            'capture',
        ],
    },
    {
        label: 'System',
        commands: [
            'help',
            'version',
            'clear',
            'history',
            'uname',
            'uptime',
            'screen',
            'debug',
            'hotkeys',
            'feedback',
        ],
    },
    {
        label: 'Processes',
        commands: [
            'ps',
            'kill',
            'services',
        ],
    },
    {
        label: 'Environment',
        commands: [
            'env',
            'export',
            'unset',
            'alias',
            'unalias',
        ],
    },
    {
        label: 'Editors & Files',
        commands: [
            'nano',
            'ls',
            'cat',
            'mkdir',
            'touch',
            'rm',
            'cp',
            'mv',
            'tree',
            'head',
            'tail',
            'wc',
            'find',
            'grep',
            'chmod',
            'cd',
            'pwd',
        ],
    },
    {
        label: 'Packages',
        commands: ['pkg add', 'pkg list', 'pkg remove'],
    },
    {
        label: 'Configuration',
        commands: [
            'config set',
            'config get',
            'config list',
            'config delete',
        ],
    },
    {
        label: 'Theming',
        commands: [
            'theme set',
            'theme get',
            'theme list',
            'font-size',
        ],
    },
    {
        label: 'Users',
        commands: [
            'whoami',
            'adduser',
            'passwd',
            'login',
            'logout',
            'su',
            'who',
            'id',
        ],
    },
];

export const TOTAL_COMMAND_COUNT = BUILT_IN_GROUPS.reduce(
    (sum, g) => sum + g.commands.length,
    0
);
