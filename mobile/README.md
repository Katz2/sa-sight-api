# SA Sight mobile app (React Native / Expo SDK 58)

This is a complete Expo project. It typechecks and bundles for Android (verified with the real Expo and React Native types and a Metro bundle). It has **not yet been run on a phone**.

1. `npm install`
2. Copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_URL` to your API (must be https).
3. `npx expo start`, then scan the QR code with Expo Go on an Android phone.
4. Test APK: `npx eas-cli build -p android --profile preview`.

Features: first-launch user guide (shown once), anonymous report, receipt, tip status, reward claim, quick exit, optional protected receipt storage, screenshot and recording block.

Demo recording: set `EXPO_PUBLIC_DEMO_MODE=1` for the recording build only, see `../docs/DEMO_VIDEO.md`. Replace the default icon in `assets/` before release.

Before release: certificate pinning (needs a development build, not Expo Go), no analytics or ad SDKs, OWASP MASVS testing.
