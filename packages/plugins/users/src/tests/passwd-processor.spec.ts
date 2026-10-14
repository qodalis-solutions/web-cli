import { ICliAuthService_TOKEN, ICliUsersStoreService_TOKEN } from '@qodalis/cli-core';
import { of } from 'rxjs';
import { CliPasswdCommandProcessor } from '../lib/processors/cli-passwd-command-processor';

const ALICE = { id: 'u1', name: 'alice', email: 'a@b.com', groups: [], createdAt: 0, updatedAt: 0 };
const BOB = { id: 'u2', name: 'bob', email: 'b@b.com', groups: [], createdAt: 0, updatedAt: 0 };
const ROOT = { id: 'u0', name: 'root', email: 'r@b.com', groups: ['admin'], createdAt: 0, updatedAt: 0 };

function setup(currentUser: any, passwords: (string | null)[]) {
    const authService = {
        verifyPassword: jasmine.createSpy('verifyPassword').and.resolveTo(true),
        setPassword: jasmine.createSpy('setPassword').and.resolveTo(undefined),
        validatePassword: () => null,
    };
    const usersStore = {
        getUser: (name: string) => of([ALICE, BOB, ROOT].find((u) => u.name === name)),
    };
    const services: Record<string, any> = {
        [ICliAuthService_TOKEN]: authService,
        [ICliUsersStoreService_TOKEN]: usersStore,
    };
    const queue = [...passwords];
    const errors: string[] = [];
    const context: any = {
        userSession: { user: currentUser, loginTime: 0, lastActivity: 0 },
        services: { getRequired: (t: string) => services[t] },
        reader: { readPassword: () => Promise.resolve(queue.shift() ?? null) },
        writer: {
            writeError: (m: string) => errors.push(m),
            writeSuccess: () => {},
        },
    };
    return { authService, context, errors };
}

describe('CliPasswdCommandProcessor', () => {
    it('forwards the current password when a user changes their own password', async () => {
        const { authService, context, errors } = setup(ALICE, ['oldpass', 'newpass', 'newpass']);
        const processor = new CliPasswdCommandProcessor();
        await processor.initialize(context);

        await processor.processCommand({ command: 'passwd', value: '' } as any, context);

        expect(errors).toEqual([]);
        expect(authService.verifyPassword).toHaveBeenCalledWith('u1', 'oldpass');
        expect(authService.setPassword).toHaveBeenCalledWith('u1', 'newpass', 'oldpass');
    });

    it('does not send a current password when an admin changes another user\'s password', async () => {
        const { authService, context, errors } = setup(ROOT, ['bobnew', 'bobnew']);
        const processor = new CliPasswdCommandProcessor();
        await processor.initialize(context);

        await processor.processCommand({ command: 'passwd', value: 'bob' } as any, context);

        expect(errors).toEqual([]);
        expect(authService.verifyPassword).not.toHaveBeenCalled();
        expect(authService.setPassword).toHaveBeenCalledWith('u2', 'bobnew', undefined);
    });

    it('stops when the current password prompt is cancelled', async () => {
        const { authService, context } = setup(ALICE, [null]);
        const processor = new CliPasswdCommandProcessor();
        await processor.initialize(context);

        await processor.processCommand({ command: 'passwd', value: '' } as any, context);

        expect(authService.verifyPassword).not.toHaveBeenCalled();
        expect(authService.setPassword).not.toHaveBeenCalled();
    });
});
