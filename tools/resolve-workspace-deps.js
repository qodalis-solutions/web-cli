// Replaces workspace:* references in dist/*/package.json files
// before npm publish (pnpm workspace protocol is not resolved automatically).
const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');

// Build a map of package name -> version from all dist/*/package.json
const versionMap = {};
const dirs = fs.readdirSync(distDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

for (const dir of dirs) {
    const pkgPath = path.join(distDir, dir, 'package.json');
    if (!fs.existsSync(pkgPath)) continue;
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    if (pkg.name && pkg.version) {
        versionMap[pkg.name] = pkg.version;
    }
}

// Also check packages/ and packages/plugins/ source dirs as fallback
for (const base of [path.join(__dirname, '..', 'packages'), path.join(__dirname, '..', 'packages', 'plugins')]) {
    if (!fs.existsSync(base)) continue;
    for (const dir of fs.readdirSync(base, { withFileTypes: true }).filter(d => d.isDirectory())) {
        const pkgPath = path.join(base, dir.name, 'package.json');
        if (!fs.existsSync(pkgPath)) continue;
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        if (pkg.name && pkg.version && !versionMap[pkg.name]) {
            versionMap[pkg.name] = pkg.version;
        }
    }
}

// Resolve workspace:* in each dist package
for (const dir of dirs) {
    const pkgPath = path.join(distDir, dir, 'package.json');
    if (!fs.existsSync(pkgPath)) continue;

    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    let changed = false;

    for (const depType of ['dependencies', 'peerDependencies', 'devDependencies']) {
        if (!pkg[depType]) continue;
        for (const [name, ver] of Object.entries(pkg[depType])) {
            if (typeof ver === 'string' && ver.startsWith('workspace:')) {
                const resolved = versionMap[name];
                if (resolved) {
                    pkg[depType][name] = resolved;
                    changed = true;
                } else {
                    console.warn(`  WARNING: could not resolve ${name} for ${dir}`);
                }
            }
        }
    }

    if (changed) {
        fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
        console.log(`Resolved workspace deps in dist/${dir}/package.json`);
    }
}
