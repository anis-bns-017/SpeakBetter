import { Suspense, useEffect, useRef } from "react";
import type React from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { Sidebar } from "../components/Sidebar";
import { NotificationBell, NotificationsLive } from "../components/notifications/NotificationBell";
import { CelebrationLayer } from "../components/gamification/CelebrationLayer";
import { useAuth } from "../contexts/useAuth";
import { useSidebar } from "../contexts/SidebarContext";
import { SIDEBAR_WIDTH, MOBILE_TAB_BAR_HEIGHT } from "../lib/navLayout";
import { syncPush } from "../lib/push";
import { OfflineBanner } from "../components/OfflineBanner";
import { ErrorBoundary, PageLoading } from "../components/common/ErrorBoundary";
import { lazyPage } from "../lib/lazyPage";
import { needsWelcome } from "./welcomeGate";
import { tr } from "../i18n/core";

// Pages: each is downloaded the first time it is opened (lib/lazyPage.ts), so the app starts fast
const DashboardPage = lazyPage(() => import("../pages/DashboardPage"), "default");
const DiscoveryPage = lazyPage(() => import("../pages/DiscoveryPage"), "DiscoveryPage");
const MyWordsPage = lazyPage(() => import("../pages/MyWordsPage"), "MyWordsPage");
const DictionaryPage = lazyPage(() => import("../pages/DictionaryPage"), "DictionaryPage");
const DictionaryWordPage = lazyPage(() => import("../pages/DictionaryWordPage"), "DictionaryWordPage");
const FlashcardPage = lazyPage(() => import("../pages/FlashcardPage"), "FlashcardPage");
const GrammarPage = lazyPage(() => import("../pages/GrammarPage"), "GrammarPage");
const PacksPage = lazyPage(() => import("../pages/PacksPage"), "PacksPage");
const DictationPage = lazyPage(() => import("../pages/DictationPage"), "DictationPage");
const ShadowingPage = lazyPage(() => import("../pages/ShadowingPage"), "ShadowingPage");
const ShadowingLessonPage = lazyPage(() => import("../pages/ShadowingLessonPage"), "ShadowingLessonPage");
const RoleplayListPage = lazyPage(() => import("../pages/RoleplayListPage"), "RoleplayListPage");
const RoleplayPage = lazyPage(() => import("../pages/RoleplayPage"), "RoleplayPage");
const SessionRecapPage = lazyPage(() => import("../pages/SessionRecapPage"), "SessionRecapPage");
const SessionsPage = lazyPage(() => import("../pages/SessionsPage"), "SessionsPage");
const PackPage = lazyPage(() => import("../pages/PackPage"), "PackPage");
const PublicProfilePage = lazyPage(() => import("../pages/PublicProfilePage"), "PublicProfilePage");
const GrammarCoursePage = lazyPage(() => import("../pages/GrammarCoursePage"), "GrammarCoursePage");
const GrammarLessonPage = lazyPage(() => import("../pages/GrammarLessonPage"), "GrammarLessonPage");
const ExercisesPage = lazyPage(() => import("../pages/ExercisesPage"), "ExercisesPage");
const VoicePage = lazyPage(() => import("../pages/VoicePage"), "VoicePage");
const RandomCallPage = lazyPage(() => import("../pages/RandomCallPage"), "RandomCallPage");
const CommunitiesPage = lazyPage(() => import("../pages/CommunitiesPage"), "CommunitiesPage");
const ProgressPage = lazyPage(() => import("../pages/ProgressPage"), "ProgressPage");
const PlacementPage = lazyPage(() => import("../pages/PlacementPage"), "PlacementPage");
const AiPartnerPage = lazyPage(() => import("../pages/AiPartnerPage"), "AiPartnerPage");
const PronunciationPage = lazyPage(() => import("../pages/PronunciationPage"), "PronunciationPage");
const LeaguesPage = lazyPage(() => import("../pages/LeaguesPage"), "LeaguesPage");
const ChallengePage = lazyPage(() => import("../pages/ChallengePage"), "ChallengePage");
const LibraryPage = lazyPage(() => import("../pages/LibraryPage"), "LibraryPage");
const LibraryReaderPage = lazyPage(() => import("../pages/LibraryReaderPage"), "LibraryReaderPage");
const WritingPage = lazyPage(() => import("../pages/WritingPage"), "WritingPage");
const WritingEditorPage = lazyPage(() => import("../pages/WritingEditorPage"), "WritingEditorPage");
const PremiumPage = lazyPage(() => import("../pages/PremiumPage"), "PremiumPage");
const CheckoutPage = lazyPage(() => import("../pages/CheckoutPage"), "CheckoutPage");
const ProfilePage = lazyPage(() => import("../pages/ProfilePage"), "ProfilePage");
const SettingsPage = lazyPage(() => import("../pages/SettingsPage"), "SettingsPage");
const ChatPage = lazyPage(() => import("../pages/ChatPage"), "ChatPage");

const LoginPage = lazyPage(() => import("../pages/LoginPage"), "LoginPage");
const RegisterPage = lazyPage(() => import("../pages/RegisterPage"), "RegisterPage");
const FriendsPage = lazyPage(() => import("../pages/FriendsPage"), "FriendsPage");
const SuggestionsPage = lazyPage(() => import("../pages/SuggestionsPage"), "SuggestionsPage");
const BlockedPage = lazyPage(() => import("../pages/BlockedPage"), "BlockedPage");
const CommunityPage = lazyPage(() => import("../pages/CommunityPage"), "CommunityPage");
const JoinCommunityPage = lazyPage(() => import("../pages/JoinCommunityPage"), "JoinCommunityPage");
// The admin section (moderators and admins): its own frame and pages, downloaded only by the team
const AdminLayout = lazyPage(() => import("../components/admin/AdminLayout"), "AdminLayout");
const AdminOverviewPage = lazyPage(() => import("../pages/admin/AdminOverviewPage"), "AdminOverviewPage");
const AdminReportsPage = lazyPage(() => import("../pages/admin/AdminReportsPage"), "AdminReportsPage");
const AdminUsersPage = lazyPage(() => import("../pages/admin/AdminUsersPage"), "AdminUsersPage");
const AdminUserPage = lazyPage(() => import("../pages/admin/AdminUserPage"), "AdminUserPage");
const AdminContentPage = lazyPage(() => import("../pages/admin/AdminContentPage"), "AdminContentPage");
const AdminBroadcastPage = lazyPage(() => import("../pages/admin/AdminBroadcastPage"), "AdminBroadcastPage");
const AdminBillingPage = lazyPage(() => import("../pages/admin/AdminBillingPage"), "AdminBillingPage");
const AdminAuditPage = lazyPage(() => import("../pages/admin/AdminAuditPage"), "AdminAuditPage");
const AdminSystemPage = lazyPage(() => import("../pages/admin/AdminSystemPage"), "AdminSystemPage");
const LandingPage = lazyPage(() => import("../pages/LandingPage"), "LandingPage");
const TermsPage = lazyPage(() => import("../pages/LegalPages"), "TermsPage");
const PrivacyPage = lazyPage(() => import("../pages/LegalPages"), "PrivacyPage");
const WelcomePage = lazyPage(() => import("../pages/WelcomePage"), "WelcomePage");
const ForgotPasswordPage = lazyPage(() => import("../pages/ForgotPasswordPage"), "ForgotPasswordPage");
const ResetPasswordPage = lazyPage(() => import("../pages/ResetPasswordPage"), "ResetPasswordPage");
const NewConversationPage = lazyPage(() => import("../pages/NewConversationPage"), "NewConversationPage");
const AuthCallbackPage = lazyPage(() => import("../pages/AuthCallbackPage"), "AuthCallbackPage");

// ============================================================
// HOME: the landing page for visitors, the dashboard for people signed in
// ============================================================
const HomeRoute = () => {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-page" role="status" aria-label={tr("Loading")}>
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-200 border-t-indigo-600 dark:border-white/10 dark:border-t-indigo-400" />
      </div>
    );
  }
  return user ? <Navigate to="/dashboard" replace /> : <LandingPage />;
};

// ============================================================
// PROTECTED ROUTE
// ============================================================
const ProtectedRoute = () => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-page" role="status" aria-label={tr("Loading")}>
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-200 border-t-indigo-600 dark:border-white/10 dark:border-t-indigo-400" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // New accounts start with the first-day guide
  if (needsWelcome(user, location.pathname)) {
    return <Navigate to="/welcome" replace />;
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
      <div className="flex items-center justify-center h-screen bg-page" role="status" aria-label={tr("Loading")}>
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
  // Most visits end up on the dashboard: download it quietly once the app is idle
  useEffect(() => {
    const idle = window.requestIdleCallback ?? ((fn: () => void) => window.setTimeout(fn, 1500));
    idle(() => void DashboardPage.preload());
  }, []);

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
        {tr("Skip to main content")}</a>
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
          {/* A crash or a failed download stays inside the page; the sidebar keeps working, and going elsewhere resets it */}
          <ErrorBoundary variant="page" resetKey={location.pathname}>
            <Suspense fallback={<PageLoading />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
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
    // Sign-in pages load on demand too; inside the app, the layout shows its own loader
    <Suspense fallback={<PageLoading />}>
    <Routes>
      {/* ===== PUBLIC ROUTES ===== */}
      <Route element={<PublicRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      {/* ===== HOME AND LEGAL PAGES: open to everyone ===== */}
      <Route path="/" element={<HomeRoute />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />

      {/* ===== PASSWORD RESET: open to everyone, signed in or not (the email link must always work) ===== */}
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* ===== OAUTH CALLBACK — MUST be outside both PublicRoute and ProtectedRoute ===== */}
      <Route path="/auth/callback" element={<AuthCallbackPage />} />

      {/* ===== PROTECTED ROUTES WITH SIDEBAR ===== */}
      <Route element={<ProtectedRoute />}>
        {/* ===== FIRST-DAY GUIDE (its own full-screen page, no sidebar) ===== */}
        <Route path="/welcome" element={<WelcomePage />} />

        {/* ===== ADMIN SECTION (its own frame; AdminLayout lets only moderators and admins in) ===== */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminOverviewPage />} />
          <Route path="reports" element={<AdminReportsPage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="users/:userId" element={<AdminUserPage />} />
          <Route path="content" element={<AdminContentPage />} />
          <Route path="broadcast" element={<AdminBroadcastPage />} />
          <Route path="billing" element={<AdminBillingPage />} />
          <Route path="audit" element={<AdminAuditPage />} />
          <Route path="system" element={<AdminSystemPage />} />
        </Route>

        <Route element={<AppLayout />}>
          {/* Redirects */}

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
    </Suspense>
  );
};

export default AppRoutes;
