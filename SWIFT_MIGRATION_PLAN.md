# Fingenda Swift Migration Plan

## Goal

Fingenda currently ships as a Capacitor app whose main product surface is generated from `index.html`. The safe migration path is not to delete the web runtime in one step. The safe path is to add a native SwiftUI foundation first, share the same data contracts, and move screens one by one while TestFlight builds remain stable.

## Current Safe Step

- `scripts/native-swift/FingendaNativeFoundation.swift` defines the native Swift data model, App Group snapshot reader, a SwiftUI dashboard shell, and a UIKit host controller.
- `scripts/install-ios-native-foundation.js` installs that Swift file into the generated iOS project after `npx cap sync ios`.
- `codemagic.yaml` runs the installer in both iOS workflows before native plugins are patched.
- `npm run check:release` verifies that the Swift foundation, installer, and Codemagic wiring stay intact.

## Migration Phases

1. Native foundation
   - Keep Capacitor as the production entry point.
   - Add SwiftUI models and data readers that use the same widget/App Group snapshot contract.
   - No navigation or business logic is replaced yet.

2. Native read-only surfaces
   - Move low-risk surfaces first: Dashboard summary, widgets preview, profile summary, insight cards.
   - Read data from the shared snapshot and existing app storage bridges.
   - Keep writes in the current app until each flow is proven.

3. Native transactional flows
   - Move transaction creation, goals, installments, and notes one at a time.
   - Add Swift data services and explicit persistence tests before each screen replaces its HTML counterpart.

4. Native app shell
   - Once core flows are native and verified, switch the app entry point from `CAPBridgeViewController` to the SwiftUI host.
   - Keep the web surface only as a fallback during one TestFlight cycle.

5. Remove HTML runtime
   - Delete web-only assets only after TestFlight confirms the native shell covers all production flows.
   - Keep release quality checks blocking any stale HTML-only dependency before App Store submission.

## Guardrails

- Do not delete `index.html` until the SwiftUI shell owns navigation, persistence, premium state, localization, and App Review-critical flows.
- Do not duplicate business logic permanently; each moved screen must point to a single data/service source.
- Keep App Group snapshot fields stable so widgets and native screens do not diverge.
- Every phase must pass `npm run check:release` and `npm run build` before pushing.
