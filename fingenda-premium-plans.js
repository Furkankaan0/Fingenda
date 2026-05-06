(function initFingendaPremiumPlans() {
    'use strict';

    if (window.__fingendaPremiumPlansV2) return;
    window.__fingendaPremiumPlansV2 = true;

    const PLAN_ORDER = ['monthly', 'yearly', 'lifetime'];
    const PLAN_CONFIG = Object.freeze({
        monthly: {
            id: 'monthly',
            productKey: 'MONTHLY',
            fallbackProductId: 'com.fingenda.premium.monthly',
            fallbackPrice: '₺49,99',
            tr: {
                label: 'Aylık',
                badge: 'Esnek',
                period: '/ay',
                title: 'Aylık Pro',
                caption: 'Esnek aylık kullanım. İstediğin zaman iptal edebilirsin.',
                cta: 'Aylık Pro ile devam et',
                legal: 'Aylık abonelik Apple hesabın üzerinden yenilenir. Yönetim ve iptal App Store üzerinden yapılır.'
            },
            en: {
                label: 'Monthly',
                badge: 'Flexible',
                period: '/mo',
                title: 'Monthly Pro',
                caption: 'Flexible monthly access. Cancel anytime.',
                cta: 'Continue with Monthly Pro',
                legal: 'The monthly subscription renews through your Apple account. Manage or cancel from the App Store.'
            }
        },
        yearly: {
            id: 'yearly',
            productKey: 'YEARLY',
            fallbackProductId: 'com.fingenda.premium.yearly',
            fallbackPrice: '₺399,99',
            tr: {
                label: 'Yıllık',
                badge: 'En iyi değer',
                period: '/yıl',
                title: 'Yıllık Pro',
                caption: 'Yıllık planda ₺33,33/ay. En dengeli seçim.',
                cta: 'Yıllık Pro ile devam et',
                legal: 'Yıllık abonelik Apple hesabın üzerinden yenilenir. Yönetim ve iptal App Store üzerinden yapılır.'
            },
            en: {
                label: 'Yearly',
                badge: 'Best value',
                period: '/yr',
                title: 'Yearly Pro',
                caption: 'Only ₺33.33/mo, billed yearly.',
                cta: 'Continue with Yearly Pro',
                legal: 'The yearly subscription renews through your Apple account. Manage or cancel from the App Store.'
            }
        },
        lifetime: {
            id: 'lifetime',
            productKey: 'LIFETIME',
            fallbackProductId: 'com.fingenda.premium.lifetime',
            fallbackPrice: '₺1.499,99',
            tr: {
                label: 'Ömür Boyu',
                badge: 'Tek ödeme',
                period: 'tek ödeme',
                title: 'Ömür Boyu Pro',
                caption: 'Tek ödeme. Abonelik yok.',
                cta: 'Ömür Boyu Pro satın al',
                legal: 'Ömür boyu plan tek seferlik satın alımdır. Abonelik yenilemesi içermez.'
            },
            en: {
                label: 'Lifetime',
                badge: 'One-time',
                period: 'one-time',
                title: 'Lifetime Pro',
                caption: 'One payment. No subscription.',
                cta: 'Buy Lifetime Pro',
                legal: 'Lifetime Pro is a one-time purchase and does not renew.'
            }
        }
    });

    function locale() {
        const raw = String(
            window.currentLanguage ||
            localStorage.getItem('fingenda_language') ||
            localStorage.getItem('language') ||
            document.documentElement.lang ||
            navigator.language ||
            'tr'
        ).toLowerCase();
        return raw.startsWith('en') ? 'en' : 'tr';
    }

    function normalizePlan(planId) {
        return PLAN_ORDER.includes(planId) ? planId : 'yearly';
    }

    function textFor(planId) {
        const plan = PLAN_CONFIG[normalizePlan(planId)];
        return plan[locale()] || plan.tr;
    }

    function getSelectedPlan() {
        return normalizePlan(
            window.__legacyPremiumPlan ||
            localStorage.getItem('fingenda_selected_premium_plan') ||
            localStorage.getItem('premium_plan') ||
            window.PremiumManager?.selectedPlan ||
            'yearly'
        );
    }

    function getProductId(planId) {
        const plan = PLAN_CONFIG[normalizePlan(planId)];
        return window.IAPManager?.PRODUCT_IDS?.[plan.productKey] || plan.fallbackProductId;
    }

    function getStoreProduct(planId) {
        const productId = getProductId(planId);
        const products = Array.isArray(window.IAPManager?.products) ? window.IAPManager.products : [];
        return products.find((product) =>
            product?.id === productId ||
            product?.productId === productId ||
            String(product?.id || '').includes(normalizePlan(planId))
        );
    }

    function getPrice(planId) {
        const plan = PLAN_CONFIG[normalizePlan(planId)];
        const product = getStoreProduct(plan.id);
        return product?.localizedPrice || product?.priceString || product?.price || plan.fallbackPrice;
    }

    function injectStyles() {
        if (document.getElementById('fingenda-premium-plans-style')) return;
        const style = document.createElement('style');
        style.id = 'fingenda-premium-plans-style';
        style.textContent = `
            #premium-modal .premium-card-3d {
                max-height: min(92vh, 760px);
                overflow-y: auto;
                scrollbar-width: none;
            }

            #premium-modal .premium-card-3d::-webkit-scrollbar {
                display: none;
            }

            #premium-modal .premium-plan-grid-v2 {
                width: 100%;
                display: grid;
                grid-template-columns: 1fr;
                gap: 10px;
                margin: 0 0 18px;
            }

            #premium-modal .premium-plan-card-v2 {
                position: relative;
                width: 100%;
                text-align: left;
                border: 1px solid rgba(148, 163, 184, 0.22);
                border-radius: 22px;
                padding: 13px 14px;
                background:
                    radial-gradient(circle at 15% 0%, rgba(99, 102, 241, 0.10), transparent 42%),
                    linear-gradient(145deg, rgba(255, 255, 255, 0.94), rgba(241, 245, 249, 0.78));
                color: #0f172a;
                box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.82), 0 18px 32px -28px rgba(15, 23, 42, 0.36);
                transition: transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease, background 180ms ease;
            }

            html.dark #premium-modal .premium-plan-card-v2 {
                background:
                    radial-gradient(circle at 12% 0%, rgba(139, 92, 246, 0.24), transparent 42%),
                    linear-gradient(145deg, rgba(30, 27, 75, 0.80), rgba(15, 23, 42, 0.90));
                border-color: rgba(255, 255, 255, 0.12);
                color: #f8fafc;
                box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 22px 42px -30px rgba(0, 0, 0, 0.88);
            }

            #premium-modal .premium-plan-card-v2:hover,
            #premium-modal .premium-plan-card-v2:focus-visible {
                transform: translateY(-1px);
                border-color: rgba(99, 102, 241, 0.50);
                outline: none;
            }

            #premium-modal .premium-plan-card-v2.is-active {
                border-color: rgba(99, 102, 241, 0.86);
                background:
                    radial-gradient(circle at 18% 0%, rgba(99, 102, 241, 0.22), transparent 46%),
                    linear-gradient(145deg, rgba(238, 242, 255, 0.98), rgba(255, 255, 255, 0.90));
                box-shadow: 0 22px 40px -28px rgba(79, 70, 229, 0.70), inset 0 0 0 1px rgba(255, 255, 255, 0.78);
            }

            html.dark #premium-modal .premium-plan-card-v2.is-active {
                background:
                    radial-gradient(circle at 18% 0%, rgba(139, 92, 246, 0.38), transparent 46%),
                    linear-gradient(145deg, rgba(67, 56, 202, 0.40), rgba(15, 23, 42, 0.94));
                border-color: rgba(167, 139, 250, 0.88);
                box-shadow: 0 24px 46px -30px rgba(139, 92, 246, 0.86), inset 0 0 0 1px rgba(255, 255, 255, 0.08);
            }

            #premium-modal .premium-plan-card-v2__top {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 10px;
                margin-bottom: 6px;
            }

            #premium-modal .premium-plan-card-v2__label {
                font-size: 13px;
                font-weight: 900;
                letter-spacing: -0.01em;
            }

            #premium-modal .premium-plan-card-v2__badge {
                border-radius: 999px;
                padding: 4px 8px;
                font-size: 9px;
                font-weight: 900;
                letter-spacing: 0.06em;
                text-transform: uppercase;
                color: #4338ca;
                background: rgba(99, 102, 241, 0.12);
            }

            html.dark #premium-modal .premium-plan-card-v2__badge {
                color: #ddd6fe;
                background: rgba(167, 139, 250, 0.16);
            }

            #premium-modal .premium-plan-card-v2__price {
                display: flex;
                align-items: baseline;
                gap: 5px;
                margin-bottom: 5px;
            }

            #premium-modal .premium-plan-card-v2__amount {
                font-size: 23px;
                line-height: 1;
                font-weight: 950;
                letter-spacing: -0.04em;
            }

            #premium-modal .premium-plan-card-v2__period,
            #premium-modal .paywall-price-period {
                font-size: 11px;
                font-weight: 800;
                color: #64748b;
            }

            html.dark #premium-modal .premium-plan-card-v2__period,
            html.dark #premium-modal .paywall-price-period {
                color: #c4b5fd;
            }

            #premium-modal .premium-plan-card-v2__caption,
            #premium-modal .paywall-price-caption {
                display: block;
                color: #64748b;
                font-size: 11px;
                line-height: 1.35;
                font-weight: 700;
            }

            html.dark #premium-modal .premium-plan-card-v2__caption,
            html.dark #premium-modal .paywall-price-caption {
                color: rgba(226, 232, 240, 0.76);
            }

            #premium-modal .premium-selected-price-v2 {
                display: flex;
                justify-content: center;
                align-items: baseline;
                gap: 6px;
            }

            .fo-premium-plan-strip {
                width: min(100%, 390px);
                margin: 0 auto 12px;
                display: grid;
                grid-template-columns: repeat(3, minmax(0, 1fr));
                gap: 8px;
            }

            .fo-premium-plan-mini {
                border: 1px solid rgba(255, 255, 255, 0.18);
                border-radius: 18px;
                padding: 9px 8px;
                background: rgba(15, 23, 42, 0.52);
                color: white;
                text-align: center;
                box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
            }

            .fo-premium-plan-mini strong {
                display: block;
                font-size: 10px;
                line-height: 1.1;
                letter-spacing: -0.01em;
            }

            .fo-premium-plan-mini span {
                display: block;
                margin-top: 5px;
                font-size: 9px;
                font-weight: 900;
                color: #c4b5fd;
            }

            .fo-premium-plan-mini.is-active {
                transform: translateY(-1px);
                border-color: rgba(255, 255, 255, 0.48);
                background: linear-gradient(145deg, rgba(99, 102, 241, 0.92), rgba(139, 92, 246, 0.82));
            }

            html:not(.dark) .fo-premium-plan-mini {
                background: rgba(255, 255, 255, 0.78);
                color: #0f172a;
                border-color: rgba(148, 163, 184, 0.20);
            }

            html:not(.dark) .fo-premium-plan-mini span {
                color: #4f46e5;
            }

            @media (max-width: 380px) {
                #premium-modal .premium-plan-card-v2__amount {
                    font-size: 20px;
                }

                .fo-premium-plan-strip {
                    grid-template-columns: 1fr;
                }
            }

            #premium-modal .premium-plan-grid-v2 {
                grid-template-columns: repeat(3, minmax(0, 1fr));
                gap: 8px;
                padding: 7px;
                margin: 0 0 18px;
                border-radius: 28px;
                background:
                    radial-gradient(circle at 12% 0%, rgba(99, 102, 241, 0.16), transparent 45%),
                    linear-gradient(145deg, rgba(248, 250, 252, 0.90), rgba(226, 232, 240, 0.70));
                border: 1px solid rgba(148, 163, 184, 0.24);
                box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.78), 0 20px 42px -34px rgba(15, 23, 42, 0.50);
            }

            html.dark #premium-modal .premium-plan-grid-v2 {
                background:
                    radial-gradient(circle at 16% 0%, rgba(139, 92, 246, 0.22), transparent 42%),
                    linear-gradient(145deg, rgba(15, 23, 42, 0.92), rgba(30, 27, 75, 0.62));
                border-color: rgba(255, 255, 255, 0.10);
                box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 24px 46px -36px rgba(0, 0, 0, 0.86);
            }

            #premium-modal .premium-plan-card-v2 {
                isolation: isolate;
                min-width: 0;
                min-height: 126px;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                gap: 7px;
                padding: 11px 10px;
                overflow: hidden;
                border-radius: 22px;
                border-color: transparent;
                background: rgba(255, 255, 255, 0.48);
                box-shadow: none;
            }

            html.dark #premium-modal .premium-plan-card-v2 {
                background: rgba(15, 23, 42, 0.54);
            }

            #premium-modal .premium-plan-card-v2::before {
                content: "";
                position: absolute;
                inset: -1px;
                z-index: -1;
                opacity: 0;
                background:
                    radial-gradient(circle at 28% 0%, rgba(255, 255, 255, 0.58), transparent 38%),
                    linear-gradient(145deg, rgba(99, 102, 241, 0.24), rgba(14, 165, 233, 0.08));
                transition: opacity 180ms ease;
            }

            #premium-modal .premium-plan-card-v2.is-active {
                transform: translateY(-1px);
                border-color: rgba(99, 102, 241, 0.70);
                background: rgba(255, 255, 255, 0.76);
                box-shadow: 0 18px 32px -24px rgba(79, 70, 229, 0.58), inset 0 0 0 1px rgba(255, 255, 255, 0.76);
            }

            html.dark #premium-modal .premium-plan-card-v2.is-active {
                border-color: rgba(167, 139, 250, 0.72);
                background: rgba(49, 46, 129, 0.52);
                box-shadow: 0 20px 36px -24px rgba(139, 92, 246, 0.72), inset 0 0 0 1px rgba(255, 255, 255, 0.08);
            }

            #premium-modal .premium-plan-card-v2.is-active::before {
                opacity: 1;
            }

            #premium-modal .premium-plan-card-v2__top {
                display: grid;
                align-items: start;
                justify-content: stretch;
                gap: 6px;
                margin: 0;
            }

            #premium-modal .premium-plan-card-v2__label {
                font-size: clamp(11px, 2.7vw, 13px);
                line-height: 1.05;
                font-weight: 950;
                letter-spacing: -0.02em;
            }

            #premium-modal .premium-plan-card-v2__badge {
                width: max-content;
                max-width: 100%;
                padding: 4px 7px;
                font-size: 8px;
                line-height: 1;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            #premium-modal .premium-plan-card-v2__price {
                display: grid;
                align-items: start;
                gap: 2px;
                margin: 0;
            }

            #premium-modal .premium-plan-card-v2__amount {
                font-size: clamp(17px, 4.8vw, 22px);
                line-height: 1;
                font-weight: 950;
                letter-spacing: -0.06em;
                white-space: nowrap;
            }

            #premium-modal .premium-plan-card-v2__period {
                font-size: 10px;
                line-height: 1.1;
            }

            #premium-modal .premium-plan-card-v2__caption {
                min-height: 26px;
                font-size: 9px;
                line-height: 1.25;
                font-weight: 800;
                display: -webkit-box;
                -webkit-line-clamp: 2;
                -webkit-box-orient: vertical;
                overflow: hidden;
            }

            #premium-modal .premium-selected-price-v2 {
                display: inline-flex;
                align-items: baseline;
                justify-content: center;
                gap: 6px;
                padding: 8px 14px;
                border-radius: 18px;
                background: linear-gradient(145deg, rgba(99, 102, 241, 0.12), rgba(14, 165, 233, 0.08));
                border: 1px solid rgba(99, 102, 241, 0.18);
                box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.70);
            }

            html.dark #premium-modal .premium-selected-price-v2 {
                background: linear-gradient(145deg, rgba(99, 102, 241, 0.18), rgba(139, 92, 246, 0.12));
                border-color: rgba(255, 255, 255, 0.10);
                box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
            }

            @media (max-width: 380px) {
                #premium-modal .premium-plan-grid-v2 {
                    gap: 6px;
                    padding: 6px;
                }

                #premium-modal .premium-plan-card-v2 {
                    min-height: 118px;
                    padding: 10px 8px;
                    border-radius: 19px;
                }

                #premium-modal .premium-plan-card-v2__badge {
                    display: none;
                }

                #premium-modal .premium-plan-card-v2__amount {
                    font-size: 16px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    function renderPlanCards() {
        const container = document.querySelector('#premium-modal .pricing-toggle');
        if (!container) return;

        const selected = getSelectedPlan();
        container.className = 'pricing-toggle premium-plan-grid-v2 mx-auto mb-4';
        container.innerHTML = PLAN_ORDER.map((planId) => {
            const text = textFor(planId);
            const active = planId === selected ? ' is-active' : '';
            return `
                <button type="button" class="premium-plan-card-v2${active}" data-premium-plan="${planId}" aria-pressed="${planId === selected ? 'true' : 'false'}" onclick="window.setPricingPlan('${planId}')">
                    <span class="premium-plan-card-v2__top">
                        <span class="premium-plan-card-v2__label">${text.label}</span>
                        <span class="premium-plan-card-v2__badge">${text.badge}</span>
                    </span>
                    <span class="premium-plan-card-v2__price">
                        <span class="premium-plan-card-v2__amount">${getPrice(planId)}</span>
                        <span class="premium-plan-card-v2__period">${text.period}</span>
                    </span>
                    <span class="premium-plan-card-v2__caption">${text.caption}</span>
                </button>
            `;
        }).join('');

        updateSelectedPrice();
    }

    function updateSelectedPrice() {
        const selected = getSelectedPlan();
        const text = textFor(selected);
        const priceDisplay = document.getElementById('premium-price-display');
        const legacyCta = document.querySelector('#premium-modal button[onclick*="upgradeToPro"] .relative.z-10');
        const modernCta = document.getElementById('btn-purchase-premium');
        const legal = document.querySelector('#premium-modal p[data-i18n="premium.cancelAnytime"]');

        document.querySelectorAll('#premium-modal [data-premium-plan]').forEach((button) => {
            button.classList.toggle('is-active', button.dataset.premiumPlan === selected);
            button.setAttribute('aria-pressed', button.dataset.premiumPlan === selected ? 'true' : 'false');
        });

        if (priceDisplay) {
            priceDisplay.innerHTML = `
                <div class="premium-selected-price-v2">
                    <span class="paywall-price-amount text-4xl font-black">${getPrice(selected)}</span>
                    <span class="paywall-price-period text-sm">${text.period}</span>
                </div>
                <p class="paywall-price-caption text-[10px] mt-2">${text.caption}</p>
            `;
        }

        if (legacyCta) legacyCta.textContent = text.cta;
        if (modernCta) modernCta.textContent = text.cta;
        if (legal) legal.textContent = text.legal;
    }

    function setPlan(planId) {
        const selected = normalizePlan(planId);
        window.__legacyPremiumPlan = selected;
        localStorage.setItem('fingenda_selected_premium_plan', selected);

        if (window.PremiumManager) {
            window.PremiumManager.selectedPlan = selected;
        }

        renderPlanCards();
        renderOnboardingPlans();
        return selected;
    }

    function hidePremiumModals() {
        document.getElementById('premium-modal')?.classList.add('hidden');
        const modern = document.getElementById('premium-paywall-modal');
        if (modern) {
            modern.setAttribute('aria-hidden', 'true');
            modern.classList.add('hidden');
        }
    }

    function showPaywall() {
        const legacyModal = document.getElementById('premium-modal');
        if (legacyModal) {
            legacyModal.classList.remove('hidden');
            legacyModal.setAttribute('aria-hidden', 'false');
            renderPlanCards();
            return true;
        }
        window.PremiumManager?.showPaywall?.('premium_plan_selector');
        return false;
    }

    function buttonForCheckout() {
        return document.querySelector('#premium-modal button[onclick*="upgradeToPro"]') ||
            document.getElementById('btn-purchase-premium');
    }

    async function startCheckout(sourceKey = 'premium_checkout') {
        const buildFlags = window.__FINGENDA_BUILD__ || {};
        const isTestBypass = !!buildFlags.testPremiumBypass && String(buildFlags.buildChannel || '').toLowerCase() !== 'release';

        if (isTestBypass && typeof window.activatePremiumForTesting === 'function') {
            return window.activatePremiumForTesting(sourceKey);
        }

        const premiumManager = window.PremiumManager;
        if (!premiumManager || typeof window.IAPManager?.purchase !== 'function') {
            window.alertMessage?.('Premium', 'Satın alma şu anda kullanılamıyor. Lütfen kısa süre sonra tekrar deneyin.', 'blue');
            return false;
        }

        if (premiumManager.isPremium || window.userStatus === 'pro') {
            hidePremiumModals();
            return true;
        }

        const selected = setPlan(getSelectedPlan());
        const productId = getProductId(selected);
        const button = buttonForCheckout();
        const originalMarkup = button?.innerHTML || '';

        if (!productId) {
            window.alertMessage?.('Premium', 'Satın alma planı hazırlanamadı. Lütfen tekrar deneyin.', 'red');
            return false;
        }

        if (button) {
            button.disabled = true;
            button.innerHTML = '<span class="inline-flex items-center gap-2 justify-center"><svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span>Apple ödeme ekranı açılıyor...</span></span>';
        }

        try {
            window.ErrorLogger?.log('info', `Premium checkout started: ${sourceKey}:${selected}:${productId}`);
            const success = await window.IAPManager.purchase(productId);
            if (!success) {
                window.showMicroFeedback?.({ message: 'Satın alma iptal edildi', type: 'warning' });
                return false;
            }

            const entitlement = {
                productId,
                plan: selected,
                purchaseDate: new Date().toISOString(),
                expiresAt: selected === 'lifetime' ? null : undefined
            };

            localStorage.setItem('premium_entitlement', JSON.stringify(entitlement));
            localStorage.setItem('premium_plan', selected);
            localStorage.setItem('premium_product_id', productId);
            localStorage.setItem('user_membership_status', 'pro');
            localStorage.setItem('user_status', 'pro');
            localStorage.setItem('premium', 'true');

            await premiumManager.refreshEntitlement?.();
            premiumManager.isPremium = true;
            premiumManager.selectedPlan = selected;
            premiumManager.unlockAllFeatures?.();
            window.userStatus = 'pro';
            window.__premiumReady = Promise.resolve(true);

            hidePremiumModals();

            try { window.updateUserPlanBadge?.(); } catch (_) { }
            try { window.refreshPremiumLocks?.(); } catch (_) { }
            try { window.applyPremiumUI?.(); } catch (_) { }
            try { window.updateProfileUI?.(window.currentUserName, window.currentUserTitle, window.currentUserAvatar); } catch (_) { }

            window.showMicroFeedback?.({ message: 'Premium aktif edildi!', type: 'success' });
            return true;
        } catch (error) {
            console.error('[PremiumPlans] Checkout failed:', error);
            window.ErrorLogger?.log('error', 'Premium checkout failed', { sourceKey, selected, productId, error: error?.message || String(error) });
            window.alertMessage?.('Premium', 'Apple ödeme ekranı açılamadı. Lütfen tekrar deneyin.', 'red');
            return false;
        } finally {
            if (button) {
                button.disabled = false;
                button.innerHTML = originalMarkup;
                updateSelectedPrice();
            }
        }
    }

    function renderOnboardingPlans() {
        const onboarding = window.fingoOnboarding;
        const ctaArea = document.getElementById('fo-cta-area');
        if (!onboarding || !ctaArea || onboarding.current !== onboarding.total - 1) return;

        let strip = ctaArea.querySelector('.fo-premium-plan-strip');
        if (!strip) {
            strip = document.createElement('div');
            strip.className = 'fo-premium-plan-strip';
            ctaArea.prepend(strip);
        }

        const selected = getSelectedPlan();
        strip.innerHTML = PLAN_ORDER.map((planId) => {
            const text = textFor(planId);
            return `
                <button type="button" class="fo-premium-plan-mini${planId === selected ? ' is-active' : ''}" onclick="window.setPricingPlan('${planId}')">
                    <strong>${text.label}</strong>
                    <span>${getPrice(planId)}</span>
                </button>
            `;
        }).join('');
    }

    function patchOnboarding() {
        const onboarding = window.fingoOnboarding;
        if (!onboarding || onboarding.__premiumPlanPreviewPatched) return;
        onboarding.__premiumPlanPreviewPatched = true;

        const originalUpdateUI = typeof onboarding.updateUI === 'function' ? onboarding.updateUI.bind(onboarding) : null;
        if (originalUpdateUI) {
            onboarding.updateUI = function updateUIPremiumPlanAware(...args) {
                const result = originalUpdateUI(...args);
                renderOnboardingPlans();
                return result;
            };
        }

        onboarding.buyPremium = function buyPremiumWithSelectedPlan() {
            localStorage.setItem('fingo_onboarding_completed', 'true');
            document.getElementById('fingo-onboarding')?.classList.add('fo-hidden');
            showPaywall();
            return true;
        };

        renderOnboardingPlans();
    }

    function patchManagers() {
        const originalSetPlan = window.PremiumManager?.setPlan?.bind(window.PremiumManager);
        if (window.PremiumManager && !window.PremiumManager.__threePlanPatched) {
            window.PremiumManager.__threePlanPatched = true;
            window.PremiumManager.setPlan = function setPremiumManagerPlan(planId) {
                const selected = normalizePlan(planId);
                this.selectedPlan = selected;
                if (originalSetPlan && selected !== 'lifetime') {
                    try { originalSetPlan(selected); } catch (_) { }
                }
                updateSelectedPrice();
                return selected;
            };
            window.PremiumManager.upgradeToPremium = () => startCheckout('modern_paywall_cta');
        }

        if (window.IAPManager && !window.IAPManager.__threePlanPatched) {
            window.IAPManager.__threePlanPatched = true;
            const originalSimulate = typeof window.IAPManager.simulatePurchase === 'function'
                ? window.IAPManager.simulatePurchase.bind(window.IAPManager)
                : null;
            window.IAPManager.simulatePurchase = async function simulateSelectedPlanPurchase(productId = getProductId(getSelectedPlan())) {
                if (!originalSimulate) return false;
                this.__lastRequestedProductId = productId;
                const result = await originalSimulate(productId);
                const selected = PLAN_ORDER.find((planId) => getProductId(planId) === productId) || getSelectedPlan();
                const entitlement = {
                    productId,
                    plan: selected,
                    purchaseDate: new Date().toISOString(),
                    isSimulated: true,
                    expiresAt: selected === 'lifetime' ? null : undefined
                };
                this.entitlement = entitlement;
                localStorage.setItem('premium_entitlement', JSON.stringify(entitlement));
                localStorage.setItem('premium_plan', selected);
                return result;
            };
        }
    }

    const FREE_MONTHLY_TRANSACTION_LIMIT = 30;

    function readLimitStorage(key) {
        try {
            return localStorage.getItem(key);
        } catch (_) {
            return null;
        }
    }

    function safeParseLimitJson(raw, fallback = null) {
        if (!raw) return fallback;
        try {
            return JSON.parse(raw);
        } catch (_) {
            return fallback;
        }
    }

    function currentLimitMonth() {
        return new Date().toISOString().slice(0, 7);
    }

    function currentLimitYear() {
        try {
            if (typeof APP_YEAR !== 'undefined') return APP_YEAR;
        } catch (_) {}
        return new Date().getFullYear();
    }

    function isPremiumUserForLimit() {
        if (window.PremiumManager?.isPremium || window.userStatus === 'pro') return true;

        const statusValues = [
            readLimitStorage('user_status'),
            readLimitStorage('user_membership_status')
        ].filter(Boolean).map((value) => String(value).toLowerCase());

        if (statusValues.some((value) => value === 'pro' || value === 'premium')) return true;
        if (readLimitStorage('premium') === 'true') return true;

        const cache = safeParseLimitJson(readLimitStorage('premium_cache'));
        if (cache?.isPremium === true) return true;

        const entitlement = safeParseLimitJson(readLimitStorage('premium_entitlement'));
        if (!entitlement) return false;

        const hasEntitlement = entitlement.isPremium === true || !!entitlement.productId || !!entitlement.plan;
        const expiresAt = entitlement.expiresAt ? new Date(entitlement.expiresAt) : null;
        return hasEntitlement && (!expiresAt || expiresAt > new Date());
    }

    function normalizeTransactionDateForLimit(row) {
        const raw = row?.date || row?.createdAt || row?.timestamp || row?.time;
        if (!raw) return '';
        if (typeof raw === 'string') return raw.slice(0, 10);
        const parsed = new Date(raw);
        return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
    }

    function readTransactionRowsForLimit() {
        const rows = [];
        const seen = new Set();

        const addRows = (source, sourceName) => {
            if (!Array.isArray(source)) return;
            source.forEach((row, index) => {
                if (!row || typeof row !== 'object') return;
                const key = row.id || row.uuid || `${sourceName}:${row.date || ''}:${row.type || ''}:${row.amount || ''}:${row.description || row.note || ''}:${index}`;
                if (seen.has(key)) return;
                seen.add(key);
                rows.push(row);
            });
        };

        addRows(window.transactions, 'memory');
        addRows(safeParseLimitJson(readLimitStorage(`my_expenses_${currentLimitYear()}`), []), 'year');
        return rows;
    }

    function isCountableLimitTransaction(row) {
        const type = String(row?.type || '').toLowerCase();
        if (type !== 'income' && type !== 'expense') return false;
        return normalizeTransactionDateForLimit(row).startsWith(currentLimitMonth());
    }

    function getFreeMonthlyUsage() {
        return readTransactionRowsForLimit().filter(isCountableLimitTransaction).length;
    }

    function getFreeMonthlyRemaining() {
        return Math.max(0, FREE_MONTHLY_TRANSACTION_LIMIT - getFreeMonthlyUsage());
    }

    function isEditingTransactionNow() {
        const cancelEditButton = document.getElementById('cancel-edit-btn');
        return !!(cancelEditButton && !cancelEditButton.classList.contains('hidden'));
    }

    function canCreateFreeTransaction() {
        return isPremiumUserForLimit() || isEditingTransactionNow() || getFreeMonthlyUsage() < FREE_MONTHLY_TRANSACTION_LIMIT;
    }

    function openFreeLimitPaywall() {
        if (typeof window.openPremiumPaywall === 'function') {
            window.openPremiumPaywall('free_transaction_limit');
        } else if (typeof window.buyPremium === 'function') {
            window.buyPremium('free_transaction_limit');
        } else if (typeof window.upgradeToPro === 'function') {
            window.upgradeToPro('free_transaction_limit');
        }
    }

    async function showFreeTransactionLimitMessage() {
        const title = 'Ayl\u0131k kay\u0131t hakk\u0131n doldu';
        const message = `Free planda ayda ${FREE_MONTHLY_TRANSACTION_LIMIT} gelir/gider kayd\u0131 bulunur. Bu ay hakk\u0131n\u0131 tamamlad\u0131n. S\u0131n\u0131rs\u0131z kay\u0131t, raporlar ve Fingo Brain i\u00e7g\u00f6r\u00fcleri i\u00e7in Pro\u2019ya ge\u00e7ebilirsin.`;

        if (typeof window.confirmDialog === 'function') {
            const shouldUpgrade = await window.confirmDialog({
                title,
                message,
                confirmText: 'Pro\u2019ya Ge\u00e7',
                cancelText: 'Daha sonra',
                variant: 'blue'
            });
            if (shouldUpgrade) openFreeLimitPaywall();
            return;
        }

        if (typeof window.alertMessage === 'function') {
            window.alertMessage(title, message, 'blue');
            setTimeout(openFreeLimitPaywall, 450);
            return;
        }

        alert(`${title}\n\n${message}`);
        openFreeLimitPaywall();
    }

    function installFreeTransactionLimitGate() {
        if (window.__fingendaFreeTransactionLimitGateInstalling) return;
        window.__fingendaFreeTransactionLimitGateInstalling = true;

        const wrapSaveTransaction = () => {
            const currentSaveTransaction = window.saveTransaction;
            if (typeof currentSaveTransaction !== 'function') return false;
            if (currentSaveTransaction.__freeTransactionLimitWrapped) return true;

            const originalSaveTransaction = currentSaveTransaction;
            const guardedSaveTransaction = async function freeLimitedSaveTransaction(...args) {
                if (!canCreateFreeTransaction()) {
                    await showFreeTransactionLimitMessage();
                    return false;
                }
                return originalSaveTransaction.apply(this, args);
            };

            guardedSaveTransaction.__freeTransactionLimitWrapped = true;
            guardedSaveTransaction.__freeLimitOriginal = originalSaveTransaction;
            window.saveTransaction = guardedSaveTransaction;
            return true;
        };

        if (!wrapSaveTransaction()) {
            let attempts = 0;
            const timer = setInterval(() => {
                attempts += 1;
                if (wrapSaveTransaction() || attempts >= 30) {
                    clearInterval(timer);
                }
            }, 250);
        }
    }

    function boot() {
        injectStyles();
        setPlan(getSelectedPlan());
        patchManagers();
        patchOnboarding();
        installFreeTransactionLimitGate();
        renderPlanCards();
    }

    window.FingendaFreeLimit = Object.freeze({
        monthlyLimit: FREE_MONTHLY_TRANSACTION_LIMIT,
        getUsage: getFreeMonthlyUsage,
        getRemaining: getFreeMonthlyRemaining,
        canAddTransaction: canCreateFreeTransaction
    });

    window.FingendaPremiumPlans = Object.freeze({
        plans: PLAN_CONFIG,
        order: PLAN_ORDER.slice(),
        normalizePlan,
        getSelectedPlan,
        setPlan,
        render: renderPlanCards,
        getProductId,
        getPrice
    });
    window.getPremiumPlanProductId = getProductId;
    window.setPricingPlan = setPlan;
    window.startPremiumCheckout = startCheckout;
    window.upgradeToPro = () => startCheckout('legacy_paywall_cta');

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    window.addEventListener('languageChanged', () => {
        renderPlanCards();
        renderOnboardingPlans();
    });

    window.addEventListener('fingenda:performance-ready', () => {
        renderPlanCards();
        patchManagers();
        installFreeTransactionLimitGate();
    });
})();
