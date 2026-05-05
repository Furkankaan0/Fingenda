const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const IOS_ROOT = path.join(ROOT, 'ios', 'App');
const XCODEPROJ_PATH = path.join(IOS_ROOT, 'App.xcodeproj');
const APP_TARGET_DIR = path.join(IOS_ROOT, 'App');
const TEMPLATE_PATH = path.join(ROOT, 'scripts', 'native-swift', 'FingendaNativeFoundation.swift');
const OUTPUT_PATH = path.join(APP_TARGET_DIR, 'FingendaNativeFoundation.swift');

function log(message) {
  console.log(`[iOS Native Foundation] ${message}`);
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function writeIfChanged(filePath, content) {
  if (fs.existsSync(filePath) && fs.readFileSync(filePath, 'utf8') === content) {
    return false;
  }

  fs.writeFileSync(filePath, content, 'utf8');
  return true;
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

function configureXcodeProject() {
  const rubyScript = `require 'xcodeproj'

project_path = ARGV[0]
source_relpath = 'App/FingendaNativeFoundation.swift'

project = Xcodeproj::Project.open(project_path)
app_target = project.targets.find { |t| t.name == 'App' }
raise 'App target bulunamadi' unless app_target

file_ref = project.files.find { |f| f.path == source_relpath && f.source_tree == 'SOURCE_ROOT' }
unless file_ref
  app_group = project.main_group.find_subpath('App', true)
  app_group.set_source_tree('<group>')
  app_group.path = 'App'
  file_ref = project.new_file(source_relpath)
  file_ref.source_tree = 'SOURCE_ROOT'
end

app_target.source_build_phase.files.each do |build_file|
  ref = build_file.file_ref
  next unless ref
  next unless ref.path.to_s.end_with?('FingendaNativeFoundation.swift')
  build_file.remove_from_project unless ref == file_ref
end

unless app_target.source_build_phase.files.any? { |build_file| build_file.file_ref == file_ref }
  app_target.source_build_phase.add_file_reference(file_ref)
end

project.save
`;

  const tempRubyPath = path.join(__dirname, '.tmp-install-native-foundation.rb');
  fs.writeFileSync(tempRubyPath, rubyScript, 'utf8');

  try {
    ensureRubyXcodeproj();
    execSync(`ruby "${tempRubyPath}" "${XCODEPROJ_PATH}"`, { stdio: 'inherit' });
  } finally {
    if (fs.existsSync(tempRubyPath)) fs.unlinkSync(tempRubyPath);
  }
}

function main() {
  if (!fs.existsSync(TEMPLATE_PATH)) {
    throw new Error(`Native Swift template bulunamadi: ${TEMPLATE_PATH}`);
  }

  if (!fs.existsSync(XCODEPROJ_PATH)) {
    log('Xcode projesi bulunamadi (ios/App/App.xcodeproj). Native foundation patch atlandi.');
    return;
  }

  ensureDir(APP_TARGET_DIR);

  const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  const changed = writeIfChanged(OUTPUT_PATH, template);
  configureXcodeProject();

  log(changed ? 'FingendaNativeFoundation.swift olusturuldu/guncellendi.' : 'FingendaNativeFoundation.swift zaten guncel.');
  log('Swift migration foundation kurulumu tamamlandi.');
}

main();
