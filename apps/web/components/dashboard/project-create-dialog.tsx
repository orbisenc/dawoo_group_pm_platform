"use client";

import Image from "next/image";
import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";

import { useProject } from "./project-context";
import type { ProjectOption } from "./project-context";

const acceptedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maximumImageBytes = 10 * 1024 * 1024;
const maximumBackgroundWidth = 1920;
const maximumBackgroundHeight = 1080;

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("이미지를 읽지 못했습니다."));
    reader.readAsDataURL(file);
  });
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = document.createElement("img");
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("이미지를 처리하지 못했습니다."));
    image.src = source;
  });
}

export async function prepareProjectBackground(file: File) {
  if (!acceptedImageTypes.has(file.type)) {
    throw new Error("JPG, PNG 또는 WebP 이미지만 첨부할 수 있습니다.");
  }
  if (file.size > maximumImageBytes) {
    throw new Error("대표 이미지는 10MB 이하만 첨부할 수 있습니다.");
  }

  const source = await readFileAsDataUrl(file);
  if (file.size <= 600 * 1024) return source;

  const image = await loadImage(source);
  const scale = Math.min(
    maximumBackgroundWidth / image.naturalWidth,
    maximumBackgroundHeight / image.naturalHeight,
    1,
  );
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("이미지를 처리하지 못했습니다.");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/webp", 0.82);
}

export function ProjectCreateDialog({
  open,
  onClose,
  project,
}: {
  open: boolean;
  onClose: () => void;
  project?: ProjectOption | null;
}) {
  const { addProject, updateProject, projects } = useProject();
  const [name, setName] = useState(project?.name ?? "");
  const [category, setCategory] = useState(project?.category ?? project?.period ?? "");
  const [location, setLocation] = useState(project?.location ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [image, setImage] = useState(project?.image ?? "");
  const [imageName, setImageName] = useState(project?.image ? "현재 대표 이미지" : "");
  const [imageProcessing, setImageProcessing] = useState(false);
  const [error, setError] = useState("");
  const isEditing = Boolean(project);

  if (!open) return null;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedName = name.trim().toLowerCase();
    if (projects.some((item) => item.id !== project?.id && item.name.trim().toLowerCase() === normalizedName)) {
      setError("같은 이름의 프로젝트가 이미 있습니다.");
      return;
    }

    if (imageProcessing) {
      setError("대표 이미지 처리가 끝날 때까지 잠시 기다려 주세요.");
      return;
    }

    const input = { name, category, location, description, image: image || undefined };
    if (project) updateProject(project.id, input);
    else addProject(input);
    setName("");
    setCategory("");
    setLocation("");
    setDescription("");
    setImage("");
    setImageName("");
    setError("");
    onClose();
  }

  async function changeImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

    setImageProcessing(true);
    setError("");
    try {
      const nextImage = await prepareProjectBackground(file);
      setImage(nextImage);
      setImageName(file.name);
    } catch (caught) {
      setImage("");
      setImageName("");
      setError(caught instanceof Error ? caught.message : "대표 이미지를 처리하지 못했습니다.");
    } finally {
      setImageProcessing(false);
    }
  }

  return (
    <div className="project-dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="project-create-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-create-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <span>{isEditing ? "EDIT PROJECT" : "NEW PROJECT"}</span>
            <h2 id="project-create-title">{isEditing ? "프로젝트 수정" : "새 프로젝트 추가"}</h2>
            <p>{isEditing ? "수정한 정보와 대표 이미지는 통합 대시보드에 바로 반영됩니다." : "프로젝트 기본 정보를 입력하면 통합 대시보드 목록에 바로 추가됩니다."}</p>
          </div>
          <button type="button" aria-label={`${isEditing ? "프로젝트 수정" : "프로젝트 추가"} 창 닫기`} onClick={onClose}>×</button>
        </header>
        <form onSubmit={submit}>
          <label>
            <span>프로젝트명 <b>*</b></span>
            <input value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={200} required autoFocus placeholder="예: 강남 복합개발사업" />
          </label>
          <div className="project-form-row">
            <label>
              <span>사업 유형</span>
              <input value={category} onChange={(event) => setCategory(event.target.value)} maxLength={80} placeholder="예: 도시개발" />
            </label>
            <label>
              <span>프로젝트 위치</span>
              <input value={location} onChange={(event) => setLocation(event.target.value)} maxLength={160} placeholder="예: 서울특별시 강남구" />
            </label>
          </div>
          <label>
            <span>프로젝트 설명</span>
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1000} rows={4} placeholder="사업 목적과 주요 내용을 입력해 주세요." />
          </label>
          <div className="project-image-field">
            <span className="project-image-label">프로젝트 대표 이미지</span>
            {image ? (
              <div className="project-image-preview">
                <Image src={image} alt="프로젝트 대표 이미지 미리보기" fill sizes="620px" unoptimized />
                <div>
                  <span>{imageName}</span>
                  <div className="project-image-preview-actions">
                    <label>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        aria-label="프로젝트 대표 이미지 교체"
                        onChange={changeImage}
                        disabled={imageProcessing}
                      />
                      {imageProcessing ? "처리 중..." : "이미지 교체"}
                    </label>
                    <button type="button" onClick={() => { setImage(""); setImageName(""); }}>이미지 제거</button>
                  </div>
                </div>
              </div>
            ) : (
              <label className="project-image-upload">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  aria-label="프로젝트 대표 이미지"
                  onChange={changeImage}
                  disabled={imageProcessing}
                />
                <strong>{imageProcessing ? "이미지 처리 중..." : "대표 이미지 선택"}</strong>
                <small>JPG, PNG, WebP · 최대 10MB · 배경에 맞게 자동 최적화</small>
              </label>
            )}
          </div>
          {error ? <p className="project-form-error" role="alert">{error}</p> : null}
          <footer>
            <button type="button" className="project-dialog-cancel" onClick={onClose}>취소</button>
            <button type="submit" className="project-dialog-submit" disabled={imageProcessing}>{isEditing ? "수정사항 저장" : "프로젝트 추가"}</button>
          </footer>
        </form>
      </section>
    </div>
  );
}
