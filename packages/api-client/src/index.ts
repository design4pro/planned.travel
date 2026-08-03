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
  BillingPlanResponse,
  CreateExpenseInput,
  CreateReservationInput,
  DocumentMeta,
  ExpenseDto,
  ReservationDto,
  UpdateReservationInput,
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
        ...(!(init.body instanceof FormData) ? { "content-type": "application/json" } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });

    if (!res.ok) {
      throw new ApiError(res.status, await res.text());
    }
    return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
  }

  private async requestBinary(path: string): Promise<ArrayBuffer> {
    const fetchImpl = this.opts.fetch ?? fetch;
    const token = this.opts.getToken ? await this.opts.getToken() : null;
    const res = await fetchImpl(`${this.opts.baseUrl ?? ""}${path}`, {
      credentials: "include",
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new ApiError(res.status, await res.text());
    return res.arrayBuffer();
  }

  trips() {
    return {
      list: () => this.request<TripDto[]>("/api/trips"),
      create: (input: { title: string }) =>
        this.request<TripDto>("/api/trips", { method: "POST", body: JSON.stringify(input) }),
      get: (id: string) => this.request<TripPlan>(`/api/trips/${id}`),
      addPlace: (id: string, input: { name: string; lat: number; lng: number }) =>
        this.request<TripPlan["places"][number]>(`/api/trips/${id}/places`, { method: "POST", body: JSON.stringify(input) }),
      addDay: (id: string) =>
        this.request<TripPlan["days"][number]>(`/api/trips/${id}/days`, { method: "POST" }),
      addItem: (id: string, input: { dayId?: string; note?: string; placeId?: string }) =>
        this.request<TripPlan["items"][number]>(`/api/trips/${id}/items`, { method: "POST", body: JSON.stringify(input) }),
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

  reservations(tripId: string) {
    const path = `/api/trips/${encodeURIComponent(tripId)}/reservations`;
    return {
      list: () => this.request<ReservationDto[]>(path),
      create: (input: CreateReservationInput) => this.request<ReservationDto>(path, {
        method: "POST", body: JSON.stringify(input),
      }),
      update: (id: string, input: UpdateReservationInput) => this.request<ReservationDto>(`/api/reservations/${encodeURIComponent(id)}`, {
        method: "PATCH", body: JSON.stringify(input),
      }),
      remove: (id: string) => this.request<{ ok: true }>(`/api/reservations/${encodeURIComponent(id)}`, { method: "DELETE" }),
    };
  }

  expenses(tripId: string) {
    const path = `/api/trips/${encodeURIComponent(tripId)}/expenses`;
    return {
      list: () => this.request<ExpenseDto[]>(path),
      create: (input: Omit<CreateExpenseInput, "tripId">) => this.request<ExpenseDto>(path, {
        method: "POST", body: JSON.stringify(input),
      }),
      remove: (id: string) => this.request<{ ok: true }>(`/api/expenses/${encodeURIComponent(id)}`, { method: "DELETE" }),
    };
  }

  documents(tripId: string) {
    const path = `/api/trips/${encodeURIComponent(tripId)}/documents`;
    return {
      list: () => this.request<DocumentMeta[]>(path),
      upload: (file: { uri: string; name: string; type: string }, reservationId?: string) => {
        const body = new FormData();
        body.append("file", file as unknown as Blob);
        if (reservationId) body.append("reservationId", reservationId);
        return this.request<DocumentMeta>(path, { method: "POST", body });
      },
      link: (id: string, reservationId: string | null) => this.request<DocumentMeta>(`/api/documents/${encodeURIComponent(id)}`, {
        method: "PATCH", body: JSON.stringify({ reservationId }),
      }),
      remove: (id: string) => this.request<{ ok: true }>(`/api/documents/${encodeURIComponent(id)}`, { method: "DELETE" }),
      downloadUrl: (id: string) => `${this.opts.baseUrl ?? ""}/api/documents/${encodeURIComponent(id)}/download`,
    };
  }

  billing() {
    return {
      plan: () => this.request<BillingPlanResponse>("/api/billing/plan"),
      checkout: (interval: "month" | "year") => this.request<{ url: string }>("/api/billing/checkout", {
        method: "POST", body: JSON.stringify({ interval }),
      }),
      portal: () => this.request<{ url: string }>("/api/billing/portal", { method: "POST" }),
      exportPdf: (tripId: string) => this.requestBinary(`/api/trips/${encodeURIComponent(tripId)}/export.pdf`),
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
