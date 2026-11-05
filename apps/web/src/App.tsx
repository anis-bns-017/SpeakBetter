import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "./contexts/AuthContext";
import { QueryProvider } from "./providers/QueryProvider";
import { SidebarProvider } from "./contexts/SidebarContext"; // ✅ Import this
import AppRoutes from "./routes";

const App = () => {
  return (
    <QueryProvider>
      <BrowserRouter>
        <AuthProvider>
          <SidebarProvider> {/* ✅ Wrap with SidebarProvider */}
            <AppRoutes />
          </SidebarProvider>
          {/* Every toast() in the app shows here; without it they were silently dropped */}
          <Toaster position="top-center" richColors closeButton theme="system" />
        </AuthProvider>
      </BrowserRouter>
    </QueryProvider>
  );
};

export default App;