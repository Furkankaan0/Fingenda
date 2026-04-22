const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const IOS_ROOT = path.join(ROOT, 'ios', 'App');
const XCODEPROJ_PATH = path.join(IOS_ROOT, 'App.xcodeproj');
const WIDGET_NAME = 'FingendaWidget';
const WIDGET_DIR = path.join(IOS_ROOT, WIDGET_NAME);
const WIDGET_SWIFT_PATH = path.join(WIDGET_DIR, `${WIDGET_NAME}.swift`);
const WIDGET_PLIST_PATH = path.join(WIDGET_DIR, 'Info.plist');

function log(message) {
  console.log(`[iOS Widget] ${message}`);
}

function writeIfChanged(filePath, content) {
  if (fs.existsSync(filePath)) {
    const current = fs.readFileSync(filePath, 'utf8');
    if (current === content) return false;
  }
  fs.writeFileSync(filePath, content, 'utf8');
  return true;
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function ensureRubyXcodeproj() {
  try {
    execSync('ruby -e "require \'xcodeproj\'"', { stdio: 'ignore' });
    return;
  } catch (_) {
    log('xcodeproj gem bulunamadi, yukleniyor...');
  }

  execSync('gem install xcodeproj --no-document', { stdio: 'inherit' });
}

function readAppBundleId() {
  const capacitorPath = path.join(ROOT, 'capacitor.config.json');
  try {
    const json = JSON.parse(fs.readFileSync(capacitorPath, 'utf8'));
    if (json && typeof json.appId === 'string' && json.appId.trim()) {
      return json.appId.trim();
    }
  } catch (_) {
    // silent
  }
  return 'com.fingenda.app';
}

function buildWidgetSwiftContent() {
  return `import WidgetKit
import SwiftUI

private enum SharedData {
    static let appGroupCandidates = [
        "group.com.fingenda.app",
        "group.com.fingenda"
    ]

    static let snapshotKeyCandidates = ["widget_snapshot_v1", "fingenda_widget_snapshot"]
    static let incomeKeys = ["widget_income_total", "income_total", "dashboard_income"]
    static let expenseKeys = ["widget_expense_total", "expense_total", "dashboard_expense"]
    static let usdKeys = ["widget_fx_usd_try", "fx_usd_try", "usd_try"]
    static let eurKeys = ["widget_fx_eur_try", "fx_eur_try", "eur_try"]
    static let savingsKeys = ["widget_savings_total", "savings_total", "dashboard_savings"]
    static let streakKeys = ["widget_streak_days", "streak_days"]
    static let goalProgressKeys = ["widget_goal_progress", "goal_progress"]

    static func currentSnapshot() -> FingendaSnapshot {
        let store = appGroupCandidates
            .compactMap { UserDefaults(suiteName: $0) }
            .first ?? UserDefaults.standard

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

    var hasCashFlow: Bool { income > 0 || expense > 0 }
    var hasFx: Bool { usdTry > 0 || eurTry > 0 }
    var hasSavings: Bool { savings > 0 }
    var net: Double { income - expense }
    var spendRatio: Double {
        guard income > 0 else { return expense > 0 ? 1 : 0 }
        return min(max(expense / income, 0), 1.5)
    }
    var normalizedGoalProgress: Double {
        if goalProgress > 1 { return min(goalProgress / 100.0, 1) }
        return min(max(goalProgress, 0), 1)
    }
    var savingsRatePercent: Int {
        guard income > 0 else { return savings > 0 ? 100 : 0 }
        return Int(min(max((savings / income) * 100, 0), 100))
    }
}

private struct FingendaWidgetEntry: TimelineEntry {
    let date: Date
    let snapshot: FingendaSnapshot
}

private struct FingendaWidgetProvider: TimelineProvider {
    func placeholder(in context: Context) -> FingendaWidgetEntry {
        FingendaWidgetEntry(
            date: Date(),
            snapshot: FingendaSnapshot(
                income: 12500,
                expense: 8300,
                usdTry: 39.24,
                eurTry: 42.33,
                savings: 4200,
                streakDays: 7,
                goalProgress: 0.62
            )
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (FingendaWidgetEntry) -> Void) {
        completion(FingendaWidgetEntry(date: Date(), snapshot: SharedData.currentSnapshot()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<FingendaWidgetEntry>) -> Void) {
        let now = Date()
        let entry = FingendaWidgetEntry(date: now, snapshot: SharedData.currentSnapshot())
        let refresh = Calendar.current.date(byAdding: .minute, value: 5, to: now) ?? now.addingTimeInterval(300)
        completion(Timeline(entries: [entry], policy: .after(refresh)))
    }
}

private struct QuickAction: Identifiable {
    let id: String
    let title: String
    let icon: String
    let url: String
}

private enum WidgetLinks {
    static let quickExpense = "fingenda://widget?action=quick-expense"
    static let quickIncome = "fingenda://widget?action=quick-income"
    static let voiceAdd = "fingenda://widget?action=voice-add"
    static let market = "fingenda://widget?action=open-market"
    static let dashboard = "fingenda://widget?tab=dashboard"
    static let goals = "fingenda://widget?tab=goals"
    static let brain = "fingenda://widget?tab=fingo-brain"
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

private func formatFx(_ value: Double) -> String {
    WidgetFormatters.decimal.string(from: NSNumber(value: value)) ?? "0,00"
}

private struct WidgetChrome<Content: View>: View {
    let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        content
            .padding(14)
            .containerBackground(for: .widget) {
                widgetBackground
            }
    }

    private var widgetBackground: some View {
        ZStack {
            LinearGradient(
                colors: [
                    Color(red: 0.05, green: 0.08, blue: 0.19),
                    Color(red: 0.10, green: 0.13, blue: 0.29)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )

            RadialGradient(
                colors: [
                    Color(red: 0.40, green: 0.45, blue: 1.0).opacity(0.30),
                    .clear
                ],
                center: .topTrailing,
                startRadius: 20,
                endRadius: 210
            )

            RadialGradient(
                colors: [
                    Color(red: 0.14, green: 0.85, blue: 0.95).opacity(0.18),
                    .clear
                ],
                center: .bottomLeading,
                startRadius: 15,
                endRadius: 190
            )
        }
    }
}

private struct GlassTile<Content: View>: View {
    let cornerRadius: CGFloat
    let content: Content

    init(cornerRadius: CGFloat = 13, @ViewBuilder content: () -> Content) {
        self.cornerRadius = cornerRadius
        self.content = content()
    }

    var body: some View {
        content
            .padding(10)
            .background(
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .fill(.white.opacity(0.11))
                    .overlay(
                        RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                            .stroke(.white.opacity(0.14), lineWidth: 0.8)
                    )
                    .shadow(color: .black.opacity(0.16), radius: 8, x: 0, y: 5)
            )
    }
}

private struct ActionChip: View {
    let title: String
    let icon: String
    let url: String

    var body: some View {
        Link(destination: URL(string: url)!) {
            HStack(spacing: 5) {
                Image(systemName: icon)
                    .font(.system(size: 11, weight: .semibold))
                Text(title)
                    .font(.system(size: 11, weight: .bold, design: .rounded))
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
            }
            .foregroundStyle(.white.opacity(0.96))
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
            .background(
                Capsule(style: .continuous)
                    .fill(.white.opacity(0.14))
                    .overlay(
                        Capsule(style: .continuous)
                            .stroke(.white.opacity(0.14), lineWidth: 0.6)
                    )
            )
        }
        .buttonStyle(.plain)
    }
}

private struct FingendaQuickBoardView: View {
    @Environment(\\.widgetFamily) private var family
    let entry: FingendaWidgetEntry

    private let actions = [
        QuickAction(id: "expense", title: "Gider", icon: "minus.circle.fill", url: WidgetLinks.quickExpense),
        QuickAction(id: "income", title: "Gelir", icon: "plus.circle.fill", url: WidgetLinks.quickIncome),
        QuickAction(id: "voice", title: "Ses", icon: "waveform.badge.mic", url: WidgetLinks.voiceAdd),
        QuickAction(id: "market", title: "Döviz", icon: "chart.line.uptrend.xyaxis", url: WidgetLinks.market)
    ]

    var body: some View {
        WidgetChrome {
            switch family {
            case .systemSmall:
                smallWidget
            default:
                mediumWidget
            }
        }
    }

    private var smallWidget: some View {
        VStack(alignment: .leading, spacing: 9) {
            Text("Fingenda")
                .font(.system(size: 14, weight: .bold, design: .rounded))
                .foregroundStyle(.white.opacity(0.95))

            GlassTile(cornerRadius: 12) {
                VStack(alignment: .leading, spacing: 3) {
                    Text("Net Durum")
                        .font(.system(size: 10, weight: .semibold, design: .rounded))
                        .foregroundStyle(.white.opacity(0.74))
                    Text(formatCurrency(entry.snapshot.net))
                        .font(.system(size: 16, weight: .heavy, design: .rounded))
                        .lineLimit(1)
                        .minimumScaleFactor(0.72)
                        .foregroundStyle(.white)
                }
            }

            Spacer(minLength: 0)

            HStack(spacing: 8) {
                ActionChip(title: "Gider", icon: "minus.circle.fill", url: WidgetLinks.quickExpense)
                ActionChip(title: "Ses", icon: "waveform.badge.mic", url: WidgetLinks.voiceAdd)
            }
        }
    }

    private var mediumWidget: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Fingenda • Hızlı İşlem")
                    .font(.system(size: 14, weight: .bold, design: .rounded))
                    .foregroundStyle(.white.opacity(0.96))
                Spacer(minLength: 0)
                    Text("Bugün")
                    .font(.system(size: 10, weight: .semibold, design: .rounded))
                    .foregroundStyle(.white.opacity(0.72))
            }

            HStack(spacing: 8) {
                statTile(
                    title: "Gelir",
                    value: entry.snapshot.hasCashFlow ? formatCurrency(entry.snapshot.income) : "--",
                    icon: "arrow.up.right.circle.fill",
                    accent: .mint.opacity(0.92)
                )
                statTile(
                    title: "Gider",
                    value: entry.snapshot.hasCashFlow ? formatCurrency(entry.snapshot.expense) : "--",
                    icon: "arrow.down.right.circle.fill",
                    accent: .red.opacity(0.92)
                )
                statTile(
                    title: "Döviz",
                    value: entry.snapshot.hasFx ? "USD \\(formatFx(entry.snapshot.usdTry))" : "Veri Yok",
                    icon: "dollarsign.arrow.circlepath",
                    accent: .cyan.opacity(0.95)
                )
            }

            HStack(spacing: 8) {
                ForEach(actions) { action in
                    ActionChip(title: action.title, icon: action.icon, url: action.url)
                }
            }
        }
    }

    private func statTile(title: String, value: String, icon: String, accent: Color) -> some View {
        GlassTile(cornerRadius: 12) {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 5) {
                    Image(systemName: icon)
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(accent)
                    Text(title)
                        .font(.system(size: 10, weight: .semibold, design: .rounded))
                        .foregroundStyle(.white.opacity(0.76))
                }
                Text(value)
                    .font(.system(size: 12, weight: .heavy, design: .rounded))
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                    .foregroundStyle(.white.opacity(0.96))
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

private struct FingendaCashFlowView: View {
    @Environment(\\.widgetFamily) private var family
    let entry: FingendaWidgetEntry

    var body: some View {
        WidgetChrome {
            switch family {
            case .systemLarge:
                largeWidget
            default:
                mediumWidget
            }
        }
    }

    private var mediumWidget: some View {
        VStack(alignment: .leading, spacing: 10) {
            header
            HStack(spacing: 9) {
                balanceTile
                savingsTile
            }
            spendProgress
        }
    }

    private var largeWidget: some View {
        VStack(alignment: .leading, spacing: 12) {
            header

            HStack(spacing: 10) {
                balanceTile
                savingsTile
                streakTile
            }

            spendProgress

            HStack(spacing: 8) {
                ActionChip(title: "Gelir", icon: "plus.circle.fill", url: WidgetLinks.quickIncome)
                ActionChip(title: "Gider", icon: "minus.circle.fill", url: WidgetLinks.quickExpense)
                ActionChip(title: "Sesle", icon: "waveform.badge.mic", url: WidgetLinks.voiceAdd)
                ActionChip(title: "Hedef", icon: "target", url: WidgetLinks.goals)
            }
        }
    }

    private var header: some View {
        HStack {
            Text("Fingenda • Nakit Durumu")
                .font(.system(size: 14, weight: .bold, design: .rounded))
                .foregroundStyle(.white.opacity(0.96))
            Spacer(minLength: 0)
            Text(entry.snapshot.hasCashFlow ? "Canlı" : "Hazır")
                .font(.system(size: 10, weight: .bold, design: .rounded))
                .foregroundStyle(.white.opacity(0.75))
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(Capsule(style: .continuous).fill(.white.opacity(0.12)))
        }
    }

    private var balanceTile: some View {
        GlassTile(cornerRadius: 14) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Net Bakiye")
                    .font(.system(size: 10, weight: .semibold, design: .rounded))
                    .foregroundStyle(.white.opacity(0.72))
                Text(formatCurrency(entry.snapshot.net))
                    .font(.system(size: 18, weight: .heavy, design: .rounded))
                    .lineLimit(1)
                    .minimumScaleFactor(0.72)
                    .foregroundStyle(.white)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private var savingsTile: some View {
        GlassTile(cornerRadius: 14) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Birikim")
                    .font(.system(size: 10, weight: .semibold, design: .rounded))
                    .foregroundStyle(.white.opacity(0.72))
                Text(entry.snapshot.hasSavings ? formatCurrency(entry.snapshot.savings) : "%\\(entry.snapshot.savingsRatePercent)")
                    .font(.system(size: 16, weight: .heavy, design: .rounded))
                    .lineLimit(1)
                    .minimumScaleFactor(0.72)
                    .foregroundStyle(.white)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private var streakTile: some View {
        GlassTile(cornerRadius: 14) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Seri")
                    .font(.system(size: 10, weight: .semibold, design: .rounded))
                    .foregroundStyle(.white.opacity(0.72))
                    Text("\\(max(entry.snapshot.streakDays, 0)) gün")
                    .font(.system(size: 16, weight: .heavy, design: .rounded))
                    .foregroundStyle(.white)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private var spendProgress: some View {
        GlassTile(cornerRadius: 14) {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("Harcama Baskisi")
                        .font(.system(size: 11, weight: .bold, design: .rounded))
                        .foregroundStyle(.white.opacity(0.84))
                    Spacer(minLength: 0)
                Text("%\\(Int(min(entry.snapshot.spendRatio * 100, 999)))")
                        .font(.system(size: 11, weight: .heavy, design: .rounded))
                        .foregroundStyle(.white)
                }

                GeometryReader { geo in
                    let width = geo.size.width
                    let fill = width * min(entry.snapshot.spendRatio, 1)

                    ZStack(alignment: .leading) {
                        Capsule(style: .continuous)
                            .fill(.white.opacity(0.12))

                        Capsule(style: .continuous)
                            .fill(
                                LinearGradient(
                                    colors: [.mint.opacity(0.95), .cyan.opacity(0.86), .indigo.opacity(0.88)],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .frame(width: max(fill, 16))
                    }
                }
                .frame(height: 10)
            }
        }
    }
}

private struct FingendaMarketWatchView: View {
    @Environment(\\.widgetFamily) private var family
    let entry: FingendaWidgetEntry

    var body: some View {
        WidgetChrome {
            switch family {
            case .systemSmall:
                smallWidget
            default:
                mediumWidget
            }
        }
    }

    private var smallWidget: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Döviz")
                    .font(.system(size: 14, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                Spacer(minLength: 0)
                Image(systemName: "chart.line.uptrend.xyaxis")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(.cyan.opacity(0.9))
            }

            fxPairTile(code: "USD/TRY", value: entry.snapshot.usdTry, accent: .cyan.opacity(0.95))
            fxPairTile(code: "EUR/TRY", value: entry.snapshot.eurTry, accent: .indigo.opacity(0.95))

            Spacer(minLength: 0)
            ActionChip(title: "Piyasayı Aç", icon: "arrow.up.right.square", url: WidgetLinks.market)
        }
    }

    private var mediumWidget: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Fingenda • Piyasa Özeti")
                    .font(.system(size: 14, weight: .bold, design: .rounded))
                    .foregroundStyle(.white.opacity(0.96))
                Spacer(minLength: 0)
                Text("Canlı")
                    .font(.system(size: 10, weight: .bold, design: .rounded))
                    .foregroundStyle(.white.opacity(0.72))
            }

            HStack(spacing: 9) {
                fxWideTile(code: "USD", value: entry.snapshot.usdTry, accent: .cyan.opacity(0.95))
                fxWideTile(code: "EUR", value: entry.snapshot.eurTry, accent: .indigo.opacity(0.95))
            }

            HStack(spacing: 8) {
                ActionChip(title: "Piyasa", icon: "chart.line.uptrend.xyaxis", url: WidgetLinks.market)
                ActionChip(title: "Sesle Ekle", icon: "waveform.badge.mic", url: WidgetLinks.voiceAdd)
                ActionChip(title: "Dashboard", icon: "house.fill", url: WidgetLinks.dashboard)
            }
        }
    }

    private func fxPairTile(code: String, value: Double, accent: Color) -> some View {
        GlassTile(cornerRadius: 12) {
            HStack {
                Text(code)
                    .font(.system(size: 10, weight: .bold, design: .rounded))
                    .foregroundStyle(.white.opacity(0.76))
                Spacer(minLength: 0)
                Text(value > 0 ? formatFx(value) : "--")
                    .font(.system(size: 12, weight: .heavy, design: .rounded))
                    .foregroundStyle(.white)
            }
            .overlay(alignment: .leading) {
                Circle()
                    .fill(accent)
                    .frame(width: 6, height: 6)
                    .offset(x: -2)
            }
        }
    }

    private func fxWideTile(code: String, value: Double, accent: Color) -> some View {
        GlassTile(cornerRadius: 13) {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 5) {
                    Circle()
                        .fill(accent)
                        .frame(width: 7, height: 7)
                    Text(code)
                        .font(.system(size: 10, weight: .bold, design: .rounded))
                        .foregroundStyle(.white.opacity(0.8))
                }
                Text(value > 0 ? formatFx(value) : "Veri Yok")
                    .font(.system(size: 15, weight: .heavy, design: .rounded))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

private struct FingendaVoiceCoachView: View {
    @Environment(\\.widgetFamily) private var family
    let entry: FingendaWidgetEntry

    var body: some View {
        WidgetChrome {
            switch family {
            case .systemSmall:
                smallWidget
            default:
                mediumWidget
            }
        }
    }

    private var smallWidget: some View {
        VStack(alignment: .leading, spacing: 11) {
            Text("Sesli Ekle")
                .font(.system(size: 14, weight: .bold, design: .rounded))
                .foregroundStyle(.white)

            GlassTile(cornerRadius: 16) {
                VStack(spacing: 10) {
                    Image(systemName: "waveform.badge.mic")
                        .font(.system(size: 24, weight: .bold))
                        .foregroundStyle(.white.opacity(0.96))
                    Text("Hızlı Sesli Kayıt")
                        .font(.system(size: 11, weight: .bold, design: .rounded))
                        .foregroundStyle(.white.opacity(0.86))
                }
                .frame(maxWidth: .infinity)
            }

            Spacer(minLength: 0)
            ActionChip(title: "Mikrofonu Ac", icon: "mic.fill", url: WidgetLinks.voiceAdd)
        }
    }

    private var mediumWidget: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Fingenda • Sesli Asistan")
                    .font(.system(size: 14, weight: .bold, design: .rounded))
                    .foregroundStyle(.white.opacity(0.96))
                Spacer(minLength: 0)
                Text("\\(max(entry.snapshot.streakDays, 0)) gün seri")
                    .font(.system(size: 10, weight: .semibold, design: .rounded))
                    .foregroundStyle(.white.opacity(0.74))
            }

            HStack(spacing: 10) {
                GlassTile(cornerRadius: 14) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Hedef İlerleme")
                            .font(.system(size: 10, weight: .semibold, design: .rounded))
                            .foregroundStyle(.white.opacity(0.74))
                        Text("%\\(Int(entry.snapshot.normalizedGoalProgress * 100))")
                            .font(.system(size: 18, weight: .heavy, design: .rounded))
                            .foregroundStyle(.white)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }

                GlassTile(cornerRadius: 14) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Birikim")
                            .font(.system(size: 10, weight: .semibold, design: .rounded))
                            .foregroundStyle(.white.opacity(0.74))
                        Text(entry.snapshot.hasSavings ? formatCurrency(entry.snapshot.savings) : "--")
                            .font(.system(size: 16, weight: .heavy, design: .rounded))
                            .foregroundStyle(.white)
                            .lineLimit(1)
                            .minimumScaleFactor(0.72)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            }

            HStack(spacing: 8) {
                ActionChip(title: "Sesle Ekle", icon: "waveform.badge.mic", url: WidgetLinks.voiceAdd)
                ActionChip(title: "Gelir", icon: "plus.circle.fill", url: WidgetLinks.quickIncome)
                ActionChip(title: "Fingo Brain", icon: "brain.head.profile", url: WidgetLinks.brain)
            }
        }
    }
}

struct FingendaQuickBoardWidget: Widget {
    let kind: String = "FingendaQuickBoardWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: FingendaWidgetProvider()) { entry in
            FingendaQuickBoardView(entry: entry)
        }
        .configurationDisplayName("Fingenda Hızlı İşlem")
        .description("Gelir, gider, sesli ekleme ve döviz kısayollarını tek bakışta kullan.")
        .supportedFamilies([.systemSmall, .systemMedium])
        .contentMarginsDisabled()
    }
}

struct FingendaCashFlowWidget: Widget {
    let kind: String = "FingendaCashFlowWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: FingendaWidgetProvider()) { entry in
            FingendaCashFlowView(entry: entry)
        }
        .configurationDisplayName("Fingenda Nakit Takibi")
        .description("Net bakiye, birikim ve harcama baskısını premium panelde gör.")
        .supportedFamilies([.systemMedium, .systemLarge])
        .contentMarginsDisabled()
    }
}

struct FingendaMarketWatchWidget: Widget {
    let kind: String = "FingendaMarketWatchWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: FingendaWidgetProvider()) { entry in
            FingendaMarketWatchView(entry: entry)
        }
        .configurationDisplayName("Fingenda Döviz Radarı")
        .description("USD ve EUR kurunu izleyip tek dokunuşla piyasa ekranına geç.")
        .supportedFamilies([.systemSmall, .systemMedium])
        .contentMarginsDisabled()
    }
}

struct FingendaVoiceCoachWidget: Widget {
    let kind: String = "FingendaVoiceCoachWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: FingendaWidgetProvider()) { entry in
            FingendaVoiceCoachView(entry: entry)
        }
        .configurationDisplayName("Fingenda Sesli Asistan")
        .description("Sesle hızlı işlem aç, hedef ilerlemeni ve birikimini takip et.")
        .supportedFamilies([.systemSmall, .systemMedium])
        .contentMarginsDisabled()
    }
}

@main
struct FingendaWidgetBundle: WidgetBundle {
    var body: some Widget {
        FingendaQuickBoardWidget()
        FingendaCashFlowWidget()
        FingendaMarketWatchWidget()
        FingendaVoiceCoachWidget()
    }
}
`;
}

function buildWidgetPlistContent() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>CFBundleDevelopmentRegion</key>
	<string>$(DEVELOPMENT_LANGUAGE)</string>
	<key>CFBundleDisplayName</key>
	<string>Fingenda Widget</string>
	<key>CFBundleExecutable</key>
	<string>$(EXECUTABLE_NAME)</string>
	<key>CFBundleIdentifier</key>
	<string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
	<key>CFBundleInfoDictionaryVersion</key>
	<string>6.0</string>
	<key>CFBundleName</key>
	<string>$(PRODUCT_NAME)</string>
	<key>CFBundlePackageType</key>
	<string>XPC!</string>
	<key>CFBundleShortVersionString</key>
	<string>$(MARKETING_VERSION)</string>
	<key>CFBundleVersion</key>
	<string>$(CURRENT_PROJECT_VERSION)</string>
	<key>NSExtension</key>
	<dict>
		<key>NSExtensionPointIdentifier</key>
		<string>com.apple.widgetkit-extension</string>
	</dict>
</dict>
</plist>
`;
}

function configureXcodeProject(appBundleId) {
  const rubyScript = `require 'xcodeproj'

project_path = ARGV[0]
app_bundle_id = ARGV[1]
widget_name = 'FingendaWidget'

project = Xcodeproj::Project.open(project_path)
app_target = project.targets.find { |t| t.name == 'App' }
raise "App target bulunamadi" unless app_target

widget_targets = project.targets.select { |t| t.name == widget_name }
if widget_targets.length > 1
  widget_target = widget_targets.first
  widget_targets.drop(1).each do |dup_target|
    begin
      app_target.dependencies.select { |d| d.target == dup_target }.each(&:remove_from_project)
    rescue
    end
    dup_target.remove_from_project
  end
else
  widget_target = widget_targets.first
end

widget_target ||= project.new_target(:app_extension, widget_name, :ios, '17.0')

products_group = project.main_group['Products'] || project.main_group.new_group('Products')
product_ref = widget_target.product_reference
if product_ref.nil?
  product_ref = products_group.new_file("#{widget_name}.appex")
  widget_target.product_reference = product_ref
end
product_ref.path = "#{widget_name}.appex"
product_ref.name = "#{widget_name}.appex"
product_ref.source_tree = 'BUILT_PRODUCTS_DIR'
products_group.children << product_ref unless products_group.children.include?(product_ref)

widget_group = project.main_group.find_subpath(widget_name, true)
widget_group.set_source_tree('<group>')
widget_group.path = widget_name

expected_swift_relpath = "#{widget_name}/#{widget_name}.swift"
expected_plist_relpath = "#{widget_name}/Info.plist"

swift_ref = project.files.find { |f| f.path == expected_swift_relpath && f.source_tree == 'SOURCE_ROOT' }
unless swift_ref
  stale_group_ref = widget_group.files.find { |f| f.path == "#{widget_name}.swift" || f.path == expected_swift_relpath }
  if stale_group_ref
    stale_group_ref.path = expected_swift_relpath
    stale_group_ref.source_tree = 'SOURCE_ROOT'
    swift_ref = stale_group_ref
  else
    swift_ref = project.new_file(expected_swift_relpath)
    swift_ref.source_tree = 'SOURCE_ROOT'
  end
end

plist_ref = project.files.find { |f| f.path == expected_plist_relpath && f.source_tree == 'SOURCE_ROOT' }
unless plist_ref
  stale_plist_ref = widget_group.files.find { |f| f.path == "Info.plist" || f.path == expected_plist_relpath }
  if stale_plist_ref
    stale_plist_ref.path = expected_plist_relpath
    stale_plist_ref.source_tree = 'SOURCE_ROOT'
    plist_ref = stale_plist_ref
  else
    plist_ref = project.new_file(expected_plist_relpath)
    plist_ref.source_tree = 'SOURCE_ROOT'
  end
end

widget_target.source_build_phase.files.each do |build_file|
  build_file.remove_from_project
end
widget_target.source_build_phase.add_file_reference(swift_ref)

project.files.each do |file_ref|
  next unless file_ref.path.to_s.end_with?("#{widget_name}.swift")
  next if file_ref == swift_ref
  file_ref.remove_from_project
end

widget_bundle_id = "#{app_bundle_id}.widget"

widget_target.build_configurations.each do |config|
  config.build_settings['PRODUCT_NAME'] = widget_name
  config.build_settings['EXECUTABLE_NAME'] = '$(PRODUCT_NAME)'
  config.build_settings['WRAPPER_EXTENSION'] = 'appex'
  config.build_settings['MACH_O_TYPE'] = 'mh_execute'
  config.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] = widget_bundle_id
  config.build_settings['INFOPLIST_FILE'] = expected_plist_relpath
  config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '17.0'
  config.build_settings['SWIFT_VERSION'] = '5.0'
  config.build_settings['TARGETED_DEVICE_FAMILY'] = '1,2'
  config.build_settings['SKIP_INSTALL'] = 'YES'
  config.build_settings['APPLICATION_EXTENSION_API_ONLY'] = 'YES'
  config.build_settings['GENERATE_INFOPLIST_FILE'] = 'NO'
end

unless app_target.dependencies.any? { |d| d.target == widget_target }
  app_target.add_dependency(widget_target)
end

embed_phase = app_target.copy_files_build_phases.find { |bp| bp.name == 'Embed App Extensions' }
embed_phase ||= app_target.new_copy_files_build_phase('Embed App Extensions')
embed_phase.dst_subfolder_spec = '13'

embed_phase.files.each do |build_file|
  ref = build_file.file_ref
  next unless ref
  if ref.path.to_s.strip == '.appex'
    build_file.remove_from_project
  end
end

matching_refs = embed_phase.files.select { |build_file| build_file.file_ref == product_ref }
if matching_refs.empty?
  embed_phase.add_file_reference(product_ref, true)
else
  matching_refs.drop(1).each(&:remove_from_project)
end

project.save
`;

  const rubyFile = path.join(__dirname, '.tmp-install-widget.rb');
  fs.writeFileSync(rubyFile, rubyScript, 'utf8');

  try {
    ensureRubyXcodeproj();
    execSync(`ruby "${rubyFile}" "${XCODEPROJ_PATH}" "${appBundleId}"`, { stdio: 'inherit' });
  } finally {
    if (fs.existsSync(rubyFile)) fs.unlinkSync(rubyFile);
  }
}

function main() {
  if (!fs.existsSync(XCODEPROJ_PATH)) {
    log('Xcode projesi bulunamadi (ios/App/App.xcodeproj). Widget patch atlandi.');
    return;
  }

  ensureDir(WIDGET_DIR);

  const swiftChanged = writeIfChanged(WIDGET_SWIFT_PATH, buildWidgetSwiftContent());
  const plistChanged = writeIfChanged(WIDGET_PLIST_PATH, buildWidgetPlistContent());

  const appBundleId = readAppBundleId();
  configureXcodeProject(appBundleId);

  if (swiftChanged || plistChanged) {
    log('Widget dosyalari olusturuldu/guncellendi.');
  } else {
    log('Widget dosyalari zaten guncel.');
  }

  log('Widget extension kurulumu tamamlandi.');
}

main();
