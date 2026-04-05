# Fingenda iOS App Store Kurulum Rehberi

Windows uzerinden Codemagic ile iOS App Store'a yayinlama adim adim rehber.

---

## Onkosuller

- Apple Developer hesabi ($99/yil) - https://developer.apple.com
- Codemagic hesabi (ucretsiz plan yeterli) - https://codemagic.io
- GitHub hesabi (projeyi barindirmak icin)
- Node.js 20+ yuklu (Windows)

---

## Adim 1: Apple Developer Hesabi Hazirlik

### 1.1 App Store Connect'te Uygulama Olusturma

1. https://appstoreconnect.apple.com adresine gidin
2. "My Apps" > "+" > "New App" secin
3. Bilgileri girin:
   - Platform: iOS
   - Name: Fingenda
   - Primary Language: Turkish
   - Bundle ID: com.fingenda.app (Identifiers'dan once olusturun)
   - SKU: fingenda-ios-001

### 1.2 Bundle ID Olusturma

1. https://developer.apple.com/account > Certificates, IDs & Profiles
2. Identifiers > "+" tiklayin
3. "App IDs" > "App" secin
4. Bilgileri girin:
   - Description: Fingenda
   - Bundle ID: Explicit > com.fingenda.app
5. Capabilities'den secin:
   - Push Notifications
   - Associated Domains (opsiyonel)

### 1.3 App Store Connect API Key (Codemagic icin)

1. App Store Connect > Users and Access > Integrations > App Store Connect API
2. "+" ile yeni key olusturun:
   - Name: Codemagic
   - Access: App Manager
3. Key'i indirin (.p8 dosyasi) - **bunu bir kere indirebilirsiniz!**
4. Issuer ID ve Key ID'yi not edin

---

## Adim 2: Yerel Proje Hazirlik (Windows)

### 2.1 Bagimliliklari Yukle

```bash
cd Fingenda
npm install
```

### 2.2 Web Dosyalarini Build Et

```bash
npm run build
```

Bu komut `www/` klasorunu olusturur ve tum dosyalari kopyalar.

### 2.3 Capacitor iOS Platformunu Ekle

```bash
npx cap add ios
```

Bu komut `ios/` klasorunu yerelde olusturur.
Not: Guncel `codemagic.yaml` akisi, repo icinde `ios/` klasoru olmasa bile build sirasinda bu klasoru otomatik olusturur.

### 2.4 Capacitor Sync

```bash
npx cap sync ios
```

### 2.5 iOS Ikonlarini Olustur

```bash
python3 scripts/generate-ios-icons.py
```

Bu komut `ios/App/App/Assets.xcassets/AppIcon.appiconset/` icerisine tum ikonlari olusturur.

### 2.6 Info.plist Guncellemesi

`ios/App/App/Info.plist` dosyasina `ios-privacy-info.plist` icindeki key'leri ekleyin:
- NSCameraUsageDescription
- NSPhotoLibraryUsageDescription
- NSFaceIDUsageDescription
- MinimumOSVersion: 17.0
- UISupportedInterfaceOrientations: sadece Portrait

### 2.7 PrivacyInfo.xcprivacy

`PrivacyInfo.xcprivacy` dosyasini `ios/App/App/` klasorune kopyalayin.
Xcode projesinde (Codemagic uzerinde otomatik) dosyayi projeye eklemeyi unutmayin.

---

## Adim 3: GitHub'a Gonderme

```bash
git init
git add .
git commit -m "Fingenda iOS - Initial Capacitor setup"
git remote add origin https://github.com/KULLANICI_ADINIZ/fingenda.git
git branch -M main
git push -u origin main
```

---

## Adim 4: Codemagic Yapilandirmasi

### 4.1 Codemagic'te Uygulama Ekleme

1. https://codemagic.io adresine gidin
2. "Add application" > GitHub reponuzu secin
3. "Workflow from codemagic.yaml" secin

### 4.2 App Store Connect API Key Ekleme

1. Codemagic > Teams > Integrations > App Store Connect
2. "Add key" tiklayin
3. Bilgileri girin:
   - Key name: Fingenda (codemagic.yaml'daki isimle ayni olmali)
   - Issuer ID: Apple'dan aldiginiz ID
   - Key ID: Apple'dan aldiginiz ID
   - .p8 dosyasini yukleyin

### 4.3 Code Signing (Otomatik)

Codemagic otomatik code signing kullanir:
1. Codemagic > App > Settings > Code signing
2. "Automatic" secin
3. Apple Developer hesap bilgilerinizi girin

### 4.4 Ortam Degiskenleri (Opsiyonel)

Eger ozel degiskenler gerekiyorsa:
- Codemagic > App > Environment variables
- Ornek: `APP_VERSION`, `BUILD_NUMBER`

---

## Adim 5: Build Baslatma

### 5.1 Ilk Build

1. Codemagic > Fingenda uygulamaniz
2. "Start new build" tiklayin
3. Workflow: "ios-testflight" secin (ilk test icin)
4. Branch: main
5. "Start build"

### 5.2 Build Sureci

Codemagic otomatik olarak:
1. Node bagimliliklerini yukler
2. `node scripts/build.js` calistirir
3. `npx cap sync ios` yapar
4. CocoaPods yukler
5. Xcode build yapar
6. IPA olusturur
7. TestFlight'a yukler

### 5.3 Hata Durumunda

Yaygin hatalar ve cozumleri:

**"Code signing error":**
- Codemagic code signing ayarlarini kontrol edin
- Bundle ID'nin Apple Developer ile eslestiginden emin olun

**"Pod install failed":**
- ios/App/Podfile'i kontrol edin
- Capacitor surum uyumlulugunu dogrulayin

**"Build failed - missing provisioning profile":**
- Codemagic'te automatic signing aktif mi kontrol edin

---

## Adim 6: TestFlight Test

1. App Store Connect > Fingenda > TestFlight
2. Build yuklendikten sonra "Manage Compliance" > "None of the above"
3. Test grubuna ekleyin (Internal Testing icin)
4. iPhone'unuza TestFlight uygulamasini yukleyin
5. Test edin!

---

## Adim 7: App Store'a Gonderme

1. App Store Connect > Fingenda > App Store
2. Version bilgilerini doldurun:
   - Screenshots (6.7" ve 5.5" zorunlu)
   - Description (Turkce ve Ingilizce)
   - Keywords
   - Support URL
   - Privacy Policy URL (zorunlu!)
3. Build sekmesinden TestFlight build'ini secin
4. "Submit for Review"

### Gerekli App Store Gorselleri

| Cihaz | Boyut |
|-------|-------|
| iPhone 6.7" (15 Pro Max) | 1290 x 2796 |
| iPhone 6.5" (11 Pro Max) | 1242 x 2688 |
| iPhone 5.5" (8 Plus) | 1242 x 2208 |
| iPad Pro 12.9" | 2048 x 2732 |

---

## Adim 8: Privacy Policy (Zorunlu)

App Store icin bir Privacy Policy sayfasi gereklidir. Icermesi gerekenler:
- Hangi verilerin toplandigini (yerel depolama, kamera izni)
- Verilerin nasil kullanildigini
- Ucuncu taraflarla paylasim (yapilmiyorsa belirtin)
- Kullanicinin haklari

Bir web sayfasi olarak yayinlayin ve URL'yi App Store Connect'e ekleyin.

---

## Dosya Yapisi Ozeti

```
Fingenda/
├── index.html              # Ana uygulama (degistirilmedi)
├── dna-refresh-core.js     # DNA analiz motoru (degistirilmedi)
├── dna-refresh-ui.js       # DNA UI (degistirilmedi)
├── dna-refresh.css         # DNA stilleri (degistirilmedi)
├── sw.js                   # Service Worker (Capacitor uyumlu guncellendi)
├── logo.jpg                # Orijinal logo
├── logo-120.png            # iOS icon (olusturuldu)
├── logo-152.png            # iOS icon (olusturuldu)
├── logo-180.png            # iOS icon (olusturuldu)
├── manifest.json           # PWA manifest (olusturuldu)
├── package.json            # Node.js bagimliliklari (olusturuldu)
├── capacitor.config.json   # Capacitor yapilandirmasi (olusturuldu)
├── codemagic.yaml          # CI/CD pipeline (olusturuldu)
├── .gitignore              # Git haric tutma (olusturuldu)
├── PrivacyInfo.xcprivacy   # iOS 17+ privacy manifest (olusturuldu)
├── ios-privacy-info.plist  # Info.plist referans (olusturuldu)
├── icons/                  # Tum boyutlarda ikonlar (olusturuldu)
│   ├── icon-72x72.png
│   ├── icon-1024x1024.png
│   └── ... (20 boyut)
├── scripts/
│   ├── build.js            # Web build scripti (olusturuldu)
│   ├── setup-ios.sh        # iOS kurulum scripti (olusturuldu)
│   └── generate-ios-icons.py # Xcode ikon generator (olusturuldu)
├── www/                    # Build ciktisi (git'e dahil degil)
└── ios/                    # Capacitor iOS projesi (git'e dahil degil)
```

---

## Onemli Notlar

1. **Kod yapisi degistirilmedi** - Mevcut tasarim ve isleyis korundu
2. **Capacitor bridge** zaten kodunuzda vardi (FingoHaptics, FingoStatusBar vb.) - sadece `<script src="capacitor.js">` eklendi
3. **iOS 17+** hedefleniyor - en iyi PWA/Capacitor destegi
4. **Service Worker** Capacitor ortaminda otomatik olarak Capacitor cache'ine yonlendirilir
5. **Codemagic ucretsiz plan** ayda 500 build dakikasi saglar (yeterli)
