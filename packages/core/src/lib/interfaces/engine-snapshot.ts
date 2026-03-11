/**
 * Represents a serialized snapshot of a CLI engine's state.
 * Used to duplicate terminal tabs with full state preservation.
 */
export interface CliEngineSnapshot {
    /** Schema version for forward compatibility */
    version: 1;
    /** Timestamp (ms since epoch) when the snapshot was taken */
    timestamp: number;
    /** Serialized terminal state */
    terminal: {
        /** Terminal buffer serialized via @xterm/addon-serialize */
        serializedBuffer: string;
        /** Terminal column count at time of snapshot */
        cols: number;
        /** Terminal row count at time of snapshot */
        rows: number;
    };
    /** Command history entries (most recent last) */
    commandHistory: string[];
    /** Named state store entries */
    stateStores: Array<{
        name: string;
        state: Record<string, any>;
    }>;
}
