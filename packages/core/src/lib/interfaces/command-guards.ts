import { createCliToken } from '../models/services';
import { CliProcessCommand } from '../models';
import { ICliCommandProcessor } from './command-processor';
import { ICliExecutionContext } from './execution-context';

/**
 * Result of a guard check.
 *
 * - `true` or `undefined`: allow the command.
 * - `false`: block it with the generic message `<command>: permission denied`.
 * - a non-empty `string`: block it and print this message.
 * - `{ allowed, message }`: explicit form; `message` is used when `allowed` is false.
 */
export type CliCommandGuardResult =
    | boolean
    | string
    | void
    | { allowed: boolean; message?: string };

/**
 * A global command guard: a check that runs before **every** command, across
 * all processors and modules, and can block it.
 *
 * Use guards for cross-cutting policies such as authentication, permission
 * checks, feature flags, maintenance windows or rate limiting, instead of
 * repeating the check inside each processor.
 *
 * ## When guards run
 *
 * For each command the executor:
 * 1. parses the input and resolves the processor (and sub-processor);
 * 2. handles global parameters such as `--help` (help is never guarded);
 * 3. extracts the positional value into `command.value`;
 * 4. **runs the guards**;
 * 5. validates required values/parameters, runs processor hooks and finally
 *    calls `processCommand`.
 *
 * Guards run in ascending `priority` (default `0`). For each guard the executor
 * calls `appliesTo` (if defined) and skips the guard when it returns `false`;
 * otherwise it awaits `canActivate`. The **first** guard that blocks stops the
 * chain: its message is written as an error and the command exits with code
 * `-1`. A guard that throws (in `appliesTo` or `canActivate`) also blocks the
 * command, so a broken guard fails closed.
 *
 * ## Access to the context
 *
 * Both `appliesTo` and `canActivate` receive the {@link ICliExecutionContext}
 * of the command about to run, so a guard can:
 * - resolve services with `context.services.get(...)` / `getRequired(...)`
 *   (e.g. a policy, feature-flag or permission service registered by any
 *   module) to decide **what** should be guarded and **whether** it may run;
 * - inspect `context.userSession` for the signed-in user and their groups;
 * - read the processor's `metadata` (for example `requireAuth` or
 *   `requiredGroups`) and the parsed `command` (`command.value`, `command.args`);
 * - prompt the user via `context.reader` (e.g. a confirmation guard).
 *
 * Guards should not write to the terminal to report a denial; return a message
 * instead so the executor prints it consistently.
 *
 * ## Registering guards
 *
 * The preferred way is the module's `guards` array; the boot sequence
 * registers each entry as a multi-provider under {@link ICliCommandGuard_TOKEN}.
 * Several modules can contribute guards; all of them run.
 *
 * ```ts
 * const billingModule: ICliModule = {
 *     apiVersion: 2,
 *     name: 'billing',
 *     processors: [new InvoiceProcessor()],
 *     guards: [billingGuard],
 * };
 * ```
 *
 * Guards can also be added at runtime (e.g. from `onInit`):
 *
 * ```ts
 * context.services.set({ provide: ICliCommandGuard_TOKEN, useValue: myGuard, multi: true });
 * ```
 *
 * ## Example: policy resolved from a service
 *
 * ```ts
 * const featureFlagGuard: ICliCommandGuard = {
 *     name: 'feature-flags',
 *     // Only guard commands that are behind a flag; the flag list comes from a service
 *     appliesTo: (processor, _command, context) =>
 *         context.services.get<FeatureFlags>(FeatureFlags_TOKEN)?.isFlagged(processor.command) ?? false,
 *     canActivate: async (_command, processor, context) => {
 *         const flags = context.services.getRequired<FeatureFlags>(FeatureFlags_TOKEN);
 *         return (await flags.isEnabled(processor.command, context.userSession?.user))
 *             ? true
 *             : `${processor.command}: not available for your account`;
 *     },
 * };
 * ```
 *
 * ## Without a guard-providing module
 *
 * Guards are opt-in. When no guard is registered every command runs as before.
 * The engine registers three built-in guards that enforce the processor access
 * metadata (`requireAuth`, `requiredGroups`, `requiredPermissions`); they stay
 * inactive until an auth module (e.g. `@qodalis/cli-users`) registers an
 * `ICliAuthorizationService`, so without one that metadata is informational.
 */
export interface ICliCommandGuard {
    /** Unique name, shown in diagnostics when the guard throws. */
    name: string;

    /** Execution order; lower runs first. Defaults to `0`. */
    priority?: number;

    /**
     * Optional filter deciding whether this guard is relevant for the command.
     * Return `false` to skip the guard. When omitted the guard applies to
     * every command. May be async, and may use `context` to resolve services.
     */
    appliesTo?(
        processor: ICliCommandProcessor,
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): boolean | Promise<boolean>;

    /**
     * Decide whether the command may run. See {@link CliCommandGuardResult}
     * for the accepted return values.
     */
    canActivate(
        command: CliProcessCommand,
        processor: ICliCommandProcessor,
        context: ICliExecutionContext,
    ): CliCommandGuardResult | Promise<CliCommandGuardResult>;
}

/** DI token for {@link ICliCommandGuard}; register guards as multi-providers. */
export const ICliCommandGuard_TOKEN = createCliToken<ICliCommandGuard>('cli-command-guard');
