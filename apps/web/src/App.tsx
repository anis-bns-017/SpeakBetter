import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "./contexts/AuthContext";
import { QueryProvider } from "./providers/QueryProvider";
import { SidebarProvider } from "./contexts/SidebarContext"; // ✅ Import this
import { ThemeProvider, useTheme } from "./contexts/ThemeContext";
import { ThemeSync } from "./components/theme/ThemeSync";
import AppRoutes from "./routes";

/** Toasts follow the app's theme (navy uses the dark toast style) */
const ThemedToaster = () => {
  const { resolved } = useTheme();
  return <Toaster position="top-center" richColors closeButton theme={resolved === "light" ? "light" : "dark"} />;
};

const App = () => {
  return (
    <ThemeProvider>
      <QueryProvider>
        <BrowserRouter>
          <AuthProvider>
            <ThemeSync />
            <SidebarProvider> {/* ✅ Wrap with SidebarProvider */}
              <AppRoutes />
            </SidebarProvider>
            {/* Every toast() in the app shows here; without it they were silently dropped */}
            <ThemedToaster />
          </AuthProvider>
        </BrowserRouter>
      </QueryProvider>
    </ThemeProvider>
  );
};

export default App;
