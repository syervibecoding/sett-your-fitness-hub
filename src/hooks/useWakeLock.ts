import { useEffect } from "react";

// Keeps the screen awake while `active` is true (e.g. during a workout session).
// Uses the Screen Wake Lock API and re-acquires when the tab becomes visible again.
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;

    let sentinel: WakeLockSentinel | null = null;
    let released = false;

    const request = async () => {
      try {
        sentinel = await (navigator as any).wakeLock.request("screen");
        sentinel?.addEventListener?.("release", () => {
          sentinel = null;
        });
      } catch {
        /* user denied or not supported — silently ignore */
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible" && !released && !sentinel) {
        void request();
      }
    };

    void request();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      released = true;
      document.removeEventListener("visibilitychange", onVisibility);
      try {
        sentinel?.release();
      } catch {
        /* ignore */
      }
      sentinel = null;
    };
  }, [active]);
}
