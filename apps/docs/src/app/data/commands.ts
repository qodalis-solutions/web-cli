export interface CommandGroup {
    label: string;
    commands: string[];
}

export const BUILT_IN_GROUPS: CommandGroup[] = [
    {
        label: 'Dev Tools',
        commands: [
            'curl',
            'json',
            'regex test',
            'base64',
            'speed-test',
            'hash',
            'jwt',
            'hex',
            'url',
        ],
    },
    {
        label: 'Utilities',
        commands: [
            'guid generate',
            'password generate',
            'qr generate',
            'string',
            'text-to-image',
            'random',
            'lorem',
            'timestamp',
            'convert',
            'cal',
            'seq',
        ],
    },
    {
        label: 'System',
        commands: [
            'help',
            'version',
            'clear',
            'history',
            'echo',
            'date',
            'uname',
            'uptime',
            'time',
            'sleep',
            'alias',
            'yes',
            'screen',
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
