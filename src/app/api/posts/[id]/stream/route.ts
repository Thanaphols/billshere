import { NextRequest } from "next/server";
import { eventEmitter } from "@/lib/events";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const encoder = new TextEncoder();
  const customReadable = new ReadableStream({
    start(controller) {
      // Flush immediately: without a first byte the browser never fires
      // "open" and phones/proxies may drop a silent connection before the
      // 15s keepalive ever lands.
      controller.enqueue(encoder.encode(": connected\n\n"));

      // Keep alive interval to prevent browser/proxy connection timeout
      const keepAliveInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          // Stream might be closed
        }
      }, 15000);

      const onUpdate = () => {
        try {
          controller.enqueue(encoder.encode("data: update\n\n"));
        } catch {
          // Stream might be closed
        }
      };

      eventEmitter.on(`post-update:${id}`, onUpdate);

      request.signal.addEventListener("abort", () => {
        clearInterval(keepAliveInterval);
        eventEmitter.off(`post-update:${id}`, onUpdate);
        controller.close();
      });
    },
  });

  return new Response(customReadable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
    },
  });
}
export const dynamic = "force-dynamic";
