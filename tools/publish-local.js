/**
 * Publish all built packages to local Verdaccio registry.
 *
 * Start verdaccio first:  verdaccio
 * Browse packages at:     http://localhost:4873
 *
 * Usage: node tools/publish-local.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const http = require('http');

const REGISTRY = 'http://localhost:4873';
const distDir = path.resolve(__dirname, '..', 'dist');

// Publish order: core first, then cli, then plugins
const PACKAGES = [
    'core',
    'cli',
    'angular-cli',
    'browser-storage',
    'curl',
    'guid',
    'password-generator',
    'qr',
    'regex',
    'server-logs',
    'speed-test',
    'string',
    'text-to-image',
    'todo',
    'yesno',
];

function checkRegistry() {
    return new Promise((resolve) => {
        http.get(REGISTRY, () => resolve(true)).on('error', () => resolve(false));
    });
}

async function main() {
    const isRunning = await checkRegistry();
    if (!isRunning) {
        console.error(`Error: Verdaccio is not running at ${REGISTRY}`);
        console.error('Start it with:  verdaccio');
        process.exit(1);
    }

    for (const pkg of PACKAGES) {
        const pkgDir = path.join(distDir, pkg);
        if (!fs.existsSync(pkgDir)) {
            console.log(`SKIP  ${pkg} (not built)`);
            continue;
        }

        const pkgJson = JSON.parse(
            fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf-8'),
        );

        process.stdout.write(`PUBLISH  ${pkgJson.name}@${pkgJson.version} ... `);

        try {
            execSync(`npm publish "${pkgDir}" --registry ${REGISTRY}`, {
                stdio: 'pipe',
            });
            console.log('OK');
        } catch {
            console.log('SKIPPED (already published or error)');
        }
    }

    console.log(`\nDone. Browse packages at ${REGISTRY}`);
}

main();
