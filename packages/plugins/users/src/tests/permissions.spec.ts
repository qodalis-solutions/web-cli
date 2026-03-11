import { requireAdmin, requireSelfOrAdmin } from '../lib/utils/permissions';
import { ICliExecutionContext } from '@qodalis/cli-core';

function createMockContext(userSession?: any): ICliExecutionContext {
    return {
        userSession,
        writer: {
            writeError: jasmine.createSpy('writeError'),
        },
    } as any;
}

describe('Permission helpers', () => {
    // ---------- requireAdmin ----------

    describe('requireAdmin', () => {
        it('should return true for admin user', () => {
            const context = createMockContext({
                user: {
                    id: 'root',
                    name: 'root',
                    email: 'root@localhost',
                    groups: ['admin'],
                    createdAt: 1000,
                    updatedAt: 1000,
                },
                loginTime: Date.now(),
                lastActivity: Date.now(),
            });

            expect(requireAdmin(context)).toBe(true);
            expect(context.writer.writeError).not.toHaveBeenCalled();
        });

        it('should return false and write error for non-admin user', () => {
            const context = createMockContext({
                user: {
                    id: 'u1',
                    name: 'alice',
                    email: 'alice@test.com',
                    groups: ['dev'],
                    createdAt: 1000,
                    updatedAt: 1000,
                },
                loginTime: Date.now(),
                lastActivity: Date.now(),
            });

            expect(requireAdmin(context)).toBe(false);
            expect(context.writer.writeError).toHaveBeenCalledWith(
                'permission denied',
            );
        });

        it('should return false when no session', () => {
            const context = createMockContext(undefined);

            expect(requireAdmin(context)).toBe(false);
            expect(context.writer.writeError).toHaveBeenCalledWith(
                'permission denied',
            );
        });

        it('should return false for user with empty groups', () => {
            const context = createMockContext({
                user: {
                    id: 'u1',
                    name: 'alice',
                    email: 'alice@test.com',
                    groups: [],
                    createdAt: 1000,
                    updatedAt: 1000,
                },
                loginTime: Date.now(),
                lastActivity: Date.now(),
            });

            expect(requireAdmin(context)).toBe(false);
            expect(context.writer.writeError).toHaveBeenCalledWith(
                'permission denied',
            );
        });
    });

    // ---------- requireSelfOrAdmin ----------

    describe('requireSelfOrAdmin', () => {
        it('should return true for self', () => {
            const context = createMockContext({
                user: {
                    id: 'u1',
                    name: 'alice',
                    email: 'alice@test.com',
                    groups: ['dev'],
                    createdAt: 1000,
                    updatedAt: 1000,
                },
                loginTime: Date.now(),
                lastActivity: Date.now(),
            });

            expect(requireSelfOrAdmin(context, 'u1')).toBe(true);
            expect(context.writer.writeError).not.toHaveBeenCalled();
        });

        it('should return true for admin', () => {
            const context = createMockContext({
                user: {
                    id: 'root',
                    name: 'root',
                    email: 'root@localhost',
                    groups: ['admin'],
                    createdAt: 1000,
                    updatedAt: 1000,
                },
                loginTime: Date.now(),
                lastActivity: Date.now(),
            });

            // Targeting a different user, but the current user is admin
            expect(requireSelfOrAdmin(context, 'u2')).toBe(true);
            expect(context.writer.writeError).not.toHaveBeenCalled();
        });

        it('should return false for other non-admin user', () => {
            const context = createMockContext({
                user: {
                    id: 'u1',
                    name: 'alice',
                    email: 'alice@test.com',
                    groups: ['dev'],
                    createdAt: 1000,
                    updatedAt: 1000,
                },
                loginTime: Date.now(),
                lastActivity: Date.now(),
            });

            expect(requireSelfOrAdmin(context, 'u2')).toBe(false);
            expect(context.writer.writeError).toHaveBeenCalledWith(
                'permission denied',
            );
        });

        it('should return false when no session', () => {
            const context = createMockContext(undefined);

            expect(requireSelfOrAdmin(context, 'u1')).toBe(false);
            expect(context.writer.writeError).toHaveBeenCalledWith(
                'permission denied',
            );
        });
    });
});
