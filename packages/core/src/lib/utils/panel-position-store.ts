import { CliPanelPosition } from '../models';

const STORAGE_KEY = 'cli-panel-position';
const POSITION_CYCLE: CliPanelPosition[] = ['bottom', 'right', 'top', 'left'];

/**
 * Load the user's saved panel position from localStorage.
 * Returns null if no preference is saved or localStorage is unavailable.
 */
export function loadPanelPosition(): CliPanelPosition | null {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored && POSITION_CYCLE.includes(stored as CliPanelPosition)) {
            return stored as CliPanelPosition;
        }
    } catch {
        // localStorage unavailable (SSR, security restrictions)
    }
    return null;
}

/**
 * Save the user's panel position preference to localStorage.
 */
export function savePanelPosition(position: CliPanelPosition): void {
    try {
        localStorage.setItem(STORAGE_KEY, position);
    } catch {
        // localStorage unavailable
    }
}

/**
 * Get the next position in the cycle: bottom -> right -> top -> left -> bottom
 */
export function nextPanelPosition(current: CliPanelPosition): CliPanelPosition {
    const index = POSITION_CYCLE.indexOf(current);
    if (index === -1) {
        return POSITION_CYCLE[0];
    }
    return POSITION_CYCLE[(index + 1) % POSITION_CYCLE.length];
}
