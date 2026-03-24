import { expect, test } from "@playwright/test";

test.describe("Vercel production smoke", () => {
  test("core routes respond and render content", async ({ page, request }) => {
    const routes = ["/", "/en", "/pt-BR", "/en/challenges"];
    for (const route of routes) {
      const res = await request.get(route);
      expect(res.status(), `${route} should return HTTP 200`).toBe(200);
    }

    await page.goto("/en", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveTitle(/PlayFunded/i);
    await expect(page.getByRole("link", { name: /Start your challenge/i })).toBeVisible();

    await page.goto("/pt-BR", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: /Pronto para ser financiado\?/i }),
    ).toBeVisible();
  });
});
