/**
 * Serve built packages locally with npm-compatible paths.
 * Creates a temporary directory with symlinks matching the @qodalis/ scope,
 * then starts a static file server on port 3000.
 *
 * Usage: node tools/serve-local.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const distDir = path.resolve(__dirname, '..', 'dist');
const serveDir = path.join(distDir, '.serve');
const scopeDir = path.join(serveDir, '@qodalis');

// Clean up previous serve directory
if (fs.existsSync(serveDir)) {
    fs.rmSync(serveDir, { recursive: true });
}
fs.mkdirSync(scopeDir, { recursive: true });

// Create symlinks: dist/.serve/@qodalis/cli-todo -> dist/todo
const entries = fs.readdirSync(distDir, { withFileTypes: true });
for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === '.serve') continue;

    const pkgJsonPath = path.join(distDir, entry.name, 'package.json');
    if (!fs.existsSync(pkgJsonPath)) continue;

    const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
    const name = pkgJson.name;
    if (!name) continue;

    // Strip @qodalis/ prefix
    const localName = name.replace(/^@qodalis\//, '');
    const target = path.join(distDir, entry.name);
    const link = path.join(scopeDir, localName);

    fs.symlinkSync(target, link, 'junction');
    console.log(`  ${name} -> ${entry.name}/`);
}

console.log(`\nServing from ${serveDir}\n`);

try {
    execSync(`npx serve "${serveDir}" --cors -l 3000`, { stdio: 'inherit' });
} catch {
    // serve was interrupted (Ctrl+C)
}
