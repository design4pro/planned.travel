/**
 * The sandcastle coordinator's HTTP surface, as a pure function of its bindings.
 *
 * Every sandcastle entry point talks to this: the AFK loop on a laptop, the same loop on someone
 * else's laptop, and triage running as a GitHub Action. They agree on what each is working on here
 * or not at all, which is why this is a plain HTTP surface rather than a server function — a `tsx`
 * script in `.sandcastle/` and a workflow `run:` step both speak `fetch`, and neither can call into
 * a Start RPC.
 *
 * Separate from `../$.ts` for the reason `api/tiles/-lib/serve.ts` is: the route module imports
 * `cloudflare:workers`, which the node test project cannot resolve, so the whole of the decision
 * making lives here where it can be driven with a fake namespace and no Worker at all.
 *
 * Authorisation is a shared bearer token. That is deliberately less than the rest of the
 * application gets — there is one client, it is a script rather than a person, and it has no
 * session to carry. `staff_api_tokens` + `MCP_TOKEN_PEPPER` (docs/DEPLOY.md §14.3) is the upgrade
 * path if a second, less trusted client ever appears. Two things already sit in front of it: the
 * hostname is behind Cloudflare Access, and the Durable Object itself is reachable only through
 * its binding — the same boundary the trip room relies on.
 */

import {
  claimInputSchema,
  claimSandcastleIssues,
  finishInputSchema,
  finishSandcastleRun,
  heartbeatInputSchema,
  heartbeatSandcastleRun,
  readSandcastleState,
  recordSandcastleWip,
  recordWipInputSchema,
  registerRunInputSchema,
  registerSandcastleRun,
  releaseInputSchema,
  releaseSandcastleIssues,
} from '#/server/do'

import type { SandcastleRegistryNamespace } from '#/server/do'
import type { z } from 'zod'

/**
 * The narrow structural view of the bindings this route needs, in the spirit of `TaskBindings` in
 * `src/server/worker.ts`. Both names are optional because on production they genuinely are absent:
 * the registry is bound in `env.staging` alone (`wrangler.jsonc`, and docs/adr/0009 for why), so
 * `wrangler types` does not put either name in `Cloudflare.Env`. The optionality is the truth about
 * the type rather than defensive padding.
 */
export interface SandcastleCoordinatorBindings {
  SANDCASTLE_REGISTRY?: SandcastleRegistryNamespace
  SANDCASTLE_COORDINATOR_TOKEN?: string
}

/** The one repository this coordinator serves. */
export const SANDCASTLE_COORDINATOR_REPO = 'design4pro/planned.travel'

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

/**
 * Length-independent, timing-safe comparison.
 *
 * Workers has no `crypto.timingSafeEqual`, and `===` on strings returns as soon as two bytes
 * differ, which leaks the shared secret one byte at a time to a caller willing to measure. Hashing
 * both sides first closes the length leak too: the digests are always 32 bytes, so the loop below
 * runs the same number of times whatever was presented.
 */
async function tokenMatches(
  presented: string,
  expected: string,
): Promise<boolean> {
  const encoder = new TextEncoder()
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(presented)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ])
  const left = new Uint8Array(a)
  const right = new Uint8Array(b)
  let difference = 0
  for (let at = 0; at < left.length; at++) {
    difference |= left[at] ^ right[at]
  }
  return difference === 0
}

/**
 * Resolves the binding and checks the bearer token, or returns the response to send instead.
 *
 * Fails closed in both directions. A deployment with no binding is not a coordinator; a deployment
 * with a binding but no configured token is a coordinator nobody may talk to, which is safer than
 * one that would accept an empty `Authorization` header against an empty secret.
 */
async function authorise(
  bindings: SandcastleCoordinatorBindings,
  request: Request,
): Promise<SandcastleRegistryNamespace | Response> {
  const namespace = bindings.SANDCASTLE_REGISTRY
  if (namespace === undefined) {
    return json(
      {
        error:
          'This deployment is not the sandcastle coordinator. Point SANDCASTLE_COORDINATOR_URL at staging.',
      },
      503,
    )
  }

  const expected = bindings.SANDCASTLE_COORDINATOR_TOKEN
  if (expected === undefined || expected.length === 0) {
    return json(
      { error: 'SANDCASTLE_COORDINATOR_TOKEN is not set on this deployment.' },
      503,
    )
  }

  const header = request.headers.get('authorization') ?? ''
  const presented = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (presented.length === 0) {
    return json({ error: 'Present a bearer token.' }, 401)
  }
  if (!(await tokenMatches(presented, expected))) {
    return json({ error: 'That token is not the coordinator token.' }, 403)
  }

  return namespace
}

/** Parses and validates a JSON body, or returns the 400 to send instead. */
async function readBody<T extends z.ZodTypeAny>(
  request: Request,
  schema: T,
): Promise<z.infer<T> | Response> {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return json({ error: 'Body must be JSON.' }, 400)
  }
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    return json(
      { error: 'Body failed validation.', issues: parsed.error.issues },
      400,
    )
  }
  return parsed.data
}

function isResponse(value: unknown): value is Response {
  return value instanceof Response
}

const notFound = (): Response =>
  json({ error: 'No such coordinator route.' }, 404)

/**
 * Serves one coordinator request.
 *
 * `splat` is the path under `/api/sandcastle` — `runs/register`, `runs/<runId>/<verb>` or `state`.
 * Bodies are validated here and again inside the Durable Object, the way the trip room's `commit`
 * route is: this side is a courtesy that returns a readable 400, and the object's own check is the
 * one that has to hold, because a future caller could reach it through a different door.
 */
export async function serveSandcastleCoordinator(
  bindings: SandcastleCoordinatorBindings,
  request: Request,
  splat: string | undefined,
): Promise<Response> {
  const namespace = await authorise(bindings, request)
  if (isResponse(namespace)) return namespace

  const segments = (splat ?? '').split('/').filter((part) => part.length > 0)
  const repo = SANDCASTLE_COORDINATOR_REPO

  if (request.method === 'GET') {
    if (segments.length !== 1 || segments[0] !== 'state') return notFound()
    return readSandcastleState(namespace, repo)
  }

  if (segments[0] !== 'runs') return notFound()

  // `runs/register` carries its run id in the body; every other verb names it in the path.
  if (segments.length === 2 && segments[1] === 'register') {
    const input = await readBody(request, registerRunInputSchema)
    if (isResponse(input)) return input
    if (input.repo !== repo) {
      return json({ error: `This coordinator serves ${repo} only.` }, 400)
    }
    return registerSandcastleRun(namespace, input)
  }

  if (segments.length !== 3) return notFound()
  const runId = segments[1]

  switch (segments[2]) {
    case 'claim': {
      const input = await readBody(request, claimInputSchema)
      if (isResponse(input)) return input
      return claimSandcastleIssues(namespace, repo, runId, input)
    }
    case 'heartbeat': {
      const input = await readBody(request, heartbeatInputSchema)
      if (isResponse(input)) return input
      return heartbeatSandcastleRun(namespace, repo, runId, input)
    }
    case 'wip': {
      const input = await readBody(request, recordWipInputSchema)
      if (isResponse(input)) return input
      return recordSandcastleWip(namespace, repo, runId, input)
    }
    case 'release': {
      const input = await readBody(request, releaseInputSchema)
      if (isResponse(input)) return input
      return releaseSandcastleIssues(namespace, repo, runId, input)
    }
    case 'finish': {
      const input = await readBody(request, finishInputSchema)
      if (isResponse(input)) return input
      return finishSandcastleRun(namespace, repo, runId, input)
    }
    default:
      return notFound()
  }
}
