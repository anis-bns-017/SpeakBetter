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

### Microphone on the phone (https)

Phones only allow the microphone on secure (https) pages, so over `http://<this computer>:15173` voice rooms,
voice messages and pronunciation can listen but not record. For those, give the dev site an https address:

1. With the site and API running, start the tunnel: `pnpm --filter web tunnel` (needs
   [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/);
   free, no account). It prints `https://<random words>.trycloudflare.com`. Anyone with that link can open your
   dev site until you stop the tunnel (Ctrl+C).
2. Put the address in `apps/mobile/.env.local` as `EXPO_PUBLIC_WEB_URL=https://…trycloudflare.com` and
   restart Expo. The address changes every time the tunnel starts.
3. Or open the address in the phone's browser.

Over https the web dev server passes the API, sockets and LiveKit on itself (`apps/web/vite.config.ts`), so
nothing else needs changing. Delete `.env.local` to go back to the Wi-Fi address.

Voice itself (rooms, calls) goes straight from the phone to LiveKit on this computer, so the phone must be on the
same Wi-Fi. Start LiveKit with `pnpm livekit` from the repository root; it tells LiveKit this computer's Wi-Fi
address. Run it again if that address changes.

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
it, install a development build of the app once, made one of two ways:

**A. In Expo's cloud (no Android Studio needed).** Needs a free account at expo.dev.

    cd apps/mobile
    npx eas-cli@27.2.0 login
    npx eas-cli@27.2.0 build --platform android --profile development

When it finishes (about 15 minutes) it shows a link and QR code: open it on the phone and install the APK.
Then start the app server with `npx expo start --dev-client` (in `apps/mobile`) and open the installed
SpeakBetter app, which connects to it like Expo Go does.

**B. On this computer.** Install Android Studio first (it brings the Android SDK and Java), then:

    npx expo run:android      # or: npx expo run:ios on a Mac with Xcode

Store builds (`--profile production`) include speech-to-text too. Build settings are in `eas.json`.

Test the page-side script: `pnpm --filter mobile test`.

**Check on a real phone first:** the pronunciation page records your voice for playback while the
recognizer listens. Phones may not let both use the microphone at once; if scores fail while recording,
the playback recording should be switched off inside the app.

## What works differently in the app

- **Google sign-in** is hidden: Google doesn't allow its sign-in page inside apps. Email sign-in works.
- **Notifications**: browser push doesn't exist in the app; phone notifications need a native update.
- Links to other websites open in the phone's browser.
