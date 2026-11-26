import { expect, test, type Page } from "@playwright/test";

async function loginWithLocalAdmin(page: Page) {
  await page.route("**/backend/**", (route) => route.abort("connectionrefused"));
  await page.goto("/");
  await page.getByLabel("아이디").fill("dawooadmin");
  await page.getByLabel("비밀번호").fill("123123");
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page.getByRole("link", { name: "통합 대시보드", exact: true })).toBeVisible();
}

test.describe("모바일 레이아웃", () => {
  test("주요 업무 화면이 모바일 뷰포트 안에서 세로 흐름을 유지한다", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginWithLocalAdmin(page);

    const routes = ["/", "/projects", "/issues", "/drive", "/calendar", "/viewer", "/cad", "/model-status", "/drawing-status", "/approvals", "/admin"];
    for (const route of routes) {
      await page.goto(route);
      await expect(page.locator(".app-content")).toBeVisible();
      const layout = await page.evaluate(() => ({
        viewportWidth: window.innerWidth,
        pageWidth: document.documentElement.scrollWidth,
        shellDisplay: getComputedStyle(document.querySelector<HTMLElement>(".app-shell")!).display,
        contentPadding: getComputedStyle(document.querySelector<HTMLElement>(".app-content")!).paddingLeft,
      }));
      expect(layout.pageWidth, `${route} 경로에서 가로 넘침이 발생했습니다.`).toBeLessThanOrEqual(layout.viewportWidth + 1);
      expect(layout.shellDisplay).toBe("block");
      expect(Number.parseFloat(layout.contentPadding)).toBeLessThanOrEqual(16);
    }
  });

  test("데스크톱에서는 기존 2열 앱 셸을 유지한다", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await loginWithLocalAdmin(page);

    const desktop = await page.evaluate(() => {
      const shell = document.querySelector<HTMLElement>(".app-shell")!;
      return {
        display: getComputedStyle(shell).display,
        columns: getComputedStyle(shell).gridTemplateColumns,
      };
    });
    expect(desktop.display).toBe("grid");
    expect(desktop.columns).not.toBe("none");
  });
});
