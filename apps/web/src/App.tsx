import { BrowserRouter } from "react-router-dom";
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
        </AuthProvider>
      </BrowserRouter>
    </QueryProvider>
  );
};

export default App;