import { mkdir } from "node:fs/promises";
import path from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

async function completeOnboarding(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByTestId("start-demo").click();
  await page.locator(".choice").nth(0).click();
  await page.locator(".choice").nth(1).click();
  await page.getByRole("button", { name: "下一步" }).click();
  await page.locator(".choice").first().click();
  await page.getByRole("button", { name: "下一步" }).click();
  const feedbackItems = page.locator(".feedback-item");
  await expect(feedbackItems).toHaveCount(12);
  for (let index = 0; index < 10; index += 1)
    await feedbackItems
      .nth(index)
      .getByRole("button", {
        name: index % 4 === 0 ? "想学习" : "感兴趣",
        exact: true,
      })
      .click();
  await page.getByTestId("finish-onboarding").click();
  await expect(page.getByTestId("feed-card")).toBeVisible();
}

test("core surfaces have no serious accessibility violations and remain usable across preferences", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  const skipLink = page.getByRole("link", { name: "跳到主要内容" });
  if (testInfo.project.name.includes("safari")) {
    // Safari only tabs to links when the OS "full keyboard access" preference is
    // enabled. Programmatic focus still verifies that the app exposes a usable
    // skip target rather than asserting an OS-level default.
    await skipLink.focus();
  } else {
    await page.keyboard.press("Tab");
  }
  await expect(skipLink).toBeFocused();

  await completeOnboarding(page);
  const pages = ["/", "/search", "/library", "/trends", "/profile/interests"];
  for (const route of pages) {
    await page.goto(route);
    await page.waitForLoadState("networkidle");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(
      results.violations.filter((violation) =>
        ["critical", "serious"].includes(violation.impact ?? ""),
      ),
      `${route}: ${results.violations.map((item) => item.id).join(", ")}`,
    ).toEqual([]);
  }

  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.goto("/");
  const background = await page
    .locator("html")
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(background).not.toBe("rgb(247, 246, 241)");
  const animationDuration = await page
    .locator(".repo-card")
    .evaluate((element) => getComputedStyle(element).animationDuration);
  expect(Number.parseFloat(animationDuration)).toBeLessThanOrEqual(0.001);

  const screenshots = path.resolve(process.cwd(), "docs", "screenshots");
  await mkdir(screenshots, { recursive: true });
  await page.screenshot({
    path: path.join(screenshots, `dark-${testInfo.project.name}.png`),
    fullPage: true,
  });

  const viewport = page.viewportSize();
  if (viewport && viewport.width <= 500) {
    await expect(page.locator(".mobile-nav")).toBeVisible();
    const widths = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }));
    expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1);
  }

  await page.context().setOffline(true);
  await page.getByTestId("action-interested").click();
  await expect(page.locator(".error-box")).toBeVisible();
  await expect(page.getByTestId("feed-card")).toBeVisible();
  await page.context().setOffline(false);
});
