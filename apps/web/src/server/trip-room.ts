import { DurableObject } from "cloudflare:workers";
import {
  clientMessageSchema,
  decodePresenceTag,
  encodePresenceTag,
  type ChangeResource,
  type Presence,
  type ServerMessage,
} from "@planned/shared";
import type { CloudflareEnv } from "../lib/env";

/**
 * One Durable Object per trip — the real-time presence + change bus.
 *
 * Clients open a Hibernation WebSocket here (via /api/trips/:id/sync). The REST
 * API calls /notify after a successful mutation so every connected client gets a
 * `change` event and refreshes. No persistent state: presence is in-memory and
 * recomputed from connection tags on reconnect after hibernation.
 *
 * Sync model (Phase 1): presence + change-broadcast, last-write-wins. The DB is
 * the source of truth; the DO never writes data. See @planned/shared/collab.ts.
 */
export class TripRoom extends DurableObject<CloudflareEnv> {
  /** POST /notify → broadcast a change; GET with x-trip-user → WS upgrade. */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/notify") {
      let body: { resource?: ChangeResource; by?: string | null };
      try {
        body = (await request.json()) as { resource?: ChangeResource; by?: string | null };
      } catch {
        body = {};
      }
      this.broadcast({
        type: "change",
        resource: body.resource ?? "trip",
        by: body.by ?? null,
      });
      return new Response("ok", { status: 200 });
    }

    // WebSocket upgrade. The Worker upgrade route validated the session + trip
    // access and serializes the resolved presence into x-trip-user.
    const presence = parsePresenceHeader(request.headers.get("x-trip-user"));
    if (!presence) return new Response("bad user", { status: 400 });

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    // Tag the connection with its presence so it survives hibernation.
    this.ctx.acceptWebSocket(server, [encodePresenceTag(presence)]);
    server.send(JSON.stringify({ type: "hello", you: presence } satisfies ServerMessage));
    this.broadcastPresence();
    return new Response(null, { status: 101, webSocket: client });
  }

  // ── Hibernation handlers ──────────────────────────────────────────────────
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    let raw: unknown;
    try {
      raw = JSON.parse(typeof message === "string" ? message : new TextDecoder().decode(message));
    } catch {
      return;
    }
    const parsed = clientMessageSchema.safeParse(raw);
    if (!parsed.success) return;
    if (parsed.data.type === "ping") {
      ws.send(JSON.stringify({ type: "pong" } satisfies ServerMessage));
    }
  }

  async webSocketClose(): Promise<void> {
    this.broadcastPresence();
  }

  async webSocketError(): Promise<void> {
    this.broadcastPresence();
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  /** Distinct collaborators currently connected (one entry per user, not tab). */
  private currentPresence(): Presence[] {
    const seen = new Map<string, Presence>();
    for (const ws of this.ctx.getWebSockets()) {
      const p = decodePresenceTag(this.ctx.getTags(ws)[0]);
      if (p && !seen.has(p.userId)) seen.set(p.userId, p);
    }
    return [...seen.values()];
  }

  private broadcastPresence(): void {
    this.broadcast({ type: "presence", users: this.currentPresence() });
  }

  private broadcast(msg: ServerMessage): void {
    const data = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(data);
      } catch {
        /* socket may already be closing */
      }
    }
  }
}

function parsePresenceHeader(header: string | null): Presence | null {
  if (!header) return null;
  try {
    const obj = JSON.parse(header) as Partial<Presence>;
    if (typeof obj.userId === "string" && typeof obj.role === "string") {
      return { userId: obj.userId, name: obj.name ?? null, role: obj.role as Presence["role"] };
    }
  } catch {
    /* malformed */
  }
  return null;
}

/**
 * Tell a trip's room to broadcast a change to all connected clients. Called by
 * the Hono mutation routes after a successful DB write. No-ops gracefully if the
 * DO binding isn't provisioned (local build without the binding).
 */
export async function broadcastTripChange(
  env: CloudflareEnv,
  tripId: string,
  resource: ChangeResource,
  by: string | null,
): Promise<void> {
  if (!env.TRIP_ROOM) return;
  try {
    const id = env.TRIP_ROOM.idFromName(tripId);
    await env.TRIP_ROOM.get(id).fetch("https://trip-room/notify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ resource, by }),
    });
  } catch (err) {
    console.error("broadcastTripChange failed", err);
  }
}
