import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "./contexts/AuthContext";
import { QueryProvider } from "./providers/QueryProvider";
import { SidebarProvider } from "./contexts/SidebarContext"; // ✅ Import this
import { ThemeProvider, useTheme } from "./contexts/ThemeContext";
import { ThemeSync } from "./components/theme/ThemeSync";
import AppRoutes from "./routes";
import { LanguageProvider } from "./i18n";
import { ErrorBoundary } from "./components/common/ErrorBoundary";

/** Toasts follow the app's theme (navy uses the dark toast style) */
const ThemedToaster = () => {
  const { resolved } = useTheme();
  return <Toaster position="top-center" richColors closeButton theme={resolved === "light" ? "light" : "dark"} />;
};

const App = () => {
  return (
    <ThemeProvider>
      {/* Last line of defence: a crash anywhere shows a way back instead of a blank page */}
      <ErrorBoundary variant="app">
      <QueryProvider>
        <BrowserRouter>
          <AuthProvider>
            <LanguageProvider>
            <ThemeSync />
            <SidebarProvider> {/* ✅ Wrap with SidebarProvider */}
              <AppRoutes />
            </SidebarProvider>
            {/* Every toast() in the app shows here; without it they were silently dropped */}
            <ThemedToaster />
            </LanguageProvider>
          </AuthProvider>
        </BrowserRouter>
      </QueryProvider>
      </ErrorBoundary>
    </ThemeProvider>
  );
};

export default App;
