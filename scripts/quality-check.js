/**
 * Lightweight release quality checks for Fingenda web assets.
 *
 * This script intentionally stays dependency-free so it can run in Codemagic,
 * local Windows shells, and quick pre-push checks without setup cost.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function read(file) {
    return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function checkCoreRuntimeWiring() {
    const buildScript = read('scripts/build.js');
    const index = read('index.html');
    const core = read('fingenda-core.js');

    assert(buildScript.includes("'fingenda-core.js'"), 'fingenda-core.js is missing from build COPY_LIST.');
    assert(index.includes('src="fingenda-core.js"'), 'index.html does not load fingenda-core.js.');
    assert(core.includes('window.FingendaCore'), 'fingenda-core.js does not expose window.FingendaCore.');
}

function checkCategoryIconFallbacks() {
    const dnaRuntime = read('dna-performance-runtime.js');

    assert(
        !dnaRuntime.includes("categoryEmojis[category] || '📌'"),
        'Spending DNA category fallback regressed to the pin icon.'
    );
    assert(
        dnaRuntime.includes('window.FingendaCore'),
        'Spending DNA runtime should use FingendaCore for shared category icon logic.'
    );
}

function main() {
    checkCoreRuntimeWiring();
    checkCategoryIconFallbacks();
    console.log('[QUALITY] Fingenda release checks passed');
}

main();
