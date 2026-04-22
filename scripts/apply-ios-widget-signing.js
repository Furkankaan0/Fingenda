const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PROJECT_PATH = path.join(ROOT, 'ios', 'App', 'App.xcodeproj');
const TARGET_NAME = 'FingendaWidget';
const APP_BUNDLE_ID = (process.env.APP_BUNDLE_ID || 'com.fingenda.app').trim();
const WIDGET_BUNDLE_ID = `${APP_BUNDLE_ID}.widget`;
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

  if (!name || !uuid || !appIdentifier) return null;
  return { filePath, name, uuid, teamId, appIdentifier, expiresAt };
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

function applyProfileToWidgetTarget(profile) {
  const rubyScript = `require 'xcodeproj'

project_path = ARGV[0]
target_name = ARGV[1]
profile_name = ARGV[2]
profile_uuid = ARGV[3]
team_id = ARGV[4]

project = Xcodeproj::Project.open(project_path)
target = project.targets.find { |t| t.name == target_name }
raise "Target bulunamadi: #{target_name}" unless target

target.build_configurations.each do |config|
  config.build_settings['CODE_SIGN_STYLE'] = 'Manual'
  config.build_settings['DEVELOPMENT_TEAM'] = team_id
  config.build_settings['PROVISIONING_PROFILE_SPECIFIER'] = profile_name
  config.build_settings['PROVISIONING_PROFILE'] = profile_uuid
  config.build_settings['CODE_SIGN_IDENTITY[sdk=iphoneos*]'] = 'Apple Distribution'
end

project.save
`;

  const tempRubyPath = path.join(__dirname, '.tmp-apply-widget-signing.rb');
  fs.writeFileSync(tempRubyPath, rubyScript, 'utf8');
  try {
    ensureRubyXcodeproj();
    execSync(
      `ruby "${tempRubyPath}" "${PROJECT_PATH}" "${TARGET_NAME}" "${profile.name}" "${profile.uuid}" "${profile.teamId}"`,
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

  const profile = selectProfileForBundle(WIDGET_BUNDLE_ID);
  log(`Widget profile secildi: ${profile.name} (${profile.uuid})`);
  applyProfileToWidgetTarget(profile);
  log('Widget target signing ayarlari guncellendi.');
}

main();
