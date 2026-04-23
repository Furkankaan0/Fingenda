import WidgetKit
import SwiftUI
import Foundation

private enum WidgetLinks {
    static let quickExpense = "fingenda://widget?action=quick-expense"
    static let quickIncome = "fingenda://widget?action=quick-income"
    static let voiceAdd = "fingenda://widget?action=voice-add"
    static let market = "fingenda://widget?action=open-market"
    static let dashboard = "fingenda://widget?tab=dashboard"
}

private enum SharedSnapshotStore {
    static var appGroupCandidates: [String] {
        var values: [String] = []

        if let bundleId = Bundle.main.bundleIdentifier {
            let appBundleId = bundleId.replacingOccurrences(of: ".widget", with: "")
            if !appBundleId.isEmpty {
                values.append("group.\(appBundleId)")
            }
        }

        values.append("group.com.fingenda.app")
        values.append("group.com.fingenda")

        var seen = Set<String>()
        return values.filter { candidate in
            guard !candidate.isEmpty else { return false }
            return seen.insert(candidate).inserted
        }
    }

    static let snapshotKeyCandidates = ["widget_snapshot_v1", "fingenda_widget_snapshot"]
    static let incomeKeys = ["widget_income_total", "income_total", "dashboard_income"]
    static let expenseKeys = ["widget_expense_total", "expense_total", "dashboard_expense"]
    static let usdKeys = ["widget_fx_usd_try", "fx_usd_try", "usd_try"]
    static let eurKeys = ["widget_fx_eur_try", "fx_eur_try", "eur_try"]
    static let savingsKeys = ["widget_savings_total", "savings_total", "dashboard_savings"]
    static let streakKeys = ["widget_streak_days", "streak_days"]
    static let goalProgressKeys = ["widget_goal_progress", "goal_progress"]

    static func load() -> FingendaSnapshot {
        let defaults = appGroupCandidates.compactMap { UserDefaults(suiteName: $0) }.first ?? UserDefaults.standard

        if let decoded = decodeSnapshot(defaults) {
            return decoded
        }

        return FingendaSnapshot(
            income: readNumber(defaults, keys: incomeKeys),
            expense: readNumber(defaults, keys: expenseKeys),
            usdTry: readNumber(defaults, keys: usdKeys),
            eurTry: readNumber(defaults, keys: eurKeys),
            savings: readNumber(defaults, keys: savingsKeys),
            streakDays: readInt(defaults, keys: streakKeys),
            goalProgress: readNumber(defaults, keys: goalProgressKeys)
        )
    }

    private static func decodeSnapshot(_ defaults: UserDefaults) -> FingendaSnapshot? {
        for key in snapshotKeyCandidates {
            guard let raw = defaults.string(forKey: key), !raw.isEmpty else { continue }
            guard let data = raw.data(using: .utf8) else { continue }
            guard let json = try? JSONSerialization.jsonObject(with: data, options: []),
                  let dict = json as? [String: Any] else { continue }

            return FingendaSnapshot(
                income: number(dict["income"]),
                expense: number(dict["expense"]),
                usdTry: number(dict["usdTry"]),
                eurTry: number(dict["eurTry"]),
                savings: number(dict["savings"]),
                streakDays: intValue(dict["streakDays"]),
                goalProgress: number(dict["goalProgress"])
            )
        }

        return nil
    }

    private static func readNumber(_ defaults: UserDefaults, keys: [String]) -> Double {
        for key in keys {
            if let number = defaults.object(forKey: key) as? NSNumber {
                return number.doubleValue
            }

            if let value = defaults.string(forKey: key)?
                .replacingOccurrences(of: ",", with: "."),
               let parsed = Double(value) {
                return parsed
            }
        }

        return 0
    }

    private static func readInt(_ defaults: UserDefaults, keys: [String]) -> Int {
        Int(readNumber(defaults, keys: keys))
    }

    private static func number(_ value: Any?) -> Double {
        if let n = value as? NSNumber { return n.doubleValue }
        if let s = value as? String {
            let normalized = s.replacingOccurrences(of: ",", with: ".")
            return Double(normalized) ?? 0
        }
        return 0
    }

    private static func intValue(_ value: Any?) -> Int {
        Int(number(value))
    }
}

private struct FingendaSnapshot {
    let income: Double
    let expense: Double
    let usdTry: Double
    let eurTry: Double
    let savings: Double
    let streakDays: Int
    let goalProgress: Double

    var hasData: Bool {
        income > 0 || expense > 0 || usdTry > 0 || eurTry > 0 || savings > 0
    }

    var netBalance: Double {
        income - expense
    }

    var spendRatio: Double {
        clamp(expense / max(income, 1), min: 0, max: 1.6)
    }

    var savingsRatio: Double {
        clamp(savings / max(income, 1), min: 0, max: 1.0)
    }

    var normalizedGoalProgress: Double {
        if goalProgress > 1 {
            return clamp(goalProgress / 100.0, min: 0, max: 1)
        }
        return clamp(goalProgress, min: 0, max: 1)
    }

    var scoreValue: Int {
        let spendPenalty = spendRatio * 52
        let savingsBoost = savingsRatio * 28
        let streakBoost = clamp(Double(streakDays) / 21.0, min: 0, max: 1) * 14
        let result = 78 - spendPenalty + savingsBoost + streakBoost
        return Int(clamp(result, min: 5, max: 99))
    }
}

private struct FingendaEntry: TimelineEntry {
    let date: Date
    let snapshot: FingendaSnapshot
}

private struct FingendaProvider: TimelineProvider {
    func placeholder(in context: Context) -> FingendaEntry {
        FingendaEntry(
            date: Date(),
            snapshot: FingendaSnapshot(
                income: 21400,
                expense: 14200,
                usdTry: 39.14,
                eurTry: 42.52,
                savings: 6700,
                streakDays: 8,
                goalProgress: 0.62
            )
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (FingendaEntry) -> Void) {
        completion(FingendaEntry(date: Date(), snapshot: SharedSnapshotStore.load()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<FingendaEntry>) -> Void) {
        let now = Date()
        let refreshDate = Calendar.current.date(byAdding: .minute, value: 30, to: now) ?? now.addingTimeInterval(1800)
        let entry = FingendaEntry(date: now, snapshot: SharedSnapshotStore.load())
        completion(Timeline(entries: [entry], policy: .after(refreshDate)))
    }
}

private enum WidgetFormatter {
    static let currency: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.locale = Locale(identifier: "tr_TR")
        formatter.maximumFractionDigits = 0
        return formatter
    }()

    static let decimal: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.locale = Locale(identifier: "tr_TR")
        formatter.minimumFractionDigits = 2
        formatter.maximumFractionDigits = 2
        return formatter
    }()
}

private enum WidgetText {
    static func currency(_ value: Double) -> String {
        WidgetFormatter.currency.string(from: NSNumber(value: value)) ?? "0 TL"
    }

    static func decimal(_ value: Double) -> String {
        WidgetFormatter.decimal.string(from: NSNumber(value: value)) ?? "0,00"
    }

    static func percent(from value: Double) -> String {
        "\(Int(round(clamp(value, min: 0, max: 1) * 100)))%"
    }
}

private struct WidgetTheme {
    let bgTop: Color
    let bgBottom: Color
    let haloPrimary: Color
    let haloSecondary: Color
    let card: Color
    let cardStrong: Color
    let border: Color
    let textPrimary: Color
    let textSecondary: Color
    let accentBlue: Color
    let accentMint: Color
    let accentLime: Color
    let accentOrange: Color
    let accentPurple: Color

    static func current(for scheme: ColorScheme) -> WidgetTheme {
        if scheme == .dark {
            return WidgetTheme(
                bgTop: Color(red: 0.05, green: 0.08, blue: 0.17),
                bgBottom: Color(red: 0.06, green: 0.13, blue: 0.28),
                haloPrimary: Color(red: 0.44, green: 0.38, blue: 1.0).opacity(0.28),
                haloSecondary: Color(red: 0.40, green: 0.86, blue: 1.0).opacity(0.20),
                card: Color.white.opacity(0.12),
                cardStrong: Color.white.opacity(0.17),
                border: Color.white.opacity(0.20),
                textPrimary: Color.white.opacity(0.98),
                textSecondary: Color.white.opacity(0.78),
                accentBlue: Color(red: 0.38, green: 0.60, blue: 1.0),
                accentMint: Color(red: 0.37, green: 0.90, blue: 0.82),
                accentLime: Color(red: 0.76, green: 0.98, blue: 0.44),
                accentOrange: Color(red: 1.0, green: 0.78, blue: 0.43),
                accentPurple: Color(red: 0.60, green: 0.49, blue: 1.0)
            )
        }

        return WidgetTheme(
            bgTop: Color(red: 0.88, green: 0.93, blue: 1.0),
            bgBottom: Color(red: 0.82, green: 0.90, blue: 1.0),
            haloPrimary: Color(red: 0.45, green: 0.38, blue: 1.0).opacity(0.18),
            haloSecondary: Color(red: 0.38, green: 0.82, blue: 0.98).opacity(0.16),
            card: Color.white.opacity(0.82),
            cardStrong: Color.white.opacity(0.94),
            border: Color.white.opacity(0.88),
            textPrimary: Color(red: 0.11, green: 0.16, blue: 0.29),
            textSecondary: Color(red: 0.25, green: 0.31, blue: 0.48).opacity(0.90),
            accentBlue: Color(red: 0.23, green: 0.50, blue: 1.0),
            accentMint: Color(red: 0.17, green: 0.76, blue: 0.72),
            accentLime: Color(red: 0.70, green: 0.88, blue: 0.30),
            accentOrange: Color(red: 0.95, green: 0.67, blue: 0.28),
            accentPurple: Color(red: 0.47, green: 0.38, blue: 0.93)
        )
    }
}

private struct WidgetCanvas<Content: View>: View {
    let content: Content
    @Environment(\.colorScheme) private var colorScheme

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
                        colors: [theme.bgTop, theme.bgBottom],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )

                    RadialGradient(
                        colors: [theme.haloPrimary, .clear],
                        center: .topLeading,
                        startRadius: 20,
                        endRadius: 200
                    )

                    RadialGradient(
                        colors: [theme.haloSecondary, .clear],
                        center: .bottomTrailing,
                        startRadius: 10,
                        endRadius: 170
                    )
                }
            }
    }
}

private struct SurfaceCard<Content: View>: View {
    let content: Content
    var radius: CGFloat = 12
    var highlighted: Bool = false
    var tint: Color? = nil

    @Environment(\.colorScheme) private var colorScheme

    init(
        radius: CGFloat = 12,
        highlighted: Bool = false,
        tint: Color? = nil,
        @ViewBuilder content: () -> Content
    ) {
        self.radius = radius
        self.highlighted = highlighted
        self.tint = tint
        self.content = content()
    }

    var body: some View {
        let theme = WidgetTheme.current(for: colorScheme)
        let glow = tint ?? theme.accentBlue

        content
            .padding(10)
            .background(
                RoundedRectangle(cornerRadius: radius, style: .continuous)
                    .fill(highlighted ? theme.cardStrong : theme.card)
                    .overlay(
                        RoundedRectangle(cornerRadius: radius, style: .continuous)
                            .stroke(theme.border, lineWidth: highlighted ? 1.0 : 0.8)
                    )
                    .shadow(
                        color: glow.opacity(highlighted ? (colorScheme == .dark ? 0.26 : 0.16) : 0.08),
                        radius: highlighted ? 8 : 2,
                        x: 0,
                        y: highlighted ? 5 : 1
                    )
            )
    }
}

private struct ActionPill: View {
    let title: String
    let symbol: String
    let url: URL

    @Environment(\.colorScheme) private var colorScheme

    init(title: String, symbol: String, link: String) {
        self.title = title
        self.symbol = symbol
        self.url = URL(string: link) ?? URL(string: WidgetLinks.dashboard)!
    }

    var body: some View {
        let theme = WidgetTheme.current(for: colorScheme)

        Link(destination: url) {
            HStack(spacing: 4) {
                Image(systemName: symbol)
                    .font(.system(size: 10, weight: .semibold))
                Text(title)
                    .font(.system(size: 11, weight: .bold, design: .rounded))
                    .lineLimit(1)
                    .minimumScaleFactor(0.82)
            }
            .frame(maxWidth: .infinity)
            .foregroundStyle(theme.textPrimary)
            .padding(.vertical, 6)
            .background(
                Capsule(style: .continuous)
                    .fill(theme.card)
                    .overlay(
                        Capsule(style: .continuous)
                            .stroke(theme.border, lineWidth: 0.8)
                    )
            )
        }
        .buttonStyle(.plain)
    }
}

private struct MiniStat: View {
    let title: String
    let value: String
    let tone: Color

    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        let theme = WidgetTheme.current(for: colorScheme)

        SurfaceCard(radius: 11, highlighted: false, tint: tone) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: 10, weight: .semibold, design: .rounded))
                    .foregroundStyle(theme.textSecondary)
                    .lineLimit(1)

                Text(value)
                    .font(.system(size: 13, weight: .heavy, design: .rounded))
                    .foregroundStyle(theme.textPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

private struct ScoreBadge: View {
    let value: Int
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        let theme = WidgetTheme.current(for: colorScheme)

        Text("\(value)")
            .font(.system(size: 19, weight: .heavy, design: .rounded))
            .foregroundStyle(theme.textPrimary)
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(
                Capsule(style: .continuous)
                    .fill(theme.cardStrong)
                    .overlay(
                        Capsule(style: .continuous)
                            .stroke(theme.border, lineWidth: 0.9)
                    )
            )
    }
}

private struct RingSlice: Identifiable {
    let id = UUID()
    let label: String
    let value: Double
    let color: Color
    let start: Double
    let end: Double
}

private func distributionSlices(for snapshot: FingendaSnapshot, theme: WidgetTheme) -> [RingSlice] {
    let expenseRaw = clamp(snapshot.spendRatio, min: 0.14, max: 0.58)
    let savingsRaw = clamp(snapshot.savingsRatio, min: 0.10, max: 0.46)
    let fxRaw = (snapshot.usdTry > 0 || snapshot.eurTry > 0) ? 0.16 : 0.10
    let otherRaw = clamp(1 - (expenseRaw + savingsRaw + fxRaw), min: 0.10, max: 0.34)

    let rows: [(String, Double, Color)] = [
        ("Gider", expenseRaw, theme.accentPurple),
        ("Birikim", savingsRaw, theme.accentMint),
        ("Doviz", fxRaw, theme.accentOrange),
        ("Diger", otherRaw, theme.accentLime)
    ]

    let sum = max(rows.reduce(0) { $0 + $1.1 }, 0.0001)
    let gap = 0.015
    let usableRange = 1 - (Double(rows.count) * gap)
    var cursor = 0.0

    return rows.map { row in
        let normalized = (row.1 / sum) * usableRange
        defer { cursor += normalized + gap }
        return RingSlice(
            label: row.0,
            value: row.1 / sum,
            color: row.2,
            start: cursor,
            end: cursor + normalized
        )
    }
}

private struct SegmentedRing: View {
    let slices: [RingSlice]

    var body: some View {
        ZStack {
            Circle()
                .stroke(.white.opacity(0.12), lineWidth: 14)

            ForEach(slices) { item in
                Circle()
                    .trim(from: item.start, to: item.end)
                    .stroke(
                        item.color,
                        style: StrokeStyle(lineWidth: 14, lineCap: .round, lineJoin: .round)
                    )
                    .rotationEffect(.degrees(-90))
                    .shadow(color: item.color.opacity(0.36), radius: 3, x: 0, y: 0)
            }
        }
    }
}

private struct SparklineShape: Shape {
    let points: [Double]

    func path(in rect: CGRect) -> Path {
        guard points.count > 1 else { return Path() }

        let step = rect.width / CGFloat(points.count - 1)
        var path = Path()

        for (index, value) in points.enumerated() {
            let x = CGFloat(index) * step
            let y = rect.height * CGFloat(1 - value)
            if index == 0 {
                path.move(to: CGPoint(x: x, y: y))
            } else {
                path.addLine(to: CGPoint(x: x, y: y))
            }
        }

        return path
    }
}

private func marketTrend(from snapshot: FingendaSnapshot) -> [Double] {
    let base = clamp((snapshot.income - snapshot.expense) / max(snapshot.income, 1), min: -0.8, max: 0.9)
    let fxSignal = clamp((snapshot.usdTry + snapshot.eurTry) / 100.0, min: 0.0, max: 1.0)

    return [
        0.35 + (base * 0.12),
        0.42 + (fxSignal * 0.10),
        0.38 + (base * 0.09),
        0.44 + (snapshot.savingsRatio * 0.15),
        0.41 + (base * 0.07),
        0.46 + (snapshot.normalizedGoalProgress * 0.18),
        0.50 + (snapshot.savingsRatio * 0.20)
    ].map { clamp($0, min: 0.12, max: 0.88) }
}

private struct CashStatusWidgetView: View {
    let entry: FingendaEntry
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        let theme = WidgetTheme.current(for: colorScheme)

        WidgetCanvas {
            VStack(spacing: 9) {
                HStack {
                    Text("Nakit Durumu")
                        .font(.system(size: 16, weight: .heavy, design: .rounded))
                        .foregroundStyle(theme.textPrimary)
                        .lineLimit(1)

                    Spacer(minLength: 4)

                    Text(entry.snapshot.hasData ? "Canli" : "Hazir")
                        .font(.system(size: 10, weight: .bold, design: .rounded))
                        .foregroundStyle(theme.textSecondary)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(
                            Capsule(style: .continuous)
                                .fill(theme.cardStrong)
                        )
                }

                SurfaceCard(radius: 12, highlighted: true, tint: theme.accentBlue) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Net Bakiye")
                            .font(.system(size: 11, weight: .semibold, design: .rounded))
                            .foregroundStyle(theme.textSecondary)

                        Text(WidgetText.currency(entry.snapshot.netBalance))
                            .font(.system(size: 34, weight: .heavy, design: .rounded))
                            .foregroundStyle(theme.textPrimary)
                            .lineLimit(1)
                            .minimumScaleFactor(0.65)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }

                HStack(spacing: 8) {
                    MiniStat(
                        title: "Baski",
                        value: WidgetText.percent(from: clamp(entry.snapshot.spendRatio / 1.2, min: 0, max: 1)),
                        tone: theme.accentOrange
                    )
                    MiniStat(
                        title: "Birikim",
                        value: WidgetText.currency(entry.snapshot.savings),
                        tone: theme.accentMint
                    )
                }

                HStack(spacing: 8) {
                    ActionPill(title: "Gider", symbol: "minus.circle.fill", link: WidgetLinks.quickExpense)
                    ActionPill(title: "Sesle", symbol: "waveform.badge.mic", link: WidgetLinks.voiceAdd)
                }
            }
        }
        .widgetURL(URL(string: WidgetLinks.dashboard))
    }
}

private struct DnaSummaryWidgetView: View {
    let entry: FingendaEntry
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        let theme = WidgetTheme.current(for: colorScheme)
        let slices = distributionSlices(for: entry.snapshot, theme: theme)

        WidgetCanvas {
            VStack(spacing: 9) {
                HStack {
                    VStack(alignment: .leading, spacing: 1) {
                        Text("Fingenda • Harcama DNA")
                            .font(.system(size: 14, weight: .heavy, design: .rounded))
                            .foregroundStyle(theme.textPrimary)
                            .lineLimit(1)
                        Text("Son 30 gun")
                            .font(.system(size: 10, weight: .semibold, design: .rounded))
                            .foregroundStyle(theme.textSecondary)
                    }

                    Spacer(minLength: 6)
                    ScoreBadge(value: entry.snapshot.scoreValue)
                }

                HStack(spacing: 10) {
                    ZStack {
                        Circle()
                            .fill(theme.card.opacity(0.75))
                            .frame(width: 112, height: 112)

                        SegmentedRing(slices: slices)
                            .frame(width: 98, height: 98)

                        VStack(spacing: 0) {
                            Text("DAGILIM")
                                .font(.system(size: 8, weight: .bold, design: .rounded))
                                .foregroundStyle(theme.textSecondary)
                            Text(WidgetText.percent(from: clamp(entry.snapshot.spendRatio / 1.4, min: 0, max: 1)))
                                .font(.system(size: 20, weight: .heavy, design: .rounded))
                                .foregroundStyle(theme.textPrimary)
                        }
                    }

                    VStack(spacing: 7) {
                        ForEach(slices) { row in
                            HStack(spacing: 7) {
                                Circle()
                                    .fill(row.color)
                                    .frame(width: 7, height: 7)
                                Text(row.label)
                                    .font(.system(size: 11, weight: .bold, design: .rounded))
                                    .foregroundStyle(theme.textSecondary)
                                    .lineLimit(1)
                                Spacer(minLength: 4)
                                Text("\(Int(round(row.value * 100)))%")
                                    .font(.system(size: 11, weight: .heavy, design: .rounded))
                                    .foregroundStyle(theme.textPrimary)
                                    .lineLimit(1)
                            }
                            .padding(.horizontal, 8)
                            .padding(.vertical, 5)
                            .background(
                                Capsule(style: .continuous)
                                    .fill(theme.card)
                            )
                        }
                    }
                }
                .frame(maxWidth: .infinity)

                HStack(spacing: 8) {
                    ActionPill(title: "Gider", symbol: "minus.circle.fill", link: WidgetLinks.quickExpense)
                    ActionPill(title: "Gelir", symbol: "plus.circle.fill", link: WidgetLinks.quickIncome)
                    ActionPill(title: "Doviz", symbol: "chart.xyaxis.line", link: WidgetLinks.market)
                }
            }
        }
        .widgetURL(URL(string: WidgetLinks.dashboard))
    }
}

private struct MarketPulseWidgetView: View {
    let entry: FingendaEntry
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        let theme = WidgetTheme.current(for: colorScheme)
        let trend = marketTrend(from: entry.snapshot)
        let hasRates = entry.snapshot.usdTry > 0 || entry.snapshot.eurTry > 0

        WidgetCanvas {
            VStack(spacing: 9) {
                HStack {
                    Text("Doviz Nabzi")
                        .font(.system(size: 14, weight: .heavy, design: .rounded))
                        .foregroundStyle(theme.textPrimary)
                        .lineLimit(1)
                    Spacer(minLength: 4)
                    Text(hasRates ? "Canli" : "Bekliyor")
                        .font(.system(size: 10, weight: .bold, design: .rounded))
                        .foregroundStyle(theme.textSecondary)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Capsule(style: .continuous).fill(theme.cardStrong))
                }

                HStack(spacing: 8) {
                    MiniStat(
                        title: "USD/TRY",
                        value: entry.snapshot.usdTry > 0 ? WidgetText.decimal(entry.snapshot.usdTry) : "--",
                        tone: theme.accentBlue
                    )
                    MiniStat(
                        title: "EUR/TRY",
                        value: entry.snapshot.eurTry > 0 ? WidgetText.decimal(entry.snapshot.eurTry) : "--",
                        tone: theme.accentMint
                    )
                }

                SurfaceCard(radius: 11, highlighted: true, tint: theme.accentMint) {
                    ZStack {
                        RoundedRectangle(cornerRadius: 8, style: .continuous)
                            .fill(theme.card)

                        SparklineShape(points: trend)
                            .stroke(
                                LinearGradient(
                                    colors: [theme.accentLime, theme.accentMint, theme.accentBlue, theme.accentPurple],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                ),
                                style: StrokeStyle(lineWidth: 3.2, lineCap: .round, lineJoin: .round)
                            )
                            .padding(.horizontal, 9)
                            .padding(.vertical, 8)
                    }
                }
                .frame(height: 58)

                HStack(spacing: 8) {
                    ActionPill(title: "Piyasa", symbol: "chart.line.uptrend.xyaxis", link: WidgetLinks.market)
                    ActionPill(title: "Sesle Ekle", symbol: "waveform.badge.mic", link: WidgetLinks.voiceAdd)
                }
            }
        }
        .widgetURL(URL(string: WidgetLinks.market))
    }
}

private struct DailyPulseWidgetView: View {
    let entry: FingendaEntry
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        let theme = WidgetTheme.current(for: colorScheme)

        WidgetCanvas {
            VStack(spacing: 9) {
                HStack {
                    Text("Gunluk Durum")
                        .font(.system(size: 14, weight: .heavy, design: .rounded))
                        .foregroundStyle(theme.textPrimary)
                    Spacer(minLength: 4)
                    Text("Bugun")
                        .font(.system(size: 10, weight: .bold, design: .rounded))
                        .foregroundStyle(theme.textSecondary)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Capsule(style: .continuous).fill(theme.cardStrong))
                }

                HStack(spacing: 8) {
                    MiniStat(title: "Gelir", value: WidgetText.currency(entry.snapshot.income), tone: theme.accentMint)
                    MiniStat(title: "Gider", value: WidgetText.currency(entry.snapshot.expense), tone: theme.accentOrange)
                    MiniStat(title: "Net", value: WidgetText.currency(entry.snapshot.netBalance), tone: theme.accentBlue)
                }

                SurfaceCard(radius: 11, highlighted: true, tint: theme.accentPurple) {
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            Text("Hedef ilerleme")
                                .font(.system(size: 10, weight: .semibold, design: .rounded))
                                .foregroundStyle(theme.textSecondary)
                            Spacer(minLength: 4)
                            Text(WidgetText.percent(from: entry.snapshot.normalizedGoalProgress))
                                .font(.system(size: 11, weight: .heavy, design: .rounded))
                                .foregroundStyle(theme.textPrimary)
                        }

                        GeometryReader { geo in
                            let width = geo.size.width
                            let progressWidth = max(12, width * entry.snapshot.normalizedGoalProgress)

                            ZStack(alignment: .leading) {
                                Capsule(style: .continuous)
                                    .fill(theme.card)

                                Capsule(style: .continuous)
                                    .fill(
                                        LinearGradient(
                                            colors: [theme.accentMint, theme.accentBlue, theme.accentPurple],
                                            startPoint: .leading,
                                            endPoint: .trailing
                                        )
                                    )
                                    .frame(width: progressWidth)
                            }
                        }
                        .frame(height: 8)

                        Text("Seri: \(entry.snapshot.streakDays) gun")
                            .font(.system(size: 10, weight: .bold, design: .rounded))
                            .foregroundStyle(theme.textSecondary)
                            .lineLimit(1)
                    }
                }
                .frame(height: 64)

                HStack(spacing: 8) {
                    ActionPill(title: "Gider", symbol: "minus.circle.fill", link: WidgetLinks.quickExpense)
                    ActionPill(title: "Gelir", symbol: "plus.circle.fill", link: WidgetLinks.quickIncome)
                    ActionPill(title: "Panel", symbol: "square.grid.2x2.fill", link: WidgetLinks.dashboard)
                }
            }
        }
        .widgetURL(URL(string: WidgetLinks.dashboard))
    }
}

private struct FingendaCashStatusWidget: Widget {
    let kind: String = "FingendaBalanceStackWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: FingendaProvider()) { entry in
            CashStatusWidgetView(entry: entry)
        }
        .configurationDisplayName("Nakit Durumu")
        .description("Net bakiye, baski ve birikim ozetini hizli gor.")
        .supportedFamilies([.systemSmall])
    }
}

private struct FingendaDnaSummaryWidget: Widget {
    let kind: String = "FingendaExpenseRingWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: FingendaProvider()) { entry in
            DnaSummaryWidgetView(entry: entry)
        }
        .configurationDisplayName("Harcama DNA")
        .description("Kategori dagilimi ve finans skorunu takip et.")
        .supportedFamilies([.systemMedium])
    }
}

private struct FingendaMarketPulseWidget: Widget {
    let kind: String = "FingendaMarketPulseWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: FingendaProvider()) { entry in
            MarketPulseWidgetView(entry: entry)
        }
        .configurationDisplayName("Doviz Nabzi")
        .description("USD/EUR kuru ve trendini sade bir panelde gor.")
        .supportedFamilies([.systemMedium])
    }
}

private struct FingendaDailyPulseWidget: Widget {
    let kind: String = "FingendaPerformanceBarsWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: FingendaProvider()) { entry in
            DailyPulseWidgetView(entry: entry)
        }
        .configurationDisplayName("Gunluk Durum")
        .description("Gelir, gider ve hedef ilerlemesini tek bakista takip et.")
        .supportedFamilies([.systemMedium])
    }
}

@main
struct FingendaWidgetBundle: WidgetBundle {
    var body: some Widget {
        FingendaCashStatusWidget()
        FingendaDnaSummaryWidget()
        FingendaMarketPulseWidget()
        FingendaDailyPulseWidget()
    }
}

private func clamp(_ value: Double, min lower: Double, max upper: Double) -> Double {
    Swift.max(lower, Swift.min(upper, value))
}
