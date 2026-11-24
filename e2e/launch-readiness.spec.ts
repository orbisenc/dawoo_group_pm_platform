import { expect, test, type Page } from "@playwright/test";

async function loginWithLocalAdmin(page: Page) {
  await page.route("**/backend/**", (route) => route.abort("connectionrefused"));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "로그인" })).toBeVisible();
  await page.getByLabel("아이디").fill("dawooadmin");
  await page.getByLabel("비밀번호").fill("123123");
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page.getByRole("link", { name: "통합 대시보드", exact: true })).toBeVisible();
}

test.describe("출시 핵심 사용자 여정", () => {
  test("로그인 전 보호 화면을 숨기고 정책 문서를 공개한다", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "로그인" })).toBeVisible();
    await expect(page.getByRole("link", { name: /통합 대시보드/ })).toHaveCount(0);

    await page.getByRole("link", { name: "개인정보 처리방침" }).click();
    await expect(page.getByRole("heading", { name: "개인정보 처리방침" })).toBeVisible();
    await expect(page.getByText("처리하는 정보")).toBeVisible();

    await page.goto("/terms");
    await expect(page.getByRole("heading", { name: "이용약관" })).toBeVisible();
    await page.goto("/help");
    await expect(page.getByRole("heading", { name: "사용자 도움말" })).toBeVisible();
  });

  test("승인된 관리자가 대시보드와 프로젝트·이슈 화면을 탐색한다", async ({ page }) => {
    await loginWithLocalAdmin(page);
    await expect(page.getByRole("heading", { name: "이슈 피드", level: 2 })).toBeVisible();

    await page.locator('nav[aria-label="주요 메뉴"] a[href="/projects"]').click();
    await expect(page.getByRole("heading", { name: "다우그룹 주요 프로젝트" })).toBeVisible();
    await expect(page.getByRole("button", { name: /프로젝트 추가/ })).toBeVisible();

    await page.getByRole("link", { name: "이슈 피드", exact: true }).click();
    await expect(page.getByRole("heading", { name: "이슈 피드", level: 2 })).toBeVisible();
    await expect(page.getByRole("button", { name: /새 이슈 등록/ })).toBeVisible();
  });

  test("3D/BIM 뷰어가 지원 형식과 모델 선택 방법을 안내한다", async ({ page }) => {
    await loginWithLocalAdmin(page);
    await page.goto("/viewer");
    await expect(page.getByRole("heading", { name: "3D/BIM 뷰어", level: 2 })).toBeVisible();
    await expect(page.getByLabel("Autodesk APS 3D/BIM 뷰어")).toBeVisible();
    await expect(page.getByText("오른쪽 Google Drive에서 3D 모델을 끌어 놓으세요.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "연결된 3D 모델" })).toBeVisible();
    await expect(page.getByText(/IFC.*OBJ.*STP.*STEP.*SKP/).first()).toBeVisible();
  });
});
