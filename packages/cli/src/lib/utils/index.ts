export { groupBy } from './arrays';
export { getGreetingBasedOnTime } from './greetings';

export const openLink = (link: string) => {
    try {
        window.open(link, '_blank');
    } catch (e) {
        console.error(e);
    }
};
