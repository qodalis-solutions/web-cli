import { app, BrowserWindow, nativeImage } from 'electron';
import { registerElectronCliIpcHandlers } from '@qodalis/electron-cli/main';
import * as path from 'path';

// Register IPC handlers for the CLI preload bridge
registerElectronCliIpcHandlers({
    // Optional: restrict filesystem access to specific directories
    // allowedPaths: [app.getPath('home')],
});

function createWindow(): void {
    // Load the Qodalis icon
    const iconPath = path.join(__dirname, '../../assets/icon.png');
    const icon = nativeImage.createFromPath(iconPath);

    // Set dock icon on macOS
    if (process.platform === 'darwin' && !icon.isEmpty()) {
        app.dock.setIcon(icon);
    }

    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        title: 'Qodalis CLI',
        icon: iconPath,
        backgroundColor: '#1e1e1e',
        titleBarStyle: 'hiddenInset',
        trafficLightPosition: { x: 12, y: 12 },
        webPreferences: {
            preload: path.join(__dirname, '../preload/index.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
        },
    });

    // In development, load from Vite dev server
    // In production, load the built index.html
    const isDev = process.env.ELECTRON_DEV === '1';

    if (isDev) {
        const port = process.env.VITE_PORT || '5173';
        win.loadURL(`http://localhost:${port}`);
        win.webContents.openDevTools();
    } else {
        win.loadFile(path.join(__dirname, '../renderer/index.html'));
    }
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        // macOS: re-create window when dock icon is clicked with no windows open
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    // Quit on all platforms (including macOS for a demo app)
    app.quit();
});
