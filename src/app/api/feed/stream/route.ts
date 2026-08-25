import { NextRequest } from "next/server";
import { eventEmitter } from "@/lib/events";

/** Global SSE feed: fires on any bill change, for list/summary pages to refresh. */
export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // Flush immediately: without a first byte the browser never fires
      // "open" and phones/proxies may drop a silent connection before the
      // 15s keepalive ever lands.
      controller.enqueue(encoder.encode(": connected\n\n"));

      const keepAlive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          // stream closed
        }
      }, 15000);

      const onUpdate = () => {
        try {
          controller.enqueue(encoder.encode("data: update\n\n"));
        } catch {
          // stream closed
        }
      };

      eventEmitter.on("feed-update", onUpdate);

      request.signal.addEventListener("abort", () => {
        clearInterval(keepAlive);
        eventEmitter.off("feed-update", onUpdate);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

export const dynamic = "force-dynamic";
