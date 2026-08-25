"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * Subscribe to an SSE stream and refresh the current route on each tick.
 *
 * Mobile browsers freeze (or silently kill) background connections, so a phone
 * whose screen was off misses every event sent meanwhile — and EventSource's
 * own reconnect only delivers *future* events, never the missed ones. So on
 * every wake-up we reopen the stream and refresh once to catch up.
 *
 * Returns true while a refresh is in flight, for an optional "syncing" hint.
 */
export function useLiveRefresh(src: string) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  useEffect(() => {
    let es = new EventSource(src);
    const listen = () => {
      es.onmessage = (e) => {
        if (e.data === "update") startTransition(() => router.refresh());
      };
    };
    listen();

    const onWake = () => {
      if (document.visibilityState !== "visible") return;
      // ponytail: always reopen — readyState still reads OPEN on a socket the
      // OS froze, so trusting it would leave the phone permanently stale.
      es.close();
      es = new EventSource(src);
      listen();
      startTransition(() => router.refresh());
    };
    document.addEventListener("visibilitychange", onWake);

    return () => {
      document.removeEventListener("visibilitychange", onWake);
      es.close();
    };
  }, [src, router]);

  return isPending;
}
