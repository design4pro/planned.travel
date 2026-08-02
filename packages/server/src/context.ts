import { createDb, type Database } from "@planned/db";
import type { ChangeResource } from "@planned/shared";
import type { ReservationType } from "@planned/shared";

export interface ServerEnv {
  DB: D1Database;
}

export interface SessionUser {
  id: string;
  name?: string | null;
  email?: string | null;
}

export interface SessionResolver {
  (headers: Headers): Promise<SessionUser | null>;
}

export interface AppContext {
  request: Request;
  env: ServerEnv;
  db: Database;
  user: SessionUser | null;
  /** Publish after a successful D1 mutation; the DO remains a change bus only. */
  broadcastChange?: (tripId: string, resource: ChangeResource, by: string | null) => Promise<void>;
  onReservationChange?: (event: ReservationChangeEvent) => Promise<void>;
}

export interface ReservationChangeEvent {
  kind: "added" | "confirmed";
  tripId: string;
  tripName: string;
  reservationId: string;
  type: ReservationType;
  title: string | null;
  actorUserId?: string;
  actorName?: string | null;
}

export async function createContext(options: {
  request: Request;
  env: ServerEnv;
  resolveUser: SessionResolver;
  broadcastChange?: AppContext["broadcastChange"];
  onReservationChange?: AppContext["onReservationChange"];
}): Promise<AppContext> {
  return {
    request: options.request,
    env: options.env,
    db: createDb(options.env.DB),
    user: await options.resolveUser(options.request.headers),
    broadcastChange: options.broadcastChange,
    onReservationChange: options.onReservationChange,
  };
}
