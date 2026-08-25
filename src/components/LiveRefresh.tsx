"use client";

import { useLiveRefresh } from "@/lib/useLiveRefresh";

/** Subscribes to an SSE stream and refreshes the current route on each tick. */
export default function LiveRefresh({ src = "/api/feed/stream" }: { src?: string }) {
  useLiveRefresh(src);
  return null;
}
