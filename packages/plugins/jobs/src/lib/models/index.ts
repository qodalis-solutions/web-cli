export interface JobDto {
    id: string;
    name: string;
    description: string;
    group?: string;
    status: 'active' | 'paused' | 'stopped';
    schedule?: string;
    interval?: number;
    maxRetries: number;
    timeout?: number;
    overlapPolicy: string;
    currentExecutionId?: string;
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
}
