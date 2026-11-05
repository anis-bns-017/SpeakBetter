import React, { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

/** A small bar at the top while the device is offline */
export const OfflineBanner: React.FC = () => {
  const [offline, setOffline] = useState(typeof navigator !== "undefined" && navigator.onLine === false);

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  if (!offline) return null;
  return (
    <div role="status" className="fixed top-0 inset-x-0 z-[60] flex items-center justify-center gap-2 bg-slate-900 px-4 py-2 text-xs font-medium text-white">
      <WifiOff className="h-3.5 w-3.5 shrink-0" />
      <span>You're offline. Saved lessons, stories and word packs still work; other things will come back when you reconnect.</span>
    </div>
  );
};

export default OfflineBanner;
