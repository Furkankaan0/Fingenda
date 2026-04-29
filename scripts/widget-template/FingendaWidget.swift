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
    let goalTitle: String
    let goalTargetDate: Date?
    let installmentCount: Int
    let installmentTotal: Double
    let installmentTitle: String
    let installmentPaidCount: Int
    let installmentTotalCount: Int
    let installmentNextDueDate: Date?
    let installmentProgress: Double
    let todayEvents: [WidgetTodayEvent]
    let insightTitle: String
    let insightText: String
    let percentageChange: Double
    let currencyCode: String
    let themeMode: String
    let isPremium: Bool
    let lastUpdated: Date
    let usdTry: Double
    let eurTry: Double
    let gramGoldTry: Double
    let usdChange: Double
    let eurChange: Double
    let gramGoldChange: Double

    var hasMarketData: Bool {
        usdTry > 0.01 || eurTry > 0.01 || gramGoldTry > 0.01
    }

    var hasAnyFinancialData: Bool {
        abs(netBalance) > 0.01
            || monthlyIncome > 0.01
            || monthlyExpense > 0.01
            || savingsCurrent > 0.01
            || savingsTarget > 0.01
            || !goalTitle.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            || installmentCount > 0
            || installmentTotalCount > 0
            || !installmentTitle.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            || hasMarketData
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

    var hasSavingsGoal: Bool {
        savingsTarget > 0.01
            || savingsCurrent > 0.01
            || !goalTitle.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var hasInstallmentPlan: Bool {
        installmentCount > 0
            || installmentTotal > 0.01
            || installmentTotalCount > 0
            || !installmentTitle.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var sanitizedInstallmentNextDueDate: Date? {
        guard let dueDate = installmentNextDueDate else { return nil }
        let today = Calendar.current.startOfDay(for: Date())
        let normalized = Calendar.current.startOfDay(for: dueDate)
        return normalized >= today ? dueDate : nil
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
        goalTitle: "Acil Durum Fonu",
        goalTargetDate: Calendar.current.date(byAdding: .month, value: 4, to: Date()),
        installmentCount: 2,
        installmentTotal: 4_800,
        installmentTitle: "Kredi Kartı",
        installmentPaidCount: 5,
        installmentTotalCount: 12,
        installmentNextDueDate: Calendar.current.date(byAdding: .day, value: 12, to: Date()),
        installmentProgress: 0.42,
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
        lastUpdated: Date(),
        usdTry: 32.25,
        eurTry: 35.10,
        gramGoldTry: 2_410.50,
        usdChange: 0.32,
        eurChange: 0.41,
        gramGoldChange: 0.28
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
        goalTitle: "",
        goalTargetDate: nil,
        installmentCount: 0,
        installmentTotal: 0,
        installmentTitle: "",
        installmentPaidCount: 0,
        installmentTotalCount: 0,
        installmentNextDueDate: nil,
        installmentProgress: 0,
        todayEvents: [],
        insightTitle: "",
        insightText: "",
        percentageChange: 0,
        currencyCode: "TRY",
        themeMode: "auto",
        isPremium: false,
        lastUpdated: Date(),
        usdTry: 0,
        eurTry: 0,
        gramGoldTry: 0,
        usdChange: 0,
        eurChange: 0,
        gramGoldChange: 0
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
    private static let goalTitleKeys = ["widget_goal_title", "goal_title", "savings_goal_title"]
    private static let goalTargetDateKeys = ["widget_goal_target_date", "goal_target_date", "savings_goal_target_date"]
    private static let installmentCountKeys = ["widget_installment_count", "installment_count"]
    private static let installmentTotalKeys = ["widget_installment_total", "installment_total"]
    private static let installmentTitleKeys = ["widget_installment_title", "installment_title"]
    private static let installmentPaidCountKeys = ["widget_installment_paid_count", "installment_paid_count"]
    private static let installmentTotalCountKeys = ["widget_installment_total_count", "installment_total_count"]
    private static let installmentNextDueDateKeys = ["widget_installment_next_due_date", "installment_next_due_date"]
    private static let installmentProgressKeys = ["widget_installment_progress", "installment_progress"]
    private static let percentageChangeKeys = ["widget_percentage_change", "percentage_change"]
    private static let insightTitleKeys = ["widget_insight_title", "insight_title"]
    private static let insightTextKeys = ["widget_insight_text", "insight_text"]
    private static let currencyCodeKeys = ["widget_currency_code", "currency_code"]
    private static let themeModeKeys = ["widget_theme_mode", "theme_mode"]
    private static let premiumKeys = ["widget_is_premium", "is_premium", "premium_state"]
    private static let usdTryKeys = ["widget_fx_usd_try", "fx_usd_try", "usd_try", "usdTry"]
    private static let eurTryKeys = ["widget_fx_eur_try", "fx_eur_try", "eur_try", "eurTry"]
    private static let gramGoldTryKeys = ["widget_fx_gram_try", "fx_gram_try", "gram_try", "gramTry", "gramGoldTry"]
    private static let usdChangeKeys = ["widget_fx_usd_change", "fx_usd_change", "usd_change", "usdChange"]
    private static let eurChangeKeys = ["widget_fx_eur_change", "fx_eur_change", "eur_change", "eurChange"]
    private static let gramGoldChangeKeys = ["widget_fx_gram_change", "fx_gram_change", "gram_change", "gramChange", "gramGoldChange"]

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

        let goalTitle = stringValue(
            dict["goalTitle"],
            fallback: readString(defaults, keys: goalTitleKeys)
        )

        let goalTargetDate = parseDate(dict["goalTargetDate"])
            ?? parseDate(readString(defaults, keys: goalTargetDateKeys))

        let installmentCount = intValue(
            dict["installmentCount"],
            fallback: readInt(defaults, keys: installmentCountKeys)
        )

        let installmentTotal = number(
            dict["installmentTotal"],
            fallback: readNumber(defaults, keys: installmentTotalKeys)
        )

        let installmentTitle = stringValue(
            dict["installmentTitle"],
            fallback: readString(defaults, keys: installmentTitleKeys)
        )

        let installmentPaidCount = intValue(
            dict["installmentPaidCount"],
            fallback: readInt(defaults, keys: installmentPaidCountKeys)
        )

        let installmentTotalCount = intValue(
            dict["installmentTotalCount"],
            fallback: readInt(defaults, keys: installmentTotalCountKeys)
        )

        let installmentNextDueDate = parseDate(dict["installmentNextDueDate"])
            ?? parseDate(readString(defaults, keys: installmentNextDueDateKeys))

        let installmentProgress = number(
            dict["installmentProgress"],
            fallback: readNumber(defaults, keys: installmentProgressKeys)
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
        let usdTry = readSnapshotNumber(
            dict,
            keys: ["usdTry", "usdTRY", "USD", "usd", "dolar"],
            defaults: defaults,
            fallbackKeys: usdTryKeys
        )
        let eurTry = readSnapshotNumber(
            dict,
            keys: ["eurTry", "eurTRY", "EUR", "eur", "euro"],
            defaults: defaults,
            fallbackKeys: eurTryKeys
        )
        let gramGoldTry = readSnapshotNumber(
            dict,
            keys: ["gramGoldTry", "gramTry", "GRAM", "GA", "gold", "altin"],
            defaults: defaults,
            fallbackKeys: gramGoldTryKeys
        )
        let usdChange = readSnapshotNumber(
            dict,
            keys: ["usdChange", "USDChange", "usd_change"],
            defaults: defaults,
            fallbackKeys: usdChangeKeys
        )
        let eurChange = readSnapshotNumber(
            dict,
            keys: ["eurChange", "EURChange", "eur_change"],
            defaults: defaults,
            fallbackKeys: eurChangeKeys
        )
        let gramGoldChange = readSnapshotNumber(
            dict,
            keys: ["gramGoldChange", "gramChange", "GRAMChange", "gram_change"],
            defaults: defaults,
            fallbackKeys: gramGoldChangeKeys
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
            goalTitle: goalTitle,
            goalTargetDate: goalTargetDate,
            installmentCount: installmentCount,
            installmentTotal: installmentTotal,
            installmentTitle: installmentTitle,
            installmentPaidCount: installmentPaidCount,
            installmentTotalCount: installmentTotalCount,
            installmentNextDueDate: installmentNextDueDate,
            installmentProgress: installmentProgress,
            todayEvents: events,
            insightTitle: title,
            insightText: text,
            percentageChange: percentageChange,
            currencyCode: currency.isEmpty ? "TRY" : currency,
            themeMode: themeMode.isEmpty ? "auto" : themeMode,
            isPremium: isPremium,
            lastUpdated: lastUpdated,
            usdTry: usdTry,
            eurTry: eurTry,
            gramGoldTry: gramGoldTry,
            usdChange: usdChange,
            eurChange: eurChange,
            gramGoldChange: gramGoldChange
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
            goalTitle: readString(defaults, keys: goalTitleKeys),
            goalTargetDate: parseDate(readString(defaults, keys: goalTargetDateKeys)),
            installmentCount: readInt(defaults, keys: installmentCountKeys),
            installmentTotal: readNumber(defaults, keys: installmentTotalKeys),
            installmentTitle: readString(defaults, keys: installmentTitleKeys),
            installmentPaidCount: readInt(defaults, keys: installmentPaidCountKeys),
            installmentTotalCount: readInt(defaults, keys: installmentTotalCountKeys),
            installmentNextDueDate: parseDate(readString(defaults, keys: installmentNextDueDateKeys)),
            installmentProgress: readNumber(defaults, keys: installmentProgressKeys),
            todayEvents: parseEvents(defaults.string(forKey: "widget_today_events")),
            insightTitle: readString(defaults, keys: insightTitleKeys, fallback: "Bugünün İçgörüsü"),
            insightText: readString(defaults, keys: insightTextKeys, fallback: ""),
            percentageChange: readNumber(defaults, keys: percentageChangeKeys),
            currencyCode: readString(defaults, keys: currencyCodeKeys, fallback: "TRY"),
            themeMode: readString(defaults, keys: themeModeKeys, fallback: "auto"),
            isPremium: readBool(defaults, keys: premiumKeys),
            lastUpdated: parseDate(defaults.string(forKey: "widget_last_updated")) ?? Date(),
            usdTry: readNumber(defaults, keys: usdTryKeys),
            eurTry: readNumber(defaults, keys: eurTryKeys),
            gramGoldTry: readNumber(defaults, keys: gramGoldTryKeys),
            usdChange: readNumber(defaults, keys: usdChangeKeys),
            eurChange: readNumber(defaults, keys: eurChangeKeys),
            gramGoldChange: readNumber(defaults, keys: gramGoldChangeKeys)
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
                if let parsed = parseLocalizedDouble(value) {
                    return parsed
                }
            }
        }

        return fallback
    }

    private static func readSnapshotNumber(
        _ dict: [String: Any],
        keys: [String],
        defaults: UserDefaults,
        fallbackKeys: [String],
        fallback: Double = 0
    ) -> Double {
        for key in keys {
            if let parsed = nestedNumber(dict[key]) {
                return parsed
            }
        }
        return readNumber(defaults, keys: fallbackKeys, fallback: fallback)
    }

    private static func nestedNumber(_ value: Any?) -> Double? {
        if let numeric = value as? NSNumber {
            return numeric.doubleValue
        }

        if let text = value as? String {
            return parseLocalizedDouble(text)
        }

        if let dict = value as? [String: Any] {
            for key in ["satis", "selling", "sale", "value", "rate", "try", "last", "price", "degisim", "change", "changePercent"] {
                if let parsed = nestedNumber(dict[key]) {
                    return parsed
                }
            }
        }

        return nil
    }

    private static func parseLocalizedDouble(_ raw: String) -> Double? {
        var text = raw
            .replacingOccurrences(of: "%", with: "")
            .replacingOccurrences(of: "₺", with: "")
            .replacingOccurrences(of: "TL", with: "", options: .caseInsensitive)
            .trimmingCharacters(in: .whitespacesAndNewlines)

        guard !text.isEmpty else { return nil }
        let hasComma = text.contains(",")
        let dotCount = text.filter { $0 == "." }.count

        if hasComma {
            text = text.replacingOccurrences(of: ".", with: "").replacingOccurrences(of: ",", with: ".")
        } else if dotCount > 1 {
            text = text.replacingOccurrences(of: ".", with: "")
        }

        return Double(text)
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
            return parseLocalizedDouble(text) ?? fallback
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
        let minuteInterval = result.state == .empty ? 2 : 5
        let refresh = Calendar.current.date(byAdding: .minute, value: minuteInterval, to: now) ?? now.addingTimeInterval(Double(minuteInterval * 60))
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

    static func marketRate(_ value: Double) -> String {
        guard value > 0 else { return "--" }
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.locale = Locale(identifier: "tr_TR")
        formatter.minimumFractionDigits = 2
        formatter.maximumFractionDigits = 2
        formatter.usesGroupingSeparator = true
        return formatter.string(from: NSNumber(value: value)) ?? "--"
    }

    static func marketChange(_ value: Double) -> String {
        guard abs(value) > 0.0001 else { return "--" }
        let sign = value > 0 ? "+" : ""
        return "\(sign)%\(marketRate(abs(value)))"
    }

    static func shortDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "tr_TR")
        formatter.dateFormat = "d MMM"
        return formatter.string(from: date)
    }

    static func mediumDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "tr_TR")
        formatter.dateFormat = "d MMMM yyyy"
        return formatter.string(from: date)
    }

    static func dayNumber(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "tr_TR")
        formatter.dateFormat = "d"
        return formatter.string(from: date)
    }

    static func monthName(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "tr_TR")
        formatter.dateFormat = "MMMM"
        return formatter.string(from: date)
    }

    static func weekdayName(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "tr_TR")
        formatter.dateFormat = "EEEE"
        return formatter.string(from: date)
    }

    static func shortTime(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "tr_TR")
        formatter.dateFormat = "HH:mm"
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

private struct LegacyFingendaWidgetBundle: WidgetBundle {
    var body: some Widget {
        FingendaSmallNetCashWidget()
        FingendaSmallSavingsGoalWidget()
        FingendaMediumIncomeExpenseWidget()
        FingendaMediumInsightWidget()
        FingendaLargeDailySummaryWidget()
        FingendaAccessoryBudgetWidget()
    }
}

// MARK: - Reference Grade Widget System
private struct ReferenceWidgetTheme {
    let isDark: Bool
    let backgroundTop: Color
    let backgroundBottom: Color
    let cardTop: Color
    let cardBottom: Color
    let cardStroke: Color
    let hairline: Color
    let textPrimary: Color
    let textSecondary: Color
    let textMuted: Color
    let purple: Color
    let violet: Color
    let blue: Color
    let green: Color
    let red: Color
    let gold: Color
    let softShadow: Color

    static func current(for scheme: ColorScheme) -> ReferenceWidgetTheme {
        if scheme == .dark {
            return ReferenceWidgetTheme(
                isDark: true,
                backgroundTop: Color(red: 0.03, green: 0.06, blue: 0.12),
                backgroundBottom: Color(red: 0.01, green: 0.03, blue: 0.08),
                cardTop: Color(red: 0.08, green: 0.11, blue: 0.18),
                cardBottom: Color(red: 0.03, green: 0.06, blue: 0.12),
                cardStroke: Color.white.opacity(0.20),
                hairline: Color.white.opacity(0.10),
                textPrimary: Color.white.opacity(0.96),
                textSecondary: Color.white.opacity(0.74),
                textMuted: Color.white.opacity(0.52),
                purple: Color(red: 0.47, green: 0.24, blue: 1.00),
                violet: Color(red: 0.66, green: 0.48, blue: 1.00),
                blue: Color(red: 0.30, green: 0.45, blue: 1.00),
                green: Color(red: 0.14, green: 0.88, blue: 0.58),
                red: Color(red: 1.00, green: 0.31, blue: 0.37),
                gold: Color(red: 1.00, green: 0.73, blue: 0.23),
                softShadow: Color.black.opacity(0.52)
            )
        }

        return ReferenceWidgetTheme(
            isDark: false,
            backgroundTop: Color(red: 0.96, green: 0.98, blue: 1.00),
            backgroundBottom: Color(red: 0.90, green: 0.94, blue: 1.00),
            cardTop: Color(red: 0.985, green: 0.992, blue: 1.00),
            cardBottom: Color(red: 0.90, green: 0.94, blue: 1.00),
            cardStroke: Color(red: 0.70, green: 0.76, blue: 0.88).opacity(0.52),
            hairline: Color(red: 0.63, green: 0.69, blue: 0.82).opacity(0.30),
            textPrimary: Color(red: 0.05, green: 0.08, blue: 0.18),
            textSecondary: Color(red: 0.22, green: 0.27, blue: 0.40),
            textMuted: Color(red: 0.45, green: 0.50, blue: 0.64),
            purple: Color(red: 0.34, green: 0.26, blue: 0.96),
            violet: Color(red: 0.55, green: 0.44, blue: 1.00),
            blue: Color(red: 0.24, green: 0.40, blue: 0.94),
            green: Color(red: 0.05, green: 0.63, blue: 0.24),
            red: Color(red: 0.88, green: 0.10, blue: 0.14),
            gold: Color(red: 0.92, green: 0.58, blue: 0.10),
            softShadow: Color(red: 0.17, green: 0.21, blue: 0.32).opacity(0.22)
        )
    }
}

private struct ReferenceWidgetShell<Content: View>: View {
    @Environment(\.colorScheme) private var colorScheme
    let padding: CGFloat
    let content: (ReferenceWidgetTheme) -> Content

    init(padding: CGFloat = 14, @ViewBuilder content: @escaping (ReferenceWidgetTheme) -> Content) {
        self.padding = padding
        self.content = content
    }

    var body: some View {
        let theme = ReferenceWidgetTheme.current(for: colorScheme)

        ZStack {
            RoundedRectangle(cornerRadius: 25, style: .continuous)
                .fill(
                    LinearGradient(
                        colors: [theme.cardTop, theme.cardBottom],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )

            RadialGradient(
                colors: [
                    (theme.isDark ? theme.violet.opacity(0.18) : Color.white.opacity(0.68)),
                    .clear
                ],
                center: .topLeading,
                startRadius: 4,
                endRadius: 180
            )

            RadialGradient(
                colors: [theme.blue.opacity(theme.isDark ? 0.10 : 0.15), .clear],
                center: .bottomTrailing,
                startRadius: 4,
                endRadius: 210
            )

            content(theme)
                .padding(padding)
        }
        .clipShape(RoundedRectangle(cornerRadius: 25, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 25, style: .continuous)
                .stroke(theme.cardStroke, lineWidth: 1)
        )
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .shadow(color: theme.softShadow, radius: theme.isDark ? 11 : 12, x: 0, y: 8)
        .containerBackground(for: .widget) {
            LinearGradient(
                colors: [theme.backgroundTop, theme.backgroundBottom],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        }
    }
}

private struct ReferenceHeader: View {
    let title: String
    let systemImage: String
    let trailing: String?
    let showsDots: Bool

    init(title: String, systemImage: String = "calendar", trailing: String? = nil, showsDots: Bool = false) {
        self.title = title
        self.systemImage = systemImage
        self.trailing = trailing
        self.showsDots = showsDots
    }

    var body: some View {
        HStack(spacing: 7) {
            Image(systemName: systemImage)
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(
                    LinearGradient(
                        colors: [Color(red: 0.42, green: 0.30, blue: 1.0), Color(red: 0.24, green: 0.46, blue: 1.0)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )

            Text(title)
                .font(.system(size: 15, weight: .bold, design: .rounded))
                .lineLimit(1)
                .minimumScaleFactor(0.82)

            Spacer(minLength: 6)

            if let trailing {
                Text(trailing)
                    .font(.system(size: 11, weight: .medium, design: .rounded))
                    .lineLimit(1)
            }

            if showsDots {
                Image(systemName: "ellipsis")
                    .font(.system(size: 13, weight: .bold))
            }
        }
    }
}

private struct ReferenceEmptyState: View {
    let title: String
    let subtitle: String
    let theme: ReferenceWidgetTheme

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            Image(systemName: "tray")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(theme.textSecondary)
            Text(title)
                .font(.system(size: 13, weight: .bold, design: .rounded))
                .foregroundStyle(theme.textPrimary)
                .lineLimit(1)
            Text(subtitle)
                .font(.system(size: 11, weight: .medium, design: .rounded))
                .foregroundStyle(theme.textSecondary)
                .lineLimit(3)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

private struct ReferenceIcon3D: View {
    let symbol: String
    let tint: Color
    var size: CGFloat = 43
    var system: Bool = true

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: size * 0.25, style: .continuous)
                .fill(
                    LinearGradient(
                        colors: [tint.opacity(0.92), tint.opacity(0.58), Color.white.opacity(0.20)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .shadow(color: tint.opacity(0.32), radius: 9, x: 0, y: 7)

            RoundedRectangle(cornerRadius: size * 0.25, style: .continuous)
                .stroke(Color.white.opacity(0.36), lineWidth: 1)

            if system {
                Image(systemName: symbol)
                    .font(.system(size: size * 0.42, weight: .heavy))
                    .foregroundStyle(.white)
                    .shadow(color: .black.opacity(0.22), radius: 2, x: 0, y: 1)
            } else {
                Text(symbol)
                    .font(.system(size: size * 0.62))
                    .shadow(color: .black.opacity(0.20), radius: 3, x: 0, y: 2)
            }
        }
        .frame(width: size, height: size)
    }
}

private struct ReferenceProgressBar: View {
    let progress: Double
    let theme: ReferenceWidgetTheme
    var height: CGFloat = 8

    var body: some View {
        GeometryReader { proxy in
            ZStack(alignment: .leading) {
                Capsule(style: .continuous)
                    .fill(theme.isDark ? Color.white.opacity(0.11) : Color(red: 0.78, green: 0.82, blue: 0.90).opacity(0.65))

                Capsule(style: .continuous)
                    .fill(
                        LinearGradient(
                            colors: [theme.purple, theme.violet, theme.blue],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .frame(width: max(height, proxy.size.width * clamp(progress, min: 0.03, max: 1)))
                    .shadow(color: theme.purple.opacity(0.34), radius: 5, x: 0, y: 2)
            }
        }
        .frame(height: height)
    }
}

private struct ReferenceWaveChart: View {
    let theme: ReferenceWidgetTheme

    var body: some View {
        GeometryReader { proxy in
            let width = proxy.size.width
            let height = proxy.size.height

            ZStack(alignment: .bottomTrailing) {
                ReferenceWaveShape(offset: 0.00)
                    .fill(
                        LinearGradient(
                            colors: [theme.violet.opacity(0.30), theme.blue.opacity(0.04)],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    .frame(width: width, height: height)

                ReferenceWaveShape(offset: 0.18)
                    .stroke(theme.violet.opacity(theme.isDark ? 0.86 : 0.68), style: StrokeStyle(lineWidth: 2.3, lineCap: .round, lineJoin: .round))
                    .frame(width: width, height: height)

                ReferenceWaveShape(offset: -0.10)
                    .stroke(theme.blue.opacity(theme.isDark ? 0.74 : 0.56), style: StrokeStyle(lineWidth: 1.8, lineCap: .round, lineJoin: .round))
                    .frame(width: width, height: height * 0.76)
                    .offset(y: height * 0.18)

                HStack(alignment: .bottom, spacing: 3) {
                    Capsule().frame(width: 3, height: 11)
                    Capsule().frame(width: 3, height: 16)
                    Capsule().frame(width: 3, height: 22)
                }
                .foregroundStyle(theme.blue)
                .opacity(0.84)
                .padding(.trailing, 4)
                .padding(.bottom, 2)
            }
        }
    }
}

private struct ReferenceWaveShape: Shape {
    let offset: CGFloat

    func path(in rect: CGRect) -> Path {
        var path = Path()
        let h = rect.height
        let w = rect.width

        path.move(to: CGPoint(x: 0, y: h * (0.75 + offset)))
        path.addCurve(
            to: CGPoint(x: w * 0.32, y: h * (0.55 + offset)),
            control1: CGPoint(x: w * 0.10, y: h * (0.88 + offset)),
            control2: CGPoint(x: w * 0.20, y: h * (0.38 + offset))
        )
        path.addCurve(
            to: CGPoint(x: w * 0.62, y: h * (0.32 + offset)),
            control1: CGPoint(x: w * 0.44, y: h * (0.74 + offset)),
            control2: CGPoint(x: w * 0.50, y: h * (0.28 + offset))
        )
        path.addCurve(
            to: CGPoint(x: w, y: h * (0.05 + offset)),
            control1: CGPoint(x: w * 0.74, y: h * (0.48 + offset)),
            control2: CGPoint(x: w * 0.84, y: h * (0.02 + offset))
        )
        path.addLine(to: CGPoint(x: w, y: h))
        path.addLine(to: CGPoint(x: 0, y: h))
        path.closeSubpath()
        return path
    }
}

private struct ReferenceMiniBars: View {
    let theme: ReferenceWidgetTheme
    let values: [Double]

    var body: some View {
        HStack(alignment: .bottom, spacing: 4) {
            ForEach(values.indices, id: \.self) { index in
                let value = values[index]
                RoundedRectangle(cornerRadius: 3, style: .continuous)
                    .fill(
                        LinearGradient(
                            colors: [theme.violet, theme.purple],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    .overlay(alignment: .top) {
                        Text("\(Int(value * 100))%")
                            .font(.system(size: 7, weight: .heavy, design: .rounded))
                            .foregroundStyle(.white)
                            .padding(.top, 3)
                    }
                    .frame(width: 24, height: 24 + CGFloat(value * 56))
            }
        }
    }
}

private struct ReferenceGlobe: View {
    let theme: ReferenceWidgetTheme

    var body: some View {
        ZStack {
            Circle()
                .fill(
                    RadialGradient(
                        colors: [
                            Color(red: 0.52, green: 0.78, blue: 1.00),
                            Color(red: 0.23, green: 0.44, blue: 0.88),
                            Color(red: 0.05, green: 0.10, blue: 0.27)
                        ],
                        center: .topLeading,
                        startRadius: 6,
                        endRadius: 66
                    )
                )
                .shadow(color: theme.blue.opacity(0.38), radius: 16, x: 0, y: 12)

            Circle()
                .stroke(Color.white.opacity(theme.isDark ? 0.15 : 0.26), lineWidth: 1)

            ForEach(0..<4, id: \.self) { index in
                Capsule(style: .continuous)
                    .stroke(Color.white.opacity(0.18), lineWidth: 1)
                    .frame(width: 74 - CGFloat(index * 12), height: 74)
            }

            Image(systemName: "map.fill")
                .font(.system(size: 34, weight: .semibold))
                .foregroundStyle(Color.white.opacity(0.26))
        }
        .frame(width: 86, height: 86)
    }
}

private struct ReferenceActionItem: View {
    @Environment(\.colorScheme) private var colorScheme
    let title: String
    let symbol: String
    let tint: Color
    let destination: URL

    var body: some View {
        let theme = ReferenceWidgetTheme.current(for: colorScheme)

        Link(destination: destination) {
            VStack(spacing: 7) {
                ReferenceIcon3D(symbol: symbol, tint: tint, size: 43)
                Text(title)
                    .font(.system(size: 11, weight: .medium, design: .rounded))
                    .foregroundStyle(theme.textPrimary)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.plain)
    }
}

private enum ReferenceWidgetData {
    static func agendaItems(from snapshot: FingendaWidgetSnapshot) -> [WidgetTodayEvent] {
        if !snapshot.todayEvents.isEmpty {
            return Array(snapshot.todayEvents.prefix(3))
        }

        return []
    }

    static func recentItem(from snapshot: FingendaWidgetSnapshot) -> WidgetTodayEvent? {
        snapshot.todayEvents.first
    }
}

// MARK: - Reference Widget Views
private struct ReferenceTodayWidgetView: View {
    let entry: FingendaWidgetEntry
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        let theme = ReferenceWidgetTheme.current(for: colorScheme)

        ReferenceWidgetShell(padding: 14) { theme in
            VStack(alignment: .leading, spacing: 9) {
                ReferenceHeader(title: "Bugün", systemImage: "calendar")
                    .foregroundStyle(theme.textPrimary)

                if entry.effectiveState == .empty {
                    ReferenceEmptyState(title: "Henüz veri yok", subtitle: "İlk işlemini eklediğinde bugün kartı dolacak.", theme: theme)
                } else {
                    HStack(alignment: .top) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Gelir")
                                .font(.system(size: 10, weight: .medium, design: .rounded))
                                .foregroundStyle(theme.textSecondary)
                            Text(WidgetFormat.currency(entry.snapshot.monthlyIncome, code: entry.snapshot.currencyCode))
                                .font(.system(size: 16, weight: .heavy, design: .rounded))
                                .foregroundStyle(theme.green)
                                .lineLimit(1)
                                .minimumScaleFactor(0.58)
                        }

                        Spacer(minLength: 8)

                        VStack(alignment: .leading, spacing: 4) {
                            Text("Gider")
                                .font(.system(size: 10, weight: .medium, design: .rounded))
                                .foregroundStyle(theme.textSecondary)
                            Text(WidgetFormat.currency(entry.snapshot.monthlyExpense, code: entry.snapshot.currencyCode))
                                .font(.system(size: 16, weight: .heavy, design: .rounded))
                                .foregroundStyle(theme.red)
                                .lineLimit(1)
                                .minimumScaleFactor(0.58)
                        }
                    }

                    Rectangle()
                        .fill(theme.hairline)
                        .frame(height: 1)

                    VStack(alignment: .leading, spacing: 2) {
                        Text("Kalan")
                            .font(.system(size: 10, weight: .medium, design: .rounded))
                            .foregroundStyle(theme.textSecondary)
                        Text(WidgetFormat.currency(entry.snapshot.remainingBudget, code: entry.snapshot.currencyCode))
                            .font(.system(size: 17, weight: .heavy, design: .rounded))
                            .foregroundStyle(theme.textPrimary)
                            .lineLimit(1)
                    }

                    ReferenceWaveChart(theme: theme)
                        .frame(height: 58)
                }
            }
        }
        .widgetURL(WidgetDeepLinks.url(for: .dashboard))
    }
}

private struct ReferenceSavingsWidgetView: View {
    let entry: FingendaWidgetEntry

    var body: some View {
        let snapshot = entry.snapshot
        let hasGoal = snapshot.hasSavingsGoal
        let title = snapshot.goalTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        let displayTitle = title.isEmpty ? "Hedef seçilmedi" : title
        let targetText = snapshot.savingsTarget > 0.01 ? WidgetFormat.currency(snapshot.savingsTarget, code: snapshot.currencyCode) : "Hedef yok"
        let dateText = snapshot.goalTargetDate.map { WidgetFormat.mediumDate($0) } ?? "Tarih belirlenmedi"

        ReferenceWidgetShell(padding: 15) { theme in
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 10) {
                    ReferenceHeader(title: "Hedef Birikimim", systemImage: "target", showsDots: true)
                        .foregroundStyle(theme.textPrimary)

                    Text(displayTitle)
                        .font(.system(size: 12, weight: .medium, design: .rounded))
                        .foregroundStyle(theme.textPrimary)
                        .lineLimit(1)

                    HStack(alignment: .firstTextBaseline, spacing: 4) {
                        Text(WidgetFormat.currency(snapshot.savingsCurrent, code: snapshot.currencyCode))
                            .font(.system(size: 22, weight: .heavy, design: .rounded))
                            .foregroundStyle(theme.textPrimary)
                            .lineLimit(1)
                            .minimumScaleFactor(0.62)
                        Text("/ \(targetText)")
                            .font(.system(size: 11, weight: .medium, design: .rounded))
                            .foregroundStyle(theme.textSecondary)
                            .lineLimit(1)
                    }

                    HStack(spacing: 7) {
                        ReferenceProgressBar(progress: hasGoal ? snapshot.normalizedSavingsProgress : 0, theme: theme, height: 8)
                        Text(WidgetFormat.percent((hasGoal ? snapshot.normalizedSavingsProgress : 0) * 100, maxFractionDigits: 0))
                            .font(.system(size: 11, weight: .bold, design: .rounded))
                            .foregroundStyle(theme.textPrimary)
                    }

                    VStack(alignment: .leading, spacing: 3) {
                        Text("Hedef Tarihi")
                            .font(.system(size: 11, weight: .medium, design: .rounded))
                            .foregroundStyle(theme.textSecondary)
                        Text(dateText)
                            .font(.system(size: 12, weight: .semibold, design: .rounded))
                            .foregroundStyle(theme.textPrimary)
                            .lineLimit(1)
                            .minimumScaleFactor(0.72)
                    }
                }

                Spacer(minLength: 2)

                ZStack {
                    RoundedRectangle(cornerRadius: 30, style: .continuous)
                        .fill(
                            LinearGradient(
                                colors: [theme.purple.opacity(0.34), theme.blue.opacity(0.16), theme.green.opacity(0.12)],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: 30, style: .continuous)
                                .stroke(Color.white.opacity(theme.isDark ? 0.14 : 0.42), lineWidth: 1)
                        )
                        .shadow(color: theme.purple.opacity(0.22), radius: 14, x: 0, y: 10)

                    VStack(spacing: 7) {
                        ReferenceIcon3D(symbol: "target", tint: theme.purple, size: 58)
                        Image(systemName: hasGoal ? "checkmark.seal.fill" : "plus.circle.fill")
                            .font(.system(size: 22, weight: .semibold))
                            .foregroundStyle(hasGoal ? theme.green : theme.textSecondary)
                    }
                }
                .frame(width: 120, height: 130)
            }
        }
        .widgetURL(WidgetDeepLinks.url(for: .savings))
    }
}

private struct ReferenceAgendaWidgetView: View {
    let entry: FingendaWidgetEntry

    var body: some View {
        let agendaItems = ReferenceWidgetData.agendaItems(from: entry.snapshot)

        ReferenceWidgetShell(padding: 14) { theme in
            VStack(spacing: 9) {
                ReferenceHeader(title: "Finansal Ajanda", systemImage: "calendar", trailing: "Bugün")
                    .foregroundStyle(theme.textPrimary)

                HStack(spacing: 15) {
                    VStack(spacing: 2) {
                        Text(WidgetFormat.dayNumber(entry.snapshot.date))
                            .font(.system(size: 38, weight: .regular, design: .rounded))
                            .foregroundStyle(theme.textPrimary)
                        Text(WidgetFormat.monthName(entry.snapshot.date))
                            .font(.system(size: 12, weight: .medium, design: .rounded))
                            .foregroundStyle(theme.textSecondary)
                        Text(WidgetFormat.weekdayName(entry.snapshot.date))
                            .font(.system(size: 12, weight: .medium, design: .rounded))
                            .foregroundStyle(theme.textSecondary)
                    }
                    .frame(width: 58)

                    Rectangle()
                        .fill(theme.hairline)
                        .frame(width: 1)

                    if agendaItems.isEmpty {
                        ReferenceEmptyState(
                            title: "Bugün ödeme yok",
                            subtitle: "Yaklaşan ödeme ve taksitlerin burada görünecek.",
                            theme: theme
                        )
                        .frame(maxWidth: .infinity, alignment: .leading)
                    } else {
                        VStack(spacing: 0) {
                            ForEach(agendaItems.indices, id: \.self) { index in
                                let item = agendaItems[index]
                                ReferenceAgendaRow(event: item, theme: theme, isLast: index == agendaItems.count - 1)
                            }
                        }
                    }
                }

                Link(destination: WidgetDeepLinks.url(for: .agendaToday)) {
                    ZStack {
                        Circle()
                            .fill(LinearGradient(colors: [theme.violet, theme.purple], startPoint: .topLeading, endPoint: .bottomTrailing))
                            .frame(width: 40, height: 40)
                            .shadow(color: theme.purple.opacity(0.46), radius: 10, x: 0, y: 7)
                        Image(systemName: "plus")
                            .font(.system(size: 22, weight: .medium))
                            .foregroundStyle(.white)
                    }
                }
                .buttonStyle(.plain)
                .offset(y: 2)
            }
        }
        .widgetURL(WidgetDeepLinks.url(for: .agendaToday))
    }
}

private struct ReferenceAgendaRow: View {
    let event: WidgetTodayEvent
    let theme: ReferenceWidgetTheme
    let isLast: Bool

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 10) {
                ReferenceIcon3D(symbol: event.categoryIcon, tint: iconTint, size: 28)

                Text(event.title)
                    .font(.system(size: 12, weight: .semibold, design: .rounded))
                    .foregroundStyle(theme.textPrimary)
                    .lineLimit(1)

                Spacer(minLength: 6)

                Text(WidgetFormat.currency(event.amount, code: "TRY"))
                    .font(.system(size: 12, weight: .bold, design: .rounded))
                    .foregroundStyle(theme.textPrimary)
                    .lineLimit(1)

                Text(event.time)
                    .font(.system(size: 10, weight: .medium, design: .rounded))
                    .foregroundStyle(theme.textSecondary)
                    .lineLimit(1)
                    .frame(width: 42, alignment: .trailing)
            }
            .padding(.vertical, 7)

            if !isLast {
                Rectangle()
                    .fill(theme.hairline)
                    .frame(height: 1)
            }
        }
    }

    private var iconTint: Color {
        if event.categoryIcon.contains("bolt") { return theme.gold }
        if event.categoryIcon.contains("banknote") { return theme.green }
        return theme.purple
    }
}

private struct ReferenceMarketsWidgetView: View {
    let entry: FingendaWidgetEntry

    var body: some View {
        ReferenceWidgetShell(padding: 14) { theme in
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 10) {
                    ReferenceHeader(title: "Piyasalar", systemImage: "chart.line.uptrend.xyaxis", showsDots: true)
                        .foregroundStyle(theme.textPrimary)

                    ReferenceMarketRow(icon: "$", name: "Dolar", value: WidgetFormat.marketRate(entry.snapshot.usdTry), changeValue: entry.snapshot.usdChange, tint: theme.green, theme: theme)
                    ReferenceMarketRow(icon: "EUR", name: "Euro", value: WidgetFormat.marketRate(entry.snapshot.eurTry), changeValue: entry.snapshot.eurChange, tint: theme.blue, theme: theme)
                    ReferenceMarketRow(icon: "Au", name: "Gram Alt\u{0131}n", value: WidgetFormat.marketRate(entry.snapshot.gramGoldTry), changeValue: entry.snapshot.gramGoldChange, tint: theme.gold, theme: theme)
                    if false {
                    ReferenceMarketRow(icon: "€", name: "Euro", value: "35,10", change: "%0,41", tint: theme.blue, theme: theme)
                    ReferenceMarketRow(icon: "⌂", name: "Gram Altın", value: "2.410,50", change: "%0,28", tint: theme.gold, theme: theme)

                    Text("Son güncelleme: 09:30")
                        .font(.system(size: 10, weight: .medium, design: .rounded))
                        .foregroundStyle(theme.textSecondary)
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding(.top, 2)
                    }

                    Text("Son g\u{00FC}ncelleme: \(WidgetFormat.shortTime(entry.snapshot.lastUpdated))")
                        .font(.system(size: 10, weight: .medium, design: .rounded))
                        .foregroundStyle(theme.textSecondary)
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding(.top, 2)
                }

                ReferenceGlobe(theme: theme)
                    .overlay(alignment: .topTrailing) {
                        ReferenceCoinBadge(text: "$", tint: theme.green)
                            .offset(x: 12, y: -6)
                    }
                    .overlay(alignment: .bottomTrailing) {
                        ReferenceCoinBadge(text: "▰", tint: theme.gold)
                            .offset(x: 12, y: 7)
                    }
            }
        }
        .widgetURL(WidgetDeepLinks.url(for: .custom("fingenda://market")))
    }
}

private struct ReferenceMarketRow: View {
    let icon: String
    let name: String
    let value: String
    let changeValue: Double
    let tint: Color
    let theme: ReferenceWidgetTheme
    let isVisible: Bool

    init(icon: String, name: String, value: String, changeValue: Double, tint: Color, theme: ReferenceWidgetTheme) {
        self.icon = icon
        self.name = name
        self.value = value
        self.changeValue = changeValue
        self.tint = tint
        self.theme = theme
        self.isVisible = true
    }

    init(icon: String, name: String, value: String, change: String, tint: Color, theme: ReferenceWidgetTheme) {
        self.icon = icon
        self.name = name
        self.value = value
        self.changeValue = 0
        self.tint = tint
        self.theme = theme
        self.isVisible = false
    }

    var body: some View {
        let hasChange = abs(changeValue) > 0.0001
        let isPositive = changeValue >= 0

        if isVisible {
            HStack(spacing: 10) {
                ReferenceCoinBadge(text: icon, tint: tint)
                Text(name)
                    .font(.system(size: 12, weight: .semibold, design: .rounded))
                    .foregroundStyle(theme.textPrimary)
                    .lineLimit(1)
                Spacer(minLength: 6)
                Text(value)
                    .font(.system(size: 12, weight: .semibold, design: .rounded))
                    .foregroundStyle(theme.textPrimary)
                    .lineLimit(1)
                HStack(spacing: 2) {
                    Image(systemName: hasChange ? "triangle.fill" : "minus")
                        .font(.system(size: 6, weight: .bold))
                        .rotationEffect(isPositive ? .degrees(0) : .degrees(180))
                    Text(WidgetFormat.marketChange(changeValue))
                        .font(.system(size: 10, weight: .bold, design: .rounded))
                }
                .foregroundStyle(hasChange ? (isPositive ? theme.green : theme.red) : theme.textSecondary)
                .frame(width: 54, alignment: .trailing)
            }
            .padding(.vertical, 2)
        }
    }
}

private struct ReferenceCoinBadge: View {
    let text: String
    let tint: Color

    var body: some View {
        ZStack {
            Circle()
                .fill(LinearGradient(colors: [tint.opacity(0.98), tint.opacity(0.70)], startPoint: .topLeading, endPoint: .bottomTrailing))
                .shadow(color: tint.opacity(0.34), radius: 6, x: 0, y: 4)
            Text(text)
                .font(.system(size: 15, weight: .heavy, design: .rounded))
                .foregroundStyle(.white)
                .lineLimit(1)
        }
        .frame(width: 30, height: 30)
    }
}

private struct ReferenceInstallmentWidgetView: View {
    let entry: FingendaWidgetEntry

    var body: some View {
        let snapshot = entry.snapshot
        let hasPlan = snapshot.hasInstallmentPlan
        let title = snapshot.installmentTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        let displayTitle = title.isEmpty ? "Aktif taksit yok" : title
        let totalCount = max(snapshot.installmentTotalCount, snapshot.installmentCount)
        let paidCount = min(max(snapshot.installmentPaidCount, 0), max(totalCount, snapshot.installmentPaidCount))
        let progress = snapshot.installmentProgress > 0
            ? clamp(snapshot.installmentProgress, min: 0, max: 1)
            : (totalCount > 0 ? clamp(Double(paidCount) / Double(totalCount), min: 0, max: 1) : 0)
        let dueDateText = snapshot.sanitizedInstallmentNextDueDate.map { WidgetFormat.shortDate($0) } ?? "Tarih yok"

        ReferenceWidgetShell(padding: 14) { theme in
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 11) {
                    ReferenceHeader(title: "Taksit & Kredi", systemImage: "creditcard.fill", trailing: nil)
                        .foregroundStyle(theme.textPrimary)

                    HStack(alignment: .firstTextBaseline, spacing: 9) {
                        VStack(alignment: .leading, spacing: 7) {
                            Text(displayTitle)
                                .font(.system(size: 12, weight: .semibold, design: .rounded))
                                .foregroundStyle(theme.textPrimary)
                                .lineLimit(1)
                            HStack(alignment: .firstTextBaseline, spacing: 4) {
                                Text(WidgetFormat.currency(snapshot.installmentTotal, code: snapshot.currencyCode))
                                    .font(.system(size: 16, weight: .heavy, design: .rounded))
                                    .foregroundStyle(theme.textPrimary)
                                    .lineLimit(1)
                                if totalCount > 0 {
                                    Text("/ \(totalCount) ay")
                                        .font(.system(size: 10, weight: .medium, design: .rounded))
                                        .foregroundStyle(theme.textSecondary)
                                }
                                if !hasPlan {
                                    Text("Plan ekle")
                                        .font(.system(size: 10, weight: .medium, design: .rounded))
                                        .foregroundStyle(theme.textSecondary)
                                }
                            }
                        }
                    }

                    ReferenceProgressBar(progress: hasPlan ? progress : 0, theme: theme, height: 7)

                    HStack(alignment: .bottom) {
                        Text(totalCount > 0 ? "\(paidCount) / \(totalCount) Taksit" : "Taksit planı yok")
                            .font(.system(size: 11, weight: .medium, design: .rounded))
                            .foregroundStyle(theme.textSecondary)
                        Spacer()
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Son Ödeme")
                                .font(.system(size: 9, weight: .medium, design: .rounded))
                                .foregroundStyle(theme.textMuted)
                            Text(dueDateText)
                                .font(.system(size: 11, weight: .semibold, design: .rounded))
                                .foregroundStyle(theme.textPrimary)
                        }
                    }
                }

                Spacer(minLength: 4)

                ZStack {
                    RoundedRectangle(cornerRadius: 30, style: .continuous)
                        .fill(
                            LinearGradient(
                                colors: [theme.blue.opacity(0.28), theme.purple.opacity(0.18), theme.cardBottom.opacity(0.72)],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: 30, style: .continuous)
                                .stroke(Color.white.opacity(theme.isDark ? 0.12 : 0.38), lineWidth: 1)
                        )
                        .shadow(color: theme.blue.opacity(0.20), radius: 12, x: 0, y: 9)

                    VStack(spacing: 8) {
                        ReferenceIcon3D(symbol: "creditcard.fill", tint: theme.purple, size: 56)
                        Text(hasPlan ? "\(max(totalCount - paidCount, 0)) ay" : "Plan")
                            .font(.system(size: 12, weight: .heavy, design: .rounded))
                            .foregroundStyle(theme.textPrimary)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 5)
                            .background(Capsule(style: .continuous).fill(theme.cardTop.opacity(0.72)))
                    }
                }
                .frame(width: 116, height: 126)
            }
        }
        .widgetURL(WidgetDeepLinks.url(for: .installments))
    }
}

private struct ReferenceQuickAddWidgetView: View {
    let entry: FingendaWidgetEntry

    var body: some View {
        ReferenceWidgetShell(padding: 15) { theme in
            VStack(alignment: .leading, spacing: 16) {
                Text("Hızlı Ekle")
                    .font(.system(size: 15, weight: .bold, design: .rounded))
                    .foregroundStyle(theme.textPrimary)

                HStack(spacing: 8) {
                    ReferenceActionItem(title: "Gelir", symbol: "arrow.down", tint: theme.green, destination: WidgetDeepLinks.url(for: .custom("fingenda://transaction/new?type=income")))
                    ReferenceActionItem(title: "Gider", symbol: "arrow.up", tint: theme.red, destination: WidgetDeepLinks.url(for: .custom("fingenda://transaction/new?type=expense")))
                    ReferenceActionItem(title: "Hedef", symbol: "target", tint: theme.violet, destination: WidgetDeepLinks.url(for: .savings))
                    ReferenceActionItem(title: "Taksit", symbol: "creditcard.fill", tint: theme.purple, destination: WidgetDeepLinks.url(for: .installments))
                    ReferenceActionItem(title: "Not", symbol: "note.text", tint: theme.gold, destination: WidgetDeepLinks.url(for: .custom("fingenda://notes/new")))
                    ReferenceActionItem(title: "Sesli Not", symbol: "mic.fill", tint: theme.blue, destination: WidgetDeepLinks.url(for: .custom("fingenda://voice-add")))
                }
            }
        }
        .widgetURL(WidgetDeepLinks.url(for: .dashboard))
    }
}

private struct ReferenceRecentWidgetView: View {
    let entry: FingendaWidgetEntry

    var body: some View {
        ReferenceWidgetShell(padding: 14) { theme in
            VStack(alignment: .leading, spacing: 15) {
                ReferenceHeader(title: "Son Kayıtlarım", systemImage: "calendar", showsDots: true)
                    .foregroundStyle(theme.textPrimary)

                if let item = ReferenceWidgetData.recentItem(from: entry.snapshot) {
                    HStack(spacing: 13) {
                        ReferenceIcon3D(symbol: item.categoryIcon, tint: theme.purple, size: 50)

                        VStack(alignment: .leading, spacing: 3) {
                            Text(item.title)
                                .font(.system(size: 13, weight: .bold, design: .rounded))
                                .foregroundStyle(theme.textPrimary)
                                .lineLimit(1)
                            Text(item.time)
                                .font(.system(size: 11, weight: .medium, design: .rounded))
                                .foregroundStyle(theme.textSecondary)
                                .lineLimit(1)
                        }

                        Spacer(minLength: 4)

                        Text(WidgetFormat.currency(item.amount, code: entry.snapshot.currencyCode))
                            .font(.system(size: 12, weight: .bold, design: .rounded))
                            .foregroundStyle(theme.red)
                            .lineLimit(1)

                        ReferenceAudioBars(theme: theme)

                        Link(destination: item.resolvedURL) {
                            ZStack {
                                Circle()
                                    .fill(theme.isDark ? Color.white.opacity(0.08) : Color(red: 0.88, green: 0.92, blue: 1.0))
                                    .frame(width: 48, height: 48)
                                    .overlay(Circle().stroke(theme.cardStroke, lineWidth: 1))
                                Image(systemName: "play.fill")
                                    .font(.system(size: 20, weight: .bold))
                                    .foregroundStyle(theme.purple)
                            }
                        }
                        .buttonStyle(.plain)
                    }
                } else {
                    ReferenceEmptyState(
                        title: "Henüz kayıt yok",
                        subtitle: "İlk işlemini eklediğinde burada görünecek.",
                        theme: theme
                    )
                }
            }
        }
        .widgetURL(WidgetDeepLinks.url(for: .transactionsMonthly))
    }
}

private struct ReferenceAudioBars: View {
    let theme: ReferenceWidgetTheme

    var body: some View {
        HStack(alignment: .center, spacing: 2) {
            ForEach([0.30, 0.55, 0.72, 0.98, 0.78, 0.52, 0.35, 0.64, 0.86, 0.48], id: \.self) { value in
                Capsule(style: .continuous)
                    .fill(LinearGradient(colors: [theme.blue, theme.purple], startPoint: .top, endPoint: .bottom))
                    .frame(width: 3, height: 28 * value)
            }
        }
        .frame(width: 52, height: 34)
    }
}

// MARK: - Reference Widget Definitions
private struct FingendaReferenceTodayWidget: Widget {
    let kind = "FingendaReferenceTodayWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: FingendaWidgetProvider()) { entry in
            ReferenceTodayWidgetView(entry: entry)
        }
        .configurationDisplayName("Bugün")
        .description("Gelir, gider ve kalan tutarını görsel dalga kartıyla takip et.")
        .supportedFamilies([.systemSmall])
        .contentMarginsDisabled()
    }
}

private struct FingendaReferenceSavingsWidget: Widget {
    let kind = "FingendaReferenceSavingsWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: FingendaWidgetProvider()) { entry in
            ReferenceSavingsWidgetView(entry: entry)
        }
        .configurationDisplayName("Hedef Birikimim")
        .description("Birikim hedefini premium seyahat kartı ile takip et.")
        .supportedFamilies([.systemMedium])
        .contentMarginsDisabled()
    }
}

private struct FingendaReferenceAgendaWidget: Widget {
    let kind = "FingendaReferenceAgendaWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: FingendaWidgetProvider()) { entry in
            ReferenceAgendaWidgetView(entry: entry)
        }
        .configurationDisplayName("Finansal Ajanda")
        .description("Yaklaşan ödeme ve gelir kayıtlarını ajanda formatında gör.")
        .supportedFamilies([.systemMedium])
        .contentMarginsDisabled()
    }
}

private struct FingendaReferenceMarketsWidget: Widget {
    let kind = "FingendaReferenceMarketsWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: FingendaWidgetProvider()) { entry in
            ReferenceMarketsWidgetView(entry: entry)
        }
        .configurationDisplayName("Piyasalar")
        .description("Döviz ve altın özetini premium piyasa kartında izle.")
        .supportedFamilies([.systemMedium])
        .contentMarginsDisabled()
    }
}

private struct FingendaReferenceInstallmentWidget: Widget {
    let kind = "FingendaReferenceInstallmentWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: FingendaWidgetProvider()) { entry in
            ReferenceInstallmentWidgetView(entry: entry)
        }
        .configurationDisplayName("Taksit & Kredi")
        .description("Kredi ve taksit ilerlemesini araç kartı ile takip et.")
        .supportedFamilies([.systemMedium])
        .contentMarginsDisabled()
    }
}

private struct FingendaReferenceQuickAddWidget: Widget {
    let kind = "FingendaReferenceQuickAddWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: FingendaWidgetProvider()) { entry in
            ReferenceQuickAddWidgetView(entry: entry)
        }
        .configurationDisplayName("Hızlı Ekle")
        .description("Gelir, gider, hedef, taksit, not ve sesli not akışlarına hızlı eriş.")
        .supportedFamilies([.systemMedium])
        .contentMarginsDisabled()
    }
}

private struct FingendaReferenceRecentWidget: Widget {
    let kind = "FingendaReferenceRecentWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: FingendaWidgetProvider()) { entry in
            ReferenceRecentWidgetView(entry: entry)
        }
        .configurationDisplayName("Son Kayıtlarım")
        .description("Son işlemini ve hızlı oynat aksiyonunu tek kartta gör.")
        .supportedFamilies([.systemMedium])
        .contentMarginsDisabled()
    }
}

@main
struct FingendaWidgetBundle: WidgetBundle {
    var body: some Widget {
        FingendaReferenceTodayWidget()
        FingendaReferenceSavingsWidget()
        FingendaReferenceAgendaWidget()
        FingendaReferenceMarketsWidget()
        FingendaReferenceInstallmentWidget()
        FingendaReferenceQuickAddWidget()
        FingendaReferenceRecentWidget()
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
