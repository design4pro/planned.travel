/**
 * Tests for the email layer (design §12.3):
 *  - NoopEmailSender resolves to { id: "noop" } and never throws.
 *  - ResendEmailSender calls fetch with the right URL/method/headers/body,
 *    returns { id } on 200, and throws on non-200.
 *  - createEmailSender returns NoopEmailSender unless EMAIL_ENABLED === "true"
 *    AND a key is present, in which case ResendEmailSender.
 *  - renderNotificationEmail renders a localized email (with the absolute
 *    invite link) and returns null for a payload that doesn't match the type.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  NoopEmailSender,
  ResendEmailSender,
  createEmailSender,
} from "../src/lib/email";
import { renderNotificationEmail } from "../src/lib/email-templates";

const INPUT = { to: "a@b.co", subject: "Hi", html: "<b>Hi</b>", text: "Hi" };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("NoopEmailSender", () => {
  it("resolves to { id: 'noop' } and never throws", async () => {
    const sender = new NoopEmailSender();
    await expect(sender.send(INPUT)).resolves.toEqual({ id: "noop" });
    // even with weird input it does not throw
    await expect(sender.send({ ...INPUT, to: "" })).resolves.toEqual({ id: "noop" });
  });
});

describe("ResendEmailSender", () => {
  it("POSTs to Resend with bearer auth + the right body, returns { id } on 200", async () => {
    let captured: { url: unknown; init: any } | null = null;
    const fetchMock = vi.fn(async (url: unknown, init: any) => {
      captured = { url, init };
      return new Response(JSON.stringify({ id: "re_123" }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const sender = new ResendEmailSender("key_abc", "planned.travel <noreply@planned.travel>");
    const res = await sender.send({ ...INPUT, replyTo: "help@planned.travel" });

    expect(res).toEqual({ id: "re_123" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(captured!.url).toBe("https://api.resend.com/emails");
    expect(captured!.init.method).toBe("POST");
    expect(captured!.init.headers.authorization).toBe("Bearer key_abc");
    expect(captured!.init.headers["content-type"]).toBe("application/json");
    const body = JSON.parse(captured!.init.body);
    expect(body).toMatchObject({
      from: "planned.travel <noreply@planned.travel>",
      to: "a@b.co",
      subject: "Hi",
      html: "<b>Hi</b>",
      text: "Hi",
      reply_to: "help@planned.travel",
    });
  });

  it("throws on non-2xx with the status + body", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("bad request", { status: 422 })));
    const sender = new ResendEmailSender("key_abc", "from@planned.travel");
    await expect(sender.send(INPUT)).rejects.toThrow(/resend 422/);
  });
});

describe("createEmailSender", () => {
  const env = (over: Record<string, string> = {}) => over as any;

  it("returns NoopEmailSender when EMAIL_ENABLED is unset", () => {
    expect(createEmailSender(env())).toBeInstanceOf(NoopEmailSender);
  });

  it("returns NoopEmailSender when EMAIL_ENABLED is 'false'", () => {
    expect(createEmailSender(env({ EMAIL_ENABLED: "false" }))).toBeInstanceOf(NoopEmailSender);
  });

  it("returns NoopEmailSender when enabled but no key", () => {
    expect(createEmailSender(env({ EMAIL_ENABLED: "true" }))).toBeInstanceOf(NoopEmailSender);
  });

  it("returns ResendEmailSender when enabled AND a key is present", () => {
    expect(
      createEmailSender(env({ EMAIL_ENABLED: "true", RESEND_API_KEY: "k" })),
    ).toBeInstanceOf(ResendEmailSender);
  });
});

describe("renderNotificationEmail", () => {
  const invitePayload = { tripId: "t_1", tripName: "Tokyo", inviteToken: "tok_abc", inviterName: "Ada" };

  it("renders an invite email (en) with the absolute invite link", () => {
    const r = renderNotificationEmail("invite_sent", invitePayload, "en", "https://app.example");
    expect(r).not.toBeNull();
    expect(r!.subject).toContain("Tokyo");
    expect(r!.text).toContain("https://app.example/invite/tok_abc");
    expect(r!.html).toContain("https://app.example/invite/tok_abc");
  });

  it("renders in pl", () => {
    const r = renderNotificationEmail("invite_sent", invitePayload, "pl", "https://app.example");
    expect(r).not.toBeNull();
    expect(r!.subject).toContain("Tokyo");
    expect(r!.text).toContain("https://app.example/invite/tok_abc");
  });

  it("returns null when the payload does not match the type schema", () => {
    expect(renderNotificationEmail("invite_sent", {}, "en", "https://app.example")).toBeNull();
    expect(
      renderNotificationEmail("expense_added", { tripId: "t", tripName: "X" }, "en", "https://app.example"),
    ).toBeNull(); // missing required expense fields
  });

  it("escapes HTML in rendered lines", () => {
    const r = renderNotificationEmail(
      "invite_sent",
      { ...invitePayload, inviterName: "<script>x</script>" },
      "en",
      "https://app.example",
    );
    expect(r!.html).not.toContain("<script>");
    expect(r!.html).toContain("&lt;script&gt;");
  });
});
