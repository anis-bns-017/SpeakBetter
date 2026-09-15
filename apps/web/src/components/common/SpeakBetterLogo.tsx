import { motion } from "framer-motion";

export function SpeakBetterLogo() {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="group relative flex items-center select-none"
    >
      {/* Ambient glow */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-3 rounded-2xl bg-indigo-500/10 blur-xl"
        animate={{
          opacity: [0.35, 0.7, 0.35],
          scale: [0.95, 1.05, 0.95],
        }}
        transition={{
          duration: 3.5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Logo mark */}
      <motion.div
        className="relative mr-2.5 flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-indigo-600 via-violet-600 to-blue-600 shadow-lg shadow-indigo-500/25"
        whileHover={{
          scale: 1.08,
          rotate: -3,
          boxShadow: "0 10px 30px rgba(79, 70, 229, 0.35)",
        }}
        transition={{ type: "spring", stiffness: 400, damping: 15 }}
      >
        {/* Animated shine */}
        <motion.div
          aria-hidden="true"
          className="absolute inset-y-0 -left-10 w-6 rotate-[20deg] bg-white/30 blur-sm"
          animate={{
            x: [-10, 55],
          }}
          transition={{
            duration: 2.8,
            repeat: Infinity,
            repeatDelay: 2,
            ease: "easeInOut",
          }}
        />

        {/* Speech bubble / S */}
        <motion.span
          className="relative z-10 text-[19px] font-black italic tracking-tighter text-white"
          animate={{
            y: [0, -1, 0],
          }}
          transition={{
            duration: 2.2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          S
        </motion.span>

        {/* Tiny conversation dots */}
        <motion.span
          className="absolute bottom-[7px] right-[6px] h-1 w-1 rounded-full bg-white/90"
          animate={{
            scale: [0.7, 1.3, 0.7],
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 1.4,
            repeat: Infinity,
            delay: 0.1,
          }}
        />

        <motion.span
          className="absolute bottom-[5px] right-[3px] h-0.5 w-0.5 rounded-full bg-white/70"
          animate={{
            scale: [0.7, 1.4, 0.7],
            opacity: [0.4, 1, 0.4],
          }}
          transition={{
            duration: 1.4,
            repeat: Infinity,
            delay: 0.35,
          }}
        />
      </motion.div>

      <div className="relative min-w-0 text-left">
        {/* Brand name */}
        <motion.p
          className="relative text-[17px] font-extrabold leading-none tracking-[-0.04em] text-slate-900"
          whileHover={{ letterSpacing: "-0.02em" }}
          transition={{ duration: 0.2 }}
        >
          Speak
          
          <span className="relative ml-[1px] inline-block">
            {/* Gradient brand text */}
            <motion.span
              className="relative z-10 bg-gradient-to-r from-indigo-600 via-violet-600 to-blue-600 bg-clip-text text-transparent"
              animate={{
                backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
              }}
              style={{
                backgroundSize: "200% 200%",
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "linear",
              }}
            >
              Better
            </motion.span>

            {/* Underline glow */}
            <motion.span
              aria-hidden="true"
              className="absolute -bottom-[3px] left-0 h-[2px] rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-blue-500"
              initial={{ width: 0, opacity: 0 }}
              animate={{
                width: ["0%", "100%", "65%"],
                opacity: [0, 1, 0.7],
              }}
              transition={{
                duration: 1.5,
                delay: 0.5,
                repeat: Infinity,
                repeatDelay: 3,
                ease: "easeInOut",
              }}
            />
          </span>
        </motion.p>

        {/* Tagline */}
        <motion.div
          className="mt-1.5 flex items-center gap-1.5"
          initial={{ opacity: 0, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.5,
            delay: 0.25,
            ease: "easeOut",
          }}
        >
          <motion.span
            className="h-1 w-1 rounded-full bg-indigo-500"
            animate={{
              scale: [1, 1.5, 1],
              opacity: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 1.8,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />

          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">
            Language Learning
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
}