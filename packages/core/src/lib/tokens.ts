import { createCliToken } from './models/services';
import type { ICliAuditService } from './interfaces/audit';
import type { ICliAuthorizationService, ICliPermissionRegistry } from './interfaces/authorization';
import type { ICliCompletionProvider } from './interfaces/completion';
import type { ICliDragDropService } from './interfaces/drag-drop';
import type { ICliFilePickerProvider } from './interfaces/file-picker';
import type { ICliFileTransferService } from './interfaces/file-transfer';
import type { ICliHttpClient } from './interfaces/http-client';
import type { ICliPermissionService } from './interfaces/permissions';
import type { ICliTranslationService } from './interfaces/services';
import type { ICliSessionsService } from './interfaces/sessions';
import type { ICliKeyValueStore } from './interfaces/state-store';
import type { ICliUserEventService } from './interfaces/user-events';
import type { ICliAuthService, ICliGroupsStoreService, ICliUserSessionService, ICliUsersStoreService } from './interfaces/users';

// ---------------------------------------------------------------------------
// Central registry of all service injection tokens.
// Each token is a typed string key: ICliServiceProvider.get(TOKEN) returns
// the service's type without a type argument.
// ---------------------------------------------------------------------------

/**
 * Token for the CLI user session service.
 */
export const ICliUserSessionService_TOKEN = createCliToken<ICliUserSessionService>('cli-user-session-service');

/**
 * Token for the CLI users store service.
 */
export const ICliUsersStoreService_TOKEN = createCliToken<ICliUsersStoreService>('cli-users-store-service');

/**
 * Token for the CLI groups store service.
 */
export const ICliGroupsStoreService_TOKEN = createCliToken<ICliGroupsStoreService>('cli-groups-store-service');

/**
 * Token for the CLI auth service.
 */
export const ICliAuthService_TOKEN = createCliToken<ICliAuthService>('cli-auth-service');

/**
 * Token for registering completion providers via module services (multi: true).
 */
export const ICliCompletionProvider_TOKEN = createCliToken<ICliCompletionProvider>('cli-completion-provider');

/**
 * Token for the drag-and-drop service.
 */
export const ICliDragDropService_TOKEN = createCliToken<ICliDragDropService>('cli-drag-drop-service');

/**
 * Token for the file transfer service.
 */
export const ICliFileTransferService_TOKEN = createCliToken<ICliFileTransferService>('cli-file-transfer-service');

/**
 * Token for the translation service.
 */
export const ICliTranslationService_TOKEN = createCliToken<ICliTranslationService>('cli-translation-service');

/**
 * Token for the permission service.
 */
export const ICliPermissionService_TOKEN = createCliToken<ICliPermissionService>('cli-permission-service');

/**
 * Token for the file picker provider.
 */
export const ICliFilePickerProvider_TOKEN = createCliToken<ICliFilePickerProvider>('cli-file-picker-provider');

/**
 * Token for the HTTP client service.
 */
export const ICliHttpClient_TOKEN = createCliToken<ICliHttpClient>('cli-http-client');

/**
 * Token for the user event service (lifecycle events).
 */
export const ICliUserEventService_TOKEN = createCliToken<ICliUserEventService>('cli-user-event-service');

/**
 * Token for the audit service (persistent event logging).
 */
export const ICliAuditService_TOKEN = createCliToken<ICliAuditService>('cli-audit-service');

/**
 * Token for the authorization service ({@link ICliAuthorizationService}).
 * Provided by an auth module (e.g. `@qodalis/cli-users`); absent otherwise.
 */
export const ICliAuthorizationService_TOKEN = createCliToken<ICliAuthorizationService>('cli-authorization-service');

/**
 * Token for the permission registry ({@link ICliPermissionRegistry}).
 * Always provided by the CLI engine.
 */
export const ICliPermissionRegistry_TOKEN = createCliToken<ICliPermissionRegistry>('cli-permission-registry');

/**
 * Token for the sessions service ({@link ICliSessionsService}).
 */
export const ICliSessionsService_TOKEN = createCliToken<ICliSessionsService>('cli-sessions-service');

/**
 * Token for the persistent key-value store used by modules (setup state, etc.).
 */
export const ICliKeyValueStore_TOKEN = createCliToken<ICliKeyValueStore>('cli-key-value-store');
