import { useEffect } from "react";

/**
 * Keeps the screen awake while `active` is true (e.g. during a live workout
 * session, so the phone doesn't lock between sets). Re-acquires the lock when
 * the tab becomes visible again. No-op where the Screen Wake Lock API is absent.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    if (typeof navigator === "undefined") return;
    const wl = (navigator as unknown as { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock;
    if (!wl) return;

    let sentinel: { release: () => Promise<void> } | null = null;
    let cancelled = false;

    const request = async () => {
      try {
        sentinel = await wl.request("screen");
      } catch {
        /* user denied / not allowed — ignore */
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible" && !cancelled && !sentinel) void request();
    };

    void request();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      try {
        void sentinel?.release();
      } catch {
        /* ignore */
      }
      sentinel = null;
    };
  }, [active]);
}
