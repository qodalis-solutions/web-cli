export { CommandParser } from './command-parser';

export const openLink = (link: string) => {
    try {
        window.open(link, '_blank');
    } catch (e) {
        console.error(e);
    }
};

export const getGreetingBasedOnTime = (date?: Date) => {
    const currentHour = (date ?? new Date()).getHours();

    if (currentHour >= 5 && currentHour < 12) {
        return '☀️ Good morning! Wishing you a productive day ahead!';
    } else if (currentHour >= 12 && currentHour < 18) {
        return '🌤️ Good afternoon! Keep up the great work!';
    } else if (currentHour >= 18 && currentHour < 22) {
        return '🌆 Good evening! Hope you had a fantastic day!';
    } else {
        return '🌙 Good night! Rest well and see you tomorrow!';
    }
};

export * from './dependency-injection';
