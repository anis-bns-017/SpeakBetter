import { useEffect, useRef } from "react";
import type React from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { Sidebar } from "../components/Sidebar";
import { NotificationBell, NotificationsLive } from "../components/notifications/NotificationBell";
import { CelebrationLayer } from "../components/gamification/CelebrationLayer";
import { useAuth } from "../contexts/AuthContext";
import { useSidebar } from "../contexts/SidebarContext";
import { SIDEBAR_WIDTH, MOBILE_TAB_BAR_HEIGHT } from "../lib/navLayout";
import { syncPush } from "../lib/push";
import { OfflineBanner } from "../components/OfflineBanner";

// Main Pages
import DashboardPage from "../pages/DashboardPage";
import { DiscoveryPage } from "../pages/DiscoveryPage";
import { MyWordsPage } from "../pages/MyWordsPage";
import { DictionaryPage } from "../pages/DictionaryPage";
import { DictionaryWordPage } from "../pages/DictionaryWordPage";
import { FlashcardPage } from "../pages/FlashcardPage";
import { GrammarPage } from "../pages/GrammarPage";
import { PacksPage } from "../pages/PacksPage";
import { DictationPage } from "../pages/DictationPage";
import { ShadowingPage } from "../pages/ShadowingPage";
import { ShadowingLessonPage } from "../pages/ShadowingLessonPage";
import { RoleplayListPage } from "../pages/RoleplayListPage";
import { RoleplayPage } from "../pages/RoleplayPage";
import { SessionRecapPage } from "../pages/SessionRecapPage";
import { SessionsPage } from "../pages/SessionsPage";
import { PackPage } from "../pages/PackPage";
import { PublicProfilePage } from "../pages/PublicProfilePage";
import { GrammarCoursePage } from "../pages/GrammarCoursePage";
import { GrammarLessonPage } from "../pages/GrammarLessonPage";
import { ExercisesPage } from "../pages/ExercisesPage";
import { VoicePage } from "../pages/VoicePage";
import { RandomCallPage } from "../pages/RandomCallPage";
import { CommunitiesPage } from "../pages/CommunitiesPage";
import { ProgressPage } from "../pages/ProgressPage";
import { PlacementPage } from "../pages/PlacementPage";
import { AiPartnerPage } from "../pages/AiPartnerPage";
import { PronunciationPage } from "../pages/PronunciationPage";
import { LeaguesPage } from "../pages/LeaguesPage";
import { ChallengePage } from "../pages/ChallengePage";
import { LibraryPage } from "../pages/LibraryPage";
import { LibraryReaderPage } from "../pages/LibraryReaderPage";
import { WritingPage } from "../pages/WritingPage";
import { WritingEditorPage } from "../pages/WritingEditorPage";
import { PremiumPage } from "../pages/PremiumPage";
import { CheckoutPage } from "../pages/CheckoutPage";
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
import { AuthCallbackPage } from "../pages/AuthCallbackPage";

// ============================================================
// PROTECTED ROUTE
// ============================================================
const ProtectedRoute = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-page" role="status" aria-label="Loading">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-200 border-t-indigo-600 dark:border-white/10 dark:border-t-indigo-400" />
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
      <div className="flex items-center justify-center h-screen bg-page" role="status" aria-label="Loading">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-200 border-t-indigo-600 dark:border-white/10 dark:border-t-indigo-400" />
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
  // Collapse state lives in SidebarContext, so content is padded by the real sidebar width
  const { isMinimized } = useSidebar();
  const location = useLocation();
  const inVoiceRoom = /^\/voice\/[^/]+/.test(location.pathname);

  // If this device already gets push, keep its record on the server fresh and pointed at whoever is signed in
  useEffect(() => {
    void syncPush().catch(() => undefined);
  }, []);

  // After a page change, send screen-reader and keyboard focus to the page, unless something already took it.
  // Not on the first load: there the first Tab stop must stay the "Skip to main content" link.
  const lastPath = useRef(location.pathname);
  useEffect(() => {
    if (lastPath.current === location.pathname) return;
    lastPath.current = location.pathname;
    const active = document.activeElement;
    if (active && active !== document.body && active.tagName !== "A") return;
    document.getElementById("main")?.focus({ preventScroll: true });
  }, [location.pathname]);

  const style = {
    "--sidebar-w": `${isMinimized ? SIDEBAR_WIDTH.collapsed : SIDEBAR_WIDTH.expanded}px`,
    "--tabbar-h": inVoiceRoom ? "0px" : `${MOBILE_TAB_BAR_HEIGHT}px`,
  } as React.CSSProperties;

  return (
    <div className="min-h-screen bg-page" style={style}>
      {/* First stop for keyboard users: jump past the sidebar to the page */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[300] focus:rounded-xl focus:bg-indigo-600 focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-white/80"
      >
        Skip to main content
      </a>
      <OfflineBanner />
      <Sidebar />
      {/* Live notifications on every page; on phones the bell floats in the corner (the sidebar has its own) */}
      <NotificationsLive />
      {/* New badges and last week's league result, shown once each (never over a live room) */}
      <CelebrationLayer paused={inVoiceRoom} />
      {!inVoiceRoom && (
        <div className="lg:hidden fixed top-3 right-3 z-40">
          <NotificationBell variant="floating" />
        </div>
      )}
      <div className="min-h-screen transition-[padding] duration-300 lg:pl-[var(--sidebar-w)] pb-[var(--tabbar-h)] lg:pb-0">
        <main id="main" tabIndex={-1} className="min-h-screen focus:outline-none">
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

      {/* ===== OAUTH CALLBACK — MUST be outside both PublicRoute and ProtectedRoute ===== */}
      <Route path="/auth/callback" element={<AuthCallbackPage />} />

      {/* ===== PROTECTED ROUTES WITH SIDEBAR ===== */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          {/* Redirects */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* Main Pages */}
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/discover" element={<DiscoveryPage />} />
          <Route path="/words" element={<MyWordsPage />} />
          <Route path="/dictionary" element={<DictionaryPage />} />
          <Route path="/dictionary/:wordId" element={<DictionaryWordPage />} />
          {/* The old Vocabulary page became My words */}
          <Route path="/vocabulary" element={<Navigate to="/words" replace />} />
          <Route path="/flashcards" element={<FlashcardPage />} />
          <Route path="/grammar" element={<GrammarCoursePage />} />
          <Route path="/grammar/rules" element={<GrammarPage />} />
          <Route path="/grammar/:lessonId" element={<GrammarLessonPage />} />
          <Route path="/exercises" element={<ExercisesPage />} />
          <Route path="/packs" element={<PacksPage />} />
          <Route path="/dictation" element={<DictationPage />} />
          <Route path="/shadowing" element={<ShadowingPage />} />
          <Route path="/shadowing/:lessonId" element={<ShadowingLessonPage />} />
          <Route path="/roleplay" element={<RoleplayListPage />} />
          <Route path="/roleplay/:scenarioId" element={<RoleplayPage />} />
          <Route path="/packs/:packId" element={<PackPage />} />
          <Route path="/progress" element={<ProgressPage />} />
          <Route path="/placement" element={<PlacementPage />} />
          <Route path="/ai-partner" element={<AiPartnerPage />} />
          <Route path="/pronunciation" element={<PronunciationPage />} />
          <Route path="/leagues" element={<LeaguesPage />} />
          <Route path="/challenge" element={<ChallengePage />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/library/:textId" element={<LibraryReaderPage />} />
          <Route path="/writing" element={<WritingPage />} />
          <Route path="/writing/:pieceId" element={<WritingEditorPage />} />
          <Route path="/premium" element={<PremiumPage />} />
          <Route path="/billing/checkout/:paymentId" element={<CheckoutPage />} />

          {/* Profile & Settings */}
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/u/:userId" element={<PublicProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />

          {/* ===== ✅ CHAT ROUTES ===== */}
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/chat/new" element={<NewConversationPage />} />

          {/* ===== ✅ VOICE ROUTES ===== */}
          <Route path="/voice" element={<VoicePage />} />
          <Route path="/voice/:roomId" element={<VoicePage />} />
          <Route path="/call" element={<RandomCallPage />} />
          <Route path="/recap/:roomId" element={<SessionRecapPage />} />
          <Route path="/sessions" element={<SessionsPage />} />

          {/* ===== ✅ COMMUNITY ROUTES (all added) ===== */}
          <Route path="/communities" element={<CommunitiesPage />} />
          <Route path="/communities/:communityId" element={<CommunityPage />} />
          <Route
            path="/communities/join/:code"
            element={<JoinCommunityPage />}
          />

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
