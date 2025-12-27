/**
 * In-memory storage for solo session bot PIDs
 * Used to track and cleanup bot processes when sessions end
 */

// Key: sessionId, Value: botPid
export const sessionBotPids = new Map<string, number>();
