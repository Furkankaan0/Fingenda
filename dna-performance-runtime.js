(function initDNAPerformanceRuntime() {
    'use strict';

    if (window.__dnaPerfRuntimeLoaded) return;
    window.__dnaPerfRuntimeLoaded = true;

    const categoryEmojis = {
        'Market': '🛒',
        'Yeme-İçme': '🍽️',
        'Ulaşım': '🚗',
        'Fatura': '📄',
        'Sağlık': '💊',
        'Eğlence': '🎬',
        'Giyim': '👕',
        'Eğitim': '📚',
        'Kira': '🏠',
        'Teknoloji': '💻',
        'Spor': '🏋️',
        'Hediye': '🎁',
        'Birikim': '💰',
        'Yatırım': '📈',
        'Diğer': '📌'
    };

    const personalities = {
        'Market': { icon: '🛒', title: 'Ev Ekonomisti', desc: 'Market ve ev ihtiyaçlarına öncelik veriyorsun. Planlı ve tutumlu bir alışverişçisin.', color: 'from-emerald-500 to-teal-600' },
        'Yeme-İçme': { icon: '👨‍🍳', title: 'Gurme Kaşif', desc: 'Lezzetlerin peşinde koşuyorsun. Yeni tatlar keşfetmeyi ve dışarıda vakit geçirmeyi seviyorsun.', color: 'from-orange-500 to-red-600' },
        'Ulaşım': { icon: '🚀', title: 'Yolların Efendisi', desc: 'Hareket halinde bir yaşamın var. Ulaşım senin için özgürlük ve tempo demek.', color: 'from-blue-500 to-indigo-600' },
        'Fatura': { icon: '💡', title: 'Düzen Ustası', desc: 'Sabit giderlerini düzenli takip ediyorsun. Finansal disiplin senin güçlü yanın.', color: 'from-slate-500 to-gray-600' },
        'Sağlık': { icon: '🏥', title: 'Sağlık Savaşçısı', desc: 'Kendine yatırım yapıyorsun. Sağlık harcamaların senin için öncelik.', color: 'from-rose-500 to-pink-600' },
        'Eğlence': { icon: '🎭', title: 'Eğlence Kralı', desc: 'Sosyal aktiviteler ve deneyimler senin enerjini yükseltiyor. Hayatın tadını çıkarıyorsun.', color: 'from-purple-500 to-fuchsia-600' },
        'Giyim': { icon: '👔', title: 'Moda İkonu', desc: 'Stil senin imzan. Giyim ve görünüş tarafında seçici davranıyorsun.', color: 'from-pink-500 to-rose-600' },
        'Eğitim': { icon: '🎓', title: 'Bilgi Avcısı', desc: 'Öğrenmeye yatırım yapıyorsun. Gelişim odaklı bir finansal karakterin var.', color: 'from-amber-500 to-yellow-600' },
        'Kira': { icon: '🏰', title: 'Yuva Mimarı', desc: 'Yaşam alanın ve konforun öncelikli. Güvenli bir temel kurmayı önemsiyorsun.', color: 'from-cyan-500 to-blue-600' },
        'Teknoloji': { icon: '🤖', title: 'Teknoloji Gurusu', desc: 'Dijital dünya senin oyun alanın. Yeniliklere hızlı adapte oluyorsun.', color: 'from-violet-500 to-purple-600' },
        'Spor': { icon: '🏆', title: 'Fitness Şampiyonu', desc: 'Enerjini ve formunu destekleyen alanlara yatırım yapıyorsun.', color: 'from-green-500 to-emerald-600' },
        'Hediye': { icon: '🎁', title: 'Cömert Kalp', desc: 'Sevdiklerini mutlu etmeyi seviyorsun. Paylaşmak senin için değerli.', color: 'from-red-500 to-rose-600' },
        'Diğer': { icon: '🌈', title: 'Çok Yönlü Yıldız', desc: 'Dengeli bir harcama profilin var. Farklı alanlara esnek şekilde dağılıyorsun.', color: 'from-indigo-500 to-purple-600' }
    };

    const state = {
        cache: null,
        cacheAt: 0,
        chart: null,
        debounceId: 0,
        frameId: 0,
        pendingFullRender: false,
        tabVisible: false,
        observer: null,
        delegateBound: false
    };

    function getRefs() {
        return {
            tab: document.getElementById('autopilot-tab-dna'),
            aura: document.querySelector('#dna-personality-card > .absolute.inset-0'),
            personaIcon: document.getElementById('dna-persona-icon'),
            personaTitle: document.getElementById('dna-persona-title'),
            personaDesc: document.getElementById('dna-persona-desc'),
            dominant: document.getElementById('dna-dominant-cat'),
            diversity: document.getElementById('dna-diversity-score'),
            totalCats: document.getElementById('dna-total-cats'),
            monthComparison: document.getElementById('dna-month-comparison'),
            categoryList: document.getElementById('dna-category-list') || document.getElementById('dna-category-pills'),
            categoryCount: document.getElementById('dna-category-count'),
            radar: document.getElementById('radarChart')
        };
    }

    function formatMoney(amount) {
        const value = Number.isFinite(Number(amount)) ? Number(amount) : 0;
        return window.formatTRY ? window.formatTRY(value) : value.toLocaleString('tr-TR', { maximumFractionDigits: 0 }) + ' ₺';
    }

    function readTransactions(key) {
        try {
            const parsed = JSON.parse(localStorage.getItem(key) || '[]');
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            return [];
        }
    }

    function gradient(index) {
        const list = [
            'linear-gradient(90deg, #6366f1, #8b5cf6)',
            'linear-gradient(90deg, #ec4899, #f43f5e)',
            'linear-gradient(90deg, #10b981, #14b8a6)',
            'linear-gradient(90deg, #f59e0b, #f97316)',
            'linear-gradient(90deg, #3b82f6, #0ea5e9)',
            'linear-gradient(90deg, #8b5cf6, #a855f7)'
        ];
        return list[index % list.length];
    }

    function isExpenseForMonth(tx, year, month) {
        if (!tx || !tx.date || tx.type !== 'expense') return false;
        const date = new Date(tx.date);
        if (Number.isNaN(date.getTime())) return false;
        if (date.getFullYear() !== year || date.getMonth() + 1 !== month) return false;
        return !(window.isSavingsTransaction ? window.isSavingsTransaction(tx) : false);
    }

    function getData(force) {
        const nowMs = Date.now();
        if (!force && state.cache && (nowMs - state.cacheAt) < 120) return state.cache;

        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        const prevMonth = month === 1 ? 12 : month - 1;
        const prevYear = month === 1 ? year - 1 : year;
        const current = readTransactions(`my_expenses_${year}`);
        const previous = prevYear === year ? current : readTransactions(`my_expenses_${prevYear}`);
        const totals = {};
        const byCategory = {};

        current.forEach((tx) => {
            if (!isExpenseForMonth(tx, year, month)) return;
            const amount = Math.abs(parseFloat(tx.amount) || 0);
            if (!amount) return;
            const category = tx.category || 'Diğer';
            const dateObj = tx.timestamp && tx.timestamp.toDate ? tx.timestamp.toDate() : new Date(tx.date);
            totals[category] = (totals[category] || 0) + amount;
            if (!byCategory[category]) byCategory[category] = [];
            byCategory[category].push({
                amount,
                description: tx.description || 'İşlem',
                dateObj: dateObj instanceof Date && !Number.isNaN(dateObj.getTime()) ? dateObj : null
            });
        });

        Object.values(byCategory).forEach((items) => items.sort((a, b) => (b.dateObj?.getTime?.() || 0) - (a.dateObj?.getTime?.() || 0)));

        const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
        const total = sorted.reduce((sum, [, value]) => sum + value, 0);
        const dominant = sorted[0]?.[0] || '--';
        const activeCount = sorted.length;
        let diversityScore = 0;
        if (total > 0 && activeCount > 1) {
            const hhi = sorted.reduce((sum, [, value]) => {
                const share = value / total;
                return sum + (share * share);
            }, 0);
            diversityScore = Math.round((1 - hhi) * 100);
        }

        const previousTotal = previous.reduce((sum, tx) => sum + (isExpenseForMonth(tx, prevYear, prevMonth) ? Math.abs(parseFloat(tx.amount) || 0) : 0), 0);
        let badgeClass = 'bg-gray-100 text-gray-500 dark:bg-gray-500/20 dark:text-gray-400';
        let badgeText = 'Değişim Yok';

        if (previousTotal > 0) {
            const change = Math.round(((total - previousTotal) / previousTotal) * 100);
            if (change < 0) {
                badgeClass = 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400';
                badgeText = `↓ %${Math.abs(change)} Düşüş`;
            } else if (change > 0) {
                badgeClass = 'bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400';
                badgeText = `↑ %${Math.abs(change)} Artış`;
            }
        } else if (total > 0) {
            badgeClass = 'bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400';
            badgeText = '↑ %100 Artış';
        }

        const data = {
            sorted,
            total,
            dominant,
            activeCount,
            diversityScore,
            previousTotal,
            byCategory,
            monthComparison: {
                amount: activeCount === 0 && previousTotal === 0 ? '--' : formatMoney(total),
                badgeClass,
                badgeText,
                hasData: !(activeCount === 0 && previousTotal === 0)
            },
            chart: {
                labels: sorted.slice(0, 6).map(([name]) => name),
                values: sorted.slice(0, 6).map(([, amount]) => total > 0 ? Math.round((amount / total) * 100) : 0)
            },
            personality: personalities[dominant] || personalities['Diğer']
        };

        state.cache = data;
        state.cacheAt = nowMs;
        window.__dnaWidgetState = data;
        return data;
    }

    function renderOverview(data) {
        const refs = getRefs();
        if (refs.aura) refs.aura.className = `absolute inset-0 bg-gradient-to-br ${data.personality.color} opacity-90`;
        if (refs.personaIcon) refs.personaIcon.textContent = data.personality.icon;
        if (refs.personaTitle) refs.personaTitle.textContent = data.personality.title;
        if (refs.personaDesc) refs.personaDesc.textContent = data.personality.desc;
        if (refs.dominant) refs.dominant.textContent = data.dominant;
        if (refs.diversity) refs.diversity.textContent = data.activeCount ? `${data.diversityScore}%` : '--';
        if (refs.totalCats) refs.totalCats.textContent = data.activeCount ? data.activeCount : '--';

        if (refs.monthComparison) {
            const valueEl = document.createElement('h3');
            valueEl.className = 'text-lg font-black text-gray-900 dark:text-white';
            valueEl.textContent = data.monthComparison.amount;
            const badgeEl = document.createElement('span');
            badgeEl.className = `text-xs font-bold px-2 py-0.5 rounded-full ${data.monthComparison.badgeClass}`;
            badgeEl.textContent = data.monthComparison.hasData ? data.monthComparison.badgeText : 'Veri Yok';
            refs.monthComparison.replaceChildren(valueEl, badgeEl);
        }
    }

    function renderList(data) {
        const refs = getRefs();
        if (!refs.categoryList) return;
        if (refs.categoryCount) refs.categoryCount.textContent = `${data.sorted.length} kategori`;

        if (!data.sorted.length) {
            const empty = document.createElement('div');
            empty.className = 'text-center py-8 text-gray-400';
            empty.innerHTML = `
                <div class="text-4xl mb-3">📊</div>
                <p class="text-sm font-medium">Henüz harcama yok</p>
                <p class="text-xs mt-1">Gider ekledikten sonra kategoriler burada görünecek</p>
            `;
            refs.categoryList.replaceChildren(empty);
            return;
        }

        const fragment = document.createDocumentFragment();
        data.sorted.forEach(([category, amount], index) => {
            const percent = data.total > 0 ? Math.round((amount / data.total) * 100) : 0;
            const row = document.createElement('button');
            row.type = 'button';
            row.className = 'relative overflow-hidden rounded-2xl p-4 bg-white/80 dark:bg-white/[0.04] border border-gray-100 dark:border-white/[0.06] shadow-sm cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-[1.01] active:scale-[0.99] text-left w-full';
            row.dataset.dnaCategory = category;
            row.innerHTML = `
                <div class="flex items-center gap-3">
                    <div class="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0" style="background:${gradient(index)}; box-shadow:0 4px 12px rgba(99,102,241,0.18);">
                        <span class="filter drop-shadow-sm">${categoryEmojis[category] || '📌'}</span>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center justify-between mb-1 gap-3">
                            <span class="text-sm font-bold text-gray-800 dark:text-white truncate">${category}</span>
                            <span class="text-sm font-black text-gray-700 dark:text-gray-200 whitespace-nowrap">${formatMoney(amount)}</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <div class="flex-1 h-1.5 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
                                <div class="h-full rounded-full transition-all duration-500" style="width:${percent}%; background:${gradient(index)};"></div>
                            </div>
                            <span class="text-[10px] font-bold text-gray-500 dark:text-gray-400 w-8 text-right">${percent}%</span>
                        </div>
                    </div>
                </div>
            `;
            fragment.appendChild(row);
        });

        refs.categoryList.replaceChildren(fragment);
    }

    function renderRadar(data) {
        const refs = getRefs();
        if (!refs.radar || typeof Chart === 'undefined') return;
        if (!data.chart.labels.length) {
            if (state.chart) {
                state.chart.destroy();
                state.chart = null;
            }
            const ctx = refs.radar.getContext('2d');
            if (ctx) ctx.clearRect(0, 0, refs.radar.width, refs.radar.height);
            return;
        }

        const ctx = refs.radar.getContext('2d');
        if (!ctx) return;
        const isDark = document.documentElement.classList.contains('dark');
        const fill = ctx.createRadialGradient(140, 120, 20, 140, 120, 180);
        fill.addColorStop(0, isDark ? 'rgba(129,140,248,0.32)' : 'rgba(99,102,241,0.22)');
        fill.addColorStop(1, isDark ? 'rgba(45,212,191,0.06)' : 'rgba(45,212,191,0.03)');

        if (!state.chart) {
            state.chart = new Chart(ctx, {
                type: 'radar',
                data: {
                    labels: data.chart.labels,
                    datasets: [{
                        label: 'Harcama DNA',
                        data: data.chart.values,
                        backgroundColor: fill,
                        borderColor: isDark ? '#a78bfa' : '#6366f1',
                        borderWidth: 2,
                        pointRadius: 4,
                        pointHoverRadius: 5,
                        pointBackgroundColor: '#ffffff',
                        pointBorderColor: isDark ? '#c4b5fd' : '#8b5cf6',
                        pointBorderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        r: {
                            beginAtZero: true,
                            max: Math.max(100, ...data.chart.values),
                            ticks: { display: false },
                            angleLines: { color: isDark ? 'rgba(148,163,184,0.16)' : 'rgba(0,0,0,0.05)' },
                            grid: { color: isDark ? 'rgba(148,163,184,0.16)' : 'rgba(0,0,0,0.05)' },
                            pointLabels: {
                                color: isDark ? '#cbd5e1' : '#9ca3af',
                                font: { size: 11, family: 'system-ui' }
                            }
                        }
                    }
                }
            });
            return;
        }

        state.chart.data.labels = data.chart.labels;
        state.chart.data.datasets[0].data = data.chart.values;
        state.chart.data.datasets[0].backgroundColor = fill;
        state.chart.data.datasets[0].borderColor = isDark ? '#a78bfa' : '#6366f1';
        state.chart.data.datasets[0].pointBorderColor = isDark ? '#c4b5fd' : '#8b5cf6';
        state.chart.options.scales.r.max = Math.max(100, ...data.chart.values);
        state.chart.options.scales.r.angleLines.color = isDark ? 'rgba(148,163,184,0.16)' : 'rgba(0,0,0,0.05)';
        state.chart.options.scales.r.grid.color = isDark ? 'rgba(148,163,184,0.16)' : 'rgba(0,0,0,0.05)';
        state.chart.options.scales.r.pointLabels.color = isDark ? '#cbd5e1' : '#9ca3af';
        state.chart.update('none');
    }

    function canRenderHeavy() {
        const tab = getRefs().tab;
        if (!tab || tab.classList.contains('hidden')) return false;
        return !('IntersectionObserver' in window) || state.tabVisible;
    }

    function bindDelegate() {
        if (state.delegateBound) return;
        const list = getRefs().categoryList;
        if (!list) return;
        list.addEventListener('click', (event) => {
            const trigger = event.target.closest('[data-dna-category]');
            if (!trigger) return;
            window.openCategoryDetailModal(trigger.dataset.dnaCategory);
        });
        state.delegateBound = true;
    }

    function ensureObserver() {
        if (state.observer || !('IntersectionObserver' in window)) return;
        const tab = getRefs().tab;
        if (!tab) return;
        state.observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.target !== tab) return;
                state.tabVisible = entry.isIntersecting;
                if (entry.isIntersecting && state.pendingFullRender) {
                    scheduleUpdate({ full: true, immediate: true, force: true });
                }
            });
        }, { rootMargin: '160px 0px' });
        state.observer.observe(tab);
    }

    function flushUpdate(force) {
        if (state.frameId) cancelAnimationFrame(state.frameId);
        state.frameId = requestAnimationFrame(() => {
            state.frameId = 0;
            const payload = getData(force);
            renderOverview(payload);
            if (state.pendingFullRender && canRenderHeavy()) {
                renderList(payload);
                renderRadar(payload);
                state.pendingFullRender = false;
            }
        });
    }

    function scheduleUpdate(options = {}) {
        bindDelegate();
        ensureObserver();
        if (options.full) state.pendingFullRender = true;
        clearTimeout(state.debounceId);
        if (options.immediate) {
            flushUpdate(options.force);
            return window.__dnaWidgetState;
        }
        state.debounceId = window.setTimeout(() => flushUpdate(options.force), options.delay ?? 160);
        return window.__dnaWidgetState;
    }

    function renderDetailList(records, listEl) {
        if (!listEl) return;
        if (!records.length) {
            const empty = document.createElement('div');
            empty.className = 'text-center text-xs text-gray-400 py-4';
            empty.textContent = 'Bu kategoride işlem bulunamadı.';
            listEl.replaceChildren(empty);
            return;
        }

        const fragment = document.createDocumentFragment();
        records.slice(0, 50).forEach((record) => {
            const row = document.createElement('div');
            row.className = 'flex items-center justify-between p-3 rounded-xl bg-gray-50/50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 gap-3';
            row.innerHTML = `
                <div class="min-w-0">
                    <p class="text-xs font-bold text-gray-900 dark:text-white truncate max-w-[150px]">${record.description}</p>
                    <p class="text-[10px] text-gray-400">${record.dateObj ? record.dateObj.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' }) : ''}</p>
                </div>
                <p class="text-sm font-bold text-gray-900 dark:text-white whitespace-nowrap">${formatMoney(record.amount)}</p>
            `;
            fragment.appendChild(row);
        });
        listEl.replaceChildren(fragment);
    }

    window.getDNAWidgetData = function getDNAWidgetData(options = {}) {
        return getData(Boolean(options.force));
    };

    window.scheduleDNAWidgetUpdate = scheduleUpdate;
    window.updateDNAWidget = function updateDNAWidget(options = {}) {
        return scheduleUpdate({
            full: options.full !== false,
            immediate: Boolean(options.immediate),
            delay: options.delay,
            force: Boolean(options.force)
        });
    };
    window.populateDnaList = function populateDnaList() {
        return scheduleUpdate({ full: true, immediate: true, force: true });
    };
    window.renderRadarChart = function renderRadarChart() {
        return scheduleUpdate({ full: true, immediate: true, force: true });
    };

    window.openCategoryDetailModal = function openCategoryDetailModal(catName) {
        const modal = document.getElementById('dna-detail-modal');
        if (!modal) return;

        const configMap = {
            'Market': { emoji: '🛒', color: '#10b981' },
            'Fatura': { emoji: '🧾', color: '#f59e0b' },
            'Ulaşım': { emoji: '🚌', color: '#3b82f6' },
            'Eğlence': { emoji: '🎬', color: '#ec4899' },
            'Giyim': { emoji: '👕', color: '#8b5cf6' },
            'Sağlık': { emoji: '💊', color: '#ef4444' },
            'Eğitim': { emoji: '🎓', color: '#06b6d4' },
            'Diğer': { emoji: '📦', color: '#6b7280' }
        };

        const data = getData(true);
        const config = configMap[catName] || { emoji: '📦', color: '#6b7280' };
        const records = data.byCategory[catName] || [];
        const total = data.sorted.find(([name]) => name === catName)?.[1] || 0;
        const pct = data.total > 0 ? Math.round((total / data.total) * 100) : 0;

        const iconEl = document.getElementById('dna-detail-icon');
        if (iconEl) {
            iconEl.textContent = config.emoji;
            iconEl.style.backgroundColor = `${config.color}20`;
            iconEl.style.color = config.color;
        }

        const titleEl = document.getElementById('dna-detail-title');
        const totalEl = document.getElementById('dna-detail-total');
        const pctEl = document.getElementById('dna-detail-pct');
        if (titleEl) titleEl.textContent = catName;
        if (totalEl) totalEl.textContent = formatMoney(total);
        if (pctEl) pctEl.textContent = `%${pct}`;

        renderDetailList(records, document.getElementById('dna-detail-list'));
        modal.classList.remove('hidden');
        modal.classList.remove('pointer-events-none');
    };

    document.addEventListener('DOMContentLoaded', () => {
        scheduleUpdate({ full: true, delay: 900, force: true });
    });

    ['fingenda_data_updated', 'storage', 'transaction:added', 'transactions:updated', 'goals:updated'].forEach((eventName) => {
        window.addEventListener(eventName, () => {
            scheduleUpdate({ full: true, delay: 180, force: true });
        }, { passive: true });
    });
})();
