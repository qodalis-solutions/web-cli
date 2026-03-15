import {
    JobDto,
    JobExecutionDto,
    JobHistoryResponse,
    UpdateJobRequest,
} from '../models';

export class CliJobsService {
    constructor(
        private baseUrl: string,
        private headers: Record<string, string> = {},
    ) {}

    private async request<T>(path: string, init?: RequestInit): Promise<T> {
        const url = `${this.baseUrl}/api/v1/qcli/jobs${path}`;
        const response = await fetch(url, {
            ...init,
            headers: {
                'Content-Type': 'application/json',
                ...this.headers,
                ...((init?.headers as Record<string, string>) ?? {}),
            },
        });

        if (!response.ok) {
            let errorMessage = `${response.status} ${response.statusText}`;
            try {
                const body = await response.json();
                if (body.error) {
                    errorMessage = body.error;
                }
            } catch {
                // use default error message
            }
            throw new Error(errorMessage);
        }

        const text = await response.text();
        if (!text) {
            return undefined as T;
        }
        return JSON.parse(text) as T;
    }

    async listJobs(): Promise<JobDto[]> {
        return this.request<JobDto[]>('');
    }

    async getJob(id: string): Promise<JobDto> {
        return this.request<JobDto>(`/${encodeURIComponent(id)}`);
    }

    async triggerJob(id: string): Promise<void> {
        await this.request<void>(`/${encodeURIComponent(id)}/trigger`, {
            method: 'POST',
        });
    }

    async pauseJob(id: string): Promise<void> {
        await this.request<void>(`/${encodeURIComponent(id)}/pause`, {
            method: 'POST',
        });
    }

    async resumeJob(id: string): Promise<void> {
        await this.request<void>(`/${encodeURIComponent(id)}/resume`, {
            method: 'POST',
        });
    }

    async stopJob(id: string): Promise<void> {
        await this.request<void>(`/${encodeURIComponent(id)}/stop`, {
            method: 'POST',
        });
    }

    async cancelJob(id: string): Promise<void> {
        await this.request<void>(`/${encodeURIComponent(id)}/cancel`, {
            method: 'POST',
        });
    }

    async updateJob(id: string, request: UpdateJobRequest): Promise<void> {
        await this.request<void>(`/${encodeURIComponent(id)}`, {
            method: 'PUT',
            body: JSON.stringify(request),
        });
    }

    async getHistory(
        id: string,
        opts?: { limit?: number; offset?: number; status?: string },
    ): Promise<JobHistoryResponse> {
        const params = new URLSearchParams();
        if (opts?.limit != null) params.set('limit', String(opts.limit));
        if (opts?.offset != null) params.set('offset', String(opts.offset));
        if (opts?.status) params.set('status', opts.status);
        const qs = params.toString();
        return this.request<JobHistoryResponse>(
            `/${encodeURIComponent(id)}/history${qs ? `?${qs}` : ''}`,
        );
    }

    async getExecution(
        jobId: string,
        execId: string,
    ): Promise<JobExecutionDto> {
        return this.request<JobExecutionDto>(
            `/${encodeURIComponent(jobId)}/history/${encodeURIComponent(execId)}`,
        );
    }
}
