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
            return "Piyasa Ekranı"
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
            return "Kumbaraya hızlı katkı yap"
        case .todaySummary:
            return "Bugünkü finans özetini göster"
        case .recentExpenses:
            return "Son harcamaları aç"
        case .fingoBrain:
            return "AI finans asistanını aç"
        case .market:
            return "Döviz ve piyasa ekranını aç"
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
            return "Fingenda not aç"
        case .goalContribution:
            return "Fingenda hedefe katkı"
        case .todaySummary:
            return "Fingenda bugün özetim"
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
            activity.suggestedInvocationPhrase = action.invocationPhrase
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
        console.warn('[generate-ios-system-actions] didFinishLaunchingWithOptions not found; skipping lifecycle patch.');
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
        console.warn('[generate-ios-system-actions] continue userActivity handler not found; leaving proxy handler untouched.');
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
    console.log('[generate-ios-system-actions] AppDelegate.swift not found, skipping.');
    process.exit(0);
}

let source = fs.readFileSync(APP_DELEGATE, 'utf8');
source = patchDidFinishLaunching(source);
source = patchContinueUserActivity(source);
source = upsertMarkedBlock(source, START_MARKER, END_MARKER, extensionBlock);

fs.writeFileSync(APP_DELEGATE, source, 'utf8');
console.log('[generate-ios-system-actions] iOS system actions patched successfully.');
