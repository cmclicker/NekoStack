# @nekostack/realtime

> WebSocket / Server-Sent Events / sync layer for multiplayer games, live leaderboards, real-time dashboards, and collaborative UI. The transport NekoStack picks up when HTTP request-response stops being the right shape.

## Quick reference

| | |
|---|---|
| **Build tier** | Project unblocker — Leytide multiplayer can't proceed without it |
| **Depends on** | `schema` (typed messages), `auth` (per-message authorization), `telemetry` (connection events); optional Redis/NATS for multi-process backplane; optional Yjs for CRDT collab |
| **Used by** | Leytide (multiplayer + presence + chat), NekoVibe (live leaderboards + completion notifications), NekoBattler (spectator/replay mode), NekoSystems (live tenant + workflow dashboards) |
| **Status** | Empty placeholder — not started |
| **Est. to v1.0** | 16–32 weeks focused (real-time correctness is genuinely hard) |
| **Sellable?** | Plausible OSS + commercial (Pusher / Ably / Liveblocks territory at self-hostable price point) |

## Why this exists

HTTP request-response works until it doesn't. The moment your product needs:

- Multiplayer game state (Leytide combat, Battlegrounds-style auto-battler matches).
- Live leaderboards that update as players complete daily puzzles (NekoVibe).
- Real-time admin dashboards (NekoSystems tenant operations, ops health).
- Collaborative editing of shared documents (worldbuilding tools, narrative drafts).
- Presence indicators ("who else is online in this room").
- Push-driven notifications that don't require client polling.

…then you need a persistent transport layer. The naive answer is "use Socket.io and pray." That works for a hello-world but breaks down quickly because:
1. Reconnection logic, message replay after disconnect, and exactly-once delivery are surprisingly hard.
2. Authorization on every message (not just at connect time) requires careful design.
3. Scaling to multiple server processes requires a pub/sub backplane that handles fan-out.
4. Conflict resolution for collaborative editing is its own multi-decade research field (CRDTs, OT).
5. There's no schema discipline by default — every project invents its own message shapes.

`@nekostack/realtime` is the transport + sync primitives. Typed channels, schema-validated messages, automatic reconnect with message replay, presence, broadcast/multicast/unicast, optional CRDT-based collaborative state. Auth integrates with `@nekostack/auth` so every message is authorized in the same model as HTTP endpoints.

Building this yourself rather than using Socket.io, Pusher, Ably, or Liveblocks is justified because:
1. **Learning real-time correctness.** Reconnect logic, replay semantics, backpressure, presence — all subtle CS that pays off forever.
2. **No per-message pricing.** Pusher and Ably charge per message and per connection. For a long-running game server with thousands of players, that becomes thousands of dollars a month. Self-hosted is one EC2 instance.
3. **Schema-typed messages.** Schemas come from `@nekostack/schema`. Same discipline as APIs.
4. **Auth integration.** `@nekostack/auth` decides every message's authorization, not just connection-time.

## Scope

### In scope
- WebSocket server with auth handshake.
- SSE fallback transport.
- Typed channel abstraction: `channel<TMessage>` with schema validation.
- Presence: who's connected, who's in which room.
- Broadcast / multicast (per room) / unicast (per connection).
- Reconnect with sequence-numbered message replay.
- Backpressure handling.
- Backend pub/sub adapter for multi-process: Redis, NATS, in-memory for dev.
- Optional CRDT primitives for collaborative state (Yjs integration).
- Client SDK: typed, reconnect-aware, hooks-friendly.

### Out of scope
- WebRTC peer-to-peer. Different use case, different primitives.
- Voice / video. Use a specialized service (LiveKit, Daily).
- MMORPG-scale spatial state replication. Leytide can use this for chat/UI, but bespoke game-engine networking for spatial state is its own package eventually (`@nekostack/netcode` perhaps; not in v1).
- Real-time CDN edge functions. Different domain.

## Boundary

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) §31 for the full capability map.

### Owns
- WebSocket server with auth handshake
- SSE fallback transport
- Typed channel abstraction with schema validation
- Presence (who's connected, who's in which room)
- Broadcast / multicast (per room) / unicast (per connection)
- Reconnect with sequence-numbered message replay
- Backpressure handling
- Pub/sub backplane adapters (in-memory / Redis / NATS)
- CRDT primitives for collaborative state (Yjs adapter — opt-in)
- Typed client SDK with React hooks (`useChannel`, `usePresence`)

### Does NOT own
| Capability | Lives in |
|---|---|
| HTTP API endpoints | `api` |
| Webhook reception / dispatch | `webhooks` |
| WebRTC peer-to-peer | external (different use case) |
| Voice / video | external (LiveKit, Daily, etc.) |
| MMORPG-scale spatial state replication / netcode | future game-side package; not generic enough for v1 |
| Real-time CDN edge functions | external (Cloudflare / Fastly) |
| Per-message authorization decisions | `auth` (we call into it; auth decides) |
| Yjs / CRDT primitives themselves | external (Yjs — we provide the transport adapter) |

## Competitors and adjacent tools

| Tool | What they do well | Where they fall short for us |
|---|---|---|
| **Socket.io** | Mature, widely deployed, fallback transports. | Untyped messages, ad-hoc auth model, weak schema discipline. |
| **ws** (raw WebSocket) | The substrate. | Just the protocol; no channels, no auth, no replay. |
| **Pusher** | Hosted, easy DX. | Per-message pricing, vendor lock. |
| **Ably** | Hosted, more features than Pusher. | Per-message pricing, vendor lock. |
| **PartyKit / Cloudflare Durable Objects** | Edge-native real-time. | Vendor-coupled. Interesting but not portable. |
| **Liveblocks** | Excellent collaborative-state primitives. | Hosted/paid, focused on collab specifically. |
| **Yjs** | Best-in-class CRDT library. | Just the CRDT; transport is your problem. We'd use Yjs *inside* our package. |
| **Phoenix Channels** (Elixir) | Reference design for typed channels. | Elixir-only. Great inspiration. |
| **Convex / Supabase Realtime** | Hosted realtime DBs. | Different abstraction; DB-row-watch rather than channels. |

The right framing: a **typed channels + auth + replay** layer over raw WebSocket, with optional Yjs for collaborative state. We use battle-tested substrates (`ws`, Yjs, Redis for pub/sub) and own the orchestration.

## How this fits the NekoStack

**Depends on:**
- `@nekostack/schema` — message shapes.
- `@nekostack/auth` — per-message authorization.
- `@nekostack/telemetry` — connection events, message metrics.
- (Optional) Redis or NATS for multi-process pub/sub.
- (Optional) Yjs for collaborative state.

**Used by:**
- **NekoVibe** — live leaderboard updates, "X just completed today's puzzle" notifications.
- **Leytide** — multiplayer chat, party state, world events, instance presence.
- **NekoBattler** — live spectator mode for shareable replays.
- **NekoSystems** — live tenant + workflow dashboards, live operations telemetry.
- Future Business-OS / retail-ops — live KPI dashboards, multi-user inventory operations.

## Design philosophy

- **Typed channels.** A channel `<TMessage>` only sends and receives messages matching its schema.
- **Auth on every message.** Connection auth establishes identity; per-message auth establishes authority for the specific operation.
- **Reconnect is a first-class concept.** Clients have a session id, messages have sequence numbers, servers can replay missed messages on reconnect.
- **Backpressure is explicit.** Slow consumers get explicit feedback; the server doesn't OOM trying to buffer for them.
- **Pub/sub adapter, not lock-in.** Same code runs against in-memory pub/sub for dev, Redis for production. NATS adapter for higher-throughput workloads.
- **CRDTs are optional, not central.** Most use cases don't need conflict resolution; we don't force the complexity on consumers who don't need it.

## Architecture sketch

```
packages/realtime/
├── src/
│   ├── server/
│   │   ├── server.ts         # WebSocket + SSE server
│   │   ├── channel.ts        # typed channel
│   │   ├── presence.ts
│   │   ├── replay.ts         # sequence-numbered replay buffer
│   │   └── auth.ts           # per-message authorization hook
│   ├── client/
│   │   ├── client.ts         # typed client with reconnect
│   │   ├── hooks.ts          # React hooks: useChannel, usePresence
│   │   └── transport/
│   │       ├── ws.ts
│   │       └── sse.ts        # fallback for restrictive networks
│   ├── adapters/             # pub/sub backplane
│   │   ├── memory.ts
│   │   ├── redis.ts
│   │   └── nats.ts
│   ├── collab/               # optional CRDT layer
│   │   └── yjs.ts
│   └── testing/
│       └── fixtures.ts       # in-memory transport for tests
├── tests/
└── README.md
```

Defining a channel and using it:

```ts
import { defineChannel, s } from '@nekostack/realtime';

export const ChatChannel = defineChannel('chat:room', {
  message: s.object({ from: s.string(), text: s.string().max(500) }),
});

// Server
realtime.on(ChatChannel, async (ctx, { from, text }) => {
  await authz.decide(ctx.auth, { action: 'chat.send', resource: { roomId: ctx.roomId } });
  ctx.broadcast({ from, text });
});

// Client
const channel = client.join(ChatChannel, { roomId: 'lobby' });
channel.send({ from: actor.id, text: 'hi' });
channel.on('message', (msg) => addToLog(msg));
```

## Roadmap

### v0.1 — WebSocket server + typed channels
- Connection auth handshake.
- Typed channel abstraction.
- In-memory single-process operation.

### v0.2 — Client SDK
- Reconnect with backoff.
- React hooks: `useChannel`, `usePresence`.

### v0.3 — Replay
- Sequence-numbered replay buffer.
- Missed-message redelivery on reconnect.

### v0.4 — Presence + rooms
- Room membership.
- Presence tracking with join/leave events.

### v0.5 — Pub/sub backplane
- Redis adapter for multi-process scale-out.
- NATS adapter for higher throughput.

### v0.6 — SSE fallback
- SSE transport for restrictive networks.
- Automatic fallback detection.

### v0.7 — CRDT integration
- Yjs adapter for collaborative state primitives.

### v1.0 — Stable API
- Documentation site.
- Performance benchmarks (connections per server, messages per second).

## Product potential

**Internal use:** Critical for Leytide (multiplayer) and very valuable for NekoVibe (live leaderboards), NekoSystems (live dashboards).

**Open source release:** Plausible. The typed-channel-over-WS niche is undersupplied compared to the popularity of Socket.io. MIT release could attract users. Yjs integration would differentiate.

**Commercial product:** Real opportunity. Pusher, Ably, Liveblocks, and Soketi (open-source Pusher alternative) all exist. A self-hostable typed-channels-with-collab-primitives product has a niche. Mid-priority commercial direction.

**Estimated effort to v1.0:** 16-32 weeks of focused work. Real-time correctness (reconnect, replay, backpressure) is genuinely hard and time-consuming.

## Status

- **Current:** Empty placeholder. Not started.
- **Owner:** Cody (solo dev project).
- **Priority tier:** Project unblocker. Leytide's multiplayer ambitions cannot proceed without this.
- **Estimated learning return:** Very high. WebSocket protocol semantics, reconnect/replay design, pub/sub patterns, CRDT theory — all transferable.
