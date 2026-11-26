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

  test("통합 대시보드에서 고정 GLB 모델을 조작하고 3D 모델 현황으로 이동한다", async ({ page }) => {
    await loginWithLocalAdmin(page);

    const preview = page.getByRole("region", { name: /아파트 101동 인터랙티브 3D 미리보기/ });
    await expect(preview).toBeVisible();
    const canvas = page.getByLabel("PROJECT HUB 자체 제작 아파트 1개 동 3D 모델");
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + box!.width * 0.35, box!.y + box!.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width * 0.65, box!.y + box!.height * 0.42, { steps: 6 });
    await page.mouse.up();
    await expect(page.getByText(/마우스·한 손가락: 회전/)).toBeVisible();

    await page.getByRole("link", { name: "3D 모델 현황 열기" }).click();
    await expect(page).toHaveURL(/\/model-status$/);
    await expect(page.getByRole("heading", { name: "3D 모델 현황", level: 2 })).toBeVisible();
    await expect(page.getByText("PROJECT HUB 아파트 101동")).toBeVisible();
  });

  test("3D/BIM 탭이 재사용 가능한 3D Viewer 전용 창을 안내한다", async ({ page }) => {
    await loginWithLocalAdmin(page);
    await page.goto("/viewer");
    await expect(page.getByRole("heading", { name: "3D/BIM 뷰어", level: 2 })).toBeVisible();
    await expect(page.getByRole("button", { name: "3D Viewer 전용 창 열기" })).toBeVisible();
    await expect(page.getByText("3D Viewer 전용 창 사용")).toBeVisible();
    await expect(page.getByRole("heading", { name: "연결된 3D 모델" })).toBeVisible();
    await expect(page.getByText(/GLTF.*GLB.*STL.*OBJ.*FBX.*STEP.*PLY.*3DM/).first()).toBeVisible();
    await expect(page.getByLabel("Autodesk APS 3D/BIM 뷰어")).toHaveCount(0);
  });

  test("CAD 뷰어가 재사용 가능한 CADViewer 전용 창을 안내한다", async ({ page }) => {
    await loginWithLocalAdmin(page);
    await page.goto("/cad");
    await expect(page.getByRole("heading", { name: "CAD 도면 뷰어", level: 2 })).toBeVisible();
    await expect(page.getByText(/브라우저 최상위 창에서 진행됩니다/)).toBeVisible();
    await expect(page.getByRole("button", { name: "CADViewer 전용 창 열기" })).toBeVisible();
    await expect(page.locator('iframe[title="CAD Viewer for Google Drive"]')).toHaveCount(0);
  });

  test("고정 3D 모델과 2D 도면 현황을 분리해 제공한다", async ({ page }) => {
    await loginWithLocalAdmin(page);

    await page.goto("/model-status");
    await expect(page.getByRole("heading", { name: "3D 모델 현황", level: 2 })).toBeVisible();
    await expect(page.getByText("PROJECT HUB 아파트 101동")).toBeVisible();
    await expect(page.getByRole("link", { name: "GLB 원본 내려받기" })).toHaveAttribute("href", "/samples/models/project-hub-apartment-tower.glb");

    await page.goto("/drawing-status");
    await expect(page.getByRole("heading", { name: "2D 도면 현황", level: 2 })).toBeVisible();
    await expect(page.getByText("S-202 지상1층 구조평면도").first()).toBeVisible();
    await expect(page.getByRole("img", { name: /실제 DWG 변환 도면/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "고해상도 도면 열기" })).toHaveAttribute("href", "/samples/drawings/S-202-ground-floor-structural-plan.png");
    await page.getByRole("button", { name: "도면 확대" }).click();
    await expect(page.getByLabel("도면 확대 비율")).toHaveText("125%");
    await page.getByRole("button", { name: "전체 보기" }).click();
    await expect(page.getByLabel("도면 확대 비율")).toHaveText("100%");
  });
});
