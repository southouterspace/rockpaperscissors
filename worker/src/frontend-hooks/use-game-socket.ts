/**
 * Dual-connection WebSocket hook for Cloudflare Workers + Durable Objects architecture.
 *
 * This is a reference implementation showing the new pattern where:
 * - A "lobby" WebSocket stays connected at /ws/lobby for global state (online users, rooms, invites)
 * - A "game" WebSocket connects to /ws/room/:code only during active gameplay
 *
 * Both sockets feed messages into the same game store and message handler.
 * Outgoing messages are routed to the correct socket based on message type.
 *
 * See the actual implementation at: src/hooks/use-game-socket.ts
 */

// This file exists as documentation of the dual-connection pattern.
// The real implementation lives in src/hooks/use-game-socket.ts.
export {};
