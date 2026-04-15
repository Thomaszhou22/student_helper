import { useEffect, useRef } from "react";

/**
 * When sync is in error state, retry once when the browser fires `online`
 * (and optionally when the tab becomes visible while online).
 * Keeps retries calm — no tight polling.
 */
export function useOnlineSyncRecovery(options: {
  enabled: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const onRetryRef = useRef(options.onRetry);
  onRetryRef.current = options.onRetry;

  useEffect(() => {
    if (!options.enabled || !options.isError) return;

    const scheduleRetry = () => {
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      onRetryRef.current();
    };

    window.addEventListener("online", scheduleRetry);

    const onVisible = () => {
      if (document.visibilityState === "visible") scheduleRetry();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.removeEventListener("online", scheduleRetry);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [options.enabled, options.isError]);
}
