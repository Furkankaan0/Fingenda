/**
 * Fingenda Build Script
 *
 * Web dosyalarini www/ klasorune kopyalar.
 * Capacitor, www/ klasorunu iOS projesine sync eder.
 *
 * Kullanim: node scripts/build.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WWW = path.join(ROOT, 'www');

// Kopyalanacak dosya ve klasorler
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

// Haric tutulanlar (www'ye kopyalanmayacak)
const EXCLUDE = [
    'node_modules',
    'ios',
    'android',
    'www',
    '.git',
    '.codex-taxhacker',
    'scripts',
    'package.json',
    'package-lock.json',
    'capacitor.config.json',
    'codemagic.yaml',
    'FINGENDA_ANALIZ_RAPORU.md'
];

function cleanDir(dir) {
    if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true });
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

console.log('🔨 Fingenda Build basliyor...\n');

// 1. www klasorunu temizle
console.log('📁 www/ klasoru hazirlaniyor...');
cleanDir(WWW);

// 2. Dosyalari kopyala
let fileCount = 0;
for (const item of COPY_LIST) {
    const src = path.join(ROOT, item);
    const dest = path.join(WWW, item);

    if (fs.existsSync(src)) {
        copyRecursive(src, dest);
        const stat = fs.statSync(src);
        if (stat.isDirectory()) {
            const count = fs.readdirSync(src).length;
            console.log(`  ✅ ${item}/ (${count} dosya)`);
            fileCount += count;
        } else {
            const sizeKB = (stat.size / 1024).toFixed(1);
            console.log(`  ✅ ${item} (${sizeKB} KB)`);
            fileCount++;
        }
    } else {
        console.log(`  ⚠️  ${item} bulunamadi, atlaniyor`);
    }
}

console.log(`\n✨ Build tamamlandi! ${fileCount} dosya www/ klasorune kopyalandi.`);
console.log('📱 Simdi "npx cap sync" calistirarak iOS projesini guncelleyebilirsiniz.\n');
