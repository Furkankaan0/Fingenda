import Combine
import Foundation
import SwiftUI
import UIKit

enum FingendaNativeRoute: Hashable {
    case dashboard
    case savings
    case insights
    case transactions
    case installments
    case profile

    var url: URL {
        let raw: String
        switch self {
        case .dashboard:
            raw = "fingenda://dashboard"
        case .savings:
            raw = "fingenda://savings"
        case .insights:
            raw = "fingenda://insights"
        case .transactions:
            raw = "fingenda://transactions?filter=monthly"
        case .installments:
            raw = "fingenda://installments"
        case .profile:
            raw = "fingenda://profile"
        }

        return URL(string: raw) ?? URL(string: "fingenda://dashboard")!
    }
}

struct FingendaNativeTodayEvent: Codable, Hashable, Identifiable {
    let id: String
    let title: String
    let amount: Double
    let time: String
    let categoryIcon: String
    let deepLink: String
}

struct FingendaNativeSnapshot: Codable, Hashable {
    let date: Date
    let netBalance: Double
    let monthlyIncome: Double
    let monthlyExpense: Double
    let dailyIncome: Double
    let dailyExpense: Double
    let dailyBalance: Double
    let remainingBudget: Double
    let savingsCurrent: Double
    let savingsTarget: Double
    let savingsProgress: Double
    let goalTitle: String
    let installmentCount: Int
    let installmentTotal: Double
    let todayEvents: [FingendaNativeTodayEvent]
    let insightTitle: String
    let insightText: String
    let currencyCode: String
    let lastUpdated: Date

    var monthlyBalance: Double {
        monthlyIncome - monthlyExpense
    }

    var hasFinancialData: Bool {
        abs(netBalance) > 0.01
            || monthlyIncome > 0.01
            || monthlyExpense > 0.01
            || savingsCurrent > 0.01
            || savingsTarget > 0.01
            || installmentCount > 0
            || !todayEvents.isEmpty
    }

    static let empty = FingendaNativeSnapshot(
        date: Date(),
        netBalance: 0,
        monthlyIncome: 0,
        monthlyExpense: 0,
        dailyIncome: 0,
        dailyExpense: 0,
        dailyBalance: 0,
        remainingBudget: 0,
        savingsCurrent: 0,
        savingsTarget: 0,
        savingsProgress: 0,
        goalTitle: "",
        installmentCount: 0,
        installmentTotal: 0,
        todayEvents: [],
        insightTitle: "",
        insightText: "",
        currencyCode: "TRY",
        lastUpdated: Date()
    )
}

@MainActor
final class FingendaNativeStore: ObservableObject {
    @Published private(set) var snapshot: FingendaNativeSnapshot = .empty

    private let snapshotKeys = [
        "widget_snapshot_v2",
        "widget_snapshot_v1",
        "fingenda_widget_snapshot"
    ]

    func reload() {
        snapshot = loadSnapshot()
    }

    private func loadSnapshot() -> FingendaNativeSnapshot {
        let defaults = resolveDefaults()

        for key in snapshotKeys {
            guard let raw = defaults.string(forKey: key),
                  let data = raw.data(using: .utf8),
                  let snapshot = try? JSONDecoder.fingenda.decode(FingendaNativeSnapshot.self, from: data) else {
                continue
            }
            return snapshot
        }

        return FingendaNativeSnapshot(
            date: Date(),
            netBalance: readDouble(defaults, keys: ["widget_net_balance", "net_balance"]),
            monthlyIncome: readDouble(defaults, keys: ["widget_income_total", "income_total"]),
            monthlyExpense: readDouble(defaults, keys: ["widget_expense_total", "expense_total"]),
            dailyIncome: readDouble(defaults, keys: ["widget_daily_income", "daily_income", "today_income"]),
            dailyExpense: readDouble(defaults, keys: ["widget_daily_expense", "daily_expense", "today_expense"]),
            dailyBalance: readDouble(defaults, keys: ["widget_daily_balance", "daily_balance", "today_balance"]),
            remainingBudget: readDouble(defaults, keys: ["widget_remaining_budget", "remaining_budget"]),
            savingsCurrent: readDouble(defaults, keys: ["widget_savings_current", "widget_savings_total", "savings_total"]),
            savingsTarget: readDouble(defaults, keys: ["widget_savings_target", "savings_target"]),
            savingsProgress: readDouble(defaults, keys: ["widget_savings_progress", "widget_goal_progress", "goal_progress"]),
            goalTitle: readString(defaults, keys: ["widget_goal_title", "goal_title"]),
            installmentCount: Int(readDouble(defaults, keys: ["widget_installment_count", "installment_count"])),
            installmentTotal: readDouble(defaults, keys: ["widget_installment_total", "installment_total"]),
            todayEvents: readTodayEvents(defaults),
            insightTitle: readString(defaults, keys: ["widget_insight_title", "insight_title"]),
            insightText: readString(defaults, keys: ["widget_insight_text", "insight_text"]),
            currencyCode: readString(defaults, keys: ["widget_currency_code", "currency_code"], fallback: "TRY"),
            lastUpdated: Date()
        )
    }

    private func resolveDefaults() -> UserDefaults {
        let bundleId = Bundle.main.bundleIdentifier ?? "com.fingenda.app"
        let appBundleId = bundleId.replacingOccurrences(of: ".widget", with: "")
        let candidates = [
            "group.\(appBundleId)",
            "group.com.fingenda.app",
            "group.com.fingenda"
        ]

        return candidates.compactMap { UserDefaults(suiteName: $0) }.first ?? .standard
    }

    private func readDouble(_ defaults: UserDefaults, keys: [String], fallback: Double = 0) -> Double {
        for key in keys {
            if let value = defaults.object(forKey: key) as? Double {
                return value
            }
            if let value = defaults.object(forKey: key) as? NSNumber {
                return value.doubleValue
            }
            if let value = defaults.string(forKey: key), let parsed = Double(value.replacingOccurrences(of: ",", with: ".")) {
                return parsed
            }
        }
        return fallback
    }

    private func readString(_ defaults: UserDefaults, keys: [String], fallback: String = "") -> String {
        for key in keys {
            if let value = defaults.string(forKey: key), !value.isEmpty {
                return value
            }
        }
        return fallback
    }

    private func readTodayEvents(_ defaults: UserDefaults) -> [FingendaNativeTodayEvent] {
        guard let raw = defaults.string(forKey: "widget_today_events"),
              let data = raw.data(using: .utf8),
              let events = try? JSONDecoder.fingenda.decode([FingendaNativeTodayEvent].self, from: data) else {
            return []
        }
        return events
    }
}

struct FingendaNativeDashboardView: View {
    @ObservedObject var store: FingendaNativeStore

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [
                    Color(red: 0.94, green: 0.97, blue: 1.0),
                    Color(red: 0.90, green: 0.92, blue: 0.98)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            VStack(alignment: .leading, spacing: 18) {
                header
                summaryCard
                insightCard
                Spacer(minLength: 0)
            }
            .padding(22)
        }
        .task {
            store.reload()
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Fingenda Native")
                .font(.system(size: 30, weight: .heavy, design: .rounded))
                .foregroundStyle(Color(red: 0.05, green: 0.07, blue: 0.14))
            Text("SwiftUI migration shell")
                .font(.system(size: 13, weight: .semibold, design: .rounded))
                .foregroundStyle(.secondary)
        }
    }

    private var summaryCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Bu Ay")
                .font(.system(size: 14, weight: .bold, design: .rounded))
                .foregroundStyle(.secondary)

            HStack(alignment: .firstTextBaseline) {
                Text(formatCurrency(store.snapshot.monthlyIncome))
                    .foregroundStyle(Color(red: 0.05, green: 0.62, blue: 0.36))
                Spacer()
                Text(formatCurrency(store.snapshot.monthlyExpense))
                    .foregroundStyle(Color(red: 0.82, green: 0.18, blue: 0.26))
            }
            .font(.system(size: 24, weight: .heavy, design: .rounded))

            Text("Kalan \(formatCurrency(store.snapshot.monthlyBalance))")
                .font(.system(size: 16, weight: .bold, design: .rounded))
                .foregroundStyle(Color(red: 0.08, green: 0.10, blue: 0.18))
        }
        .padding(18)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 28, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .stroke(Color.white.opacity(0.65), lineWidth: 1)
        )
    }

    private var insightCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(store.snapshot.insightTitle.isEmpty ? "Hazir" : store.snapshot.insightTitle)
                .font(.system(size: 16, weight: .bold, design: .rounded))
            Text(store.snapshot.insightText.isEmpty ? "Native ekranlar bu ortak veri katmani uzerinden parca parca tasinacak." : store.snapshot.insightText)
                .font(.system(size: 13, weight: .medium, design: .rounded))
                .foregroundStyle(.secondary)
        }
        .padding(18)
        .background(Color.white.opacity(0.55), in: RoundedRectangle(cornerRadius: 24, style: .continuous))
    }

    private func formatCurrency(_ value: Double) -> String {
        let formatter = NumberFormatter()
        formatter.locale = Locale(identifier: "tr_TR")
        formatter.numberStyle = .currency
        formatter.currencyCode = store.snapshot.currencyCode
        formatter.maximumFractionDigits = 0
        return formatter.string(from: NSNumber(value: value)) ?? "\(Int(value))"
    }
}

@MainActor
final class FingendaNativeHostViewController: UIHostingController<FingendaNativeDashboardView> {
    init(store: FingendaNativeStore = FingendaNativeStore()) {
        super.init(rootView: FingendaNativeDashboardView(store: store))
    }

    @available(*, unavailable)
    required dynamic init?(coder aDecoder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
}

private extension JSONDecoder {
    static var fingenda: JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let raw = try container.decode(String.self)

            if let date = ISO8601DateFormatter().date(from: raw) {
                return date
            }

            let formatter = DateFormatter()
            formatter.locale = Locale(identifier: "tr_TR")
            formatter.dateFormat = "yyyy-MM-dd"
            if let date = formatter.date(from: raw) {
                return date
            }

            return Date()
        }
        return decoder
    }
}
