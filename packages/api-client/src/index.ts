/**
 * @planned/api-client — tiny typed fetch client shared by web + mobile.
 *
 * Web (Astro) calls same-origin /api routes; mobile (Expo) calls the deployed
 * Worker origin with a Bearer token (Better Auth bearer plugin). The DTOs come
 * from @planned/shared so both clients stay in sync with the API contract.
 */
import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "@planned/server";
import type {
  InvitationCreated,
  NotificationRow,
  TripDto,
  TripPlan,
} from "@planned/shared";

export interface TransportOptions {
  /** Same-origin by default for web; mobile supplies its deployed Worker origin. */
  baseUrl?: string;
  /** Mobile token provider. Web relies on the session cookie. */
  getToken?: () => string | null | Promise<string | null>;
  fetch?: typeof fetch;
}
export type TrpcClientOptions = TransportOptions;

/** Create the typed tRPC client without importing server implementation code. */
export function createPlannedTrpcClient(options: TrpcClientOptions = {}) {
  return createTRPCProxyClient<AppRouter>({
    links: [
      httpBatchLink({
        url: `${options.baseUrl ?? ""}/api/trpc`,
        fetch: async (url, init) => {
          const token = options.getToken ? await options.getToken() : null;
          return (options.fetch ?? fetch)(url, {
            ...init,
            credentials: "include",
            headers: {
              ...(init?.headers ?? {}),
              ...(token ? { authorization: `Bearer ${token}` } : {}),
            },
          });
        },
      }),
    ],
  });
}

export type ClientOptions = TransportOptions;

export class PlannedClient {
  private opts: ClientOptions;

  constructor(opts: ClientOptions = {}) {
    this.opts = opts;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const fetchImpl = this.opts.fetch ?? fetch;
    const url = `${this.opts.baseUrl ?? ""}${path}`;
    const token = this.opts.getToken ? await this.opts.getToken() : null;

    const res = await fetchImpl(url, {
      ...init,
      credentials: "include",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });

    if (!res.ok) {
      throw new ApiError(res.status, await res.text());
    }
    return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
  }

  trips() {
    return {
      list: () => this.request<TripDto[]>("/api/trips"),
      get: (id: string) => this.request<TripPlan>(`/api/trips/${id}`),
      create: (input: { title: string }) =>
        this.request<TripDto>("/api/trips", { method: "POST", body: JSON.stringify(input) }),
      members: (id: string) => this.request<Member[]>(`/api/trips/${encodeURIComponent(id)}/members`),
      addMember: (id: string, input: { email: string; role: "editor" | "viewer" }) =>
        this.request<{ userId: string; role: "editor" | "viewer" }>(`/api/trips/${encodeURIComponent(id)}/members`, {
          method: "POST", body: JSON.stringify(input),
        }),
      updateMember: (id: string, userId: string, role: "editor" | "viewer") =>
        this.request<{ userId: string; role: "editor" | "viewer" }>(`/api/trips/${encodeURIComponent(id)}/members/${encodeURIComponent(userId)}`, {
          method: "PATCH", body: JSON.stringify({ role }),
        }),
      removeMember: (id: string, userId: string) =>
        this.request<{ ok: true }>(`/api/trips/${encodeURIComponent(id)}/members/${encodeURIComponent(userId)}`, { method: "DELETE" }),
      invitations: (id: string) => this.request<Invitation[]>(`/api/trips/${encodeURIComponent(id)}/invitations`),
      createInvitation: (id: string, input: { role: "editor" | "viewer"; expiresInDays?: number; maxUses?: number }) =>
        this.request<InvitationCreated>(`/api/trips/${encodeURIComponent(id)}/invitations`, { method: "POST", body: JSON.stringify(input) }),
      acceptInvitation: (token: string) =>
        this.request<{ tripId: string; role: "editor" | "viewer" }>(`/api/invitations/${encodeURIComponent(token)}/accept`, { method: "POST" }),
    };
  }

  notifications() {
    return {
      /** Newest-first; pass `limit` for a small recent slice (e.g. the bell). */
      list: (limit?: number) =>
        this.request<NotificationRow[]>(`/api/notifications${limit ? `?limit=${limit}` : ""}`),
      unreadCount: () => this.request<{ count: number }>("/api/notifications/unread-count"),
      markRead: (id: string) =>
        this.request<{ ok: true }>(`/api/notifications/${encodeURIComponent(id)}/read`, {
          method: "POST",
        }),
      markAllRead: () =>
        this.request<{ ok: true }>("/api/notifications/read-all", { method: "POST" }),
    };
  }
}

export interface Member {
  userId: string;
  role: "owner" | "editor" | "viewer";
  name: string | null;
  email: string | null;
}

export interface Invitation extends InvitationCreated {
  createdAt: number;
  useCount: number;
  revokedAt: number | null;
  open: boolean;
  status: "open" | "revoked" | "expired" | "exhausted";
}

export class ApiError extends Error {
  constructor(public status: number, body: string) {
    super(`API ${status}: ${body}`);
    this.name = "ApiError";
  }
}
