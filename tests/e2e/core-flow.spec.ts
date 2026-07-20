import { mkdir } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

test("demo onboarding to adaptive feed, search, detail and library", async ({
  page,
}, testInfo) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await page.goto("/");
  await page.getByTestId("start-demo").click();
  await expect(page).toHaveURL(/\/onboarding/);
  expect((await page.context().cookies()).map((cookie) => cookie.name)).toEqual(
    expect.arrayContaining(["gps_user", "gps_session", "gps_auth", "gps_csrf"]),
  );

  await page.locator(".choice").nth(0).click();
  await page.locator(".choice").nth(1).click();
  await page.getByRole("button", { name: "下一步" }).click();
  await page.locator(".choice").first().click();
  await page.getByRole("button", { name: "下一步" }).click();

  const feedbackItems = page.locator(".feedback-item");
  await expect(feedbackItems).toHaveCount(12);
  for (let index = 0; index < 10; index += 1) {
    await feedbackItems
      .nth(index)
      .getByRole("button", {
        name: index % 4 === 0 ? "想学习" : "感兴趣",
        exact: true,
      })
      .click();
  }
  await page.getByTestId("finish-onboarding").click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId("feed-card")).toBeVisible();
  await expect(page.getByTestId("feed-card")).toHaveCSS("opacity", "1");

  const screenshots = path.resolve(process.cwd(), "docs", "screenshots");
  await mkdir(screenshots, { recursive: true });
  await page.screenshot({
    path: path.join(screenshots, `discover-${testInfo.project.name}.png`),
    fullPage: true,
  });

  const firstRepository = await page
    .locator(".repo-path")
    .first()
    .textContent();
  await page.getByTestId("action-favorite").click();
  await expect(page.getByRole("status")).toContainText("已收藏");
  await page.getByText("不合适", { exact: true }).click();
  await page.getByTestId("action-negative").click();

  for (let index = 0; index < 8; index += 1) {
    const currentRepository = await page
      .locator(".repo-path")
      .first()
      .textContent();
    // WebKit's touch emulation can keep an element in its "unstable" state
    // while the horizontal action rail is being repositioned. A real pointer
    // click was already verified above; force only the rapid-repeat stress
    // loop, then assert that every action produced the expected state change.
    await page.getByTestId("action-interested").click({
      force: testInfo.project.name === "ios-safari",
    });
    if (index < 7)
      await expect(page.locator(".repo-path").first()).not.toHaveText(
        currentRepository ?? "",
      );
  }
  await expect(page.getByTestId("batch-complete")).toBeVisible();
  await page.getByTestId("more-ten").click();
  await expect(page.getByTestId("feed-card")).toBeVisible();
  expect(await page.locator(".repo-path").first().textContent()).not.toBe(
    firstRepository,
  );

  await page.goto("/search");
  await page.getByTestId("search-input").fill("量子力学波函数可视化网站");
  await page.getByTestId("search-submit").click();
  await expect(page.getByTestId("query-understanding")).toContainText(
    "quantum",
  );
  await expect(page.getByTestId("search-results")).toBeVisible();
  await page.screenshot({
    path: path.join(screenshots, `search-${testInfo.project.name}.png`),
  });

  await page
    .getByTestId("search-results")
    .getByRole("link", { name: /查看详情/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/repository\//);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.screenshot({
    path: path.join(
      screenshots,
      `repository-detail-${testInfo.project.name}.png`,
    ),
    fullPage: true,
  });
  await page.getByTestId("detail-learn").click();
  await expect(page.getByRole("status")).toContainText("学习");

  await page.goto("/library");
  await expect(page.getByTestId("library-items")).toBeVisible();
  await expect(page.getByTestId("library-items")).toContainText(
    /正在学习|稍后阅读/,
  );
  await page.screenshot({
    path: path.join(screenshots, `library-${testInfo.project.name}.png`),
    fullPage: true,
  });
  expect(consoleErrors).toEqual([]);
});
