import {
    ICliUsersStoreService,
    ICliUser,
    ICliHttpClient,
    CliAddUser,
    CliUpdateUser,
} from '@qodalis/cli-core';
import { Observable, from } from 'rxjs';

export class CliServerUsersStoreService implements ICliUsersStoreService {
    constructor(
        private readonly baseUrl: string,
        private readonly http: ICliHttpClient,
        private readonly getHeaders: () => Record<string, string>,
    ) {}

    getUsers(options?: {
        query?: string;
        skip?: number;
        take?: number;
    }): Observable<ICliUser[]> {
        const params = new URLSearchParams();
        if (options?.query) params.set('query', options.query);
        if (options?.skip != null) params.set('skip', String(options.skip));
        if (options?.take != null) params.set('take', String(options.take));
        const qs = params.toString();
        const url = `${this.baseUrl}/users${qs ? '?' + qs : ''}`;

        return from(
            this.http.get<ICliUser[]>(url, {
                headers: this.getHeaders(),
            }),
        );
    }

    getUser(id: string): Observable<ICliUser | undefined> {
        return from(
            this.http
                .get<ICliUser>(
                    `${this.baseUrl}/users/${encodeURIComponent(id)}`,
                    { headers: this.getHeaders() },
                )
                .catch(() => undefined),
        );
    }

    async createUser(user: CliAddUser): Promise<ICliUser> {
        return this.http.post<ICliUser>(`${this.baseUrl}/users`, user, {
            headers: { ...this.getHeaders(), 'Content-Type': 'application/json' },
        });
    }

    async updateUser(id: string, updates: CliUpdateUser): Promise<ICliUser> {
        return this.http.put<ICliUser>(
            `${this.baseUrl}/users/${encodeURIComponent(id)}`,
            updates,
            {
                headers: { ...this.getHeaders(), 'Content-Type': 'application/json' },
            },
        );
    }

    async deleteUser(id: string): Promise<void> {
        await this.http.delete(
            `${this.baseUrl}/users/${encodeURIComponent(id)}`,
            { headers: this.getHeaders() },
        );
    }
}
