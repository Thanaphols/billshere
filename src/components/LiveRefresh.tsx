"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Subscribes to an SSE stream and refreshes the current route on each tick. */
export default function LiveRefresh({ src = "/api/feed/stream" }: { src?: string }) {
  const router = useRouter();
  useEffect(() => {
    const es = new EventSource(src);
    es.onmessage = (e) => {
      if (e.data === "update") router.refresh();
    };
    return () => es.close();
  }, [src, router]);
  return null;
}
