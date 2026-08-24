import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { Sidebar } from "../components/Sidebar";
import { useAuth } from "../contexts/AuthContext";

// Main Pages
import DashboardPage from "../pages/DashboardPage";
import { DiscoveryPage } from "../pages/DiscoveryPage";
import { VocabularyPage } from "../pages/VocabularyPage";
import { FlashcardPage } from "../pages/FlashcardPage";
import { GrammarPage } from "../pages/GrammarPage";
import { ExercisesPage } from "../pages/ExercisesPage";
import { VoicePage } from "../pages/VoicePage";
import { CommunitiesPage } from "../pages/CommunitiesPage";
import { ProgressPage } from "../pages/ProgressPage";
import { ProfilePage } from "../pages/ProfilePage";
import { SettingsPage } from "../pages/SettingsPage";
import { ChatPage } from "../pages/ChatPage";

// ============================================================
// ✅ MISSING COMPONENTS (added)
// ============================================================
import { LoginPage } from "../pages/LoginPage";
import { RegisterPage } from "../pages/RegisterPage";
import { FriendsPage } from "../pages/FriendsPage";
import { SuggestionsPage } from "../pages/SuggestionsPage";
import { BlockedPage } from "../pages/BlockedPage";
import { CommunityPage } from "../pages/CommunityPage";
import { JoinCommunityPage } from "../pages/JoinCommunityPage";
import { NewConversationPage } from "../pages/NewConversationPage";
import { useState } from "react";

// ============================================================
// PROTECTED ROUTE
// ============================================================
const ProtectedRoute = () => {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return <Outlet />;
};

// ============================================================
// PUBLIC ROUTE (redirects to dashboard if already logged in)
// ============================================================
const PublicRoute = () => {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
      </div>
    );
  }
  
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <Outlet />;
};

// ============================================================
// APP LAYOUT (with Sidebar)
// ============================================================

const AppLayout = () => {
  const [isMinimized, setIsMinimized] = useState(false); // ✅ Local state

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Sidebar isMinimized={isMinimized} onToggle={() => setIsMinimized(!isMinimized)} />
      <div 
        className={`min-h-screen transition-all duration-300 ${
          isMinimized ? "lg:pl-[72px]" : "lg:pl-[260px]"
        }`}
      >
        <main className="min-h-screen">
          <Outlet />
        </main>
      </div>
    </div>
  );
};


// ============================================================
// MAIN ROUTES
// ============================================================
const AppRoutes = () => {
  return (
    <Routes>
      {/* ===== PUBLIC ROUTES ===== */}
      <Route element={<PublicRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      {/* ===== PROTECTED ROUTES WITH SIDEBAR ===== */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          {/* Redirects */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* Main Pages */}
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/discover" element={<DiscoveryPage />} />
          <Route path="/vocabulary" element={<VocabularyPage />} />
          <Route path="/flashcards" element={<FlashcardPage />} />
          <Route path="/grammar" element={<GrammarPage />} />
          <Route path="/exercises" element={<ExercisesPage />} />
          <Route path="/progress" element={<ProgressPage />} />
          
          {/* Profile & Settings */}
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />

          {/* ===== ✅ CHAT ROUTES ===== */}
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/chat/new" element={<NewConversationPage />} />

          {/* ===== ✅ VOICE ROUTES ===== */}
          <Route path="/voice" element={<VoicePage />} />
          <Route path="/voice/:roomId" element={<VoicePage />} />

          {/* ===== ✅ COMMUNITY ROUTES (all added) ===== */}
          <Route path="/communities" element={<CommunitiesPage />} />
          <Route path="/communities/:communityId" element={<CommunityPage />} />
          <Route path="/communities/join/:code" element={<JoinCommunityPage />} />

          {/* ===== ✅ SOCIAL ROUTES (all added) ===== */}
          <Route path="/friends" element={<FriendsPage />} />
          <Route path="/suggestions" element={<SuggestionsPage />} />
          <Route path="/blocked" element={<BlockedPage />} />
        </Route>
      </Route>

      {/* ===== CATCH ALL ===== */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

export default AppRoutes;