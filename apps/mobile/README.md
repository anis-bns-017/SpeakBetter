# SpeakBetter for Android and iPhone

The phone app is the SpeakBetter website in a native frame (`src/AppShell.tsx`). Every feature of the site is
in the app, and updating the site updates the app. The site knows it is inside the app from the browser name
(`SpeakBetterApp/…`, see `apps/web/src/lib/pwa.ts`, `isNativeApp`).

## Try it on your phone (development)

1. On the computer, start the site so the phone can reach it:
   - add `DEV_LAN=1` to `apps/web/.env` (opens the web dev server to your Wi-Fi), then run `pnpm dev`
     as usual. The API needs no change: in development it accepts your local network.
2. Start Expo: `pnpm --filter mobile start`
3. On the phone (same Wi-Fi), open **Expo Go** and scan the QR code.

The app opens `http://<this computer>:15173`. On the Android emulator it uses `10.0.2.2`, on the iOS
simulator `localhost`. To point it somewhere else, set `EXPO_PUBLIC_WEB_URL` (see `.env.example`).

## Store builds

- Set `EXPO_PUBLIC_WEB_URL` to the live https address of the site. A store build without it shows
  "This build has no address set".
- Change `com.speakbetter.app` in `app.json` to the app ID you register with Google Play and Apple.
- Build with EAS: `npx eas build --platform android` / `--platform ios` (needs an Expo account).

## Speech-to-text

Phone web views have no speech recognition, so the app lends the site the phone's own recognizer (Google on
Android, Apple on iPhone): `src/speechBridge.ts` runs it, and `src/speechPolyfill.ts` gives the page a
`window.SpeechRecognition` that talks to it. Pronunciation scores, live captions and speaking to the AI
partner then work without changes to the site.

It is a native module, so it is **not in Expo Go**: there the app works, just without speech-to-text. To get
it, make a development build once (needs Android Studio, or Xcode on a Mac):

    npx expo run:android      # or: npx expo run:ios

and open that build instead of Expo Go. Store builds (EAS) include it.

Test the page-side script: `pnpm --filter mobile test`.

**Check on a real phone first:** the pronunciation page records your voice for playback while the
recognizer listens. Phones may not let both use the microphone at once; if scores fail while recording,
the playback recording should be switched off inside the app.

## What works differently in the app

- **Google sign-in** is hidden: Google doesn't allow its sign-in page inside apps. Email sign-in works.
- **Notifications**: browser push doesn't exist in the app; phone notifications need a native update.
- Links to other websites open in the phone's browser.
