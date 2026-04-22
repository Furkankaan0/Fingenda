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

private struct FingendaWidgetEntry: TimelineEntry {
    let date: Date
}

private struct FingendaWidgetProvider: TimelineProvider {
    func placeholder(in context: Context) -> FingendaWidgetEntry {
        FingendaWidgetEntry(date: Date())
    }

    func getSnapshot(in context: Context, completion: @escaping (FingendaWidgetEntry) -> Void) {
        completion(FingendaWidgetEntry(date: Date()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<FingendaWidgetEntry>) -> Void) {
        let now = Date()
        let refresh = Calendar.current.date(byAdding: .minute, value: 30, to: now) ?? now.addingTimeInterval(1800)
        let timeline = Timeline(entries: [FingendaWidgetEntry(date: now)], policy: .after(refresh))
        completion(timeline)
    }
}

private struct QuickAction: Identifiable {
    let id = UUID()
    let title: String
    let subtitle: String
    let icon: String
    let url: String
}

private struct FingendaWidgetView: View {
    @Environment(\\.widgetFamily) private var family

    private let actions = [
        QuickAction(title: "Gider Ekle", subtitle: "Hızlı kayıt", icon: "minus.circle.fill", url: "fingenda://widget?action=quick-expense"),
        QuickAction(title: "Gelir Ekle", subtitle: "Hızlı kayıt", icon: "plus.circle.fill", url: "fingenda://widget?action=quick-income"),
        QuickAction(title: "Piyasayı Aç", subtitle: "Altın / Döviz", icon: "chart.line.uptrend.xyaxis", url: "fingenda://widget?action=open-market"),
        QuickAction(title: "Notlara Git", subtitle: "Hızlı plan", icon: "note.text", url: "fingenda://widget?action=open-notes")
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
        ZStack {
            LinearGradient(
                colors: [Color(red: 0.09, green: 0.13, blue: 0.27), Color(red: 0.20, green: 0.19, blue: 0.51)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )

            VStack(alignment: .leading, spacing: 8) {
                Text("Fingenda")
                    .font(.system(size: 14, weight: .bold, design: .rounded))
                    .foregroundStyle(.white.opacity(0.95))

                Text("Hızlı İşlem")
                    .font(.system(size: 18, weight: .black, design: .rounded))
                    .foregroundStyle(.white)

                Spacer(minLength: 0)

                Link(destination: URL(string: "fingenda://widget?action=quick-expense")!) {
                    Label("Gider Ekle", systemImage: "minus.circle.fill")
                        .font(.system(size: 13, weight: .semibold, design: .rounded))
                        .foregroundStyle(.white)
                }
            }
            .padding(14)
        }
        .containerBackground(for: .widget) {
            Color.clear
        }
    }

    private var mediumWidget: some View {
        ZStack {
            LinearGradient(
                colors: [Color(red: 0.07, green: 0.11, blue: 0.24), Color(red: 0.13, green: 0.16, blue: 0.34)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )

            VStack(alignment: .leading, spacing: 10) {
                Text("Fingenda • Bugün")
                    .font(.system(size: 14, weight: .bold, design: .rounded))
                    .foregroundStyle(.white.opacity(0.92))

                HStack(spacing: 8) {
                    ForEach(actions.prefix(3)) { action in
                        Link(destination: URL(string: action.url)!) {
                            VStack(alignment: .leading, spacing: 4) {
                                Image(systemName: action.icon)
                                    .font(.system(size: 14, weight: .semibold))
                                    .foregroundStyle(.white)

                                Text(action.title)
                                    .font(.system(size: 12, weight: .bold, design: .rounded))
                                    .lineLimit(1)
                                    .foregroundStyle(.white)

                                Text(action.subtitle)
                                    .font(.system(size: 10, weight: .medium, design: .rounded))
                                    .lineLimit(1)
                                    .foregroundStyle(.white.opacity(0.72))
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(10)
                            .background(
                                RoundedRectangle(cornerRadius: 12, style: .continuous)
                                    .fill(.white.opacity(0.13))
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .padding(14)
        }
        .containerBackground(for: .widget) {
            Color.clear
        }
    }
}

struct FingendaQuickActionsWidget: Widget {
    let kind: String = "FingendaQuickActionsWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: FingendaWidgetProvider()) { _ in
            FingendaWidgetView()
        }
        .configurationDisplayName("Fingenda Hızlı İşlemler")
        .description("Gelir, gider ve piyasa ekranlarına ana ekrandan hızlıca geçin.")
        .supportedFamilies([.systemSmall, .systemMedium])
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

widget_target = project.targets.find { |t| t.name == widget_name }
unless widget_target
  widget_target = project.new_target(:app_extension, widget_name, :ios, '17.0')
end

widget_group = project.main_group.find_subpath(widget_name, true)
widget_group.set_source_tree('<group>')

swift_ref = widget_group.files.find { |f| f.path == "#{widget_name}.swift" } || widget_group.new_file("#{widget_name}.swift")

unless widget_target.source_build_phase.files_references.include?(swift_ref)
  widget_target.source_build_phase.add_file_reference(swift_ref)
end

widget_bundle_id = "#{app_bundle_id}.widget"

widget_target.build_configurations.each do |config|
  config.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] = widget_bundle_id
  config.build_settings['INFOPLIST_FILE'] = "#{widget_name}/Info.plist"
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

product_ref = widget_target.product_reference
unless embed_phase.files_references.include?(product_ref)
  embed_phase.add_file_reference(product_ref, true)
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
    log('Widget dosyalari zaten gunceldi.');
  }

  log('Widget extension kurulumu tamamlandi.');
}

main();
