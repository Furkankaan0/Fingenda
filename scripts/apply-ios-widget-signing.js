const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PROJECT_PATH = path.join(ROOT, 'ios', 'App', 'App.xcodeproj');
const APP_TARGET_NAME = 'App';
const TARGET_NAME = 'FingendaWidget';
const APP_BUNDLE_ID = (process.env.APP_BUNDLE_ID || 'com.fingenda.app').trim();
const WIDGET_BUNDLE_ID = `${APP_BUNDLE_ID}.widget`;
const APP_GROUP_ID = `group.${APP_BUNDLE_ID}`;
const APP_ENTITLEMENTS_RELPATH = 'App/App.entitlements';
const WIDGET_ENTITLEMENTS_RELPATH = `${TARGET_NAME}/${TARGET_NAME}.entitlements`;
const PROFILES_DIR = path.join(
  process.env.HOME || '/Users/builder',
  'Library',
  'MobileDevice',
  'Provisioning Profiles'
);

function log(message) {
  console.log(`[Widget Signing] ${message}`);
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

function getFirstMatch(xml, regex) {
  const match = xml.match(regex);
  return match && match[1] ? match[1].trim() : '';
}

function parseAppGroups(xml) {
  const entitlementsArray = xml.match(
    /<key>com\.apple\.security\.application-groups<\/key>\s*<array>([\s\S]*?)<\/array>/m
  );

  if (!entitlementsArray || !entitlementsArray[1]) return [];

  const result = [];
  const regex = /<string>([^<]+)<\/string>/g;
  let match;

  while ((match = regex.exec(entitlementsArray[1])) !== null) {
    const value = (match[1] || '').trim();
    if (value) result.push(value);
  }

  return result;
}

function parseProfile(filePath) {
  const proc = spawnSync('/usr/bin/security', ['cms', '-D', '-i', filePath], {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024
  });
  if (proc.status !== 0 || !proc.stdout) return null;

  const xml = proc.stdout;
  const name = getFirstMatch(xml, /<key>Name<\/key>\s*<string>([^<]+)<\/string>/m);
  const uuid = getFirstMatch(xml, /<key>UUID<\/key>\s*<string>([^<]+)<\/string>/m);
  const appIdentifier = getFirstMatch(
    xml,
    /<key>application-identifier<\/key>\s*<string>([^<]+)<\/string>/m
  );
  const teamId = getFirstMatch(
    xml,
    /<key>TeamIdentifier<\/key>\s*<array>\s*<string>([^<]+)<\/string>/m
  ) || appIdentifier.split('.')[0] || '';
  const expiresAtRaw = getFirstMatch(xml, /<key>ExpirationDate<\/key>\s*<date>([^<]+)<\/date>/m);
  const expiresAt = expiresAtRaw ? new Date(expiresAtRaw) : new Date(0);
  const appGroups = parseAppGroups(xml);

  if (!name || !uuid || !appIdentifier) return null;
  return { filePath, name, uuid, teamId, appIdentifier, expiresAt, appGroups };
}

function bundleMatchScore(appIdentifier, bundleId) {
  const dotIndex = appIdentifier.indexOf('.');
  const identifierPart = dotIndex >= 0 ? appIdentifier.slice(dotIndex + 1) : appIdentifier;
  if (identifierPart === bundleId) return 2;
  if (identifierPart.endsWith('*')) {
    const prefix = identifierPart.slice(0, -1);
    if (bundleId.startsWith(prefix)) return 1;
  }
  return 0;
}

function selectProfileForBundle(bundleId) {
  if (!fs.existsSync(PROFILES_DIR)) {
    throw new Error(`Provisioning profile klasoru bulunamadi: ${PROFILES_DIR}`);
  }

  const files = fs
    .readdirSync(PROFILES_DIR)
    .filter((file) => file.endsWith('.mobileprovision'))
    .map((file) => path.join(PROFILES_DIR, file));

  const profiles = files.map(parseProfile).filter(Boolean);
  const now = new Date();
  const candidates = profiles
    .map((profile) => ({ profile, score: bundleMatchScore(profile.appIdentifier, bundleId) }))
    .filter(({ profile, score }) => score > 0 && profile.expiresAt > now)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.profile.expiresAt.getTime() - a.profile.expiresAt.getTime();
    });

  if (candidates.length === 0) {
    const appIds = profiles.map((p) => p.appIdentifier).join(', ') || 'yok';
    throw new Error(
      `Bundle ID icin profile bulunamadi: ${bundleId}. Bulunan application-identifier degerleri: ${appIds}`
    );
  }

  return candidates[0].profile;
}

function profileSupportsExpectedAppGroup(profile, expectedAppGroup) {
  if (!profile || !Array.isArray(profile.appGroups)) return false;
  return profile.appGroups.includes(expectedAppGroup);
}

function applyProfileToWidgetTarget(profile, flags) {
  const widgetHasAppGroups = flags.widgetHasAppGroups ? '1' : '0';
  const appHasAppGroups = flags.appHasAppGroups ? '1' : '0';

  const rubyScript = `require 'xcodeproj'

project_path = ARGV[0]
app_target_name = ARGV[1]
widget_target_name = ARGV[2]
profile_name = ARGV[3]
profile_uuid = ARGV[4]
team_id = ARGV[5]
widget_has_app_groups = ARGV[6] == '1'
app_has_app_groups = ARGV[7] == '1'
app_entitlements_relpath = ARGV[8]
widget_entitlements_relpath = ARGV[9]

project = Xcodeproj::Project.open(project_path)
app_target = project.targets.find { |t| t.name == app_target_name }
raise "Target bulunamadi: #{app_target_name}" unless app_target

widget_target = project.targets.find { |t| t.name == widget_target_name }
raise "Target bulunamadi: #{widget_target_name}" unless widget_target

widget_target.build_configurations.each do |config|
  config.build_settings['CODE_SIGN_STYLE'] = 'Manual'
  config.build_settings['DEVELOPMENT_TEAM'] = team_id
  config.build_settings['PROVISIONING_PROFILE_SPECIFIER'] = profile_name
  config.build_settings['PROVISIONING_PROFILE'] = profile_uuid
  config.build_settings['CODE_SIGN_IDENTITY[sdk=iphoneos*]'] = 'Apple Distribution'

  if widget_has_app_groups
    config.build_settings['CODE_SIGN_ENTITLEMENTS'] = widget_entitlements_relpath
  else
    config.build_settings.delete('CODE_SIGN_ENTITLEMENTS')
  end
end

app_target.build_configurations.each do |config|
  if app_has_app_groups
    config.build_settings['CODE_SIGN_ENTITLEMENTS'] = app_entitlements_relpath
  else
    config.build_settings.delete('CODE_SIGN_ENTITLEMENTS')
  end
end

target_attributes = project.root_object.attributes['TargetAttributes'] ||= {}
[app_target, widget_target].each do |target|
  attrs = target_attributes[target.uuid] ||= {}
  caps = attrs['SystemCapabilities'] ||= {}

  if (target == widget_target && widget_has_app_groups) || (target == app_target && app_has_app_groups)
    caps['com.apple.ApplicationGroups.iOS'] = { 'enabled' => 1 }
  else
    caps.delete('com.apple.ApplicationGroups.iOS')
  end
end

project.save
`;

  const tempRubyPath = path.join(__dirname, '.tmp-apply-widget-signing.rb');
  fs.writeFileSync(tempRubyPath, rubyScript, 'utf8');
  try {
    ensureRubyXcodeproj();
    execSync(
      `ruby "${tempRubyPath}" "${PROJECT_PATH}" "${APP_TARGET_NAME}" "${TARGET_NAME}" "${profile.name}" "${profile.uuid}" "${profile.teamId}" "${widgetHasAppGroups}" "${appHasAppGroups}" "${APP_ENTITLEMENTS_RELPATH}" "${WIDGET_ENTITLEMENTS_RELPATH}"`,
      { stdio: 'inherit' }
    );
  } finally {
    if (fs.existsSync(tempRubyPath)) {
      fs.unlinkSync(tempRubyPath);
    }
  }
}

function main() {
  if (!fs.existsSync(PROJECT_PATH)) {
    log(`Xcode projesi bulunamadi, islem atlandi: ${PROJECT_PATH}`);
    return;
  }

  const widgetProfile = selectProfileForBundle(WIDGET_BUNDLE_ID);
  log(`Widget profile secildi: ${widgetProfile.name} (${widgetProfile.uuid})`);

  let appProfile = null;
  try {
    appProfile = selectProfileForBundle(APP_BUNDLE_ID);
    log(`App profile secildi: ${appProfile.name} (${appProfile.uuid})`);
  } catch (error) {
    log(`App profile secimi atlandi: ${error.message}`);
  }

  const widgetHasAppGroups = profileSupportsExpectedAppGroup(widgetProfile, APP_GROUP_ID);
  const appHasAppGroups = appProfile
    ? profileSupportsExpectedAppGroup(appProfile, APP_GROUP_ID)
    : false;

  if (!widgetHasAppGroups || !appHasAppGroups) {
    log(
      `App Group entitlement fallback aktif. Beklenen grup: ${APP_GROUP_ID} | app=${appHasAppGroups} widget=${widgetHasAppGroups}`
    );
  } else {
    log(`App Group entitlement bulundu: ${APP_GROUP_ID}`);
  }

  applyProfileToWidgetTarget(widgetProfile, {
    widgetHasAppGroups,
    appHasAppGroups
  });
  log('Widget signing ve entitlement ayarlari guncellendi.');
}

main();
