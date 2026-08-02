import { initTRPC } from "@trpc/server";
import type { AppContext } from "./context";
import { unauthorized } from "./errors";

const t = initTRPC.context<AppContext>().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        code: error.code,
        reason: error.message,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) unauthorized();
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export type AppRouter = typeof router;
