import WidgetKit
import SwiftUI
import Foundation

// MARK: - Deep Links
private enum WidgetDeepLinks {
    enum Route {
        case dashboard
        case savings
        case insights
        case transactionsMonthly
        case installments
        case agendaToday
        case netWorth
        case incomeExpense
        case custom(String)
    }

    static func url(for route: Route) -> URL {
        let raw: String
        switch route {
        case .dashboard:
            raw = "fingenda://dashboard"
        case .savings:
            raw = "fingenda://savings"
        case .insights:
            raw = "fingenda://insights"
        case .transactionsMonthly:
            raw = "fingenda://transactions?filter=monthly"
        case .installments:
            raw = "fingenda://installments"
        case .agendaToday:
            raw = "fingenda://agenda/today"
        case .netWorth:
            raw = "fingenda://networth"
        case .incomeExpense:
            raw = "fingenda://transactions?tab=income-expense"
        case .custom(let value):
            raw = value
        }
        return URL(string: raw) ?? URL(string: "fingenda://dashboard")!
    }
}

// MARK: - Shared Models
private struct WidgetTodayEvent: Codable, Hashable, Identifiable {
    let id: String
    let title: String
    let amount: Double
    let time: String
    let categoryIcon: String
    let deepLink: String

    var resolvedURL: URL {
        URL(string: deepLink) ?? WidgetDeepLinks.url(for: .agendaToday)
    }
}

private struct FingendaWidgetSnapshot: Codable, Hashable {
    let date: Date
    let netBalance: Double
    let monthlyIncome: Double
    let monthlyExpense: Double
    let remainingBudget: Double
    let savingsCurrent: Double
    let savingsTarget: Double
    let savingsProgress: Double
    let installmentCount: Int
    let installmentTotal: Double
    let todayEvents: [WidgetTodayEvent]
    let insightTitle: String
    let insightText: String
    let percentageChange: Double
    let currencyCode: String
    let themeMode: String
    let isPremium: Bool
    let lastUpdated: Date

    var hasAnyFinancialData: Bool {
        abs(netBalance) > 0.01
            || monthlyIncome > 0.01
            || monthlyExpense > 0.01
            || savingsCurrent > 0.01
            || installmentCount > 0
    }

    var hasInsight: Bool {
        !insightText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var normalizedSavingsProgress: Double {
        if savingsProgress > 1 {
            return clamp(savingsProgress / 100.0, min: 0, max: 1)
        }
        return clamp(savingsProgress, min: 0, max: 1)
    }

    var spendingPressure: Double {
        clamp(monthlyExpense / max(monthlyIncome, 1), min: 0, max: 2)
    }

    static let placeholder = FingendaWidgetSnapshot(
        date: Date(),
        netBalance: 24_800,
        monthlyIncome: 42_000,
        monthlyExpense: 17_200,
        remainingBudget: 9_600,
        savingsCurrent: 31_000,
        savingsTarget: 50_000,
        savingsProgress: 0.62,
        installmentCount: 2,
        installmentTotal: 4_800,
        todayEvents: [
            WidgetTodayEvent(
                id: "p1",
                title: "Kart Ekstresi",
                amount: 2_450,
                time: "20:00",
                categoryIcon: "creditcard.fill",
                deepLink: "fingenda://installments"
            ),
            WidgetTodayEvent(
                id: "p2",
                title: "Elektrik",
                amount: 690,
                time: "23:59",
                categoryIcon: "bolt.fill",
                deepLink: "fingenda://agenda/today"
            )
        ],
        insightTitle: "Nakit Akışı Dengeli",
        insightText: "Bu hafta gelir-gider dengen güçlü. Ulaşım harcamasını yüzde 8 azaltırsan hedefin hızlanır.",
        percentageChange: 8.4,
        currencyCode: "TRY",
        themeMode: "auto",
        isPremium: true,
        lastUpdated: Date()
    )

    static let empty = FingendaWidgetSnapshot(
        date: Date(),
        netBalance: 0,
        monthlyIncome: 0,
        monthlyExpense: 0,
        remainingBudget: 0,
        savingsCurrent: 0,
        savingsTarget: 0,
        savingsProgress: 0,
        installmentCount: 0,
        installmentTotal: 0,
        todayEvents: [],
        insightTitle: "",
        insightText: "",
        percentageChange: 0,
        currencyCode: "TRY",
        themeMode: "auto",
        isPremium: false,
        lastUpdated: Date()
    )
}

private enum FingendaWidgetState: String {
    case placeholder
    case loading
    case populated
    case empty
    case error
}

private struct FingendaWidgetLoadResult {
    let snapshot: FingendaWidgetSnapshot
    let state: FingendaWidgetState
}

// MARK: - Data Source (App Group)
private enum FingendaWidgetDataSource {
    private static let snapshotKeyCandidates = [
        "widget_snapshot_v2",
        "widget_snapshot_v1",
        "fingenda_widget_snapshot"
    ]

    private static let incomeKeys = ["widget_income_total", "income_total", "dashboard_income"]
    private static let expenseKeys = ["widget_expense_total", "expense_total", "dashboard_expense"]
    private static let netBalanceKeys = ["widget_net_balance", "net_balance"]
    private static let remainingBudgetKeys = ["widget_remaining_budget", "remaining_budget"]
    private static let savingsCurrentKeys = ["widget_savings_current", "widget_savings_total", "savings_total"]
    private static let savingsTargetKeys = ["widget_savings_target", "savings_target"]
    private static let savingsProgressKeys = ["widget_savings_progress", "widget_goal_progress", "goal_progress"]
    private static let installmentCountKeys = ["widget_installment_count", "installment_count"]
    private static let installmentTotalKeys = ["widget_installment_total", "installment_total"]
    private static let percentageChangeKeys = ["widget_percentage_change", "percentage_change"]
    private static let insightTitleKeys = ["widget_insight_title", "insight_title"]
    private static let insightTextKeys = ["widget_insight_text", "insight_text"]
    private static let currencyCodeKeys = ["widget_currency_code", "currency_code"]
    private static let themeModeKeys = ["widget_theme_mode", "theme_mode"]
    private static let premiumKeys = ["widget_is_premium", "is_premium", "premium_state"]

    static func load() -> FingendaWidgetLoadResult {
        let defaults = resolveDefaults()

        if let dictionary = readJSONSnapshot(from: defaults) {
            let snapshot = parseSnapshot(from: dictionary, fallbackDefaults: defaults)
            return FingendaWidgetLoadResult(
                snapshot: snapshot,
                state: snapshot.hasAnyFinancialData || !snapshot.todayEvents.isEmpty ? .populated : .empty
            )
        }

        let fallback = snapshotFromFlatKeys(defaults)
        if fallback.hasAnyFinancialData || !fallback.todayEvents.isEmpty {
            return FingendaWidgetLoadResult(snapshot: fallback, state: .populated)
        }
        return FingendaWidgetLoadResult(snapshot: fallback, state: .empty)
    }

    private static func resolveDefaults() -> UserDefaults {
        var candidates: [String] = []

        if let bundleId = Bundle.main.bundleIdentifier {
            let appBundleId = bundleId.replacingOccurrences(of: ".widget", with: "")
            if !appBundleId.isEmpty {
                candidates.append("group.\(appBundleId)")
            }
        }

        candidates.append("group.com.fingenda.app")
        candidates.append("group.com.fingenda")

        var seen = Set<String>()
        let unique = candidates.filter { seen.insert($0).inserted }

        return unique.compactMap { UserDefaults(suiteName: $0) }.first ?? UserDefaults.standard
    }

    private static func readJSONSnapshot(from defaults: UserDefaults) -> [String: Any]? {
        for key in snapshotKeyCandidates {
            guard let raw = defaults.string(forKey: key), !raw.isEmpty else { continue }
            guard let data = raw.data(using: .utf8) else { continue }
            guard let json = try? JSONSerialization.jsonObject(with: data, options: []),
                  let dict = json as? [String: Any] else { continue }
            return dict
        }
        return nil
    }

    private static func parseSnapshot(from dict: [String: Any], fallbackDefaults defaults: UserDefaults) -> FingendaWidgetSnapshot {
        let date = parseDate(dict["date"]) ?? Date()
        let monthlyIncome = number(dict["monthlyIncome"], fallback: number(dict["income"]))
        let monthlyExpense = number(dict["monthlyExpense"], fallback: number(dict["expense"]))

        let netBalance = number(
            dict["netBalance"],
            fallback: readNumber(defaults, keys: netBalanceKeys, fallback: monthlyIncome - monthlyExpense)
        )

        let savingsCurrent = number(
            dict["savingsCurrent"],
            fallback: number(dict["savings"], fallback: readNumber(defaults, keys: savingsCurrentKeys))
        )

        let rawProgress = number(
            dict["savingsProgress"],
            fallback: number(dict["goalProgress"], fallback: readNumber(defaults, keys: savingsProgressKeys))
        )

        let savingsTarget = number(
            dict["savingsTarget"],
            fallback: deriveSavingsTarget(current: savingsCurrent, progress: rawProgress, defaults: defaults)
        )

        let installmentCount = intValue(
            dict["installmentCount"],
            fallback: readInt(defaults, keys: installmentCountKeys)
        )

        let installmentTotal = number(
            dict["installmentTotal"],
            fallback: readNumber(defaults, keys: installmentTotalKeys)
        )

        let remainingBudget = number(
            dict["remainingBudget"],
            fallback: readNumber(defaults, keys: remainingBudgetKeys, fallback: monthlyIncome - monthlyExpense)
        )

        let events = parseEvents(dict["todayEvents"])
        let title = stringValue(
            dict["insightTitle"],
            fallback: readString(defaults, keys: insightTitleKeys, fallback: "Bugünün İçgörüsü")
        )
        let text = stringValue(
            dict["insightText"],
            fallback: readString(defaults, keys: insightTextKeys, fallback: "")
        )

        let currency = stringValue(
            dict["currencyCode"],
            fallback: readString(defaults, keys: currencyCodeKeys, fallback: "TRY")
        )

        let themeMode = stringValue(
            dict["themeMode"],
            fallback: readString(defaults, keys: themeModeKeys, fallback: "auto")
        )

        let isPremium = boolValue(
            dict["isPremium"],
            fallback: readBool(defaults, keys: premiumKeys)
        )

        let lastUpdated = parseDate(dict["lastUpdated"]) ?? parseDate(dict["updatedAt"]) ?? Date()
        let percentageChange = number(
            dict["percentageChange"],
            fallback: readNumber(defaults, keys: percentageChangeKeys)
        )

        return FingendaWidgetSnapshot(
            date: date,
            netBalance: netBalance,
            monthlyIncome: monthlyIncome,
            monthlyExpense: monthlyExpense,
            remainingBudget: remainingBudget,
            savingsCurrent: savingsCurrent,
            savingsTarget: savingsTarget,
            savingsProgress: rawProgress,
            installmentCount: installmentCount,
            installmentTotal: installmentTotal,
            todayEvents: events,
            insightTitle: title,
            insightText: text,
            percentageChange: percentageChange,
            currencyCode: currency.isEmpty ? "TRY" : currency,
            themeMode: themeMode.isEmpty ? "auto" : themeMode,
            isPremium: isPremium,
            lastUpdated: lastUpdated
        )
    }

    private static func snapshotFromFlatKeys(_ defaults: UserDefaults) -> FingendaWidgetSnapshot {
        let income = readNumber(defaults, keys: incomeKeys)
        let expense = readNumber(defaults, keys: expenseKeys)
        let net = readNumber(defaults, keys: netBalanceKeys, fallback: income - expense)
        let savingsCurrent = readNumber(defaults, keys: savingsCurrentKeys)
        let progress = readNumber(defaults, keys: savingsProgressKeys)
        let target = deriveSavingsTarget(current: savingsCurrent, progress: progress, defaults: defaults)

        return FingendaWidgetSnapshot(
            date: Date(),
            netBalance: net,
            monthlyIncome: income,
            monthlyExpense: expense,
            remainingBudget: readNumber(defaults, keys: remainingBudgetKeys, fallback: income - expense),
            savingsCurrent: savingsCurrent,
            savingsTarget: target,
            savingsProgress: progress,
            installmentCount: readInt(defaults, keys: installmentCountKeys),
            installmentTotal: readNumber(defaults, keys: installmentTotalKeys),
            todayEvents: parseEvents(defaults.string(forKey: "widget_today_events")),
            insightTitle: readString(defaults, keys: insightTitleKeys, fallback: "Bugünün İçgörüsü"),
            insightText: readString(defaults, keys: insightTextKeys, fallback: ""),
            percentageChange: readNumber(defaults, keys: percentageChangeKeys),
            currencyCode: readString(defaults, keys: currencyCodeKeys, fallback: "TRY"),
            themeMode: readString(defaults, keys: themeModeKeys, fallback: "auto"),
            isPremium: readBool(defaults, keys: premiumKeys),
            lastUpdated: parseDate(defaults.string(forKey: "widget_last_updated")) ?? Date()
        )
    }

    private static func deriveSavingsTarget(current: Double, progress: Double, defaults: UserDefaults) -> Double {
        let direct = readNumber(defaults, keys: savingsTargetKeys)
        if direct > 0 {
            return direct
        }

        let normalized: Double
        if progress > 1 {
            normalized = clamp(progress / 100.0, min: 0, max: 1)
        } else {
            normalized = clamp(progress, min: 0, max: 1)
        }

        if normalized > 0.01 {
            return max(current / normalized, current)
        }

        if current > 0 {
            return max(current * 1.5, current + 10_000)
        }

        return 0
    }

    private static func parseEvents(_ raw: Any?) -> [WidgetTodayEvent] {
        if let value = raw as? [WidgetTodayEvent] {
            return value
        }

        if let array = raw as? [[String: Any]] {
            return array.compactMap(parseEvent)
        }

        if let rawString = raw as? String,
           let data = rawString.data(using: .utf8),
           let json = try? JSONSerialization.jsonObject(with: data, options: []),
           let list = json as? [[String: Any]] {
            return list.compactMap(parseEvent)
        }

        return []
    }

    private static func parseEvent(_ dict: [String: Any]) -> WidgetTodayEvent? {
        let id = stringValue(dict["id"], fallback: UUID().uuidString)
        let title = stringValue(dict["title"], fallback: "Ödeme")
        let amount = number(dict["amount"])
        let time = stringValue(dict["time"], fallback: "--:--")
        let icon = stringValue(dict["categoryIcon"], fallback: "calendar")
        let deepLink = stringValue(dict["deepLink"], fallback: "fingenda://agenda/today")

        return WidgetTodayEvent(
            id: id,
            title: title,
            amount: amount,
            time: time,
            categoryIcon: icon,
            deepLink: deepLink
        )
    }

    private static func readNumber(_ defaults: UserDefaults, keys: [String], fallback: Double = 0) -> Double {
        for key in keys {
            if let number = defaults.object(forKey: key) as? NSNumber {
                return number.doubleValue
            }

            if let value = defaults.string(forKey: key) {
                let normalized = value.replacingOccurrences(of: ",", with: ".")
                if let parsed = Double(normalized) {
                    return parsed
                }
            }
        }

        return fallback
    }

    private static func readInt(_ defaults: UserDefaults, keys: [String]) -> Int {
        Int(readNumber(defaults, keys: keys))
    }

    private static func readString(_ defaults: UserDefaults, keys: [String], fallback: String = "") -> String {
        for key in keys {
            if let raw = defaults.string(forKey: key), !raw.isEmpty {
                return raw
            }
        }
        return fallback
    }

    private static func readBool(_ defaults: UserDefaults, keys: [String]) -> Bool {
        for key in keys {
            if let number = defaults.object(forKey: key) as? NSNumber {
                return number.boolValue
            }

            if let raw = defaults.string(forKey: key)?.lowercased() {
                if ["1", "true", "yes", "premium", "pro"].contains(raw) {
                    return true
                }
                if ["0", "false", "no", "free"].contains(raw) {
                    return false
                }
            }
        }
        return false
    }

    private static func number(_ value: Any?, fallback: Double = 0) -> Double {
        if let numeric = value as? NSNumber {
            return numeric.doubleValue
        }

        if let text = value as? String {
            let normalized = text.replacingOccurrences(of: ",", with: ".")
            return Double(normalized) ?? fallback
        }

        return fallback
    }

    private static func intValue(_ value: Any?, fallback: Int = 0) -> Int {
        if let numeric = value as? NSNumber {
            return numeric.intValue
        }

        if let text = value as? String, let parsed = Int(text) {
            return parsed
        }

        return fallback
    }

    private static func boolValue(_ value: Any?, fallback: Bool = false) -> Bool {
        if let bool = value as? Bool {
            return bool
        }
        if let number = value as? NSNumber {
            return number.boolValue
        }
        if let text = value as? String {
            let normalized = text.lowercased()
            if ["1", "true", "yes", "premium", "pro"].contains(normalized) {
                return true
            }
            if ["0", "false", "no", "free"].contains(normalized) {
                return false
            }
        }
        return fallback
    }

    private static func stringValue(_ value: Any?, fallback: String = "") -> String {
        if let text = value as? String, !text.isEmpty {
            return text
        }

        if let number = value as? NSNumber {
            return number.stringValue
        }

        return fallback
    }

    private static func parseDate(_ value: Any?) -> Date? {
        if let date = value as? Date {
            return date
        }

        if let text = value as? String {
            let formatter = ISO8601DateFormatter()
            if let parsed = formatter.date(from: text) {
                return parsed
            }

            let fallback = DateFormatter()
            fallback.locale = Locale(identifier: "tr_TR")
            fallback.dateFormat = "yyyy-MM-dd'T'HH:mm:ss"
            return fallback.date(from: text)
        }

        return nil
    }
}

// MARK: - Timeline
private struct FingendaWidgetEntry: TimelineEntry {
    let date: Date
    let snapshot: FingendaWidgetSnapshot
    let state: FingendaWidgetState

    var effectiveState: FingendaWidgetState {
        if state == .populated && !snapshot.hasAnyFinancialData && snapshot.todayEvents.isEmpty {
            return .empty
        }
        return state
    }
}

private struct FingendaWidgetProvider: TimelineProvider {
    func placeholder(in context: Context) -> FingendaWidgetEntry {
        FingendaWidgetEntry(date: Date(), snapshot: .placeholder, state: .placeholder)
    }

    func getSnapshot(in context: Context, completion: @escaping (FingendaWidgetEntry) -> Void) {
        if context.isPreview {
            completion(FingendaWidgetEntry(date: Date(), snapshot: .placeholder, state: .populated))
            return
        }

        let result = FingendaWidgetDataSource.load()
        completion(FingendaWidgetEntry(date: Date(), snapshot: result.snapshot, state: result.state))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<FingendaWidgetEntry>) -> Void) {
        let now = Date()
        let result = FingendaWidgetDataSource.load()
        let entry = FingendaWidgetEntry(date: now, snapshot: result.snapshot, state: result.state)
        let refresh = Calendar.current.date(byAdding: .minute, value: 30, to: now) ?? now.addingTimeInterval(1800)
        completion(Timeline(entries: [entry], policy: .after(refresh)))
    }
}

// MARK: - Formatting
private enum WidgetFormat {
    static func currency(_ value: Double, code: String = "TRY", compact: Bool = false) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.locale = Locale(identifier: "tr_TR")
        formatter.currencyCode = code.isEmpty ? "TRY" : code
        formatter.maximumFractionDigits = 0
        formatter.minimumFractionDigits = 0
        formatter.usesGroupingSeparator = true
        if compact {
            formatter.notANumberSymbol = "—"
        }
        return formatter.string(from: NSNumber(value: value)) ?? "₺0"
    }

    static func percent(_ value: Double, maxFractionDigits: Int = 1) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .percent
        formatter.locale = Locale(identifier: "tr_TR")
        formatter.maximumFractionDigits = maxFractionDigits
        formatter.minimumFractionDigits = 0
        return formatter.string(from: NSNumber(value: value / 100.0)) ?? "%0"
    }

    static func signedPercent(_ value: Double) -> String {
        let sign = value > 0 ? "+" : ""
        return "\(sign)\(percent(value, maxFractionDigits: 1))"
    }

    static func shortDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "tr_TR")
        formatter.dateFormat = "d MMM"
        return formatter.string(from: date)
    }
}

// MARK: - Theme
private struct WidgetTheme {
    let bgStart: Color
    let bgEnd: Color
    let glowTop: Color
    let glowBottom: Color
    let surface: Color
    let surfaceStrong: Color
    let border: Color
    let textPrimary: Color
    let textSecondary: Color
    let accentPrimary: Color
    let accentSecondary: Color
    let accentPositive: Color
    let accentWarning: Color
    let accentNegative: Color

    static func current(for scheme: ColorScheme) -> WidgetTheme {
        if scheme == .dark {
            return WidgetTheme(
                bgStart: Color(red: 0.04, green: 0.08, blue: 0.18),
                bgEnd: Color(red: 0.08, green: 0.11, blue: 0.24),
                glowTop: Color(red: 0.56, green: 0.46, blue: 1.0).opacity(0.26),
                glowBottom: Color(red: 0.30, green: 0.82, blue: 0.86).opacity(0.20),
                surface: Color.white.opacity(0.10),
                surfaceStrong: Color.white.opacity(0.16),
                border: Color.white.opacity(0.20),
                textPrimary: Color.white.opacity(0.98),
                textSecondary: Color.white.opacity(0.76),
                accentPrimary: Color(red: 0.52, green: 0.44, blue: 1.0),
                accentSecondary: Color(red: 0.36, green: 0.70, blue: 1.0),
                accentPositive: Color(red: 0.38, green: 0.89, blue: 0.72),
                accentWarning: Color(red: 0.97, green: 0.74, blue: 0.34),
                accentNegative: Color(red: 0.95, green: 0.45, blue: 0.55)
            )
        }

        return WidgetTheme(
            bgStart: Color(red: 0.92, green: 0.95, blue: 1.0),
            bgEnd: Color(red: 0.88, green: 0.92, blue: 1.0),
            glowTop: Color(red: 0.56, green: 0.48, blue: 1.0).opacity(0.18),
            glowBottom: Color(red: 0.30, green: 0.78, blue: 0.86).opacity(0.14),
            surface: Color.white.opacity(0.74),
            surfaceStrong: Color.white.opacity(0.90),
            border: Color.white.opacity(0.92),
            textPrimary: Color(red: 0.10, green: 0.16, blue: 0.30),
            textSecondary: Color(red: 0.30, green: 0.36, blue: 0.50).opacity(0.92),
            accentPrimary: Color(red: 0.40, green: 0.34, blue: 0.93),
            accentSecondary: Color(red: 0.24, green: 0.54, blue: 0.95),
            accentPositive: Color(red: 0.11, green: 0.72, blue: 0.58),
            accentWarning: Color(red: 0.90, green: 0.60, blue: 0.23),
            accentNegative: Color(red: 0.84, green: 0.34, blue: 0.44)
        )
    }
}

// MARK: - Shared UI Components
private struct WidgetSurface<Content: View>: View {
    @Environment(\.colorScheme) private var colorScheme
    let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        let theme = WidgetTheme.current(for: colorScheme)

        content
            .padding(14)
            .containerBackground(for: .widget) {
                ZStack {
                    LinearGradient(
                        colors: [theme.bgStart, theme.bgEnd],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )

                    RadialGradient(
                        colors: [theme.glowTop, .clear],
                        center: .topLeading,
                        startRadius: 4,
                        endRadius: 190
                    )

                    RadialGradient(
                        colors: [theme.glowBottom, .clear],
                        center: .bottomTrailing,
                        startRadius: 8,
                        endRadius: 180
                    )
                }
            }
    }
}

private struct WidgetGlassCard<Content: View>: View {
    @Environment(\.colorScheme) private var colorScheme
    let highlighted: Bool
    let tint: Color?
    let radius: CGFloat
    let content: Content

    init(
        highlighted: Bool = false,
        tint: Color? = nil,
        radius: CGFloat = 14,
        @ViewBuilder content: () -> Content
    ) {
        self.highlighted = highlighted
        self.tint = tint
        self.radius = radius
        self.content = content()
    }

    var body: some View {
        let theme = WidgetTheme.current(for: colorScheme)
        let glowColor = tint ?? theme.accentSecondary

        content
            .padding(10)
            .background(
                RoundedRectangle(cornerRadius: radius, style: .continuous)
                    .fill(highlighted ? theme.surfaceStrong : theme.surface)
                    .overlay(
                        RoundedRectangle(cornerRadius: radius, style: .continuous)
                            .stroke(theme.border, lineWidth: highlighted ? 1 : 0.8)
                    )
                    .shadow(
                        color: glowColor.opacity(highlighted ? (colorScheme == .dark ? 0.22 : 0.12) : 0.08),
                        radius: highlighted ? 8 : 3,
                        x: 0,
                        y: highlighted ? 4 : 1
                    )
            )
    }
}

private struct WidgetHeaderRow: View {
    @Environment(\.colorScheme) private var colorScheme
    let title: String
    let subtitle: String?
    let symbol: String
    let badge: String?

    var body: some View {
        let theme = WidgetTheme.current(for: colorScheme)

        HStack(alignment: .center, spacing: 8) {
            ZStack {
                Circle()
                    .fill(theme.surfaceStrong)
                    .overlay(Circle().stroke(theme.border, lineWidth: 0.8))
                Image(systemName: symbol)
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(theme.textPrimary)
            }
            .frame(width: 22, height: 22)

            VStack(alignment: .leading, spacing: 1) {
                Text(title)
                    .font(.system(size: 13, weight: .bold, design: .rounded))
                    .foregroundStyle(theme.textPrimary)
                    .lineLimit(1)
                if let subtitle, !subtitle.isEmpty {
                    Text(subtitle)
                        .font(.system(size: 10, weight: .medium, design: .rounded))
                        .foregroundStyle(theme.textSecondary)
                        .lineLimit(1)
                }
            }

            Spacer(minLength: 4)

            if let badge, !badge.isEmpty {
                Text(badge)
                    .font(.system(size: 9, weight: .bold, design: .rounded))
                    .foregroundStyle(theme.textSecondary)
                    .padding(.horizontal, 7)
                    .padding(.vertical, 4)
                    .background(
                        Capsule(style: .continuous)
                            .fill(theme.surfaceStrong)
                    )
            }
        }
    }
}

private struct PremiumBadgeView: View {
    @Environment(\.colorScheme) private var colorScheme
    let text: String

    var body: some View {
        let theme = WidgetTheme.current(for: colorScheme)

        HStack(spacing: 4) {
            Image(systemName: "sparkles")
                .font(.system(size: 8, weight: .bold))
            Text(text)
                .font(.system(size: 9, weight: .bold, design: .rounded))
        }
        .foregroundStyle(theme.textPrimary)
        .padding(.horizontal, 7)
        .padding(.vertical, 4)
        .background(
            Capsule(style: .continuous)
                .fill(
                    LinearGradient(
                        colors: [theme.accentPrimary.opacity(0.72), theme.accentSecondary.opacity(0.72)],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
                .overlay(
                    Capsule(style: .continuous)
                        .stroke(theme.border, lineWidth: 0.7)
                )
        )
    }
}

private struct ProgressRingView: View {
    @Environment(\.colorScheme) private var colorScheme
    let progress: Double
    let size: CGFloat
    let lineWidth: CGFloat

    var body: some View {
        let theme = WidgetTheme.current(for: colorScheme)
        let normalized = clamp(progress, min: 0, max: 1)

        ZStack {
            Circle()
                .stroke(theme.surfaceStrong, lineWidth: lineWidth)

            Circle()
                .trim(from: 0, to: normalized)
                .stroke(
                    LinearGradient(
                        colors: [theme.accentSecondary, theme.accentPrimary, theme.accentPositive],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    style: StrokeStyle(lineWidth: lineWidth, lineCap: .round, lineJoin: .round)
                )
                .rotationEffect(.degrees(-90))

            Text(WidgetFormat.percent(normalized * 100, maxFractionDigits: 0))
                .font(.system(size: size * 0.18, weight: .heavy, design: .rounded))
                .foregroundStyle(theme.textPrimary)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
        .frame(width: size, height: size)
    }
}

private struct MiniComparisonBars: View {
    @Environment(\.colorScheme) private var colorScheme
    let income: Double
    let expense: Double

    var body: some View {
        let maxValue = max(income, expense, 1)
        let incomeRatio = clamp(income / maxValue, min: 0.06, max: 1)
        let expenseRatio = clamp(expense / maxValue, min: 0.06, max: 1)

        VStack(alignment: .leading, spacing: 6) {
            bar(label: "Gelir", ratio: incomeRatio, color: WidgetTheme.current(for: colorScheme).accentPositive)
            bar(label: "Gider", ratio: expenseRatio, color: WidgetTheme.current(for: colorScheme).accentNegative)
        }
    }

    private func bar(label: String, ratio: Double, color: Color) -> some View {
        let theme = WidgetTheme.current(for: colorScheme)

        return HStack(spacing: 6) {
            Text(label)
                .font(.system(size: 9, weight: .bold, design: .rounded))
                .foregroundStyle(theme.textSecondary)
                .frame(width: 30, alignment: .leading)

            GeometryReader { proxy in
                ZStack(alignment: .leading) {
                    Capsule(style: .continuous)
                        .fill(theme.surface)
                    Capsule(style: .continuous)
                        .fill(color)
                        .frame(width: max(8, proxy.size.width * ratio))
                }
            }
            .frame(height: 6)
        }
    }
}

private struct EventRowView: View {
    @Environment(\.colorScheme) private var colorScheme
    let event: WidgetTodayEvent
    let currencyCode: String

    var body: some View {
        let theme = WidgetTheme.current(for: colorScheme)

        Link(destination: event.resolvedURL) {
            HStack(spacing: 6) {
                Image(systemName: event.categoryIcon)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(theme.textPrimary)
                    .frame(width: 16)

                VStack(alignment: .leading, spacing: 1) {
                    Text(event.title)
                        .font(.system(size: 10, weight: .bold, design: .rounded))
                        .foregroundStyle(theme.textPrimary)
                        .lineLimit(1)

                    Text(event.time)
                        .font(.system(size: 9, weight: .medium, design: .rounded))
                        .foregroundStyle(theme.textSecondary)
                        .lineLimit(1)
                }

                Spacer(minLength: 4)

                Text(WidgetFormat.currency(event.amount, code: currencyCode, compact: true))
                    .font(.system(size: 10, weight: .semibold, design: .rounded))
                    .foregroundStyle(theme.textPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
            }
            .padding(.vertical, 4)
            .padding(.horizontal, 6)
            .background(
                RoundedRectangle(cornerRadius: 9, style: .continuous)
                    .fill(theme.surface)
            )
        }
        .buttonStyle(.plain)
    }
}

private struct WidgetStateView: View {
    @Environment(\.colorScheme) private var colorScheme
    let state: FingendaWidgetState

    var body: some View {
        let theme = WidgetTheme.current(for: colorScheme)

        switch state {
        case .placeholder, .loading:
            VStack(alignment: .leading, spacing: 8) {
                RoundedRectangle(cornerRadius: 6, style: .continuous)
                    .fill(theme.surfaceStrong)
                    .frame(height: 12)
                RoundedRectangle(cornerRadius: 6, style: .continuous)
                    .fill(theme.surface)
                    .frame(height: 12)
                RoundedRectangle(cornerRadius: 6, style: .continuous)
                    .fill(theme.surface)
                    .frame(width: 80, height: 12)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        case .empty:
            message(
                title: "Henuz veri yok",
                text: "Ilk islemini eklediginde widget otomatik guncellenecek.",
                symbol: "tray"
            )
        case .error:
            message(
                title: "Veri okunamadi",
                text: "Uygulamayi acip tekrar dene.",
                symbol: "exclamationmark.triangle"
            )
        case .populated:
            EmptyView()
        }
    }

    private func message(title: String, text: String, symbol: String) -> some View {
        let theme = WidgetTheme.current(for: colorScheme)

        return VStack(alignment: .leading, spacing: 8) {
            Label(title, systemImage: symbol)
                .font(.system(size: 12, weight: .bold, design: .rounded))
                .foregroundStyle(theme.textPrimary)

            Text(text)
                .font(.system(size: 10, weight: .medium, design: .rounded))
                .foregroundStyle(theme.textSecondary)
                .lineLimit(3)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

private struct MetricTile: View {
    @Environment(\.colorScheme) private var colorScheme
    let title: String
    let value: String
    let tint: Color

    var body: some View {
        let theme = WidgetTheme.current(for: colorScheme)

        WidgetGlassCard(highlighted: false, tint: tint, radius: 11) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: 9, weight: .semibold, design: .rounded))
                    .foregroundStyle(theme.textSecondary)
                    .lineLimit(1)
                Text(value)
                    .font(.system(size: 13, weight: .heavy, design: .rounded))
                    .foregroundStyle(theme.textPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

// MARK: - Widget Views
private struct SmallNetCashWidgetView: View {
    let entry: FingendaWidgetEntry
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        let theme = WidgetTheme.current(for: colorScheme)

        WidgetSurface {
            VStack(alignment: .leading, spacing: 10) {
                WidgetHeaderRow(
                    title: "Net Nakit",
                    subtitle: "Bu Ay",
                    symbol: "wallet.pass.fill",
                    badge: entry.effectiveState == .populated ? "Canli" : "Hazir"
                )

                if entry.effectiveState == .populated {
                    WidgetGlassCard(highlighted: true, tint: theme.accentSecondary) {
                        VStack(alignment: .leading, spacing: 3) {
                            Text(WidgetFormat.currency(entry.snapshot.netBalance, code: entry.snapshot.currencyCode))
                                .font(.system(size: 24, weight: .heavy, design: .rounded))
                                .foregroundStyle(theme.textPrimary)
                                .lineLimit(1)
                                .minimumScaleFactor(0.65)
                            Text("\(WidgetFormat.signedPercent(entry.snapshot.percentageChange)) bu ay")
                                .font(.system(size: 10, weight: .semibold, design: .rounded))
                                .foregroundStyle(entry.snapshot.percentageChange >= 0 ? theme.accentPositive : theme.accentNegative)
                                .lineLimit(1)
                        }
                    }

                    WidgetGlassCard(highlighted: false, tint: theme.accentPrimary, radius: 11) {
                        HStack(spacing: 8) {
                            Text("Kalan Bütçe")
                                .font(.system(size: 10, weight: .semibold, design: .rounded))
                                .foregroundStyle(theme.textSecondary)
                            Spacer(minLength: 4)
                            Text(WidgetFormat.currency(entry.snapshot.remainingBudget, code: entry.snapshot.currencyCode))
                                .font(.system(size: 10, weight: .bold, design: .rounded))
                                .foregroundStyle(theme.textPrimary)
                                .lineLimit(1)
                        }
                    }
                } else {
                    WidgetStateView(state: entry.effectiveState)
                }
            }
        }
        .widgetURL(WidgetDeepLinks.url(for: .netWorth))
    }
}

private struct SmallSavingsGoalWidgetView: View {
    let entry: FingendaWidgetEntry
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        let theme = WidgetTheme.current(for: colorScheme)

        WidgetSurface {
            VStack(alignment: .leading, spacing: 10) {
                WidgetHeaderRow(
                    title: "Birikim Hedefi",
                    subtitle: "Kumbara",
                    symbol: "target",
                    badge: nil
                )

                if entry.effectiveState == .populated {
                    HStack(spacing: 10) {
                        ProgressRingView(
                            progress: entry.snapshot.normalizedSavingsProgress,
                            size: 64,
                            lineWidth: 8
                        )

                        VStack(alignment: .leading, spacing: 4) {
                            Text(WidgetFormat.currency(entry.snapshot.savingsCurrent, code: entry.snapshot.currencyCode))
                                .font(.system(size: 14, weight: .heavy, design: .rounded))
                                .foregroundStyle(theme.textPrimary)
                                .lineLimit(1)

                            Text("/ \(WidgetFormat.currency(entry.snapshot.savingsTarget, code: entry.snapshot.currencyCode))")
                                .font(.system(size: 10, weight: .semibold, design: .rounded))
                                .foregroundStyle(theme.textSecondary)
                                .lineLimit(1)

                            Text("Hedef ilerlemesi")
                                .font(.system(size: 9, weight: .medium, design: .rounded))
                                .foregroundStyle(theme.textSecondary)
                                .lineLimit(1)
                        }
                    }

                    WidgetGlassCard(highlighted: false, tint: theme.accentPositive, radius: 11) {
                        Text("Yüzde \(WidgetFormat.percent(entry.snapshot.normalizedSavingsProgress * 100, maxFractionDigits: 0)) tamamlandı")
                            .font(.system(size: 10, weight: .semibold, design: .rounded))
                            .foregroundStyle(theme.textPrimary)
                            .lineLimit(1)
                    }
                } else {
                    WidgetStateView(state: entry.effectiveState)
                }
            }
        }
        .widgetURL(WidgetDeepLinks.url(for: .savings))
    }
}

private struct MediumIncomeExpenseWidgetView: View {
    let entry: FingendaWidgetEntry
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        let theme = WidgetTheme.current(for: colorScheme)

        WidgetSurface {
            VStack(alignment: .leading, spacing: 9) {
                WidgetHeaderRow(
                    title: "Gelir / Gider",
                    subtitle: "Bu Ay",
                    symbol: "chart.bar.xaxis",
                    badge: WidgetFormat.shortDate(entry.snapshot.lastUpdated)
                )

                if entry.effectiveState == .populated {
                    HStack(spacing: 8) {
                        MetricTile(
                            title: "Toplam Gelir",
                            value: WidgetFormat.currency(entry.snapshot.monthlyIncome, code: entry.snapshot.currencyCode),
                            tint: theme.accentPositive
                        )

                        MetricTile(
                            title: "Toplam Gider",
                            value: WidgetFormat.currency(entry.snapshot.monthlyExpense, code: entry.snapshot.currencyCode),
                            tint: theme.accentNegative
                        )
                    }

                    WidgetGlassCard(highlighted: true, tint: theme.accentSecondary, radius: 12) {
                        VStack(alignment: .leading, spacing: 7) {
                            MiniComparisonBars(
                                income: entry.snapshot.monthlyIncome,
                                expense: entry.snapshot.monthlyExpense
                            )
                            Text(summaryText)
                                .font(.system(size: 10, weight: .semibold, design: .rounded))
                                .foregroundStyle(theme.textSecondary)
                                .lineLimit(2)
                        }
                    }
                } else {
                    WidgetStateView(state: entry.effectiveState)
                }
            }
        }
        .widgetURL(WidgetDeepLinks.url(for: .incomeExpense))
    }

    private var summaryText: String {
        let change = entry.snapshot.percentageChange
        if change >= 0 {
            return "Geçen aya göre \(WidgetFormat.signedPercent(change)) artış."
        }
        return "Geçen aya göre \(WidgetFormat.signedPercent(change)) düşüş."
    }
}

private struct MediumInsightWidgetView: View {
    let entry: FingendaWidgetEntry
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        let theme = WidgetTheme.current(for: colorScheme)

        WidgetSurface {
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .top) {
                    WidgetHeaderRow(
                        title: "Bugünün İçgörüsü",
                        subtitle: "Fingenda AI",
                        symbol: "brain.head.profile",
                        badge: nil
                    )
                    if entry.snapshot.isPremium {
                        PremiumBadgeView(text: "PRO")
                    }
                }

                if entry.effectiveState == .populated {
                    WidgetGlassCard(highlighted: true, tint: theme.accentPrimary, radius: 13) {
                        VStack(alignment: .leading, spacing: 5) {
                            Text(entry.snapshot.isPremium ? entry.snapshot.insightTitle : "Pro İçgörüsü")
                                .font(.system(size: 13, weight: .bold, design: .rounded))
                                .foregroundStyle(theme.textPrimary)
                                .lineLimit(1)

                            Text(insightBody)
                                .font(.system(size: 11, weight: .medium, design: .rounded))
                                .foregroundStyle(theme.textSecondary)
                                .lineLimit(3)
                                .minimumScaleFactor(0.85)
                        }
                    }

                    HStack(spacing: 8) {
                        MetricTile(
                            title: "Basinc",
                            value: WidgetFormat.percent(entry.snapshot.spendingPressure * 50, maxFractionDigits: 0),
                            tint: theme.accentWarning
                        )
                        MetricTile(
                            title: "Birikim",
                            value: WidgetFormat.percent(entry.snapshot.normalizedSavingsProgress * 100, maxFractionDigits: 0),
                            tint: theme.accentPositive
                        )
                    }
                } else {
                    WidgetStateView(state: entry.effectiveState)
                }
            }
        }
        .widgetURL(WidgetDeepLinks.url(for: .insights))
    }

    private var insightBody: String {
        if entry.snapshot.isPremium {
            let content = entry.snapshot.insightText.trimmingCharacters(in: .whitespacesAndNewlines)
            return content.isEmpty
                ? "İçgörü için biraz daha veri gerekli."
                : content
        }

        return "AI içgörülerini açmak için premium ile detaylı önerileri görebilirsin."
    }
}

private struct LargeSummaryWidgetView: View {
    let entry: FingendaWidgetEntry
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        let theme = WidgetTheme.current(for: colorScheme)

        WidgetSurface {
            VStack(alignment: .leading, spacing: 10) {
                WidgetHeaderRow(
                    title: "Premium Günlük Özet",
                    subtitle: "Finans + Ajanda",
                    symbol: "sparkles.rectangle.stack.fill",
                    badge: WidgetFormat.shortDate(entry.snapshot.lastUpdated)
                )

                if entry.effectiveState == .populated {
                    HStack(alignment: .top, spacing: 10) {
                        leftColumn(theme: theme)
                        rightColumn(theme: theme)
                    }
                } else {
                    WidgetStateView(state: entry.effectiveState)
                }
            }
        }
        .widgetURL(WidgetDeepLinks.url(for: .dashboard))
    }

    private func leftColumn(theme: WidgetTheme) -> some View {
        VStack(spacing: 8) {
            WidgetGlassCard(highlighted: true, tint: theme.accentSecondary, radius: 13) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Net Nakit")
                        .font(.system(size: 10, weight: .semibold, design: .rounded))
                        .foregroundStyle(theme.textSecondary)
                    Text(WidgetFormat.currency(entry.snapshot.netBalance, code: entry.snapshot.currencyCode))
                        .font(.system(size: 18, weight: .heavy, design: .rounded))
                        .foregroundStyle(theme.textPrimary)
                        .lineLimit(1)
                }
            }

            HStack(spacing: 7) {
                MetricTile(
                    title: "Birikim",
                    value: WidgetFormat.currency(entry.snapshot.savingsCurrent, code: entry.snapshot.currencyCode),
                    tint: theme.accentPositive
                )
                MetricTile(
                    title: "Taksit",
                    value: "\(entry.snapshot.installmentCount) adet",
                    tint: theme.accentWarning
                )
            }

            MetricTile(
                title: "Kalan Bütçe",
                value: WidgetFormat.currency(entry.snapshot.remainingBudget, code: entry.snapshot.currencyCode),
                tint: theme.accentPrimary
            )
        }
        .frame(maxWidth: .infinity)
    }

    private func rightColumn(theme: WidgetTheme) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            WidgetGlassCard(highlighted: false, tint: theme.accentPrimary, radius: 13) {
                VStack(alignment: .leading, spacing: 5) {
                    HStack {
                        Text("Bugun")
                            .font(.system(size: 11, weight: .bold, design: .rounded))
                            .foregroundStyle(theme.textPrimary)
                        Spacer(minLength: 4)
                        Text("\(entry.snapshot.todayEvents.count) kayıt")
                            .font(.system(size: 9, weight: .semibold, design: .rounded))
                            .foregroundStyle(theme.textSecondary)
                    }

                    if entry.snapshot.todayEvents.isEmpty {
                        Text("Bugün ödeme görünmüyor.")
                            .font(.system(size: 10, weight: .medium, design: .rounded))
                            .foregroundStyle(theme.textSecondary)
                            .lineLimit(2)
                    } else {
                        ForEach(entry.snapshot.todayEvents.prefix(3)) { event in
                            EventRowView(event: event, currencyCode: entry.snapshot.currencyCode)
                        }
                    }
                }
            }

            WidgetGlassCard(highlighted: true, tint: theme.accentSecondary, radius: 13) {
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 5) {
                        Image(systemName: "brain.head.profile")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(theme.accentSecondary)
                        Text("İçgörü")
                            .font(.system(size: 11, weight: .bold, design: .rounded))
                            .foregroundStyle(theme.textPrimary)
                        Spacer(minLength: 4)
                        if entry.snapshot.isPremium {
                            PremiumBadgeView(text: "PRO")
                        }
                    }

                    Text(entry.snapshot.hasInsight ? entry.snapshot.insightText : "İçgörü için biraz daha veri gerekli.")
                        .font(.system(size: 10, weight: .medium, design: .rounded))
                        .foregroundStyle(theme.textSecondary)
                        .lineLimit(3)
                }
            }
        }
        .frame(maxWidth: .infinity)
    }
}

private struct AccessoryBudgetWidgetView: View {
    let entry: FingendaWidgetEntry
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        let theme = WidgetTheme.current(for: colorScheme)

        HStack(alignment: .center, spacing: 8) {
            Image(systemName: "calendar.badge.clock")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(theme.textPrimary)

            VStack(alignment: .leading, spacing: 2) {
                Text("Bugün \(entry.snapshot.todayEvents.count) ödeme")
                    .font(.system(size: 11, weight: .bold, design: .rounded))
                    .lineLimit(1)

                Text("Kalan bütçe \(WidgetFormat.currency(entry.snapshot.remainingBudget, code: entry.snapshot.currencyCode))")
                    .font(.system(size: 10, weight: .medium, design: .rounded))
                    .lineLimit(1)
            }
        }
        .foregroundStyle(theme.textPrimary)
    }
}

// MARK: - Widget Definitions
private struct FingendaSmallNetCashWidget: Widget {
    let kind = "FingendaSmallNetCashWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: FingendaWidgetProvider()) { entry in
            SmallNetCashWidgetView(entry: entry)
        }
        .configurationDisplayName("Net Nakit")
        .description("Aylık net durumunu tek bakışta gör.")
        .supportedFamilies([.systemSmall])
    }
}

private struct FingendaSmallSavingsGoalWidget: Widget {
    let kind = "FingendaSmallSavingsGoalWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: FingendaWidgetProvider()) { entry in
            SmallSavingsGoalWidgetView(entry: entry)
        }
        .configurationDisplayName("Birikim Hedefi")
        .description("Hedef ilerlemeni halka progress ile takip et.")
        .supportedFamilies([.systemSmall])
    }
}

private struct FingendaMediumIncomeExpenseWidget: Widget {
    let kind = "FingendaMediumIncomeExpenseWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: FingendaWidgetProvider()) { entry in
            MediumIncomeExpenseWidgetView(entry: entry)
        }
        .configurationDisplayName("Gelir / Gider")
        .description("Bu ayın finans dengesini mini karşılaştırma ile izle.")
        .supportedFamilies([.systemMedium])
    }
}

private struct FingendaMediumInsightWidget: Widget {
    let kind = "FingendaMediumInsightWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: FingendaWidgetProvider()) { entry in
            MediumInsightWidgetView(entry: entry)
        }
        .configurationDisplayName("Bugünün İçgörüsü")
        .description("Fingenda AI ile kisa ve anlamli finans onerileri.")
        .supportedFamilies([.systemMedium])
    }
}

private struct FingendaLargeDailySummaryWidget: Widget {
    let kind = "FingendaLargeDailySummaryWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: FingendaWidgetProvider()) { entry in
            LargeSummaryWidgetView(entry: entry)
        }
        .configurationDisplayName("Premium Günlük Özet")
        .description("Net nakit, birikim, taksit ve bugünün ajandasını birlikte gör.")
        .supportedFamilies([.systemLarge])
    }
}

private struct FingendaAccessoryBudgetWidget: Widget {
    let kind = "FingendaAccessoryBudgetWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: FingendaWidgetProvider()) { entry in
            AccessoryBudgetWidgetView(entry: entry)
        }
        .configurationDisplayName("Bugün Bütçe")
        .description("Kilitte kalan bütçe ve bugünkü ödeme sayısı.")
        .supportedFamilies([.accessoryRectangular])
    }
}

@main
struct FingendaWidgetBundle: WidgetBundle {
    var body: some Widget {
        FingendaSmallNetCashWidget()
        FingendaSmallSavingsGoalWidget()
        FingendaMediumIncomeExpenseWidget()
        FingendaMediumInsightWidget()
        FingendaLargeDailySummaryWidget()
        FingendaAccessoryBudgetWidget()
    }
}

// MARK: - Previews
#if DEBUG
private extension FingendaWidgetEntry {
    static let previewPopulated = FingendaWidgetEntry(
        date: Date(),
        snapshot: .placeholder,
        state: .populated
    )

    static let previewEmpty = FingendaWidgetEntry(
        date: Date(),
        snapshot: .empty,
        state: .empty
    )

    static let previewLoading = FingendaWidgetEntry(
        date: Date(),
        snapshot: .placeholder,
        state: .loading
    )
}

struct FingendaWidget_Previews: PreviewProvider {
    static var previews: some View {
        Group {
            SmallNetCashWidgetView(entry: .previewPopulated)
                .previewContext(WidgetPreviewContext(family: .systemSmall))

            SmallSavingsGoalWidgetView(entry: .previewPopulated)
                .previewContext(WidgetPreviewContext(family: .systemSmall))

            MediumIncomeExpenseWidgetView(entry: .previewPopulated)
                .previewContext(WidgetPreviewContext(family: .systemMedium))

            MediumInsightWidgetView(entry: .previewLoading)
                .previewContext(WidgetPreviewContext(family: .systemMedium))

            LargeSummaryWidgetView(entry: .previewEmpty)
                .previewContext(WidgetPreviewContext(family: .systemLarge))
        }
    }
}
#endif

private func clamp(_ value: Double, min lower: Double, max upper: Double) -> Double {
    Swift.max(lower, Swift.min(upper, value))
}
