/**
 * @qodalis/electron-cli — Electron integration for the Qodalis CLI engine.
 *
 * Renderer-side entry point. Provides:
 * - `electronModule` — ICliModule that registers Electron-native services
 * - Individual service classes for custom composition
 * - Type definitions for the preload bridge API
 *
 * @example
 * ```tsx
 * import { electronModule } from '@qodalis/electron-cli';
 * import { Cli, CliConfigProvider } from '@qodalis/react-cli';
 *
 * const modules = [electronModule, ...otherModules];
 *
 * function App() {
 *   return (
 *     <CliConfigProvider modules={modules}>
 *       <Cli />
 *     </CliConfigProvider>
 *   );
 * }
 * ```
 */

// Module (primary export)
export { electronModule } from './lib/electron-module';

// Individual services (for custom usage)
export { ElectronFileTransferService } from './lib/services/electron-file-transfer.service';
export { ElectronClipboardService } from './lib/services/electron-clipboard.service';

// Types
export type { ElectronCliApi } from './lib/types';
