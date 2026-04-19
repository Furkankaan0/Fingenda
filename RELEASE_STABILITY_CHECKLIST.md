# Fingenda Release Stability Checklist

## 1) Build / Pipeline
- [ ] `npm run build` passes locally.
- [ ] `www/build-config.js` is generated with expected channel values.
- [ ] Codemagic `ios-testflight` uses `FINGENDA_BUILD_CHANNEL=testflight`.
- [ ] Codemagic `ios-release` uses `FINGENDA_BUILD_CHANNEL=release`.
- [ ] Test premium bypass is OFF on release channel.

## 2) Premium / Paywall
- [ ] `window.buyPremium()` opens the primary paywall flow.
- [ ] `window.checkPremiumFeature()` respects real entitlement state.
- [ ] Premium does not auto-unlock on release channel.
- [ ] Restore flow updates UI state immediately.
- [ ] Closing paywall does not re-open a second paywall unexpectedly.

## 3) Tools Modal (Currency / Loan)
- [ ] Currency modal opens and computes values correctly.
- [ ] Loan modal opens and computes monthly/total/interest correctly.
- [ ] No duplicate-id side effects in modal inputs.
- [ ] All modal actions work without inline onclick dependencies.
- [ ] TR/EN labels switch based on selected language.

## 4) Badge Detail Performance
- [ ] Badge detail opens without visual corruption.
- [ ] Gyro interaction remains smooth on iOS test devices.
- [ ] Closing badge detail returns to expected context.
- [ ] No stuck animation loop after modal close.

## 5) i18n / Content
- [ ] Core premium and tools messaging appears in selected language.
- [ ] No mixed-language strings in tested critical paths.
- [ ] No broken mojibake strings in edited flows.

## 6) Submission Readiness
- [ ] App Store metadata fields filled from `APPSTORE_SUBMISSION_METADATA_TR_EN.md`.
- [ ] Privacy policy/support URLs updated from placeholder domains.
- [ ] Age rating questionnaire completed using agreed defaults.
- [ ] App Review notes included for permission-sensitive features.
