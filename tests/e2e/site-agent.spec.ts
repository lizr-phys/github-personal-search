import { expect, test } from "@playwright/test";

test("site agent turns a short goal into an actionable project search", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "打开 GPS 项目向导" }).click();

  await expect(
    page.getByRole("heading", { name: "GPS 项目向导" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "找 Agent 开发框架" }).click();

  await expect(page.getByRole("dialog")).toContainText("三条可比较路线");
  const searchAction = page.getByRole("link", { name: /查看匹配项目/ });
  await expect(searchAction).toBeVisible();
  expect(decodeURIComponent((await searchAction.getAttribute("href")) ?? ""))
    .toContain("适合二次开发的 AI Agent");
  await expect(page.getByRole("link", { name: /同时看近期趋势/ })).toHaveAttribute(
    "href",
    "/trends",
  );
});

test("onboarding keeps floating navigation out of the primary mobile flow", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByTestId("start-demo").click();
  await expect(page).toHaveURL(/\/onboarding/);
  await expect(
    page.getByRole("button", { name: "打开 GPS 项目向导" }),
  ).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "移动端导航" })).toHaveCount(
    0,
  );
});
