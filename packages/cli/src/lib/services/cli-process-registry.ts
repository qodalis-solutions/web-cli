import { ICliProcessEntry, ICliProcessRegistry, ICliProcessRegisterOptions } from '@qodalis/cli-core';

export const CliProcessRegistry_TOKEN = 'cli-process-registry';

interface InternalEntry extends ICliProcessEntry {
    abortController: AbortController;
    onKill?: () => Promise<void> | void;
}

export class CliProcessRegistry implements ICliProcessRegistry {
    private nextPid = 1;
    private processes = new Map<number, InternalEntry>();
    private _currentPid: number | undefined;
    private maxHistory = 50;

    get currentPid(): number | undefined {
        return this._currentPid;
    }

    register(command: string, options?: ICliProcessRegisterOptions): { pid: number; abortController: AbortController } {
        const pid = this.nextPid++;
        const abortController = new AbortController();
        const type = options?.type ?? 'command';
        this.processes.set(pid, {
            pid,
            name: options?.name ?? command,
            type,
            command,
            startTime: Date.now(),
            status: 'running',
            abortController,
            onKill: options?.onKill,
        });
        // Only foreground commands set currentPid
        if (type === 'command') {
            this._currentPid = pid;
        }
        this.pruneHistory();
        return { pid, abortController };
    }

    complete(pid: number, exitCode: number): void {
        const entry = this.processes.get(pid);
        if (entry && entry.status === 'running') {
            entry.status = 'completed';
            entry.exitCode = exitCode;
        }
        if (this._currentPid === pid) {
            this._currentPid = undefined;
        }
    }

    fail(pid: number): void {
        const entry = this.processes.get(pid);
        if (entry && entry.status === 'running') {
            entry.status = 'failed';
            entry.exitCode = -1;
        }
        if (this._currentPid === pid) {
            this._currentPid = undefined;
        }
    }

    kill(pid: number): boolean {
        const entry = this.processes.get(pid);
        if (!entry || entry.status !== 'running') return false;

        if (entry.onKill) {
            // Fire custom kill handler (e.g. background service stop)
            Promise.resolve(entry.onKill()).catch(() => {});
        }

        entry.abortController.abort();
        entry.status = 'killed';
        entry.exitCode = -9;
        if (this._currentPid === pid) {
            this._currentPid = undefined;
        }
        return true;
    }

    list(): ICliProcessEntry[] {
        return Array.from(this.processes.values()).map(
            ({ abortController, onKill, ...entry }) => entry,
        );
    }

    private pruneHistory(): void {
        const entries = Array.from(this.processes.entries());
        const completed = entries.filter(([, e]) => e.status !== 'running');
        if (completed.length > this.maxHistory) {
            const toRemove = completed.slice(0, completed.length - this.maxHistory);
            for (const [pid] of toRemove) {
                this.processes.delete(pid);
            }
        }
    }
}
