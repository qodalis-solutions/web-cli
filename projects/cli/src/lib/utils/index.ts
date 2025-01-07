export { CommandParser } from './command-parser';

export const openLink = (link: string) => {
    try {
        window.open(link, '_blank');
    } catch (e) {
        console.error(e);
    }
};

export * from './dependency-injection';
