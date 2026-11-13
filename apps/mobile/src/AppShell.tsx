// apps/mobile/src/AppShell.tsx
// The whole app: SpeakBetter's website in a full-screen web view, with what a phone app needs around it.
//  - Microphone for voice rooms, calls and pronunciation (permissions in app.json)
//  - Speech-to-text through the phone's own recognizer (speechBridge.ts), which web views lack
//  - Sign-in cookies kept between launches
//  - Android back button goes back a page; links to other sites open in the phone's browser
//  - A clear screen with "Try again" when SpeakBetter can't be reached
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, Linking, Pressable, StyleSheet, Text, View, useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import type { ShouldStartLoadRequest } from "react-native-webview/lib/WebViewTypes";
import { APP_USER_AGENT, WEB_ORIGIN, WEB_URL } from "./config";
import { useSpeechBridge } from "./speechBridge";

/** Page colours of the site (apps/web index.css), so there's no white flash behind it */
const COLORS = {
  light: { page: "#f8fafc", text: "#0f172a", muted: "#475569", accent: "#4f46e5" },
  dark: { page: "#0b1120", text: "#f1f5f9", muted: "#94a3b8", accent: "#818cf8" },
};

/** Pages that are part of the app itself; anything else (other sites, mail, phone numbers) leaves the app */
const staysInApp = (url: string) =>
  url.startsWith("about:") || url.startsWith("blob:") || url.startsWith("data:") || (!!WEB_ORIGIN && url.toLowerCase().startsWith(WEB_ORIGIN));

export function AppShell() {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const colors = COLORS[scheme];
  const webView = useRef<WebView>(null);
  // The phone's speech recognizer, offered to the site as window.SpeechRecognition
  const speech = useSpeechBridge(webView);
  const [canGoBack, setCanGoBack] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  // Android back button: back one page inside SpeakBetter, and only leave the app from the first page
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!canGoBack) return false;
      webView.current?.goBack();
      return true;
    });
    return () => sub.remove();
  }, [canGoBack]);

  const onShouldStartLoad = useCallback((request: ShouldStartLoadRequest) => {
    if (staysInApp(request.url)) return true;
    void Linking.openURL(request.url).catch(() => undefined);
    return false;
  }, []);

  const retry = () => {
    setFailed(false);
    setLoaded(false);
    webView.current?.reload();
  };

  if (!WEB_URL) {
    return (
      <Message
        colors={colors}
        title="This build has no address set"
        text="Set EXPO_PUBLIC_WEB_URL to the SpeakBetter website and build again."
      />
    );
  }

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: colors.page }]} edges={["top", "left", "right"]}>
      <WebView
        ref={webView}
        source={{ uri: WEB_URL }}
        style={[styles.fill, { backgroundColor: colors.page }]}
        applicationNameForUserAgent={APP_USER_AGENT}
        // Sign-in lives in cookies: keep them between launches and send them to the API next door
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        domStorageEnabled
        // Voice rooms, calls and pronunciation play and record sound
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        mediaCapturePermissionGrantType="grantIfSameHostElsePrompt"
        // Feels like an app: swipe back on iPhone, pull down to refresh, no pinch-zoom of the page
        allowsBackForwardNavigationGestures
        pullToRefreshEnabled
        setBuiltInZoomControls={false}
        // window.open / target=_blank stay in this view, then onShouldStartLoad decides
        setSupportMultipleWindows={false}
        originWhitelist={["*"]}
        onShouldStartLoadWithRequest={onShouldStartLoad}
        onNavigationStateChange={(state) => setCanGoBack(state.canGoBack)}
        injectedJavaScriptBeforeContentLoaded={speech.injectedScript}
        onMessage={speech.onMessage}
        onLoadStart={speech.onPageStart}
        onLoadEnd={() => setLoaded(true)}
        onError={() => setFailed(true)}
        onHttpError={(event) => {
          // Only the page itself failing counts; a broken image inside it doesn't
          if (event.nativeEvent.statusCode >= 500 && event.nativeEvent.url === WEB_URL) setFailed(true);
        }}
        onContentProcessDidTerminate={() => webView.current?.reload()}
        onRenderProcessGone={() => webView.current?.reload()}
      />

      {!loaded && !failed && (
        <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: colors.page }]} accessibilityLabel="Loading SpeakBetter">
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      )}

      {failed && (
        <View style={StyleSheet.absoluteFill}>
          <Message
            colors={colors}
            title="Can't reach SpeakBetter"
            subtitle="SpeakBetter-এ পৌঁছানো যাচ্ছে না"
            text={"Check your internet connection, then try again.\nইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।"}
            action={{ label: "Try again · আবার চেষ্টা করুন", onPress: retry }}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

/** A full-screen message in the app's own colours (used when the site can't be shown) */
function Message({
  colors,
  title,
  subtitle,
  text,
  action,
}: {
  colors: (typeof COLORS)["light"];
  title: string;
  subtitle?: string;
  text: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <SafeAreaView style={[styles.fill, styles.center, styles.padded, { backgroundColor: colors.page }]}>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
        {title}
      </Text>
      {subtitle ? <Text style={[styles.subtitle, { color: colors.text }]}>{subtitle}</Text> : null}
      <Text style={[styles.text, { color: colors.muted }]}>{text}</Text>
      {action ? (
        <Pressable
          accessibilityRole="button"
          onPress={action.onPress}
          style={({ pressed }) => [styles.button, { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 }]}
        >
          <Text style={styles.buttonText}>{action.label}</Text>
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center" },
  padded: { paddingHorizontal: 28 },
  title: { fontSize: 22, fontWeight: "700", textAlign: "center" },
  subtitle: { marginTop: 4, fontSize: 17, fontWeight: "600", textAlign: "center" },
  text: { marginTop: 12, fontSize: 15, lineHeight: 22, textAlign: "center" },
  button: { marginTop: 24, minHeight: 48, borderRadius: 14, paddingHorizontal: 22, justifyContent: "center" },
  buttonText: { color: "#ffffff", fontSize: 16, fontWeight: "600" },
});
