import { TRPCError } from "@trpc/server";

export function unauthorized(): never {
  throw new TRPCError({ code: "UNAUTHORIZED", message: "Authentication required" });
}

export function forbidden(): never {
  throw new TRPCError({ code: "FORBIDDEN", message: "You do not have access to this resource" });
}

export function notFound(resource = "Resource"): never {
  throw new TRPCError({ code: "NOT_FOUND", message: `${resource} not found` });
}
