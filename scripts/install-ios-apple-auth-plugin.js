const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const IOS_APP_DIR = path.join(ROOT, 'ios', 'App', 'App');
const XCODEPROJ_PATH = path.join(ROOT, 'ios', 'App', 'App.xcodeproj');
const APP_DELEGATE_PATH = path.join(IOS_APP_DIR, 'AppDelegate.swift');
const APP_ENTITLEMENTS_PATH = path.join(IOS_APP_DIR, 'App.entitlements');

const APPLE_AUTH_BLOCK = `
// FINGENDA_APPLE_AUTH_PLUGIN_BEGIN
import AuthenticationServices

@objc(FingendaAppleAuthPlugin)
public class FingendaAppleAuthPlugin: CAPPlugin, CAPBridgedPlugin, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    public let identifier = "FingendaAppleAuthPlugin"
    public let jsName = "FingendaAppleAuth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "signIn", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getCredentialState", returnType: CAPPluginReturnPromise)
    ]

    private var pendingSignInCall: CAPPluginCall?

    @objc func signIn(_ call: CAPPluginCall) {
        guard pendingSignInCall == nil else {
            call.reject("Apple sign-in is already in progress.")
            return
        }

        let request = ASAuthorizationAppleIDProvider().createRequest()
        request.requestedScopes = [.fullName, .email]

        pendingSignInCall = call

        let controller = ASAuthorizationController(authorizationRequests: [request])
        controller.delegate = self
        controller.presentationContextProvider = self
        controller.performRequests()
    }

    @objc func getCredentialState(_ call: CAPPluginCall) {
        guard let userId = call.getString("userId"), !userId.isEmpty else {
            call.reject("Missing Apple user identifier.")
            return
        }

        ASAuthorizationAppleIDProvider().getCredentialState(forUserID: userId) { state, error in
            DispatchQueue.main.async {
                if let error {
                    call.reject("Apple credential state could not be checked.", nil, error)
                    return
                }

                let stateText: String
                switch state {
                case .authorized:
                    stateText = "authorized"
                case .revoked:
                    stateText = "revoked"
                case .notFound:
                    stateText = "notFound"
                case .transferred:
                    stateText = "transferred"
                @unknown default:
                    stateText = "unknown"
                }

                call.resolve(["state": stateText])
            }
        }
    }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        guard let call = pendingSignInCall else { return }
        pendingSignInCall = nil

        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential else {
            call.reject("Apple sign-in did not return a valid credential.")
            return
        }

        let givenName = credential.fullName?.givenName ?? ""
        let familyName = credential.fullName?.familyName ?? ""
        let fullName = [givenName, familyName].filter { !$0.isEmpty }.joined(separator: " ")
        let identityToken = credential.identityToken.flatMap { String(data: $0, encoding: .utf8) } ?? ""
        let authorizationCode = credential.authorizationCode.flatMap { String(data: $0, encoding: .utf8) } ?? ""

        call.resolve([
            "user": credential.user,
            "email": credential.email ?? "",
            "fullName": fullName,
            "givenName": givenName,
            "familyName": familyName,
            "identityToken": identityToken,
            "authorizationCode": authorizationCode,
            "realUserStatus": credential.realUserStatus.rawValue
        ])
    }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        guard let call = pendingSignInCall else { return }
        pendingSignInCall = nil

        let nsError = error as NSError
        if nsError.domain == ASAuthorizationError.errorDomain && nsError.code == ASAuthorizationError.canceled.rawValue {
            call.resolve(["cancelled": true])
            return
        }

        call.reject("Apple sign-in failed.", nil, error)
    }

    public func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        if let window = bridge?.viewController?.view.window {
            return window
        }

        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        if let keyWindow = scenes.flatMap({ $0.windows }).first(where: { $0.isKeyWindow }) {
            return keyWindow
        }

        return ASPresentationAnchor()
    }
}
// FINGENDA_APPLE_AUTH_PLUGIN_END
`;

function log(message) {
  console.log(`[iOS Apple Auth] ${message}`);
}

function insertImport(content, importLine) {
  if (content.includes(importLine)) return content;
  if (content.includes('import Capacitor')) {
    return content.replace('import Capacitor', `import Capacitor\n${importLine}`);
  }
  return `${importLine}\n${content}`;
}

function patchAppDelegate() {
  if (!fs.existsSync(APP_DELEGATE_PATH)) {
    log('AppDelegate.swift bulunamadi, Apple auth patch atlandi.');
    return;
  }

  let content = fs.readFileSync(APP_DELEGATE_PATH, 'utf8');
  content = insertImport(content, 'import AuthenticationServices');

  const blockPattern = /\/\/ FINGENDA_APPLE_AUTH_PLUGIN_BEGIN[\s\S]*?\/\/ FINGENDA_APPLE_AUTH_PLUGIN_END/;
  if (blockPattern.test(content)) {
    content = content.replace(blockPattern, APPLE_AUTH_BLOCK.trim());
  } else if (content.includes('class FingendaBridgeViewController')) {
    content = content.replace('class FingendaBridgeViewController', `${APPLE_AUTH_BLOCK.trim()}\n\nclass FingendaBridgeViewController`);
  } else {
    content = `${content.trim()}\n\n${APPLE_AUTH_BLOCK.trim()}\n`;
  }

  const registration = 'bridge?.registerPluginInstance(FingendaAppleAuthPlugin())';
  if (!content.includes(registration)) {
    if (content.includes('bridge?.registerPluginInstance(FingendaSpeechRecognitionPlugin())')) {
      content = content.replace(
        'bridge?.registerPluginInstance(FingendaSpeechRecognitionPlugin())',
        `bridge?.registerPluginInstance(FingendaSpeechRecognitionPlugin())\n        ${registration}`
      );
    } else if (content.includes('override open func capacitorDidLoad() {')) {
      content = content.replace(
        'override open func capacitorDidLoad() {',
        `override open func capacitorDidLoad() {\n        ${registration}`
      );
    }
  }

  fs.writeFileSync(APP_DELEGATE_PATH, content, 'utf8');
  log('AppDelegate.swift Apple auth plugini ile guncellendi.');
}

function ensureEntitlements() {
  const appleSignInEntry = `\t<key>com.apple.developer.applesignin</key>\n\t<array>\n\t\t<string>Default</string>\n\t</array>`;

  let content;
  if (fs.existsSync(APP_ENTITLEMENTS_PATH)) {
    content = fs.readFileSync(APP_ENTITLEMENTS_PATH, 'utf8');
  } else {
    content = `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0">\n<dict>\n</dict>\n</plist>\n`;
  }

  if (!content.includes('com.apple.developer.applesignin')) {
    content = content.replace(/\n<\/dict>\s*<\/plist>\s*$/u, `\n${appleSignInEntry}\n</dict>\n</plist>\n`);
  }

  fs.writeFileSync(APP_ENTITLEMENTS_PATH, content, 'utf8');
  log('App.entitlements Sign in with Apple icin dogrulandi.');
}

function patchXcodeCapabilities() {
  if (!fs.existsSync(XCODEPROJ_PATH)) return;

  const rubyScript = `require 'xcodeproj'
project_path = ARGV[0]
project = Xcodeproj::Project.open(project_path)
app_target = project.targets.find { |t| t.name == 'App' }
raise 'App target bulunamadi' unless app_target

app_target.build_configurations.each do |config|
  config.build_settings['CODE_SIGN_ENTITLEMENTS'] = 'App/App.entitlements'
end

attrs = project.root_object.attributes['TargetAttributes'] ||= {}
target_attrs = attrs[app_target.uuid] ||= {}
caps = target_attrs['SystemCapabilities'] ||= {}
caps['com.apple.SignInWithApple'] = { 'enabled' => 1 }

project.save
`;

  const rubyFile = path.join(__dirname, '.tmp-install-apple-auth.rb');
  fs.writeFileSync(rubyFile, rubyScript, 'utf8');

  try {
    execSync('ruby -e "require \'xcodeproj\'"', { stdio: 'ignore' });
    execSync(`ruby "${rubyFile}" "${XCODEPROJ_PATH}"`, { stdio: 'inherit' });
    log('Xcode capability ayarlari dogrulandi.');
  } catch (error) {
    log('xcodeproj gem bulunamadi veya capability patch atlandi; build entitlements dosyasini kullanmaya devam edecek.');
  } finally {
    if (fs.existsSync(rubyFile)) fs.unlinkSync(rubyFile);
  }
}

function main() {
  patchAppDelegate();
  ensureEntitlements();
  patchXcodeCapabilities();
  log('Apple auth kurulumu tamamlandi.');
}

main();
