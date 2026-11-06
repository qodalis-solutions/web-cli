export interface JobDto {
    id: string;
    name: string;
    description: string;
    group?: string;
    status: 'active' | 'paused' | 'stopped';
    schedule?: string;
    /** Milliseconds (.NET, Node) or a span such as `30s` (Python). */
    interval?: number | string;
    maxRetries: number;
    /** Milliseconds (.NET, Node) or a span such as `5m` (Python). */
    timeout?: number | string;
    overlapPolicy: string;
    /** Runs of the job that may go at the same time (servers 1.0.0-beta.23; 1 before). */
    maxConcurrentRuns?: number;
    /** The newest running run. */
    currentExecutionId?: string;
    /** Every running run, oldest first (servers 1.0.0-beta.23). */
    runningExecutionIds?: string[];
    /** A run waits for a free slot (overlap policy `queue`). */
    queued?: boolean;
    nextRunAt?: string;
    lastRunAt?: string;
    lastRunStatus?: string;
    lastRunDuration?: number;
}

export interface JobExecutionDto {
    id: string;
    jobId: string;
    jobName: string;
    status: 'running' | 'completed' | 'failed' | 'cancelled' | 'timed_out';
    startedAt: string;
    completedAt?: string;
    duration?: number;
    error?: string;
    retryAttempt: number;
    logCount?: number;
    logs?: JobLogEntryDto[];
}

export interface JobLogEntryDto {
    timestamp: string;
    level: 'debug' | 'info' | 'warning' | 'error';
    message: string;
}

export interface JobHistoryResponse {
    items: JobExecutionDto[];
    total: number;
    limit: number;
    offset: number;
}

export interface UpdateJobRequest {
    description?: string;
    group?: string;
    schedule?: string;
    interval?: string;
    maxRetries?: number;
    timeout?: string;
    overlapPolicy?: string;
    maxConcurrentRuns?: number;
}
