(function initFingendaP2Ecosystem() {
    'use strict';

    const app = window.FingendaApp = window.FingendaApp || {};
    const system = window.FingendaSystemActions = window.FingendaSystemActions || {};
    const root = document.documentElement;
    const runtime = {
        pendingActions: [],
        lastAnnouncementKey: '',
        lastAnnouncementAt: 0,
        lastHapticKey: '',
        lastHapticAt: 0,
        a11yRefreshHandle: 0,
        deepLinkBound: false,
        observer: null
    };

    function sanitizeText(value) {
        return String(value ?? '').replace(/\s+/g, ' ').trim();
    }

    function isVisible(element) {
        if (!element) return false;
        const styles = window.getComputedStyle(element);
        return !element.classList.contains('hidden') && styles.display !== 'none' && styles.visibility !== 'hidden';
    }

    function currentYear() {
        return window.APP_YEAR || new Date().getFullYear();
    }

    function readJSON(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (error) {
            return fallback;
        }
    }

    function getTransactions() {
        const scoped = readJSON(`my_expenses_${currentYear()}`, null);
        if (Array.isArray(scoped)) return scoped;
        const legacy = readJSON('transactions', []);
        return Array.isArray(legacy) ? legacy : [];
    }

    function getGoals() {
        const scoped = readJSON(`my_goals_${currentYear()}`, []);
        return Array.isArray(scoped) ? scoped : [];
    }

    function getNotes() {
        const notes = readJSON('fingo_notes', []);
        return Array.isArray(notes) ? notes : [];
    }

    function parseAmount(value) {
        if (app.utils && typeof app.utils.parseAmount === 'function') {
            return app.utils.parseAmount(value);
        }

        const parsed = Number(String(value ?? '').replace(/[^\d,.-]/g, '').replace(',', '.'));
        return Number.isFinite(parsed) ? parsed : 0;
    }

    function formatCurrency(value) {
        return new Intl.NumberFormat('tr-TR', {
            style: 'currency',
            currency: 'TRY',
            maximumFractionDigits: 0
        }).format(Number.isFinite(value) ? value : 0);
    }

    function normalizeDate(value) {
        if (!value) return '';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
        return date.toISOString().slice(0, 10);
    }

    function ensureLiveRegion(id, politeness) {
        let region = document.getElementById(id);
        if (!region) {
            region = document.createElement('div');
            region.id = id;
            region.setAttribute('role', politeness === 'assertive' ? 'alert' : 'status');
            region.setAttribute('aria-live', politeness);
            region.setAttribute('aria-atomic', 'true');
            region.style.cssText = 'position:absolute;left:-9999px;top:auto;width:1px;height:1px;overflow:hidden;';
            document.body.appendChild(region);
        }
        return region;
    }

    function announce(message, priority = 'polite') {
        const cleaned = sanitizeText(message);
        if (!cleaned) return;

        const announcementKey = `${priority}:${cleaned}`;
        const now = Date.now();
        if (runtime.lastAnnouncementKey === announcementKey && now - runtime.lastAnnouncementAt < 600) {
            return;
        }

        runtime.lastAnnouncementKey = announcementKey;
        runtime.lastAnnouncementAt = now;

        const region = ensureLiveRegion(
            priority === 'assertive' ? 'fingenda-a11y-assertive' : 'fingenda-a11y-polite',
            priority
        );
        region.textContent = '';
        window.setTimeout(() => {
            region.textContent = cleaned;
        }, 40);
    }

    function classifyFeedbackTone(rawTone) {
        const tone = sanitizeText(rawTone).toLowerCase();
        if (tone === 'success' || tone === 'green') return { haptic: 'success', priority: 'polite' };
        if (tone === 'error' || tone === 'red') return { haptic: 'error', priority: 'assertive' };
        if (tone === 'warning' || tone === 'yellow' || tone === 'orange') return { haptic: 'warning', priority: 'assertive' };
        return { haptic: 'light', priority: 'polite' };
    }

    function emitHaptic(kind) {
        const tone = sanitizeText(kind).toLowerCase();
        if (!tone) return;

        const now = Date.now();
        const threshold = tone === 'selection' || tone === 'light' ? 110 : 180;
        if (runtime.lastHapticKey === tone && now - runtime.lastHapticAt < threshold) return;

        runtime.lastHapticKey = tone;
        runtime.lastHapticAt = now;

        const modern = window.FingoHaptics;
        if (modern && typeof modern[tone] === 'function') {
            modern[tone]();
            return;
        }

        const legacy = window.HapticFeedback;
        if (!legacy) return;

        if (tone === 'selection' && typeof legacy.selection === 'function') {
            legacy.selection();
            return;
        }

        if ((tone === 'success' || tone === 'warning' || tone === 'error') && typeof legacy.notification === 'function') {
            legacy.notification(tone);
            return;
        }

        if (typeof legacy.impact === 'function') {
            const impactStyle = tone === 'heavy' ? 'heavy' : tone === 'medium' ? 'medium' : 'light';
            legacy.impact(impactStyle);
        }
    }

    function scheduleAfterPaint(callback, delay = 0) {
        window.setTimeout(() => {
            requestAnimationFrame(() => requestAnimationFrame(callback));
        }, delay);
    }

    function focusField(id, delay = 120) {
        scheduleAfterPaint(() => {
            const field = document.getElementById(id);
            if (!field || typeof field.focus !== 'function') return;

            field.focus({ preventScroll: false });
            if ((field.tagName === 'INPUT' || field.tagName === 'TEXTAREA') && typeof field.select === 'function') {
                field.select();
            }
        }, delay);
    }

    function assignFieldValue(id, value, formatterName) {
        if (value == null || value === '') return;
        const field = document.getElementById(id);
        if (!field) return;

        field.value = String(value);
        if (formatterName && typeof window[formatterName] === 'function') {
            window[formatterName](field);
        }

        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function findCategoryValue(categoryName) {
        const select = document.getElementById('input-category');
        if (!select) return '';

        const target = sanitizeText(categoryName).toLocaleLowerCase('tr-TR');
        const matchedOption = Array.from(select.options).find((option) => {
            return sanitizeText(option.value).toLocaleLowerCase('tr-TR') === target
                || sanitizeText(option.textContent).toLocaleLowerCase('tr-TR') === target;
        });

        return matchedOption ? matchedOption.value : '';
    }

    function buildDailySummary() {
        const today = new Date().toISOString().slice(0, 10);
        const transactions = getTransactions().filter((item) => normalizeDate(item && item.date) === today);

        const income = transactions
            .filter((item) => sanitizeText(item && item.type).toLowerCase() === 'income')
            .reduce((total, item) => total + parseAmount(item && item.amount), 0);

        const expense = transactions
            .filter((item) => sanitizeText(item && item.type).toLowerCase() !== 'income')
            .reduce((total, item) => total + parseAmount(item && item.amount), 0);

        if (!transactions.length) {
            return {
                short: 'Bugün için kayıt bulunmuyor.',
                long: 'Bugün için kayıt bulunmuyor. Yeni bir işlem ekleyebilirsiniz.'
            };
        }

        return {
            short: `Bugün ${formatCurrency(expense)} gider, ${formatCurrency(income)} gelir.`,
            long: `Bugün toplam ${formatCurrency(expense)} gider ve ${formatCurrency(income)} gelir kaydı bulunuyor.`
        };
    }

    function buildQuickEntrySnapshot() {
        const goals = getGoals();
        const transactions = getTransactions();
        const summary = buildDailySummary();
        const activeGoal = goals.find((goal) => !goal.completed && !goal.isCompleted) || goals[0] || null;

        const activeGoalCurrent = activeGoal ? parseAmount(activeGoal.currentAmount ?? activeGoal.current ?? activeGoal.savedAmount) : 0;
        const activeGoalTarget = activeGoal ? parseAmount(activeGoal.targetAmount ?? activeGoal.target) : 0;
        const activeGoalProgress = activeGoal && activeGoalTarget > 0
            ? Math.max(0, Math.min(100, Math.round((activeGoalCurrent / activeGoalTarget) * 100)))
            : 0;

        return {
            updatedAt: new Date().toISOString(),
            summary,
            transactionsToday: transactions.filter((item) => normalizeDate(item && item.date) === new Date().toISOString().slice(0, 10)).length,
            totalTransactions: transactions.length,
            notesCount: getNotes().length,
            goalsCount: goals.length,
            activeGoal: activeGoal ? {
                id: activeGoal.id,
                title: activeGoal.title || activeGoal.name || 'Hedef',
                progress: activeGoalProgress,
                saved: activeGoalCurrent,
                target: activeGoalTarget
            } : null
        };
    }

    function refreshQuickEntrySnapshot() {
        try {
            localStorage.setItem('fingenda_widget_snapshot', JSON.stringify(buildQuickEntrySnapshot()));
            document.body.dataset.quickEntrySnapshot = 'ready';
        } catch (error) {
            document.body.dataset.quickEntrySnapshot = 'unavailable';
        }
    }

    function openTransactionFlow(type, params = {}, source = 'system') {
        if (typeof window.switchTab === 'function') window.switchTab('add');
        if (typeof window.setTransactionType === 'function') window.setTransactionType(type);

        document.body.dataset.quickEntrySource = source;
        scheduleAfterPaint(() => {
            if (typeof window.updateCategoryOptions === 'function') {
                window.updateCategoryOptions();
            }

            assignFieldValue('input-date', params.date || new Date().toISOString().slice(0, 10));
            assignFieldValue('input-amount', params.amount, 'formatAmount');

            const categoryValue = params.category ? findCategoryValue(params.category) : '';
            if (categoryValue) {
                assignFieldValue('input-category', categoryValue);
                if (typeof window.syncTransactionCategoryField === 'function') {
                    window.syncTransactionCategoryField();
                }
            }

            const description = params.note || params.desc || params.description || '';
            assignFieldValue('input-desc', description);

            focusField(params.amount ? 'input-desc' : 'input-amount', 80);
            announce(type === 'income' ? 'Yeni gelir akışı hazır.' : 'Yeni gider akışı hazır.');
        }, 80);

        return true;
    }

    function openQuickNoteFlow(params = {}, source = 'system') {
        if (typeof window.switchTab === 'function') window.switchTab('notes');
        document.body.dataset.quickEntrySource = source;

        scheduleAfterPaint(() => {
            if (typeof window.toggleNotesModal === 'function') {
                window.toggleNotesModal(true);
            }

            scheduleAfterPaint(() => {
                assignFieldValue('note-title', params.title || params.noteTitle || '');
                assignFieldValue('note-content', params.content || params.note || '');
                focusField(params.title ? 'note-content' : 'note-title', 120);
                announce('Yeni not akışı hazır.');
            }, 140);
        }, 80);

        return true;
    }

    function openGoalContributionFlow(params = {}, source = 'system') {
        if (typeof window.switchTab === 'function') window.switchTab('goals');
        document.body.dataset.quickEntrySource = source;

        const goals = getGoals();
        const preferredGoal = goals.find((goal) => String(goal && goal.id) === String(params.goalId))
            || goals.find((goal) => goal && !goal.completed && !goal.isCompleted)
            || goals[0];

        scheduleAfterPaint(() => {
            if (!preferredGoal || typeof window.openAddFundsModal !== 'function') {
                announce('Hızlı katkı için önce bir hedef oluşturmanız gerekiyor.', 'assertive');
                if (typeof window.showMicroFeedback === 'function') {
                    window.showMicroFeedback({ message: 'Önce bir hedef oluşturun', type: 'warning', duration: 2200 });
                }
                return;
            }

            window.openAddFundsModal(preferredGoal.id);
            scheduleAfterPaint(() => {
                assignFieldValue('add-funds-amount', params.amount, 'formatAmount');
                focusField('add-funds-amount', 120);
                announce(`${preferredGoal.title || preferredGoal.name || 'Hedef'} için katkı akışı hazır.`);
            }, 140);
        }, 90);

        return true;
    }

    function openSummaryFlow() {
        if (typeof window.switchTab === 'function') window.switchTab('dashboard');
        const summary = buildDailySummary();
        if (typeof window.showMicroFeedback === 'function') {
            window.showMicroFeedback({ message: summary.short, type: 'info', duration: 2600 });
        }
        announce(summary.long);
        return true;
    }

    function openRecentExpensesFlow() {
        if (typeof window.switchTab === 'function') window.switchTab('history');
        scheduleAfterPaint(() => {
            const historySearch = document.getElementById('history-search');
            if (historySearch) {
                historySearch.value = '';
                historySearch.dispatchEvent(new Event('input', { bubbles: true }));
            }
            announce('Son harcamalar ekranı açıldı.');
        }, 90);
        return true;
    }

    function openBrainFlow() {
        if (typeof window.switchTab === 'function') window.switchTab('wallet');
        announce('Fingo Brain açıldı.');
        return true;
    }

    function openMarketFlow() {
        if (typeof window.switchTab === 'function') window.switchTab('doviz');
        announce('Piyasa ekranı açıldı.');
        return true;
    }

    function startVoiceAddFlow(params = {}, source = 'system') {
        openTransactionFlow('expense', params, source);
        scheduleAfterPaint(() => {
            if (typeof window.triggerVoiceInput === 'function') {
                window.triggerVoiceInput();
            }
            announce('Sesli ekleme başlatıldı.');
        }, 260);
        return true;
    }

    function startReceiptScanFlow(params = {}, source = 'system') {
        openTransactionFlow('expense', params, source);
        scheduleAfterPaint(() => {
            if (typeof window.triggerOCR === 'function') {
                window.triggerOCR();
            }
            announce('Fiş tarama başlatıldı.');
        }, 260);
        return true;
    }

    function parseActionURL(rawUrl) {
        try {
            const parsedUrl = new URL(rawUrl, window.location.href);
            const params = {};
            parsedUrl.searchParams.forEach((value, key) => {
                params[key] = value;
            });

            let action = params.action || '';
            if (!action && parsedUrl.protocol === 'fingenda:') {
                action = parsedUrl.hostname === 'action'
                    ? parsedUrl.pathname.replace(/^\/+/, '')
                    : (parsedUrl.hostname || parsedUrl.pathname.replace(/^\/+/, ''));
            }

            if (!action && parsedUrl.pathname.includes('/action/')) {
                action = parsedUrl.pathname.split('/action/')[1].split('/')[0];
            }

            if (!action) return null;
            delete params.action;

            return {
                action: sanitizeText(action).toLowerCase(),
                params
            };
        } catch (error) {
            return null;
        }
    }

    system.snapshot = system.snapshot || {};
    system.snapshot.refresh = refreshQuickEntrySnapshot;
    system.snapshot.read = function () {
        return readJSON('fingenda_widget_snapshot', {});
    };

    system.perform = function (action, params = {}, source = 'system') {
        const normalizedAction = sanitizeText(action).toLowerCase();
        let handled = false;

        if (normalizedAction === 'add-expense') handled = openTransactionFlow('expense', params, source);
        else if (normalizedAction === 'add-income') handled = openTransactionFlow('income', params, source);
        else if (normalizedAction === 'quick-note') handled = openQuickNoteFlow(params, source);
        else if (normalizedAction === 'goal-contribution') handled = openGoalContributionFlow(params, source);
        else if (normalizedAction === 'today-summary') handled = openSummaryFlow();
        else if (normalizedAction === 'recent-expenses') handled = openRecentExpensesFlow();
        else if (normalizedAction === 'fingo-brain') handled = openBrainFlow();
        else if (normalizedAction === 'market') handled = openMarketFlow();
        else if (normalizedAction === 'voice-add') handled = startVoiceAddFlow(params, source);
        else if (normalizedAction === 'receipt-scan') handled = startReceiptScanFlow(params, source);

        if (handled) {
            window.dispatchEvent(new CustomEvent('fingenda:system-action', {
                detail: { action: normalizedAction, params, source }
            }));
        }

        refreshQuickEntrySnapshot();
        return handled;
    };

    system.handleURL = function (rawUrl, source = 'url') {
        const parsed = parseActionURL(rawUrl);
        if (!parsed) return false;
        return system.perform(parsed.action, parsed.params, source);
    };

    function performOrQueue(action, params, source) {
        if (typeof window.switchTab !== 'function') {
            runtime.pendingActions.push({ action, params, source });
            return false;
        }
        return system.perform(action, params, source);
    }

    function flushPendingActions() {
        if (typeof window.switchTab !== 'function' || !runtime.pendingActions.length) return;
        const actions = runtime.pendingActions.splice(0);
        actions.forEach((item) => {
            system.perform(item.action, item.params, item.source);
        });
    }

    function consumeInitialQueryAction() {
        try {
            const currentUrl = new URL(window.location.href);
            const action = currentUrl.searchParams.get('action');
            if (!action) return;

            const params = {};
            currentUrl.searchParams.forEach((value, key) => {
                if (key !== 'action') params[key] = value;
            });

            performOrQueue(action, params, params.source || 'query');

            currentUrl.searchParams.delete('action');
            ['source', 'amount', 'category', 'note', 'desc', 'description', 'title', 'content', 'goalId', 'date'].forEach((key) => {
                currentUrl.searchParams.delete(key);
            });

            window.history.replaceState({}, document.title, currentUrl.toString());
        } catch (error) {
            // no-op
        }
    }

    function bindDeepLinks() {
        if (runtime.deepLinkBound) return;
        runtime.deepLinkBound = true;

        const appPlugin = window.Capacitor && (window.Capacitor.Plugins && window.Capacitor.Plugins.App || window.Capacitor.App);
        if (appPlugin && typeof appPlugin.addListener === 'function') {
            appPlugin.addListener('appUrlOpen', (data) => {
                system.handleURL(data && data.url, 'app-url');
            });

            if (typeof appPlugin.getLaunchUrl === 'function') {
                Promise.resolve(appPlugin.getLaunchUrl())
                    .then((data) => {
                        if (data && data.url) {
                            system.handleURL(data.url, 'launch-url');
                        }
                    })
                    .catch(() => { });
            }
        }
    }

    function wrapFeedbackBridges() {
        if (typeof window.showMicroFeedback === 'function' && !window.showMicroFeedback.__fingendaP2Wrapped) {
            const baseShowMicroFeedback = window.showMicroFeedback;
            window.showMicroFeedback = function (input) {
                const feedback = typeof input === 'string' ? { message: input } : (input || {});
                const tone = classifyFeedbackTone(feedback.type || feedback.color || 'info');
                announce(feedback.message, tone.priority);
                emitHaptic(tone.haptic);
                return baseShowMicroFeedback.apply(this, arguments);
            };
            window.showMicroFeedback.__fingendaP2Wrapped = true;
        }

        if (typeof window.alertMessage === 'function' && !window.alertMessage.__fingendaP2Wrapped) {
            const baseAlertMessage = window.alertMessage;
            window.alertMessage = function (title, message, tone) {
                const feedbackTone = classifyFeedbackTone(tone);
                announce(`${title}. ${message}`, feedbackTone.priority);
                return baseAlertMessage.apply(this, arguments);
            };
            window.alertMessage.__fingendaP2Wrapped = true;
        }
    }

    function syncTransactionTypeA11y() {
        const expenseButton = document.getElementById('btn-type-expense');
        const incomeButton = document.getElementById('btn-type-income');
        const expenseSelected = expenseButton && !expenseButton.classList.contains('bg-gray-100/50');
        const incomeSelected = incomeButton && !incomeButton.classList.contains('bg-gray-100/50');

        if (expenseButton) {
            expenseButton.setAttribute('aria-pressed', expenseSelected ? 'true' : 'false');
            expenseButton.setAttribute('aria-label', expenseSelected ? 'Gider tipi seçili' : 'Gider tipi seç');
        }

        if (incomeButton) {
            incomeButton.setAttribute('aria-pressed', incomeSelected ? 'true' : 'false');
            incomeButton.setAttribute('aria-label', incomeSelected ? 'Gelir tipi seçili' : 'Gelir tipi seç');
        }
    }

    function syncCategorySheetA11y() {
        const trigger = document.getElementById('transaction-category-trigger');
        const search = document.getElementById('transaction-category-search');
        const list = document.getElementById('transaction-category-list');
        const sheet = document.getElementById('transaction-category-sheet');

        if (trigger) {
            trigger.setAttribute('aria-haspopup', 'dialog');
            trigger.setAttribute('aria-controls', 'transaction-category-sheet');
            trigger.setAttribute('aria-expanded', sheet && sheet.classList.contains('is-open') ? 'true' : 'false');
        }

        if (search) {
            search.setAttribute('aria-label', 'Kategori ara');
            search.setAttribute('enterkeyhint', 'search');
        }

        if (list) {
            list.setAttribute('role', 'listbox');
            list.setAttribute('aria-label', 'Kategori listesi');
        }

        document.querySelectorAll('.transaction-category-sheet__option').forEach((button) => {
            button.setAttribute('role', 'option');
            button.setAttribute('aria-selected', button.classList.contains('is-selected') ? 'true' : 'false');
        });

        document.querySelectorAll('.transaction-category-sheet__recent-pill').forEach((button) => {
            button.setAttribute('aria-pressed', button.classList.contains('is-selected') ? 'true' : 'false');
        });
    }

    function describeMicroValue(text) {
        const cleaned = sanitizeText(text);
        if (!cleaned) return '';

        if (cleaned.includes('%')) {
            const numeric = cleaned.match(/[-+]?\d+(?:[.,]\d+)?/);
            const value = numeric ? numeric[0].replace(/[+]/g, '') : cleaned;
            if (/^[-−]/.test(cleaned) || cleaned.includes('↓')) {
                return `Bugün yüzde ${value.replace('-', '')} düşüş`;
            }
            if (/^[+]/.test(cleaned) || cleaned.includes('↑')) {
                return `Bugün yüzde ${value} artış`;
            }
            return `Yüzde ${value}`;
        }

        if (cleaned.includes('₺')) {
            return cleaned.replace(/₺/g, ' Türk lirası');
        }

        return cleaned;
    }

    function syncFinancialLabels() {
        document.querySelectorAll('#screen-doviz [class*="percent"], #screen-doviz [class*="change"], #screen-dashboard [class*="percent"], #screen-dashboard [class*="change"]').forEach((element) => {
            const spokenText = describeMicroValue(element.textContent);
            if (spokenText) {
                element.setAttribute('aria-label', spokenText);
            }
        });
    }

    function enhanceClickableCards() {
        document.querySelectorAll('#screen-dashboard [onclick], #screen-goals [onclick], #screen-wallet [onclick], #screen-history [onclick], #screen-notes [onclick]').forEach((element) => {
            if (element.dataset.a11yInteractive === 'true') return;
            if (element.tagName === 'BUTTON' || element.tagName === 'A') return;

            const labelParts = Array.from(element.querySelectorAll('h3, h4, strong, p, span'))
                .map((child) => sanitizeText(child.textContent))
                .filter(Boolean)
                .slice(0, 4);

            element.setAttribute('role', element.getAttribute('role') || 'button');
            if (!element.hasAttribute('tabindex')) {
                element.setAttribute('tabindex', '0');
            }
            if (!element.getAttribute('aria-label') && labelParts.length) {
                element.setAttribute('aria-label', labelParts.join(', '));
            }

            element.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    element.click();
                }
            });

            element.dataset.a11yInteractive = 'true';
        });
    }

    function syncScreenAccessibility() {
        const screenMap = {
            dashboard: 'Ana sayfa',
            notes: 'Notlar',
            history: 'Geçmiş işlemler',
            goals: 'Hedef kumbarası',
            doviz: 'Piyasa özeti',
            wallet: 'Fingo Brain',
            add: 'Yeni işlem'
        };

        Object.keys(screenMap).forEach((key) => {
            const screen = document.getElementById(`screen-${key}`);
            if (!screen) return;

            const active = isVisible(screen);
            screen.setAttribute('role', 'region');
            screen.setAttribute('aria-label', screenMap[key]);
            screen.setAttribute('aria-hidden', active ? 'false' : 'true');
            screen.dataset.activeScreen = active ? 'true' : 'false';
            if (active) {
                document.body.dataset.activeScreen = key;
            }
        });

        ['dashboard', 'notes', 'add', 'doviz', 'wallet'].forEach((key) => {
            const navButton = document.getElementById(`nav-${key}`);
            if (!navButton) return;
            if (document.body.dataset.activeScreen === key) {
                navButton.setAttribute('aria-current', 'page');
            } else {
                navButton.removeAttribute('aria-current');
            }
        });
    }

    function decorateFormsAndModals() {
        root.classList.add('fingenda-a11y-polish');

        const main = document.querySelector('#app-container > main');
        if (main) {
            main.setAttribute('role', 'main');
            main.setAttribute('aria-label', 'Fingenda ana içerik');
        }

        const addFundsModal = document.getElementById('add-funds-modal');
        if (addFundsModal) {
            addFundsModal.setAttribute('role', 'dialog');
            addFundsModal.setAttribute('aria-modal', 'true');
            addFundsModal.setAttribute('aria-labelledby', 'add-funds-goal-title');
        }

        const notesModal = document.getElementById('notes-modal');
        if (notesModal) {
            notesModal.setAttribute('role', 'dialog');
            notesModal.setAttribute('aria-modal', 'true');
            notesModal.setAttribute('aria-label', 'Not düzenleme ekranı');
        }

        const fieldLabels = [
            ['input-amount', 'İşlem tutarı'],
            ['input-date', 'İşlem tarihi'],
            ['input-desc', 'İşlem açıklaması'],
            ['input-category', 'Seçili kategori'],
            ['input-currency', 'Para birimi'],
            ['add-funds-amount', 'Katkı tutarı'],
            ['note-title', 'Not başlığı'],
            ['note-content', 'Not içeriği'],
            ['history-search', 'Geçmiş işlemlerde ara'],
            ['transaction-category-search', 'Kategori ara']
        ];

        fieldLabels.forEach(([id, label]) => {
            const field = document.getElementById(id);
            if (field && !field.getAttribute('aria-label')) {
                field.setAttribute('aria-label', label);
            }
        });

        const transactionFeedback = document.getElementById('transaction-feedback');
        if (transactionFeedback) {
            transactionFeedback.setAttribute('role', 'status');
            transactionFeedback.setAttribute('aria-live', 'polite');
        }
    }

    function scheduleAccessibilityRefresh() {
        if (runtime.a11yRefreshHandle) {
            cancelAnimationFrame(runtime.a11yRefreshHandle);
        }

        runtime.a11yRefreshHandle = requestAnimationFrame(() => {
            runtime.a11yRefreshHandle = 0;
            decorateFormsAndModals();
            syncScreenAccessibility();
            syncTransactionTypeA11y();
            syncCategorySheetA11y();
            syncFinancialLabels();
            enhanceClickableCards();
            refreshQuickEntrySnapshot();
        });
    }

    function wrapInteractiveFlows() {
        if (typeof window.switchTab === 'function' && !window.switchTab.__fingendaP2Wrapped) {
            const baseSwitchTab = window.switchTab;
            window.switchTab = function (tabName) {
                const previousTab = document.body.dataset.activeScreen || '';
                const result = baseSwitchTab.apply(this, arguments);
                if (tabName && previousTab !== tabName && result !== false) {
                    emitHaptic('selection');
                    scheduleAccessibilityRefresh();
                }
                return result;
            };
            window.switchTab.__fingendaP2Wrapped = true;
        }

        if (typeof window.setTransactionType === 'function' && !window.setTransactionType.__fingendaP2Wrapped) {
            const baseSetTransactionType = window.setTransactionType;
            window.setTransactionType = function (type) {
                const result = baseSetTransactionType.apply(this, arguments);
                emitHaptic('light');
                scheduleAccessibilityRefresh();
                announce(type === 'income' ? 'Gelir türü seçildi.' : 'Gider türü seçildi.');
                return result;
            };
            window.setTransactionType.__fingendaP2Wrapped = true;
        }

        if (typeof window.openTransactionCategorySheet === 'function' && !window.openTransactionCategorySheet.__fingendaP2Wrapped) {
            const baseOpenCategorySheet = window.openTransactionCategorySheet;
            window.openTransactionCategorySheet = function () {
                const result = baseOpenCategorySheet.apply(this, arguments);
                emitHaptic('selection');
                scheduleAccessibilityRefresh();
                focusField('transaction-category-search', 120);
                return result;
            };
            window.openTransactionCategorySheet.__fingendaP2Wrapped = true;
        }

        if (typeof window.closeTransactionCategorySheet === 'function' && !window.closeTransactionCategorySheet.__fingendaP2Wrapped) {
            const baseCloseCategorySheet = window.closeTransactionCategorySheet;
            window.closeTransactionCategorySheet = function () {
                const result = baseCloseCategorySheet.apply(this, arguments);
                scheduleAccessibilityRefresh();
                focusField('transaction-category-trigger', 220);
                return result;
            };
            window.closeTransactionCategorySheet.__fingendaP2Wrapped = true;
        }

        if (typeof window.selectTransactionCategory === 'function' && !window.selectTransactionCategory.__fingendaP2Wrapped) {
            const baseSelectTransactionCategory = window.selectTransactionCategory;
            window.selectTransactionCategory = function (category) {
                const result = baseSelectTransactionCategory.apply(this, arguments);
                emitHaptic('selection');
                scheduleAccessibilityRefresh();
                announce(`${category} kategorisi seçildi.`);
                return result;
            };
            window.selectTransactionCategory.__fingendaP2Wrapped = true;
        }

        if (typeof window.toggleNotesModal === 'function' && !window.toggleNotesModal.__fingendaP2Wrapped) {
            const baseToggleNotesModal = window.toggleNotesModal;
            window.toggleNotesModal = function () {
                const wasVisible = isVisible(document.getElementById('notes-modal'));
                const result = baseToggleNotesModal.apply(this, arguments);
                scheduleAfterPaint(() => {
                    const nowVisible = isVisible(document.getElementById('notes-modal'));
                    if (!wasVisible && nowVisible) {
                        emitHaptic('selection');
                        focusField('note-title', 80);
                    }
                    scheduleAccessibilityRefresh();
                }, 40);
                return result;
            };
            window.toggleNotesModal.__fingendaP2Wrapped = true;
        }

        if (typeof window.openAddFundsModal === 'function' && !window.openAddFundsModal.__fingendaP2Wrapped) {
            const baseOpenAddFundsModal = window.openAddFundsModal;
            window.openAddFundsModal = function () {
                const result = baseOpenAddFundsModal.apply(this, arguments);
                emitHaptic('selection');
                scheduleAccessibilityRefresh();
                focusField('add-funds-amount', 140);
                return result;
            };
            window.openAddFundsModal.__fingendaP2Wrapped = true;
        }

        if (typeof window.triggerOCR === 'function' && !window.triggerOCR.__fingendaP2Wrapped) {
            const baseTriggerOCR = window.triggerOCR;
            window.triggerOCR = function () {
                emitHaptic('light');
                announce('Fiş tarama akışı açılıyor.');
                return baseTriggerOCR.apply(this, arguments);
            };
            window.triggerOCR.__fingendaP2Wrapped = true;
        }

        if (typeof window.triggerVoiceInput === 'function' && !window.triggerVoiceInput.__fingendaP2Wrapped) {
            const baseTriggerVoiceInput = window.triggerVoiceInput;
            window.triggerVoiceInput = function () {
                emitHaptic('light');
                announce('Sesli işlem akışı açılıyor.');
                return baseTriggerVoiceInput.apply(this, arguments);
            };
            window.triggerVoiceInput.__fingendaP2Wrapped = true;
        }

        ['renderTransactionCategorySheet', 'renderGoalsList', 'renderNotes', 'renderAppleTransactions'].forEach((name) => {
            const fn = window[name];
            if (typeof fn !== 'function' || fn.__fingendaP2Wrapped) return;

            window[name] = function () {
                const result = fn.apply(this, arguments);
                scheduleAccessibilityRefresh();
                return result;
            };
            window[name].__fingendaP2Wrapped = true;
        });
    }

    function bindPreferenceClasses() {
        const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        const contrastQuery = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-contrast: more)') : null;

        function applyPreferences() {
            root.classList.toggle('fingenda-reduced-motion', motionQuery.matches);
            root.classList.toggle('fingenda-more-contrast', !!contrastQuery && contrastQuery.matches);
        }

        applyPreferences();
        if (motionQuery.addEventListener) motionQuery.addEventListener('change', applyPreferences);
        if (contrastQuery && contrastQuery.addEventListener) contrastQuery.addEventListener('change', applyPreferences);
    }

    function bindObservers() {
        if (runtime.observer || !document.body) return;

        runtime.observer = new MutationObserver(() => {
            scheduleAccessibilityRefresh();
        });

        runtime.observer.observe(document.body, {
            subtree: true,
            childList: true,
            attributes: true,
            attributeFilter: ['class', 'style', 'aria-hidden']
        });
    }

    function init() {
        bindPreferenceClasses();
        bindDeepLinks();
        wrapFeedbackBridges();
        wrapInteractiveFlows();
        bindObservers();
        scheduleAccessibilityRefresh();
        consumeInitialQueryAction();
        flushPendingActions();

        ['transaction-added', 'transaction-updated', 'transaction-deleted', 'transaction:change', 'goals:change', 'notes:change', 'languageChanged', 'FingendaLangChanged', 'app:change'].forEach((eventName) => {
            window.addEventListener(eventName, () => {
                refreshQuickEntrySnapshot();
                scheduleAccessibilityRefresh();
            }, { passive: true });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
