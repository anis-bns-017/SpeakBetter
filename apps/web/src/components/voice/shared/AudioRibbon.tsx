// apps/web/src/components/voice/shared/AudioRibbon.tsx
/**
 * A canvas of three silky waves along the bottom of the stage. Their height follows how loud the room is
 * (the loudest speaker's level), eased so it never jitters. Costs one 2D canvas and one rAF loop; the loop sleeps
 * while the tab is hidden and holds a calm, still wave for people who asked for reduced motion.
 */

import React, { useEffect, useRef } from "react";

interface AudioRibbonProps {
  /** 0–1 loudness right now */
  level: number;
  className?: string;
}

const LAYERS = [
  { color: "45,212,191", alpha: 0.5, speed: 0.9, freq: 1.2, phase: 0, amp: 1 },
  { color: "244,114,182", alpha: 0.38, speed: -1.25, freq: 1.7, phase: 1.7, amp: 0.8 },
  { color: "251,191,36", alpha: 0.26, speed: 0.6, freq: 2.3, phase: 3.1, amp: 0.55 },
] as const;

export const AudioRibbon: React.FC<AudioRibbonProps> = ({ level, className }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const levelRef = useRef(level);
  useEffect(() => {
    levelRef.current = level;
  }, [level]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    let w = 0;
    let h = 0;
    let raf = 0;
    let smooth = 0;
    let t = 0;
    let last = performance.now();

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      // Rise quickly, fall slowly
      const target = Math.min(1, Math.max(0, levelRef.current));
      smooth += (target - smooth) * (target > smooth ? 0.18 : 0.05);

      ctx.clearRect(0, 0, w, h);
      const base = h * 0.78;
      const amp = 5 + smooth * h * 0.34;

      for (const layer of LAYERS) {
        ctx.beginPath();
        ctx.moveTo(0, h);
        for (let x = 0; x <= w; x += 6) {
          const nx = x / w;
          // Fades to nothing at both edges so the wave looks like it floats
          const envelope = Math.sin(nx * Math.PI) ** 1.4;
          const y =
            base -
            envelope * amp * layer.amp * (0.55 + 0.45 * Math.sin(nx * 9 * layer.freq + t * layer.speed * 2 + layer.phase)) -
            envelope * amp * 0.25 * Math.sin(nx * 4 + t * layer.speed + layer.phase);
          ctx.lineTo(x, y);
        }
        ctx.lineTo(w, h);
        ctx.closePath();
        const g = ctx.createLinearGradient(0, base - amp * 1.4, 0, h);
        g.addColorStop(0, `rgba(${layer.color},${(layer.alpha * (0.35 + smooth * 0.9)).toFixed(3)})`);
        g.addColorStop(1, `rgba(${layer.color},0)`);
        ctx.fillStyle = g;
        ctx.fill();
      }

      if (!reduce && !document.hidden) raf = requestAnimationFrame(draw);
    };

    const onVisibility = () => {
      if (!document.hidden && !reduce) {
        cancelAnimationFrame(raf);
        last = performance.now();
        raf = requestAnimationFrame(draw);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={"pointer-events-none absolute inset-x-0 bottom-0 h-40 w-full " + (className ?? "")}
      style={{ maskImage: "linear-gradient(180deg, transparent, #000 55%)", WebkitMaskImage: "linear-gradient(180deg, transparent, #000 55%)" }}
    />
  );
};

export default AudioRibbon;
