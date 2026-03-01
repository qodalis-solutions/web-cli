import * as fs from 'fs';
import * as path from 'path';

export interface MonorepoInfo {
    root: string;
    pluginsDir: string;
}

export function detectMonorepo(cwd: string): MonorepoInfo | null {
    let dir = cwd;
    while (true) {
        const workspaceFile = path.join(dir, 'pnpm-workspace.yaml');
        const pluginsDir = path.join(dir, 'packages', 'plugins');
        if (fs.existsSync(workspaceFile) && fs.existsSync(pluginsDir)) {
            const content = fs.readFileSync(workspaceFile, 'utf-8');
            if (content.includes('packages/plugins')) {
                return { root: dir, pluginsDir };
            }
        }
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
    }
    return null;
}
