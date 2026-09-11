// apps/web/src/components/voice/ClapButton.tsx

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useAuth } from "../../contexts/AuthContext";

// Simple theme defined here to avoid import issues
const THEME = {
  colors: {
    primary: "#6366F1",
    secondary: "#8B5CF6",
    success: "#34D399",
    warning: "#FBBF24",
    danger: "#EF4444",
    purple: "#A78BFA",
  },
  text: {
    primary: "#F1F5F9",
    secondary: "#94A3B8",
    muted: "#64748B",
  },
  status: {
    online: "#34D399",
    speaking: "#818CF8",
    muted: "#EF4444",
    raised: "#FBBF24",
  },
};

interface ClapButtonProps {
  roomId: string;
  targetUserId?: string;
  targetName?: string;
  onClap?: (count: number) => void;
  className?: string;
  size?: "sm" | "md" | "lg";
  showCount?: boolean;
  showParticles?: boolean;
  maxClapsPerSession?: number;
}

interface ClapStats {
  totalClaps: number;
  userClaps: number;
  topClappers: Array<{ userId: string; name: string; count: number }>;
}

function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

export const ClapButton: React.FC<ClapButtonProps> = ({
  roomId,
  targetUserId,
  targetName,
  onClap,
  className = "",
  size = "md",
  showCount = true,
  showParticles = true,
  maxClapsPerSession = 10,
}) => {
  const { user } = useAuth();
  const [clapCount, setClapCount] = useState(0);
  const [totalClaps, setTotalClaps] = useState(0);
  const [userClaps, setUserClaps] = useState(0);
  const [topClappers, setTopClappers] = useState<
    Array<{ userId: string; name: string; count: number }>
  >([]);
  const [isClapping, setIsClapping] = useState(false);
  const [clapCooldown, setClapCooldown] = useState(false);
  const [particles, setParticles] = useState<
    { id: number; x: number; y: number; emoji: string }[]
  >([]);
  const [showTooltip, setShowTooltip] = useState(false);
  const [clapHistory, setClapHistory] = useState<number[]>([]);

  const clapRef = useRef<HTMLButtonElement>(null);
  const particleId = useRef(0);

  const sizeConfig = {
    sm: {
      button: "px-3 py-2 text-sm gap-1.5",
      icon: "text-lg",
      count: "text-xs",
      particles: 8,
    },
    md: {
      button: "px-4 py-3 text-base gap-2",
      icon: "text-2xl",
      count: "text-sm",
      particles: 12,
    },
    lg: {
      button: "px-6 py-4 text-lg gap-3",
      icon: "text-3xl",
      count: "text-base",
      particles: 16,
    },
  };

  const config = sizeConfig[size];

  useEffect(() => {
    const fetchClapStats = async () => {
      try {
        const response = await fetch(
          `/api/voice/claps/${roomId}/stats${targetUserId ? `?userId=${targetUserId}` : ""}`,
        );
        if (response.ok) {
          const data: ClapStats = await response.json();
          setTotalClaps(data.totalClaps);
          setUserClaps(data.userClaps || 0);
          setTopClappers(data.topClappers || []);
        }
      } catch (error) {
        console.error("Failed to fetch clap stats:", error);
      }
    };

    fetchClapStats();
  }, [roomId, targetUserId]);

  const createParticles = useCallback((count: number) => {
    const emojis = ["👏", "🎉", "⭐", "💫", "✨", "🌟", "🎊", "💥"];
    const newParticles = [];
    for (let i = 0; i < count; i++) {
      newParticles.push({
        id: particleId.current++,
        x: (Math.random() - 0.5) * 250,
        y: (Math.random() - 0.5) * 250 - 50,
        emoji: emojis[Math.floor(Math.random() * emojis.length)],
      });
    }
    setParticles((prev) => [...prev, ...newParticles]);
    setTimeout(() => {
      setParticles((prev) =>
        prev.filter((p) => !newParticles.some((np) => np.id === p.id)),
      );
    }, 1200);
  }, []);

  const handleClap = useCallback(async () => {
    if (clapCooldown || !user) return;

    if (userClaps >= maxClapsPerSession) {
      toast.warning(`You've reached the maximum ${maxClapsPerSession} claps!`);
      return;
    }

    setIsClapping(true);
    setClapCooldown(true);
    setClapHistory((prev) => [...prev, Date.now()]);

    try {
      const response = await fetch(`/api/voice/claps/${roomId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId, userId: user.id }),
      });

      if (response.ok) {
        const data = await response.json();
        setTotalClaps(data.totalClaps);
        setUserClaps((prev) => prev + 1);
        setClapCount((prev) => prev + 1);

        if (showParticles) {
          createParticles(config.particles);
        }

        if (onClap) {
          onClap(data.totalClaps);
        }

        if (navigator.vibrate) {
          navigator.vibrate([10, 50, 10]);
        }

        if (data.totalClaps % 10 === 0) {
          toast.success(`🎉 ${data.totalClaps} claps! Amazing!`);
        }
      }
    } catch (error) {
      console.error("Failed to clap:", error);
      toast.error("Failed to clap. Please try again.");
    }

    setTimeout(() => {
      setIsClapping(false);
      setClapCooldown(false);
    }, 300);
  }, [
    clapCooldown,
    user,
    targetUserId,
    roomId,
    onClap,
    showParticles,
    userClaps,
    maxClapsPerSession,
    createParticles,
    config.particles,
  ]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.key === " " || e.key === "Enter") &&
        document.activeElement === clapRef.current
      ) {
        e.preventDefault();
        handleClap();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleClap]);

  const getClapStreak = useCallback(() => {
    if (clapHistory.length < 2) return 0;
    const now = Date.now();
    let streak = 1;
    for (let i = clapHistory.length - 1; i > 0; i--) {
      if (now - clapHistory[i] < 2000) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }, [clapHistory]);

  const streak = getClapStreak();
  const isOnFire = streak >= 5;

  const clapVariants = {
    idle: { scale: 1 },
    clapping: {
      scale: [1, 1.15, 0.95, 1.1, 1],
      transition: { duration: 0.4, ease: "easeInOut" },
    },
  };

  return (
    <div className="relative inline-block">
      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute -top-12 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap"
            style={{
              background: "rgba(20, 20, 37, 0.95)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#F8F7FF",
            }}
          >
            {targetName ? `Clap for ${targetName}` : "Clap for this"}
            {userClaps > 0 && ` (${userClaps}/${maxClapsPerSession})`}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showParticles &&
          particles.map((particle) => (
            <motion.div
              key={particle.id}
              className="absolute pointer-events-none z-50"
              initial={{ opacity: 1, x: 0, y: 0, scale: 0.5, rotate: 0 }}
              animate={{
                opacity: 0,
                x: particle.x,
                y: particle.y - 80,
                scale: 1.5,
                rotate: Math.random() * 360,
              }}
              transition={{
                duration: 0.8 + Math.random() * 0.4,
                ease: "easeOut",
              }}
            >
              <span className="text-2xl">{particle.emoji}</span>
            </motion.div>
          ))}
      </AnimatePresence>

      {isOnFire && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          className="absolute -top-8 -right-8 text-3xl animate-pulse"
        >
          🔥
        </motion.div>
      )}

      <motion.button
        ref={clapRef}
        className={cn(
          "relative flex items-center rounded-full font-bold transition-all",
          "bg-gradient-to-r from-yellow-400 via-orange-400 to-orange-500",
          "text-white shadow-lg hover:shadow-xl",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          "hover:scale-105 active:scale-95",
          config.button,
          className,
        )}
        variants={clapVariants}
        animate={isClapping ? "clapping" : "idle"}
        onClick={handleClap}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        disabled={clapCooldown || userClaps >= maxClapsPerSession}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <span className={config.icon}>👏</span>
        <span>Clap</span>
        {showCount && (
          <span className="bg-white/20 px-2.5 py-0.5 rounded-full font-mono">
            {totalClaps}
          </span>
        )}

        {userClaps > 0 && (
          <div
            className="absolute -top-1 -right-1 w-5 h-5 rounded-full border-2 flex items-center justify-center text-[8px] font-bold"
            style={{
              borderColor:
                userClaps >= maxClapsPerSession ? "#EF4444" : "#FBBF24",
              background: "rgba(20,20,37,0.9)",
              color: userClaps >= maxClapsPerSession ? "#EF4444" : "#FBBF24",
            }}
          >
            {maxClapsPerSession - userClaps}
          </div>
        )}
      </motion.button>

      <AnimatePresence>
        {clapCount > 0 && (
          <motion.div
            className="absolute -top-10 left-1/2 -translate-x-1/2 text-yellow-400 font-bold text-lg pointer-events-none"
            initial={{ opacity: 0, scale: 0.5, y: 10 }}
            animate={{
              opacity: 1,
              scale: 1,
              y: -20,
              transition: { type: "spring", stiffness: 300, damping: 20 },
            }}
            exit={{ opacity: 0, scale: 1.5, y: -40 }}
          >
            +{clapCount}
            {isOnFire && <span className="text-red-400 ml-1">🔥</span>}
          </motion.div>
        )}
      </AnimatePresence>

      {topClappers.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute -bottom-24 left-1/2 -translate-x-1/2 w-48 px-3 py-2 rounded-lg text-xs z-10"
          style={{
            background: "rgba(20, 20, 37, 0.95)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#F8F7FF",
          }}
        >
          <p className="font-semibold text-center mb-1">Top Clappers</p>
          {topClappers.slice(0, 5).map((clapper, index) => (
            <div
              key={clapper.userId}
              className="flex justify-between items-center py-0.5"
            >
              <span>
                {index === 0 && "🥇 "}
                {index === 1 && "🥈 "}
                {index === 2 && "🥉 "}
                {clapper.name}
              </span>
              <span className="text-yellow-400">{clapper.count} 👏</span>
            </div>
          ))}
        </motion.div>
      )}
    </div>
  );
};

export default ClapButton;
