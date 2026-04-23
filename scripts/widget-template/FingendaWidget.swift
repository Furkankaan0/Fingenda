import WidgetKit
import SwiftUI

private enum SharedData {
    static var appGroupCandidates: [String] {
        var groups: [String] = []

        if let bundleId = Bundle.main.bundleIdentifier {
            let appBundleId = bundleId.replacingOccurrences(of: ".widget", with: "")
            if !appBundleId.isEmpty {
                groups.append("group.\(appBundleId)")
            }
        }

        groups.append("group.com.fingenda.app")
        groups.append("group.com.fingenda")

        var seen = Set<String>()
        return groups.filter { candidate in
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

    static func currentSnapshot() -> FingendaSnapshot {
        let store = appGroupCandidates.compactMap { UserDefaults(suiteName: $0) }.first ?? UserDefaults.standard

        if let payload = readSnapshotPayload(store) {
            return payload
        }

        return FingendaSnapshot(
            income: readNumber(store, keys: incomeKeys),
            expense: readNumber(store, keys: expenseKeys),
            usdTry: readNumber(store, keys: usdKeys),
            eurTry: readNumber(store, keys: eurKeys),
            savings: readNumber(store, keys: savingsKeys),
            streakDays: readInt(store, keys: streakKeys),
            goalProgress: readNumber(store, keys: goalProgressKeys)
        )
    }

    private static func readSnapshotPayload(_ defaults: UserDefaults) -> FingendaSnapshot? {
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
        if let n = value as? NSNumber {
            return n.doubleValue
        }
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

    var spendPressure: Double {
        let ref = max(income, 1)
        return clamp(expense / ref, min: 0, max: 1.5)
    }

    var savingsRate: Double {
        let ref = max(income, 1)
        return clamp(savings / ref, min: 0, max: 1)
    }

    var normalizedGoalProgress: Double {
        if goalProgress > 1 {
            return clamp(goalProgress / 100.0, min: 0, max: 1)
        }
        return clamp(goalProgress, min: 0, max: 1)
    }

    var scoreValue: Int {
        let pressurePenalty = spendPressure * 55
        let savingsBoost = savingsRate * 28
        let streakBoost = clamp(Double(streakDays) / 20.0, min: 0, max: 1) * 12
        let result = 80 - pressurePenalty + savingsBoost + streakBoost
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
                income: 21240,
                expense: 14320,
                usdTry: 39.18,
                eurTry: 42.55,
                savings: 6920,
                streakDays: 8,
                goalProgress: 0.58
            )
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (FingendaEntry) -> Void) {
        completion(FingendaEntry(date: Date(), snapshot: SharedData.currentSnapshot()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<FingendaEntry>) -> Void) {
        let now = Date()
        let entry = FingendaEntry(date: now, snapshot: SharedData.currentSnapshot())
        let refreshDate = Calendar.current.date(byAdding: .minute, value: 1, to: now) ?? now.addingTimeInterval(60)
        completion(Timeline(entries: [entry], policy: .after(refreshDate)))
    }
}

private enum WidgetLinks {
    static let quickExpense = "fingenda://widget?action=quick-expense"
    static let quickIncome = "fingenda://widget?action=quick-income"
    static let voiceAdd = "fingenda://widget?action=voice-add"
    static let market = "fingenda://widget?action=open-market"
    static let dashboard = "fingenda://widget?tab=dashboard"
}

private enum WidgetFormatters {
    static let currency: NumberFormatter = {
        let f = NumberFormatter()
        f.numberStyle = .currency
        f.locale = Locale(identifier: "tr_TR")
        f.maximumFractionDigits = 0
        return f
    }()

    static let decimal: NumberFormatter = {
        let f = NumberFormatter()
        f.numberStyle = .decimal
        f.locale = Locale(identifier: "tr_TR")
        f.minimumFractionDigits = 2
        f.maximumFractionDigits = 2
        return f
    }()
}

private func formatCurrency(_ value: Double) -> String {
    WidgetFormatters.currency.string(from: NSNumber(value: value)) ?? "0 TL"
}

private func formatFX(_ value: Double) -> String {
    WidgetFormatters.decimal.string(from: NSNumber(value: value)) ?? "0,00"
}

private func formatPercent(_ value: Double) -> String {
    "\(Int(round(value * 100)))%"
}

private func clamp(_ value: Double, min lower: Double, max upper: Double) -> Double {
    Swift.max(lower, Swift.min(upper, value))
}

private struct WidgetPalette {
    let backgroundStart: Color
    let backgroundEnd: Color
    let glowPrimary: Color
    let glowSecondary: Color
    let cardStart: Color
    let cardEnd: Color
    let cardBorder: Color
    let textPrimary: Color
    let textSecondary: Color
    let chipStart: Color
    let chipEnd: Color
    let chipBorder: Color
    let scoreAccent: Color

    static func forScheme(_ scheme: ColorScheme) -> WidgetPalette {
        if scheme == .dark {
            return WidgetPalette(
                backgroundStart: Color(red: 0.05, green: 0.08, blue: 0.17),
                backgroundEnd: Color(red: 0.07, green: 0.14, blue: 0.30),
                glowPrimary: Color(red: 0.48, green: 0.43, blue: 1.0).opacity(0.34),
                glowSecondary: Color(red: 0.53, green: 0.98, blue: 0.83).opacity(0.18),
                cardStart: Color.white.opacity(0.11),
                cardEnd: Color.white.opacity(0.07),
                cardBorder: Color.white.opacity(0.17),
                textPrimary: Color.white.opacity(0.98),
                textSecondary: Color.white.opacity(0.72),
                chipStart: Color.white.opacity(0.20),
                chipEnd: Color.white.opacity(0.12),
                chipBorder: Color.white.opacity(0.22),
                scoreAccent: Color(red: 0.66, green: 0.96, blue: 0.50)
            )
        }

        return WidgetPalette(
            backgroundStart: Color(red: 0.88, green: 0.93, blue: 1.0),
            backgroundEnd: Color(red: 0.82, green: 0.89, blue: 1.0),
            glowPrimary: Color(red: 0.45, green: 0.38, blue: 1.0).opacity(0.22),
            glowSecondary: Color(red: 0.39, green: 0.82, blue: 0.96).opacity(0.16),
            cardStart: Color.white.opacity(0.88),
            cardEnd: Color.white.opacity(0.72),
            cardBorder: Color.white.opacity(0.78),
            textPrimary: Color(red: 0.11, green: 0.16, blue: 0.29),
            textSecondary: Color(red: 0.26, green: 0.32, blue: 0.49).opacity(0.92),
            chipStart: Color.white.opacity(0.94),
            chipEnd: Color.white.opacity(0.80),
            chipBorder: Color.white.opacity(0.82),
            scoreAccent: Color(red: 0.20, green: 0.45, blue: 1.0)
        )
    }
}

private struct WidgetSurface<Content: View>: View {
    let content: Content
    @Environment(\.colorScheme) private var colorScheme

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        let palette = WidgetPalette.forScheme(colorScheme)

        content
            .padding(14)
            .containerBackground(for: .widget) {
                ZStack {
                    LinearGradient(
                        colors: [palette.backgroundStart, palette.backgroundEnd],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )

                    RadialGradient(
                        colors: [palette.glowPrimary, .clear],
                        center: .topLeading,
                        startRadius: 12,
                        endRadius: 220
                    )

                    RadialGradient(
                        colors: [palette.glowSecondary, .clear],
                        center: .bottomTrailing,
                        startRadius: 12,
                        endRadius: 200
                    )

                    RoundedRectangle(cornerRadius: 28, style: .continuous)
                        .stroke(
                            LinearGradient(
                                colors: [palette.cardBorder.opacity(0.95), .clear, palette.cardBorder.opacity(0.55)],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            ),
                            lineWidth: 0.9
                        )
                        .padding(0.5)
                }
            }
    }
}

private struct NeonCard<Content: View>: View {
    let content: Content
    var radius: CGFloat = 14
    var highlighted: Bool = false
    var tint: Color? = nil
    @Environment(\.colorScheme) private var colorScheme

    init(
        radius: CGFloat = 14,
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
        let palette = WidgetPalette.forScheme(colorScheme)
        let accent = tint ?? palette.scoreAccent

        content
            .padding(10)
            .background(
                RoundedRectangle(cornerRadius: radius, style: .continuous)
                    .fill(
                        LinearGradient(
                            colors: [palette.cardStart, palette.cardEnd],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: radius, style: .continuous)
                            .stroke(
                                highlighted
                                    ? accent.opacity(colorScheme == .dark ? 0.34 : 0.30)
                                    : palette.cardBorder.opacity(colorScheme == .dark ? 0.95 : 0.75),
                                lineWidth: highlighted ? 1.0 : 0.8
                            )
                    )
                    .shadow(
                        color: (highlighted ? accent : .black).opacity(colorScheme == .dark ? 0.22 : 0.12),
                        radius: highlighted ? 10 : 5,
                        x: 0,
                        y: highlighted ? 6 : 3
                    )
            )
    }
}

private struct ActionChip: View {
    let title: String
    let symbol: String
    let link: String
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        let palette = WidgetPalette.forScheme(colorScheme)

        Link(destination: URL(string: link)!) {
            HStack(spacing: 5) {
                Image(systemName: symbol)
                    .font(.system(size: 10, weight: .semibold))
                Text(title)
                    .font(.system(size: 11, weight: .bold, design: .rounded))
                    .lineLimit(1)
                    .minimumScaleFactor(0.85)
            }
            .foregroundStyle(palette.textPrimary)
            .padding(.vertical, 6)
            .frame(maxWidth: .infinity)
            .background(
                Capsule(style: .continuous)
                    .fill(
                        LinearGradient(
                            colors: [palette.chipStart, palette.chipEnd],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .overlay(
                        Capsule(style: .continuous)
                            .stroke(palette.chipBorder.opacity(0.9), lineWidth: 0.8)
                    )
            )
        }
        .buttonStyle(.plain)
    }
}

private struct RingSlice: Identifiable {
    let id = UUID()
    let label: String
    let color: Color
    let start: Double
    let end: Double
    let percent: Int
}

private func ringSlices(from snapshot: FingendaSnapshot) -> [RingSlice] {
    let savingsWeight = clamp(snapshot.savingsRate * 0.9, min: 0.12, max: 0.46)
    let spendWeight = clamp(snapshot.spendPressure * 0.52, min: 0.18, max: 0.58)
    let marketWeight = clamp((snapshot.usdTry + snapshot.eurTry) > 0 ? 0.16 : 0.11, min: 0.10, max: 0.22)
    let reserveWeight = clamp(1 - (savingsWeight + spendWeight + marketWeight), min: 0.10, max: 0.30)

    let raw = [
        ("Gider", Color(red: 0.50, green: 0.45, blue: 1.0), spendWeight),
        ("Birikim", Color(red: 0.33, green: 0.89, blue: 0.78), savingsWeight),
        ("Doviz", Color(red: 1.0, green: 0.82, blue: 0.47), marketWeight),
        ("Diger", Color(red: 0.78, green: 1.0, blue: 0.47), reserveWeight)
    ]

    let total = max(raw.reduce(0) { $0 + $1.2 }, 0.001)
    let gap = 0.018
    let usable = 1 - (gap * Double(raw.count))
    var cursor = 0.0

    return raw.map { item in
        let normalized = (item.2 / total) * usable
        defer { cursor += normalized + gap }
        return RingSlice(
            label: item.0,
            color: item.1,
            start: cursor,
            end: cursor + normalized,
            percent: Int(round((item.2 / total) * 100))
        )
    }
}

private struct SegmentedRing: View {
    let slices: [RingSlice]

    var body: some View {
        ZStack {
            Circle()
                .stroke(.white.opacity(0.08), lineWidth: 16)

            ForEach(slices) { slice in
                Circle()
                    .trim(from: slice.start, to: slice.end)
                    .stroke(
                        slice.color,
                        style: StrokeStyle(lineWidth: 16, lineCap: .round, lineJoin: .round)
                    )
                    .rotationEffect(.degrees(-90))
                    .shadow(color: slice.color.opacity(0.45), radius: 4, x: 0, y: 0)
            }
        }
    }
}

private struct ExpenseRingWidgetView: View {
    let entry: FingendaEntry
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        WidgetSurface {
            let slices = ringSlices(from: entry.snapshot)
            let palette = WidgetPalette.forScheme(colorScheme)

            VStack(alignment: .leading, spacing: 9) {
                HStack(spacing: 8) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Fingenda • Harcama DNA")
                            .font(.system(size: 14, weight: .heavy, design: .rounded))
                            .foregroundStyle(palette.textPrimary)
                        Text("Son 30 gun")
                            .font(.system(size: 10, weight: .semibold, design: .rounded))
                            .foregroundStyle(palette.textSecondary)
                    }
                    Spacer(minLength: 0)
                    NeonCard(radius: 11, highlighted: true, tint: palette.scoreAccent) {
                        VStack(alignment: .trailing, spacing: 1) {
                            Text("SKOR")
                                .font(.system(size: 9, weight: .bold, design: .rounded))
                                .foregroundStyle(palette.textSecondary)
                            Text("\(entry.snapshot.scoreValue)")
                                .font(.system(size: 20, weight: .heavy, design: .rounded))
                                .foregroundStyle(palette.textPrimary)
                        }
                    }
                    .frame(width: 74)
                }

                HStack(spacing: 12) {
                    ZStack {
                        Circle()
                            .fill(.white.opacity(colorScheme == .dark ? 0.04 : 0.24))
                            .frame(width: 124, height: 124)
                        SegmentedRing(slices: slices)
                            .frame(width: 114, height: 114)

                        VStack(spacing: 0) {
                            Text("DAGILIM")
                                .font(.system(size: 8, weight: .bold, design: .rounded))
                                .foregroundStyle(palette.textSecondary)
                            Text("\(Int(round(entry.snapshot.spendPressure * 100)))%")
                                .font(.system(size: 18, weight: .heavy, design: .rounded))
                                .foregroundStyle(palette.textPrimary)
                        }
                    }

                    VStack(alignment: .leading, spacing: 7) {
                        ForEach(slices) { item in
                            HStack(spacing: 6) {
                                Circle()
                                    .fill(item.color)
                                    .frame(width: 7, height: 7)
                                Text(item.label)
                                    .font(.system(size: 10, weight: .bold, design: .rounded))
                                    .foregroundStyle(palette.textSecondary)
                                    .lineLimit(1)
                                Spacer(minLength: 3)
                                Text("\(item.percent)%")
                                    .font(.system(size: 10, weight: .heavy, design: .rounded))
                                    .foregroundStyle(palette.textPrimary)
                            }
                            .padding(.horizontal, 7)
                            .padding(.vertical, 5)
                            .background(
                                Capsule(style: .continuous)
                                    .fill(.white.opacity(colorScheme == .dark ? 0.09 : 0.50))
                            )
                        }
                    }
                }

                HStack(spacing: 7) {
                    ActionChip(title: "Gider", symbol: "minus.circle.fill", link: WidgetLinks.quickExpense)
                    ActionChip(title: "Gelir", symbol: "plus.circle.fill", link: WidgetLinks.quickIncome)
                    ActionChip(title: "Doviz", symbol: "chart.xyaxis.line", link: WidgetLinks.market)
                }
            }
        }
        .widgetURL(URL(string: WidgetLinks.dashboard))
    }
}

private struct BalanceStackWidgetView: View {
    let entry: FingendaEntry
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        WidgetSurface {
            let palette = WidgetPalette.forScheme(colorScheme)

            VStack(spacing: 8) {
                HStack {
                    Text("Nakit Durumu")
                        .font(.system(size: 13, weight: .heavy, design: .rounded))
                        .foregroundStyle(palette.textPrimary)
                    Spacer(minLength: 0)
                    Text(entry.snapshot.hasData ? "Canli" : "Hazir")
                        .font(.system(size: 10, weight: .bold, design: .rounded))
                        .foregroundStyle(palette.textSecondary)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(
                            Capsule(style: .continuous)
                                .fill(.white.opacity(colorScheme == .dark ? 0.13 : 0.55))
                        )
                }

                NeonCard(radius: 16, highlighted: true, tint: palette.scoreAccent) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Net Bakiye")
                            .font(.system(size: 10, weight: .bold, design: .rounded))
                            .foregroundStyle(palette.textSecondary)
                        Text(formatCurrency(entry.snapshot.netBalance))
                            .font(.system(size: 26, weight: .heavy, design: .rounded))
                            .foregroundStyle(palette.textPrimary)
                            .lineLimit(1)
                            .minimumScaleFactor(0.72)
                    }
                }

                HStack(spacing: 8) {
                    NeonCard(radius: 14, tint: Color(red: 0.52, green: 0.88, blue: 1.0)) {
                        VStack(alignment: .leading, spacing: 3) {
                            Text("Baski")
                                .font(.system(size: 10, weight: .semibold, design: .rounded))
                                .foregroundStyle(palette.textSecondary)
                            Text(formatPercent(entry.snapshot.spendPressure))
                                .font(.system(size: 16, weight: .heavy, design: .rounded))
                                .foregroundStyle(palette.textPrimary)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }

                    NeonCard(radius: 14, tint: Color(red: 0.58, green: 0.95, blue: 0.56)) {
                        VStack(alignment: .leading, spacing: 3) {
                            Text("Birikim")
                                .font(.system(size: 10, weight: .semibold, design: .rounded))
                                .foregroundStyle(palette.textSecondary)
                            Text(formatCurrency(entry.snapshot.savings))
                                .font(.system(size: 14, weight: .heavy, design: .rounded))
                                .foregroundStyle(palette.textPrimary)
                                .lineLimit(1)
                                .minimumScaleFactor(0.72)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }

                HStack(spacing: 8) {
                    ActionChip(title: "Gider", symbol: "minus.circle.fill", link: WidgetLinks.quickExpense)
                    ActionChip(title: "Sesle", symbol: "waveform.badge.mic", link: WidgetLinks.voiceAdd)
                }
            }
        }
        .widgetURL(URL(string: WidgetLinks.dashboard))
    }
}

private func performanceSeries(from snapshot: FingendaSnapshot) -> [Double] {
    let load = snapshot.spendPressure
    let savings = snapshot.savingsRate
    let base = [0.42, 0.56, 0.48, 0.64, 0.74]
    return base.enumerated().map { index, value in
        let drift = (Double(index) - 2) * 0.03
        return clamp(value - (load * 0.14) + (savings * 0.16) + drift, min: 0.15, max: 0.96)
    }
}

private struct PerformanceBarsWidgetView: View {
    let entry: FingendaEntry
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        WidgetSurface {
            let series = performanceSeries(from: entry.snapshot)
            let palette = WidgetPalette.forScheme(colorScheme)
            let growth = Int(round((1 - entry.snapshot.spendPressure) * 100))
            let labels = ["Pzt", "Sal", "Car", "Per", "Cum"]

            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("Performans")
                        .font(.system(size: 14, weight: .bold, design: .rounded))
                        .foregroundStyle(palette.textPrimary)
                    Spacer(minLength: 0)
                    Text("+\(growth)%")
                        .font(.system(size: 12, weight: .heavy, design: .rounded))
                        .foregroundStyle(palette.scoreAccent)
                }

                NeonCard(radius: 14) {
                    VStack(spacing: 6) {
                        HStack(alignment: .bottom, spacing: 7) {
                            ForEach(Array(series.enumerated()), id: \.offset) { index, value in
                                VStack(spacing: 4) {
                                    Text("\(Int(round(value * 100)))%")
                                        .font(.system(size: 9, weight: .bold, design: .rounded))
                                        .foregroundStyle(palette.textSecondary)

                                    RoundedRectangle(cornerRadius: 6, style: .continuous)
                                        .fill(
                                            LinearGradient(
                                                colors: [
                                                    Color(red: 0.52, green: 0.48, blue: 1.0),
                                                    Color(red: 0.71, green: 0.41, blue: 1.0)
                                                ],
                                                startPoint: .bottom,
                                                endPoint: .top
                                            )
                                        )
                                        .frame(height: 28 + (value * 48))
                                        .overlay(alignment: .top) {
                                            RoundedRectangle(cornerRadius: 6, style: .continuous)
                                                .fill(Color(red: 0.80, green: 1.0, blue: 0.45))
                                                .frame(height: 4)
                                        }
                                }
                                .frame(maxWidth: .infinity)
                                .overlay(alignment: .bottom) {
                                    Text(labels[index])
                                        .font(.system(size: 8, weight: .semibold, design: .rounded))
                                        .foregroundStyle(palette.textSecondary.opacity(0.85))
                                        .offset(y: 12)
                                }
                            }
                        }
                        .padding(.bottom, 10)

                        Capsule(style: .continuous)
                            .fill(.white.opacity(colorScheme == .dark ? 0.08 : 0.45))
                            .frame(height: 4)
                    }
                }

                HStack(spacing: 7) {
                    ActionChip(title: "Gelir", symbol: "plus.circle.fill", link: WidgetLinks.quickIncome)
                    ActionChip(title: "Doviz", symbol: "chart.line.uptrend.xyaxis", link: WidgetLinks.market)
                    ActionChip(title: "Panel", symbol: "square.grid.2x2.fill", link: WidgetLinks.dashboard)
                }
            }
        }
        .widgetURL(URL(string: WidgetLinks.dashboard))
    }
}

private func trendSeries(from snapshot: FingendaSnapshot) -> [Double] {
    let base = clamp((snapshot.income - snapshot.expense) / max(snapshot.income, 1), min: -0.8, max: 0.9)
    let fxPulse = clamp((snapshot.usdTry + snapshot.eurTry) / 100.0, min: 0.0, max: 1.0)
    return [
        0.20 + (base * 0.12),
        0.26 + (base * 0.22),
        0.22 + (fxPulse * 0.10),
        0.33 + (snapshot.savingsRate * 0.28),
        0.30 + (base * 0.20),
        0.41 + (snapshot.normalizedGoalProgress * 0.24),
        0.46 + (snapshot.savingsRate * 0.30)
    ].map { clamp($0, min: 0.10, max: 0.92) }
}

private struct TrendLineShape: Shape {
    let points: [Double]

    func path(in rect: CGRect) -> Path {
        guard points.count > 1 else { return Path() }

        let step = rect.width / CGFloat(points.count - 1)
        var path = Path()
        for (index, point) in points.enumerated() {
            let x = CGFloat(index) * step
            let y = rect.height * CGFloat(1 - point)
            if index == 0 {
                path.move(to: CGPoint(x: x, y: y))
            } else {
                path.addLine(to: CGPoint(x: x, y: y))
            }
        }
        return path
    }
}

private struct MarketPulseWidgetView: View {
    let entry: FingendaEntry
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        WidgetSurface {
            let series = trendSeries(from: entry.snapshot)
            let palette = WidgetPalette.forScheme(colorScheme)
            let hasFx = entry.snapshot.usdTry > 0 || entry.snapshot.eurTry > 0

            VStack(alignment: .leading, spacing: 9) {
                HStack {
                    Text("Doviz + Nakit")
                        .font(.system(size: 14, weight: .bold, design: .rounded))
                        .foregroundStyle(palette.textPrimary)
                    Spacer(minLength: 0)
                    Text(hasFx ? "Canli" : "Hazir")
                        .font(.system(size: 10, weight: .bold, design: .rounded))
                        .foregroundStyle(palette.textSecondary)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(
                            Capsule(style: .continuous)
                                .fill(.white.opacity(colorScheme == .dark ? 0.13 : 0.55))
                        )
                }

                HStack(spacing: 8) {
                    NeonCard(radius: 13, tint: Color(red: 0.48, green: 0.86, blue: 1.0)) {
                        VStack(alignment: .leading, spacing: 3) {
                            Text("USD/TRY")
                                .font(.system(size: 10, weight: .bold, design: .rounded))
                                .foregroundStyle(palette.textSecondary)
                            Text(entry.snapshot.usdTry > 0 ? formatFX(entry.snapshot.usdTry) : "--")
                                .font(.system(size: 16, weight: .heavy, design: .rounded))
                                .foregroundStyle(palette.textPrimary)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }

                    NeonCard(radius: 13, tint: Color(red: 0.68, green: 0.92, blue: 0.53)) {
                        VStack(alignment: .leading, spacing: 3) {
                            Text("EUR/TRY")
                                .font(.system(size: 10, weight: .bold, design: .rounded))
                                .foregroundStyle(palette.textSecondary)
                            Text(entry.snapshot.eurTry > 0 ? formatFX(entry.snapshot.eurTry) : "--")
                                .font(.system(size: 16, weight: .heavy, design: .rounded))
                                .foregroundStyle(palette.textPrimary)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }

                NeonCard(radius: 13) {
                    ZStack {
                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                            .fill(.white.opacity(colorScheme == .dark ? 0.03 : 0.35))

                        TrendLineShape(points: series)
                            .stroke(
                                LinearGradient(
                                    colors: [
                                        Color(red: 0.79, green: 1.0, blue: 0.40),
                                        Color(red: 0.44, green: 0.86, blue: 1.0),
                                        Color(red: 0.57, green: 0.50, blue: 1.0)
                                    ],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                ),
                                style: StrokeStyle(lineWidth: 3.0, lineCap: .round, lineJoin: .round)
                            )
                            .shadow(color: Color(red: 0.44, green: 0.86, blue: 1.0).opacity(0.35), radius: 4, x: 0, y: 0)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 8)
                    }

                    if !hasFx {
                        Text("Veri senkronu bekleniyor")
                            .font(.system(size: 9, weight: .semibold, design: .rounded))
                            .foregroundStyle(palette.textSecondary.opacity(0.85))
                            .padding(.top, 1)
                    }
                }
                .frame(height: 52)

                HStack(spacing: 7) {
                    ActionChip(title: "Doviz", symbol: "chart.xyaxis.line", link: WidgetLinks.market)
                    ActionChip(title: "Sesle", symbol: "waveform.badge.mic", link: WidgetLinks.voiceAdd)
                    ActionChip(title: "Panel", symbol: "square.grid.2x2.fill", link: WidgetLinks.dashboard)
                }
            }
        }
        .widgetURL(URL(string: WidgetLinks.market))
    }
}

struct FingendaExpenseRingWidget: Widget {
    let kind: String = "FingendaExpenseRingWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: FingendaProvider()) { entry in
            ExpenseRingWidgetView(entry: entry)
        }
        .configurationDisplayName("Harcama DNA")
        .description("Gider dagilimi ve finans skorunu tek widgetta takip et.")
        .supportedFamilies([.systemMedium])
        .contentMarginsDisabled()
    }
}

struct FingendaBalanceStackWidget: Widget {
    let kind: String = "FingendaBalanceStackWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: FingendaProvider()) { entry in
            BalanceStackWidgetView(entry: entry)
        }
        .configurationDisplayName("Nakit Ozeti")
        .description("Net bakiye, birikim ve harcama baskisini hizli gor.")
        .supportedFamilies([.systemSmall])
        .contentMarginsDisabled()
    }
}

struct FingendaPerformanceBarsWidget: Widget {
    let kind: String = "FingendaPerformanceBarsWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: FingendaProvider()) { entry in
            PerformanceBarsWidgetView(entry: entry)
        }
        .configurationDisplayName("Finans Performansi")
        .description("Haftalik trendi ve buyume oranini sutun grafikte gor.")
        .supportedFamilies([.systemMedium])
        .contentMarginsDisabled()
    }
}

struct FingendaMarketPulseWidget: Widget {
    let kind: String = "FingendaMarketPulseWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: FingendaProvider()) { entry in
            MarketPulseWidgetView(entry: entry)
        }
        .configurationDisplayName("Doviz Nabzi")
        .description("USD/EUR kuru ve trend cizgisini canli takip et.")
        .supportedFamilies([.systemMedium])
        .contentMarginsDisabled()
    }
}

@main
struct FingendaWidgetBundle: WidgetBundle {
    var body: some Widget {
        FingendaExpenseRingWidget()
        FingendaBalanceStackWidget()
        FingendaPerformanceBarsWidget()
        FingendaMarketPulseWidget()
    }
}
