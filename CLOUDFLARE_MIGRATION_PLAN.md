# Cloudflare Migration Plan — Rock Paper Scissors

## Current Architecture

| Layer | Current Tech | Hosting |
|-------|-------------|---------|
| Frontend | React 19 + Vite + TanStack Router | Fly.io (static from server) |
| Backend | Hono on Bun runtime | Fly.io (single VM, ord region) |
| WebSocket | Bun native WebSocket | Same Fly.io VM |
| Database | SQLite via Drizzle ORM | Local file on Fly.io volume |
| Auth | WebAuthn/Passkeys | Server-side verification |
| State | In-memory Maps (rooms, clients, sessions) | Single process |

### Key Limitations
- **Single VM**: All game state lives in one process — no horizontal scaling
- **In-memory state**: Rooms, clients, and sessions are lost on deploy/restart
- **Single region**: All players connect to Chicago regardless of location
- **Cold starts**: Auto-scaling to 0 means first visitor waits for boot

---

## Target Architecture (Cloudflare)

| Layer | Cloudflare Tech | Purpose |
|-------|----------------|---------|
| Frontend | **Cloudflare Pages** | Global CDN, instant deploys |
| API | **Cloudflare Workers** (Hono) | Stateless REST endpoints |
| WebSocket + Game State | **Durable Objects** | Per-room stateful WebSocket coordination |
| Database | **D1** (SQLite-compatible) | Users, matches, leaderboard |
| Auth | **Workers** + D1 | Passkey verification at the edge |
| Session/Presence | **Durable Objects** | Online user tracking, invitations |

### Why This Stack
- **Durable Objects** are purpose-built for the core problem: coordinating real-time WebSocket state between two players in a room. Each room becomes its own Durable Object with colocated state and WebSocket connections.
- **D1** is SQLite-compatible, so the existing Drizzle schema migrates with minimal changes.
- **Hono already supports Cloudflare Workers** as a first-class target — the existing API routes port directly.
- **Cloudflare Pages** replaces both Vite static hosting and the Fly.io deployment pipeline.

---

## Migration Phases

### Phase 1: Frontend → Cloudflare Pages

**Effort: Low | Risk: Low**

The frontend is already a standard Vite/React SPA. No code changes needed — only deployment configuration.

**Steps:**
1. Create a Cloudflare Pages project connected to the GitHub repo
2. Set build command: `bun install && bun run build`
3. Set output directory: `dist`
4. Configure environment variable `VITE_BACKEND_URL` to point to the Workers API (Phase 2)
5. Remove Fly.io static file serving from the backend

**Result:** Frontend served from Cloudflare's global CDN with automatic preview deploys per PR.

---

### Phase 2: REST API → Cloudflare Workers (Hono)

**Effort: Medium | Risk: Low**

Hono natively supports Cloudflare Workers. The existing REST routes (`/api/auth`, `/api/users`, `/api/leaderboard`, `/api/rooms`, `/api/health`) can be ported with minimal changes.

**Steps:**
1. Create a `wrangler.toml` configuration at project root
2. Create a new Worker entry point that imports existing Hono routes
3. Replace `better-sqlite3` / Bun SQLite with **D1 bindings** via Drizzle's `drizzle-orm/d1` driver
4. Migrate the database schema to D1 using Drizzle Kit's D1 support
5. Port rate limiting to use Cloudflare's native rate limiting or a KV-based approach
6. Update CORS to allow the Pages domain
7. Move WebAuthn `rpID` / `origin` config to Worker environment variables

**Key Changes:**
```
// Before (Bun)
import { drizzle } from 'drizzle-orm/bun-sqlite'
import Database from 'bun:sqlite'
const db = drizzle(new Database('/data/rps.db'))

// After (D1)
import { drizzle } from 'drizzle-orm/d1'
export default {
  fetch(request, env) {
    const db = drizzle(env.DB)
    // ... existing Hono app
  }
}
```

**Result:** Stateless API running at the edge in 300+ locations. Database queries hit D1.

---

### Phase 3: WebSocket + Game Rooms → Durable Objects

**Effort: High | Risk: Medium**

This is the core of the migration. The current architecture uses in-memory `Map<string, Room>` and `Map<WebSocket, Client>` structures in a single process. Durable Objects replicate this pattern but with built-in persistence, colocation, and WebSocket hibernation.

#### Architecture

```
                    ┌─────────────────┐
  Player A ──WS──▶  │                 │  ◀──WS── Player B
                    │  Durable Object │
                    │  (GameRoom)     │
                    │                 │
                    │  - room state   │
                    │  - player moves │
                    │  - shot clock   │
                    │  - round logic  │
                    └─────────────────┘
                           │
                     D1 (persist match result)
```

Each game room is a single Durable Object instance. Both players' WebSocket connections are handled by the same object, guaranteeing consistency without distributed coordination.

#### Durable Object: `GameRoom`

**Responsibilities:**
- Accept and manage WebSocket connections for both players
- Handle all game messages: `makeMove`, `readyToPlay`, `forfeitGame`, `shotClockExpired`
- Maintain room state (round, scores, moves, shot clock timer)
- Broadcast results to both players
- Persist completed match to D1
- Self-destruct when room is empty

**Steps:**
1. Create `GameRoom` Durable Object class with WebSocket hibernation API
2. Port `server/src/ws/handlers/` logic into the Durable Object's `webSocketMessage` handler
3. Move shot clock from `setTimeout` to Durable Object **alarms** (survives hibernation)
4. Worker routes `/ws/room/:code` to the appropriate Durable Object by room code
5. Room creation generates a Durable Object ID from the room code
6. Implement reconnection using Durable Object's persistent storage (replaces in-memory session map)

**Key Changes:**
```typescript
// GameRoom Durable Object
export class GameRoom implements DurableObject {
  private state: DurableObjectState
  private players: Map<WebSocket, PlayerInfo> = new Map()
  private room: RoomState

  constructor(state: DurableObjectState, env: Env) {
    this.state = state
    // Restore state from storage on wake
    this.state.blockConcurrencyWhile(async () => {
      this.room = await this.state.storage.get('room') || createEmptyRoom()
    })
  }

  async fetch(request: Request) {
    const pair = new WebSocketPair()
    this.state.acceptWebSocket(pair[1])
    return new Response(null, { status: 101, webSocket: pair[0] })
  }

  async webSocketMessage(ws: WebSocket, msg: string) {
    const data = JSON.parse(msg)
    // Port existing handler logic here
  }

  async alarm() {
    // Shot clock expiry — replaces setTimeout
  }
}
```

#### Durable Object: `Lobby`

**Responsibilities:**
- Track online users (presence)
- Broadcast public room list
- Handle player invitations
- Route players to GameRoom Durable Objects

**Steps:**
1. Create a singleton `Lobby` Durable Object (single instance via well-known ID)
2. All clients connect to Lobby on app load for presence and room discovery
3. When a game starts, Lobby directs clients to open a second WebSocket to the `GameRoom` DO
4. Lobby periodically cleans up stale connections

**Connection Flow:**
```
1. Client connects WS → Lobby DO (presence, room list, invitations)
2. Client creates/joins room → Lobby creates GameRoom DO, returns room code
3. Client connects WS → GameRoom DO (gameplay)
4. Game ends → GameRoom persists to D1, notifies Lobby, self-cleans
```

---

### Phase 4: Reconnection & Session Management

**Effort: Medium | Risk: Medium**

Currently, reconnection relies on in-memory session maps with a 2-minute grace period. With Durable Objects, this becomes more robust.

**Steps:**
1. Store session → Durable Object ID mapping in D1 or KV
2. On reconnect, client sends `sessionId` to Worker
3. Worker looks up the active GameRoom DO and forwards the connection
4. GameRoom DO re-associates the WebSocket with the existing player slot
5. Use Durable Object storage (persistent) instead of in-memory maps for grace period state
6. Increase reconnection grace period (DO storage survives hibernation, so no urgency)

**Improvement:** Reconnection now survives server restarts and code deploys — a major upgrade over the current in-memory approach.

---

### Phase 5: Cleanup & Deployment Pipeline

**Effort: Low | Risk: Low**

1. Replace `fly.toml` + Dockerfile with `wrangler.toml`
2. Update GitHub Actions to deploy via `wrangler deploy` instead of `flyctl`
3. Set up D1 database and run migrations via `wrangler d1 migrations apply`
4. Configure custom domain for Workers API
5. Remove Bun-specific code (`bun:sqlite`, Bun native WebSocket APIs)
6. Remove Fly.io configuration and Dockerfile
7. Update `README.md` with new local dev instructions (`wrangler dev`)

---

## File-Level Migration Map

| Current File | Migration Target | Notes |
|---|---|---|
| `server/src/index.ts` | Worker entry point (`src/worker.ts`) | Hono app + DO bindings |
| `server/src/routes/*` | Same (Hono routes, minimal changes) | Swap DB driver to D1 |
| `server/src/ws/handler.ts` | `GameRoom` Durable Object | Core game logic moves here |
| `server/src/ws/handlers/*` | Methods on `GameRoom` class | Per-message handlers |
| `server/src/ws/state.ts` | Split: `GameRoom` DO + `Lobby` DO | In-memory maps → DO storage |
| `server/src/db/schema/*` | Same (Drizzle schema) | Compatible with D1 |
| `server/drizzle/*` | D1 migrations via `wrangler d1` | Re-generate for D1 |
| `shared/*` | Unchanged | Shared types work everywhere |
| `src/*` (frontend) | Unchanged | Only WebSocket URL changes |
| `src/hooks/use-game-socket.ts` | Minor: dual WS (Lobby + GameRoom) | Connect to two endpoints |
| `Dockerfile` | **Delete** | Replaced by `wrangler.toml` |
| `fly.toml` | **Delete** | Replaced by Cloudflare Pages + Workers |
| `.github/workflows/fly-deploy.yml` | Update to `wrangler deploy` | New CI/CD pipeline |

---

## Local Development

```bash
# Install wrangler
bun add -D wrangler

# Run locally (Workers + Durable Objects + D1)
wrangler dev

# Frontend dev server (unchanged)
bun run dev
# Configure Vite proxy to point to wrangler dev server
```

Wrangler's local mode supports Durable Objects and D1 via Miniflare, so the full stack runs locally without a Cloudflare account.

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| D1 is still in open beta | Data reliability | D1 is production-ready for this scale; export backups periodically |
| Durable Object cold starts | First move latency | WebSocket hibernation API keeps DOs warm while connections exist |
| Lobby DO as singleton bottleneck | Scalability | Fine for hundreds of concurrent users; shard by region if needed later |
| WebAuthn `rpID` changes with new domain | Auth breaks | Migrate passkeys or re-register users on new domain |
| Dual WebSocket connections (Lobby + Game) | Client complexity | Manageable; clean abstraction in `use-game-socket.ts` |

---

## Cost Estimate

Cloudflare's free tier covers:
- **Workers**: 100K requests/day
- **Durable Objects**: 1M requests/month, 1GB storage (paid plan starts at $5/mo for more)
- **D1**: 5M reads/day, 100K writes/day, 5GB storage
- **Pages**: Unlimited sites, 500 builds/month

For a hobby/small-scale multiplayer game, this runs within the free tier or at minimal cost (~$5/mo Workers Paid plan for Durable Objects beyond free limits).

---

## Summary

The migration replaces a single Fly.io VM running Bun with three Cloudflare primitives:

| Concern | Before | After |
|---------|--------|-------|
| Static assets | Served from Bun | Cloudflare Pages (global CDN) |
| REST API | Hono on Bun | Hono on Workers (edge) |
| WebSocket game state | In-memory Maps | Durable Objects (persistent, per-room) |
| Database | SQLite file | D1 (distributed SQLite) |
| Deploys | Docker → Fly.io | `wrangler deploy` |
| Scaling | Single VM, single region | Global edge, auto-scaling |
| Reconnection | 2-min in-memory grace | Persistent DO storage (survives deploys) |
