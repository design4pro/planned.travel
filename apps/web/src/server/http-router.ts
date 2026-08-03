type RouteMethod = "GET" | "POST" | "PATCH" | "DELETE" | "PUT" | "OPTIONS" | "ALL";

export type RequestContext = {
  req: {
    raw: Request;
    json: <T = any>() => Promise<T>;
    param: (name: string) => string;
    query: (name: string) => string | undefined;
    header: (name: string) => string | undefined;
  };
  json: (body: unknown, status?: number) => Response;
};

type Handler = (context: RequestContext) => Response | Promise<Response>;

type Route = {
  method: RouteMethod;
  pattern: string;
  handler: Handler;
};

function match(pattern: string, pathname: string): Record<string, string> | null {
  const patternParts = pattern.split("/").filter(Boolean);
  const pathParts = pathname.split("/").filter(Boolean);
  const wildcard = patternParts.at(-1) === "*";
  if ((!wildcard && patternParts.length !== pathParts.length) || (wildcard && pathParts.length < patternParts.length - 1)) {
    return null;
  }

  const params: Record<string, string> = {};
  for (let index = 0; index < patternParts.length; index += 1) {
    const expected = patternParts[index];
    if (expected === "*") break;
    const actual = pathParts[index];
    if (expected.startsWith(":")) params[expected.slice(1)] = decodeURIComponent(actual);
    else if (expected !== actual) return null;
  }
  return params;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=UTF-8" },
  });
}

export class HttpRouter {
  private readonly routes: Route[] = [];

  all(pattern: string, handler: Handler): void {
    this.routes.push({ method: "ALL", pattern, handler });
  }

  get(pattern: string, handler: Handler): void {
    this.routes.push({ method: "GET", pattern, handler });
  }

  post(pattern: string, handler: Handler): void {
    this.routes.push({ method: "POST", pattern, handler });
  }

  patch(pattern: string, handler: Handler): void {
    this.routes.push({ method: "PATCH", pattern, handler });
  }

  delete(pattern: string, handler: Handler): void {
    this.routes.push({ method: "DELETE", pattern, handler });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const route = this.routes.find((candidate) => {
      const methodMatches = candidate.method === "ALL" || candidate.method === request.method;
      return methodMatches && match(candidate.pattern, url.pathname) !== null;
    });
    if (!route) return jsonResponse({ error: "not_found" }, 404);

    const params = match(route.pattern, url.pathname) ?? {};
    const req = {
      raw: request,
      json: <T = any>() => request.json() as Promise<T>,
      param: (name: string) => params[name] ?? "",
      query: (name: string) => url.searchParams.get(name) ?? undefined,
      header: (name: string) => request.headers.get(name) ?? undefined,
    };
    try {
      return await route.handler({ req, json: jsonResponse });
    } catch (error) {
      console.error("Unhandled HTTP route error", error);
      return jsonResponse({ error: "internal_error" }, 500);
    }
  }

  request(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const request = input instanceof Request
      ? input
      : new Request(typeof input === "string" && input.startsWith("/") ? `https://planned.test${input}` : input, init);
    return this.fetch(request);
  }
}
