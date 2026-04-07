const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const IOS_APP_DIR = path.join(ROOT, 'ios', 'App', 'App');
const ASSETS_DIR = path.join(IOS_APP_DIR, 'Assets.xcassets');
const SPLASH_IMAGESET_DIR = path.join(ASSETS_DIR, 'SplashLogo.imageset');
const STORYBOARD_DIR = path.join(IOS_APP_DIR, 'Base.lproj');
const STORYBOARD_PATH = path.join(STORYBOARD_DIR, 'LaunchScreen.storyboard');

const splashImageMap = [
  { source: 'icon-512x512.png', target: 'splash-logo.png', scale: '1x' },
  { source: 'icon-1024x1024.png', target: 'splash-logo@2x.png', scale: '2x' },
  { source: 'icon-1024x1024.png', target: 'splash-logo@3x.png', scale: '3x' }
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyImage(sourceFile, targetFile) {
  const sourcePath = path.join(ROOT, 'icons', sourceFile);
  const targetPath = path.join(SPLASH_IMAGESET_DIR, targetFile);

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Missing splash source image: ${sourcePath}`);
  }

  fs.copyFileSync(sourcePath, targetPath);
}

function writeContentsJson() {
  const contents = {
    images: splashImageMap.map(({ target, scale }) => ({
      idiom: 'universal',
      filename: target,
      scale
    })),
    info: {
      version: 1,
      author: 'xcode'
    }
  };

  fs.writeFileSync(
    path.join(SPLASH_IMAGESET_DIR, 'Contents.json'),
    JSON.stringify(contents, null, 2) + '\n',
    'utf8'
  );
}

function writeLaunchScreenStoryboard() {
  const storyboard = `<?xml version="1.0" encoding="UTF-8"?>
<document type="com.apple.InterfaceBuilder3.CocoaTouch.Storyboard.XIB" version="3.0" toolsVersion="23504" targetRuntime="iOS.CocoaTouch" propertyAccessControl="none" useAutolayout="YES" launchScreen="YES" useTraitCollections="YES" useSafeAreas="YES" colorMatched="YES" initialViewController="Y6W-oJ-fk5">
    <device id="retina6_12" orientation="portrait" appearance="light"/>
    <dependencies>
        <plugIn identifier="com.apple.InterfaceBuilder.IBCocoaTouchPlugin" version="23506"/>
        <capability name="Safe area layout guides" minToolsVersion="9.0"/>
        <capability name="documents saved in the Xcode 8 format" minToolsVersion="8.0"/>
    </dependencies>
    <scenes>
        <scene sceneID="E5f-Kr-P4L">
            <objects>
                <viewController id="Y6W-oJ-fk5" sceneMemberID="viewController">
                    <view key="view" contentMode="scaleToFill" id="ze5-6b-2t3">
                        <rect key="frame" x="0.0" y="0.0" width="393" height="852"/>
                        <autoresizingMask key="autoresizingMask" widthSizable="YES" heightSizable="YES"/>
                        <subviews>
                            <imageView clipsSubviews="YES" userInteractionEnabled="NO" contentMode="scaleAspectFit" horizontalHuggingPriority="251" verticalHuggingPriority="251" image="SplashLogo" translatesAutoresizingMaskIntoConstraints="NO" id="nQy-Pd-m4R">
                                <rect key="frame" x="138.5" y="307" width="116" height="116"/>
                                <constraints>
                                    <constraint firstAttribute="width" constant="116" id="m84-2c-J8a"/>
                                    <constraint firstAttribute="height" constant="116" id="x8p-AX-TmF"/>
                                </constraints>
                            </imageView>
                            <label opaque="NO" userInteractionEnabled="NO" contentMode="left" text="Fingenda" textAlignment="center" lineBreakMode="tailTruncation" baselineAdjustment="alignBaselines" adjustsFontSizeToFit="NO" translatesAutoresizingMaskIntoConstraints="NO" id="t2X-LQ-x8Q">
                                <rect key="frame" x="111" y="443" width="171" height="34"/>
                                <fontDescription key="fontDescription" type="boldSystem" pointSize="28"/>
                                <color key="textColor" red="0.1215686275" green="0.1607843137" blue="0.2352941176" alpha="1" colorSpace="custom" customColorSpace="sRGB"/>
                                <nil key="highlightedColor"/>
                            </label>
                        </subviews>
                        <viewLayoutGuide key="safeArea" id="Bcu-3y-fUS"/>
                        <color key="backgroundColor" red="0.9568627451" green="0.9647058824" blue="0.9764705882" alpha="1" colorSpace="custom" customColorSpace="sRGB"/>
                        <constraints>
                            <constraint firstItem="nQy-Pd-m4R" firstAttribute="centerX" secondItem="ze5-6b-2t3" secondAttribute="centerX" id="5rP-Df-kHc"/>
                            <constraint firstItem="nQy-Pd-m4R" firstAttribute="centerY" secondItem="ze5-6b-2t3" secondAttribute="centerY" constant="-38" id="Akf-S2-q8e"/>
                            <constraint firstItem="t2X-LQ-x8Q" firstAttribute="centerX" secondItem="ze5-6b-2t3" secondAttribute="centerX" id="GYp-z7-sy6"/>
                            <constraint firstItem="t2X-LQ-x8Q" firstAttribute="top" secondItem="nQy-Pd-m4R" secondAttribute="bottom" constant="20" id="v2o-Uy-6mU"/>
                        </constraints>
                    </view>
                </viewController>
                <placeholder placeholderIdentifier="IBFirstResponder" id="iYj-Kq-Ea1" userLabel="First Responder" sceneMemberID="firstResponder"/>
            </objects>
            <point key="canvasLocation" x="53" y="375"/>
        </scene>
    </scenes>
    <resources>
        <image name="SplashLogo" width="1024" height="1024"/>
    </resources>
</document>
`;

  ensureDir(STORYBOARD_DIR);
  fs.writeFileSync(STORYBOARD_PATH, storyboard, 'utf8');
}

function main() {
  if (!fs.existsSync(IOS_APP_DIR)) {
    console.log(`Skipped iOS launch screen generation because ${IOS_APP_DIR} does not exist yet.`);
    process.exit(0);
  }

  ensureDir(SPLASH_IMAGESET_DIR);

  for (const image of splashImageMap) {
    copyImage(image.source, image.target);
  }

  writeContentsJson();
  writeLaunchScreenStoryboard();

  console.log(`Generated iOS launch screen assets in ${SPLASH_IMAGESET_DIR}`);
  console.log(`Updated iOS launch storyboard at ${STORYBOARD_PATH}`);
}

main();
