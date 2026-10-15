#!/usr/bin/env node
/**
 * Makes every docs route a real page for GitHub Pages and search engines.
 *
 * GitHub Pages only knows files: a deep link such as /docs/server-integration used to be
 * answered by 404.html (the SPA fallback) with HTTP status 404, so crawlers treated every
 * docs page as missing. After `nx build docs` this script writes, for each route in the
 * sidebar navigation and plugin list:
 *
 *   <route>.html and <route>/index.html  — the app shell with that page's <title>,
 *                                          description, canonical URL and Open Graph tags
 *
 * plus 404.html (noindex, for unknown URLs) and a sitemap.xml generated from the same routes.
 *
 * Usage: node apps/docs/scripts/generate-static-routes.mjs [distDir] [--site=https://cli.qodalis.com]
 */
import { build } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(here, '..');
const args = process.argv.slice(2);
const distDir = resolve(args.find((a) => !a.startsWith('--')) ?? join(appDir, '../../dist/docs'));
const site = (args.find((a) => a.startsWith('--site='))?.slice(7) ?? 'https://cli.qodalis.com').replace(/\/+$/, '');

const SITE_NAME = 'Qodalis CLI';
const MAX_DESCRIPTION = 160;

/** Bundle the navigation and plugin data (TypeScript) so the script reads the same source as the app. */
async function loadData() {
    const result = await build({
        stdin: {
            contents: `export { DOCS_NAV } from './navigation'; export { PLUGINS } from './plugins';`,
            resolveDir: join(appDir, 'src/app/data'),
            loader: 'ts',
        },
        bundle: true,
        format: 'esm',
        platform: 'node',
        write: false,
        logLevel: 'silent',
    });
    const code = result.outputFiles[0].text;
    return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
}

const escapeHtml = (s) =>
    String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** First sentences of a text, cut at a word boundary to fit a meta description. */
function summarize(text) {
    const clean = String(text).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (clean.length <= MAX_DESCRIPTION) return clean;
    const cut = clean.slice(0, MAX_DESCRIPTION - 1);
    // Prefer ending on a full sentence when one fits
    const sentenceEnd = cut.lastIndexOf('. ');
    if (sentenceEnd > 80) return cut.slice(0, sentenceEnd + 1);
    return `${cut.slice(0, cut.lastIndexOf(' '))}…`;
}

/** Intro text of a docs page from the English translations (skipped when it has placeholders). */
function introFor(path, en) {
    const slug = path.replace(/^\/docs\//, '');
    const keys = [];
    if (slug.startsWith('core-concepts/')) keys.push(`docs.core-concepts.${slug.split('/')[1]}.intro`);
    else if (slug.startsWith('server-integration/')) keys.push(`docs.server-detail.${slug.split('/')[1]}.intro`);
    else if (slug === 'plugins/create-your-own') keys.push('docs.create-plugin.intro');
    else keys.push(`docs.${slug}.intro`);
    for (const key of keys) {
        const value = en[key];
        if (typeof value === 'string' && !value.includes('{{')) return value;
    }
    return undefined;
}

/** All routes with their page metadata, in sidebar order. */
function collectRoutes({ DOCS_NAV, PLUGINS }, en, defaultDescription) {
    const plugins = new Map(PLUGINS.map((p) => [`/docs/plugins/${p.id}`, p]));
    const label = (key) => (key.startsWith('sidebar.') ? (en[key] ?? key) : key);
    const routes = [
        { path: '/', title: `${SITE_NAME} — Web Terminal Framework for Angular, React & Vue`, description: defaultDescription, priority: '1.0' },
    ];
    const seen = new Set(['/']);
    const add = (item) => {
        // Group headers without a page of their own (e.g. /docs/core-concepts) only hold children
        const isPage = !(item.children?.length && item.path === '/docs/core-concepts');
        if (isPage && !seen.has(item.path)) {
            seen.add(item.path);
            const plugin = plugins.get(item.path);
            const name = plugin ? `${plugin.name} plugin` : label(item.label);
            routes.push({
                path: item.path,
                title: `${name} — ${SITE_NAME}`,
                description: summarize(plugin?.description ?? introFor(item.path, en) ?? `${name}: ${defaultDescription}`),
                priority: item.path === '/docs/getting-started' ? '0.9' : plugin ? '0.6' : '0.8',
            });
        }
        item.children?.forEach(add);
    };
    DOCS_NAV.forEach(add);
    // Plugin pages not linked from the sidebar (e.g. language packs listed elsewhere)
    for (const [path, plugin] of plugins) {
        if (!seen.has(path)) {
            seen.add(path);
            routes.push({ path, title: `${plugin.name} plugin — ${SITE_NAME}`, description: summarize(plugin.description), priority: '0.5' });
        }
    }
    return routes;
}

/** The shell with this page's head tags. */
function renderPage(template, { title, description, canonical, robots }) {
    const html = template
        .replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(title)}</title>`)
        .replace(/<meta\s+name="description"[^>]*>/, `<meta name="description" content="${escapeHtml(description)}" />`);
    const tags = [
        robots ? `<meta name="robots" content="${robots}" />` : `<link rel="canonical" href="${canonical}" />`,
        `<meta property="og:site_name" content="${SITE_NAME}" />`,
        `<meta property="og:type" content="website" />`,
        `<meta property="og:title" content="${escapeHtml(title)}" />`,
        `<meta property="og:description" content="${escapeHtml(description)}" />`,
        ...(canonical ? [`<meta property="og:url" content="${canonical}" />`] : []),
        `<meta name="twitter:card" content="summary" />`,
    ];
    return html.replace('</head>', `    <!-- seo -->\n    ${tags.join('\n    ')}\n    <!-- /seo -->\n  </head>`);
}

function write(file, content) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
}

async function main() {
    const indexFile = join(distDir, 'index.html');
    if (!existsSync(indexFile)) {
        throw new Error(`${indexFile} not found: run 'nx build docs' first`);
    }
    // Drop tags from a previous run so re-running never stacks them
    const template = readFileSync(indexFile, 'utf8').replace(/\s*<!-- seo -->[\s\S]*?<!-- \/seo -->/, '');
    const en = JSON.parse(readFileSync(join(appDir, 'src/assets/i18n/en.json'), 'utf8'));
    const defaultDescription =
        template.match(/<meta\s+name="description"\s+content="([^"]*)"/)?.[1] ?? 'Web terminal framework for Angular, React and Vue.';

    const routes = collectRoutes(await loadData(), en, defaultDescription);

    for (const route of routes) {
        const canonical = route.path === '/' ? `${site}/` : `${site}${route.path}`;
        const html = renderPage(template, { ...route, canonical });
        if (route.path === '/') {
            write(indexFile, html);
        } else {
            // GitHub Pages serves /a/b from a/b.html; a/b/index.html covers a trailing slash
            write(join(distDir, `${route.path.slice(1)}.html`), html);
            write(join(distDir, route.path.slice(1), 'index.html'), html);
        }
    }
    // /docs redirects to getting-started in the app; point crawlers at the real page
    const gettingStarted = routes.find((r) => r.path === '/docs/getting-started');
    if (gettingStarted) {
        const html = renderPage(template, { ...gettingStarted, canonical: `${site}/docs/getting-started` });
        write(join(distDir, 'docs.html'), html);
        write(join(distDir, 'docs', 'index.html'), html);
    }

    // Unknown URLs keep the SPA fallback, with a real 404 status and noindex
    write(join(distDir, '404.html'), renderPage(template, { title: `Page not found — ${SITE_NAME}`, description: defaultDescription, robots: 'noindex' }));

    const today = new Date().toISOString().slice(0, 10);
    const sitemap = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        ...routes.map(
            (r) =>
                `  <url>\n    <loc>${r.path === '/' ? `${site}/` : `${site}${r.path}`}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>${r.priority}</priority>\n  </url>`,
        ),
        '</urlset>',
        '',
    ].join('\n');
    write(join(distDir, 'sitemap.xml'), sitemap);
    console.log(`static routes: ${routes.length} pages, 404.html and sitemap.xml written to ${distDir}`);
}

main().catch((e) => {
    console.error(e.message ?? e);
    process.exit(1);
});
