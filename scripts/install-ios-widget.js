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

    static let incomeKeys = ["widget_income_total", "income_total", "dashboard_income"]
    static let expenseKeys = ["widget_expense_total", "expense_total", "dashboard_expense"]
    static let usdKeys = ["widget_fx_usd_try", "fx_usd_try", "usd_try"]
    static let eurKeys = ["widget_fx_eur_try", "fx_eur_try", "eur_try"]

    static func currentSnapshot() -> FingendaSnapshot {
        let store = appGroupCandidates
            .compactMap { UserDefaults(suiteName: $0) }
            .first ?? UserDefaults.standard

        return FingendaSnapshot(
            income: readNumber(store, keys: incomeKeys),
            expense: readNumber(store, keys: expenseKeys),
            usdTry: readNumber(store, keys: usdKeys),
            eurTry: readNumber(store, keys: eurKeys)
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
}

private struct FingendaSnapshot {
    let income: Double
    let expense: Double
    let usdTry: Double
    let eurTry: Double

    var hasCashFlow: Bool { income > 0 || expense > 0 }
    var hasFx: Bool { usdTry > 0 || eurTry > 0 }
}

private struct FingendaWidgetEntry: TimelineEntry {
    let date: Date
    let snapshot: FingendaSnapshot
}

private struct FingendaWidgetProvider: TimelineProvider {
    func placeholder(in context: Context) -> FingendaWidgetEntry {
        FingendaWidgetEntry(
            date: Date(),
            snapshot: FingendaSnapshot(income: 12500, expense: 8300, usdTry: 39.24, eurTry: 42.33)
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (FingendaWidgetEntry) -> Void) {
        completion(FingendaWidgetEntry(date: Date(), snapshot: SharedData.currentSnapshot()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<FingendaWidgetEntry>) -> Void) {
        let now = Date()
        let entry = FingendaWidgetEntry(date: now, snapshot: SharedData.currentSnapshot())
        let refresh = Calendar.current.date(byAdding: .minute, value: 15, to: now) ?? now.addingTimeInterval(900)
        completion(Timeline(entries: [entry], policy: .after(refresh)))
    }
}

private struct QuickAction: Identifiable {
    let id: String
    let title: String
    let icon: String
    let url: String
}

private struct FingendaWidgetView: View {
    @Environment(\\.widgetFamily) private var family
    let entry: FingendaWidgetEntry

    private let formatter: NumberFormatter = {
        let f = NumberFormatter()
        f.numberStyle = .currency
        f.locale = Locale(identifier: "tr_TR")
        f.maximumFractionDigits = 0
        return f
    }()

    private let fxFormatter: NumberFormatter = {
        let f = NumberFormatter()
        f.numberStyle = .decimal
        f.locale = Locale(identifier: "tr_TR")
        f.minimumFractionDigits = 2
        f.maximumFractionDigits = 2
        return f
    }()

    private let actions = [
        QuickAction(id: "expense", title: "Gider", icon: "minus.circle.fill", url: "fingenda://widget?action=quick-expense"),
        QuickAction(id: "income", title: "Gelir", icon: "plus.circle.fill", url: "fingenda://widget?action=quick-income"),
        QuickAction(id: "voice", title: "Sesle Ekle", icon: "waveform.badge.mic", url: "fingenda://widget?action=voice-add"),
        QuickAction(id: "market", title: "Doviz", icon: "chart.line.uptrend.xyaxis", url: "fingenda://widget?action=open-market")
    ]

    var body: some View {
        switch family {
        case .systemSmall:
            smallWidget
        default:
            mediumWidget
        }
    }

    private var smallWidget: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 6) {
                Text("Fingenda")
                    .font(.system(size: 13, weight: .bold, design: .rounded))
                    .foregroundStyle(.white.opacity(0.95))
                Spacer(minLength: 0)
                Text("Bugun")
                    .font(.system(size: 10, weight: .semibold, design: .rounded))
                    .foregroundStyle(.white.opacity(0.72))
            }

            if entry.snapshot.hasCashFlow {
                metricCard(title: "Gelir", value: formatCurrency(entry.snapshot.income), accent: .mint.opacity(0.9))
                metricCard(title: "Gider", value: formatCurrency(entry.snapshot.expense), accent: .red.opacity(0.92))
            } else if entry.snapshot.hasFx {
                metricCard(title: "USD/TRY", value: formatFx(entry.snapshot.usdTry), accent: .cyan.opacity(0.95))
                metricCard(title: "EUR/TRY", value: formatFx(entry.snapshot.eurTry), accent: .indigo.opacity(0.95))
            } else {
                Text("Veri geldikce burada gorunecek")
                    .font(.system(size: 11, weight: .medium, design: .rounded))
                    .foregroundStyle(.white.opacity(0.8))
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            Spacer(minLength: 0)

            HStack(spacing: 8) {
                miniAction(url: "fingenda://widget?action=quick-expense", icon: "minus.circle.fill", title: "Gider")
                miniAction(url: "fingenda://widget?action=voice-add", icon: "waveform.badge.mic", title: "Ses")
            }
        }
        .padding(12)
        .containerBackground(for: .widget) {
            backgroundGradient
        }
    }

    private var mediumWidget: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Fingenda • Gunluk Durum")
                    .font(.system(size: 14, weight: .bold, design: .rounded))
                    .foregroundStyle(.white.opacity(0.96))
                Spacer(minLength: 0)
            }

            HStack(spacing: 8) {
                statTile(
                    title: "Gelir",
                    value: entry.snapshot.hasCashFlow ? formatCurrency(entry.snapshot.income) : "--",
                    icon: "arrow.up.right.circle.fill",
                    accent: .mint.opacity(0.9)
                )
                statTile(
                    title: "Gider",
                    value: entry.snapshot.hasCashFlow ? formatCurrency(entry.snapshot.expense) : "--",
                    icon: "arrow.down.right.circle.fill",
                    accent: .red.opacity(0.9)
                )
                statTile(
                    title: "Doviz",
                    value: entry.snapshot.hasFx ? "USD \(formatFx(entry.snapshot.usdTry))" : "Veri Yok",
                    icon: "dollarsign.arrow.circlepath",
                    accent: .cyan.opacity(0.92)
                )
            }

            HStack(spacing: 8) {
                ForEach(actions) { action in
                    Link(destination: URL(string: action.url)!) {
                        HStack(spacing: 4) {
                            Image(systemName: action.icon)
                                .font(.system(size: 11, weight: .semibold))
                            Text(action.title)
                                .font(.system(size: 11, weight: .bold, design: .rounded))
                                .lineLimit(1)
                        }
                        .foregroundStyle(.white.opacity(0.96))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 8)
                        .background(
                            Capsule(style: .continuous)
                                .fill(.white.opacity(0.14))
                                .overlay(
                                    Capsule(style: .continuous)
                                        .stroke(.white.opacity(0.12), lineWidth: 0.5)
                                )
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(12)
        .containerBackground(for: .widget) {
            backgroundGradient
        }
    }

    private var backgroundGradient: some View {
        ZStack {
            LinearGradient(
                colors: [
                    Color(red: 0.05, green: 0.09, blue: 0.20),
                    Color(red: 0.11, green: 0.14, blue: 0.30)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )

            RadialGradient(
                colors: [
                    Color(red: 0.38, green: 0.42, blue: 1.0).opacity(0.35),
                    .clear
                ],
                center: .bottomTrailing,
                startRadius: 10,
                endRadius: 180
            )
        }
    }

    private func metricCard(title: String, value: String, accent: Color) -> some View {
        HStack(spacing: 8) {
            Circle()
                .fill(accent)
                .frame(width: 7, height: 7)
            Text(title)
                .font(.system(size: 11, weight: .bold, design: .rounded))
                .foregroundStyle(.white.opacity(0.86))
            Spacer(minLength: 0)
            Text(value)
                .font(.system(size: 11, weight: .heavy, design: .rounded))
                .foregroundStyle(.white)
        }
        .padding(.horizontal, 9)
        .padding(.vertical, 6)
        .background(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(.white.opacity(0.1))
                .overlay(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .stroke(.white.opacity(0.09), lineWidth: 0.6)
                )
        )
    }

    private func statTile(title: String, value: String, icon: String, accent: Color) -> some View {
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
        .padding(9)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(.white.opacity(0.12))
                .overlay(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .stroke(.white.opacity(0.09), lineWidth: 0.6)
                )
        )
    }

    private func miniAction(url: String, icon: String, title: String) -> some View {
        Link(destination: URL(string: url)!) {
            HStack(spacing: 4) {
                Image(systemName: icon)
                    .font(.system(size: 11, weight: .semibold))
                Text(title)
                    .font(.system(size: 11, weight: .bold, design: .rounded))
            }
            .foregroundStyle(.white.opacity(0.95))
            .frame(maxWidth: .infinity)
            .padding(.vertical, 7)
            .background(
                Capsule(style: .continuous)
                    .fill(.white.opacity(0.12))
            )
        }
        .buttonStyle(.plain)
    }

    private func formatCurrency(_ value: Double) -> String {
        formatter.string(from: NSNumber(value: value)) ?? "0 ₺"
    }

    private func formatFx(_ value: Double) -> String {
        fxFormatter.string(from: NSNumber(value: value)) ?? "0,00"
    }
}

struct FingendaQuickActionsWidget: Widget {
    let kind: String = "FingendaQuickActionsWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: FingendaWidgetProvider()) { entry in
            FingendaWidgetView(entry: entry)
        }
        .configurationDisplayName("Fingenda Hizli Islemler")
        .description("Gelir, gider, sesli ekleme ve doviz kisayollarina aninda ulasin.")
        .supportedFamilies([.systemSmall, .systemMedium])
        .contentMarginsDisabled()
    }
}

@main
struct FingendaWidgetBundle: WidgetBundle {
    var body: some Widget {
        FingendaQuickActionsWidget()
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
  stale_group_ref = widget_group.files.find { |f| f.path == "#{widget_name}.swift" }
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
  stale_plist_ref = widget_group.files.find { |f| f.path == "Info.plist" }
  if stale_plist_ref
    stale_plist_ref.path = expected_plist_relpath
    stale_plist_ref.source_tree = 'SOURCE_ROOT'
    plist_ref = stale_plist_ref
  else
    plist_ref = project.new_file(expected_plist_relpath)
    plist_ref.source_tree = 'SOURCE_ROOT'
  end
end

unless widget_target.source_build_phase.files_references.include?(swift_ref)
  widget_target.source_build_phase.add_file_reference(swift_ref)
end

widget_target.source_build_phase.files.each do |build_file|
  ref = build_file.file_ref
  next unless ref
  ref_path = ref.path.to_s
  next unless ref_path.end_with?("#{widget_name}.swift")
  if ref_path != expected_swift_relpath || ref.source_tree != 'SOURCE_ROOT'
    build_file.remove_from_project
  end
end

seen_swift = false
widget_target.source_build_phase.files.each do |build_file|
  next unless build_file.file_ref == swift_ref
  if seen_swift
    build_file.remove_from_project
  else
    seen_swift = true
  end
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
