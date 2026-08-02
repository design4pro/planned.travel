import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@planned/server";

export const trpc = createTRPCReact<AppRouter>();
