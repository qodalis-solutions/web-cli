export interface JobDto {
    id: string;
    name: string;
    description: string;
    group?: string;
    /** Free-form labels to filter jobs by (servers with job tags; missing on older servers). */
    tags?: string[];
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
    /** Replaces the job's tags; `null` clears them. */
    tags?: string[] | null;
    schedule?: string;
    interval?: string;
    maxRetries?: number;
    timeout?: string;
    overlapPolicy?: string;
    maxConcurrentRuns?: number;
}

/** A run in a cross-job list (`GET /executions`): without its logs. */
export interface JobRunListResponse {
    items: JobExecutionDto[];
    total: number;
    limit: number;
    offset: number;
}

/** Counts and durations of a set of runs (`GET /stats`). */
export interface JobRunSummaryDto {
    total: number;
    succeeded: number;
    failed: number;
    cancelled: number;
    running: number;
    /** 0..1, or null without finished runs */
    successRate: number | null;
    avgDuration: number | null;
    p95Duration: number | null;
    maxDuration: number | null;
    lastFailureAt: string | null;
}

export interface JobStatsBucketDto {
    start: string;
    succeeded: number;
    failed: number;
    cancelled: number;
    running: number;
}

export interface JobStatsJobDto extends JobRunSummaryDto {
    jobId: string;
    jobName: string;
    recent: { id: string; status: string; startedAt: string; duration: number | null }[];
}

/** `GET /api/v1/qcli/jobs/stats` (servers 1.0.0-beta.19): runs of the last 24 hours by default. */
export interface JobStatsResponse {
    since: string;
    until: string;
    bucketMs: number;
    buckets: JobStatsBucketDto[];
    totals: JobRunSummaryDto;
    jobs: JobStatsJobDto[];
}
