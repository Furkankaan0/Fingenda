(function initFingendaCore() {
    'use strict';

    if (window.FingendaCore) return;

    const CATEGORY_FALLBACK_ICON = '✨';

    const categoryIcons = Object.freeze({
        Market: '🛒',
        'Yeme-İçme': '🍽️',
        Ulaşım: '🚕',
        Fatura: '🧾',
        Sağlık: '💊',
        Eğlence: '🍿',
        Giyim: '👕',
        Eğitim: '🎓',
        Kira: '🏠',
        Teknoloji: '💻',
        Spor: '🏃',
        Hediye: '🎁',
        Birikim: '💎',
        Yatırım: '📈',
        Kredi: '💳',
        Aidat: '🏢',
        Döviz: '💱',
        Altın: '🥇',
        Taksit: '💳',
        Diğer: CATEGORY_FALLBACK_ICON
    });

    const categoryRules = Object.freeze([
        [/kredi|kart|borc|borç|loan|credit/, '💳'],
        [/aidat|apartman|site|yonetim|yönetim/, '🏢'],
        [/market|bakkal|gida|gıda|alisveris|alışveriş|grocer/, '🛒'],
        [/saglik|sağlık|eczane|hastane|ilac|ilaç/, '💊'],
        [/eglence|eğlence|sinema|konser|netflix|spotify|oyun/, '🍿'],
        [/ulasim|ulaşım|taksi|otobus|otobüs|metro|yakit|yakıt|benzin|arac|araç/, '🚕'],
        [/yeme|icme|içme|restoran|kahve|cafe|food/, '🍽️'],
        [/giyim|kiyafet|moda/, '👕'],
        [/egitim|eğitim|okul|kurs|kitap/, '🎓'],
        [/kira|ev|konut/, '🏠'],
        [/teknoloji|telefon|bilgisayar|cihaz/, '💻'],
        [/spor|fitness|gym/, '🏃'],
        [/hediye/, '🎁'],
        [/birikim|hedef|kumbara|savings/, '💎'],
        [/yatirim|yatırım|hisse|borsa|fon|altin|altın|doviz|döviz/, '📈'],
        [/fatura|elektrik|su|dogalgaz|doğalgaz|internet|abonelik/, '🧾'],
        [/maas|maaş|gelir|income/, '💰']
    ]);

    function normalizeText(value) {
        return String(value || '')
            .normalize('NFKD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ' ')
            .replace(/[^\w\sçğıöşüÇĞİÖŞÜ-]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .toLocaleLowerCase('tr-TR');
    }

    function getCategoryIcon(category, description) {
        const rawCategory = String(category || '').trim();
        if (categoryIcons[rawCategory]) return categoryIcons[rawCategory];

        const text = normalizeText(`${rawCategory} ${description || ''}`);
        const matched = categoryRules.find(([pattern]) => pattern.test(text));
        return matched ? matched[1] : CATEGORY_FALLBACK_ICON;
    }

    function safeJsonParse(raw, fallback) {
        try {
            if (raw == null || raw === '') return fallback;
            return JSON.parse(raw);
        } catch (error) {
            return fallback;
        }
    }

    const storage = {
        get(key, fallback = null) {
            try {
                const value = window.localStorage.getItem(key);
                return value == null ? fallback : value;
            } catch (error) {
                return fallback;
            }
        },
        set(key, value) {
            try {
                window.localStorage.setItem(key, value);
                return true;
            } catch (error) {
                return false;
            }
        },
        getJson(key, fallback = null) {
            return safeJsonParse(storage.get(key), fallback);
        },
        setJson(key, value) {
            return storage.set(key, JSON.stringify(value));
        },
        remove(key) {
            try {
                window.localStorage.removeItem(key);
                return true;
            } catch (error) {
                return false;
            }
        }
    };

    const money = {
        formatTRY(amount, options = {}) {
            const value = Number.isFinite(Number(amount)) ? Number(amount) : 0;
            const fractionDigits = Number.isInteger(options.fractionDigits) ? options.fractionDigits : 0;
            return `₺${value.toLocaleString('tr-TR', {
                minimumFractionDigits: fractionDigits,
                maximumFractionDigits: fractionDigits
            })}`;
        }
    };

    const events = {
        emit(name, detail = {}) {
            window.dispatchEvent(new CustomEvent(`fingenda:${name}`, { detail }));
        },
        on(name, handler, options) {
            const eventName = `fingenda:${name}`;
            window.addEventListener(eventName, handler, options);
            return () => window.removeEventListener(eventName, handler, options);
        }
    };

    const core = Object.freeze({
        version: '1.0.0',
        categoryIcons,
        normalizeText,
        getCategoryIcon,
        getSmartIcon: getCategoryIcon,
        safeJsonParse,
        storage,
        money,
        events,
        get buildConfig() {
            return window.__FINGENDA_BUILD__ || {};
        }
    });

    window.FingendaCore = core;
    window.getPremiumCategoryIcon = window.getPremiumCategoryIcon || core.getCategoryIcon;
})();
