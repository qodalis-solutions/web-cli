export type TodoItem = {
    id: number;
    text: string;
    completed: boolean;
    createdAt: string;
    completedAt?: string;
    dueDate?: string;
};

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function startOfDay(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}

export function parseDueDate(input: string): string | null {
    const trimmed = input.trim().toLowerCase();
    const now = new Date();
    const today = startOfDay(now);

    if (trimmed === 'today') {
        return today.toISOString();
    }

    if (trimmed === 'tomorrow') {
        const d = new Date(today);
        d.setDate(d.getDate() + 1);
        return d.toISOString();
    }

    if (trimmed === 'yesterday') {
        const d = new Date(today);
        d.setDate(d.getDate() - 1);
        return d.toISOString();
    }

    if (trimmed === 'next week') {
        const d = new Date(today);
        d.setDate(d.getDate() + 7);
        return d.toISOString();
    }

    if (trimmed === 'next month') {
        const d = new Date(today);
        d.setMonth(d.getMonth() + 1);
        return d.toISOString();
    }

    const dayIndex = DAY_NAMES.indexOf(trimmed);
    if (dayIndex !== -1) {
        const d = new Date(today);
        const currentDay = d.getDay();
        let daysUntil = dayIndex - currentDay;
        if (daysUntil <= 0) daysUntil += 7;
        d.setDate(d.getDate() + daysUntil);
        return d.toISOString();
    }

    // Try ISO format YYYY-MM-DD
    const isoMatch = trimmed.match(/^\d{4}-\d{2}-\d{2}$/);
    if (isoMatch) {
        const d = new Date(trimmed + 'T00:00:00');
        if (!isNaN(d.getTime())) {
            return startOfDay(d).toISOString();
        }
    }

    return null;
}

export function formatRelativeDate(isoDate: string): string {
    const target = startOfDay(new Date(isoDate));
    const today = startOfDay(new Date());
    const diffMs = target.getTime() - today.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'due: today';
    if (diffDays === 1) return 'due: tomorrow';
    if (diffDays === -1) return 'overdue: yesterday';
    if (diffDays > 1 && diffDays <= 14) return `due: in ${diffDays} days`;
    if (diffDays < -1) return `overdue: ${Math.abs(diffDays)} days ago`;

    // Far future: show month + day
    const d = new Date(isoDate);
    return `due: ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
}

export function isOverdue(todo: TodoItem): boolean {
    if (todo.completed || !todo.dueDate) return false;
    const target = startOfDay(new Date(todo.dueDate));
    const today = startOfDay(new Date());
    return target.getTime() < today.getTime();
}

export function migrateTodoItem(item: any): TodoItem {
    return {
        id: item.id,
        text: item.text,
        completed: item.completed ?? false,
        createdAt: item.createdAt ?? new Date().toISOString(),
        completedAt: item.completedAt,
        dueDate: item.dueDate,
    };
}

export function lineThroughText(text: string): string {
    return text
        .split('')
        .map((char) => char + '\u0336')
        .join('');
}
