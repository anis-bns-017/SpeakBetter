// apps/web/src/components/chat/AutoTranslation.tsx
/** The translation under a received message (Settings > Auto-translate). Asks only once the message is on screen. */
import React, { useEffect, useRef, useState } from "react";
import { cachedTranslation, translateForChat } from "../../lib/autoTranslate";

export const AutoTranslation: React.FC<{ text: string }> = ({ text }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [translated, setTranslated] = useState<string | null>(() => cachedTranslation(text));

  useEffect(() => {
    const el = ref.current;
    if (translated || !el || typeof IntersectionObserver === "undefined") return;
    let live = true;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        observer.disconnect();
        void translateForChat(text).then((out) => {
          if (live) setTranslated(out);
        });
      },
      { rootMargin: "120px" },
    );
    observer.observe(el);
    return () => {
      live = false;
      observer.disconnect();
    };
  }, [text, translated]);

  return (
    <div ref={ref}>
      {translated && (
        <p className="border-t border-slate-100 pt-1.5 text-[11px] italic text-slate-600 dark:border-slate-800 dark:text-slate-400">{translated}</p>
      )}
    </div>
  );
};

export default AutoTranslation;
