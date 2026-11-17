"use client";

import { useState } from "react";

import { DatabaseDriveWorkspace } from "./database-drive-workspace";
import { GoogleDriveWorkspace } from "./google-drive-workspace";

export function ConnectedDriveWorkspace() {
  const [provider, setProvider] = useState<"project" | "google">("project");

  return (
    <div className="connected-drive-workspace">
      <nav
        className="drive-provider-switch"
        aria-label="공유 드라이브 저장소 선택"
      >
        <div>
          <strong>파일 저장소</strong>
          <span>PROJECT HUB 저장소와 Google Drive를 선택할 수 있습니다.</span>
        </div>
        <button
          className={provider === "project" ? "active" : ""}
          type="button"
          onClick={() => setProvider("project")}
        >
          PROJECT HUB
        </button>
        <button
          className={provider === "google" ? "active google" : "google"}
          type="button"
          onClick={() => setProvider("google")}
        >
          Google Drive
        </button>
      </nav>
      {provider === "project" ? (
        <DatabaseDriveWorkspace />
      ) : (
        <GoogleDriveWorkspace />
      )}
    </div>
  );
}
