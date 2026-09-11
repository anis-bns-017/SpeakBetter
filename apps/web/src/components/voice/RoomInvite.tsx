// apps/web/src/components/voice/ClapButton.tsx

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useAuth } from "../../contexts/AuthContext";
import { cn } from "../../lib/utils";

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
  const [isHovered, setIsHovered] = useState(false);

  const clapRef = useRef<HTMLButtonElement>(null);
  const particleId = useRef(0);
  const clapTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Size configurations
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

  // Fetch initial clap stats
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

  // Subscribe to real-time clap events via WebSocket
  useEffect(() => {
    if (!window.__clapSocket) {
      // Initialize socket if not exists (you can use your existing socket hook)
      window.__clapSocket = new WebSocket(
        `${process.env.NEXT_PUBLIC_WS_URL}/voice`,
      );
    }

    const socket = window.__clapSocket;

    const handleClapReceived = (data: any) => {
      if (data.targetUserId === targetUserId || !targetUserId) {
        setTotalClaps((prev) => prev + 1);
        if (onClap) {
          onClap(totalClaps + 1);
        }
        if (showParticles) {
          createParticles(config.particles);
        }
        // Haptic feedback for mobile
        if (navigator.vibrate) {
          navigator.vibrate(10);
        }
      }
    };

    const handleClapStats = (data: any) => {
      setTotalClaps(data.totalClaps);
      setUserClaps(data.userClaps);
      setTopClappers(data.topClappers || []);
    };

    socket.addEventListener("message", (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      if (data.type === "clap-received") {
        handleClapReceived(data.payload);
      } else if (data.type === "clap-stats") {
        handleClapStats(data.payload);
      }
    });

    return () => {
      // Don't close the socket here, let it persist
    };
  }, [targetUserId, totalClaps, onClap, showParticles]);

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

    // Check if user has reached max claps
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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          targetUserId,
          userId: user.id,
        }),
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

        // Haptic feedback
        if (navigator.vibrate) {
          navigator.vibrate([10, 50, 10]);
        }

        // Show success toast for milestones
        if (data.totalClaps % 10 === 0) {
          toast.success(`🎉 ${data.totalClaps} claps! Amazing!`);
        }
      }
    } catch (error) {
      console.error("Failed to clap:", error);
      toast.error("Failed to clap. Please try again.");
    }

    // Cooldown timer (prevents spam)
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
  ]);

  // Handle keyboard shortcut (Space or Enter)
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

  // Cleanup timeouts
  useEffect(() => {
    return () => {
      if (clapTimeoutRef.current) {
        clearTimeout(clapTimeoutRef.current);
      }
    };
  }, []);

  // Clap animation variants
  const clapVariants = {
    idle: { scale: 1 },
    clapping: {
      scale: [1, 1.15, 0.95, 1.1, 1],
      transition: { duration: 0.4, ease: "easeInOut" },
    },
  };

  // Get clap streak
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

  return (
    <div className="relative inline-block">
      {/* Tooltip */}
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

      {/* Particles */}
      <AnimatePresence>
        {showParticles &&
          particles.map((particle) => (
            <motion.div
              key={particle.id}
              className="absolute pointer-events-none z-50"
              initial={{
                opacity: 1,
                x: 0,
                y: 0,
                scale: 0.5,
                rotate: 0,
              }}
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

      {/* Fire streak indicator */}
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

      {/* Main Button */}
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

        {/* Progress ring showing remaining claps */}
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

      {/* Clap counter popup */}
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

      {/* Top clappers dropdown */}
      {topClappers.length > 0 && isHovered && (
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

// Export types
export type { ClapButtonProps, ClapStats };
