/**
 * Fingenda build script
 *
 * Copies web assets to www/ and generates runtime build flags
 * consumed by the app at startup.
 *
 * Usage: node scripts/build.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WWW = path.join(ROOT, 'www');

// Files and directories copied into www/
const COPY_LIST = [
    'index.html',
    'dna-performance-runtime.js',
    'dna-refresh-core.js',
    'dna-refresh-ui.js',
    'dna-refresh.css',
    'fingenda-native-voice.js',
    'sw.js',
    'manifest.json',
    'logo.jpg',
    'logo-120.png',
    'logo-152.png',
    'logo-180.png',
    'icons'
];

function cleanDir(dir) {
    if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
    fs.mkdirSync(dir, { recursive: true });
}

function copyRecursive(src, dest) {
    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
        fs.mkdirSync(dest, { recursive: true });
        for (const child of fs.readdirSync(src)) {
            copyRecursive(path.join(src, child), path.join(dest, child));
        }
    } else {
        fs.copyFileSync(src, dest);
    }
}

function parseBooleanEnv(value, fallback = false) {
    if (value == null) return fallback;
    const normalized = String(value).trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
    return fallback;
}

function getBuildChannel() {
    const raw = process.env.FINGENDA_BUILD_CHANNEL || process.env.BUILD_CHANNEL || 'development';
    const normalized = String(raw).trim().toLowerCase();
    if (['development', 'testflight', 'release'].includes(normalized)) return normalized;
    return 'development';
}

function writeBuildConfig(outDir) {
    const buildChannel = getBuildChannel();
    const testPremiumBypass = parseBooleanEnv(
        process.env.FINGENDA_TEST_PREMIUM_BYPASS,
        buildChannel === 'testflight'
    );

    const config = {
        buildChannel,
        testPremiumBypass,
        buildTimestamp: new Date().toISOString(),
        commitSha: process.env.CM_COMMIT || process.env.GIT_COMMIT || null
    };

    const payload = [
        ';(function(){',
        '  "use strict";',
        `  window.__FINGENDA_BUILD__ = ${JSON.stringify(config, null, 2)};`,
        '})();',
        ''
    ].join('\n');

    fs.writeFileSync(path.join(outDir, 'build-config.js'), payload, 'utf8');
}

console.log('[BUILD] Fingenda build started');
console.log('[BUILD] Preparing www/');
cleanDir(WWW);

let fileCount = 0;
for (const item of COPY_LIST) {
    const src = path.join(ROOT, item);
    const dest = path.join(WWW, item);

    if (fs.existsSync(src)) {
        copyRecursive(src, dest);
        const stat = fs.statSync(src);
        if (stat.isDirectory()) {
            const count = fs.readdirSync(src).length;
            console.log(`  [OK] ${item}/ (${count} files)`);
            fileCount += count;
        } else {
            const sizeKB = (stat.size / 1024).toFixed(1);
            console.log(`  [OK] ${item} (${sizeKB} KB)`);
            fileCount++;
        }
    } else {
        console.log(`  [WARN] ${item} not found, skipped`);
    }
}

writeBuildConfig(WWW);

console.log(`[BUILD] Completed. ${fileCount} assets copied to www/`);
console.log('[BUILD] Build flags written to www/build-config.js');
