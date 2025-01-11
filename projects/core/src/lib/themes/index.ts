import { ITheme } from '@xterm/xterm';

export type CliTheme = ITheme;

export const DefaultThemes: {
    default: CliTheme;
    dracula: CliTheme;
    monokai: CliTheme;
    solarizedDark: CliTheme;
    solarizedLight: CliTheme;
    gruvboxDark: CliTheme;
    gruvboxLight: CliTheme;
    nord: CliTheme;
    oneDark: CliTheme;
    material: CliTheme;
    yellow: CliTheme;
    [key: string]: CliTheme;
} = {
    default: {
        background: '#0c0c0c',
        foreground: '#cccccc',
        green: '#16c60c',
        blue: '#3b78ff',
        yellow: '#FFA500',
    },
    dracula: {
        background: '#282A36',
        foreground: '#F8F8F2',
        cursor: '#50FA7B',
        black: '#21222C',
        red: '#FF5555',
        green: '#50FA7B',
        yellow: '#F1FA8C',
        blue: '#BD93F9',
        magenta: '#FF79C6',
        cyan: '#8BE9FD',
        white: '#F8F8F2',
        brightBlack: '#6272A4',
        brightRed: '#FF6E6E',
        brightGreen: '#69FF94',
        brightYellow: '#FFFFA5',
        brightBlue: '#D6ACFF',
        brightMagenta: '#FF92D0',
        brightCyan: '#A4FFFF',
        brightWhite: '#FFFFFF',
    },
    monokai: {
        background: '#272822',
        foreground: '#F8F8F2',
        cursor: '#F8F8F0',
        black: '#272822',
        red: '#F92672',
        green: '#A6E22E',
        yellow: '#F4BF75',
        blue: '#66D9EF',
        magenta: '#AE81FF',
        cyan: '#A1EFE4',
        white: '#F8F8F2',
        brightBlack: '#75715E',
        brightRed: '#F92672',
        brightGreen: '#A6E22E',
        brightYellow: '#F4BF75',
        brightBlue: '#66D9EF',
        brightMagenta: '#AE81FF',
        brightCyan: '#A1EFE4',
        brightWhite: '#F9F8F5',
    },
    solarizedDark: {
        background: '#002B36',
        foreground: '#839496',
        cursor: '#93A1A1',
        black: '#073642',
        red: '#DC322F',
        green: '#859900',
        yellow: '#B58900',
        blue: '#268BD2',
        magenta: '#D33682',
        cyan: '#2AA198',
        white: '#EEE8D5',
        brightBlack: '#002B36',
        brightRed: '#CB4B16',
        brightGreen: '#586E75',
        brightYellow: '#657B83',
        brightBlue: '#839496',
        brightMagenta: '#6C71C4',
        brightCyan: '#93A1A1',
        brightWhite: '#FDF6E3',
    },
    solarizedLight: {
        background: '#FDF6E3',
        foreground: '#657B83',
        cursor: '#586E75',
        black: '#073642',
        red: '#DC322F',
        green: '#859900',
        yellow: '#B58900',
        blue: '#268BD2',
        magenta: '#D33682',
        cyan: '#2AA198',
        white: '#EEE8D5',
        brightBlack: '#002B36',
        brightRed: '#CB4B16',
        brightGreen: '#586E75',
        brightYellow: '#657B83',
        brightBlue: '#839496',
        brightMagenta: '#6C71C4',
        brightCyan: '#93A1A1',
        brightWhite: '#FDF6E3',
    },
    gruvboxDark: {
        background: '#282828',
        foreground: '#EBDBB2',
        cursor: '#EBDBB2',
        black: '#282828',
        red: '#CC241D',
        green: '#98971A',
        yellow: '#D79921',
        blue: '#458588',
        magenta: '#B16286',
        cyan: '#689D6A',
        white: '#A89984',
        brightBlack: '#928374',
        brightRed: '#FB4934',
        brightGreen: '#B8BB26',
        brightYellow: '#FABD2F',
        brightBlue: '#83A598',
        brightMagenta: '#D3869B',
        brightCyan: '#8EC07C',
        brightWhite: '#EBDBB2',
    },
    gruvboxLight: {
        background: '#FBF1C7',
        foreground: '#3C3836',
        cursor: '#3C3836',
        black: '#FBF1C7',
        red: '#9D0006',
        green: '#79740E',
        yellow: '#B57614',
        blue: '#076678',
        magenta: '#8F3F71',
        cyan: '#427B58',
        white: '#3C3836',
        brightBlack: '#D5C4A1',
        brightRed: '#AF3A03',
        brightGreen: '#B8BB26',
        brightYellow: '#FABD2F',
        brightBlue: '#83A598',
        brightMagenta: '#D3869B',
        brightCyan: '#8EC07C',
        brightWhite: '#EBDBB2',
    },
    nord: {
        background: '#2E3440',
        foreground: '#D8DEE9',
        cursor: '#88C0D0',
        black: '#3B4252',
        red: '#BF616A',
        green: '#A3BE8C',
        yellow: '#EBCB8B',
        blue: '#81A1C1',
        magenta: '#B48EAD',
        cyan: '#88C0D0',
        white: '#E5E9F0',
        brightBlack: '#4C566A',
        brightRed: '#BF616A',
        brightGreen: '#A3BE8C',
        brightYellow: '#EBCB8B',
        brightBlue: '#81A1C1',
        brightMagenta: '#B48EAD',
        brightCyan: '#8FBCBB',
        brightWhite: '#ECEFF4',
    },
    oneDark: {
        background: '#282C34',
        foreground: '#ABB2BF',
        cursor: '#528BFF',
        black: '#282C34',
        red: '#E06C75',
        green: '#98C379',
        yellow: '#E5C07B',
        blue: '#61AFEF',
        magenta: '#C678DD',
        cyan: '#56B6C2',
        white: '#ABB2BF',
        brightBlack: '#5C6370',
        brightRed: '#E06C75',
        brightGreen: '#98C379',
        brightYellow: '#E5C07B',
        brightBlue: '#61AFEF',
        brightMagenta: '#C678DD',
        brightCyan: '#56B6C2',
        brightWhite: '#FFFFFF',
    },
    material: {
        background: '#263238',
        foreground: '#ECEFF1',
        cursor: '#FFCC00',
        black: '#263238',
        red: '#F07178',
        green: '#C3E88D',
        yellow: '#FFCB6B',
        blue: '#82AAFF',
        magenta: '#C792EA',
        cyan: '#89DDFF',
        white: '#EEFFFF',
        brightBlack: '#546E7A',
        brightRed: '#F07178',
        brightGreen: '#C3E88D',
        brightYellow: '#FFCB6B',
        brightBlue: '#82AAFF',
        brightMagenta: '#C792EA',
        brightCyan: '#89DDFF',
        brightWhite: '#FFFFFF',
    },
    yellow: {
        background: '#FFFACD', // Light Yellow
        foreground: '#000000', // Black for better contrast
        cursor: '#FFA500', // Orange cursor
        selectionBackground: '#FFD700', // Gold for selected text
        black: '#3B3A32', // Dark Gray for text
        red: '#D32F2F', // Red for errors
        green: '#388E3C', // Green for success
        yellow: '#FBC02D', // Bright Yellow
        blue: '#1976D2', // Blue for links
        magenta: '#8E24AA', // Purple
        cyan: '#0097A7', // Teal
        white: '#FFFFFF', // White
        brightBlack: '#616161', // Lighter Gray
        brightRed: '#FF5252', // Brighter Red
        brightGreen: '#69F0AE', // Bright Green
        brightYellow: '#FFEB3B', // Brighter Yellow
        brightBlue: '#64B5F6', // Lighter Blue
        brightMagenta: '#BA68C8', // Lighter Purple
        brightCyan: '#4DD0E1', // Lighter Teal
        brightWhite: '#FAFAFA', // Very Light Gray
    },
};
