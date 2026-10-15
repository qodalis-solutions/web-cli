import {
    cliCanAccess,
    ICliAuthorizationService,
    ICliAuthorizationService_TOKEN,
    ICliExecutionContext,
    ICliOwnership,
    ICliUserSession,
    ICliUserSessionService,
    ICliUserSessionService_TOKEN,
} from '@qodalis/cli-core';
import { Subscription } from 'rxjs';
import { CliFileAccessPolicy, IFileSystemService } from '../interfaces/i-file-system-service';
import { SYSTEM_OWNERSHIP } from './indexed-db-file-system.service';

/** Permissions the files module understands. */
export const CliFilesPermissions = {
    /** Bypass all file permission checks */
    Admin: 'files:admin',
    /** chmod/chown files you do not own */
    Chown: 'files:chown',
} as const;

/** Mode for newly created home directories (owner full, group read/traverse) */
export const HOME_DIR_PERMISSIONS = 'rwxr-x---';

function authorization(context: ICliExecutionContext): ICliAuthorizationService | undefined {
    try {
        return context.services.get<ICliAuthorizationService>(ICliAuthorizationService_TOKEN);
    } catch {
        return undefined;
    }
}

/**
 * Access policy built on the generic authorization layer. Allows everything
 * when no authorization service is registered (no auth module loaded).
 */
export function createFileAccessPolicy(context: ICliExecutionContext): CliFileAccessPolicy {
    return {
        // Nodes without an owner (system seed, legacy data) belong to root:admin
        canAccess: (node, action) =>
            cliCanAccess(
                context,
                node.ownership ? node : { ...node, ownership: SYSTEM_OWNERSHIP },
                action,
                [CliFilesPermissions.Admin],
            ),
        canChangeOwnership: (node, newOwnership?: ICliOwnership) => {
            const auth = authorization(context);
            if (!auth) return true;
            if (auth.can(CliFilesPermissions.Admin) || auth.can(CliFilesPermissions.Chown)) return true;
            const principal = auth.getPrincipal();
            if (!principal) return false;
            // Unowned nodes belong to root: claiming them needs files:chown
            const owns = !!node.ownership && (node.ownership.uid === principal.name || node.ownership.uid === principal.id);
            // Owners may change mode and group, but not give files away
            const keepsOwner = !newOwnership || newOwnership.uid === node.ownership?.uid || newOwnership.uid === principal.name;
            return owns && keepsOwner;
        },
    };
}

/**
 * Follow the signed-in user (from any auth module that provides
 * {@link ICliUserSessionService}): ownership for new files, home directory
 * creation and `~`, and moving to the home directory when the user changes.
 */
export function followUserSession(context: ICliExecutionContext, fs: IFileSystemService): Subscription | undefined {
    let sessions: ICliUserSessionService | undefined;
    try {
        sessions = context.services.get<ICliUserSessionService>(ICliUserSessionService_TOKEN);
    } catch {
        sessions = undefined;
    }
    if (!sessions) return undefined;

    let previousUser: string | null = null;
    return sessions.getUserSession().subscribe((session: ICliUserSession | undefined) => {
        if (!session?.user) {
            fs.setCurrentUser('', []);
            // Signed out (or restored signed out): don't stay in someone's home
            if (previousUser !== null || !canEnter(fs, fs.getCurrentDirectory())) {
                try {
                    fs.setCurrentDirectory('/');
                    void fs.persist(); // the next boot's first prompt starts at /
                } catch {
                    // keep the current directory
                }
            }
            previousUser = null;
            return;
        }
        const user = session.user;
        fs.setCurrentUser(user.name, user.groups ?? []);
        if (user.homeDir) {
            const home = user.homeDir;
            const system = <T>(fn: () => T): T => (fs.runAsSystem ? fs.runAsSystem(fn) : fn());
            if (!fs.exists(home)) {
                system(() => {
                    fs.createDirectory(home, true);
                    if (home !== '/') {
                        fs.chown(home, { uid: user.name, gid: user.groups?.[0] ?? 'users' });
                        fs.chmod(home, HOME_DIR_PERMISSIONS);
                    }
                });
                void fs.persist();
            }
            fs.setHomePath(home);
            if (previousUser !== user.id) {
                try {
                    fs.setCurrentDirectory(home);
                } catch {
                    // not accessible: stay where we are
                }
            }
        }
        previousUser = user.id;
    });
}

/** Same check as `cd`: traverse the parents and execute the directory itself */
function canEnter(fs: IFileSystemService, path: string): boolean {
    try {
        fs.setCurrentDirectory(path);
        return true;
    } catch {
        return false;
    }
}
