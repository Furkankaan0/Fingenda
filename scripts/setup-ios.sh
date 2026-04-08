#!/bin/bash
# ════════════════════════════════════════════════════════════════
# Fingenda iOS Kurulum Scripti
#
# Bu script, Windows uzerinde Codemagic'e gondermeden once
# projeyi hazirlamak icin kullanilir.
#
# Kullanim: bash scripts/setup-ios.sh
# ════════════════════════════════════════════════════════════════

set -e

echo "🚀 Fingenda iOS Kurulumu Basliyor..."
echo ""

# 1. Node bagimliliklarini yukle
echo "📦 Node bagimliliklari yukleniyor..."
npm install
echo ""

# 2. Web dosyalarini build et
echo "🔨 Web dosyalari build ediliyor..."
node scripts/build.js
echo ""

# 3. Capacitor iOS platformunu ekle (yoksa)
if [ ! -d "ios" ]; then
    echo "📱 iOS platformu ekleniyor..."
    npx cap add ios
    echo ""
else
    echo "📱 iOS platformu zaten mevcut."
fi

# 4. Capacitor sync
echo "🔄 Capacitor sync yapiliyor..."
npx cap sync ios
echo ""

# 4.1 Native iOS speech plugin kur
echo "ğŸŽ¤ Native iOS speech plugin uygulanıyor..."
node scripts/install-ios-speech-plugin.js
echo ""

# 5. iOS ikonlarini olustur
echo "🎨 iOS ikonlari olusturuluyor..."
if command -v python3 &>/dev/null; then
    python3 scripts/generate-ios-icons.py
else
    echo "⚠️  Python3 bulunamadi. iOS ikonlarini manuel olarak olusturun."
fi
echo ""

# 6. Info.plist guncellemeleri
PLIST_PATH="ios/App/App/Info.plist"
if [ -f "$PLIST_PATH" ]; then
    echo "📝 Info.plist kontrol ediliyor..."
    # Privacy descriptions (Codemagic build icin gerekli)
    if ! grep -q "NSCameraUsageDescription" "$PLIST_PATH"; then
        echo "  ⚠️  NSCameraUsageDescription eksik - manuel olarak ekleyin"
    fi
    if ! grep -q "NSPhotoLibraryUsageDescription" "$PLIST_PATH"; then
        echo "  ⚠️  NSPhotoLibraryUsageDescription eksik - manuel olarak ekleyin"
    fi
    if ! grep -q "NSMicrophoneUsageDescription" "$PLIST_PATH"; then
        echo "  âš ï¸  NSMicrophoneUsageDescription eksik - manuel olarak ekleyin"
    fi
    if ! grep -q "NSSpeechRecognitionUsageDescription" "$PLIST_PATH"; then
        echo "  âš ï¸  NSSpeechRecognitionUsageDescription eksik - manuel olarak ekleyin"
    fi
fi
echo ""

echo "✅ Kurulum tamamlandi!"
echo ""
echo "Sonraki adimlar:"
echo "  1. Projeyi GitHub'a pushlayın"
echo "  2. Codemagic'te yeni uygulama olusturun"
echo "  3. codemagic.yaml yapilandirmasini kullanin"
echo "  4. App Store Connect API key'i Codemagic'e ekleyin"
echo "  5. Build'i baslatın!"
echo ""
