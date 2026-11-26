import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  BimWorkspace,
  buildBimHistoryKey,
  buildBimViewerCoUrl,
  buildCadDriveListUrl,
  buildCadHistoryKey,
  buildCadViewerCoUrl,
  buildViewerSessionKey,
  CadWorkspace,
  isBimFile,
  isCadFile,
  readCadDrawingHistory,
  writeCadDrawingHistory,
} from "./cad-workspace";
import { ProjectProvider } from "./project-context";

describe("CAD·BIM 작업공간", () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    window.sessionStorage.clear();
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("localhost:4100/helloworld")) {
        return new Response("Hello World! 12.29.3", { status: 200 });
      }
      if (url.includes("/auth/dev-session")) {
        return new Response(JSON.stringify({ accessToken: "signed-token" }), { status: 201 });
      }
      if (url.includes("/bim/configuration")) {
        return new Response(JSON.stringify({ configured: false }), { status: 200 });
      }
      if (url.includes("/bim/status")) {
        return new Response(JSON.stringify({ status: "success", progress: "complete" }), { status: 200 });
      }
      return new Response(JSON.stringify({ message: "테스트에서 처리하지 않은 요청입니다." }), { status: 404 });
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("DWG와 DXF만 CAD 파일로 분류한다", () => {
    expect(isCadFile({ name: "배치도.DWG", mimeType: "application/octet-stream" })).toBe(true);
    expect(isCadFile({ name: "경계측량.dxf", mimeType: "application/dxf" })).toBe(true);
    expect(isCadFile({ name: "도면.pdf", mimeType: "application/pdf" })).toBe(false);
    expect(isCadFile({ name: "도면", mimeType: "application/vnd.google-apps.folder" })).toBe(false);
  });

  it("3D Viewer가 안내하는 3D 모델 형식만 분류한다", () => {
    for (const name of ["건물.gltf", "건물.glb", "출력.stl", "매스.OBJ", "모델.fbx", "부품.stp", "설비.step", "점군.ply", "라이노.3dm"]) {
      expect(isBimFile({ name, mimeType: "application/octet-stream" })).toBe(true);
    }
    expect(isBimFile({ name: "모델.ifc", mimeType: "application/octet-stream" })).toBe(false);
    expect(isBimFile({ name: "스케치.skp", mimeType: "application/octet-stream" })).toBe(false);
    expect(isBimFile({ name: "도면.dwg", mimeType: "application/octet-stream" })).toBe(false);
  });

  it("공유 드라이브 목록 요청에 드라이브 범위와 전체 항목 옵션을 포함한다", () => {
    const url = new URL(buildCadDriveListUrl("folder-1", "shared-drive-1"));

    expect(url.searchParams.get("driveId")).toBe("shared-drive-1");
    expect(url.searchParams.get("corpora")).toBe("drive");
    expect(url.searchParams.get("supportsAllDrives")).toBe("true");
    expect(url.searchParams.get("includeItemsFromAllDrives")).toBe("true");
  });

  it("CAD Viewer for Drive에 Google Drive Open-with 상태를 전달한다", () => {
    const url = new URL(buildCadViewerCoUrl("drive-file-1"));
    expect(url.origin).toBe("https://cadviewer.co");
    expect(url.pathname).toBe("/viewer");
    expect(JSON.parse(url.searchParams.get("state") ?? "{}")).toEqual({ action: "open", ids: ["drive-file-1"] });
  });

  it("3D Viewer에 Google Drive Open-with 상태를 전달한다", () => {
    const url = new URL(buildBimViewerCoUrl("drive-model-1"));
    expect(url.origin).toBe("https://3dviewer.co");
    expect(url.pathname).toBe("/viewer");
    expect(JSON.parse(url.searchParams.get("state") ?? "{}")).toEqual({ action: "open", ids: ["drive-model-1"] });
  });

  it("프로젝트와 뷰어 종류별로 서로 다른 복원 저장소를 사용한다", () => {
    expect(buildViewerSessionKey("project-1", "cad")).toBe("project-hub:project-1:cad:viewer-model");
    expect(buildViewerSessionKey("project-1", "bim")).toBe("project-hub:project-1:bim:viewer-model");
    expect(buildViewerSessionKey("project-2", "cad")).not.toBe(buildViewerSessionKey("project-1", "cad"));
    expect(buildBimHistoryKey("project-1")).toBe("project-hub:project-1:bim:recent-models");
  });

  it("최근 도면은 프로젝트별로 최대 5개를 12시간 동안 보존한다", () => {
    const key = buildCadHistoryKey("project-1");
    const now = Date.now();
    for (let index = 0; index < 6; index += 1) {
      writeCadDrawingHistory(key, { fileName: `${index}.dwg`, url: buildCadViewerCoUrl(String(index)), savedAt: now + index });
    }
    window.sessionStorage.setItem(`${key}:expired`, JSON.stringify([
      { fileName: "만료.dwg", url: buildCadViewerCoUrl("expired"), savedAt: now - 13 * 60 * 60 * 1000 },
    ]));

    expect(readCadDrawingHistory(key, now + 6)).toHaveLength(5);
    expect(readCadDrawingHistory(key, now + 6)[0]?.fileName).toBe("5.dwg");
    expect(readCadDrawingHistory(`${key}:expired`, now)).toEqual([]);
  });

  it("CAD 탭에 CADViewer 전용 창 실행 영역과 Google Drive 패널을 표시한다", async () => {
    render(
      <ProjectProvider>
        <CadWorkspace />
      </ProjectProvider>,
    );

    expect(screen.getByRole("heading", { name: "CAD 도면 뷰어" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "CADViewer 전용 창 실행" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "CADViewer 전용 창 열기" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "연결된 도면" })).toBeInTheDocument();
    expect(await screen.findByText("CADViewer 전용 창 사용")).toBeInTheDocument();
    expect(screen.getByText(/브라우저 최상위 창에서 진행됩니다/)).toBeInTheDocument();
    expect(screen.queryByTitle("CAD Viewer for Google Drive")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "화면 맞춤" })).not.toBeInTheDocument();
  });

  it("CADViewer를 이름이 고정된 전용 창으로 열고 다시 사용할 수 있게 안내한다", async () => {
    const focus = vi.fn();
    const open = vi.spyOn(window, "open").mockReturnValue({ focus } as unknown as Window);
    render(
      <ProjectProvider>
        <CadWorkspace />
      </ProjectProvider>,
    );

    await screen.findByText("CADViewer 전용 창 사용");
    fireEvent.click(screen.getByRole("button", { name: "CADViewer 전용 창 열기" }));
    expect(open).toHaveBeenCalledWith(
      "https://cadviewer.co/viewer",
      "project-hub-cadviewer",
      expect.stringContaining("popup=yes"),
    );
    expect(focus).toHaveBeenCalledOnce();
    expect(await screen.findByText(/다음 파일부터는 같은 창을 재사용/)).toBeInTheDocument();
    open.mockRestore();
  });

  it("CAD와 같은 레이아웃에 3D Viewer 전용 창과 모델 패널을 표시한다", async () => {
    render(
      <ProjectProvider>
        <BimWorkspace />
      </ProjectProvider>,
    );

    expect(screen.getByRole("heading", { name: "3D/BIM 뷰어" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "3D Viewer 전용 창 실행" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "3D Viewer 전용 창 열기" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "연결된 3D 모델" })).toBeInTheDocument();
    expect(screen.getByText("3D Viewer 전용 창 사용")).toBeInTheDocument();
    expect(screen.getAllByText(/GLTF.*GLB.*STL.*OBJ.*FBX.*STEP.*PLY.*3DM/)).toHaveLength(2);
    expect(screen.queryByLabelText("Autodesk APS 3D/BIM 뷰어")).not.toBeInTheDocument();
  });

  it("3D Viewer를 이름이 고정된 전용 창으로 연다", async () => {
    const focus = vi.fn();
    const open = vi.spyOn(window, "open").mockReturnValue({ focus } as unknown as Window);
    render(
      <ProjectProvider>
        <BimWorkspace />
      </ProjectProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "3D Viewer 전용 창 열기" }));
    expect(open).toHaveBeenCalledWith(
      "https://3dviewer.co/viewer",
      "project-hub-3dviewer",
      expect.stringContaining("popup=yes"),
    );
    expect(focus).toHaveBeenCalledOnce();
    open.mockRestore();
  });

  it("다른 메뉴에서 돌아오면 마지막 CAD Viewer for Drive 도면을 복원한다", async () => {
    window.sessionStorage.setItem(
      buildViewerSessionKey("30000000-0000-4000-8000-000000000001", "cad"),
      JSON.stringify({ fileName: "저장된도면.dwg", url: buildCadViewerCoUrl("saved"), savedAt: Date.now() }),
    );

    render(
      <ProjectProvider>
        <CadWorkspace />
      </ProjectProvider>,
    );

    expect(await screen.findAllByText("저장된도면.dwg")).toHaveLength(2);
  });

  it("다른 메뉴에서 돌아오면 마지막 3D Viewer 모델을 복원한다", async () => {
    window.sessionStorage.setItem(
      buildViewerSessionKey("30000000-0000-4000-8000-000000000001", "bim"),
      JSON.stringify({ fileName: "저장된모델.glb", url: buildBimViewerCoUrl("saved-model"), savedAt: Date.now() }),
    );

    render(
      <ProjectProvider>
        <BimWorkspace />
      </ProjectProvider>,
    );

    expect(await screen.findAllByText("저장된모델.glb")).toHaveLength(2);
  });
});
