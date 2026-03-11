import { exposeElectronCliApi } from '@qodalis/electron-cli/preload';

// Expose the Electron CLI API to the renderer process.
// After this call, `window.electronCliApi` is available in the renderer
// with native file dialogs, clipboard, and shell integration.
exposeElectronCliApi();
