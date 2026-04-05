(function initFingoDnaUi() {
    const dna = window.FingoDna;
    if (!dna || dna.uiReady) return;

    const setText = (id, value) => {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    };

    const setChip = (id, text, tone) => {
        const element = document.getElementById(id);
        if (!element) return;
        element.className = `dna-chip dna-chip--${dna.toneClass(tone)}`;
        element.textContent = text;
    };

    window.renderDnaRadar = function renderDnaRadar(chart) {
        dna.ensureLayout();
        const canvas = document.getElementById('radarChart');
        const emptyState = document.getElementById('dna-chart-empty');
        if (!canvas) return;

        if (window.__fingoDnaChartInstance) {
            window.__fingoDnaChartInstance.destroy();
            window.__fingoDnaChartInstance = null;
        }

        if (!window.Chart || !chart || !chart.labels.length) {
            canvas.classList.add('hidden');
            if (emptyState) emptyState.classList.remove('hidden');
            return;
        }

        canvas.classList.remove('hidden');
        if (emptyState) emptyState.classList.add('hidden');

        const isDark = document.documentElement.classList.contains('dark');
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createRadialGradient(140, 120, 20, 140, 120, 180);
        gradient.addColorStop(0, isDark ? 'rgba(129, 140, 248, 0.42)' : 'rgba(79, 70, 229, 0.28)');
        gradient.addColorStop(1, isDark ? 'rgba(34, 211, 238, 0.08)' : 'rgba(34, 211, 238, 0.04)');

        window.__fingoDnaChartInstance = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: chart.labels,
                datasets: [{
                    data: chart.values,
                    backgroundColor: gradient,
                    borderColor: isDark ? '#818cf8' : '#4f46e5',
                    borderWidth: 2.2,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    pointBackgroundColor: '#ffffff',
                    pointBorderColor: isDark ? '#22d3ee' : '#4f46e5',
                    pointBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label(context) {
                                return `%${context.raw}`;
                            }
                        }
                    }
                },
                scales: {
                    r: {
                        beginAtZero: true,
                        min: 0,
                        max: Math.max(100, ...chart.values),
                        ticks: { display: false },
                        angleLines: { color: isDark ? 'rgba(148, 163, 184, 0.18)' : 'rgba(148, 163, 184, 0.16)' },
                        grid: { color: isDark ? 'rgba(148, 163, 184, 0.16)' : 'rgba(148, 163, 184, 0.14)' },
                        pointLabels: {
                            color: isDark ? '#cbd5f5' : '#5b6477',
                            font: { family: 'system-ui', size: 11, weight: '700' }
                        }
                    }
                }
            }
        });
    };

    const renderActionList = (actions) => {
        const container = document.getElementById('dna-action-list');
        if (!container) return;
        container.innerHTML = actions.map((action) => `
            <article class="dna-action-card dna-action-card--${dna.toneClass(action.tone)}">
                <div class="dna-action-card__icon">${dna.escapeHtml(action.badge)}</div>
                <div>
                    <strong class="dna-action-card__title">${dna.escapeHtml(action.title)}</strong>
                    <p class="dna-action-card__desc">${dna.escapeHtml(action.desc)}</p>
                </div>
            </article>
        `).join('');
    };

    const renderCategories = (categories, meta = {}) => {
        const container = document.getElementById('dna-category-list');
        const countEl = document.getElementById('dna-category-count');
        if (!container) return;
        if (countEl) countEl.textContent = `${categories.length} kategori`;

        if (!categories.length) {
            container.innerHTML = `
                <div class="dna-list-empty">
                    <p class="dna-list-empty__title">Kategori verisi yok</p>
                    <p class="dna-list-empty__desc">${dna.escapeHtml(meta.emptyStateLabel || 'Secili donemde gider olustugunda derin dalis listesi burada belirecek.')}</p>
                </div>
            `;
            return;
        }

        container.innerHTML = categories.map((item) => {
            const trend = dna.toneClass(item.trend.tone);
            const note = item.includes?.length
                ? `${item.includes.length} kategori tek satirda toplandi`
                : `${item.transactions.length} gider islemi goruldu`;
            return `
                <button class="dna-category-row" type="button" onclick='window.openCategoryDetailModal(${JSON.stringify(item.key)})' style="--category-color:${dna.escapeHtml(item.color)}; --category-soft:${dna.escapeHtml(dna.hexToRgba(item.color, 0.14))}; --category-strong:${dna.escapeHtml(dna.mixWithWhite(item.color, 0.3))};">
                    <div class="dna-category-row__top">
                        <div class="dna-category-row__left">
                            <div class="dna-category-row__icon">${dna.escapeHtml(item.icon)}</div>
                            <div class="min-w-0">
                                <div class="dna-category-row__name">${dna.escapeHtml(item.label)}</div>
                                <div class="dna-category-row__note">${dna.escapeHtml(note)}</div>
                            </div>
                        </div>
                        <div class="dna-category-row__amount">${dna.escapeHtml(dna.formatMoney(item.amount))}</div>
                    </div>
                    <div class="dna-category-row__meta">
                        <span>%${Math.round(item.share * 100)} pay</span>
                        <div class="dna-category-row__pills">
                            <span class="dna-mini-pill dna-mini-pill--${trend}">${dna.escapeHtml(item.trend.label)}</span>
                        </div>
                    </div>
                    <div class="dna-category-row__track">
                        <span class="dna-category-row__fill" style="width:${Math.max(4, Math.round(item.share * 100))}%"></span>
                    </div>
                </button>
            `;
        }).join('');
    };

    window.renderDnaTab = function renderDnaTab(insights) {
        dna.ensureLayout();
        dna.ensureDetailModal();
        const data = insights || dna.buildInsights(window.transactions, new Date());
        window.__dnaInsightsCache = data;

        const hero = document.getElementById('dna-personality-card');
        if (hero) {
            hero.style.setProperty('--dna-hero-start', data.summary.persona.colors[0]);
            hero.style.setProperty('--dna-hero-end', data.summary.persona.colors[1]);
        }

        setText('dna-persona-icon', data.summary.persona.icon);
        setText('dna-persona-title', data.summary.persona.title);
        setText('dna-persona-desc', data.summary.persona.desc);
        setText('dna-summary-total', dna.formatMoney(data.summary.total));
        setText('dna-summary-period', data.summary.periodLabel);
        setText('dna-summary-signal', data.summary.persona.signal);
        setChip('dna-confidence-badge', data.summary.confidence.label, data.summary.confidence.tone);
        setChip('dna-month-comparison', data.summary.deltaChip.text, data.summary.deltaChip.tone);

        setText('dna-dominant-cat', data.stats.dominantLabel);
        setText('dna-dominant-note', data.meta.currentTotal ? `%${Math.round(data.stats.dominantShare * 100)} pay ile lider` : 'Henuz lider kategori yok');
        setText('dna-diversity-score', data.meta.hasData ? `%${data.stats.diversityScore}` : '--');
        setText('dna-diversity-note', data.meta.hasData ? 'Shannon tabanli denge skoru' : 'Dagilim olusmadi');
        setText('dna-total-cats', data.meta.hasData ? `${data.stats.activeCount}` : '--');
        setText('dna-total-cats-note', data.meta.hasData ? 'Ayni donemde aktif kategori' : 'Aktif sinyal yok');

        setText('dna-driver-needs-value', `%${Math.round(data.drivers.values.needs * 100)}`);
        setText('dna-driver-wants-value', `%${Math.round(data.drivers.values.wants * 100)}`);
        setText('dna-driver-future-value', `%${Math.round(data.drivers.values.future * 100)}`);
        ['needs', 'wants', 'future'].forEach((key) => {
            const fill = document.getElementById(`dna-driver-${key}-fill`);
            if (fill) fill.style.width = `${Math.round(data.drivers.values[key] * 100)}%`;
        });
        setText('dna-drivers-story', data.drivers.story);

        setText('dna-insight-rising', data.insights.rising.label);
        setText('dna-insight-rising-note', data.insights.rising.note);
        setText('dna-insight-focus', data.insights.dominant.label);
        setText('dna-insight-focus-note', data.insights.dominant.shareText);
        setText('dna-insight-confidence', data.insights.confidence.label);
        setText('dna-insight-confidence-note', data.insights.confidence.note);

        renderActionList(data.actions);
        renderCategories(data.categories, data.meta);
        window.renderDnaRadar(data.chart);
        return data;
    };

    window.closeDnaDetailModal = function closeDnaDetailModal() {
        const modal = dna.ensureDetailModal();
        if (!modal) return;
        modal.classList.add('hidden');
        modal.classList.add('pointer-events-none');
    };

    window.openCategoryDetailModal = function openCategoryDetailModal(categoryKey) {
        const modal = dna.ensureDetailModal();
        const insights = window.__dnaInsightsCache || window.renderRadarChart();
        const item = insights?.categories?.find((entry) => entry.key === categoryKey);
        if (!modal || !item) return;

        const sharePct = Math.round(item.share * 100);
        const subtitle = item.includes?.length
            ? `${item.includes.join(', ')} alanlari birlikte okunuyor.`
            : `${insights?.meta?.periodLabel || 'Secili donem'} icinde ${item.transactions.length} gider bu kategoriye tasindi.`;

        const iconEl = document.getElementById('dna-detail-icon');
        if (iconEl) {
            iconEl.textContent = item.icon;
            iconEl.style.color = item.color;
            iconEl.style.background = dna.hexToRgba(item.color, 0.14);
        }

        setText('dna-detail-title', item.label);
        setText('dna-detail-subtitle', subtitle);
        setText('dna-detail-total', dna.formatMoney(item.amount));
        setText('dna-detail-pct', `%${sharePct}`);
        setText('dna-detail-trend', item.trend.label);
        setText('dna-detail-story', item.trend.note);
        setText('dna-detail-count', item.includes?.length ? `${item.includes.length} kategori toplaniyor` : `${item.transactions.length} islem bulundu`);
        setText('dna-detail-list-meta', `En yeni ${Math.min(item.transactions.length, 12)} kayit`);

        const shareBar = document.getElementById('dna-detail-share-bar');
        if (shareBar) {
            shareBar.style.width = `${Math.max(6, sharePct)}%`;
            shareBar.style.background = `linear-gradient(90deg, ${item.color}, ${dna.mixWithWhite(item.color, 0.3)})`;
        }

        const list = document.getElementById('dna-detail-list');
        if (list) {
            const records = item.transactions.slice(0, 12);
            list.innerHTML = records.length ? records.map((tx) => {
                const dateLabel = tx.__date ? tx.__date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' }) : '--';
                return `
                    <article class="dna-detail-modal__tx">
                        <div class="min-w-0">
                            <div class="dna-detail-modal__tx-title">${dna.escapeHtml(tx.description || tx.__normalizedLabel || item.label)}</div>
                            <div class="dna-detail-modal__tx-meta">${dna.escapeHtml(`${dateLabel} • ${tx.__normalizedLabel || item.label}`)}</div>
                        </div>
                        <div class="dna-detail-modal__tx-amount">${dna.escapeHtml(dna.formatMoney(tx.__amount || tx.amount))}</div>
                    </article>
                `;
            }).join('') : `
                <div class="dna-list-empty">
                    <p class="dna-list-empty__title">Bu alanda gosterilecek kayit yok</p>
                    <p class="dna-list-empty__desc">Detay gorunmesi icin bu kategoriye ait gider olusmasi gerekiyor.</p>
                </div>
            `;
        }

        modal.classList.remove('hidden');
        modal.classList.remove('pointer-events-none');
    };

    window.buildDnaInsights = dna.buildInsights;
    window.renderRadarChart = function renderRadarChart() {
        dna.ensureLayout();
        dna.ensureDetailModal();
        return window.renderDnaTab(dna.buildInsights(window.transactions, new Date()));
    };
    window.populateDnaList = function populateDnaList() {
        return window.__dnaInsightsCache || window.renderRadarChart();
    };
    window.updateDNAWidget = function updateDNAWidget() {
        return window.renderRadarChart();
    };

    const rerenderDna = () => setTimeout(() => {
        dna.ensureLayout();
        dna.ensureDetailModal();
        if (typeof window.renderRadarChart === 'function') window.renderRadarChart();
    }, 120);

    dna.ensureLayout();
    dna.ensureDetailModal();
    document.addEventListener('DOMContentLoaded', rerenderDna);
    ['fingenda_data_updated', 'storage', 'transactions:updated', 'transaction:added'].forEach((eventName) => {
        window.addEventListener(eventName, rerenderDna);
    });

    if (document.documentElement && !window.__fingoDnaThemeObserver) {
        window.__fingoDnaThemeObserver = new MutationObserver(() => {
            const dnaTab = document.getElementById('autopilot-tab-dna');
            if (dnaTab && !dnaTab.classList.contains('hidden')) rerenderDna();
        });
        window.__fingoDnaThemeObserver.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class']
        });
    }

    dna.uiReady = true;
})();
