const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const IOS_APP_DIR = path.join(ROOT, 'ios', 'App', 'App');
const ASSETS_DIR = path.join(IOS_APP_DIR, 'Assets.xcassets');
const SPLASH_IMAGESET_DIR = path.join(ASSETS_DIR, 'Splash.imageset');
const STORYBOARD_DIR = path.join(IOS_APP_DIR, 'Base.lproj');
const STORYBOARD_PATH = path.join(STORYBOARD_DIR, 'LaunchScreen.storyboard');
const SPLASH_SOURCE = path.join(ROOT, 'icons', 'icon-512x512.png');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeSplashAsset() {
  if (!fs.existsSync(SPLASH_SOURCE)) {
    throw new Error(`Missing launch logo source: ${SPLASH_SOURCE}`);
  }

  ensureDir(SPLASH_IMAGESET_DIR);

  fs.copyFileSync(SPLASH_SOURCE, path.join(SPLASH_IMAGESET_DIR, 'splash.png'));
  fs.writeFileSync(
    path.join(SPLASH_IMAGESET_DIR, 'Contents.json'),
    JSON.stringify({
      images: [
        {
          filename: 'splash.png',
          idiom: 'universal',
          scale: '1x'
        }
      ],
      info: {
        author: 'xcode',
        version: 1
      }
    }, null, 2) + '\n',
    'utf8'
  );
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
                        <subviews>
                            <imageView clipsSubviews="YES" userInteractionEnabled="NO" contentMode="scaleAspectFit" image="Splash" translatesAutoresizingMaskIntoConstraints="NO" id="FingendaLaunchLogo">
                                <rect key="frame" x="130.5" y="360" width="132" height="132"/>
                                <constraints>
                                    <constraint firstAttribute="width" constant="132" id="FingendaLaunchLogoWidth"/>
                                    <constraint firstAttribute="height" constant="132" id="FingendaLaunchLogoHeight"/>
                                </constraints>
                            </imageView>
                        </subviews>
                        <viewLayoutGuide key="safeArea" id="FingendaLaunchSafeArea"/>
                        <color key="backgroundColor" red="0.9568627451" green="0.9647058824" blue="0.9764705882" alpha="1" colorSpace="custom" customColorSpace="sRGB"/>
                        <constraints>
                            <constraint firstItem="FingendaLaunchLogo" firstAttribute="centerX" secondItem="FingendaLaunchView" secondAttribute="centerX" id="FingendaLaunchLogoCenterX"/>
                            <constraint firstItem="FingendaLaunchLogo" firstAttribute="centerY" secondItem="FingendaLaunchView" secondAttribute="centerY" id="FingendaLaunchLogoCenterY"/>
                        </constraints>
                    </view>
                </viewController>
                <placeholder placeholderIdentifier="IBFirstResponder" id="FingendaLaunchFirstResponder" sceneMemberID="firstResponder"/>
            </objects>
            <point key="canvasLocation" x="0.0" y="0.0"/>
        </scene>
    </scenes>
    <resources>
        <image name="Splash" width="512" height="512"/>
    </resources>
</document>
`;

  fs.writeFileSync(STORYBOARD_PATH, storyboard, 'utf8');
}

function main() {
  if (!fs.existsSync(IOS_APP_DIR)) {
    console.log('[iOS LaunchScreen] ios/App/App bulunamadi, launch screen patch atlandi.');
    return;
  }

  writeSplashAsset();
  writeLaunchStoryboard();
  console.log('[iOS LaunchScreen] Fingenda launch screen generated.');
}

main();
