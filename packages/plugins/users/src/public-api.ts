/*
 * Public API Surface of @qodalis/cli-users
 */

export * from './lib/processors';
export * from './lib/services';
export * from './lib/backend';
export * from './lib/models/users-module-config';
export { withUnauthorizedHandler, isUnauthorizedError } from './lib/utils/server-http';
export { createPasswordPolicyValidator } from './lib/utils/password-policy';
export type { CliUsersRuntime } from './lib/module/users-runtime';
export {
    usersGuards,
    requireAuthGuard,
    requiredGroupsGuard,
    requiredPermissionsGuard,
} from './lib/guards/users-guards';

import {
    ICliAuthorizationService,
    ICliAuthorizationService_TOKEN,
    CliPermissionDefinition,
    ICliCommandGuard,
    ICliConfigurableModule,
    ICliModule,
    ICliUserSessionService_TOKEN,
} from '@qodalis/cli-core';
import { CliUsersModuleConfig } from './lib/models/users-module-config';
import { LIBRARY_VERSION, API_VERSION } from './lib/version';
import {
    CliAddUserCommandProcessor,
    CliAuditCommandProcessor,
    CliGroupaddCommandProcessor,
    CliGroupdelCommandProcessor,
    CliGroupmodCommandProcessor,
    CliGroupsCommandProcessor,
    CliIdCommandProcessor,
    CliLastCommandProcessor,
    CliListUsersCommandProcessor,
    CliLoginCommandProcessor,
    CliLogoutCommandProcessor,
    CliPasswdCommandProcessor,
    CliPermsCommandProcessor,
    CliSessionKickCommandProcessor,
    CliSessionsCommandProcessor,
    CliSwitchUserCommandProcessor,
    CliUserdelCommandProcessor,
    CliUsermodCommandProcessor,
    CliWhoamiCommandProcessor,
    CliWhoCommandProcessor,
} from './lib/processors';
import { CliUsersRuntime, createUsersRuntime } from './lib/module/users-runtime';
import {
    bindSessionToContext,
    bindTermination,
    listenForKicks,
    startExpiryWatch,
    wrapProcessors,
} from './lib/module/session-lifecycle';
import { promptBootLogin, restoreOrAutoLogin } from './lib/module/boot-login';
import { runFirstRunWizard } from './lib/module/first-run';
import { CliUserSessionService } from './lib/services/cli-user-session.service';
import { passwordChangeGuard } from './lib/module/password-change';

/** Authorization used while the users module is starting or after it failed: denies everything. */
const denyAllAuthorization: ICliAuthorizationService = {
    getPrincipal: () => undefined,
    can: () => false,
    canAccess: () => false,
};

/** Permissions used by the users module (granted through groups). */
export const usersPermissionDefinitions: CliPermissionDefinition[] = [
    { name: 'users:read', description: 'List and view users' },
    { name: 'users:create', description: 'Create users' },
    { name: 'users:update', description: 'Change users, reset passwords, enable/disable' },
    { name: 'users:delete', description: 'Delete users' },
    { name: 'groups:read', description: 'View group members' },
    { name: 'groups:create', description: 'Create groups (roles)' },
    { name: 'groups:update', description: 'Change group permissions and members' },
    { name: 'groups:delete', description: 'Delete groups' },
    { name: 'sessions:read', description: 'List all sessions' },
    { name: 'sessions:revoke', description: "Terminate other users' sessions" },
    { name: 'audit:read', description: 'Read the audit log' },
    { name: 'audit:clear', description: 'Clear the audit log' },
];

/**
 * Local mode: every command counts as activity. Slides the idle timeout and
 * ends an expired session before the command's access checks run.
 */
const sessionActivityGuard: ICliCommandGuard = {
    name: 'users:session-activity',
    priority: -1000,
    appliesTo: (_processor, _command, context) => {
        const session = context.services.get<unknown>(ICliUserSessionService_TOKEN);
        return session instanceof CliUserSessionService && session.isLocal && !!session.getToken();
    },
    canActivate: async (_command, _processor, context) => {
        const session = context.services.get<CliUserSessionService>(ICliUserSessionService_TOKEN)!;
        const stillValid = await session.touch();
        if (!stillValid) context.writer.writeWarning('Session expired. Please log in again.');
        return true;
    },
};

interface ICliUsersModule extends ICliConfigurableModule<CliUsersModuleConfig> {
    /** Services and state for this CLI instance (set in onInit) */
    _runtime?: CliUsersRuntime;
}

export const usersModule: ICliUsersModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-users',
    version: LIBRARY_VERSION,
    priority: Number.MAX_SAFE_INTEGER,
    description: 'Users, groups (roles), permissions, sessions and audit — local or server backed',
    processors: [
        new CliWhoamiCommandProcessor(),
        new CliIdCommandProcessor(),
        new CliGroupsCommandProcessor(),
        new CliPermsCommandProcessor(),
        new CliLoginCommandProcessor(),
        new CliLogoutCommandProcessor(),
        new CliSwitchUserCommandProcessor(),
        new CliPasswdCommandProcessor(),
        new CliAddUserCommandProcessor(),
        new CliUserdelCommandProcessor(),
        new CliUsermodCommandProcessor(),
        new CliListUsersCommandProcessor(),
        new CliGroupaddCommandProcessor(),
        new CliGroupdelCommandProcessor(),
        new CliGroupmodCommandProcessor(),
        new CliWhoCommandProcessor(),
        new CliSessionsCommandProcessor(),
        new CliSessionKickCommandProcessor(),
        new CliLastCommandProcessor(),
        new CliAuditCommandProcessor(),
    ],
    permissions: usersPermissionDefinitions,
    guards: [sessionActivityGuard, passwordChangeGuard],

    translations: {
        es: { 'cli.users.description': 'Gestión de usuarios y grupos con autenticación' },
        fr: { 'cli.users.description': 'Gestion des utilisateurs et groupes avec authentification' },
        de: { 'cli.users.description': 'Benutzer- und Gruppenverwaltung mit Authentifizierung' },
        pt: { 'cli.users.description': 'Gerenciamento de usuários e grupos com autenticação' },
        it: { 'cli.users.description': 'Gestione utenti e gruppi con autenticazione' },
        ja: { 'cli.users.description': '認証付きユーザーとグループの管理' },
        ko: { 'cli.users.description': '인증 기반 사용자 및 그룹 관리' },
        zh: { 'cli.users.description': '带身份认证的用户和组管理' },
        ru: { 'cli.users.description': 'Управление пользователями и группами с аутентификацией' },
        ro: { 'cli.users.description': 'Gestionare utilizatori și grupuri cu autentificare' },
    },

    configure(config: CliUsersModuleConfig): ICliModule {
        return { ...this, config };
    },

    async onInit(context) {
        const config = (this.config || {}) as CliUsersModuleConfig;
        // Fail closed: until the runtime is up (or if it fails to start), every
        // protected command and file is denied instead of silently allowed.
        context.services.set([{ provide: ICliAuthorizationService_TOKEN, useValue: denyAllAuthorization }]);
        let runtime: CliUsersRuntime;
        try {
            runtime = await createUsersRuntime(context, config);
        } catch (e: any) {
            context.writer?.writeError?.(`users: failed to start (${e?.message ?? e}); access is denied until this is fixed`);
            throw e;
        }
        this._runtime = runtime;

        bindSessionToContext(context, runtime);
        const termination = bindTermination(context, runtime);
        this.processors = wrapProcessors(this.processors ?? [], runtime, termination);

        // Seed configured users (local mode; servers seed themselves). Seeds come from
        // the app's own config, so they may use short passwords; without an explicit
        // defaultPassword they must choose a new one at first sign-in.
        if (runtime.local && config.seedUsers?.length) {
            const weak = !config.defaultPassword || ['root', 'admin', 'password'].includes(config.defaultPassword);
            if (weak) {
                context.writer?.writeWarning?.(
                    'users: seeded accounts use a default password; change it before storing real data',
                );
            }
            for (const seed of config.seedUsers) {
                if (runtime.local.findUserPublic(seed.name)) continue;
                try {
                    await runtime.local.createUserInternal({
                        ...seed,
                        homeDir: seed.homeDir ?? `/home/${seed.name}`,
                        password: config.defaultPassword || 'root',
                        mustChangePassword: !config.defaultPassword,
                        skipPasswordPolicy: true,
                    });
                } catch (e: any) {
                    context.writer?.writeWarning?.(`users: could not seed '${seed.name}': ${e?.message ?? e}`);
                }
            }
        }

        await restoreOrAutoLogin(context, runtime);
        startExpiryWatch(runtime);
        listenForKicks(context, runtime);
    },

    async onSetup(context) {
        const runtime = this._runtime;
        // First boot in local mode with no accounts at all (no seedUsers): run the wizard
        if (runtime?.local && !runtime.local.hasUsers()) {
            await runFirstRunWizard(context, runtime);
        }
        return true;
    },

    async onAfterBoot(context) {
        const runtime = this._runtime;
        if (!runtime) return;
        if (runtime.config.requirePasswordOnBoot && !runtime.session.current) {
            await promptBootLogin(context, runtime);
        }
    },

    async onDestroy() {
        const runtime = this._runtime;
        if (!runtime) return;
        runtime.subscriptions.forEach((s) => s.unsubscribe());
        runtime.disposers.forEach((dispose) => dispose());
        runtime.backend.dispose?.();
        delete this._runtime;
    },
};
