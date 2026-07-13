import { EventEmitter } from "events";

// Prevent multiple event emitters in development due to hot reloading
const globalForEmitter = global as unknown as { eventEmitter: EventEmitter };

export const eventEmitter = globalForEmitter.eventEmitter || new EventEmitter();
// Many concurrent SSE clients subscribe to "feed-update"; lift the 10-listener cap.
eventEmitter.setMaxListeners(0);

if (process.env.NODE_ENV !== "production") {
  globalForEmitter.eventEmitter = eventEmitter;
}

/** Emit a SSE refresh event for a given post, plus a global feed tick. */
export function notifyPostUpdate(postId: string) {
  eventEmitter.emit(`post-update:${postId}`);
  // ponytail: single global channel — every list/summary page refreshes on any
  // change. Fine at this scale; if it gets chatty, switch to per-user channels.
  eventEmitter.emit("feed-update");
}

/** Tick the global feed only (for create/delete/restore where no post stream exists). */
export function notifyFeed() {
  eventEmitter.emit("feed-update");
}
