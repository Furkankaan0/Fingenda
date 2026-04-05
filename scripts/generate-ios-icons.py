"""
Fingenda iOS Icon Generator

Bu script, Capacitor iOS projesi icin gerekli AppIcon.appiconset
dosyalarini olusturur. Capacitor'un "npx cap add ios" komutundan
sonra calistirilmalidir.

Kullanim:
    python3 scripts/generate-ios-icons.py

Gereksinim: Pillow (pip install Pillow)
"""

import json
import os
import sys

try:
    from PIL import Image
except ImportError:
    print("Pillow kutuphanesi gerekli: pip install Pillow")
    sys.exit(1)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ICON_SRC = os.path.join(ROOT, "icons", "icon-1024x1024.png")
APPICONSET = os.path.join(ROOT, "ios", "App", "App", "Assets.xcassets", "AppIcon.appiconset")

# iOS 17+ tek ikon boyutu (1024x1024) yeterli, ancak geriye uyumluluk icin
# tum boyutlari sagliyoruz
ICONS = [
    {"size": 20, "scale": 2, "idiom": "iphone"},
    {"size": 20, "scale": 3, "idiom": "iphone"},
    {"size": 29, "scale": 2, "idiom": "iphone"},
    {"size": 29, "scale": 3, "idiom": "iphone"},
    {"size": 40, "scale": 2, "idiom": "iphone"},
    {"size": 40, "scale": 3, "idiom": "iphone"},
    {"size": 60, "scale": 2, "idiom": "iphone"},
    {"size": 60, "scale": 3, "idiom": "iphone"},
    {"size": 20, "scale": 1, "idiom": "ipad"},
    {"size": 20, "scale": 2, "idiom": "ipad"},
    {"size": 29, "scale": 1, "idiom": "ipad"},
    {"size": 29, "scale": 2, "idiom": "ipad"},
    {"size": 40, "scale": 1, "idiom": "ipad"},
    {"size": 40, "scale": 2, "idiom": "ipad"},
    {"size": 76, "scale": 1, "idiom": "ipad"},
    {"size": 76, "scale": 2, "idiom": "ipad"},
    {"size": 83.5, "scale": 2, "idiom": "ipad"},
    {"size": 1024, "scale": 1, "idiom": "ios-marketing"},
]


def main():
    if not os.path.exists(ICON_SRC):
        print(f"Kaynak ikon bulunamadi: {ICON_SRC}")
        print("Once 'icons/' klasorunde ikonlari olusturun.")
        sys.exit(1)

    if not os.path.exists(APPICONSET):
        print(f"iOS projesi bulunamadi: {APPICONSET}")
        print("Once 'npx cap add ios' komutunu calistirin.")
        sys.exit(1)

    img = Image.open(ICON_SRC).convert("RGBA")
    images_list = []

    for icon in ICONS:
        pixel_size = int(icon["size"] * icon["scale"])
        filename = f"AppIcon-{icon['size']}x{icon['size']}@{icon['scale']}x.png"

        resized = img.resize((pixel_size, pixel_size), Image.LANCZOS)
        output_path = os.path.join(APPICONSET, filename)
        resized.save(output_path, "PNG")
        print(f"  {filename} ({pixel_size}x{pixel_size})")

        images_list.append({
            "size": f"{icon['size']}x{icon['size']}",
            "idiom": icon["idiom"],
            "filename": filename,
            "scale": f"{icon['scale']}x"
        })

    # Contents.json olustur
    contents = {
        "images": images_list,
        "info": {
            "version": 1,
            "author": "Fingenda Build System"
        }
    }

    contents_path = os.path.join(APPICONSET, "Contents.json")
    with open(contents_path, "w") as f:
        json.dump(contents, f, indent=2)

    print(f"\nContents.json olusturuldu: {contents_path}")
    print(f"Toplam {len(images_list)} ikon olusturuldu!")


if __name__ == "__main__":
    main()
