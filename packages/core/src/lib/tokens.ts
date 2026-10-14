// ---------------------------------------------------------------------------
// Central registry of all service injection tokens.
// Each token is a string key used with ICliServiceProvider.get<T>(TOKEN).
// ---------------------------------------------------------------------------

/**
 * Token for the CLI user session service.
 */
export const ICliUserSessionService_TOKEN = 'cli-user-session-service';

/**
 * Token for the CLI users store service.
 */
export const ICliUsersStoreService_TOKEN = 'cli-users-store-service';

/**
 * Token for the CLI groups store service.
 */
export const ICliGroupsStoreService_TOKEN = 'cli-groups-store-service';

/**
 * Token for the CLI auth service.
 */
export const ICliAuthService_TOKEN = 'cli-auth-service';

/**
 * Token for registering completion providers via module services (multi: true).
 */
export const ICliCompletionProvider_TOKEN = 'cli-completion-provider';

/**
 * Token for the drag-and-drop service.
 */
export const ICliDragDropService_TOKEN = 'cli-drag-drop-service';

/**
 * Token for the file transfer service.
 */
export const ICliFileTransferService_TOKEN = 'cli-file-transfer-service';

/**
 * Token for the translation service.
 */
export const ICliTranslationService_TOKEN = 'cli-translation-service';

/**
 * Token for the permission service.
 */
export const ICliPermissionService_TOKEN = 'cli-permission-service';

/**
 * Token for the file picker provider.
 */
export const ICliFilePickerProvider_TOKEN = 'cli-file-picker-provider';

/**
 * Token for the HTTP client service.
 */
export const ICliHttpClient_TOKEN = 'cli-http-client';

/**
 * Token for the user event service (lifecycle events).
 */
export const ICliUserEventService_TOKEN = 'cli-user-event-service';

/**
 * Token for the audit service (persistent event logging).
 */
export const ICliAuditService_TOKEN = 'cli-audit-service';

/**
 * Token for the authorization service ({@link ICliAuthorizationService}).
 * Provided by an auth module (e.g. `@qodalis/cli-users`); absent otherwise.
 */
export const ICliAuthorizationService_TOKEN = 'cli-authorization-service';

/**
 * Token for the permission registry ({@link ICliPermissionRegistry}).
 * Always provided by the CLI engine.
 */
export const ICliPermissionRegistry_TOKEN = 'cli-permission-registry';

/**
 * Token for the sessions service ({@link ICliSessionsService}).
 */
export const ICliSessionsService_TOKEN = 'cli-sessions-service';

/**
 * Token for the persistent key-value store used by modules (setup state, etc.).
 */
export const ICliKeyValueStore_TOKEN = 'cli-key-value-store';
