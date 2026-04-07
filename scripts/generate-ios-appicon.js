const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ICONS_DIR = path.join(ROOT, 'icons');
const APP_ICONSET_DIR = path.join(ROOT, 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset');

const iconMap = [
  { source: 'icon-40x40.png', target: 'Icon-App-20x20@2x.png', idiom: 'iphone', size: '20x20', scale: '2x' },
  { source: 'icon-60x60.png', target: 'Icon-App-20x20@3x.png', idiom: 'iphone', size: '20x20', scale: '3x' },
  { source: 'icon-58x58.png', target: 'Icon-App-29x29@2x.png', idiom: 'iphone', size: '29x29', scale: '2x' },
  { source: 'icon-87x87.png', target: 'Icon-App-29x29@3x.png', idiom: 'iphone', size: '29x29', scale: '3x' },
  { source: 'icon-80x80.png', target: 'Icon-App-40x40@2x.png', idiom: 'iphone', size: '40x40', scale: '2x' },
  { source: 'icon-120x120.png', target: 'Icon-App-40x40@3x.png', idiom: 'iphone', size: '40x40', scale: '3x' },
  { source: 'icon-120x120.png', target: 'Icon-App-60x60@2x.png', idiom: 'iphone', size: '60x60', scale: '2x' },
  { source: 'icon-180x180.png', target: 'Icon-App-60x60@3x.png', idiom: 'iphone', size: '60x60', scale: '3x' },
  { source: 'icon-20x20.png', target: 'Icon-App-20x20@1x.png', idiom: 'ipad', size: '20x20', scale: '1x' },
  { source: 'icon-40x40.png', target: 'Icon-App-20x20@2x-1.png', idiom: 'ipad', size: '20x20', scale: '2x' },
  { source: 'icon-29x29.png', target: 'Icon-App-29x29@1x.png', idiom: 'ipad', size: '29x29', scale: '1x' },
  { source: 'icon-58x58.png', target: 'Icon-App-29x29@2x-1.png', idiom: 'ipad', size: '29x29', scale: '2x' },
  { source: 'icon-40x40.png', target: 'Icon-App-40x40@1x.png', idiom: 'ipad', size: '40x40', scale: '1x' },
  { source: 'icon-80x80.png', target: 'Icon-App-40x40@2x-1.png', idiom: 'ipad', size: '40x40', scale: '2x' },
  { source: 'icon-76x76.png', target: 'Icon-App-76x76@1x.png', idiom: 'ipad', size: '76x76', scale: '1x' },
  { source: 'icon-152x152.png', target: 'Icon-App-76x76@2x.png', idiom: 'ipad', size: '76x76', scale: '2x' },
  { source: 'icon-167x167.png', target: 'Icon-App-83.5x83.5@2x.png', idiom: 'ipad', size: '83.5x83.5', scale: '2x' },
  { source: 'icon-1024x1024.png', target: 'Icon-App-1024x1024@1x.png', idiom: 'ios-marketing', size: '1024x1024', scale: '1x' }
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyIcon(sourceFile, targetFile) {
  const sourcePath = path.join(ICONS_DIR, sourceFile);
  const targetPath = path.join(APP_ICONSET_DIR, targetFile);

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Missing icon source: ${sourcePath}`);
  }

  fs.copyFileSync(sourcePath, targetPath);
}

function writeContentsJson() {
  const contents = {
    images: iconMap.map(({ target, idiom, size, scale }) => ({
      filename: target,
      idiom,
      size,
      scale
    })),
    info: {
      version: 1,
      author: 'xcode'
    }
  };

  fs.writeFileSync(
    path.join(APP_ICONSET_DIR, 'Contents.json'),
    JSON.stringify(contents, null, 2) + '\n',
    'utf8'
  );
}

function main() {
  ensureDir(APP_ICONSET_DIR);

  for (const icon of iconMap) {
    copyIcon(icon.source, icon.target);
  }

  writeContentsJson();
  console.log(`Generated iOS app icons in ${APP_ICONSET_DIR}`);
}

main();
