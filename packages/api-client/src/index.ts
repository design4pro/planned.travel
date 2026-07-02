/**
 * @planned/api-client — tiny typed fetch client shared by web + mobile.
 *
 * Web (Astro) calls same-origin /api routes; mobile (Expo) calls the deployed
 * Worker origin with a Bearer token (Better Auth bearer plugin). The DTOs come
 * from @planned/shared so both clients stay in sync with the API contract.
 */
import type { NotificationRow, Trip } from "@planned/shared";

export interface ClientOptions {
  /** Base URL of the API. Defaults to same-origin (web). Mobile passes the deployed origin. */
  baseUrl?: string;
  /** Returns the auth token (Better Auth bearer). Web reads the session cookie server-side; mobile reads SecureStore. */
  getToken?: () => string | null | Promise<string | null>;
  fetch?: typeof fetch;
}

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
      get: (id: string) => this.request<Trip>(`/api/trips/${id}`),
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
