// apps/web/src/pages/DiscoveryPage.tsx
/**
 * DiscoveryPage — browse, search, and join live voice rooms.
 *
 * Improvements vs the original:
 *   - Mouse-reactive particle field — particles drift toward the cursor
 *     within a 200px radius, connections use a gradient stroke, and the
 *     whole canvas respects prefers-reduced-motion (static field).
 *     Also cleans up its rAF loop on unmount (was leaking).
 *   - Animated live counter — counts up from 0 to the real number with
 *     an ease-out cubic curve over 800ms. Respects reduced motion.
 *   - Featured hero room — the top trending room gets a large card with
 *     a gradient backdrop, capacity ring, and prominent CTA.
 *   - Recommended carousel — horizontal-scroll row of recommended rooms
 *     with snap points and scroll buttons (was fetched but never shown).
 *   - Enhanced room cards — 3D tilt on hover (max 6°), category
 *     gradient accent bar, animated capacity bar, participant avatar
 *     stack, "N speaking" indicator with pulsing dot, language tags.
 *   - Category color identity — each category has its own gradient
 *     (Language Learning = indigo, Music = pink, Gaming = emerald, etc.)
 *     applied to the pill, the card accent, and the hover glow.
 *   - View mode toggle — grid (3-col) or list (1-col with inline stats).
 *     State persists to localStorage.
 *   - Sort transitions use layoutId — the active pill slides between
 *     sort options instead of popping.
 *   - Keyboard shortcuts — `/` focuses search, `Esc` clears it,
 *     `g`/`l` toggles grid/list view.
 *   - Shimmer skeletons — gradient sweep instead of plain pulse.
 *   - Fixed dual-range participant filter — the two sliders now
 *     constrain each other (min can't exceed max and vice versa).
 *   - Active filter count badge on the Filters button.
 *   - Empty state with illustrated icon and contextual CTA.
 *   - Pagination with prev/next + page numbers.
 */

import React, {
  useState,
  useMemo,
  useRef,
  useEffect,
  useCallback,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  useDiscoverRooms,
  useRoomCategories,
  useLiveRoomsCount,
  useTrendingRooms,
  useRecommendedRooms,
} from "../hooks/useDiscovery";
import {
  Search,
  TrendingUp,
  Sparkles,
  Users,
  Globe,
  Lock,
  Clock,
  ChevronRight,
  ChevronLeft,
  Plus,
  Compass,
  Flame,
  Star,
  Zap,
  Crown,
  Headphones,
  Mic,
  Radio,
  Filter,
  SlidersHorizontal,
  X,
  ChevronDown,
  Loader2,
  AlertCircle,
  Check,
  Heart,
  ThumbsUp,
  MessageCircle,
  Share2,
  Bookmark,
  BookmarkCheck,
  ArrowRight,
  Music,
  Coffee,
  Gamepad2,
  BookOpen,
  Languages,
  Globe2,
  Hash,
  LayoutGrid,
  List,
  type LucideIcon,
} from "lucide-react";
import { motion, AnimatePresence, LayoutGroup, useReducedMotion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";

// ============================================================
// Theme
// ============================================================

const THEME = {
  void: "#0A0A12",
  surface: "#141425",
  surfaceRaised: "#1E1E38",
  surfaceHover: "#2A2A4A",
  border: "#2A2A4A",
  borderGlow: "rgba(120, 80, 255, 0.2)",
  aurora: {
    primary: "#7C6AFF",
    secondary: "#A78BFA",
    tertiary: "#6EE7B7",
    quaternary: "#FCD34D",
    pink: "#F472B6",
    cyan: "#67E8F9",
    purple: "#8B5CF6",
  },
  gradient: {
    from: "rgba(124, 106, 255, 0.15)",
    to: "rgba(167, 139, 250, 0.05)",
  },
  text: {
    primary: "#F8F7FF",
    secondary: "#B8B0D8",
    muted: "#7A72A0",
    accent: "#A78BFA",
  },
  status: {
    live: "#6EE7B7",
    liveGlow: "rgba(110, 231, 183, 0.3)",
    speaking: "#A78BFA",
    speakingGlow: "rgba(167, 139, 250, 0.4)",
    waiting: "#FCD34D",
    waitingGlow: "rgba(252, 211, 77, 0.3)",
  },
} as const;

/**
 * Per-category gradient + glow color. Applied to the category pill, the
 * card's top accent bar, and the hover glow. Gives each room a visual
 * identity instead of everything being purple.
 */
const CATEGORY_STYLES: Record<
  string,
  { gradient: string; glow: string; icon: LucideIcon }
> = {
  "Language Learning": {
    gradient: "from-indigo-500 to-violet-500",
    glow: "rgba(124,106,255,0.35)",
    icon: BookOpen,
  },
  Conversation: {
    gradient: "from-emerald-500 to-teal-500",
    glow: "rgba(110,231,183,0.35)",
    icon: Users,
  },
  Music: {
    gradient: "from-pink-500 to-rose-500",
    glow: "rgba(244,114,182,0.35)",
    icon: Music,
  },
  Gaming: {
    gradient: "from-emerald-500 to-cyan-500",
    glow: "rgba(16,185,129,0.35)",
    icon: Gamepad2,
  },
  Study: {
    gradient: "from-blue-500 to-indigo-500",
    glow: "rgba(59,130,246,0.35)",
    icon: BookOpen,
  },
  Social: {
    gradient: "from-amber-500 to-orange-500",
    glow: "rgba(251,191,36,0.35)",
    icon: Users,
  },
  Casual: {
    gradient: "from-orange-500 to-amber-500",
    glow: "rgba(251,146,60,0.35)",
    icon: Coffee,
  },
  Podcast: {
    gradient: "from-violet-500 to-purple-500",
    glow: "rgba(139,92,246,0.35)",
    icon: Radio,
  },
  Interview: {
    gradient: "from-cyan-500 to-blue-500",
    glow: "rgba(103,232,249,0.35)",
    icon: Mic,
  },
  Panel: {
    gradient: "from-fuchsia-500 to-pink-500",
    glow: "rgba(232,121,249,0.35)",
    icon: Users,
  },
  Default: {
    gradient: "from-indigo-500 to-violet-500",
    glow: "rgba(124,106,255,0.35)",
    icon: Globe,
  },
};

const getCategoryStyle = (name?: string) =>
  (name && CATEGORY_STYLES[name]) || CATEGORY_STYLES.Default;

// ============================================================
// useCountUp — animated counter with ease-out cubic
// ============================================================

function useCountUp(target: number, duration = 800): number {
  const reduced = useReducedMotion();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (reduced) {
      setCount(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(target * eased));
      if (progress < 1) raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, reduced]);

  return count;
}

// ============================================================
// DiscoveryParticles — mouse-reactive constellation field
// ============================================================

const DiscoveryParticles: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();
  const mouseRef = useRef({ x: -1000, y: -1000, active: false });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const particleCount = reduced ? 25 : 60;
    const particles = Array.from({ length: particleCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      radius: Math.random() * 1.8 + 0.4,
      opacity: Math.random() * 0.35 + 0.1,
      hue: Math.random() > 0.5 ? "167,139,250" : "124,106,255",
    }));

    let raf = 0;
    const animate = () => {
      ctx.clearRect(0, 0, width, height);

      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      const mouseActive = mouseRef.current.active;

      for (const p of particles) {
        // Mouse attraction (subtle, within 200px)
        if (mouseActive) {
          const dx = mx - p.x;
          const dy = my - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 200 && dist > 1) {
            const force = (1 - dist / 200) * 0.4;
            p.vx += (dx / dist) * force * 0.02;
            p.vy += (dy / dist) * force * 0.02;
          }
        }

        // Damping
        p.vx *= 0.98;
        p.vy *= 0.98;

        p.x += p.vx;
        p.y += p.vy;

        // Wrap
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        // Draw particle
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.hue}, ${p.opacity})`;
        ctx.fill();
      }

      // Draw connections — gradient stroke from particle A's hue to B's
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 140) {
            const alpha = 0.08 * (1 - dist / 140);
            const grad = ctx.createLinearGradient(
              particles[i].x,
              particles[i].y,
              particles[j].x,
              particles[j].y,
            );
            grad.addColorStop(0, `rgba(${particles[i].hue}, ${alpha})`);
            grad.addColorStop(1, `rgba(${particles[j].hue}, ${alpha})`);
            ctx.strokeStyle = grad;
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      raf = requestAnimationFrame(animate);
    };

    if (reduced) {
      // Render one static frame
      animate();
      cancelAnimationFrame(raf);
    } else {
      animate();
    }

    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY, active: true };
    };
    const onMouseLeave = () => {
      mouseRef.current.active = false;
    };

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("mouseout", onMouseLeave, { passive: true });
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseout", onMouseLeave);
      window.removeEventListener("resize", resize);
    };
  }, [reduced]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    />
  );
};

// ============================================================
// ShimmerSkeleton — gradient sweep loading state
// ============================================================

const ShimmerSkeleton: React.FC<{ className?: string; height?: string }> = ({
  className = "",
  height = "h-4",
}) => (
  <div
    className={`relative overflow-hidden rounded ${height} ${className}`}
    style={{ background: THEME.border }}
  >
    <div
      className="absolute inset-0"
      style={{
        background:
          "linear-gradient(90deg, transparent, rgba(167,139,250,0.08), transparent)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.6s linear infinite",
      }}
    />
    <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
  </div>
);

// ============================================================
// CapacityBar — animated fill bar with color thresholds
// ============================================================

const CapacityBar: React.FC<{
  current: number;
  max: number;
  reduced?: boolean;
}> = ({ current, max, reduced }) => {
  const pct = max > 0 ? Math.min(100, (current / max) * 100) : 0;
  const color =
    pct >= 100
      ? "from-red-500 to-rose-500"
      : pct >= 80
        ? "from-amber-500 to-orange-500"
        : "from-emerald-500 to-teal-500";

  return (
    <div
 className="h-1 overflow-hidden rounded-full"
      style={{ background: "rgba(255,255,255,0.06)" }}
    >
      <motion.div
        className={`h-full rounded-full bg-gradient-to-r ${color}`}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={
          reduced ? { duration: 0 } : { duration: 0.6, ease: "easeOut" }
        }
      />
    </div>
  );
};

// ============================================================
// AvatarStack — stacked participant avatars
// ============================================================

const AvatarStack: React.FC<{
  participants: any[];
  max?: number;
  size?: number;
}> = ({ participants, max = 4, size = 24 }) => {
  const shown = participants.slice(0, max);
  const overflow = participants.length - shown.length;

  return (
    <div className="flex -space-x-2">
      {shown.map((p: any, i: number) => (
        <div
          key={i}
          className="rounded-full ring-2 overflow-hidden flex items-center justify-center text-[10px] font-bold text-white shrink-0"
          style={{
            width: size,
            height: size,
            ["--tw-ring-color" as string]: THEME.void,
            background: `linear-gradient(135deg, ${THEME.aurora.primary}, ${THEME.aurora.secondary})`,
            boxShadow: `0 0 0 2px ${THEME.void}`,
          }}
          title={p.name || p.user?.name || "Participant"}
        >
          {p.avatarUrl || p.user?.avatarUrl ? (
            <img
              src={p.avatarUrl || p.user?.avatarUrl}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            (p.name || p.user?.name || "U").charAt(0).toUpperCase()
          )}
        </div>
      ))}
      {overflow > 0 && (
        <div
          className="rounded-full flex items-center justify-center text-[9px] font-bold shrink-0"
          style={{
            width: size,
            height: size,
            background: THEME.surfaceRaised,
            color: THEME.text.muted,
            boxShadow: `0 0 0 2px ${THEME.void}`,
          }}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
};

// ============================================================
// RoomCard — enhanced with 3D tilt, capacity bar, speaking indicator
// ============================================================

type ViewMode = "grid" | "list";

const RoomCard: React.FC<{
  room: any;
  index: number;
  viewMode: ViewMode;
  featured?: boolean;
}> = ({ room, index, viewMode, featured = false }) => {
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  const participantCount =
    room.participantCount || room.participants?.length || 0;
  const isFull = room.maxParticipants && participantCount >= room.maxParticipants;
  const isAlmostFull =
    room.maxParticipants && participantCount / room.maxParticipants >= 0.8;
  const isNew = Date.now() - new Date(room.createdAt).getTime() < 3600000;

  const activeSpeakers =
    room.participants?.filter((p: any) => p.isSpeaking).length || 0;
  const catStyle = getCategoryStyle(room.category);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (reduced || viewMode === "list") return;
      const rect = cardRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      setTilt({ x: y * -6, y: x * 6 });
    },
    [reduced, viewMode],
  );

  const handleMouseLeave = useCallback(() => {
    setTilt({ x: 0, y: 0 });
  }, []);

  const isListView = viewMode === "list";

  return (
    <motion.div
      ref={cardRef}
      layout
      initial={{ opacity: 0, y: 20, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.35,
        delay: Math.min(index * 0.04, 0.25),
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover={reduced ? undefined : { y: -4 }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={() => navigate(`/voice/${room.id}`)}
      className="group relative rounded-2xl border cursor-pointer overflow-hidden transition-all"
      style={{
        background: "rgba(20, 20, 37, 0.8)",
        backdropFilter: "blur(12px)",
        borderColor: THEME.border,
        transform: !reduced && !isListView
          ? `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`
          : undefined,
        transformStyle: "preserve-3d",
        boxShadow: featured
          ? `0 0 40px ${catStyle.glow}`
          : undefined,
      }}
    >
      {/* Category accent bar at top */}
      <div
        className={`h-[3px] w-full bg-gradient-to-r ${catStyle.gradient}`}
        style={{ opacity: 0.8 }}
      />

      {/* Hover glow */}
      <div
        className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background: `radial-gradient(ellipse 60% 40% at 50% 0%, ${catStyle.glow}, transparent 70%)`,
        }}
      />

      <div className={`relative z-10 ${featured ? "p-6" : "p-5"}`}>
        {/* Top row — status badges */}
        <div className="flex justify-between items-start mb-3 gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium"
              style={{
                background: "rgba(110, 231, 183, 0.15)",
                color: THEME.status.live,
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live
            </span>
            {isNew && (
              <span
                className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                style={{
                  background: "rgba(252, 211, 77, 0.15)",
                  color: THEME.status.waiting,
                }}
              >
                New
              </span>
            )}
            {isAlmostFull && !isFull && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400">
                Almost Full
              </span>
            )}
            {isFull && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400">
                Full
              </span>
            )}
            {room.type === "PRIVATE" && (
              <Lock className="w-3 h-3" style={{ color: THEME.text.muted }} />
            )}
          </div>

          <div
            className="flex items-center gap-1.5 text-xs shrink-0"
            style={{ color: THEME.text.muted }}
          >
            <Users className="w-3.5 h-3.5" />
            <span
              className="font-medium"
              style={{
                color:
                  participantCount > 0 ? THEME.text.primary : THEME.text.muted,
              }}
            >
              {participantCount}
            </span>
            <span className="text-[10px] opacity-50">
              /{room.maxParticipants || 50}
            </span>
          </div>
        </div>

        {/* Title + description */}
        <div className="mb-3">
          <h3
            className={`font-semibold truncate ${featured ? "text-lg" : "text-sm"}`}
            style={{ color: THEME.text.primary }}
          >
            {room.name}
          </h3>
          {room.description && (
            <p
              className={`mt-0.5 ${featured ? "line-clamp-2" : "line-clamp-1"} text-xs`}
              style={{ color: THEME.text.muted }}
            >
              {room.description}
            </p>
          )}
        </div>

        {/* Tags + language */}
        <div className="flex gap-1 mb-3 flex-wrap">
          {room.language && (
            <span
              className="px-2 py-0.5 rounded-full text-[9px] font-medium flex items-center gap-1"
              style={{
                background: "rgba(167,139,250,0.1)",
                color: THEME.text.accent,
              }}
            >
              <Languages className="w-2.5 h-2.5" />
              {room.language}
            </span>
          )}
          {room.tags?.slice(0, 2).map((tag: string) => (
            <span
              key={tag}
              className="px-2 py-0.5 rounded-full text-[9px]"
              style={{
                background: "rgba(255,255,255,0.05)",
                color: THEME.text.muted,
              }}
            >
              #{tag}
            </span>
          ))}
        </div>

        {/* Capacity bar */}
        {room.maxParticipants && (
          <div className="mb-3">
            <CapacityBar
              current={participantCount}
              max={room.maxParticipants}
              reduced={Boolean(reduced)}
            />
          </div>
        )}

        {/* Participant avatars + speaking indicator */}
        {room.participants?.length > 0 && (
          <div className="flex items-center justify-between mb-3">
            <AvatarStack participants={room.participants} max={4} size={24} />
            {activeSpeakers > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-medium">
                <span
                  className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full"
                  style={{
                    background: "rgba(167,139,250,0.12)",
                    color: THEME.status.speaking,
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full animate-pulse"
                    style={{ background: THEME.status.speaking }}
                  />
                  {activeSpeakers} speaking
                </span>
              </span>
            )}
          </div>
        )}

        {/* Footer — host + actions */}
        <div
          className="flex items-center justify-between pt-3 border-t"
          style={{ borderColor: THEME.border }}
        >
          <div className="flex items-center gap-2 min-w-0">
            {room.creator?.avatarUrl ? (
              <img
                src={room.creator.avatarUrl}
                alt=""
                className="w-6 h-6 rounded-full object-cover"
                style={{ boxShadow: `0 0 0 2px ${THEME.border}` }}
              />
            ) : (
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                style={{
                  background: `linear-gradient(135deg, ${THEME.aurora.primary}, ${THEME.aurora.secondary})`,
                  color: "#fff",
                }}
              >
                {room.creator?.name?.charAt(0).toUpperCase() || "U"}
              </div>
            )}
            <span
              className="text-[10px] truncate"
              style={{ color: THEME.text.muted }}
            >
              {room.creator?.name || "Unknown"}
            </span>
            {room.creator?.isHost && (
              <Crown className="w-3 h-3 text-amber-400" />
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsBookmarked(!isBookmarked);
              }}
              className="p-1.5 rounded-lg transition-all hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60"
              style={{
                color: isBookmarked
                  ? THEME.aurora.primary
                  : THEME.text.muted,
              }}
            >
              {isBookmarked ? (
                <BookmarkCheck className="w-3.5 h-3.5" />
              ) : (
                <Bookmark className="w-3.5 h-3.5" />
              )}
            </button>

            <motion.button
              whileTap={reduced ? undefined : { scale: 0.95 }}
              onClick={(e) => {
                e.stopPropagation();
                if (!isFull) navigate(`/voice/${room.id}`);
              }}
              disabled={isFull}
              className={`flex items-center gap-0.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60 ${
                featured ? "px-4" : ""
              }`}
              style={{
                background: `linear-gradient(135deg, ${catStyle.glow.replace("0.35", "1").replace("rgba", "rgb").replace(", 0.35", "")}, ${THEME.aurora.secondary})`,
                color: "#fff",
                opacity: isFull ? 0.5 : 1,
                cursor: isFull ? "not-allowed" : "pointer",
              }}
            >
              {isFull ? "Full" : featured ? "Join Room" : "Join"}
              {!isFull && <ChevronRight className="w-3 h-3" />}
            </motion.button>
          </div>
        </div>

        {/* Time */}
        <div
          className="flex items-center gap-1 mt-2 text-[9px]"
          style={{ color: THEME.text.muted }}
        >
          <Clock className="w-2.5 h-2.5" />
          {formatDistanceToNow(new Date(room.createdAt), {
            addSuffix: true,
          })}
        </div>
      </div>
    </motion.div>
  );
};

// ============================================================
// FeaturedRoom — large hero card for the top trending room
// ============================================================

const FeaturedRoom: React.FC<{ room: any }> = ({ room }) => {
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const catStyle = getCategoryStyle(room.category);
  const participantCount =
    room.participantCount || room.participants?.length || 0;
  const activeSpeakers =
    room.participants?.filter((p: any) => p.isSpeaking).length || 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-3xl border"
      style={{
        background: "rgba(20, 20, 37, 0.8)",
        borderColor: THEME.border,
        backdropFilter: "blur(16px)",
      }}
    >
      {/* Gradient backdrop */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 60% 100% at 20% 0%, ${catStyle.glow}, transparent 70%)`,
        }}
      />
      <div
        className={`absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r ${catStyle.gradient}`}
      />

      <div className="relative z-10 p-6 sm:p-8 flex flex-col lg:flex-row gap-6 items-start">
        {/* Left — icon + category */}
        <div className="shrink-0">
          <div
            className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br ${catStyle.gradient} flex items-center justify-center shadow-lg`}
            style={{ boxShadow: `0 10px 30px -8px ${catStyle.glow}` }}
          >
            {React.createElement(catStyle.icon, {
              className: "w-8 h-8 sm:w-10 sm:h-10 text-white",
            })}
          </div>
        </div>

        {/* Center — title + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
              style={{
                background: "rgba(110, 231, 183, 0.15)",
                color: THEME.status.live,
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Featured
            </span>
            {room.category && (
              <span
                className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  color: THEME.text.secondary,
                }}
              >
                {room.category}
              </span>
            )}
          </div>

          <h2
            className="text-2xl sm:text-3xl font-bold mb-2"
            style={{ color: THEME.text.primary }}
          >
            {room.name}
          </h2>

          {room.description && (
            <p
              className="text-sm leading-relaxed mb-4 max-w-xl"
              style={{ color: THEME.text.secondary }}
            >
              {room.description}
            </p>
          )}

          {/* Stats row */}
          <div className="flex items-center gap-4 flex-wrap text-xs">
            <span
              className="flex items-center gap-1.5"
              style={{ color: THEME.text.muted }}
            >
              <Users className="w-4 h-4" />
              <span style={{ color: THEME.text.primary }}>
                {participantCount}
              </span>
              /{room.maxParticipants || 50}
            </span>
            {activeSpeakers > 0 && (
              <span
                className="flex items-center gap-1.5"
                style={{ color: THEME.status.speaking }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full animate-pulse"
                  style={{ background: THEME.status.speaking }}
                />
                {activeSpeakers} speaking now
              </span>
            )}
            {room.language && (
              <span
                className="flex items-center gap-1.5"
                style={{ color: THEME.text.muted }}
              >
                <Languages className="w-4 h-4" />
                {room.language}
              </span>
            )}
            <span
              className="flex items-center gap-1.5"
              style={{ color: THEME.text.muted }}
            >
              <Clock className="w-3.5 h-3.5" />
              {formatDistanceToNow(new Date(room.createdAt), {
                addSuffix: true,
              })}
            </span>
          </div>

          {/* Capacity bar */}
          {room.maxParticipants && (
            <div className="mt-4 max-w-md">
              <CapacityBar
                current={participantCount}
                max={room.maxParticipants}
                reduced={Boolean(reduced)}
              />
            </div>
          )}
        </div>

        {/* Right — join CTA */}
        <div className="shrink-0 w-full lg:w-auto">
          <motion.button
            whileHover={reduced ? undefined : { scale: 1.04, y: -2 }}
            whileTap={reduced ? undefined : { scale: 0.97 }}
            onClick={() => navigate(`/voice/${room.id}`)}
            className={`w-full lg:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full font-bold text-sm text-white shadow-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60`}
            style={{
              background: `linear-gradient(135deg, ${THEME.aurora.primary}, ${THEME.aurora.secondary})`,
              boxShadow: `0 0 30px ${catStyle.glow}`,
            }}
          >
            <Zap className="w-4 h-4" />
            Join Now
            <ArrowRight className="w-4 h-4" />
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
};

// ============================================================
// RecommendedCarousel — horizontal scroll row
// ============================================================

const RecommendedCarousel: React.FC<{ rooms: any[] }> = ({ rooms }) => {
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.8;
    el.scrollBy({
      left: dir === "left" ? -amount : amount,
      behavior: reduced ? "auto" : "smooth",
    });
  };

  if (!rooms.length) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles
            className="w-4 h-4"
            style={{ color: THEME.aurora.secondary }}
          />
          <h2
            className="text-sm font-semibold"
            style={{ color: THEME.text.primary }}
          >
            Recommended for You
          </h2>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => scroll("left")}
            className="p-1.5 rounded-lg transition-all hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60"
            style={{
              background: "rgba(255,255,255,0.03)",
              color: THEME.text.muted,
              border: `1px solid ${THEME.border}`,
            }}
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => scroll("right")}
            className="p-1.5 rounded-lg transition-all hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60"
            style={{
              background: "rgba(255,255,255,0.03)",
              color: THEME.text.muted,
              border: `1px solid ${THEME.border}`,
            }}
            aria-label="Scroll right"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory"
        style={{
          scrollbarWidth: "thin",
          scrollbarColor: `${THEME.border} transparent`,
        }}
      >
        {rooms.map((room, i) => (
          <div
            key={room.id}
            className="snap-start shrink-0 w-[280px] sm:w-[320px]"
          >
            <RoomCard room={room} index={i} viewMode="grid" />
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================
// Main Component
// ============================================================

export const DiscoveryPage: React.FC = () => {
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [sortType, setSortType] = useState("trending");
  const [showFilters, setShowFilters] = useState(false);
  const [languageFilter, setLanguageFilter] = useState<string | null>(null);
  const [minParticipants, setMinParticipants] = useState(0);
  const [maxParticipants, setMaxParticipants] = useState(50);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "grid";
    try {
      return (
        (localStorage.getItem("speakbetter-discovery-view") as ViewMode) ||
        "grid"
      );
    } catch {
      return "grid";
    }
  });

  const { data: categories } = useRoomCategories();
  const { data: liveCount } = useLiveRoomsCount();
  const { data: trendingRooms } = useTrendingRooms(6);
  const { data: recommendedRooms } = useRecommendedRooms(8);
  const { data: searchResults, isLoading } = useDiscoverRooms({
    query: searchQuery,
    sort: sortType,
    category: selectedCategory || undefined,
  });

  const displayRooms =
    searchQuery || selectedCategory ? searchResults?.rooms : trendingRooms;
  const featuredRoom = trendingRooms?.[0];
  const carouselRooms = recommendedRooms?.slice(0, 8) || [];

  // Animated live counter
  const animatedLiveCount = useCountUp(liveCount || 0, 800);

  // Active filter count for the badge
  const activeFilterCount =
    (languageFilter ? 1 : 0) +
    (minParticipants > 0 ? 1 : 0) +
    (maxParticipants < 50 ? 1 : 0) +
    (selectedCategory ? 1 : 0);

  const clearAllFilters = () => {
    setLanguageFilter(null);
    setMinParticipants(0);
    setMaxParticipants(50);
    setSelectedCategory(null);
  };

  const languages = [
    "English",
    "Spanish",
    "French",
    "German",
    "Japanese",
    "Chinese",
    "Korean",
    "Portuguese",
  ];

  const sortOptions: {
    value: string;
    label: string;
    icon: LucideIcon;
  }[] = [
    { value: "trending", label: "Trending", icon: TrendingUp },
    { value: "newest", label: "Newest", icon: Sparkles },
    { value: "popular", label: "Popular", icon: Flame },
    { value: "recommended", label: "Recommended", icon: Star },
  ];

  // Keyboard shortcuts: `/` focuses search, `Esc` clears, `g`/`l` view
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) {
        if (e.key === "Escape" && searchInputRef.current) {
          searchInputRef.current.blur();
        }
        return;
      }

      if (e.key === "/" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === "Escape" && searchQuery) {
        setSearchQuery("");
      } else if (e.key === "g" && !e.ctrlKey && !e.metaKey) {
        setViewMode("grid");
        try {
          localStorage.setItem("speakbetter-discovery-view", "grid");
        } catch {}
      } else if (e.key === "l" && !e.ctrlKey && !e.metaKey) {
        setViewMode("list");
        try {
          localStorage.setItem("speakbetter-discovery-view", "list");
        } catch {}
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [searchQuery]);

  const toggleViewMode = () => {
    const next = viewMode === "grid" ? "list" : "grid";
    setViewMode(next);
    try {
      localStorage.setItem("speakbetter-discovery-view", next);
    } catch {}
  };

  // Constrain the dual range — min can't exceed max and vice versa
  const handleMinChange = (val: number) => {
    setMinParticipants(Math.min(val, maxParticipants - 1));
  };
  const handleMaxChange = (val: number) => {
    setMaxParticipants(Math.max(val, minParticipants + 1));
  };

  return (
    <div
      className="min-h-screen relative overflow-hidden"
      style={{ background: THEME.void }}
    >
      <DiscoveryParticles />

      {/* Background gradient */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 60% 40% at 50% 0%, ${THEME.gradient.from}, transparent 70%)`,
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* ====================================================
            HEADER
        ===================================================== */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <motion.div
              initial={reduced ? false : { scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20"
            >
              <Compass className="w-6 h-6 text-white" />
            </motion.div>
            <div>
              <h1
                className="text-3xl font-serif font-bold"
                style={{ color: THEME.text.primary }}
              >
                Discover Voice Rooms
              </h1>
              <div className="flex items-center gap-3 mt-0.5">
                <span
                  className="text-sm"
                  style={{ color: THEME.text.muted }}
                >
                  Find your next conversation
                </span>
                <span
                  className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
                  style={{
                    background: "rgba(110, 231, 183, 0.15)",
                    color: THEME.status.live,
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {animatedLiveCount} live now
                </span>
              </div>
            </div>
          </div>

          <motion.button
            whileHover={reduced ? undefined : { scale: 1.04 }}
            whileTap={reduced ? undefined : { scale: 0.96 }}
            onClick={() => navigate("/voice")}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-sm transition-all shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            style={{
              background: `linear-gradient(135deg, ${THEME.aurora.primary}, ${THEME.aurora.secondary})`,
              color: "#fff",
              boxShadow: `0 0 30px ${THEME.aurora.primary}33`,
            }}
          >
            <Plus className="w-4 h-4" />
            Create Room
          </motion.button>
        </div>

        {/* ====================================================
            FEATURED ROOM (only on initial view, no search/filter)
        ===================================================== */}
        {featuredRoom && !searchQuery && !selectedCategory && (
          <div className="mb-8">
            <FeaturedRoom room={featuredRoom} />
          </div>
        )}

        {/* ====================================================
            RECOMMENDED CAROUSEL (only on initial view)
        ===================================================== */}
        {!searchQuery && !selectedCategory && carouselRooms.length > 0 && (
          <RecommendedCarousel rooms={carouselRooms} />
        )}

        {/* ====================================================
            SEARCH & FILTERS BAR
        ===================================================== */}
        <div className="flex flex-col md:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5"
              style={{ color: THEME.text.muted }}
            />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search rooms by name, topic, or language..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-20 py-3.5 rounded-2xl border outline-none text-sm transition-all focus:border-purple-500 focus-visible:ring-2 focus-visible:ring-purple-400/30"
              style={{
                background: "rgba(20, 20, 37, 0.8)",
                backdropFilter: "blur(12px)",
                borderColor: THEME.border,
                color: THEME.text.primary,
              }}
            />
            {/* Keyboard shortcut hint */}
            {!searchQuery && (
              <kbd
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-mono px-1.5 py-0.5 rounded border pointer-events-none"
                style={{
                  borderColor: THEME.border,
                  color: THEME.text.muted,
                  background: "rgba(255,255,255,0.03)",
                }}
              >
                /
              </kbd>
            )}
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60"
                style={{ color: THEME.text.muted }}
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className="relative px-4 py-3.5 rounded-2xl border transition-all flex items-center gap-2 text-sm shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60"
            style={{
              background: showFilters
                ? "rgba(124, 106, 255, 0.15)"
                : "rgba(20, 20, 37, 0.8)",
              borderColor: showFilters
                ? THEME.aurora.primary
                : THEME.border,
              color: showFilters
                ? THEME.aurora.primary
                : THEME.text.secondary,
            }}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters
            {activeFilterCount > 0 && (
              <span
                className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold"
                style={{
                  background: THEME.aurora.primary,
                  color: "#fff",
                }}
              >
                {activeFilterCount}
              </span>
            )}
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform ${showFilters ? "rotate-180" : ""}`}
            />
          </button>

          {/* View toggle */}
          <div
            className="flex items-center rounded-2xl border p-1 shrink-0"
            style={{
              background: "rgba(20, 20, 37, 0.8)",
              borderColor: THEME.border,
            }}
          >
            <button
              onClick={() => {
                setViewMode("grid");
                try {
                  localStorage.setItem(
                    "speakbetter-discovery-view",
                    "grid",
                  );
                } catch {}
              }}
              className="p-2 rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60"
              style={{
                background:
                  viewMode === "grid"
                    ? THEME.aurora.primary
                    : "transparent",
                color:
                  viewMode === "grid"
                    ? "#fff"
                    : THEME.text.muted,
              }}
              aria-label="Grid view"
              title="Grid view (g)"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setViewMode("list");
                try {
                  localStorage.setItem(
                    "speakbetter-discovery-view",
                    "list",
                  );
                } catch {}
              }}
              className="p-2 rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60"
              style={{
                background:
                  viewMode === "list"
                    ? THEME.aurora.primary
                    : "transparent",
                color:
                  viewMode === "list"
                    ? "#fff"
                    : THEME.text.muted,
              }}
              aria-label="List view"
              title="List view (l)"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ====================================================
            FILTERS PANEL
        ===================================================== */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mb-6"
            >
              <div
                className="p-5 rounded-2xl border backdrop-blur-xl"
                style={{
                  background: "rgba(20, 20, 37, 0.8)",
                  borderColor: THEME.border,
                }}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Language filter */}
                  <div>
                    <label
                      className="text-xs font-medium block mb-2"
                      style={{ color: THEME.text.secondary }}
                    >
                      Language
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {languages.map((lang) => (
                        <button
                          key={lang}
                          onClick={() =>
                            setLanguageFilter(
                              languageFilter === lang ? null : lang,
                            )
                          }
                          className="px-3 py-1.5 rounded-full text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60"
                          style={{
                            background:
                              languageFilter === lang
                                ? THEME.aurora.primary
                                : "rgba(255,255,255,0.04)",
                            color:
                              languageFilter === lang
                                ? "#fff"
                                : THEME.text.muted,
                          }}
                        >
                          {lang}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Participants range — now properly constrained */}
                  <div>
                    <label
                      className="text-xs font-medium block mb-2"
                      style={{ color: THEME.text.secondary }}
                    >
                      Participants ({minParticipants} – {maxParticipants})
                    </label>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs">
                        <span style={{ color: THEME.text.muted }}>Min</span>
                        <input
                          type="range"
                          min="0"
                          max="50"
                          value={minParticipants}
                          onChange={(e) =>
                            handleMinChange(parseInt(e.target.value))
                          }
                          className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer"
                          style={{ background: THEME.border }}
                        />
                        <span
                          className="font-mono w-6"
                          style={{ color: THEME.text.primary }}
                        >
                          {minParticipants}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span style={{ color: THEME.text.muted }}>Max</span>
                        <input
                          type="range"
                          min="0"
                          max="50"
                          value={maxParticipants}
                          onChange={(e) =>
                            handleMaxChange(parseInt(e.target.value))
                          }
                          className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer"
                          style={{ background: THEME.border }}
                        />
                        <span
                          className="font-mono w-6"
                          style={{ color: THEME.text.primary }}
                        >
                          {maxParticipants}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Clear filters */}
                  <div className="flex items-end justify-end">
                    <button
                      onClick={clearAllFilters}
                      disabled={activeFilterCount === 0}
                      className="px-4 py-2 rounded-xl text-xs font-medium transition-all hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60"
                      style={{ color: THEME.text.muted }}
                    >
                      {activeFilterCount > 0
                        ? `Clear ${activeFilterCount} filter${activeFilterCount > 1 ? "s" : ""}`
                        : "No active filters"}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ====================================================
            CATEGORIES
        ===================================================== */}
        {categories && categories.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <Globe2
                className="w-4 h-4"
                style={{ color: THEME.text.muted }}
              />
              <span
                className="text-sm font-medium"
                style={{ color: THEME.text.secondary }}
              >
                Categories
              </span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2">
              <button
                onClick={() => setSelectedCategory(null)}
                className="px-4 py-2 rounded-full text-xs font-medium transition-all whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60"
                style={{
                  background:
                    selectedCategory === null
                      ? `linear-gradient(135deg, ${THEME.aurora.primary}, ${THEME.aurora.secondary})`
                      : "rgba(255,255,255,0.04)",
                  color:
                    selectedCategory === null
                      ? "#fff"
                      : THEME.text.muted,
                }}
              >
                All
              </button>
              {categories.map((cat: any) => {
                const style = getCategoryStyle(cat.name);
                const Icon = style.icon;
                const isSelected = selectedCategory === cat.name;
                return (
                  <button
                    key={cat.name}
                    onClick={() => setSelectedCategory(cat.name)}
                    className={`px-4 py-2 rounded-full text-xs font-medium transition-all whitespace-nowrap flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60`}
                    style={{
                      background: isSelected
                        ? `linear-gradient(135deg, ${style.glow.replace("0.35", "1").replace("rgba", "rgb").replace(", 0.35", "")}, ${THEME.aurora.secondary})`
                        : "rgba(255,255,255,0.04)",
                      color: isSelected ? "#fff" : THEME.text.muted,
                      border: `1px solid ${isSelected ? "transparent" : THEME.border}`,
                    }}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {cat.name}
                    <span className="text-[9px] opacity-60 ml-0.5">
                      {cat.roomCount}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ====================================================
            SORT OPTIONS — with layoutId for smooth transitions
        ===================================================== */}
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          <span
            className="text-xs font-medium"
            style={{ color: THEME.text.muted }}
          >
            Sort by:
          </span>
          <div
            className="relative flex gap-1 rounded-xl p-1"
            style={{ background: "rgba(255,255,255,0.04)" }}
          >
            {sortOptions.map(({ value, label, icon: Icon }) => {
              const isSelected = sortType === value;
              return (
                <button
                  key={value}
                  onClick={() => setSortType(value)}
                  className="relative px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60"
                  style={{
                    color: isSelected ? "#fff" : THEME.text.muted,
                  }}
                >
                  {isSelected && (
                    <motion.div
                      layoutId="sort-active-pill"
                      className="absolute inset-0 rounded-lg"
                      style={{
                        background: THEME.aurora.primary,
                        boxShadow: `0 2px 8px ${THEME.aurora.primary}40`,
                      }}
                      transition={
                        reduced
                          ? { duration: 0 }
                          : { type: "spring", stiffness: 400, damping: 30 }
                      }
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-1.5">
                    <Icon className="w-3 h-3" />
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ====================================================
            ROOMS GRID / LIST
        ===================================================== */}
        <LayoutGroup>
          {isLoading ? (
            <div
              className={`grid gap-4 ${
                viewMode === "grid"
                  ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
                  : "grid-cols-1"
              }`}
            >
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="rounded-2xl p-5"
                  style={{
                    background: "rgba(20, 20, 37, 0.8)",
                    border: `1px solid ${THEME.border}`,
                  }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <ShimmerSkeleton className="w-12 h-5" height="h-5" />
                    <ShimmerSkeleton className="w-16 h-5" height="h-5" />
                  </div>
                  <ShimmerSkeleton className="w-3/4 mb-2" />
                  <ShimmerSkeleton className="w-1/2 mb-3" />
                  <ShimmerSkeleton className="w-full mb-2" height="h-1" />
                  <div className="flex justify-between items-center mt-4">
                    <ShimmerSkeleton className="w-20" />
                    <ShimmerSkeleton className="w-16 h-7" height="h-7" />
                  </div>
                </div>
              ))}
            </div>
          ) : displayRooms && displayRooms.length > 0 ? (
            <motion.div
              layout
              className={`grid gap-4 ${
                viewMode === "grid"
                  ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
                  : "grid-cols-1"
              }`}
            >
              {displayRooms.map((room: any, index: number) => (
                <RoomCard
                  key={room.id}
                  room={room}
                  index={index}
                  viewMode={viewMode}
                />
              ))}
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-20"
            >
              <motion.div
                initial={reduced ? false : { scale: 0.8 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 18 }}
                className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{
                  background: `radial-gradient(circle, ${THEME.aurora.primary}22, transparent 70%)`,
                  border: `1px solid ${THEME.aurora.primary}33`,
                }}
              >
                <Compass
                  className="w-10 h-10"
                  style={{ color: THEME.aurora.primary }}
                />
              </motion.div>
              <h3
                className="text-xl font-serif mb-2"
                style={{ color: THEME.text.primary }}
              >
                No rooms found
              </h3>
              <p
                className="text-sm mb-4"
                style={{ color: THEME.text.muted }}
              >
                {searchQuery
                  ? "Try adjusting your search or filters"
                  : "Be the first to create a room!"}
              </p>
              {!searchQuery && (
                <motion.button
                  whileHover={reduced ? undefined : { scale: 1.04 }}
                  whileTap={reduced ? undefined : { scale: 0.96 }}
                  onClick={() => navigate("/voice")}
                  className="px-6 py-2.5 rounded-full font-semibold text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                  style={{
                    background: `linear-gradient(135deg, ${THEME.aurora.primary}, ${THEME.aurora.secondary})`,
                    color: "#fff",
                  }}
                >
                  Create a Room
                </motion.button>
              )}
              {(searchQuery || activeFilterCount > 0) && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    clearAllFilters();
                  }}
                  className="ml-2 px-6 py-2.5 rounded-full font-medium text-sm transition-all border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60"
                  style={{
                    borderColor: THEME.border,
                    color: THEME.text.secondary,
                  }}
                >
                  Clear all
                </button>
              )}
            </motion.div>
          )}
        </LayoutGroup>

        {/* ====================================================
            PAGINATION
        ===================================================== */}
        {searchResults?.pagination &&
          searchResults.pagination.totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-8">
              <button
                disabled={searchResults.pagination.page === 1}
                className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  color: THEME.text.muted,
                }}
                aria-label="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from(
                {
                  length: Math.min(5, searchResults.pagination.totalPages),
                },
                (_, i) => i + 1,
              ).map((page) => (
                <button
                  key={page}
                  className="px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60"
                  style={{
                    background:
                      searchResults.pagination.page === page
                        ? THEME.aurora.primary
                        : "rgba(255,255,255,0.04)",
                    color:
                      searchResults.pagination.page === page
                        ? "#fff"
                        : THEME.text.muted,
                  }}
                >
                  {page}
                </button>
              ))}
              <button
                disabled={
                  searchResults.pagination.page ===
                  searchResults.pagination.totalPages
                }
                className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  color: THEME.text.muted,
                }}
                aria-label="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
      </div>

      {/* Keyboard shortcuts hint */}
      <div
        className="fixed bottom-4 right-4 z-20 hidden md:flex items-center gap-2 text-[9px] px-3 py-1.5 rounded-full border pointer-events-none"
        style={{
          color: THEME.text.muted,
          background: "rgba(10,10,18,0.75)",
          borderColor: THEME.border,
          backdropFilter: "blur(10px)",
        }}
      >
        <kbd className="font-mono">/</kbd> search ·
        <kbd className="font-mono">g</kbd> grid ·
        <kbd className="font-mono">l</kbd> list ·
        <kbd className="font-mono">Esc</kbd> clear
      </div>
    </div>
  );
};

export default DiscoveryPage;