// apps/mobile/App.tsx
// SpeakBetter for Android and iPhone: the website in a native frame (src/AppShell.tsx).
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppShell } from "./src/AppShell";

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <AppShell />
    </SafeAreaProvider>
  );
}
