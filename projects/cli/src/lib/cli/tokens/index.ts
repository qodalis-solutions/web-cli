import { InjectionToken } from '@angular/core';
import {
  ICliCommandProcessor,
  ICliUserSessionService,
  ICliUsersStoreService,
} from '../models';

/**
 * Represents a command processor token for dependency injection
 */
export const CliCommandProcessor_TOKEN = new InjectionToken<
  ICliCommandProcessor[]
>('ICliCommandProcessor implementations');

/**
 * Represents a user session service token for dependency injection
 */
export const ICliUserSessionService_TOKEN = new InjectionToken<
  ICliUserSessionService[]
>('ICliUserSessionService implementation');

/**
 * Represents a user store service token for dependency injection
 */
export const ICliUsersStoreService_TOKEN = new InjectionToken<
  ICliUsersStoreService[]
>('ICliUsersStoreService implementation');
