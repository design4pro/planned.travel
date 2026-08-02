import { createDb, type Database } from "@planned/db";

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
}

export async function createContext(options: {
  request: Request;
  env: ServerEnv;
  resolveUser: SessionResolver;
}): Promise<AppContext> {
  return {
    request: options.request,
    env: options.env,
    db: createDb(options.env.DB),
    user: await options.resolveUser(options.request.headers),
  };
}
