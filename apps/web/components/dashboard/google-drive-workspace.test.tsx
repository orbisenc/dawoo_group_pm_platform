import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { buildGoogleDriveListUrl, GoogleDriveDropzone, isDriveFolder, resolveDriveItem } from "./google-drive-workspace";

describe("Google Drive 드래그 앤 드롭 업로드", () => {
  it("개인 드라이브와 공유 드라이브 목록 요청을 구분한다", () => {
    const personal = new URL(buildGoogleDriveListUrl("root", "도면"));
    const shared = new URL(buildGoogleDriveListUrl("folder-1", "", "shared-1"));

    expect(personal.searchParams.get("corpora")).toBe("user");
    expect(personal.searchParams.get("driveId")).toBeNull();
    expect(personal.searchParams.get("q")).toContain("name contains '도면'");
    expect(shared.searchParams.get("corpora")).toBe("drive");
    expect(shared.searchParams.get("driveId")).toBe("shared-1");
    expect(shared.searchParams.get("supportsAllDrives")).toBe("true");
    expect(shared.searchParams.get("includeItemsFromAllDrives")).toBe("true");
  });

  it("폴더 바로가기를 외부 링크가 아닌 실제 대상 폴더로 해석한다", () => {
    const shortcut = {
      id: "shortcut-1",
      name: "설계 자료 바로가기",
      mimeType: "application/vnd.google-apps.shortcut",
      shortcutDetails: {
        targetId: "folder-target-1",
        targetMimeType: "application/vnd.google-apps.folder",
      },
    };

    expect(isDriveFolder(shortcut)).toBe(true);
    expect(resolveDriveItem(shortcut)).toEqual({
      id: "folder-target-1",
      mimeType: "application/vnd.google-apps.folder",
      shortcut: true,
    });
  });

  it("여러 파일을 드롭하면 한 번에 업로드 대상으로 전달한다", () => {
    const onFiles = vi.fn();
    const files = [
      new File(["report"], "사업성검토보고서.pdf", {
        type: "application/pdf",
      }),
      new File(["model"], "수지분석.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    ];

    const { container } = render(
      <GoogleDriveDropzone busy={false} onFiles={onFiles} />,
    );
    const dropzone = container.querySelector(".google-drive-dropzone");
    expect(dropzone).not.toBeNull();

    fireEvent.dragEnter(dropzone!, { dataTransfer: { files } });
    expect(screen.getByText("여기에 파일을 놓아 주세요")).toBeInTheDocument();

    fireEvent.drop(dropzone!, { dataTransfer: { files } });
    expect(onFiles).toHaveBeenCalledOnce();
    expect(onFiles).toHaveBeenCalledWith(files);
  });

  it("파일 선택에서도 여러 파일을 전달하고 같은 파일을 다시 선택할 수 있다", () => {
    const onFiles = vi.fn();
    const file = new File(["summary"], "투자심의요약.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    render(<GoogleDriveDropzone busy={false} onFiles={onFiles} />);

    const input = screen.getByLabelText("Google Drive 업로드 파일 선택");
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.change(input, { target: { files: [file] } });

    expect(onFiles).toHaveBeenCalledTimes(2);
    expect(onFiles).toHaveBeenLastCalledWith([file]);
  });

  it("업로드 중에는 추가 드롭을 받지 않고 진행 상태를 알린다", () => {
    const onFiles = vi.fn();
    const file = new File(["data"], "추가자료.pdf", {
      type: "application/pdf",
    });
    const { container } = render(
      <GoogleDriveDropzone
        busy
        uploadStatus="1/2 · 사업성검토보고서.pdf 업로드 중"
        onFiles={onFiles}
      />,
    );
    const dropzone = container.querySelector(".google-drive-dropzone");

    expect(
      screen.getByText("1/2 · 사업성검토보고서.pdf 업로드 중"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "업로드 중" })).toBeDisabled();
    fireEvent.drop(dropzone!, { dataTransfer: { files: [file] } });
    expect(onFiles).not.toHaveBeenCalled();
  });
});
