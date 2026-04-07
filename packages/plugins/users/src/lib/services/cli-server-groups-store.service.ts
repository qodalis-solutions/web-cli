import {
    ICliGroupsStoreService,
    ICliGroup,
    ICliUser,
    ICliHttpClient,
} from '@qodalis/cli-core';
import { Observable, from } from 'rxjs';

export class CliServerGroupsStoreService implements ICliGroupsStoreService {
    constructor(
        private readonly baseUrl: string,
        private readonly http: ICliHttpClient,
        private readonly getHeaders: () => Record<string, string>,
    ) {}

    getGroups(): Observable<ICliGroup[]> {
        return from(
            this.http.get<ICliGroup[]>(`${this.baseUrl}/groups`, {
                headers: this.getHeaders(),
            }),
        );
    }

    getGroup(id: string): Observable<ICliGroup | undefined> {
        return from(
            this.http
                .get<ICliGroup>(
                    `${this.baseUrl}/groups/${encodeURIComponent(id)}`,
                    { headers: this.getHeaders() },
                )
                .catch(() => undefined),
        );
    }

    async createGroup(name: string, description?: string): Promise<ICliGroup> {
        return this.http.post<ICliGroup>(
            `${this.baseUrl}/groups`,
            { name, description },
            { headers: { ...this.getHeaders(), 'Content-Type': 'application/json' } },
        );
    }

    async deleteGroup(id: string): Promise<void> {
        await this.http.delete(
            `${this.baseUrl}/groups/${encodeURIComponent(id)}`,
            { headers: this.getHeaders() },
        );
    }

    getGroupMembers(groupId: string): Observable<ICliUser[]> {
        return from(
            this.http.get<ICliUser[]>(
                `${this.baseUrl}/groups/${encodeURIComponent(groupId)}/members`,
                { headers: this.getHeaders() },
            ),
        );
    }
}
