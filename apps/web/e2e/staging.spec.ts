import { expect, test } from "@playwright/test";

const routes = [
  "/",
  "/login",
  "/signup",
  "/pricing",
  "/pl",
  "/pl/login",
  "/pl/signup",
  "/pl/pricing",
  "/app",
  "/app/account",
  "/app/notifications",
  "/app/trips/staging-check",
  "/app/trips/staging-check/reservations",
  "/app/trips/staging-check/documents",
] as const;

test.describe("staging route parity", () => {
  for (const route of routes) {
    test(`${route} renders`, async ({ page }) => {
      const response = await page.goto(route, { waitUntil: "domcontentloaded" });
      expect(response?.status(), route).toBe(200);
      await expect(page.locator("main")).toBeVisible();
      await expect(page.locator("h1").first()).toBeVisible();
      const screenshot = await page.screenshot({ fullPage: true });
      expect(screenshot.byteLength, `${route} screenshot`).toBeGreaterThan(1000);
      await test.info().attach(`visual-${route.replaceAll("/", "_") || "home"}`, { body: screenshot, contentType: "image/png" });
    });
  }
});

test("auth form is keyboard reachable and labelled", async ({ page }) => {
  await page.goto("/login", { waitUntil: "networkidle" });
  await expect(page.locator("label[for=auth-email]")).toBeVisible();
  await expect(page.locator("label[for=auth-password]")).toBeVisible();
  await page.locator("body").press("Tab");
  await page.locator("body").press("Tab");
  await expect(page.locator(":focus")).toHaveAttribute("id", "auth-email");
  await page.locator(":focus").press("Tab");
  await expect(page.locator(":focus")).toHaveAttribute("id", "auth-password");
});

test("public page has a usable performance baseline", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  const metrics = await page.evaluate(() => {
    const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
    return {
      ttfb: navigation.responseStart,
      domContentLoaded: navigation.domContentLoadedEventEnd,
      load: navigation.loadEventEnd,
    };
  });
  expect(metrics.ttfb).toBeLessThan(2500);
  expect(metrics.domContentLoaded).toBeLessThan(4000);
  test.info().annotations.push({ type: "performance-baseline", description: JSON.stringify(metrics) });
});
