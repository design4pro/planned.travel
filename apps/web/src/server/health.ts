export function healthResponse(): Response {
  return Response.json({
    ok: true,
    service: "planned-travel-web",
  });
}
