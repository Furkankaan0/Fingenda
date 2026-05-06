/**
 * Lightweight release quality checks for Fingenda web assets.
 *
 * This script intentionally stays dependency-free so it can run in Codemagic,
 * local Windows shells, and quick pre-push checks without setup cost.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function read(file) {
    return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function assertIncludes(fileLabel, content, needle) {
    assert(content.includes(needle), `${fileLabel} missing required contract: ${needle}`);
}

function countMatches(content, pattern) {
    return (content.match(pattern) || []).length;
}

function checkCoreRuntimeWiring() {
    const buildScript = read('scripts/build.js');
    const index = read('index.html');
    const core = read('fingenda-core.js');
    const packageJson = read('package.json');

    assert(buildScript.includes("'fingenda-core.js'"), 'fingenda-core.js is missing from build COPY_LIST.');
    assert(buildScript.includes("'fingenda-performance-guard.js'"), 'fingenda-performance-guard.js is missing from build COPY_LIST.');
    assert(index.includes('src="fingenda-core.js"'), 'index.html does not load fingenda-core.js.');
    assert(index.includes('src="fingenda-performance-guard.js"'), 'index.html does not load fingenda-performance-guard.js.');
    assert(core.includes('window.FingendaCore'), 'fingenda-core.js does not expose window.FingendaCore.');

    const buildConfigIndex = index.indexOf('src="build-config.js"');
    const coreIndex = index.indexOf('src="fingenda-core.js"');
    const perfGuardIndex = index.indexOf('src="fingenda-performance-guard.js"');
    const dnaRuntimeIndex = index.indexOf('src="./dna-performance-runtime.js"');
    assert(buildConfigIndex >= 0 && coreIndex > buildConfigIndex, 'fingenda-core.js must load after build-config.js.');
    assert(perfGuardIndex > coreIndex, 'fingenda-performance-guard.js must load after fingenda-core.js.');
    assert(dnaRuntimeIndex > perfGuardIndex, 'dna-performance-runtime.js must load after fingenda-performance-guard.js.');
    assert(dnaRuntimeIndex > coreIndex, 'dna-performance-runtime.js must load after fingenda-core.js.');

    ['safeJsonParse', 'storage', 'money', 'events', 'perf', 'getCategoryIcon', 'getSmartIcon'].forEach((contract) => {
        assertIncludes('fingenda-core.js', core, contract);
    });
    assert(packageJson.includes('"check:release"'), 'package.json is missing npm run check:release.');
}

function checkPerformanceGuardContracts() {
    const guard = read('fingenda-performance-guard.js');

    [
        'window.FingendaPerformanceGuard',
        'PerformanceObserver',
        "'longtask'",
        'requestIdleCallback',
        "root.classList.add('perf')",
        "root.classList.add('perf2')",
        'scheduleIdle',
        'scheduleFrame',
        'low-device-budget',
        'reduced-motion'
    ].forEach((contract) => {
        assertIncludes('fingenda-performance-guard.js', guard, contract);
    });
}

function checkPremiumPlanContracts() {
    const buildScript = read('scripts/build.js');
    const index = read('index.html');
    const premiumPlans = read('fingenda-premium-plans.js');

    assert(buildScript.includes("'fingenda-premium-plans.js'"), 'fingenda-premium-plans.js is missing from build COPY_LIST.');
    assert(index.includes('src="fingenda-premium-plans.js"'), 'index.html does not load fingenda-premium-plans.js.');

    const premiumIndex = index.indexOf('src="fingenda-premium-plans.js"');
    const dnaRuntimeIndex = index.indexOf('src="./dna-performance-runtime.js"');
    assert(premiumIndex > dnaRuntimeIndex, 'fingenda-premium-plans.js must load after legacy premium/runtime patches.');

    [
        'window.FingendaPremiumPlans',
        'window.getPremiumPlanProductId',
        'window.startPremiumCheckout',
        'window.setPricingPlan',
        'com.fingenda.premium.monthly',
        'com.fingenda.premium.yearly',
        'com.fingenda.premium.lifetime',
        "fallbackPrice: '₺49,99'",
        "fallbackPrice: '₺399,99'",
        "PLAN_ORDER = ['monthly', 'yearly', 'lifetime']",
        'fo-premium-plan-strip',
        'premium-plan-grid-v2',
        'premium-plan-card-v2',
        "productKey: 'LIFETIME'",
        "expiresAt: selected === 'lifetime' ? null : undefined"
    ].forEach((contract) => {
        assertIncludes('fingenda-premium-plans.js', premiumPlans, contract);
    });
}

function checkReleaseReadinessContracts() {
    const buildScript = read('scripts/build.js');
    const codemagic = read('codemagic.yaml');
    const index = read('index.html');
    const premiumPlans = read('fingenda-premium-plans.js');

    assert(
        !buildScript.includes("buildChannel === 'testflight'"),
        'TestFlight must not enable premium bypass by default.'
    );
    assert(
        !codemagic.includes('FINGENDA_TEST_PREMIUM_BYPASS: "true"'),
        'Codemagic workflows must not ship with premium bypass enabled.'
    );

    [
        'Demo veri',
        'Test Bildirimi',
        'Test Notification',
        '[DEV] Premium',
        '[DEV] Simulating purchase'
    ].forEach((blockedText) => {
        assert(!index.includes(blockedText), `Release UI contains blocked test/dev text: ${blockedText}`);
    });

    [
        'FREE_MONTHLY_TRANSACTION_LIMIT = 30',
        'window.FingendaFreeLimit',
        'free_transaction_limit',
        '__freeTransactionLimitWrapped',
        'canAddTransaction'
    ].forEach((contract) => {
        assertIncludes('fingenda-premium-plans.js free limit', premiumPlans, contract);
    });
}

function checkCategoryIconFallbacks() {
    const dnaRuntime = read('dna-performance-runtime.js');

    assert(
        !dnaRuntime.includes("categoryEmojis[category] || '📌'"),
        'Spending DNA category fallback regressed to the pin icon.'
    );
    assert(
        !dnaRuntime.includes("|| '📌'"),
        'Spending DNA contains a direct pin fallback.'
    );
    assert(
        dnaRuntime.includes('window.FingendaCore'),
        'Spending DNA runtime should use FingendaCore for shared category icon logic.'
    );
}

function checkWidgetSnapshotContract() {
    const index = read('index.html');
    const widgetSwift = read('scripts/widget-template/FingendaWidget.swift');

    const payloadFields = [
        'monthlyIncome',
        'monthlyExpense',
        'dailyIncome',
        'dailyExpense',
        'dailyBalance',
        'savingsCurrent',
        'savingsTarget',
        'savingsProgress',
        'goalTitle',
        'goalTargetDate',
        'installmentTitle',
        'installmentNextDueDate',
        'todayEvents',
        'usdTry',
        'eurTry',
        'gramGoldTry',
        'usdChange',
        'eurChange',
        'gramGoldChange'
    ];

    payloadFields.forEach((field) => {
        assertIncludes('index.html widget payload', index, field);
    });

    const sharedKeys = [
        'widget_income_total',
        'widget_expense_total',
        'widget_daily_income',
        'widget_daily_expense',
        'widget_daily_balance',
        'widget_savings_total',
        'widget_goal_title',
        'widget_goal_target_date',
        'widget_installment_title',
        'widget_installment_next_due_date',
        'widget_fx_usd_try',
        'widget_fx_eur_try',
        'widget_fx_gram_try',
        'widget_today_events',
        'fingenda_widget_snapshot'
    ];

    sharedKeys.forEach((key) => {
        assertIncludes('index.html widget shared keys', index, key);
    });

    const swiftContracts = [
        'let goalTitle: String',
        'let goalTargetDate: Date?',
        'let dailyIncome: Double',
        'let dailyExpense: Double',
        'let dailyBalance: Double',
        'let installmentTitle: String',
        'let installmentNextDueDate: Date?',
        'let usdTry: Double',
        'let eurTry: Double',
        'let gramGoldTry: Double',
        'private static let goalTitleKeys',
        'private static let dailyIncomeKeys',
        'private static let dailyExpenseKeys',
        'private static let dailyBalanceKeys',
        'private static let installmentTitleKeys',
        'private static let usdTryKeys',
        'private static let eurTryKeys',
        'private static let gramGoldTryKeys',
        'ReferenceWidgetData.recentItem(from: entry.snapshot)'
    ];

    swiftContracts.forEach((contract) => {
        assertIncludes('FingendaWidget.swift', widgetSwift, contract);
    });

    const blockedLiveWidgetDemoValues = [
        'Yurt Dışı Seyahati',
        'Yurt Disi Seyahati',
        'Taşıt Kredisi',
        'Tasit Kredisi',
        '15 Haz 2025',
        '30 Eylül 2025',
        '30 Eylul 2025',
        'recent-coffee'
    ];

    blockedLiveWidgetDemoValues.forEach((value) => {
        assert(!widgetSwift.includes(value), `Widget template contains blocked live demo value: ${value}`);
    });

    assert(
        !widgetSwift.includes('snapshot.todayEvents.first ?? WidgetTodayEvent'),
        'Recent widget must not synthesize fake transaction rows when no app data exists.'
    );
    assert(
        widgetSwift.includes('ReferenceEmptyState(') && widgetSwift.includes('Henüz kayıt yok'),
        'Recent widget should show an empty state when there are no real todayEvents.'
    );
    assert(
        widgetSwift.includes('hasMonthlyIncomeExpenseData') &&
        widgetSwift.includes('entry.snapshot.monthlyIncome') &&
        widgetSwift.includes('entry.snapshot.monthlyExpense') &&
        widgetSwift.includes('entry.snapshot.monthlyBalance'),
        'Monthly income/expense widget must use current-month totals.'
    );
}

function checkWidgetSigningContracts() {
    const signingScript = read('scripts/apply-ios-widget-signing.js');
    const codemagic = read('codemagic.yaml');

    [
        'const APP_GROUP_ID = `group.${APP_BUNDLE_ID}`',
        'parseAppGroups',
        'profileSupportsExpectedAppGroup',
        'Widget verisi calismasi icin App Group zorunlu',
        'CODE_SIGN_ENTITLEMENTS',
        'com.apple.ApplicationGroups.iOS'
    ].forEach((contract) => {
        assertIncludes('apply-ios-widget-signing.js', signingScript, contract);
    });

    const checkCount = countMatches(codemagic, /npm run check:release/g);
    assert(checkCount >= 2, 'codemagic.yaml should run npm run check:release in both iOS workflows.');

    const firstBuildAssets = codemagic.indexOf('- name: Build web assets');
    const firstQualityCheck = codemagic.indexOf('- name: Release quality checks');
    const firstIpaBuild = codemagic.indexOf('- name: Build signed IPA');
    assert(firstBuildAssets >= 0 && firstQualityCheck > firstBuildAssets, 'Release quality checks should run after web build.');
    assert(firstIpaBuild > firstQualityCheck, 'Release quality checks should run before signed IPA build.');
}

function checkNativeSwiftFoundation() {
    const installer = read('scripts/install-ios-native-foundation.js');
    const nativeSwift = read('scripts/native-swift/FingendaNativeFoundation.swift');
    const codemagic = read('codemagic.yaml');
    const packageJson = read('package.json');

    [
        'FingendaNativeFoundation.swift',
        'configureXcodeProject',
        'app_target.source_build_phase.add_file_reference',
        'Swift migration foundation kurulumu tamamlandi'
    ].forEach((contract) => {
        assertIncludes('install-ios-native-foundation.js', installer, contract);
    });

    [
        'struct FingendaNativeSnapshot',
        'final class FingendaNativeStore',
        'struct FingendaNativeDashboardView',
        'final class FingendaNativeHostViewController',
        'monthlyIncome',
        'monthlyExpense',
        'monthlyBalance',
        'group.com.fingenda.app'
    ].forEach((contract) => {
        assertIncludes('FingendaNativeFoundation.swift', nativeSwift, contract);
    });

    [
        '.ignoresSafeArea(',
        '.task {',
        '.foregroundStyle(',
        '.ultraThinMaterial',
        '.background(.'
    ].forEach((forbiddenApi) => {
        assert(!nativeSwift.includes(forbiddenApi), `FingendaNativeFoundation.swift must stay iOS 13-safe; found ${forbiddenApi}`);
    });

    assertIncludes('package.json', packageJson, '"ios:native-foundation"');

    const nativeStepCount = countMatches(codemagic, /Install iOS native Swift foundation/g);
    assert(nativeStepCount >= 2, 'codemagic.yaml should install the native Swift foundation in both iOS workflows.');
}

function main() {
    checkCoreRuntimeWiring();
    checkPerformanceGuardContracts();
    checkPremiumPlanContracts();
    checkReleaseReadinessContracts();
    checkCategoryIconFallbacks();
    checkWidgetSnapshotContract();
    checkWidgetSigningContracts();
    checkNativeSwiftFoundation();
    console.log('[QUALITY] Fingenda release checks passed');
}

main();
