import handler from "@tanstack/react-start/server-entry";
import { consumeJobs } from "./server/queue";
import { TripRoom } from "./server/trip-room";
import { healthResponse } from "./server/health";

// Keep the Durable Object class statically exported for Wrangler.
export { TripRoom };
// Export the Queue handler by name as well as on the default module. This
// keeps Wrangler/workerd's module handler discovery statically analyzable.
export const queue = consumeJobs;

// Keep Worker handlers on a plain, statically analyzable default export.
export default {
  fetch: (...args: Parameters<typeof handler.fetch>) => {
    const [request] = args;
    const url = new URL(request.url);
    if (url.pathname === "/api/health" && request.method === "GET") {
      return healthResponse();
    }
    return handler.fetch(...args);
  },
  queue,
};
