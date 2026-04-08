const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const APP_DELEGATE = path.join(ROOT, 'ios', 'App', 'App', 'AppDelegate.swift');

const START_MARKER = '// FINGENDA_SYSTEM_ACTIONS_BEGIN';
const END_MARKER = '// FINGENDA_SYSTEM_ACTIONS_END';

const extensionBlock = `
${START_MARKER}
private enum FingendaSystemAction: String, CaseIterable {
    case addExpense = "add-expense"
    case addIncome = "add-income"
    case quickNote = "quick-note"
    case goalContribution = "goal-contribution"
    case todaySummary = "today-summary"
    case recentExpenses = "recent-expenses"
    case fingoBrain = "fingo-brain"
    case market = "market"
    case voiceAdd = "voice-add"
    case receiptScan = "receipt-scan"

    private static let prefix = "com.fingenda.app.action."

    var activityType: String {
        Self.prefix + rawValue
    }

    var deepLink: String {
        switch self {
        case .addExpense:
            return "fingenda://action/add-expense?source=shortcut"
        case .addIncome:
            return "fingenda://action/add-income?source=shortcut"
        case .quickNote:
            return "fingenda://action/quick-note?source=shortcut"
        case .goalContribution:
            return "fingenda://action/goal-contribution?source=shortcut"
        case .todaySummary:
            return "fingenda://action/today-summary?source=shortcut"
        case .recentExpenses:
            return "fingenda://action/recent-expenses?source=shortcut"
        case .fingoBrain:
            return "fingenda://action/fingo-brain?source=shortcut"
        case .market:
            return "fingenda://action/market?source=shortcut"
        case .voiceAdd:
            return "fingenda://action/voice-add?source=shortcut"
        case .receiptScan:
            return "fingenda://action/receipt-scan?source=shortcut"
        }
    }

    var shortcutTitle: String {
        switch self {
        case .addExpense:
            return "Yeni Gider"
        case .addIncome:
            return "Yeni Gelir"
        case .quickNote:
            return "Hızlı Not"
        case .goalContribution:
            return "Hedefe Katkı"
        case .todaySummary:
            return "Bugün Özeti"
        case .recentExpenses:
            return "Son Harcamalar"
        case .fingoBrain:
            return "Fingo Brain"
        case .market:
            return "Piyasa"
        case .voiceAdd:
            return "Sesli Ekle"
        case .receiptScan:
            return "Fiş Tara"
        }
    }

    var shortcutSubtitle: String {
        switch self {
        case .addExpense:
            return "Gider formunu aç"
        case .addIncome:
            return "Gelir formunu aç"
        case .quickNote:
            return "Yeni not başlat"
        case .goalContribution:
            return "Hedef kumbarasına katkı yap"
        case .todaySummary:
            return "Bugünkü özeti göster"
        case .recentExpenses:
            return "Son harcamaları aç"
        case .fingoBrain:
            return "AI finans asistanını aç"
        case .market:
            return "Piyasa ekranını aç"
        case .voiceAdd:
            return "Sesli işlem eklemeyi başlat"
        case .receiptScan:
            return "Fiş tarama akışını başlat"
        }
    }

    var invocationPhrase: String {
        switch self {
        case .addExpense:
            return "Fingenda ile gider ekle"
        case .addIncome:
            return "Fingenda ile gelir ekle"
        case .quickNote:
            return "Fingenda ile hızlı not"
        case .goalContribution:
            return "Fingenda ile hedefe katkı"
        case .todaySummary:
            return "Fingenda bugün özeti"
        case .recentExpenses:
            return "Fingenda son harcamalar"
        case .fingoBrain:
            return "Fingo Brain'i aç"
        case .market:
            return "Fingenda piyasa ekranı"
        case .voiceAdd:
            return "Fingenda sesli ekle"
        case .receiptScan:
            return "Fingenda fiş tara"
        }
    }

    var iconName: String {
        switch self {
        case .addExpense:
            return "minus.circle.fill"
        case .addIncome:
            return "plus.circle.fill"
        case .quickNote:
            return "square.and.pencil"
        case .goalContribution:
            return "target"
        case .todaySummary:
            return "chart.bar.fill"
        case .recentExpenses:
            return "clock.arrow.circlepath"
        case .fingoBrain:
            return "brain.head.profile"
        case .market:
            return "chart.line.uptrend.xyaxis"
        case .voiceAdd:
            return "waveform"
        case .receiptScan:
            return "doc.text.viewfinder"
        }
    }

    static var quickActionItems: [UIApplicationShortcutItem] {
        [
            FingendaSystemAction.addExpense,
            FingendaSystemAction.addIncome,
            FingendaSystemAction.quickNote,
            FingendaSystemAction.todaySummary
        ].map { action in
            UIApplicationShortcutItem(
                type: action.activityType,
                localizedTitle: action.shortcutTitle,
                localizedSubtitle: action.shortcutSubtitle,
                icon: UIApplicationShortcutIcon(systemImageName: action.iconName),
                userInfo: ["fingendaURL": action.deepLink as NSSecureCoding]
            )
        }
    }

    static func from(type: String) -> FingendaSystemAction? {
        allCases.first { action in
            action.activityType == type || action.rawValue == type
        }
    }
}

/*
@available(iOS 17.0, *)
private protocol FingendaShortcutIntent: AppIntent {
    var action: FingendaSystemAction { get }
    var urlParameters: [URLQueryItem] { get }
    var successMessage: String { get }
}

@available(iOS 17.0, *)
extension FingendaShortcutIntent {
    static var openAppWhenRun: Bool { true }
    static var authenticationPolicy: IntentAuthenticationPolicy { .requiresUnlock }

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        guard var components = URLComponents(string: action.deepLink) else {
            return .result(dialog: IntentDialog("Aksiyon şu anda başlatılamadı."))
        }

        let safeParameters = urlParameters.filter { !($0.value ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
        components.queryItems = (components.queryItems ?? []) + safeParameters

        guard let url = components.url else {
            return .result(dialog: IntentDialog("Aksiyon şu anda başlatılamadı."))
        }

        UIApplication.shared.open(url)
        return .result(dialog: IntentDialog(successMessage))
    }
}

@available(iOS 17.0, *)
struct FingendaAddExpenseIntent: FingendaShortcutIntent {
    static var title: LocalizedStringResource = "Yeni Gider"
    static var description = IntentDescription("Yeni gider kaydı başlatır ve işlem formunu açar.")

    @Parameter(title: "Tutar")
    var amount: Double?

    @Parameter(title: "Kategori")
    var category: String?

    @Parameter(title: "Açıklama")
    var note: String?

    var action: FingendaSystemAction { .addExpense }

    var urlParameters: [URLQueryItem] {
        var items: [URLQueryItem] = []
        if let amount {
            items.append(URLQueryItem(name: "amount", value: String(format: "%.2f", amount)))
        }
        if let category {
            items.append(URLQueryItem(name: "category", value: category))
        }
        if let note {
            items.append(URLQueryItem(name: "note", value: note))
        }
        return items
    }

    var successMessage: String { "Gider formu hazır." }
}

@available(iOS 17.0, *)
struct FingendaAddIncomeIntent: FingendaShortcutIntent {
    static var title: LocalizedStringResource = "Yeni Gelir"
    static var description = IntentDescription("Yeni gelir kaydı başlatır ve işlem formunu açar.")

    @Parameter(title: "Tutar")
    var amount: Double?

    @Parameter(title: "Kategori")
    var category: String?

    @Parameter(title: "Açıklama")
    var note: String?

    var action: FingendaSystemAction { .addIncome }

    var urlParameters: [URLQueryItem] {
        var items: [URLQueryItem] = []
        if let amount {
            items.append(URLQueryItem(name: "amount", value: String(format: "%.2f", amount)))
        }
        if let category {
            items.append(URLQueryItem(name: "category", value: category))
        }
        if let note {
            items.append(URLQueryItem(name: "note", value: note))
        }
        return items
    }

    var successMessage: String { "Gelir formu hazır." }
}

@available(iOS 17.0, *)
struct FingendaQuickNoteIntent: FingendaShortcutIntent {
    static var title: LocalizedStringResource = "Hızlı Not"
    static var description = IntentDescription("Not ekranını açar ve hızlı not başlatır.")

    @Parameter(title: "Başlık")
    var noteTitle: String?

    @Parameter(title: "İçerik")
    var content: String?

    var action: FingendaSystemAction { .quickNote }

    var urlParameters: [URLQueryItem] {
        var items: [URLQueryItem] = []
        if let noteTitle {
            items.append(URLQueryItem(name: "title", value: noteTitle))
        }
        if let content {
            items.append(URLQueryItem(name: "content", value: content))
        }
        return items
    }

    var successMessage: String { "Not akışı açıldı." }
}

@available(iOS 17.0, *)
struct FingendaGoalContributionIntent: FingendaShortcutIntent {
    static var title: LocalizedStringResource = "Hedefe Katkı"
    static var description = IntentDescription("Hedef kumbarası ekranını açar ve hızlı katkı akışını başlatır.")

    @Parameter(title: "Tutar")
    var amount: Double?

    var action: FingendaSystemAction { .goalContribution }

    var urlParameters: [URLQueryItem] {
        guard let amount else { return [] }
        return [URLQueryItem(name: "amount", value: String(format: "%.2f", amount))]
    }

    var successMessage: String { "Hedef katkı akışı açıldı." }
}

@available(iOS 17.0, *)
struct FingendaTodaySummaryIntent: FingendaShortcutIntent {
    static var title: LocalizedStringResource = "Bugün Özeti"
    static var description = IntentDescription("Dashboard ekranını açar ve bugünkü finans özetini gösterir.")

    var action: FingendaSystemAction { .todaySummary }
    var urlParameters: [URLQueryItem] { [] }
    var successMessage: String { "Bugünün özeti açıldı." }
}

@available(iOS 17.0, *)
struct FingendaOpenMarketIntent: FingendaShortcutIntent {
    static var title: LocalizedStringResource = "Piyasa Ekranı"
    static var description = IntentDescription("Döviz ve piyasa ekranını açar.")

    var action: FingendaSystemAction { .market }
    var urlParameters: [URLQueryItem] { [] }
    var successMessage: String { "Piyasa ekranı açıldı." }
}

@available(iOS 17.0, *)
struct FingendaOpenBrainIntent: FingendaShortcutIntent {
    static var title: LocalizedStringResource = "Fingo Brain"
    static var description = IntentDescription("AI finans asistanı ekranını açar.")

    var action: FingendaSystemAction { .fingoBrain }
    var urlParameters: [URLQueryItem] { [] }
    var successMessage: String { "Fingo Brain açıldı." }
}

@available(iOS 17.0, *)
struct FingendaShortcutsProvider: AppShortcutsProvider {
    static var shortcutTileColor: ShortcutTileColor { .teal }

    static var appShortcuts: [AppShortcut] {
        [
            AppShortcut(
                intent: FingendaAddExpenseIntent(),
                phrases: ["\\(.applicationName) ile gider ekle", "\\(.applicationName) gider kaydı başlat"],
                shortTitle: "Yeni Gider",
                systemImageName: "minus.circle.fill"
            ),
            AppShortcut(
                intent: FingendaAddIncomeIntent(),
                phrases: ["\\(.applicationName) ile gelir ekle", "\\(.applicationName) gelir kaydı başlat"],
                shortTitle: "Yeni Gelir",
                systemImageName: "plus.circle.fill"
            ),
            AppShortcut(
                intent: FingendaQuickNoteIntent(),
                phrases: ["\\(.applicationName) ile hızlı not oluştur", "\\(.applicationName) not aç"],
                shortTitle: "Hızlı Not",
                systemImageName: "square.and.pencil"
            ),
            AppShortcut(
                intent: FingendaGoalContributionIntent(),
                phrases: ["\\(.applicationName) ile hedefe katkı yap"],
                shortTitle: "Hedefe Katkı",
                systemImageName: "target"
            ),
            AppShortcut(
                intent: FingendaTodaySummaryIntent(),
                phrases: ["\\(.applicationName) bugün özeti", "\\(.applicationName) günlük özet"],
                shortTitle: "Bugün Özeti",
                systemImageName: "chart.bar.fill"
            ),
            AppShortcut(
                intent: FingendaOpenMarketIntent(),
                phrases: ["\\(.applicationName) piyasa ekranı", "\\(.applicationName) döviz ekranı"],
                shortTitle: "Piyasa",
                systemImageName: "chart.line.uptrend.xyaxis"
            ),
            AppShortcut(
                intent: FingendaOpenBrainIntent(),
                phrases: ["\\(.applicationName) Fingo Brain", "\\(.applicationName) AI asistanını aç"],
                shortTitle: "Fingo Brain",
                systemImageName: "brain.head.profile"
            )
        ]
    }
}
*/
extension AppDelegate {
    fileprivate func fingendaConfigureSystemActions(application: UIApplication, launchOptions: [UIApplication.LaunchOptionsKey: Any]?) {
        application.shortcutItems = FingendaSystemAction.quickActionItems
        fingendaDonateSystemActivitiesIfNeeded()

        if let shortcutItem = launchOptions?[.shortcutItem] as? UIApplicationShortcutItem {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.45) { [weak self] in
                _ = self?.fingendaRouteShortcutItem(shortcutItem, application: application)
            }
        }
    }

    fileprivate func fingendaDonateSystemActivitiesIfNeeded() {
        let defaults = UserDefaults.standard
        let bundleVersion = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "1"
        let marker = "fingenda.system.actions.donated.\\(bundleVersion)"

        guard defaults.bool(forKey: marker) == false else {
            return
        }

        FingendaSystemAction.allCases.forEach { action in
            let activity = NSUserActivity(activityType: action.activityType)
            activity.title = action.shortcutTitle
            activity.isEligibleForSearch = true
            activity.isEligibleForPrediction = true
            activity.userInfo = ["fingendaURL": action.deepLink]
            activity.persistentIdentifier = NSUserActivityPersistentIdentifier(action.activityType)
            activity.becomeCurrent()
            activity.invalidate()
        }

        defaults.set(true, forKey: marker)
    }

    fileprivate func fingendaHandleUserActivity(_ userActivity: NSUserActivity, application: UIApplication) -> Bool {
        if let action = FingendaSystemAction.from(type: userActivity.activityType) {
            return fingendaOpenDeepLink(action.deepLink, application: application)
        }

        if let urlString = userActivity.userInfo?["fingendaURL"] as? String {
            return fingendaOpenDeepLink(urlString, application: application)
        }

        return false
    }

    fileprivate func fingendaRouteShortcutItem(_ shortcutItem: UIApplicationShortcutItem, application: UIApplication) -> Bool {
        if let urlString = shortcutItem.userInfo?["fingendaURL"] as? String {
            return fingendaOpenDeepLink(urlString, application: application)
        }

        guard let action = FingendaSystemAction.from(type: shortcutItem.type) else {
            return false
        }

        return fingendaOpenDeepLink(action.deepLink, application: application)
    }

    fileprivate func fingendaOpenDeepLink(_ urlString: String, application: UIApplication) -> Bool {
        guard let url = URL(string: urlString) else {
            return false
        }

        DispatchQueue.main.async {
            application.open(url, options: [:], completionHandler: nil)
        }

        return true
    }

    func application(_ application: UIApplication, performActionFor shortcutItem: UIApplicationShortcutItem, completionHandler: @escaping (Bool) -> Void) {
        completionHandler(fingendaRouteShortcutItem(shortcutItem, application: application))
    }
}
${END_MARKER}
`;

function upsertMarkedBlock(source, startMarker, endMarker, block) {
    if (source.includes(startMarker) && source.includes(endMarker)) {
        const pattern = new RegExp(`${startMarker}[\\s\\S]*?${endMarker}`, 'm');
        return source.replace(pattern, block.trim());
    }

    return `${source.trimEnd()}\n\n${block.trim()}\n`;
}

function patchDidFinishLaunching(source) {
    const pattern = /func application\(\s*_ application: UIApplication,\s*didFinishLaunchingWithOptions launchOptions: \[UIApplication\.LaunchOptionsKey: Any\]\?\)\s*-> Bool \{([\s\S]*?)return true(\s*\n\s*\})/m;

    if (!pattern.test(source)) {
        console.warn('[generate-ios-system-actions-v2] didFinishLaunchingWithOptions not found; skipping lifecycle patch.');
        return source;
    }

    return source.replace(pattern, (match, body, suffix) => {
        if (body.includes('fingendaConfigureSystemActions(application: application, launchOptions: launchOptions)')) {
            return match;
        }

        const trimmedBody = body.replace(/\s*$/, '\n');
        return `func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {${trimmedBody}        fingendaConfigureSystemActions(application: application, launchOptions: launchOptions)\n        return true${suffix}`;
    });
}

function patchContinueUserActivity(source) {
    const pattern = /func application\(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping \(\[UIUserActivityRestoring\]\?\) -> Void\) -> Bool \{([\s\S]*?)\n\s*return ApplicationDelegateProxy\.shared\.application\(application, continue: userActivity, restorationHandler: restorationHandler\)\n\s*\}/m;

    if (!pattern.test(source)) {
        console.warn('[generate-ios-system-actions-v2] continue userActivity handler not found; leaving proxy handler untouched.');
        return source;
    }

    return source.replace(pattern, (match, body) => {
        if (body.includes('fingendaHandleUserActivity(userActivity, application: application)')) {
            return match;
        }

        return `func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {${body}\n        if fingendaHandleUserActivity(userActivity, application: application) {\n            return true\n        }\n        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)\n    }`;
    });
}

if (!fs.existsSync(APP_DELEGATE)) {
    console.log('[generate-ios-system-actions-v2] AppDelegate.swift not found, skipping.');
    process.exit(0);
}

let source = fs.readFileSync(APP_DELEGATE, 'utf8');
source = patchDidFinishLaunching(source);
source = patchContinueUserActivity(source);
source = upsertMarkedBlock(source, START_MARKER, END_MARKER, extensionBlock);

fs.writeFileSync(APP_DELEGATE, source, 'utf8');
console.log('[generate-ios-system-actions-v2] iOS system actions patched successfully.');
