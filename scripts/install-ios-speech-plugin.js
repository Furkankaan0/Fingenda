const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const IOS_APP_DIR = path.join(ROOT, 'ios', 'App', 'App');
const APP_DELEGATE_PATH = path.join(IOS_APP_DIR, 'AppDelegate.swift');
const INFO_PLIST_PATH = path.join(IOS_APP_DIR, 'Info.plist');
const STORYBOARD_PATH = path.join(IOS_APP_DIR, 'Base.lproj', 'Main.storyboard');

const SPEECH_BLOCK = `
// FINGENDA_NATIVE_SPEECH_PLUGIN_BEGIN
import Speech
import AVFoundation
import UIKit

@objc(FingendaSpeechRecognitionPlugin)
public class FingendaSpeechRecognitionPlugin: CAPPlugin, CAPBridgedPlugin, SFSpeechRecognizerDelegate {
    public let identifier = "FingendaSpeechRecognitionPlugin"
    public let jsName = "FingendaSpeechRecognition"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getAvailability", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startListening", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopListening", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancelListening", returnType: CAPPluginReturnPromise)
    ]

    private var audioEngine: AVAudioEngine?
    private var speechRecognizer: SFSpeechRecognizer?
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    private var currentTranscript = ""
    private var isStopping = false
    private var inputTapInstalled = false
    private var activeInputNode: AVAudioInputNode?

    @objc func getAvailability(_ call: CAPPluginCall) {
        let locale = call.getString("locale") ?? Locale.current.identifier
        let recognizer = makeRecognizer(locale: locale)
        let speechStatus = SFSpeechRecognizer.authorizationStatus()
        let microphoneStatus = AVAudioSession.sharedInstance().recordPermission
        let permissionsResolved = speechStatus == .authorized && microphoneStatus == .granted
        let available = recognizer != nil && (!permissionsResolved || recognizer?.isAvailable == true)

        call.resolve([
            "available": available,
            "speechPermission": speechPermissionText(from: speechStatus),
            "microphonePermission": microphonePermissionText(from: microphoneStatus),
            "locale": recognizer?.locale.identifier ?? locale,
            "reason": availabilityReason(available: available, speechStatus: speechStatus, microphoneStatus: microphoneStatus)
        ])
    }

    @objc func startListening(_ call: CAPPluginCall) {
        let locale = call.getString("locale") ?? Locale.current.identifier

        requestPermissions { [weak self] granted, errorMessage in
            guard let self else { return }

            guard granted else {
                self.notifyListeners("speechState", data: [
                    "state": "permissionDenied",
                    "message": errorMessage ?? "Speech recognition permission was denied."
                ])
                call.reject(errorMessage ?? "Speech recognition permission was denied.")
                return
            }

            DispatchQueue.main.async {
                self.beginRecognition(locale: locale, call: call)
            }
        }
    }

    @objc func stopListening(_ call: CAPPluginCall) {
        isStopping = true

        if let engine = audioEngine, engine.isRunning {
            engine.stop()
        }
        safeRemoveInputTap()

        recognitionRequest?.endAudio()

        notifyListeners("speechState", data: [
            "state": "stopped",
            "transcript": currentTranscript
        ])

        call.resolve([
            "stopped": true,
            "transcript": currentTranscript
        ])

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) { [weak self] in
            self?.cleanupRecognition(deactivateAudio: true)
            self?.isStopping = false
        }
    }

    @objc func cancelListening(_ call: CAPPluginCall) {
        isStopping = true
        cleanupRecognition(deactivateAudio: true)
        notifyListeners("speechState", data: ["state": "cancelled"])
        call.resolve(["cancelled": true])
        isStopping = false
    }

    private func beginRecognition(locale: String, call: CAPPluginCall) {
        cleanupRecognition(deactivateAudio: false)

        guard let recognizer = makeRecognizer(locale: locale) else {
            let message = "Speech recognition is not available for the selected language."
            notifyListeners("speechState", data: ["state": "unavailable", "message": message])
            call.reject(message)
            return
        }

        guard recognizer.isAvailable else {
            let message = "Speech recognition is currently unavailable."
            notifyListeners("speechState", data: ["state": "unavailable", "message": message])
            call.reject(message)
            return
        }

        speechRecognizer = recognizer
        speechRecognizer?.delegate = self

        let session = AVAudioSession.sharedInstance()

        do {
            try session.setCategory(.playAndRecord, mode: .measurement, options: [.duckOthers, .defaultToSpeaker, .allowBluetooth])
            try session.setActive(true, options: .notifyOthersOnDeactivation)

            let engine = AVAudioEngine()
            audioEngine = engine

            let request = SFSpeechAudioBufferRecognitionRequest()
            request.shouldReportPartialResults = true
            recognitionRequest = request

            let inputNode = engine.inputNode
            activeInputNode = inputNode
            let recordingFormat = inputNode.outputFormat(forBus: 0)
            guard recordingFormat.channelCount > 0 else {
                let message = "Microphone input is not ready yet. Please try again."
                cleanupRecognition(deactivateAudio: true)
                notifyListeners("speechState", data: ["state": "error", "message": message])
                call.reject(message)
                return
            }

            safeRemoveInputTap()
            inputNode.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) { [weak self] buffer, _ in
                self?.recognitionRequest?.append(buffer)
            }
            inputTapInstalled = true

            engine.prepare()
            try engine.start()
            currentTranscript = ""
            isStopping = false

            recognitionTask = recognizer.recognitionTask(with: request) { [weak self] result, error in
                DispatchQueue.main.async { [weak self] in
                    guard let self else { return }

                    if let result = result {
                        let transcript = result.bestTranscription.formattedString.trimmingCharacters(in: .whitespacesAndNewlines)
                        self.currentTranscript = transcript
                        self.notifyListeners("speechResult", data: [
                            "transcript": transcript,
                            "isFinal": result.isFinal
                        ])

                        if result.isFinal {
                            self.notifyListeners("speechState", data: ["state": "completed"])
                            self.cleanupRecognition(deactivateAudio: true)
                        }
                    }

                    if let error = error {
                        if !self.isStopping {
                            self.notifyListeners("speechState", data: [
                                "state": "error",
                                "message": error.localizedDescription
                            ])
                        }

                        self.cleanupRecognition(deactivateAudio: true)
                    }
                }
            }

            notifyListeners("speechState", data: [
                "state": "listening",
                "locale": recognizer.locale.identifier
            ])

            call.resolve([
                "started": true,
                "locale": recognizer.locale.identifier
            ])
        } catch {
            cleanupRecognition(deactivateAudio: true)
            notifyListeners("speechState", data: [
                "state": "error",
                "message": error.localizedDescription
            ])
            call.reject("Speech recognition could not start.", nil, error)
        }
    }

    private func cleanupRecognition(deactivateAudio: Bool) {
        recognitionTask?.cancel()
        recognitionTask = nil

        recognitionRequest?.endAudio()
        recognitionRequest = nil

        if let engine = audioEngine, engine.isRunning {
            engine.stop()
        }
        safeRemoveInputTap()
        audioEngine = nil
        activeInputNode = nil
        speechRecognizer?.delegate = nil
        speechRecognizer = nil

        if deactivateAudio {
            try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        }
    }

    private func safeRemoveInputTap() {
        guard inputTapInstalled else { return }
        activeInputNode?.removeTap(onBus: 0)
        inputTapInstalled = false
    }

    private func requestPermissions(completion: @escaping (Bool, String?) -> Void) {
        let missingDescriptions = missingUsageDescriptions()
        guard missingDescriptions.isEmpty else {
            completion(false, "Missing iOS permission descriptions: \\(missingDescriptions.joined(separator: ", ")).")
            return
        }

        SFSpeechRecognizer.requestAuthorization { [weak self] status in
            DispatchQueue.main.async {
                guard let self else { return }

                guard status == .authorized else {
                    completion(false, self.authorizationMessage(for: status))
                    return
                }

                AVAudioSession.sharedInstance().requestRecordPermission { granted in
                    DispatchQueue.main.async {
                        completion(granted, granted ? nil : "Microphone permission was denied.")
                    }
                }
            }
        }
    }

    private func missingUsageDescriptions() -> [String] {
        let requiredKeys = [
            "NSMicrophoneUsageDescription",
            "NSSpeechRecognitionUsageDescription"
        ]

        return requiredKeys.filter { key in
            guard let value = Bundle.main.object(forInfoDictionaryKey: key) as? String else {
                return true
            }

            return value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        }
    }

    private func makeRecognizer(locale: String) -> SFSpeechRecognizer? {
        let preferred = Locale(identifier: locale)
        if let recognizer = SFSpeechRecognizer(locale: preferred) {
            return recognizer
        }

        return SFSpeechRecognizer(locale: Locale(identifier: "tr-TR")) ?? SFSpeechRecognizer()
    }

    private func authorizationMessage(for status: SFSpeechRecognizerAuthorizationStatus) -> String {
        switch status {
        case .denied:
            return "Speech recognition permission was denied."
        case .restricted:
            return "Speech recognition is restricted on this device."
        case .notDetermined:
            return "Speech recognition permission has not been determined yet."
        default:
            return "Speech recognition is unavailable right now."
        }
    }

    private func availabilityReason(available: Bool, speechStatus: SFSpeechRecognizerAuthorizationStatus, microphoneStatus: AVAudioSession.RecordPermission) -> String {
        if !available {
            return "Speech recognition is currently unavailable."
        }

        if speechStatus == .denied || speechStatus == .restricted {
            return authorizationMessage(for: speechStatus)
        }

        if microphoneStatus == .denied {
            return "Microphone permission was denied."
        }

        return ""
    }

    private func speechPermissionText(from status: SFSpeechRecognizerAuthorizationStatus) -> String {
        switch status {
        case .authorized:
            return "granted"
        case .denied:
            return "denied"
        case .restricted:
            return "restricted"
        case .notDetermined:
            return "prompt"
        @unknown default:
            return "unknown"
        }
    }

    private func microphonePermissionText(from status: AVAudioSession.RecordPermission) -> String {
        switch status {
        case .granted:
            return "granted"
        case .denied:
            return "denied"
        case .undetermined:
            return "prompt"
        @unknown default:
            return "unknown"
        }
    }

    public func speechRecognizer(_ speechRecognizer: SFSpeechRecognizer, availabilityDidChange available: Bool) {
        notifyListeners("speechState", data: [
            "state": available ? "available" : "unavailable",
            "locale": speechRecognizer.locale.identifier
        ])
    }
}

@objc(FingendaFileExporterPlugin)
public class FingendaFileExporterPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "FingendaFileExporterPlugin"
    public let jsName = "FingendaFileExporter"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "shareBase64File", returnType: CAPPluginReturnPromise)
    ]

    @objc func shareBase64File(_ call: CAPPluginCall) {
        guard let base64 = call.getString("base64"), !base64.isEmpty else {
            call.reject("File content is missing.")
            return
        }

        let requestedFilename = call.getString("filename") ?? "fingenda-export"
        let filename = sanitizedFilename(requestedFilename)

        guard let data = Data(base64Encoded: base64, options: .ignoreUnknownCharacters) else {
            call.reject("File content could not be decoded.")
            return
        }

        do {
            let exportDirectory = FileManager.default.temporaryDirectory.appendingPathComponent("FingendaExports", isDirectory: true)
            try FileManager.default.createDirectory(at: exportDirectory, withIntermediateDirectories: true)

            let fileURL = exportDirectory.appendingPathComponent(filename)
            if FileManager.default.fileExists(atPath: fileURL.path) {
                try FileManager.default.removeItem(at: fileURL)
            }
            try data.write(to: fileURL, options: .atomic)

            DispatchQueue.main.async { [weak self] in
                guard let self else { return }
                guard let presenter = self.topPresenter(from: self.bridge?.viewController) else {
                    call.reject("Share sheet could not be presented.")
                    return
                }

                let activityController = UIActivityViewController(activityItems: [fileURL], applicationActivities: nil)
                activityController.excludedActivityTypes = [.assignToContact, .addToReadingList]

                if let popover = activityController.popoverPresentationController {
                    popover.sourceView = presenter.view
                    popover.sourceRect = CGRect(x: presenter.view.bounds.midX, y: presenter.view.bounds.midY, width: 0, height: 0)
                    popover.permittedArrowDirections = []
                }

                activityController.completionWithItemsHandler = { _, completed, _, error in
                    if let error {
                        call.reject("File sharing failed.", nil, error)
                        return
                    }

                    call.resolve([
                        "completed": completed,
                        "filename": filename
                    ])
                }

                presenter.present(activityController, animated: true)
            }
        } catch {
            call.reject("File could not be prepared for sharing.", nil, error)
        }
    }

    private func sanitizedFilename(_ rawFilename: String) -> String {
        let forbiddenCharacters = CharacterSet(charactersIn: "/\\\\:?%*|\\\"<>")
        let cleaned = rawFilename
            .components(separatedBy: forbiddenCharacters)
            .joined(separator: "-")
            .trimmingCharacters(in: .whitespacesAndNewlines)

        return cleaned.isEmpty ? "fingenda-export" : cleaned
    }

    private func topPresenter(from viewController: UIViewController?) -> UIViewController? {
        var presenter = viewController
        while let presented = presenter?.presentedViewController {
            presenter = presented
        }
        return presenter
    }
}

class FingendaBridgeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(FingendaSpeechRecognitionPlugin())
        bridge?.registerPluginInstance(FingendaFileExporterPlugin())
    }
}
// FINGENDA_NATIVE_SPEECH_PLUGIN_END
`;

function setPlistString(content, key, value) {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const keyValuePattern = new RegExp(`\\s*<key>${escapedKey}<\\/key>\\s*<string>[\\s\\S]*?<\\/string>`, 'g');
    const nextEntry = `\n\t<key>${key}</key>\n\t<string>${value}</string>`;

    if (keyValuePattern.test(content)) {
        return content.replace(keyValuePattern, nextEntry);
    }

    return content.replace(/\n<\/dict>\s*<\/plist>\s*$/u, `${nextEntry}\n</dict>\n</plist>\n`);
}

function patchInfoPlist() {
    if (!fs.existsSync(INFO_PLIST_PATH)) {
        console.log('[iOS Speech] Info.plist bulunamadi, izin metni patch atlandi.');
        return;
    }

    let content = fs.readFileSync(INFO_PLIST_PATH, 'utf8');
    content = setPlistString(content, 'NSMicrophoneUsageDescription', 'Fingenda, sesle islem ekleme ozelligi icin mikrofonunuza erisim istiyor.');
    content = setPlistString(content, 'NSSpeechRecognitionUsageDescription', 'Fingenda, sesinizi yaziya cevirerek hizli islem girisi yapabilmek icin ses tanima izni istiyor.');

    fs.writeFileSync(INFO_PLIST_PATH, content, 'utf8');
    console.log('[iOS Speech] Info.plist mikrofon ve ses tanima izin metinleri dogrulandi.');
}

function patchAppDelegate() {
    if (!fs.existsSync(APP_DELEGATE_PATH)) {
        console.log('[iOS Speech] AppDelegate.swift bulunamadi, patch atlandi.');
        return;
    }

    let content = fs.readFileSync(APP_DELEGATE_PATH, 'utf8');

    if (!content.includes('import Capacitor')) {
        throw new Error('AppDelegate.swift beklenen Capacitor importunu icermiyor.');
    }

    const importLines = ['import Speech', 'import AVFoundation', 'import UIKit'];
    let nextContent = content;
    for (const importLine of importLines) {
        if (!nextContent.includes(importLine)) {
            nextContent = nextContent.replace('import Capacitor', `import Capacitor\n${importLine}`);
        }
    }

    const blockPattern = /\/\/ FINGENDA_NATIVE_SPEECH_PLUGIN_BEGIN[\s\S]*?\/\/ FINGENDA_NATIVE_SPEECH_PLUGIN_END/;
    if (blockPattern.test(nextContent)) {
        nextContent = nextContent.replace(blockPattern, SPEECH_BLOCK.trim());
    } else {
        nextContent = `${nextContent.trim()}\n\n${SPEECH_BLOCK.trim()}\n`;
    }

    fs.writeFileSync(APP_DELEGATE_PATH, nextContent, 'utf8');
    console.log('[iOS Speech] AppDelegate.swift guncellendi.');
}

function patchStoryboard() {
    if (!fs.existsSync(STORYBOARD_PATH)) {
        console.log('[iOS Speech] Main.storyboard bulunamadi, patch atlandi.');
        return;
    }

    let content = fs.readFileSync(STORYBOARD_PATH, 'utf8');

    content = content.replace(
        /customClass="CAPBridgeViewController"(?:\s+customModule="[^"]+")?(?:\s+customModuleProvider="[^"]+")?/g,
        'customClass="FingendaBridgeViewController" customModuleProvider="target"'
    );

    fs.writeFileSync(STORYBOARD_PATH, content, 'utf8');
    console.log('[iOS Speech] Main.storyboard guncellendi.');
}

patchInfoPlist();
patchAppDelegate();
patchStoryboard();
