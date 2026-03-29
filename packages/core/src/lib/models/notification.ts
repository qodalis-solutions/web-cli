export type CliNotificationLevel = 'info' | 'success' | 'warn' | 'error';

export interface CliNotification {
    level: CliNotificationLevel;
    message: string;
    timestamp: number;
}
