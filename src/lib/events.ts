import { EventEmitter } from "events";

// Prevent multiple event emitters in development due to hot reloading
const globalForEmitter = global as unknown as { eventEmitter: EventEmitter };

export const eventEmitter = globalForEmitter.eventEmitter || new EventEmitter();

if (process.env.NODE_ENV !== "production") {
  globalForEmitter.eventEmitter = eventEmitter;
}

/** Emit a SSE refresh event for a given post */
export function notifyPostUpdate(postId: string) {
  eventEmitter.emit(`post-update:${postId}`);
}
