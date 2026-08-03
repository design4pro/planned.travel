import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";

type PerformanceBaseline = {
  desktop: { lcp: number; inp: number; ttfb: number; dcl: number; cls: number };
  mobile: { lcp: number; inp: number; ttfb: number; dcl: number; cls: number };
};

const performanceBaseline = JSON.parse(
  readFileSync(new URL("./performance-baseline.json", import.meta.url), "utf8"),
) as PerformanceBaseline;

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
      await expect(page).toHaveScreenshot(`${route.replaceAll("/", "_") || "home"}.png`, {
        fullPage: true,
        animations: "disabled",
        maxDiffPixelRatio: 0.03,
      });
    });
  }
});

test("auth form is keyboard reachable and labelled", async ({ page }) => {
  await page.goto("/login", { waitUntil: "networkidle" });
  await expect(page.locator("label[for=auth-email]")).toBeVisible();
  await expect(page.locator("label[for=auth-password]")).toBeVisible();
  await page.locator("#auth-email").focus();
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

test("public routes remain accessible and responsive across themes", async ({ page }) => {
  for (const route of ["/", "/pl", "/login", "/pl/login", "/pricing", "/pl/pricing"]) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto(route, { waitUntil: "networkidle" });
    await expect(page.locator("html")).toHaveAttribute("lang", route.startsWith("/pl") ? "pl" : "en");
    await expect(page.locator("html")).toHaveClass(/dark/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations, route).toEqual([]);
  }
});

test("records p75 web and mobile performance baselines", async ({ page }, testInfo) => {
  const samples: Array<{ lcp: number; inp: number; ttfb: number; dcl: number; cls: number }> = [];
  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    for (let index = 0; index < 5; index += 1) {
      await page.goto("/", { waitUntil: "networkidle" });
      await page.evaluate(() => {
        const button = document.createElement("button");
        button.type = "button";
        button.id = "performance-interaction";
        button.textContent = "interaction";
        button.style.cssText = "position:fixed;left:4px;top:4px;opacity:0.01;width:2px;height:2px;z-index:99999";
        button.addEventListener("click", () => { button.dataset.clicked = "true"; });
        document.body.appendChild(button);
        (window as Window & { __plannedInp?: number }).__plannedInp = 0;
        try {
          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries() as Array<PerformanceEventTiming & { interactionId?: number }>) {
              if (entry.interactionId) {
                const target = window as Window & { __plannedInp?: number };
                target.__plannedInp = Math.max(target.__plannedInp ?? 0, entry.duration);
              }
            }
          });
          observer.observe({ type: "event", buffered: true, durationThreshold: 16 } as PerformanceObserverInit);
          window.setTimeout(() => observer.disconnect(), 1000);
        } catch { /* unsupported */ }
      });
      await page.locator("#performance-interaction").click();
      const sample = await page.evaluate(async () => {
        const metrics = await new Promise<{ lcp: number; cls: number }>((resolve) => {
          let lcp = 0;
          let cls = 0;
          const lcpObserver = new PerformanceObserver((list) => {
            lcp = list.getEntries().at(-1)?.startTime ?? lcp;
          });
          const clsObserver = new PerformanceObserver((list) => {
            for (const entry of list.getEntries() as unknown as Array<{ hadRecentInput: boolean; value: number }>) {
              if (!entry.hadRecentInput) cls += entry.value;
            }
          });
          try { lcpObserver.observe({ type: "largest-contentful-paint", buffered: true }); } catch { /* unsupported */ }
          try { clsObserver.observe({ type: "layout-shift", buffered: true }); } catch { /* unsupported */ }
          setTimeout(() => { lcpObserver.disconnect(); clsObserver.disconnect(); resolve({ lcp, cls }); }, 100);
        });
        const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
        return {
          ...metrics,
          inp: (window as Window & { __plannedInp?: number }).__plannedInp ?? 0,
          ttfb: navigation.responseStart,
          dcl: navigation.domContentLoadedEventEnd,
        };
      });
      samples.push(sample);
    }
  }
  const p75 = (values: number[]) => values.sort((a, b) => a - b)[Math.ceil(values.length * 0.75) - 1] ?? 0;
  const baseline = {
    desktop: { lcp: p75(samples.slice(0, 5).map((sample) => sample.lcp)), inp: p75(samples.slice(0, 5).map((sample) => sample.inp)), ttfb: p75(samples.slice(0, 5).map((sample) => sample.ttfb)), dcl: p75(samples.slice(0, 5).map((sample) => sample.dcl)), cls: p75(samples.slice(0, 5).map((sample) => sample.cls)) },
    mobile: { lcp: p75(samples.slice(5).map((sample) => sample.lcp)), inp: p75(samples.slice(5).map((sample) => sample.inp)), ttfb: p75(samples.slice(5).map((sample) => sample.ttfb)), dcl: p75(samples.slice(5).map((sample) => sample.dcl)), cls: p75(samples.slice(5).map((sample) => sample.cls)) },
  };
  expect(baseline.mobile.ttfb).toBeLessThan(2500);
  expect(baseline.mobile.dcl).toBeLessThan(5000);
  await testInfo.attach("p75-performance-baseline.json", { body: JSON.stringify(baseline, null, 2), contentType: "application/json" });
  for (const viewport of ["desktop", "mobile"] as const) {
    for (const metric of ["lcp", "inp", "ttfb", "dcl", "cls"] as const) {
      const previous = performanceBaseline[viewport][metric];
      const allowed = previous === 0 ? 0.05 : previous * 1.1;
      expect(baseline[viewport][metric], `${viewport}.${metric} regression`).toBeLessThanOrEqual(allowed);
    }
  }
});
