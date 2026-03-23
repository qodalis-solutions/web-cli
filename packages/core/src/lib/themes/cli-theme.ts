import type { ITheme } from '@xterm/xterm';

export type CliTheme = ITheme;

export type DefaultThemesType = {
    default: CliTheme;
    classic: CliTheme;
    dracula: CliTheme;
    monokai: CliTheme;
    solarizedDark: CliTheme;
    solarizedLight: CliTheme;
    gruvboxDark: CliTheme;
    gruvboxLight: CliTheme;
    nord: CliTheme;
    oneDark: CliTheme;
    material: CliTheme;
    highContrastLight: CliTheme;
    tokyoNight: CliTheme;
    catppuccinMocha: CliTheme;
    catppuccinFrappe: CliTheme;
    rosePine: CliTheme;
    kanagawa: CliTheme;
    everforestDark: CliTheme;
    ayuDark: CliTheme;
    catppuccinLatte: CliTheme;
    rosePineDawn: CliTheme;
    everforestLight: CliTheme;
    githubLight: CliTheme;
    cyberpunk: CliTheme;
    retroGreen: CliTheme;
    retroAmber: CliTheme;
    matrix: CliTheme;
    synthwave: CliTheme;
    highContrastDark: CliTheme;
    yellow: CliTheme;
    [key: string]: CliTheme;
};
