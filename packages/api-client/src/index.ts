/**
 * @planned/api-client — tiny typed fetch client shared by web + mobile.
 *
 * Web (Astro) calls same-origin /api routes; mobile (Expo) calls the deployed
 * Worker origin with a Bearer token (Better Auth bearer plugin). The DTOs come
 * from @planned/shared so both clients stay in sync with the API contract.
 */
import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "@planned/server";
import type { NotificationRow, Trip, TripPlan } from "@planned/shared";

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
      list: () => this.request<Trip[]>("/api/trips"),
      get: (id: string) => this.request<TripPlan>(`/api/trips/${id}`),
      create: (input: Pick<Trip, "title">) =>
        this.request<Trip>("/api/trips", { method: "POST", body: JSON.stringify(input) }),
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

export class ApiError extends Error {
  constructor(public status: number, body: string) {
    super(`API ${status}: ${body}`);
    this.name = "ApiError";
  }
}
