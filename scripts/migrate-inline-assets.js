/**
 * Safely moves selected inline style/script blocks out of index.html.
 *
 * This is intentionally conservative: it only migrates self-contained blocks
 * identified by stable ids, keeps their original execution order, and can be
 * re-run without duplicating tags.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const INDEX_PATH = path.join(ROOT, 'index.html');

const MIGRATIONS = [
    {
        type: 'style',
        id: 'fingenda-apple-auth-polish',
        output: 'assets/styles/fingenda-apple-auth-polish.css',
        replacement: '<link rel="stylesheet" href="assets/styles/fingenda-apple-auth-polish.css" data-fingenda-module="fingenda-apple-auth-polish">'
    },
    {
        type: 'style',
        id: 'fingenda-onboarding-award-ui',
        output: 'assets/styles/fingenda-onboarding-award-ui.css',
        replacement: '<link rel="stylesheet" href="assets/styles/fingenda-onboarding-award-ui.css" data-fingenda-module="fingenda-onboarding-award-ui">'
    },
    {
        type: 'script',
        id: 'fingenda-apple-auth-web-bridge',
        output: 'assets/js/fingenda-apple-auth-web-bridge.js',
        replacement: '<script id="fingenda-apple-auth-web-bridge" src="assets/js/fingenda-apple-auth-web-bridge.js" data-fingenda-module="fingenda-apple-auth-web-bridge"></script>'
    }
];

function ensureDir(filePath) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function blockPattern(type, id) {
    const tagName = type === 'style' ? 'style' : 'script';
    return new RegExp(
        `<${tagName}\\s+id=["']${escapeRegExp(id)}["'][^>]*>([\\s\\S]*?)<\\/${tagName}>`,
        'm'
    );
}

function migrate() {
    let html = fs.readFileSync(INDEX_PATH, 'utf8');
    const moved = [];
    const skipped = [];

    for (const migration of MIGRATIONS) {
        const outputPath = path.join(ROOT, migration.output);
        const pattern = blockPattern(migration.type, migration.id);
        const match = html.match(pattern);

        if (!match) {
            if (html.includes(migration.replacement)) {
                skipped.push(`${migration.id} already external`);
                continue;
            }
            skipped.push(`${migration.id} not found`);
            continue;
        }

        const content = match[1].trim();
        ensureDir(outputPath);
        fs.writeFileSync(outputPath, `${content}\n`, 'utf8');
        html = html.replace(match[0], migration.replacement);
        moved.push(`${migration.id} -> ${migration.output}`);
    }

    fs.writeFileSync(INDEX_PATH, html, 'utf8');

    for (const item of moved) console.log(`[MIGRATE] ${item}`);
    for (const item of skipped) console.log(`[SKIP] ${item}`);
}

migrate();
