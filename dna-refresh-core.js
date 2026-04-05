(function initFingoDnaCore() {
    if (window.FingoDna && window.FingoDna.coreReady) return;

    const dna = window.FingoDna || (window.FingoDna = {});

    dna.library = [
        { key: 'Market', label: 'Market', icon: '\u{1F6D2}', color: '#22c55e', driver: 'needs', keywords: ['market', 'gida', 'bakkal', 'supermarket', 'manav', 'migros', 'a101', 'sok', 'carrefour', 'macro'] },
        { key: 'Fatura', label: 'Fatura', icon: '\u{1F4C4}', color: '#f59e0b', driver: 'needs', keywords: ['fatura', 'elektrik', 'su', 'dogalgaz', 'internet', 'telefon', 'gsm', 'kira', 'aidat', 'sigorta'] },
        { key: 'Ulasim', label: 'Ula\u015f\u0131m', icon: '\u{1F698}', color: '#3b82f6', driver: 'needs', keywords: ['ulasim', 'benzin', 'yakit', 'metro', 'otobus', 'taksi', 'uber', 'iett', 'otopark', 'park', 'arac'] },
        { key: 'Eglence', label: 'E\u011flence', icon: '\u{1F3AC}', color: '#8b5cf6', driver: 'wants', keywords: ['eglence', 'sinema', 'oyun', 'game', 'steam', 'playstation', 'xbox', 'konser', 'festival', 'hobi', 'etkinlik'] },
        { key: 'Giyim', label: 'Giyim', icon: '\u{1F455}', color: '#ec4899', driver: 'wants', keywords: ['giyim', 'ayakkabi', 'aksesuar', 'kiyafet', 'moda'] },
        { key: 'Saglik', label: 'Sa\u011fl\u0131k', icon: '\u2695\uFE0F', color: '#ef4444', driver: 'needs', keywords: ['saglik', 'ilac', 'eczane', 'hastane', 'doktor', 'muayene', 'dis'] },
        { key: 'Egitim', label: 'E\u011fitim', icon: '\u{1F4DA}', color: '#06b6d4', driver: 'needs', keywords: ['egitim', 'kurs', 'kitap', 'ders', 'okul', 'sinav', 'sertifika'] },
        { key: 'YatirimBirikim', label: 'Yat\u0131r\u0131m/Birikim', icon: '\u{1F4C8}', color: '#0ea5e9', driver: 'future', keywords: ['yatirim', 'birikim', 'altin', 'doviz', 'hisse', 'fon', 'mevduat', 'kripto', 'borsa', 'usd', 'eur'] },
        { key: 'Diger', label: 'Di\u011fer', icon: '\u{1F4CC}', color: '#94a3b8', driver: 'wants', keywords: [] }
    ];

    dna.driverCopy = { needs: '\u0130htiya\u00e7', wants: '\u0130stek', future: 'Gelecek' };

    dna.escapeHtml = (value) => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    dna.formatMoney = (value) => {
        const amount = Number.isFinite(Number(value)) ? Number(value) : 0;
        if (window.formatTRY) return window.formatTRY(amount);
        return amount.toLocaleString('tr-TR', { maximumFractionDigits: 0 }) + ' \u20ba';
    };

    dna.hexToRgb = (hex) => {
        const clean = String(hex || '').replace('#', '');
        const full = clean.length === 3 ? clean.split('').map((char) => char + char).join('') : clean;
        const parsed = Number.parseInt(full, 16);
        if (!Number.isFinite(parsed)) return { r: 79, g: 70, b: 229 };
        return { r: (parsed >> 16) & 255, g: (parsed >> 8) & 255, b: parsed & 255 };
    };

    dna.hexToRgba = (hex, alpha) => {
        const rgb = dna.hexToRgb(hex);
        return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
    };

    dna.mixWithWhite = (hex, weight = 0.3) => {
        const rgb = dna.hexToRgb(hex);
        const mixed = {
            r: Math.round(rgb.r + ((255 - rgb.r) * weight)),
            g: Math.round(rgb.g + ((255 - rgb.g) * weight)),
            b: Math.round(rgb.b + ((255 - rgb.b) * weight))
        };
        return `rgb(${mixed.r}, ${mixed.g}, ${mixed.b})`;
    };

    dna.toneClass = (tone) => tone === 'positive' || tone === 'warning' || tone === 'danger' ? tone : 'neutral';

    dna.parseTxDate = (tx) => {
        const raw = tx?.timestamp && typeof tx.timestamp.toDate === 'function' ? tx.timestamp.toDate() : tx?.date;
        const date = raw instanceof Date ? raw : new Date(raw);
        return Number.isNaN(date.getTime()) ? null : date;
    };

    dna.toAmount = (value) => Math.abs(Number.parseFloat(value) || 0);

    dna.normalizeText = (value) => String(value || '')
        .toLocaleLowerCase('tr-TR')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\u0131/g, 'i');

    dna.signatureForTx = (tx) => [
        tx?.type || '',
        tx?.date || '',
        tx?.timestamp && typeof tx.timestamp.toDate === 'function' ? tx.timestamp.toDate().toISOString() : '',
        tx?.amount || '',
        tx?.category || '',
        tx?.description || ''
    ].join('|');

    dna.isExpenseTx = (tx) => tx && tx.type === 'expense' && !(window.isSavingsTransaction && window.isSavingsTransaction(tx));

    dna.getStoredTransactions = (year) => {
        try {
            const parsed = JSON.parse(localStorage.getItem(`my_expenses_${year}`) || '[]');
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            return [];
        }
    };

    dna.getCategoryConfig = (key) => dna.library.find((item) => item.key === key) || dna.library[dna.library.length - 1];

    dna.normalizeCategory = (tx) => {
        const haystack = dna.normalizeText(`${tx?.category || ''} ${tx?.description || ''}`);
        const directMatch = dna.library.find((item) => item.key !== 'Diger' && dna.normalizeText(item.label) === dna.normalizeText(tx?.category || ''));
        if (directMatch) return directMatch;
        for (const item of dna.library) {
            if (item.key === 'Diger') continue;
            if (item.keywords.some((keyword) => haystack.includes(keyword))) return item;
        }
        return dna.getCategoryConfig('Diger');
    };

    dna.isFixedCostTransaction = (tx, categoryKey) => {
        if (categoryKey === 'Fatura') return true;
        const haystack = dna.normalizeText(`${tx?.category || ''} ${tx?.description || ''}`);
        return ['abonelik', 'premium', 'netflix', 'spotify', 'digiturk', 'internet', 'telefon', 'kira', 'aidat', 'sigorta']
            .some((keyword) => haystack.includes(keyword));
    };

    dna.getTransactions = (providedTransactions, now) => {
        const years = [now.getFullYear()];
        if (now.getMonth() === 0) years.push(now.getFullYear() - 1);
        const pool = [];
        const seen = new Set();
        const candidates = [];

        if (Array.isArray(providedTransactions) && providedTransactions.length) candidates.push(...providedTransactions);
        else if (Array.isArray(window.transactions) && window.transactions.length) candidates.push(...window.transactions);
        years.forEach((year) => candidates.push(...dna.getStoredTransactions(year)));

        candidates.forEach((tx) => {
            const key = dna.signatureForTx(tx);
            if (seen.has(key)) return;
            seen.add(key);
            pool.push(tx);
        });

        return pool.filter((tx) => dna.isExpenseTx(tx) && dna.parseTxDate(tx));
    };

    dna.getRangeContext = () => {
        switch (window.__fingoBrainRange) {
            case 'day':
                return {
                    key: 'day',
                    days: 1,
                    periodLabel: 'Bugun',
                    detailLabel: 'Bugun profili',
                    confidenceWindowLabel: 'Son 2 gun',
                    emptyStateLabel: 'Bugun gider olustugunda derin dalis listesi burada belirecek.'
                };
            case 'week':
                return {
                    key: 'week',
                    days: 7,
                    periodLabel: 'Son 7 gun',
                    detailLabel: 'Son 7 gun profili',
                    confidenceWindowLabel: 'Son 14 gun',
                    emptyStateLabel: 'Son 7 gun icinde gider olustugunda derin dalis listesi burada belirecek.'
                };
            default:
                return {
                    key: 'month',
                    days: 30,
                    periodLabel: 'Son 30 gun',
                    detailLabel: 'Son 30 gun profili',
                    confidenceWindowLabel: 'Son 60 gun',
                    emptyStateLabel: 'Son 30 gun icinde gider olustugunda derin dalis listesi burada belirecek.'
                };
        }
    };

    dna.buildTrend = (currentAmount, previousAmount) => {
        if (currentAmount > 0 && previousAmount <= 0) return { tone: 'warning', label: 'Yeni hareket', note: '\u0130lk kez belirgin sinyal veriyor', delta: currentAmount };
        if (currentAmount <= 0 && previousAmount <= 0) return { tone: 'neutral', label: 'Veri yok', note: 'K\u0131yas olu\u015fmad\u0131', delta: 0 };
        if (previousAmount <= 0) return { tone: 'warning', label: 'Yeni hareket', note: '\u00d6nceki d\u00f6nem bo\u015ftu', delta: currentAmount };
        const diff = currentAmount - previousAmount;
        const pct = Math.round((Math.abs(diff) / previousAmount) * 100);
        if (Math.abs(diff) < 1) return { tone: 'neutral', label: 'Sabit', note: 'Hemen hemen ayn\u0131 seyirde', delta: 0 };
        if (diff > 0) return { tone: 'danger', label: `+%${pct}`, note: '\u00d6nceki d\u00f6neme g\u00f6re daha h\u0131zl\u0131', delta: diff };
        return { tone: 'positive', label: `-%${pct}`, note: '\u00d6nceki d\u00f6neme g\u00f6re daha sakin', delta: diff };
    };

    dna.buildDeltaChip = (currentTotal, previousTotal) => {
        if (currentTotal <= 0 && previousTotal <= 0) return { text: '\u00d6nceki d\u00f6neme g\u00f6re veri yok', tone: 'neutral' };
        if (previousTotal <= 0) return { text: '\u0130lk anlaml\u0131 DNA sinyalleri geldi', tone: 'neutral' };
        const diff = currentTotal - previousTotal;
        const pct = Math.round((Math.abs(diff) / previousTotal) * 100);
        if (Math.abs(diff) < 1) return { text: '\u00d6nceki d\u00f6nem ile ayn\u0131 dengede', tone: 'neutral' };
        if (diff < 0) return { text: `%${pct} daha sakin bir d\u00f6nem`, tone: 'positive' };
        return { text: `%${pct} daha hareketli bir d\u00f6nem`, tone: 'danger' };
    };

    dna.buildConfidence = (count, windowLabel = 'Son donem') => {
        if (count >= 20) return { label: 'Y\u00fcksek g\u00fcven', note: `${windowLabel} icinde ${count} gider islemi ile destekleniyor`, tone: 'positive' };
        if (count >= 8) return { label: 'Orta g\u00fcven', note: `${windowLabel} icinde ${count} gider islemi ile okunuyor`, tone: 'warning' };
        return { label: 'D\u00fc\u015f\u00fck g\u00fcven', note: `${windowLabel} icinde ${count} gider islemi daha derin profil icin yeterli degil`, tone: 'neutral' };
    };

    dna.buildPersona = ({ txCount, drivers, diversityScore, dominant, fixedCostShare }) => {
        if (txCount < 3) return { title: 'DNA Yeni Uyan\u0131yor', desc: 'Profil olu\u015fuyor. Birka\u00e7 gider daha eklendi\u011finde karakterin netle\u015fecek.', icon: '\u{1F9E0}', colors: ['#64748b', '#94a3b8'], signal: 'Veri toplan\u0131yor' };
        if (drivers.future >= 0.18) return { title: 'Gelecek Mimari', desc: 'Harcamalar\u0131n\u0131n dikkat \u00e7eken bir b\u00f6l\u00fcm\u00fc gelece\u011fe ayr\u0131l\u0131yor. Bug\u00fcn\u00fc ya\u015farken yar\u0131n\u0131 da kuruyorsun.', icon: '\u{1F3D7}\uFE0F', colors: ['#0f766e', '#06b6d4'], signal: 'Birikim refleksi g\u00fc\u00e7l\u00fc' };
        if (drivers.wants >= 0.5 && diversityScore >= 45) return { title: 'Ritmini Ya\u015fayan', desc: '\u0130stek odakl\u0131 ama tekd\u00fcze olmayan bir profilin var. Harcama enerjin keyif ve deneyim taraf\u0131nda yo\u011funla\u015f\u0131yor.', icon: '\u{1F389}', colors: ['#f97316', '#ec4899'], signal: 'Deneyim odakl\u0131 ak\u0131\u015f' };
        if (drivers.needs >= 0.68 || fixedCostShare >= 0.35) return { title: 'Denge Koruyucu', desc: 'Temel ihtiya\u00e7lar ve sabit giderler profilin omurgas\u0131n\u0131 olu\u015fturuyor. Dikkatli ve kontrol odakl\u0131 hareket ediyorsun.', icon: '\u{1F6E1}\uFE0F', colors: ['#2563eb', '#4f46e5'], signal: 'G\u00fcvenlik odakl\u0131 plan' };
        if (diversityScore >= 65) return { title: 'Da\u011f\u0131l\u0131m Ustas\u0131', desc: 'Harcamalar\u0131n farkl\u0131 alanlara yay\u0131l\u0131yor. Profilin tek bir kategoriye kapanm\u0131yor; bu da seni esnek bir planlay\u0131c\u0131 yap\u0131yor.', icon: '\u2696\uFE0F', colors: ['#4f46e5', '#06b6d4'], signal: '\u00c7ok kanall\u0131 denge' };
        return { title: `${dominant.label} Oda\u011f\u0131`, desc: `${dominant.label} kategorisi DNA haritan\u0131n en g\u00fc\u00e7l\u00fc alan\u0131. Profilin odakl\u0131 ve tekrar eden bir harcama ritmi g\u00f6steriyor.`, icon: dominant.icon, colors: [dominant.color, dna.mixWithWhite(dominant.color, 0.35)], signal: 'Belirgin bask\u0131n kategori' };
    };

    dna.buildDriverStory = (drivers, fixedCostShare) => {
        const sorted = Object.entries(drivers).sort((a, b) => b[1] - a[1]).map(([key, value]) => `${dna.driverCopy[key]} %${Math.round(value * 100)}`);
        const parts = [];
        if (sorted.length) parts.push(`Profilin ${sorted.join(', ')} dengesine gore sekilleniyor.`);
        if (drivers.future >= 0.18) parts.push('Gelecek payi kuvvetli oldugu icin DNA tarafinda kontrollu ve bilincli bir sinyal goruluyor.');
        else if (drivers.wants >= 0.45) parts.push('Istek payin one gectigi icin profilin daha spontane ve keyif odakli okunuyor.');
        else parts.push('Temel ihtiyac payi agir bastigindan profilin daha planli ve savunmaci bir karakter tasiyor.');
        if (fixedCostShare >= 0.35) parts.push('Sabit giderlerin omurgasi guclu; kucuk optimizasyonlar bile toplam resmi ciddi etkileyebilir.');
        return parts.join(' ');
    };

    dna.buildActions = ({ hasCurrent, txCount, drivers, fixedCostShare, diversityScore, dominantShare, monthDelta }) => {
        if (!hasCurrent) return [{ tone: 'neutral', badge: '01', title: 'Bu donem icin gider bekleniyor', desc: 'Secili donemde analiz edilecek gider gorulmedi. Yeni islemler geldikce aksiyon motoru otomatik olarak dolacak.' }];
        if (txCount < 3) return [{ tone: 'neutral', badge: '01', title: 'Biraz daha veri topla', desc: 'En az 3-4 gider daha eklendiginde aksiyon motoru daha guvenilir ve kisisellestirilmis hale gelecek.' }];
        const actions = [];
        if (drivers.wants > 0.45) actions.push({ tone: 'warning', badge: '01', title: 'Istek tarafina mikro limit koy', desc: `Istek odakli harcamalar profilinin %${Math.round(drivers.wants * 100)}'ini olusturuyor. Haftalik mini tavan belirlemek DNA'ni sakinlestirir.` });
        if (fixedCostShare > 0.35) actions.push({ tone: 'danger', badge: actions.length ? `0${actions.length + 1}` : '02', title: 'Sabit giderleri tek tur gozden gecir', desc: 'Fatura ve abonelik agirlikli bir iskelet var. Teklif karsilastirmasi veya abonelik temizligi en hizli kazanim olur.' });
        if (drivers.future < 0.12) actions.push({ tone: 'positive', badge: actions.length ? `0${actions.length + 1}` : '03', title: 'Gelecek payini otomatiklestir', desc: 'DNA profilinde birikim sinyali dusuk. Kucuk ama sabit bir otomatik aktarim karakter dengesini guclendirir.' });
        if (diversityScore < 30 && dominantShare > 0.5) actions.push({ tone: 'warning', badge: actions.length ? `0${actions.length + 1}` : '04', title: 'Tek baskin kategoriyi parcala', desc: 'Tek bir alan toplam resmi fazla domine ediyor. O kategorideki kalemleri alt gruplara ayirmak daha dogru bir DNA okumasi saglar.' });
        if (!actions.length) actions.push({ tone: monthDelta < 0 ? 'positive' : 'neutral', badge: '01', title: monthDelta < 0 ? 'Mevcut ritmi koru' : 'Dengeyi ince ayarla', desc: monthDelta < 0 ? 'Onceki doneme gore daha sakin bir akis var. Bu ritmi korumak DNA profilini daha dengeli hale getiriyor.' : 'Belirgin bir problem sinyali yok. Kucuk haftalik kontroller profilin bu dengede kalmasina yardim eder.' });
        return actions.slice(0, 3);
    };

    dna.ensureLayout = () => {
        const tab = document.getElementById('autopilot-tab-dna');
        if (!tab) return null;
        tab.classList.remove('space-y-5');
        tab.classList.add('space-y-4');
        if (tab.dataset.dnaUpgraded !== 'true') {
            tab.innerHTML = `
                <section id="dna-personality-card" class="dna-shell-card dna-summary-card"><div class="dna-summary-card__aura"></div><div class="dna-summary-card__content"><div class="dna-card-head dna-card-head--summary"><div><p class="dna-card-eyebrow">DNA Ozeti</p><h3 class="dna-card-title">FingoBrain Harcama Profili</h3></div><div id="dna-confidence-badge" class="dna-chip dna-chip--neutral">Veri okunuyor</div></div><div class="dna-summary-card__hero"><div id="dna-persona-icon" class="dna-summary-card__icon">&#129504;</div><div class="min-w-0"><h2 id="dna-persona-title" class="dna-summary-card__title">DNA okunuyor...</h2><p id="dna-persona-desc" class="dna-summary-card__desc">Secili donemdeki harcamalar analiz edilip finansal karakterin cozumleniyor.</p></div></div><div class="dna-summary-card__chips"><div id="dna-month-comparison" class="dna-chip dna-chip--muted">Onceki donemle kiyas hazirlaniyor</div><div id="dna-summary-period" class="dna-chip dna-chip--ghost">Secili donem</div></div><div class="dna-summary-card__stats"><div class="dna-summary-card__stat"><span class="dna-summary-card__label">Toplam gider</span><strong id="dna-summary-total" class="dna-summary-card__value">--</strong></div><div class="dna-summary-card__stat"><span class="dna-summary-card__label">Aktif DNA</span><strong id="dna-summary-signal" class="dna-summary-card__value">Analiz</strong></div></div></div></section>
                <section class="dna-shell-card dna-map-card"><div class="dna-card-head"><div><p class="dna-card-eyebrow">DNA Haritasi</p><h3 class="dna-card-title">Kategori dagilimi</h3></div><button onclick="window.renderRadarChart()" class="dna-refresh-btn" aria-label="DNA analizini yenile"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg></button></div><div class="dna-map-card__body"><div class="dna-map-card__chart"><div id="dna-chart-empty" class="dna-empty-state hidden"><div class="dna-empty-state__icon">◎</div><p class="dna-empty-state__title">Radar icin gider gerekli</p><p class="dna-empty-state__desc">Birkac gider eklendiginde DNA haritan otomatik olarak olusacak.</p></div><canvas id="radarChart"></canvas></div><div class="dna-metric-grid"><article class="dna-metric-card"><span class="dna-metric-card__label">Baskin alan</span><strong id="dna-dominant-cat" class="dna-metric-card__value">--</strong><p id="dna-dominant-note" class="dna-metric-card__note">En yuksek pay</p></article><article class="dna-metric-card"><span class="dna-metric-card__label">Cesitlilik</span><strong id="dna-diversity-score" class="dna-metric-card__value">--</strong><p id="dna-diversity-note" class="dna-metric-card__note">Dagilim dengesi</p></article><article class="dna-metric-card"><span class="dna-metric-card__label">Aktif kategori</span><strong id="dna-total-cats" class="dna-metric-card__value">--</strong><p id="dna-total-cats-note" class="dna-metric-card__note">Gorunen sinyal</p></article></div></div></section>
                <section class="dna-shell-card"><div class="dna-card-head"><div><p class="dna-card-eyebrow">Davranis suruculeri</p><h3 class="dna-card-title">Neden bu persona cikiyor?</h3></div></div><div class="dna-driver-list"><div class="dna-driver-row"><div class="dna-driver-row__top"><span class="dna-driver-row__label">Ihtiyac</span><strong id="dna-driver-needs-value" class="dna-driver-row__value">0%</strong></div><div class="dna-driver-row__track"><span id="dna-driver-needs-fill" class="dna-driver-row__fill dna-driver-row__fill--needs"></span></div></div><div class="dna-driver-row"><div class="dna-driver-row__top"><span class="dna-driver-row__label">Istek</span><strong id="dna-driver-wants-value" class="dna-driver-row__value">0%</strong></div><div class="dna-driver-row__track"><span id="dna-driver-wants-fill" class="dna-driver-row__fill dna-driver-row__fill--wants"></span></div></div><div class="dna-driver-row"><div class="dna-driver-row__top"><span class="dna-driver-row__label">Gelecek</span><strong id="dna-driver-future-value" class="dna-driver-row__value">0%</strong></div><div class="dna-driver-row__track"><span id="dna-driver-future-fill" class="dna-driver-row__fill dna-driver-row__fill--future"></span></div></div></div><div id="dna-drivers-story" class="dna-story-card">Verilerin okunuyor. Birazdan hangi davranis surucusunun baskin oldugunu netlestirecegiz.</div></section>
                <section class="dna-shell-card"><div class="dna-card-head"><div><p class="dna-card-eyebrow">Akilli icgoruler</p><h3 class="dna-card-title">Bugun fark yaratan sinyaller</h3></div></div><div class="dna-insight-grid"><article class="dna-insight-card dna-insight-card--accent"><span class="dna-insight-card__eyebrow">En hizli yukselen</span><strong id="dna-insight-rising" class="dna-insight-card__value">--</strong><p id="dna-insight-rising-note" class="dna-insight-card__note">Trend analizi hazirlaniyor</p></article><article class="dna-insight-card"><span class="dna-insight-card__eyebrow">En baskin alan</span><strong id="dna-insight-focus" class="dna-insight-card__value">--</strong><p id="dna-insight-focus-note" class="dna-insight-card__note">Pay okunuyor</p></article><article class="dna-insight-card"><span class="dna-insight-card__eyebrow">Veri yeterliligi</span><strong id="dna-insight-confidence" class="dna-insight-card__value">--</strong><p id="dna-insight-confidence-note" class="dna-insight-card__note">Son donem</p></article></div></section>
                <section class="dna-shell-card"><div class="dna-card-head"><div><p class="dna-card-eyebrow">Onerilen aksiyonlar</p><h3 class="dna-card-title">DNA'na uygun sonraki adimlar</h3></div></div><div id="dna-action-list" class="dna-action-list"></div></section>
                <section class="dna-shell-card dna-categories-card"><div class="dna-card-head"><div><p class="dna-card-eyebrow">Kategori derin dalis</p><h3 class="dna-card-title">Hangi alanlar hikayeyi tasiyor?</h3></div><span id="dna-category-count" class="dna-inline-meta">0 kategori</span></div><div id="dna-category-list" class="dna-category-list"></div></section>
            `;
            tab.dataset.dnaUpgraded = 'true';
        }
        return tab;
    };

    dna.ensureDetailModal = () => {
        let modal = document.getElementById('dna-detail-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'dna-detail-modal';
            document.body.appendChild(modal);
        }
        modal.className = 'hidden fixed inset-0 z-[60] flex items-end sm:items-center justify-center pointer-events-none';
        if (modal.dataset.dnaDetailUpgraded !== 'true') {
            modal.innerHTML = '<div class="dna-detail-modal__scrim fixed inset-0" onclick="window.closeDnaDetailModal()"></div><div class="dna-detail-modal__sheet pointer-events-auto"><div class="dna-detail-modal__handle" aria-hidden="true"></div><div class="dna-detail-modal__header"><div class="dna-detail-modal__identity"><div id="dna-detail-icon" class="dna-detail-modal__icon">◎</div><div class="min-w-0"><p id="dna-detail-kicker" class="dna-detail-modal__eyebrow">Kategori derin dalis</p><h2 id="dna-detail-title" class="dna-detail-modal__title">--</h2><p id="dna-detail-subtitle" class="dna-detail-modal__subtitle">Secili donem profili</p></div></div><button onclick="window.closeDnaDetailModal()" class="dna-detail-modal__close" aria-label="Kategori detayini kapat"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button></div><div class="dna-detail-modal__stats"><article class="dna-detail-modal__stat"><span class="dna-detail-modal__stat-label">Toplam</span><strong id="dna-detail-total" class="dna-detail-modal__stat-value">--</strong></article><article class="dna-detail-modal__stat"><span class="dna-detail-modal__stat-label">Pay</span><strong id="dna-detail-pct" class="dna-detail-modal__stat-value">--</strong></article><article class="dna-detail-modal__stat"><span class="dna-detail-modal__stat-label">Trend</span><strong id="dna-detail-trend" class="dna-detail-modal__stat-value">--</strong></article></div><div class="dna-detail-modal__story"><div class="dna-detail-modal__bar"><span id="dna-detail-share-bar" class="dna-detail-modal__bar-fill"></span></div><div class="dna-detail-modal__story-copy"><p id="dna-detail-story" class="dna-detail-modal__story-text">Kategori hikayesi hazirlaniyor.</p><span id="dna-detail-count" class="dna-detail-modal__story-meta">--</span></div></div><div class="dna-detail-modal__section-head"><span>Son islemler</span><span id="dna-detail-list-meta" class="dna-inline-meta">En yeni 12 kayit</span></div><div id="dna-detail-list" class="dna-detail-modal__list"></div></div>';
            modal.dataset.dnaDetailUpgraded = 'true';
        }
        return modal;
    };

    dna.buildInsights = (providedTransactions, now = new Date()) => {
        dna.ensureLayout();
        dna.ensureDetailModal();
        const context = dna.getRangeContext();
        const windowMs = context.days * 24 * 60 * 60 * 1000;
        const transactions = dna.getTransactions(providedTransactions, now);
        const currentStart = new Date(now.getTime() - windowMs);
        const previousStart = new Date(now.getTime() - (windowMs * 2));
        const buckets = Object.fromEntries(dna.library.map((item) => [item.key, { ...item, amount: 0, previousAmount: 0, transactions: [] }]));
        let currentTotal = 0;
        let previousTotal = 0;
        let fixedCostTotal = 0;
        let recent60Count = 0;

        transactions.forEach((tx) => {
            const date = dna.parseTxDate(tx);
            if (!date || date > now || date < previousStart) return;
            const amount = dna.toAmount(tx.amount);
            if (!amount) return;
            const category = dna.normalizeCategory(tx);
            const bucket = buckets[category.key] || buckets.Diger;
            if (date >= currentStart) {
                bucket.amount += amount;
                bucket.transactions.push({ ...tx, __amount: amount, __date: date, __normalizedKey: category.key, __normalizedLabel: category.label });
                currentTotal += amount;
                if (dna.isFixedCostTransaction(tx, category.key)) fixedCostTotal += amount;
            } else {
                bucket.previousAmount += amount;
                previousTotal += amount;
            }
            recent60Count += 1;
        });

        const activeCategories = Object.values(buckets).filter((item) => item.amount > 0).sort((a, b) => b.amount - a.amount);
        const diversityScore = (() => {
            if (!currentTotal || activeCategories.length <= 1) return 0;
            let entropy = 0;
            activeCategories.forEach((item) => { const p = item.amount / currentTotal; entropy -= p * Math.log2(p); });
            const maxEntropy = Math.log2(Math.max(activeCategories.length, 1));
            return Math.round((entropy / maxEntropy) * 100);
        })();

        const driverTotals = activeCategories.reduce((acc, item) => { acc[item.driver] += item.amount; return acc; }, { needs: 0, wants: 0, future: 0 });
        const driverRatios = { needs: currentTotal ? driverTotals.needs / currentTotal : 0, wants: currentTotal ? driverTotals.wants / currentTotal : 0, future: currentTotal ? driverTotals.future / currentTotal : 0 };
        const dominant = activeCategories[0] || dna.getCategoryConfig('Diger');
        const dominantShare = currentTotal ? dominant.amount / currentTotal : 0;
        const fixedCostShare = currentTotal ? fixedCostTotal / currentTotal : 0;
        const confidence = dna.buildConfidence(recent60Count, context.confidenceWindowLabel);
        const monthDelta = currentTotal - previousTotal;
        const deltaChip = dna.buildDeltaChip(currentTotal, previousTotal);
        const persona = dna.buildPersona({ txCount: recent60Count, drivers: driverRatios, diversityScore, dominant, fixedCostShare });
        const risingCandidate = Object.values(buckets).map((item) => ({ ...item, delta: item.amount - item.previousAmount })).sort((a, b) => b.delta - a.delta)[0];

        const categories = (() => {
            if (!activeCategories.length) return [];
            const primary = activeCategories.slice(0, 5).map((item) => ({ key: item.key, label: item.label, icon: item.icon, color: item.color, amount: item.amount, share: currentTotal ? item.amount / currentTotal : 0, trend: dna.buildTrend(item.amount, item.previousAmount), transactions: item.transactions.slice().sort((a, b) => b.__date - a.__date) }));
            if (activeCategories.length <= 5) return primary;
            const rest = activeCategories.slice(5);
            const restAmount = rest.reduce((sum, item) => sum + item.amount, 0);
            const restPrevAmount = rest.reduce((sum, item) => sum + item.previousAmount, 0);
            const restTransactions = rest.flatMap((item) => item.transactions).sort((a, b) => b.__date - a.__date);
            primary.push({ key: '__others__', label: 'Di\u011fer kategoriler', icon: '\u2295', color: '#64748b', amount: restAmount, share: currentTotal ? restAmount / currentTotal : 0, trend: dna.buildTrend(restAmount, restPrevAmount), transactions: restTransactions, includes: rest.map((item) => item.label) });
            return primary;
        })();

        return {
            summary: { total: currentTotal, periodLabel: context.periodLabel, persona, confidence, deltaChip },
            chart: { labels: categories.map((item) => item.label), values: categories.map((item) => Math.round(item.share * 100)) },
            drivers: { values: driverRatios, story: dna.buildDriverStory(driverRatios, fixedCostShare) },
            insights: {
                dominant: { label: dominant.label, shareText: currentTotal ? `%${Math.round(dominantShare * 100)} pay` : 'Hen\u00fcz sinyal yok' },
                rising: risingCandidate && risingCandidate.delta > 0 ? { label: risingCandidate.label, note: dna.buildTrend(risingCandidate.amount, risingCandidate.previousAmount).note } : { label: 'Belirgin art\u0131\u015f yok', note: 'Onceki donem ile karsilastirildiginda keskin bir yukselis gorulmuyor' },
                confidence
            },
            actions: dna.buildActions({ hasCurrent: currentTotal > 0, txCount: recent60Count, drivers: driverRatios, fixedCostShare, diversityScore, dominantShare, monthDelta }),
            categories,
            stats: { dominantLabel: dominant.label, dominantShare, diversityScore, activeCount: activeCategories.length },
            meta: { currentTotal, previousTotal, monthDelta, recent60Count, hasData: currentTotal > 0, periodLabel: context.periodLabel, detailLabel: context.detailLabel, emptyStateLabel: context.emptyStateLabel }
        };
    };

    dna.coreReady = true;
})();
