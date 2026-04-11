const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const IOS_APP_DIR = path.join(ROOT, 'ios', 'App', 'App');
const ASSETS_DIR = path.join(IOS_APP_DIR, 'Assets.xcassets');
const SPLASH_IMAGESET_DIR = path.join(ASSETS_DIR, 'Splash.imageset');
const STORYBOARD_DIR = path.join(IOS_APP_DIR, 'Base.lproj');
const STORYBOARD_PATH = path.join(STORYBOARD_DIR, 'LaunchScreen.storyboard');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function removeLegacySplashAsset() {
  if (fs.existsSync(SPLASH_IMAGESET_DIR)) {
    fs.rmSync(SPLASH_IMAGESET_DIR, { recursive: true, force: true });
  }
}

function writeLaunchStoryboard() {
  ensureDir(STORYBOARD_DIR);

  const storyboard = `<?xml version="1.0" encoding="UTF-8"?>
<document type="com.apple.InterfaceBuilder3.CocoaTouch.Storyboard.XIB" version="3.0" toolsVersion="23504" targetRuntime="iOS.CocoaTouch" propertyAccessControl="none" useAutolayout="YES" launchScreen="YES" useTraitCollections="YES" useSafeAreas="YES" colorMatched="YES" initialViewController="FingendaLaunchVC">
    <device id="retina6_12" orientation="portrait" appearance="light"/>
    <dependencies>
        <plugIn identifier="com.apple.InterfaceBuilder.IBCocoaTouchPlugin" version="23506"/>
        <capability name="Safe area layout guides" minToolsVersion="9.0"/>
        <capability name="documents saved in the Xcode 8 format" minToolsVersion="8.0"/>
    </dependencies>
    <scenes>
        <scene sceneID="FingendaLaunchScene">
            <objects>
                <viewController id="FingendaLaunchVC" sceneMemberID="viewController">
                    <view key="view" contentMode="scaleToFill" id="FingendaLaunchView">
                        <rect key="frame" x="0.0" y="0.0" width="393" height="852"/>
                        <autoresizingMask key="autoresizingMask" widthSizable="YES" heightSizable="YES"/>
                        <viewLayoutGuide key="safeArea" id="FingendaLaunchSafeArea"/>
                        <color key="backgroundColor" red="0.9568627451" green="0.9647058824" blue="0.9764705882" alpha="1" colorSpace="custom" customColorSpace="sRGB"/>
                    </view>
                </viewController>
                <placeholder placeholderIdentifier="IBFirstResponder" id="FingendaLaunchFirstResponder" sceneMemberID="firstResponder"/>
            </objects>
            <point key="canvasLocation" x="0.0" y="0.0"/>
        </scene>
    </scenes>
</document>
`;

  fs.writeFileSync(STORYBOARD_PATH, storyboard, 'utf8');
}

function main() {
  if (!fs.existsSync(IOS_APP_DIR)) {
    console.log('[iOS LaunchScreen] ios/App/App bulunamadi, launch screen patch atlandi.');
    return;
  }

  removeLegacySplashAsset();
  writeLaunchStoryboard();
  console.log('[iOS LaunchScreen] Blank native launch screen generated; web splash remains the only branded splash.');
}

main();
