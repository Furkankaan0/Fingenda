const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const IOS_ROOT = path.join(ROOT, 'ios', 'App');
const XCODEPROJ_PATH = path.join(IOS_ROOT, 'App.xcodeproj');
const WIDGET_NAME = 'FingendaWidget';
const APP_TARGET_DIR = path.join(IOS_ROOT, 'App');
const WIDGET_DIR = path.join(IOS_ROOT, WIDGET_NAME);
const WIDGET_SWIFT_PATH = path.join(WIDGET_DIR, `${WIDGET_NAME}.swift`);
const WIDGET_PLIST_PATH = path.join(WIDGET_DIR, 'Info.plist');
const APP_ENTITLEMENTS_PATH = path.join(APP_TARGET_DIR, 'App.entitlements');
const WIDGET_ENTITLEMENTS_PATH = path.join(WIDGET_DIR, `${WIDGET_NAME}.entitlements`);
const WIDGET_TEMPLATE_PATH = path.join(
  ROOT,
  'scripts',
  'widget-template',
  `${WIDGET_NAME}.swift`
);

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
    // ignore
  }
  return 'com.fingenda.app';
}

function buildWidgetSwiftContent() {
  if (!fs.existsSync(WIDGET_TEMPLATE_PATH)) {
    throw new Error(`Widget Swift template bulunamadi: ${WIDGET_TEMPLATE_PATH}`);
  }
  return fs.readFileSync(WIDGET_TEMPLATE_PATH, 'utf8');
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

function buildEntitlementsContent(appGroupId) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>com.apple.security.application-groups</key>
	<array>
		<string>${appGroupId}</string>
	</array>
</dict>
</plist>
`;
}

function configureXcodeProject(appBundleId) {
  const rubyScript = `require 'xcodeproj'

project_path = ARGV[0]
app_bundle_id = ARGV[1]
widget_name = 'FingendaWidget'
app_entitlements_relpath = 'App/App.entitlements'
widget_entitlements_relpath = "#{widget_name}/#{widget_name}.entitlements"

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

# Daha once patch'lerden kalan bozuk/tekrar .appex referanslarini temizle
project.files.each do |file_ref|
  next unless file_ref.path.to_s.end_with?('.appex')
  next if file_ref == product_ref
  if file_ref.path.to_s.strip == '.appex' || file_ref.path.to_s == "#{widget_name}.appex"
    begin
      file_ref.remove_from_project
    rescue
    end
  end
end

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

# Ayni dosyanin widget grubu icindeki tekrar referanslarini temizle
widget_group.files.each do |file_ref|
  next if file_ref == swift_ref || file_ref == plist_ref
  if file_ref.path.to_s == "#{widget_name}.swift" || file_ref.path.to_s == "Info.plist" ||
     file_ref.path.to_s == expected_swift_relpath || file_ref.path.to_s == expected_plist_relpath
    begin
      file_ref.remove_from_project
    rescue
    end
  end
end

widget_bundle_id = "#{app_bundle_id}.widget"

app_target.build_configurations.each do |config|
  config.build_settings['CODE_SIGN_ENTITLEMENTS'] = app_entitlements_relpath
end

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
  config.build_settings['CODE_SIGN_ENTITLEMENTS'] = widget_entitlements_relpath
end

unless app_target.dependencies.any? { |d| d.target == widget_target }
  app_target.add_dependency(widget_target)
end

embed_phase = app_target.copy_files_build_phases.find { |bp| bp.name == 'Embed App Extensions' }
embed_phase ||= app_target.new_copy_files_build_phase('Embed App Extensions')
embed_phase.dst_subfolder_spec = '13'

# Tum bozuk/tekrar appex girislerini temizle, sonra tek dogru entry ekle
embed_phase.files.each do |build_file|
  ref = build_file.file_ref
  next unless ref
  if ref.path.to_s.strip == '.appex' || ref.path.to_s == "#{widget_name}.appex"
    build_file.remove_from_project
  end
end

embed_phase.add_file_reference(product_ref, true)

target_attributes = project.root_object.attributes['TargetAttributes'] ||= {}
[app_target, widget_target].each do |target|
  attrs = target_attributes[target.uuid] ||= {}
  caps = attrs['SystemCapabilities'] ||= {}
  caps['com.apple.ApplicationGroups.iOS'] = { 'enabled' => 1 }
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
  ensureDir(APP_TARGET_DIR);

  const swiftChanged = writeIfChanged(WIDGET_SWIFT_PATH, buildWidgetSwiftContent());
  const plistChanged = writeIfChanged(WIDGET_PLIST_PATH, buildWidgetPlistContent());
  const appBundleId = readAppBundleId();
  const appGroupId = `group.${appBundleId}`;
  const appEntitlementsChanged = writeIfChanged(APP_ENTITLEMENTS_PATH, buildEntitlementsContent(appGroupId));
  const widgetEntitlementsChanged = writeIfChanged(
    WIDGET_ENTITLEMENTS_PATH,
    buildEntitlementsContent(appGroupId)
  );

  configureXcodeProject(appBundleId);

  if (swiftChanged || plistChanged || appEntitlementsChanged || widgetEntitlementsChanged) {
    log('Widget dosyalari olusturuldu/guncellendi.');
  } else {
    log('Widget dosyalari zaten guncel.');
  }

  log('Widget extension kurulumu tamamlandi.');
}

main();
