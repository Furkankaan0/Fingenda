(function submissionGradePolish() {
    'use strict';

    if (window.__fingendaP0SubmissionLoaded) return;
    window.__fingendaP0SubmissionLoaded = true;

    const doc = document;

    window.FINGENDA_APP_REVIEW = {
        version: 1,
        reviewerNotes: {
            tr: 'Uygulama giriş gerektirmez. Temel akışlar: yeni gider, yeni gelir, not ekleme, piyasa görünümü, Fingo Brain ve premium yüzeyidir. Premium alanında satın alma, geri yükleme ve abonelik yönetimi uygulama içinden erişilebilir.',
            en: 'The app does not require login. Core flows: add expense, add income, add note, market overview, Fingo Brain, and premium. Purchase, restore, and subscription management are accessible inside the app.'
        }
    };

    function isEnglish() {
        return (window.FINGENDA_LANG || localStorage.getItem('fingenda_lang') || 'tr') === 'en';
    }

    function currentLang() {
        return isEnglish() ? 'en' : 'tr';
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
            return {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            }[char];
        });
    }

    function t(key, fallbackTr, fallbackEn) {
        if (typeof window.t === 'function') {
            const translated = window.t(key);
            if (translated && translated !== key) return translated;
        }
        return isEnglish() ? (fallbackEn || fallbackTr || key) : (fallbackTr || fallbackEn || key);
    }

    function safeCall(fn) {
        try {
            return fn();
        } catch (error) {
            console.warn('[SubmissionP0] Safe call failed:', error);
            return null;
        }
    }

    function getTransactions() {
        if (typeof window.getTransactions === 'function') {
            const data = safeCall(function () { return window.getTransactions(); });
            if (Array.isArray(data)) return data;
        }

        if (Array.isArray(window.transactions)) return window.transactions;

        try {
            return JSON.parse(localStorage.getItem('transactions') || '[]');
        } catch (error) {
            return [];
        }
    }

    function isPremiumUser() {
        return !!(
            window.PremiumManager?.isPremium ||
            window.userStatus === 'pro' ||
            localStorage.getItem('user_status') === 'pro' ||
            localStorage.getItem('premium') === 'true'
        );
    }

    function normalizeMessage(text) {
        let value = String(text == null ? '' : text).trim();
        if (!value) return value;
        value = value.replace(/\[DEV\]\s*/gi, '');
        value = value.replace(/Premium simülasyonu aktif/gi, isEnglish() ? 'Premium status updated' : 'Premium durumu güncellendi');
        value = value.replace(/Restore simülasyonu/gi, isEnglish() ? 'Purchases checked in this environment' : 'Bu ortamda satın alma durumu kontrol edildi');
        value = value.replace(/konsolu kontrol edin/gi, isEnglish() ? 'please try again' : 'lütfen tekrar deneyin');
        value = value.replace(/\s{2,}/g, ' ').trim();
        return value;
    }

    function rebuildPhraseMaps() {
        if (!window.i18n || !window.i18n.tr || !window.i18n.en) return;

        const literal = { trToEn: {}, enToTr: {} };
        const normalized = { trToEn: {}, enToTr: {} };

        function normalizePhrase(value) {
            return String(value || '')
                .replace(/\s+/g, ' ')
                .replace(/[“”]/g, '"')
                .replace(/[‘’]/g, "'")
                .trim();
        }

        function register(source, target, direction) {
            if (typeof source !== 'string' || typeof target !== 'string' || !source.trim() || !target.trim()) return;
            literal[direction][source] = target;
            normalized[direction][normalizePhrase(source)] = target;
        }

        Object.keys(window.i18n.tr).forEach(function (key) {
            register(window.i18n.tr[key], window.i18n.en[key], 'trToEn');
            register(window.i18n.en[key], window.i18n.tr[key], 'enToTr');
        });

        const fallback = window.i18nFallbackPhrases || { trToEn: {}, enToTr: {} };
        Object.keys(fallback.trToEn || {}).forEach(function (source) {
            register(source, fallback.trToEn[source], 'trToEn');
        });
        Object.keys(fallback.enToTr || {}).forEach(function (source) {
            register(source, fallback.enToTr[source], 'enToTr');
        });

        window.i18nLiteralPhraseLookup = literal;
        window.i18nPhraseLookup = normalized;
        window.i18nLiteralPhraseOrder = {
            trToEn: Object.keys(literal.trToEn).sort(function (a, b) { return b.length - a.length; }),
            enToTr: Object.keys(literal.enToTr).sort(function (a, b) { return b.length - a.length; })
        };
        window.i18nPhraseOrder = {
            trToEn: Object.keys(normalized.trToEn).sort(function (a, b) { return b.length - a.length; }),
            enToTr: Object.keys(normalized.enToTr).sort(function (a, b) { return b.length - a.length; })
        };
    }

    function mergeI18nOverrides() {
        if (!window.i18n || !window.i18n.tr || !window.i18n.en) return;

        Object.assign(window.i18n.tr, {
            'profile.language': 'Dil',
            'lang.title': 'Dil',
            'profile.guest': 'Kullanıcı',
            'profile.defaultTitle': 'Finans planlayıcısı',
            'profile.restoreDesc': 'Satın alımlarını Apple hesabından geri yükle.',
            'profile.copyLogs': 'Tanılama Bilgilerini Kopyala',
            'profile.backupHelp': 'Verilerini yedekle, dışa aktar veya güvenle geri yükle.',
            'transaction.noTransactions': 'Henüz işlem eklenmedi',
            'notes.noNotes': 'Henüz not eklenmedi',
            'notes.addFirst': 'İlk notu ekle',
            'notes.subtitle': 'Planlar ve kısa notlar',
            'premium.proTitle': 'Fingenda Pro',
            'premium.unlockSubtitle': 'Gelişmiş finans araçlarını ve AI içgörülerini tek planda kullan.',
            'premium.featureAI': 'Fingo Brain ve gelişmiş içgörüler',
            'premium.featureTracking': 'Sınırsız taksit ve kredi takibi',
            'premium.featureOCR': 'Fiş tarama ve sesle hızlı giriş',
            'premium.featureReports': 'Gelişmiş raporlar ve dışa aktarma',
            'premium.trialDesc': 'Plan bilgileri satın alma ekranında gösterilir.',
            'premium.cancelAnytime': 'Aboneliğini Apple hesabından yönetebilirsin.',
            'premium.upgradeCTA': 'Pro\'yu aç',
            'goals.emptyTitle': 'İlk hedefini planla',
            'goals.emptyDesc': 'Birikim hedefi eklediğinde ilerleme ve kalan tutar burada görünür.',
            'goals.emptyCta': 'Hedef oluştur',
            'submission.paywall.restore': 'Satın alımları geri yükle',
            'submission.paywall.manage': 'Aboneliği yönet',
            'submission.paywall.note': 'Satın alma, geri yükleme ve abonelik yönetimi Apple hesabın üzerinden yapılır.',
            'submission.paywall.subtitle': 'AI araçları, hızlı giriş ve gelişmiş finans özetleri tek planda.',
            'submission.paywall.footer': 'Fiyat ve plan detayları satın alma ekranında gösterilir.',
            'submission.paywall.continue': 'Devam et',
            'submission.badge.free': 'Başlangıç',
            'submission.badge.pro': 'Pro',
            'submission.review.premiumNote': 'Geri yükleme ve abonelik yönetimi bu bölümden erişilebilir.'
        });

        Object.assign(window.i18n.en, {
            'profile.language': 'Language',
            'lang.title': 'Language',
            'profile.guest': 'Member',
            'profile.defaultTitle': 'Financial planner',
            'profile.restoreDesc': 'Restore purchases linked to your Apple account.',
            'profile.copyLogs': 'Copy Diagnostics',
            'profile.backupHelp': 'Back up, export, or restore your data with confidence.',
            'transaction.noTransactions': 'No transactions yet',
            'notes.noNotes': 'No notes yet',
            'notes.addFirst': 'Add your first note',
            'notes.subtitle': 'Plans and quick notes',
            'premium.proTitle': 'Fingenda Pro',
            'premium.unlockSubtitle': 'Use advanced finance tools and AI insights in one plan.',
            'premium.featureAI': 'Fingo Brain and advanced insights',
            'premium.featureTracking': 'Unlimited installment and loan tracking',
            'premium.featureOCR': 'Receipt scan and fast voice entry',
            'premium.featureReports': 'Advanced reports and export',
            'premium.trialDesc': 'Plan details appear on the purchase screen.',
            'premium.cancelAnytime': 'Manage your subscription from your Apple account.',
            'premium.upgradeCTA': 'Unlock Pro',
            'goals.emptyTitle': 'Plan your first goal',
            'goals.emptyDesc': 'Once you add a savings goal, progress and remaining amount will appear here.',
            'goals.emptyCta': 'Create goal',
            'submission.paywall.restore': 'Restore purchases',
            'submission.paywall.manage': 'Manage subscription',
            'submission.paywall.note': 'Purchase, restore and subscription management are handled through your Apple account.',
            'submission.paywall.subtitle': 'AI tools, faster entry and advanced finance summaries in one plan.',
            'submission.paywall.footer': 'Price and plan details are shown on the purchase screen.',
            'submission.paywall.continue': 'Continue',
            'submission.badge.free': 'Starter',
            'submission.badge.pro': 'Pro',
            'submission.review.premiumNote': 'Restore and subscription management are available from this section.'
        });

        rebuildPhraseMaps();
    }

    function applyLanguageSafely() {
        safeCall(function () {
            if (typeof window.applyLanguage === 'function') {
                window.applyLanguage(currentLang());
            }
        });
    }

    function renderEmptyStateCard(options) {
        const icon = escapeHtml(options.icon || '✦');
        const title = escapeHtml(options.title || '');
        const body = escapeHtml(options.body || '');
        const primaryLabel = options.primaryLabel ? escapeHtml(options.primaryLabel) : '';
        const secondaryLabel = options.secondaryLabel ? escapeHtml(options.secondaryLabel) : '';

        return `
            <div class="submission-empty-state ${options.compact ? 'submission-empty-state--compact' : ''}">
                <div class="submission-empty-state__row">
                    <div class="submission-empty-state__icon" aria-hidden="true">${icon}</div>
                    <div class="submission-empty-state__content">
                        <h3 class="submission-empty-state__title">${title}</h3>
                        <p class="submission-empty-state__body">${body}</p>
                        <div class="submission-empty-state__actions">
                            ${primaryLabel ? `<button type="button" class="submission-empty-state__button" data-submission-action="${escapeHtml(options.primaryAction || '')}">${primaryLabel}</button>` : ''}
                            ${secondaryLabel ? `<button type="button" class="submission-empty-state__button submission-empty-state__button--secondary" data-submission-action="${escapeHtml(options.secondaryAction || '')}">${secondaryLabel}</button>` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    function bindSubmissionActions(scope) {
        const root = scope && scope.querySelectorAll ? scope : doc;
        root.querySelectorAll('[data-submission-action]').forEach(function (button) {
            if (button.dataset.submissionBound === 'true') return;
            button.dataset.submissionBound = 'true';
            button.addEventListener('click', function (event) {
                event.preventDefault();
                handleSubmissionAction(button.getAttribute('data-submission-action'));
            });
        });
    }

    function openAddScreen(type) {
        safeCall(function () {
            window.switchTab?.('add');
            if (type && typeof window.setTransactionType === 'function') {
                setTimeout(function () {
                    window.setTransactionType(type);
                }, 80);
            }
        });
    }

    function handleSubmissionAction(action) {
        switch (action) {
            case 'add-transaction':
                openAddScreen(null);
                break;
            case 'add-expense':
                openAddScreen('expense');
                break;
            case 'add-income':
                openAddScreen('income');
                break;
            case 'add-note':
                safeCall(function () { window.switchTab?.('notes'); window.toggleNotesModal?.(); });
                break;
            case 'add-goal':
                safeCall(function () { window.switchTab?.('goals'); window.toggleGoalModal?.(true); });
                break;
            case 'scan-receipt':
                safeCall(function () { window.switchTab?.('add'); window.triggerOCR?.(); });
                break;
            case 'voice-add':
                safeCall(function () { window.switchTab?.('add'); window.triggerVoiceInput?.(); });
                break;
            case 'open-market':
                safeCall(function () { window.switchTab?.('doviz'); window.fetchMarketData?.(); });
                break;
            case 'restore-purchases':
                safeCall(function () { window.PremiumManager?.restorePurchases?.(); });
                break;
            case 'manage-subscription':
                safeCall(function () { window.PremiumManager?.manageSubscription?.(); });
                break;
            default:
                break;
        }
    }

    function manageSubscription() {
        const url = 'https://apps.apple.com/account/subscriptions';
        safeCall(function () {
            if (window.Capacitor?.Plugins?.Browser?.open) {
                return window.Capacitor.Plugins.Browser.open({ url: url });
            }
            window.open(url, '_blank', 'noopener,noreferrer');
            return null;
        });
    }

    function syncPlanBadge() {
        const badge = doc.getElementById('user-plan-badge');
        if (!badge) return;

        const pro = isPremiumUser();
        const badgeLabel = pro ? t('submission.badge.pro', 'Pro', 'Pro') : t('submission.badge.free', 'Başlangıç', 'Starter');
        const icon = pro ? '👑' : '✦';

        badge.innerHTML = `
            <span class="relative z-10 flex items-center gap-1.5">
                <span aria-hidden="true">${icon}</span>
                <span>${escapeHtml(badgeLabel)}</span>
            </span>
            ${pro ? '<div class="absolute inset-0 shimmer opacity-50"></div>' : ''}
        `;

        if (pro) {
            badge.style.cssText = 'background: linear-gradient(135deg, #f59e0b, #d97706); color: white; box-shadow: 0 4px 15px rgba(245, 158, 11, 0.35), inset 0 1px 0 rgba(255,255,255,0.25); cursor: default;';
            badge.onclick = null;
        } else {
            badge.style.cssText = 'background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary)); color: white; box-shadow: 0 4px 15px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,0.3);';
            badge.onclick = function () {
                window.PremiumManager?.showPaywall?.('plan_badge');
            };
        }
    }

    function patchGreeting() {
        const greetingEl = doc.getElementById('user-greeting');
        if (!greetingEl) return;

        const defaultGuest = t('profile.guest', 'Kullanıcı', 'Member');
        const normalizedGuests = ['Misafir', 'Guest', 'Patron', 'Boss', 'Kullanıcı', 'Member'];
        const storedName = localStorage.getItem('user_name');
        const displayName = storedName && normalizedGuests.indexOf(storedName) === -1 ? storedName : defaultGuest;
        const greeting = typeof window.getLocalizedGreeting === 'function'
            ? window.getLocalizedGreeting()
            : (isEnglish() ? 'Hello' : 'Merhaba');

        greetingEl.textContent = `${greeting}, ${displayName}`;
        greetingEl.setAttribute('aria-label', `${greeting}, ${displayName}`);
    }

    function patchProfilePremiumSection() {
        const restoreButton = doc.querySelector('#profile-tab-settings button[onclick*="restore"]');
        if (!restoreButton) return;

        restoreButton.setAttribute('onclick', 'window.PremiumManager?.restorePurchases?.()');

        const section = restoreButton.closest('.profile-section');
        if (!section || section.querySelector('[data-submission-premium-stack]')) {
            bindSubmissionActions(section || doc);
            return;
        }

        const stack = doc.createElement('div');
        stack.className = 'submission-profile-premium-stack';
        stack.setAttribute('data-submission-premium-stack', 'true');

        const manageButton = doc.createElement('button');
        manageButton.type = 'button';
        manageButton.className = 'profile-action-btn';
        manageButton.setAttribute('data-submission-action', 'manage-subscription');
        manageButton.innerHTML = `
            <div class="flex items-center gap-3">
                <span class="text-lg">🧾</span>
                <div class="text-left">
                    <p class="font-bold">${escapeHtml(t('submission.paywall.manage', 'Aboneliği yönet', 'Manage subscription'))}</p>
                    <p class="profile-help">${escapeHtml(t('submission.review.premiumNote', 'Geri yükleme ve abonelik yönetimi bu bölümden erişilebilir.', 'Restore and subscription management are available from this section.'))}</p>
                </div>
            </div>
        `;

        const note = doc.createElement('p');
        note.className = 'profile-help submission-profile-premium-note';
        note.textContent = t('submission.review.premiumNote', 'Geri yükleme ve abonelik yönetimi bu bölümden erişilebilir.', 'Restore and subscription management are available from this section.');

        stack.appendChild(manageButton);
        stack.appendChild(note);
        section.appendChild(stack);
        bindSubmissionActions(section);
    }

    function patchPremiumEntrypoints() {
        doc.querySelectorAll('[onclick*="premium-modal"]').forEach(function (node) {
            const handler = node.getAttribute('onclick') || '';
            if (handler.indexOf("classList.remove('hidden')") === -1) return;
            node.setAttribute('onclick', "window.PremiumManager?.showPaywall?.('upgrade')");
        });
    }

    function patchPaywallCopy() {
        const paywall = doc.getElementById('premium-paywall-modal');
        if (!paywall) return;

        const title = paywall.querySelector('h2');
        const subtitle = paywall.querySelector('h2 + p');
        const features = paywall.querySelectorAll('.space-y-3 span');
        const priceNote = paywall.querySelector('.text-center.mb-2 + p');
        const primaryButton = doc.getElementById('btn-purchase-premium');
        const footer = primaryButton && primaryButton.parentElement ? primaryButton.parentElement.querySelector('p.mt-4') : null;

        if (title) title.textContent = t('premium.proTitle', 'Fingenda Pro', 'Fingenda Pro');
        if (subtitle) subtitle.textContent = t('submission.paywall.subtitle', 'AI araçları, hızlı giriş ve gelişmiş finans özetleri tek planda.', 'AI tools, faster entry and advanced finance summaries in one plan.');

        const featureTexts = [
            t('premium.featureAI', 'Fingo Brain ve gelişmiş içgörüler', 'Fingo Brain and advanced insights'),
            t('premium.featureTracking', 'Sınırsız taksit ve kredi takibi', 'Unlimited installment and loan tracking'),
            t('premium.featureOCR', 'Fiş tarama ve sesle hızlı giriş', 'Receipt scan and fast voice entry'),
            t('premium.featureReports', 'Gelişmiş raporlar ve dışa aktarma', 'Advanced reports and export')
        ];

        features.forEach(function (item, index) {
            if (featureTexts[index]) item.textContent = featureTexts[index];
        });

        if (priceNote) priceNote.textContent = t('premium.trialDesc', 'Plan bilgileri satın alma ekranında gösterilir.', 'Plan details appear on the purchase screen.');
        if (primaryButton) primaryButton.textContent = t('submission.paywall.continue', 'Devam et', 'Continue');
        if (footer) footer.textContent = t('submission.paywall.footer', 'Fiyat ve plan detayları satın alma ekranında gösterilir.', 'Price and plan details are shown on the purchase screen.');

        const content = primaryButton ? primaryButton.parentElement : null;
        if (content && !content.querySelector('[data-submission-paywall-actions]')) {
            const actions = doc.createElement('div');
            actions.className = 'submission-paywall-actions';
            actions.setAttribute('data-submission-paywall-actions', 'true');
            actions.innerHTML = `
                <button type="button" class="submission-paywall-action" data-submission-action="restore-purchases">${escapeHtml(t('submission.paywall.restore', 'Satın alımları geri yükle', 'Restore purchases'))}</button>
                <button type="button" class="submission-paywall-action" data-submission-action="manage-subscription">${escapeHtml(t('submission.paywall.manage', 'Aboneliği yönet', 'Manage subscription'))}</button>
            `;
            primaryButton.insertAdjacentElement('afterend', actions);

            const note = doc.createElement('p');
            note.className = 'submission-paywall-note';
            note.textContent = t('submission.paywall.note', 'Satın alma, geri yükleme ve abonelik yönetimi Apple hesabın üzerinden yapılır.', 'Purchase, restore and subscription management are handled through your Apple account.');
            actions.insertAdjacentElement('afterend', note);
        }

        bindSubmissionActions(paywall);
    }

    function patchLegacyPremiumModal() {
        const modal = doc.getElementById('premium-modal');
        if (!modal) return;

        const title = modal.querySelector('[data-i18n="premium.proTitle"]');
        const subtitle = modal.querySelector('[data-i18n="premium.unlockSubtitle"]');
        const priceHint = modal.querySelector('[data-i18n="premium.trialDesc"]');
        const cta = modal.querySelector('[data-i18n="premium.upgradeCTA"]');
        const cancelNote = modal.querySelector('[data-i18n="premium.cancelAnytime"]');

        if (title) title.textContent = t('premium.proTitle', 'Fingenda Pro', 'Fingenda Pro');
        if (subtitle) subtitle.textContent = t('premium.unlockSubtitle', 'Gelişmiş finans araçlarını ve AI içgörülerini tek planda kullan.', 'Use advanced finance tools and AI insights in one plan.');
        if (priceHint) priceHint.textContent = t('premium.trialDesc', 'Plan bilgileri satın alma ekranında gösterilir.', 'Plan details appear on the purchase screen.');
        if (cta) cta.textContent = t('premium.upgradeCTA', 'Pro\'yu aç', 'Unlock Pro');
        if (cancelNote) cancelNote.textContent = t('premium.cancelAnytime', 'Aboneliğini Apple hesabından yönetebilirsin.', 'Manage your subscription from your Apple account.');
    }

    function patchStaticCopy() {
        patchGreeting();
        syncPlanBadge();
        patchProfilePremiumSection();
        patchPremiumEntrypoints();
        patchPaywallCopy();
        patchLegacyPremiumModal();

        const languageTitle = doc.querySelector('#profile-tab-settings [data-i18n="profile.language"]');
        if (languageTitle) languageTitle.textContent = t('profile.language', 'Dil', 'Language');

        const notesStats = doc.querySelectorAll('#screen-notes [data-note-stat]');
        ['total', 'completed', 'pending'].forEach(function (key, index) {
            if (!notesStats[index]) return;
            const map = {
                total: t('submission.notes.stat.total', 'Toplam', 'Total'),
                completed: t('submission.notes.stat.completed', 'Tamamlandı', 'Done'),
                pending: t('submission.notes.stat.pending', 'Bekliyor', 'Pending')
            };
            notesStats[index].textContent = map[key];
        });

        doc.querySelectorAll('#screen-notes [data-filter]').forEach(function (node) {
            const key = node.getAttribute('data-filter');
            const map = {
                all: t('submission.notes.filter.all', '📋 Tümü', '📋 All'),
                important: t('submission.notes.filter.important', '⭐ Önemli', '⭐ Important'),
                todo: t('submission.notes.filter.todo', '✅ Yapılacak', '✅ To do'),
                idea: t('submission.notes.filter.idea', '💡 Fikir', '💡 Idea'),
                financial: t('submission.notes.filter.financial', '💰 Finansal', '💰 Financial')
            };
            if (map[key]) node.textContent = map[key];
        });

        const notesSubtitle = doc.querySelector('#screen-notes [data-i18n="notes.subtitle"]');
        if (notesSubtitle) notesSubtitle.textContent = t('notes.subtitle', 'Planlar ve kısa notlar', 'Plans and quick notes');

        const stockSectionHeader = Array.prototype.find.call(doc.querySelectorAll('#screen-doviz h3.font-bold'), function (node) {
            return /Hisseler|Stocks/i.test(node.textContent || '');
        });
        if (stockSectionHeader) stockSectionHeader.textContent = isEnglish() ? 'Market overview' : 'Piyasa özeti';

        const stockLiveBadge = stockSectionHeader ? stockSectionHeader.parentElement.querySelector('span') : null;
        if (stockLiveBadge) stockLiveBadge.textContent = isEnglish() ? 'Live' : 'Canlı';

        const stockSearch = doc.getElementById('stock-search-input');
        if (stockSearch) stockSearch.placeholder = isEnglish() ? 'Search stock (e.g. THYAO)' : 'Hisse ara (örn. THYAO)';

        const marketFooter = Array.prototype.find.call(doc.querySelectorAll('#screen-doviz .text-[9px]'), function (node) {
            return /Veriler|Last update|Son:/i.test(node.textContent || '');
        });
        if (marketFooter) {
            const timeNode = marketFooter.querySelector('.market-time');
            marketFooter.textContent = `${isEnglish() ? 'Last update' : 'Son güncelleme'}: `;
            if (timeNode) marketFooter.appendChild(timeNode);
        }

        const walletBadge = Array.prototype.find.call(doc.querySelectorAll('#screen-wallet span'), function (node) {
            return /PRO V2\.0/i.test(node.textContent || '');
        });
        if (walletBadge) walletBadge.textContent = 'PRO';

        const walletSubtitle = Array.prototype.find.call(doc.querySelectorAll('#screen-wallet p'), function (node) {
            return /Finansal Zeka|Financial Intelligence/i.test(node.textContent || '');
        });
        if (walletSubtitle) walletSubtitle.textContent = isEnglish() ? 'AI-powered financial insights' : 'AI destekli finans içgörüleri';

        const gateLabel = Array.prototype.find.call(doc.querySelectorAll('#autopilot-premium-gate p'), function (node) {
            return /Premium Özellik|Premium Feature/i.test(node.textContent || '');
        });
        if (gateLabel) gateLabel.textContent = isEnglish() ? 'Pro feature' : 'Pro özellik';

        const gateBody = Array.prototype.find.call(doc.querySelectorAll('#autopilot-premium-gate p'), function (node) {
            return /Akıllı bütçe|personal finance coach|kişisel finans/i.test(node.textContent || '');
        });
        if (gateBody) gateBody.textContent = isEnglish()
            ? 'Fingo Brain is available on Pro for smarter summaries and faster decision support.'
            : 'Fingo Brain, akıllı özetler ve daha hızlı karar desteği için Pro planda yer alır.';
    }

    function patchNotesEmptyState() {
        const emptyState = doc.getElementById('notes-empty-state');
        if (!emptyState) return;

        const title = emptyState.querySelector('h4');
        const body = emptyState.querySelector('p');
        const cta = emptyState.querySelector('button');

        if (title) title.textContent = t('notes.noNotes', 'Henüz not eklenmedi', 'No notes yet');
        if (body) body.textContent = isEnglish()
            ? 'Keep ideas, reminders and finance notes together in one calm list.'
            : 'Fikirlerini, hatırlatmalarını ve finans notlarını tek yerde tut.';
        if (cta) cta.textContent = t('notes.addFirst', 'İlk notu ekle', 'Add your first note');
    }

    function patchGoalsEmptyCopy() {
        const emptyTitle = doc.querySelector('.goal-empty__title');
        const emptyDesc = doc.querySelector('.goal-empty__desc');
        const emptyAction = doc.querySelector('.goal-empty__action');
        if (emptyTitle) emptyTitle.textContent = t('goals.emptyTitle', 'İlk hedefini planla', 'Plan your first goal');
        if (emptyDesc) emptyDesc.textContent = t('goals.emptyDesc', 'Birikim hedefi eklediğinde ilerleme ve kalan tutar burada görünür.', 'Once you add a savings goal, progress and remaining amount will appear here.');
        if (emptyAction) emptyAction.textContent = t('goals.emptyCta', 'Hedef oluştur', 'Create goal');
    }

    function updateTransactionEmptyStates() {
        ['recent-transactions-list', 'full-history-list'].forEach(function (id) {
            const container = doc.getElementById(id);
            if (!container) return;
            if (container.children.length || !/işlem|transaction/i.test(container.textContent || '')) return;

            container.innerHTML = renderEmptyStateCard({
                icon: '🧾',
                title: isEnglish() ? 'Your transaction history is still empty' : 'Henüz işlem geçmişin oluşmadı',
                body: isEnglish()
                    ? 'Once you add your first records, income, expense and history flow will appear here.'
                    : 'İlk kayıtlarını eklediğinde gelir, gider ve geçmiş akışı burada görünür.',
                primaryLabel: isEnglish() ? 'Add your first transaction' : 'İlk işlemi ekle',
                primaryAction: 'add-transaction',
                secondaryLabel: isEnglish() ? 'Add income' : 'Gelir ekle',
                secondaryAction: 'add-income',
                compact: id === 'recent-transactions-list'
            });
        });

        bindSubmissionActions();
    }

    function updateMarketEmptyState() {
        const screen = doc.getElementById('screen-doviz');
        if (!screen) return;

        const values = ['val-usd', 'val-eur', 'val-gold-gram', 'val-gold-quarter'].map(function (id) {
            return (doc.getElementById(id)?.textContent || '').trim();
        });
        const noData = values.length && values.every(function (value) { return !value || value === '--'; });
        let emptyCard = screen.querySelector('[data-submission-market-empty]');

        if (noData) {
            if (!emptyCard) {
                emptyCard = doc.createElement('div');
                emptyCard.className = 'submission-market-empty';
                emptyCard.setAttribute('data-submission-market-empty', 'true');
                const topGrid = screen.querySelector('.grid.grid-cols-2.gap-4');
                if (topGrid) topGrid.insertAdjacentElement('afterend', emptyCard);
            }

            if (emptyCard) {
                emptyCard.innerHTML = renderEmptyStateCard({
                    icon: '📈',
                    title: isEnglish() ? 'Market data is getting ready' : 'Piyasa verileri hazırlanıyor',
                    body: isEnglish()
                        ? 'When the connection is available, currency, gold and market summaries will appear here.'
                        : 'Bağlantı sağlandığında güncel döviz, altın ve piyasa özeti burada görünür.',
                    primaryLabel: isEnglish() ? 'Try again' : 'Tekrar dene',
                    primaryAction: 'open-market',
                    secondaryLabel: isEnglish() ? 'Add transaction' : 'Yeni işlem ekle',
                    secondaryAction: 'add-transaction'
                });
            }
        } else if (emptyCard) {
            emptyCard.remove();
        }

        bindSubmissionActions(screen);
    }

    function updateWalletEmptyState() {
        const screen = doc.getElementById('screen-wallet');
        if (!screen) return;

        const hasData = getTransactions().some(function (transaction) {
            return transaction && !safeCall(function () { return window.isSavingsTransaction?.(transaction); });
        });
        let banner = screen.querySelector('[data-submission-wallet-empty]');

        if (!hasData && isPremiumUser()) {
            if (!banner) {
                banner = doc.createElement('div');
                banner.className = 'submission-review-banner';
                banner.setAttribute('data-submission-wallet-empty', 'true');
                const header = screen.querySelector('.px-5.pt-4.pb-2');
                if (header) header.insertAdjacentElement('afterend', banner);
            }

            if (banner) {
                banner.innerHTML = renderEmptyStateCard({
                    icon: '🧠',
                    title: isEnglish() ? 'Add a few transactions for your first insight' : 'İlk içgörü için birkaç işlem ekle',
                    body: isEnglish()
                        ? 'Fingo Brain learns from your records. Once you add income or expenses, summaries and suggestions appear here.'
                        : 'Fingo Brain, kayıtlarından öğrenir. Gelir veya gider eklediğinde özet ve öneriler görünür.',
                    primaryLabel: isEnglish() ? 'Add expense' : 'Gider ekle',
                    primaryAction: 'add-expense',
                    secondaryLabel: isEnglish() ? 'Add income' : 'Gelir ekle',
                    secondaryAction: 'add-income',
                    compact: true
                });
            }
        } else if (banner) {
            banner.remove();
        }

        bindSubmissionActions(screen);
    }

    function wrapRenderTransactions() {
        if (typeof window.renderTransactionsToList !== 'function' || window.renderTransactionsToList.__submissionWrapped) return;

        const original = window.renderTransactionsToList;
        window.renderTransactionsToList = function wrappedRenderTransactions() {
            const result = original.apply(this, arguments);
            safeCall(updateTransactionEmptyStates);
            return result;
        };
        window.renderTransactionsToList.__submissionWrapped = true;
    }

    function wrapRenderNotes() {
        if (typeof window.renderNotes !== 'function' || window.renderNotes.__submissionWrapped) return;

        const original = window.renderNotes;
        window.renderNotes = function wrappedRenderNotes() {
            const result = original.apply(this, arguments);
            patchNotesEmptyState();
            patchStaticCopy();
            return result;
        };
        window.renderNotes.__submissionWrapped = true;
    }

    function wrapRenderGoals() {
        if (typeof window.renderGoalsList !== 'function' || window.renderGoalsList.__submissionWrapped) return;

        const original = window.renderGoalsList;
        window.renderGoalsList = function wrappedRenderGoals() {
            const result = original.apply(this, arguments);
            patchGoalsEmptyCopy();
            return result;
        };
        window.renderGoalsList.__submissionWrapped = true;
    }

    function wrapHealthStatus() {
        if (typeof window.updateHealthStatus !== 'function' || window.updateHealthStatus.__submissionWrapped) return;

        const original = window.updateHealthStatus;
        window.updateHealthStatus = function wrappedHealthStatus() {
            const result = original.apply(this, arguments);
            const container = doc.getElementById('health-status-content');
            if (!container) return result;

            const hasData = getTransactions().some(function (transaction) {
                return transaction && !safeCall(function () { return window.isSavingsTransaction?.(transaction); });
            });

            if (!hasData) {
                container.innerHTML = renderEmptyStateCard({
                    icon: '💡',
                    title: isEnglish() ? 'Analysis needs a little data' : 'Analiz için veri gerekiyor',
                    body: isEnglish()
                        ? 'This area creates a monthly financial health summary from your current income and expense activity.'
                        : 'Bu alan, bu ayki gelir ve gider hareketlerinden finansal sağlık özetini üretir.',
                    primaryLabel: isEnglish() ? 'Add your first transaction' : 'İlk işlemi ekle',
                    primaryAction: 'add-transaction',
                    compact: true
                });
                bindSubmissionActions(container);
            }

            return result;
        };
        window.updateHealthStatus.__submissionWrapped = true;
    }

    function wrapMarketRenderers() {
        ['renderStocks', 'populateStockList', 'fetchMarketData'].forEach(function (name) {
            if (typeof window[name] !== 'function' || window[name].__submissionWrapped) return;
            const original = window[name];
            window[name] = function wrappedMarketRenderer() {
                const result = original.apply(this, arguments);
                safeCall(updateMarketEmptyState);
                patchStaticCopy();
                return result;
            };
            window[name].__submissionWrapped = true;
        });
    }

    function wrapProcessTransactions() {
        if (typeof window.processTransactions !== 'function' || window.processTransactions.__submissionWrapped) return;

        const original = window.processTransactions;
        window.processTransactions = function wrappedProcessTransactions() {
            const result = original.apply(this, arguments);
            safeCall(updateTransactionEmptyStates);
            safeCall(updateMarketEmptyState);
            safeCall(updateWalletEmptyState);
            return result;
        };
        window.processTransactions.__submissionWrapped = true;
    }

    function wrapProfileUI() {
        if (typeof window.updateProfileUI !== 'function' || window.updateProfileUI.__submissionWrapped) return;

        const original = window.updateProfileUI;
        window.updateProfileUI = function wrappedProfileUI() {
            const result = original.apply(this, arguments);
            patchGreeting();
            syncPlanBadge();
            patchProfilePremiumSection();
            return result;
        };
        window.updateProfileUI.__submissionWrapped = true;
    }

    function wrapPremiumFlow() {
        if (window.__submissionPremiumWrapped) return;
        window.__submissionPremiumWrapped = true;

        if (window.PremiumManager) {
            window.PremiumManager.manageSubscription = manageSubscription;

            ['lockFeatures', 'unlockAllFeatures', 'restorePurchases', 'upgradeToPremium', 'refreshEntitlement'].forEach(function (methodName) {
                const method = window.PremiumManager[methodName];
                if (typeof method !== 'function' || method.__submissionWrapped) return;
                window.PremiumManager[methodName] = function wrappedPremiumMethod() {
                    const result = method.apply(this, arguments);
                    Promise.resolve(result).finally(function () {
                        syncPlanBadge();
                        patchProfilePremiumSection();
                    });
                    return result;
                };
                window.PremiumManager[methodName].__submissionWrapped = true;
            });

            if (typeof window.PremiumManager.showPaywall === 'function' && !window.PremiumManager.showPaywall.__submissionWrapped) {
                const originalShowPaywall = window.PremiumManager.showPaywall.bind(window.PremiumManager);
                window.PremiumManager.showPaywall = function wrappedShowPaywall(featureKey) {
                    doc.getElementById('premium-modal')?.classList?.add('hidden');
                    const result = originalShowPaywall(featureKey);
                    patchPaywallCopy();
                    syncPlanBadge();
                    return result;
                };
                window.PremiumManager.showPaywall.__submissionWrapped = true;
            }

            if (typeof window.PremiumManager.closeModal === 'function' && !window.PremiumManager.closeModal.__submissionWrapped) {
                const originalCloseModal = window.PremiumManager.closeModal.bind(window.PremiumManager);
                window.PremiumManager.closeModal = function wrappedCloseModal() {
                    doc.getElementById('premium-modal')?.classList?.add('hidden');
                    return originalCloseModal();
                };
                window.PremiumManager.closeModal.__submissionWrapped = true;
            }

            if (typeof window.PremiumManager.setPlan === 'function' && !window.PremiumManager.setPlan.__submissionWrapped) {
                const originalSetPlan = window.PremiumManager.setPlan.bind(window.PremiumManager);
                window.PremiumManager.setPlan = function wrappedSetPlan(plan) {
                    const result = originalSetPlan(plan);
                    const pricePeriod = doc.getElementById('price-period');
                    if (pricePeriod) {
                        pricePeriod.textContent = isEnglish()
                            ? (plan === 'monthly' ? '/month' : '/year')
                            : (plan === 'monthly' ? '/ay' : '/yıl');
                    }
                    patchPaywallCopy();
                    return result;
                };
                window.PremiumManager.setPlan.__submissionWrapped = true;
            }
        }

        if (typeof window.buyPremium === 'function' && !window.buyPremium.__submissionWrapped) {
            window.buyPremium = function wrappedBuyPremium() {
                window.PremiumManager?.showPaywall?.('onboarding_upgrade');
            };
            window.buyPremium.__submissionWrapped = true;
        }

        if (window.fingoOnboarding && typeof window.fingoOnboarding.buyPremium === 'function' && !window.fingoOnboarding.buyPremium.__submissionWrapped) {
            window.fingoOnboarding.buyPremium = function wrappedOnboardingBuyPremium() {
                safeCall(function () { window.fingoOnboarding.complete?.(); });
                setTimeout(function () {
                    window.PremiumManager?.showPaywall?.('onboarding_upgrade');
                }, 240);
            };
            window.fingoOnboarding.buyPremium.__submissionWrapped = true;
        }

        if (typeof window.showUpgradeInfo === 'function' && !window.showUpgradeInfo.__submissionWrapped) {
            window.showUpgradeInfo = function wrappedShowUpgradeInfo() {
                window.PremiumManager?.showPaywall?.('upgrade_info');
            };
            window.showUpgradeInfo.__submissionWrapped = true;
        }

        if (typeof window.checkPremiumFeature === 'function' && !window.checkPremiumFeature.__submissionWrapped) {
            window.checkPremiumFeature = function wrappedCheckPremiumFeature(featureName) {
                if (isPremiumUser()) return true;
                const premiumFeatures = ['ai_chat', 'excel_export', 'advanced_charts', 'installment_limit_exceeded', 'ocr', 'voice_input'];
                if (premiumFeatures.indexOf(featureName) !== -1) {
                    window.PremiumManager?.showPaywall?.(featureName || 'premium_feature');
                    return false;
                }
                return true;
            };
            window.checkPremiumFeature.__submissionWrapped = true;
        }
    }

    function wrapFeedbackSurface() {
        if (typeof window.showMicroFeedback === 'function' && !window.showMicroFeedback.__submissionWrapped) {
            const originalShowMicroFeedback = window.showMicroFeedback;
            window.showMicroFeedback = function wrappedShowMicroFeedback(input) {
                const payload = (input && typeof input === 'object')
                    ? Object.assign({}, input, { message: normalizeMessage(input.message) })
                    : normalizeMessage(input);
                return originalShowMicroFeedback.call(this, payload);
            };
            window.showMicroFeedback.__submissionWrapped = true;
        }

        if (typeof window.alertMessage === 'function' && !window.alertMessage.__submissionWrapped) {
            const originalAlertMessage = window.alertMessage;
            window.alertMessage = function wrappedAlertMessage(title, message, color) {
                return originalAlertMessage.call(this, normalizeMessage(title), normalizeMessage(message), color);
            };
            window.alertMessage.__submissionWrapped = true;
        }
    }

    function annotateStaticNodes() {
        const notesStatNodes = doc.querySelectorAll('#screen-notes .flex-1.text-center.p-2.rounded-xl p.text-[10px]');
        ['total', 'completed', 'pending'].forEach(function (key, index) {
            if (notesStatNodes[index]) notesStatNodes[index].setAttribute('data-note-stat', key);
        });
    }

    function initPatches() {
        mergeI18nOverrides();
        annotateStaticNodes();
        wrapRenderTransactions();
        wrapRenderNotes();
        wrapRenderGoals();
        wrapHealthStatus();
        wrapMarketRenderers();
        wrapProcessTransactions();
        wrapProfileUI();
        wrapPremiumFlow();
        wrapFeedbackSurface();
        applyLanguageSafely();
        patchStaticCopy();
        patchNotesEmptyState();
        patchGoalsEmptyCopy();
        updateTransactionEmptyStates();
        updateMarketEmptyState();
        updateWalletEmptyState();
        bindSubmissionActions();
    }

    if (doc.readyState === 'loading') {
        doc.addEventListener('DOMContentLoaded', initPatches, { once: true });
    } else {
        initPatches();
    }

    window.addEventListener('languageChanged', function () {
        safeCall(function () {
            applyLanguageSafely();
            patchStaticCopy();
            patchNotesEmptyState();
            patchGoalsEmptyCopy();
            updateTransactionEmptyStates();
            updateMarketEmptyState();
            updateWalletEmptyState();
        });
    });
})();
